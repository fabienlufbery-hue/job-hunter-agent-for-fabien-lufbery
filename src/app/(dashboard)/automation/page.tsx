'use client';

import React, { useEffect, useState } from 'react';
import {
  Clock,
  Play,
  Server,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { Badge, Button, GlassCard, SectionHeader } from '@/components/ui/primitives';
import { formatFrDate } from '@/lib/utils';

interface AutomationData {
  isDemo: boolean;
  schedule: {
    timezone: string;
    dailySlots: string[];
    nextRun: { iso: string; labelParis: string; slotHour: number };
    serverEngine: string;
    localComplement: string;
    browserEngine: string;
    cronSecretConfigured: boolean;
  };
  extensionHeartbeat: {
    browserStatus: string;
    lastSeenAt: string | null;
    lastSyncAt: string | null;
    totalImported: number;
    lastError: string | null;
  } | null;
  runs: Array<{
    id: string;
    triggerType: string;
    sources: string[];
    status: string;
    jobsFetched: number;
    jobsNew: number;
    jobsDuplicates: number;
    jobsScored: number;
    errors: Array<{ source: string; message: string; code?: string }>;
    startedAt: string;
    finishedAt: string | null;
  }>;
}

export default function AutomationPage() {
  const [data, setData] = useState<AutomationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function load() {
    return fetch('/api/automation').then(async (res) => {
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur chargement');
      setData(json);
    }).catch((err) => {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Erreur' });
    }).finally(() => {
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
      const res = await fetch('/api/automation/run', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Échec du lancement manuel');
      const r = json.run;
      setFeedback({
        kind: r.status === 'failed' ? 'err' : 'ok',
        text: `Exécution terminée (${r.status}) : ${r.jobsFetched} collectées, ${r.jobsNew} nouvelles, ${r.jobsDuplicates} doublons, ${r.jobsScored} notées par Gemini.`,
      });
      await load();
    } catch (err) {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Erreur' });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Automation — Planification 09h00 & 18h00"
        subtitle="Orchestration quotidienne fuseau Europe/Paris (changement d’heure DST géré) avec Apify et Gemini."
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
              <Play className="h-3.5 w-3.5" />
              {running ? 'Synchronisation...' : 'Lancer manuellement'}
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

      {/* Dual Architecture Explanation */}
      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Server className="h-4 w-4 text-cyan-300" />
              Automatisation Serveur (Apify + Gemini)
            </div>
            <Badge variant={data?.schedule.cronSecretConfigured ? 'success' : 'warning'}>
              {data?.schedule.cronSecretConfigured ? 'CRON_SECRET actif' : 'CRON_SECRET à configurer'}
            </Badge>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Exécutée automatiquement <strong>2 fois par jour à 09h00 et 18h00 (Europe/Paris)</strong>{' '}
            via GitHub Actions (<code className="font-mono">.github/workflows/daily-job-sync.yml</code>
            ), contournant la limite 1x/jour de Vercel Cron Hobby tout en gérant l’heure d’hiver/été.
          </p>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs flex items-center justify-between">
            <span className="text-slate-400">Prochain créneau programmé</span>
            <strong className="text-cyan-200">{data?.schedule.nextRun.labelParis || '—'}</strong>
          </div>
          <p className="text-[11px] text-slate-500">
            Complément local disponible : <code className="font-mono">scripts/install-macos-launchd.sh</code>
          </p>
        </GlassCard>

        <GlassCard className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Collecte Apify</h2>
          <p className="text-xs text-slate-300">Planifiez les collectes dans Apify avant les créneaux d’import de 09h00 et 18h00. Le serveur lit le dernier résultat réussi et analyse les nouvelles offres avec Gemini. Aucun navigateur local requis.</p>
        </GlassCard>
      </div>

      {/* Runs History */}
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
              const Icon =
                run.status === 'success'
                  ? CheckCircle2
                  : run.status === 'partial'
                    ? AlertTriangle
                    : XCircle;
              const variant =
                run.status === 'success'
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
                        <Icon className="h-3 w-3" />
                        {run.status}
                      </Badge>
                      <Badge variant="violet">{run.triggerType}</Badge>
                      <span className="text-xs text-slate-300">
                        Sources : {run.sources.join(', ')}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">{formatFrDate(run.startedAt)}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-950/50 px-3 py-2">
                      <span className="text-slate-400">Collectées :</span>{' '}
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
                      <span className="text-slate-400">Notées IA :</span>{' '}
                      <strong className="text-cyan-300">{run.jobsScored}</strong>
                    </div>
                  </div>

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
    </div>
  );
}
