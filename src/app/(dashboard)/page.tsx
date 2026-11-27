'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Sparkles,
  FileCheck2,
  Send,
  Clock,
  RefreshCw,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  Button,
  GlassCard,
  ScoreBadge,
  SectionHeader,
} from '@/components/ui/primitives';
import { formatFrDate, PLATFORM_DISPLAY } from '@/lib/utils';

interface OverviewData {
  isDemo: boolean;
  kpis: {
    totalJobs: number;
    compatibleJobs: number;
    preparedApplications: number;
    sentApplications: number;
  };
  bySource: Record<string, number>;
  topJobs: Array<{
    id: string;
    title: string;
    company: string | null;
    location: string | null;
    contractType: string | null;
    source: string;
    originalUrl: string;
    analysis: { fitScore: number; reasoningSummary: string } | null;
  }>;
  lastSyncAt: string | null;
  nextScheduledRun: { iso: string; labelParis: string; slotHour: number };
  sourcesStatus: Array<{
    id: string;
    name: string;
    status: string;
    statusLabel: string;
    detail: string;
    mode: string;
  }>;
}

const SOURCE_ORDER = [
  'france_travail',
  'welcome_to_the_jungle',
  'indeed',
  'hellowork',
  'meteojob',
];

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    return fetch('/api/overview').then(async (res) => {
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur chargement');
      setData(json);
      setError(null);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }).finally(() => {
      setLoading(false);
    });
  }

  useEffect(() => {
    void load();
  }, []);

  const maxSourceCount = Math.max(
    1,
    ...SOURCE_ORDER.map((s) => data?.bySource?.[s] || 0)
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Overview — Job Hunter Agent for Fabien Lufbery"
        subtitle="Vue synthétique de vos offres collectées sur les 5 sources, scores Gemini et candidatures."
        action={
          <>
            <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <Link href="/jobs">
              <Button size="sm">
                <Briefcase className="h-3.5 w-3.5" />
                Voir les Job Matches
              </Button>
            </Link>
          </>
        }
      />

      {error && (
        <GlassCard className="border-rose-500/35 bg-rose-500/10 text-sm text-rose-200">
          {error}
        </GlassCard>
      )}

      {/* 4 KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GlassCard hover>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Offres collectées</span>
            <div className="rounded-xl bg-indigo-500/15 p-2 text-indigo-300 border border-indigo-400/20">
              <Briefcase className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-white">
            {loading ? '—' : data?.kpis.totalJobs ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-400">Dédupliquées sur les 5 sources</p>
        </GlassCard>

        <GlassCard hover>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Offres compatibles</span>
            <div className="rounded-xl bg-cyan-500/15 p-2 text-cyan-300 border border-cyan-400/20">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-white">
            {loading ? '—' : data?.kpis.compatibleJobs ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-400">Score Gemini supérieur au seuil cible</p>
        </GlassCard>

        <GlassCard hover>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Candidatures préparées</span>
            <div className="rounded-xl bg-violet-500/15 p-2 text-violet-300 border border-violet-400/20">
              <FileCheck2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-white">
            {loading ? '—' : data?.kpis.preparedApplications ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-400">Lettres, pitchs &amp; suggestions CV</p>
        </GlassCard>

        <GlassCard hover>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Candidatures envoyées</span>
            <div className="rounded-xl bg-emerald-500/15 p-2 text-emerald-300 border border-emerald-400/20">
              <Send className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-white">
            {loading ? '—' : data?.kpis.sentApplications ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-400">Envoyées après confirmation humaine</p>
        </GlassCard>
      </div>

      {/* Sync Banner */}
      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/[0.06] p-2.5 text-cyan-300 border border-white/10">
              <RefreshCw className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Dernière synchronisation</p>
              <p className="text-sm font-semibold text-white">
                {data?.lastSyncAt ? formatFrDate(data.lastSyncAt) : 'Aucune exécution enregistrée'}
              </p>
            </div>
          </div>
          <Link href="/automation">
            <Button variant="secondary" size="sm">
              Historique
            </Button>
          </Link>
        </GlassCard>

        <GlassCard className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-500/15 p-2.5 text-indigo-300 border border-indigo-400/25">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Prochaine recherche programmée (09h00 &amp; 18h00)</p>
              <p className="text-sm font-semibold text-white">
                {data?.nextScheduledRun?.labelParis || '—'}
              </p>
            </div>
          </div>
          <Badge variant="violet">Europe/Paris</Badge>
        </GlassCard>
      </div>

      {/* Platform Breakdown & Sources Status */}
      <div className="grid gap-6 lg:grid-cols-12">
        <GlassCard className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Répartition par plateforme</h2>
            <Badge variant="info">5 sources</Badge>
          </div>
          <div className="space-y-3.5">
            {SOURCE_ORDER.map((source) => {
              const info = PLATFORM_DISPLAY[source];
              const count = data?.bySource?.[source] || 0;
              const pct = Math.round((count / maxSourceCount) * 100);
              return (
                <div key={source} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">{info.label}</span>
                    <span className="font-mono text-slate-300">{count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-500"
                      style={{ width: `${count > 0 ? Math.max(pct, 8) : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Statut réel des 5 sources</h2>
            <Link href="/integrations" className="text-xs text-cyan-300 hover:underline">
              Voir toutes les intégrations →
            </Link>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {(data?.sourcesStatus || []).map((src) => {
              const isOk = src.status === 'connected';
              const isWarn =
                src.status === 'configured_unverified' || src.status === 'needs_attention';
              return (
                <div key={src.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-2.5 min-w-0">
                    {isOk ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : isWarn ? (
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{src.name}</p>
                      <p className="text-xs text-slate-400 line-clamp-1">{src.detail}</p>
                    </div>
                  </div>
                  <Badge variant={isOk ? 'success' : isWarn ? 'warning' : 'default'}>
                    {src.statusLabel}
                  </Badge>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      {/* Top Offers */}
      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Meilleures offres détectées</h2>
            <p className="text-xs text-slate-400">
              Classées par score de compatibilité Gemini (1 à 10)
            </p>
          </div>
          <Link href="/jobs">
            <Button variant="secondary" size="sm">
              Tout parcourir
            </Button>
          </Link>
        </div>

        {!loading && (!data?.topJobs || data.topJobs.length === 0) ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
            <p className="text-sm text-slate-300">Aucune offre collectée pour le moment.</p>
            <p className="mt-1 text-xs text-slate-400">
              Lancez une synchronisation Apify depuis Job Matches.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {(data?.topJobs || []).map((job) => {
              const pInfo = PLATFORM_DISPLAY[job.source] || {
                label: job.source,
                colorClass: 'bg-white/10 text-slate-300 border-white/15',
              };
              return (
                <div
                  key={job.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 hover:border-indigo-400/30 transition-colors"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${pInfo.colorClass}`}
                      >
                        {pInfo.label}
                      </span>
                      {job.contractType && <Badge>{job.contractType}</Badge>}
                      {job.location && (
                        <span className="text-xs text-slate-400">{job.location}</span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-white truncate">{job.title}</h3>
                    <p className="text-xs text-slate-400">
                      {job.company || 'Entreprise non précisée'}
                      {job.analysis?.reasoningSummary ? ` — ${job.analysis.reasoningSummary}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <ScoreBadge score={job.analysis?.fitScore} />
                    <a
                      href={job.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-white/10 bg-white/[0.05] p-2 text-slate-300 hover:bg-white/10 hover:text-white"
                      title="Ouvrir l’offre originale"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
