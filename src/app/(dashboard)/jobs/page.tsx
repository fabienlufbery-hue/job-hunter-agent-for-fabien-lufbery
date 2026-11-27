'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Star,
  ExternalLink,
  Sparkles,
  FileSignature,
  RefreshCw,
  MapPin,
  Building2,
  Banknote,
  Layers,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  Badge,
  Button,
  GlassCard,
  Input,
  ScoreBadge,
  SectionHeader,
  Select,
} from '@/components/ui/primitives';
import { formatFrDateShort, PLATFORM_DISPLAY } from '@/lib/utils';

interface JobItem {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  contractType: string | null;
  salary: string | null;
  description: string;
  skills: string[];
  publishedAt: string | null;
  collectedAt: string;
  originalUrl: string;
  source: string;
  provenance: Array<{ source: string; url: string; seenAt: string }>;
  applicationStatus: string;
  isFavorite: boolean;
  recruiterEmail: string | null;
  analysis: {
    fitScore: number;
    reasoningSummary: string;
    matchedSkills: string[];
    missingSkills: string[];
    experienceMatch: string;
    educationMatch: string;
    languageMatch: string;
    atsKeywords: string[];
    strengths: string[];
    weaknesses: string[];
    recommendation: string;
    modelUsed: string;
  } | null;
}

