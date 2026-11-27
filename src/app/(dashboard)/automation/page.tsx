'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Clock,
  Play,
  Server,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  DollarSign,
  Loader2,
  StopCircle,
  Cloud,
} from 'lucide-react';
import { Badge, Button, GlassCard, SectionHeader } from '@/components/ui/primitives';
import { formatFrDate, formatUsd } from '@/lib/utils';

interface AutomationRunItem {
  id: string;
  triggerType: string;
  sources: string[];
  status: string;
  jobsFetched: number;
  jobsNew: number;
  jobsDuplicates: number;
  jobsScored: number;
  costUsd: number;
  apifyRunIds: string[];
  summary: string | null;
  errors: Array<{ source: string; message: string; code?: string }>;
  startedAt: string;
  finishedAt: string | null;
}

interface ApifyRunItem {
  id: string;
  sourceName: string;
  kind: string;
  apifyId: string;
  apifyRunId: string;
  datasetId: string | null;
  status: string;
  itemsFetched: number;
  itemsInserted: number;
  itemsDuplicates: number;
  itemsRejected: number;
  costUsd: number;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
}

interface AutomationData {
  isDemo: boolean;
  schedule: {
    timezone: string;
    dailySlots: string[];
    nextRun: { iso: string; labelParis: string; slotHour: number };
    serverEngine: string;
    cronSecretConfigured: boolean;
  };
  budget: {
    monthlySpendUsd: number;
    monthlyBudgetUsd: number;
    maxCostPerRunUsd: number;
  };
  runs: AutomationRunItem[];
  apifyRuns: ApifyRunItem[];
}

