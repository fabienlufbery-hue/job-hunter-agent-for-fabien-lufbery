'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  Building2,
  ShieldCheck,
  Globe,
  Terminal,
} from 'lucide-react';
import { Badge, Button, GlassCard, SectionHeader } from '@/components/ui/primitives';

interface TestResult {
  configured?: boolean;
  connected?: boolean;
  latencyMs?: number;
  error?: string;
  model?: string;
  appName?: string;
  tokenExpiresIn?: number;
  totalAvailableOffers?: number;
}

export default function SettingsPage() {
  const [meta, setMeta] = useState<{
    isDemo: boolean;
    geminiModelActive: string;
    geminiDeprecationNote: string;
    scoringRubric: { scale: string; weights: Record<string, string> };
  } | null>(null);

  const [ftTesting, setFtTesting] = useState(false);
  const [ftResult, setFtResult] = useState<TestResult | null>(null);

  const [geminiTesting, setGeminiTesting] = useState(false);
  const [geminiResult, setGeminiResult] = useState<TestResult | null>(null);

  useEffect(() => {
    fetch('/api/integrations/status')
      .then((r) => r.json())
      .then((d) =>
        setMeta({
          isDemo: Boolean(d.isDemo),
          ...(d.metadata || {}),
        })
      )
      .catch(() => {});
  }, []);

  async function testApify() {
    setFtTesting(true);
    setFtResult(null);
    try {
      const res = await fetch('/api/integrations/apify/test', { method: 'POST' });
      const data = await res.json();
      setFtResult(data);
    } catch {
      setFtResult({ connected: false, error: 'Erreur réseau lors du test Apify.' });
    } finally {
      setFtTesting(false);
    }
  }

  async function testGemini() {
    setGeminiTesting(true);
    setGeminiResult(null);
    try {
      const res = await fetch('/api/integrations/gemini/test', { method: 'POST' });
      const data = await res.json();
      setGeminiResult(data);
    } catch {
      setGeminiResult({ connected: false, error: 'Erreur réseau lors du test Gemini.' });
    } finally {
      setGeminiTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Settings — Configuration & Tests réels"
        subtitle="Testez les connexions réelles aux API Apify et Google Gemini, et consultez la politique de sécurité."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Apify Connection Test */}
        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-cyan-300" />
              <h2 className="text-base font-semibold text-white">Apify API</h2>
            </div>
            <Badge variant="info">API Token</Badge>
          </div>

          <p className="text-xs text-slate-300">Configurez APIFY_API_TOKEN et APIFY_TASK_ID dans Vercel. La tâche doit avoir un dataset réussi et autorisé.</p>
          <Button
            onClick={testApify}
            disabled={ftTesting || Boolean(meta?.isDemo)}
            className="w-full"
          >
            {ftTesting ? 'Test Apify en cours...' : 'Tester la connexion Apify'}
          </Button>

          {ftResult && (
            <div
              className={`rounded-xl border p-3.5 text-xs space-y-1 ${
                ftResult.connected
                  ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-100'
                  : 'border-rose-500/35 bg-rose-500/15 text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {ftResult.connected ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span>
                  {ftResult.connected
                    ? 'Connexion Apify vérifiée avec succès'
                    : 'Échec de connexion Apify'}
                </span>
              </div>
              {ftResult.connected ? (
                <>
                  <p>Latence : {ftResult.latencyMs} ms</p>
                </>
              ) : (
                <p>{ftResult.error}</p>
              )}
            </div>
          )}
        </GlassCard>

        {/* Gemini Connection Test */}
        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-300" />
              <h2 className="text-base font-semibold text-white">Google Gemini API (@google/genai)</h2>
            </div>
            <Badge variant="violet">{meta?.geminiModelActive || 'gemini-3.5-flash-lite'}</Badge>
          </div>

          <p className="text-xs leading-relaxed text-slate-300">
            {meta?.geminiDeprecationNote ||
              'Modèle configurable via GEMINI_MODEL côté serveur.'}
          </p>

          <Button
            variant="secondary"
            onClick={testGemini}
            disabled={geminiTesting || Boolean(meta?.isDemo)}
            className="w-full"
          >
            {geminiTesting ? 'Test Gemini en cours...' : 'Tester la connexion Google Gemini'}
          </Button>

          {geminiResult && (
            <div
              className={`rounded-xl border p-3.5 text-xs space-y-1 ${
                geminiResult.connected
                  ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-100'
                  : 'border-rose-500/35 bg-rose-500/15 text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {geminiResult.connected ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span>
                  {geminiResult.connected
                    ? `Gemini opérationnel (${geminiResult.model})`
                    : 'Échec de connexion Gemini'}
                </span>
              </div>
              {geminiResult.connected ? (
                <p>Latence : {geminiResult.latencyMs} ms</p>
              ) : (
                <p>{geminiResult.error}</p>
              )}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Scoring Rubric + Chrome Extension Config + Security */}
      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard className="space-y-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-cyan-300" />
            <h2 className="text-base font-semibold text-white">
              Grille de notation Gemini (reproductible 1 à 10)
            </h2>
          </div>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {meta?.scoringRubric?.weights &&
              Object.values(meta.scoringRubric.weights).map((w, i) => (
                <li key={i} className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2">
                  {w}
                </li>
              ))}
          </ul>
        </GlassCard>

        <GlassCard className="space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-indigo-300" />
            <h2 className="text-base font-semibold text-white">
              Sécurité / Confidentialité
            </h2>
          </div>
          <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 flex items-start gap-2 text-emerald-100">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Aucune clé API n’est exposée au navigateur. Les descriptions d’offres et CV sont isolés comme données non fiables
                contre les injections de prompts, et transmis à Google Gemini uniquement pour
                l’analyse demandée.
              </span>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