export default function JobMatchesPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState('');
  const [source, setSource] = useState('all');
  const [location, setLocation] = useState('');
  const [contract, setContract] = useState('all');
  const [minScore, setMinScore] = useState('0');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState('score');

  const loadJobs = useCallback((signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (source !== 'all') params.set('source', source);
    if (location) params.set('location', location);
    if (contract !== 'all') params.set('contract', contract);
    if (minScore !== '0') params.set('minScore', minScore);
    if (favoritesOnly) params.set('favorites', 'true');
    params.set('sort', sortBy);

    return fetch(`/api/jobs?${params.toString()}`, { signal }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur chargement offres');
      setJobs(data.jobs || []);
      setIsDemo(Boolean(data.isDemo));
      setSelectedId((prev) =>
        prev && (data.jobs || []).some((j: JobItem) => j.id === prev)
          ? prev
          : data.jobs?.[0]?.id || null
      );
    }).catch((err) => {
      if (!signal?.aborted) setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Erreur réseau' });
    }).finally(() => {
      if (!signal?.aborted) setLoading(false);
    });
  }, [q, source, location, contract, minScore, favoritesOnly, sortBy]);

  useEffect(() => {
    const controller = new AbortController();
    void loadJobs(controller.signal);
    return () => controller.abort();
  }, [loadJobs]);

  const selected = jobs.find((j) => j.id === selectedId) || null;

  async function toggleFavorite(job: JobItem) {
    if (isDemo) {
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, isFavorite: !j.isFavorite } : j))
      );
      return;
    }
    const res = await fetch(`/api/jobs/${job.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFavorite: !job.isFavorite }),
    });
    if (res.ok) {
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, isFavorite: !j.isFavorite } : j))
      );
    }
  }

  async function scoreJob(jobId: string, force = false) {
    setBusyAction(`score:${jobId}`);
    setFeedback(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec du scoring Gemini');
      setFeedback({
        kind: 'ok',
        text: data.cached
          ? `Score en cache conservé (${data.analysis.fitScore}/10 — offre et CV inchangés).`
          : `Évaluation Gemini terminée : ${data.analysis.fitScore}/10 (${data.analysis.modelUsed}).`,
      });
      await loadJobs();
    } catch (err) {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Erreur scoring' });
    } finally {
      setBusyAction(null);
    }
  }

  async function tailorApplication(jobId: string) {
    setBusyAction(`tailor:${jobId}`);
    setFeedback(null);
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur génération candidature');
      router.push(`/applications?selected=${data.application.id}`);
    } catch (err) {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Erreur IA' });
      setBusyAction(null);
    }
  }

  async function syncApify() {
    setBusyAction('apify-sync');
    setFeedback(null);
    try {
      const res = await fetch('/api/jobs/sync/apify', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur Apify');
      setFeedback({
        kind: 'ok',
        text: data.hasAsyncPending
          ? 'Collecte Apify lancée en arrière-plan. Suivez son avancement dans Automation.'
          : `Recherche Apify terminée : ${data.inserted} nouvelle(s), ${data.duplicates} doublon(s), ${data.scored} notée(s) IA.`,
      });
      await loadJobs();
    } catch (err) {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Erreur Apify' });
    } finally { setBusyAction(null); }
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Job Matches"
        subtitle="Offres normalisées et dédupliquées collectées via Apify avec scoring Gemini (1 à 10) et analyse détaillée."
        action={
          <>
            <Button
              size="sm"
              onClick={syncApify}
              disabled={isDemo || loading || busyAction !== null}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busyAction === 'apify-sync' ? 'animate-spin' : ''}`} />
              {busyAction === 'apify-sync' ? 'Collecte Apify...' : 'Lancer une recherche Apify'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void loadJobs()} disabled={loading}>
              Actualiser
            </Button>
          </>
        }
      />

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-xl border p-3.5 text-xs ${
            feedback.kind === 'ok'
              ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-100'
              : 'border-rose-500/35 bg-rose-500/15 text-rose-200'
          }`}
        >
          {feedback.kind === 'ok' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Filters Toolbar */}
      <GlassCard className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2 relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <Input
              className="pl-9"
              placeholder="Rechercher poste, entreprise, compétence..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <Select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">Toutes les plateformes</option>
            <option value="welcome_to_the_jungle">Welcome to the Jungle</option>
            <option value="linkedin">LinkedIn</option>
            <option value="indeed">Indeed</option>
            <option value="hellowork">HelloWork</option>
            <option value="meteojob">Meteojob</option>
            <option value="other">Autres sources Apify</option>
          </Select>

          <Input
            placeholder="Localisation (Paris, Lyon...)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />

          <Select value={contract} onChange={(e) => setContract(e.target.value)}>
            <option value="all">Tous contrats</option>
            <option value="cdi">CDI</option>
            <option value="cdd">CDD</option>
            <option value="alternance">Alternance</option>
            <option value="stage">Stage</option>
            <option value="freelance">Freelance</option>
          </Select>

          <Select value={minScore} onChange={(e) => setMinScore(e.target.value)}>
            <option value="0">Score min : Tous</option>
            <option value="5">Score ≥ 5/10</option>
            <option value="7">Score ≥ 7/10</option>
            <option value="8">Score ≥ 8/10</option>
          </Select>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFavoritesOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                favoritesOnly
                  ? 'border-amber-400/40 bg-amber-500/15 text-amber-200'
                  : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
              }`}
            >
              <Star className={`h-3.5 w-3.5 ${favoritesOnly ? 'fill-amber-300' : ''}`} />
              Favoris uniquement
            </button>
            <span className="text-xs text-slate-400">
              {jobs.length} offre{jobs.length > 1 ? 's' : ''} affichée{jobs.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Trier par :</span>
            <Select
              className="w-auto py-1 text-xs"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="score">Pertinence (Score Gemini)</option>
              <option value="date">Date (Plus récentes)</option>
            </Select>
          </div>
        </div>
      </GlassCard>

      {/* Split List + Detail Inspector */}
      <div className="grid gap-5 lg:grid-cols-12 items-start">
        <div className="lg:col-span-5 space-y-2.5 max-h-[75vh] overflow-y-auto pr-1">
          {loading ? (
            <GlassCard className="text-center text-sm text-slate-400 py-10">
              Chargement des offres...
            </GlassCard>
          ) : jobs.length === 0 ? (
            <GlassCard className="text-center text-sm text-slate-400 py-10">
              Aucune offre ne correspond à vos filtres actuels.
            </GlassCard>
          ) : (
            jobs.map((job) => {
              const active = job.id === selected?.id;
              const pInfo = PLATFORM_DISPLAY[job.source];
              return (
                <div
                  key={job.id}
                  onClick={() => setSelectedId(job.id)}
                  className={`rounded-2xl border p-4 cursor-pointer transition-all ${
                    active
                      ? 'border-indigo-400/50 bg-indigo-500/[0.12] shadow-lg shadow-indigo-950/40'
                      : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.055]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${pInfo?.colorClass || ''}`}
                        >
                          {pInfo?.short || job.source}
                        </span>
                        {job.contractType && <Badge>{job.contractType}</Badge>}
                        {job.provenance && job.provenance.length > 1 && (
                          <Badge variant="violet">
                            <Layers className="h-3 w-3" />
                            {job.provenance.length} sources
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-white leading-snug">
                        {job.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        {job.company || 'Entreprise non précisée'} ·{' '}
                        {job.location || 'Localisation non précisée'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <ScoreBadge score={job.analysis?.fitScore} />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(job);
                        }}
                        className="p-1 text-slate-400 hover:text-amber-300 cursor-pointer"
                        aria-label="Basculer favori"
                      >
                        <Star
                          className={`h-4 w-4 ${job.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detail View */}
        <div className="lg:col-span-7">
          {!selected ? (
            <GlassCard className="py-16 text-center text-sm text-slate-400">
              Sélectionnez une offre dans la liste pour consulter l’analyse Gemini et préparer votre
              candidature.
            </GlassCard>
          ) : (
            <GlassCard className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${PLATFORM_DISPLAY[selected.source]?.colorClass || ''}`}
                    >
                      {PLATFORM_DISPLAY[selected.source]?.label || selected.source}
                    </span>
                    {selected.contractType && <Badge>{selected.contractType}</Badge>}
                    <Badge variant="info">{selected.applicationStatus}</Badge>
                  </div>
                  <h2 className="text-xl font-bold text-white">{selected.title}</h2>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" />
                      {selected.company || 'Non précisée'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      {selected.location || 'Non précisée'}
                    </span>
                    {selected.salary && (
                      <span className="inline-flex items-center gap-1 text-emerald-300">
                        <Banknote className="h-3.5 w-3.5" />
                        {selected.salary}
                      </span>
                    )}
                    <span className="text-slate-400">
                      Publiée : {formatFrDateShort(selected.publishedAt)}
                    </span>
                  </div>
                </div>
                <ScoreBadge score={selected.analysis?.fitScore} />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  size="sm"
                  onClick={() => tailorApplication(selected.id)}
                  disabled={isDemo || busyAction === `tailor:${selected.id}`}
                >
                  <FileSignature className="h-3.5 w-3.5" />
                  {busyAction === `tailor:${selected.id}`
                    ? 'Génération IA en cours...'
                    : 'Générer candidature personnalisée'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => scoreJob(selected.id, Boolean(selected.analysis))}
                  disabled={isDemo || busyAction === `score:${selected.id}`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {busyAction === `score:${selected.id}`
                    ? 'Analyse Gemini...'
                    : selected.analysis
                      ? 'Réévaluer avec Gemini'
                      : 'Évaluer avec Gemini'}
                </Button>
                <a href={selected.originalUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" size="sm" type="button">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Offre originale
                  </Button>
                </a>
              </div>

              {/* Gemini Analysis Block */}
              {selected.analysis ? (
                <div className="rounded-xl border border-indigo-400/25 bg-indigo-500/[0.06] p-4 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Sparkles className="h-4 w-4 text-cyan-300" />
                      Analyse de compatibilité Gemini
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {selected.analysis.modelUsed}
                    </span>
                  </div>

                  <p className="text-sm text-slate-200 leading-relaxed">
                    {selected.analysis.reasoningSummary}
                  </p>

                  <div className="rounded-lg border border-white/[0.08] bg-slate-950/50 px-3 py-2 text-xs text-cyan-200">
                    <strong>Recommandation :</strong> {selected.analysis.recommendation}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold text-emerald-300 mb-1.5">
                        Compétences correspondantes ({selected.analysis.matchedSkills.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.analysis.matchedSkills.map((s) => (
                          <Badge key={s} variant="success">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-rose-300 mb-1.5">
                        Compétences manquantes ({selected.analysis.missingSkills.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.analysis.missingSkills.length > 0 ? (
                          selected.analysis.missingSkills.map((s) => (
                            <Badge key={s} variant="danger">
                              {s}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">Aucune lacune majeure</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-3 text-xs">
                    <div className="rounded-lg bg-white/[0.03] border border-white/[0.07] p-2.5">
                      <p className="font-semibold text-slate-300">Expérience</p>
                      <p className="mt-1 text-slate-400">{selected.analysis.experienceMatch}</p>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] border border-white/[0.07] p-2.5">
                      <p className="font-semibold text-slate-300">Formation</p>
                      <p className="mt-1 text-slate-400">{selected.analysis.educationMatch}</p>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] border border-white/[0.07] p-2.5">
                      <p className="font-semibold text-slate-300">Langues</p>
                      <p className="mt-1 text-slate-400">{selected.analysis.languageMatch}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 text-xs">
                    <div>
                      <p className="font-semibold text-slate-200 mb-1">Points forts</p>
                      <ul className="list-disc pl-4 space-y-1 text-slate-300">
                        {selected.analysis.strengths.map((st, i) => (
                          <li key={i}>{st}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-200 mb-1">Points d’attention</p>
                      <ul className="list-disc pl-4 space-y-1 text-slate-300">
                        {selected.analysis.weaknesses.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {selected.analysis.atsKeywords.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-300 mb-1.5">Mots-clés ATS</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.analysis.atsKeywords.map((kw) => (
                          <Badge key={kw} variant="violet">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-xs text-slate-400">
                  Cette offre n’a pas encore été évaluée par Gemini. Importez votre Master CV puis
                  cliquez sur « Évaluer avec Gemini ».
                </div>
              )}

              {/* Provenance */}
              {selected.provenance && selected.provenance.length > 0 && (
                <div className="text-xs text-slate-400">
                  <p className="font-semibold text-slate-300 mb-1">
                    Provenance &amp; déduplication ({selected.provenance.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selected.provenance.map((p, idx) => (
                      <a
                        key={idx}
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 hover:border-cyan-400/40 text-slate-300"
                      >
                        <span>{PLATFORM_DISPLAY[p.source]?.label || p.source}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Description */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-2">Description complète</h3>
                <div className="max-h-72 overflow-y-auto rounded-xl border border-white/[0.08] bg-slate-950/55 p-4 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
                  {selected.description || 'Description non fournie par la source.'}
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