export default function AutomationPage() {
  const [data, setData] = useState<AutomationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [pollingId, setPollingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function load() {
    return fetch('/api/automation')
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erreur chargement');
        setData(json);
      })
      .catch((err) => {
        setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Erreur' });
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    void load();
  }, []);

  async function triggerManualRun() {
    setRunning(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/automation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Échec du lancement manuel');
      const r = json.run;
      setFeedback({
        kind: r.status === 'failed' ? 'err' : 'ok',
        text: r.hasAsyncPending
          ? 'Collecte Apify démarrée en asynchrone. Cliquez sur « Actualiser le statut Apify » pour récupérer le dataset dès fin d’exécution.'
          : `Pipeline terminé (${r.status}) : ${r.jobsFetched} récupérées, ${r.jobsNew} nouvelles, ${r.jobsDuplicates} doublons, ${r.jobsScored} notées IA · Coût : ${formatUsd(r.costUsd)}.`,
      });
      await load();
    } catch (err) {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Erreur' });
    } finally {
      setRunning(false);
    }
  }

  async function pollRun(runId: string) {
    setPollingId(runId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/automation/runs/${runId}/poll`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur suivi asynchrone');
      setFeedback({
        kind: 'ok',
        text:
          json.stillRunning > 0
            ? `${json.stillRunning} exécution(s) Apify encore en cours dans le cloud...`
            : `Collecte finalisée : ${json.inserted} nouvelle(s) offre(s), ${json.scored} notée(s) IA · Coût : ${formatUsd(json.costUsd)}.`,
      });
      await load();
    } catch (err) {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Erreur' });
    } finally {
      setPollingId(null);
    }
  }

  async function abortRun(runId: string) {
    if (!confirm('Interrompre cette exécution Apify en cours ?')) return;
    setPollingId(runId);
    try {
      await fetch(`/api/automation/runs/${runId}/poll`, { method: 'DELETE' });
      setFeedback({ kind: 'ok', text: 'Exécution Apify interrompue.' });
      await load();
    } finally {
      setPollingId(null);
    }
  }

  const budgetPct = data?.budget
    ? Math.min(100, Math.round((data.budget.monthlySpendUsd / Math.max(0.01, data.budget.monthlyBudgetUsd)) * 100))
    : 0;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Automation — Planification Cloud 09h00 & 18h00"
        subtitle="Pipeline 100 % cloud autonome (fonctionne ordinateur éteint) : Préférences → Apify → Déduplication → PostgreSQL → Gemini."
        action={
          <>
            <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <Button
              size="sm"
              onClick={triggerManualRun}
              disabled={running || Boolean(data?.isDemo)}
            >
              {running ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {running ? 'Recherche en cours...' : 'Lancer une recherche complète'}
            </Button>
          </>
        }
      />

      {feedback && (
        <div
          className={`rounded-xl border p-3.5 text-xs ${
            feedback.kind === 'ok'
              ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-100'
              : 'border-rose-500/35 bg-rose-500/15 text-rose-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Scheduler + Budget Overview */}
      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Server className="h-4 w-4 text-cyan-300" />
              Planificateur Cloud (09h00 &amp; 18h00 Europe/Paris)
            </div>
            <Badge variant={data?.schedule.cronSecretConfigured ? 'success' : 'warning'}>
              {data?.schedule.cronSecretConfigured ? 'CRON_SECRET actif' : 'CRON_SECRET à configurer'}
            </Badge>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Exécuté automatiquement par GitHub Actions (
            <code className="font-mono">.github/workflows/daily-job-sync.yml</code>) même lorsque
            votre ordinateur est éteint. Verrou anti-concurrence et reprise asynchrone intégrés pour
            respecter les limites serverless Vercel.
          </p>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs flex items-center justify-between">
            <span className="text-slate-400">Prochain créneau programmé</span>
            <strong className="text-cyan-200">{data?.schedule.nextRun.labelParis || '—'}</strong>
          </div>
        </GlassCard>

        <GlassCard className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <DollarSign className="h-4 w-4 text-emerald-400" />
              Contrôle des coûts Apify (mois en cours)
            </div>
            <Link href="/settings" className="text-xs text-cyan-300 hover:underline">
              Ajuster les limites →
            </Link>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Dépense enregistrée</span>
              <span className="font-mono text-white">
                {formatUsd(data?.budget.monthlySpendUsd)} /{' '}
                <strong>${(data?.budget.monthlyBudgetUsd ?? 5).toFixed(2)}</strong>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className={`h-full rounded-full transition-all ${
                  budgetPct >= 85
                    ? 'bg-rose-500'
                    : budgetPct >= 60
                      ? 'bg-amber-400'
                      : 'bg-gradient-to-r from-emerald-400 to-cyan-400'
                }`}
                style={{ width: `${Math.max(budgetPct, budgetPct > 0 ? 4 : 0)}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Plafond par exécution :{' '}
            <strong className="text-slate-200">
              ${(data?.budget.maxCostPerRunUsd ?? 0.75).toFixed(2)}
            </strong>{' '}
            (transmis directement à Apify via <code className="font-mono">maxTotalChargeUsd</code>).
          </p>
        </GlassCard>
      </div>

      {/* Pipeline Runs History */}
      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-indigo-300" />
            <h2 className="text-base font-semibold text-white">Historique des exécutions</h2>
          </div>
          <span className="text-xs text-slate-400">{data?.runs.length || 0} exécution(s)</span>
        </div>

        {!data?.runs || data.runs.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            Aucune exécution enregistrée pour le moment.
          </p>
        ) : (
          <div className="space-y-3">
            {data.runs.map((run) => {
              const isRunning = run.status === 'running';
              const Icon = isRunning
                ? Loader2
                : run.status === 'success'
                  ? CheckCircle2
                  : run.status === 'partial'
                    ? AlertTriangle
                    : XCircle;
              const variant = isRunning
                ? 'info'
                : run.status === 'success'
                  ? 'success'
                  : run.status === 'partial'
                    ? 'warning'
                    : 'danger';

              return (
                <div
                  key={run.id}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={variant}>
                        <Icon className={`h-3 w-3 ${isRunning ? 'animate-spin' : ''}`} />
                        {run.status}
                      </Badge>
                      <Badge variant="violet">{run.triggerType}</Badge>
                      <span className="text-xs text-slate-300">
                        Sources : {run.sources.join(', ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isRunning && !data.isDemo && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void pollRun(run.id)}
                            disabled={pollingId === run.id}
                          >
                            <RefreshCw
                              className={`h-3 w-3 ${pollingId === run.id ? 'animate-spin' : ''}`}
                            />
                            Actualiser Apify
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => void abortRun(run.id)}
                            disabled={pollingId === run.id}
                          >
                            <StopCircle className="h-3 w-3" />
                            Arrêter
                          </Button>
                        </>
                      )}
                      <span className="text-xs text-slate-400">{formatFrDate(run.startedAt)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-950/50 px-3 py-2">
                      <span className="text-slate-400">Récupérées :</span>{' '}
                      <strong className="text-white">{run.jobsFetched}</strong>
                    </div>
                    <div className="rounded-lg bg-slate-950/50 px-3 py-2">
                      <span className="text-slate-400">Nouvelles :</span>{' '}
                      <strong className="text-emerald-300">{run.jobsNew}</strong>
                    </div>
                    <div className="rounded-lg bg-slate-950/50 px-3 py-2">
                      <span className="text-slate-400">Doublons :</span>{' '}
                      <strong className="text-slate-200">{run.jobsDuplicates}</strong>
                    </div>
                    <div className="rounded-lg bg-slate-950/50 px-3 py-2">
                      <span className="text-slate-400">Analysées IA :</span>{' '}
                      <strong className="text-cyan-300">{run.jobsScored}</strong>
                    </div>
                    <div className="rounded-lg bg-slate-950/50 px-3 py-2">
                      <span className="text-slate-400">Coût Apify :</span>{' '}
                      <strong className="font-mono text-amber-200">{formatUsd(run.costUsd)}</strong>
                    </div>
                  </div>

                  {run.summary && <p className="text-xs text-slate-400">{run.summary}</p>}

                  {run.errors && run.errors.length > 0 && (
                    <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-2.5 space-y-1 text-xs text-amber-200">
                      {run.errors.map((e, i) => (
                        <p key={i}>
                          <strong>[{e.source}]</strong> {e.message}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* Detailed Apify Runs Log */}
      {data?.apifyRuns && data.apifyRuns.length > 0 && (
        <GlassCard className="space-y-3">
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-cyan-300" />
            <h2 className="text-sm font-semibold text-white">
              Journal détaillé des runs Apify ({data.apifyRuns.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[0.08] text-slate-400">
                <tr>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Run ID</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2 pr-3">Items</th>
                  <th className="py-2 pr-3">Coût</th>
                  <th className="py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-slate-300">
                {data.apifyRuns.map((ar) => (
                  <tr key={ar.id}>
                    <td className="py-2 pr-3">
                      <span className="font-medium text-white">{ar.sourceName}</span>
                      <span className="block text-[11px] font-mono text-slate-500">{ar.apifyId}</span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-[11px] text-slate-400">
                      {ar.apifyRunId.slice(0, 14)}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant={
                          ar.status === 'IMPORTED' || ar.status === 'SUCCEEDED'
                            ? 'success'
                            : ar.status === 'RUNNING' || ar.status === 'READY'
                              ? 'info'
                              : 'danger'
                        }
                      >
                        {ar.status}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">
                      {ar.itemsInserted} new / {ar.itemsFetched} total
                    </td>
                    <td className="py-2 pr-3 font-mono text-amber-200">{formatUsd(ar.costUsd)}</td>
                    <td className="py-2 whitespace-nowrap text-slate-400">
                      {formatFrDate(ar.startedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
