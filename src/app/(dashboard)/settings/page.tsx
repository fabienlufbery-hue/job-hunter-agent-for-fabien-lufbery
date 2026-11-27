'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  Cloud,
  ShieldCheck,
  Terminal,
  Plus,
  Trash2,
  Sliders,
  Save,
  Search,
} from 'lucide-react';
import {
  Badge,
  Button,
  GlassCard,
  Input,
  SectionHeader,
  Select,
  Textarea,
} from '@/components/ui/primitives';
import { formatUsd, PLATFORM_DISPLAY } from '@/lib/utils';

interface ApifySourceItem {
  id: string;
  name: string;
  kind: 'task' | 'actor';
  apifyId: string;
  platform: string;
  executionMode: 'run_and_fetch' | 'fetch_last_dataset';
  enabled: boolean;
  maxItems: number;
  maxCostUsd: number;
  timeoutSecs: number;
  memoryMbytes: number;
  lastStatus: string | null;
}

interface CatalogActor {
  apifyId: string;
  name: string;
  platform: string;
  description: string;
  notes: string;
}

interface DiscoveredTask {
  id: string;
  name: string;
  title: string | null;
  actId: string;
}

interface SettingsState {
  monthlyApifyBudgetUsd: number;
  maxCostPerRunUsd: number;
  maxItemsPerSource: number;
  runTimeoutSecs: number;
  maxGeminiScoresPerRun: number;
  autoScoreOnSync: boolean;
  minCooldownMinutes: number;
}

interface TestResult {
  configured?: boolean;
  connected?: boolean;
  latencyMs?: number;
  error?: string;
  model?: string;
  account?: { username: string; planId: string | null; monthlyUsageCreditsUsd: number | null };
  tasksCount?: number;
  tasks?: DiscoveredTask[];
}

export default function SettingsPage() {
  const [isDemo, setIsDemo] = useState(false);
  const [meta, setMeta] = useState<{
    geminiModelActive: string;
    geminiModelInfoNote: string;
    scoringRubric: { scale: string; weights: Record<string, string> };
  } | null>(null);

  const [sources, setSources] = useState<ApifySourceItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogActor[]>([]);
  const [discoveredTasks, setDiscoveredTasks] = useState<DiscoveredTask[]>([]);
  const [monthlySpendUsd, setMonthlySpendUsd] = useState(0);
  const [settings, setSettings] = useState<SettingsState>({
    monthlyApifyBudgetUsd: 5.0,
    maxCostPerRunUsd: 0.75,
    maxItemsPerSource: 30,
    runTimeoutSecs: 120,
    maxGeminiScoresPerRun: 15,
    autoScoreOnSync: true,
    minCooldownMinutes: 5,
  });

  // New source form
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<'task' | 'actor'>('task');
  const [newApifyId, setNewApifyId] = useState('');
  const [newPlatform, setNewPlatform] = useState('indeed');
  const [newMode, setNewMode] = useState<'run_and_fetch' | 'fetch_last_dataset'>('run_and_fetch');
  const [newMaxItems, setNewMaxItems] = useState(30);
  const [newMaxCost, setNewMaxCost] = useState(0.5);
  const [newTemplateJson, setNewTemplateJson] = useState('');

  // Connection tests & status
  const [apifyTesting, setApifyTesting] = useState(false);
  const [apifyResult, setApifyResult] = useState<TestResult | null>(null);
  const [geminiTesting, setGeminiTesting] = useState(false);
  const [geminiResult, setGeminiResult] = useState<TestResult | null>(null);
  const [savingLimits, setSavingLimits] = useState(false);
  const [creatingSource, setCreatingSource] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function loadAll() {
    return Promise.all([
      fetch('/api/integrations/status').then((r) => r.json()),
      fetch('/api/apify/sources').then((r) => r.json()),
      fetch('/api/settings').then((r) => r.json()),
    ])
      .then(([intRes, srcRes, setRes]) => {
        setIsDemo(Boolean(intRes.isDemo));
        if (intRes.metadata) setMeta(intRes.metadata);
        if (srcRes.sources) setSources(srcRes.sources);
        if (srcRes.catalog) setCatalog(srcRes.catalog);
        if (setRes.settings) setSettings(setRes.settings);
        if (typeof setRes.monthlySpendUsd === 'number') {
          setMonthlySpendUsd(setRes.monthlySpendUsd);
        }
      })
      .catch(() => {});
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function testApify() {
    setApifyTesting(true);
    setApifyResult(null);
    try {
      const res = await fetch('/api/integrations/apify/test', { method: 'POST' });
      const data = await res.json();
      setApifyResult(data);
      if (Array.isArray(data.tasks)) {
        setDiscoveredTasks(data.tasks);
      }
    } catch {
      setApifyResult({ connected: false, error: 'Erreur réseau lors du test Apify.' });
    } finally {
      setApifyTesting(false);
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

  async function saveLimits(e: React.FormEvent) {
    e.preventDefault();
    setSavingLimits(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur sauvegarde limites');
      setFeedback({ kind: 'ok', text: 'Limites de consommation et garde-fous enregistrés.' });
    } catch (err) {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Erreur' });
    } finally {
      setSavingLimits(false);
    }
  }

  async function addSource(e: React.FormEvent) {
    e.preventDefault();
    setCreatingSource(true);
    setFeedback(null);
    try {
      let inputTemplate: Record<string, unknown> = {};
      if (newTemplateJson.trim()) {
        inputTemplate = JSON.parse(newTemplateJson);
      }
      const res = await fetch('/api/apify/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          kind: newKind,
          apifyId: newApifyId,
          platform: newPlatform,
          executionMode: newMode,
          maxItems: Number(newMaxItems) || 30,
          maxCostUsd: Number(newMaxCost) || 0.5,
          inputTemplate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur ajout source Apify');
      setNewName('');
      setNewApifyId('');
      setNewTemplateJson('');
      setFeedback({ kind: 'ok', text: `Source Apify « ${data.source.name} » ajoutée.` });
      await loadAll();
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'JSON template ou paramètres invalides',
      });
    } finally {
      setCreatingSource(false);
    }
  }

  async function quickAddTask(task: DiscoveredTask) {
    setFeedback(null);
    const res = await fetch('/api/apify/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: task.title || task.name,
        kind: 'task',
        apifyId: task.id,
        platform: 'other',
        executionMode: 'run_and_fetch',
        maxItems: settings.maxItemsPerSource,
        maxCostUsd: settings.maxCostPerRunUsd,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setFeedback({ kind: 'ok', text: `Tâche Apify « ${task.title || task.name} » ajoutée.` });
      await loadAll();
    } else {
      setFeedback({ kind: 'err', text: data.error || 'Erreur ajout tâche' });
    }
  }

  async function toggleSource(src: ApifySourceItem) {
    const res = await fetch(`/api/apify/sources/${src.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !src.enabled }),
    });
    if (res.ok) await loadAll();
  }

  async function deleteSource(id: string) {
    if (!confirm('Supprimer cette source Apify ?')) return;
    const res = await fetch(`/api/apify/sources/${id}`, { method: 'DELETE' });
    if (res.ok) await loadAll();
  }

  function applyCatalogPreset(actor: CatalogActor) {
    setNewName(actor.name);
    setNewKind('actor');
    setNewApifyId(actor.apifyId);
    setNewPlatform(actor.platform);
    setNewMode('run_and_fetch');
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Settings — Apify, Gemini, Limites & Sécurité"
        subtitle="Testez vos connexions réelles, sélectionnez vos Actors/Tasks Apify et contrôlez vos plafonds de consommation."
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

      {/* Row 1: Real Connection Tests */}
      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4 text-cyan-300" />
              <h2 className="text-base font-semibold text-white">Apify API v2</h2>
            </div>
            <Badge variant="info">APIFY_API_TOKEN (Serveur)</Badge>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Configurez <code className="font-mono">APIFY_API_TOKEN</code> dans les variables
            d’environnement Vercel (jamais dans le frontend). Le test vérifie votre compte réel et
            découvre automatiquement vos Tasks Apify existantes.
          </p>

          <Button onClick={testApify} disabled={apifyTesting || isDemo} className="w-full">
            <Search className="h-4 w-4" />
            {apifyTesting
              ? 'Vérification Apify & découverte des Tasks...'
              : 'Tester la connexion Apify & découvrir mes Tasks'}
          </Button>

          {apifyResult && (
            <div
              className={`rounded-xl border p-3.5 text-xs space-y-1.5 ${
                apifyResult.connected
                  ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-100'
                  : 'border-rose-500/35 bg-rose-500/15 text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {apifyResult.connected ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span>
                  {apifyResult.connected
                    ? `Connecté à Apify (${apifyResult.account?.username || 'OK'})`
                    : 'Échec de connexion Apify'}
                </span>
              </div>
              {apifyResult.connected ? (
                <p>
                  Latence : {apifyResult.latencyMs} ms · Plan :{' '}
                  {apifyResult.account?.planId || 'Standard'} · {apifyResult.tasksCount ?? 0} Task(s)
                  trouvée(s).
                </p>
              ) : (
                <p>{apifyResult.error}</p>
              )}
            </div>
          )}

          {discoveredTasks.length > 0 && !isDemo && (
            <div className="space-y-2 border-t border-white/[0.08] pt-3">
              <p className="text-xs font-semibold text-cyan-200">
                Tasks détectées sur votre compte Apify :
              </p>
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {discoveredTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{t.title || t.name}</p>
                      <p className="font-mono text-[10.5px] text-slate-400 truncate">{t.id}</p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={() => void quickAddTask(t)}
                    >
                      <Plus className="h-3 w-3" /> Ajouter
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>

        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-300" />
              <h2 className="text-base font-semibold text-white">
                Google Gemini API (@google/genai)
              </h2>
            </div>
            <Badge variant="violet">{meta?.geminiModelActive || 'gemini-3.5-flash-lite'}</Badge>
          </div>

          <p className="text-xs leading-relaxed text-slate-300">
            {meta?.geminiModelInfoNote || 'Modèle configurable via GEMINI_MODEL côté serveur.'}
          </p>

          <Button
            variant="secondary"
            onClick={testGemini}
            disabled={geminiTesting || isDemo}
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

      {/* Row 2: Apify Actors & Tasks Configuration + Budget & Consumption Limits */}
      <div className="grid gap-5 lg:grid-cols-12 items-start">
        <GlassCard className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">
                Sources Apify configurées (Actors &amp; Tasks)
              </h2>
              <p className="text-xs text-slate-400">
                Sélectionnez vos Tasks Apify ou choisissez un Actor vérifié du Store Apify.
              </p>
            </div>
            <Badge variant="info">{sources.length} source(s)</Badge>
          </div>

          {/* Configured Sources List */}
          {sources.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-5 text-xs text-slate-400">
              Aucune source Apify configurée. Ajoutez une Task de votre compte ou sélectionnez un
              Actor ci-dessous.
            </div>
          ) : (
            <div className="space-y-2.5">
              {sources.map((src) => (
                <div
                  key={src.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5 text-xs"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={src.enabled ? 'success' : 'default'}>
                        {src.enabled ? 'Active' : 'En pause'}
                      </Badge>
                      <Badge variant="violet">{src.kind.toUpperCase()}</Badge>
                      <Badge>
                        {PLATFORM_DISPLAY[src.platform]?.short || src.platform}
                      </Badge>
                      <Badge variant="info">
                        {src.executionMode === 'run_and_fetch'
                          ? 'Lancer & Importer'
                          : 'Dernier dataset'}
                      </Badge>
                    </div>
                    <p className="font-semibold text-white">{src.name}</p>
                    <p className="font-mono text-[11px] text-slate-400">
                      {src.apifyId} · max {src.maxItems} offres · plafond ${src.maxCostUsd.toFixed(2)}
                    </p>
                  </div>

                  {!isDemo && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        onClick={() => void toggleSource(src)}
                      >
                        {src.enabled ? 'Désactiver' : 'Activer'}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        type="button"
                        onClick={() => void deleteSource(src.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Verified Apify Store Quick Presets */}
          {!isDemo && catalog.length > 0 && (
            <div className="space-y-2 border-t border-white/[0.08] pt-4">
              <p className="text-xs font-semibold text-slate-200">
                Pré-remplir depuis le catalogue vérifié Apify Store :
              </p>
              <div className="flex flex-wrap gap-1.5">
                {catalog.map((actor) => (
                  <button
                    key={actor.apifyId}
                    type="button"
                    onClick={() => applyCatalogPreset(actor)}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-slate-200 hover:border-cyan-400/40 hover:bg-white/[0.08] cursor-pointer transition-colors"
                  >
                    + {actor.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add Actor/Task Form */}
          {!isDemo && (
            <form onSubmit={addSource} className="space-y-3 border-t border-white/[0.08] pt-4">
              <p className="text-xs font-semibold text-cyan-300">Ajouter un Actor ou une Task</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  required
                  placeholder="Nom affiché (ex: Indeed Paris TypeScript)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <Input
                  required
                  placeholder="ID Apify (ex: curious_coder/indeed-scraper ou Task ID)"
                  value={newApifyId}
                  onChange={(e) => setNewApifyId(e.target.value)}
                />
                <Select
                  value={newKind}
                  onChange={(e) => setNewKind(e.target.value as 'task' | 'actor')}
                >
                  <option value="task">Apify Saved Task</option>
                  <option value="actor">Apify Store Actor</option>
                </Select>
                <Select value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)}>
                  <option value="welcome_to_the_jungle">Welcome to the Jungle</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="indeed">Indeed</option>
                  <option value="hellowork">HelloWork</option>
                  <option value="meteojob">Meteojob</option>
                  <option value="other">Autre plateforme</option>
                </Select>
                <Select
                  value={newMode}
                  onChange={(e) =>
                    setNewMode(e.target.value as 'run_and_fetch' | 'fetch_last_dataset')
                  }
                >
                  <option value="run_and_fetch">Lancer avec mes préférences &amp; importer</option>
                  <option value="fetch_last_dataset">Lire uniquement le dernier dataset réussi</option>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={newMaxItems}
                    onChange={(e) => setNewMaxItems(Number(e.target.value))}
                    placeholder="Max offres"
                  />
                  <Input
                    type="number"
                    step="0.05"
                    min={0.05}
                    max={20}
                    value={newMaxCost}
                    onChange={(e) => setNewMaxCost(Number(e.target.value))}
                    placeholder="Max $"
                  />
                </div>
              </div>
              <Textarea
                rows={2}
                placeholder='Template JSON optionnel (variables {{query}}, {{location}}, {{contract}}, {{maxItems}})'
                value={newTemplateJson}
                onChange={(e) => setNewTemplateJson(e.target.value)}
                className="font-mono text-xs"
              />
              <Button type="submit" size="sm" disabled={creatingSource}>
                <Plus className="h-4 w-4" />
                {creatingSource ? 'Ajout...' : 'Ajouter cette source Apify'}
              </Button>
            </form>
          )}
        </GlassCard>

        {/* Consumption Limits & Security */}
        <GlassCard className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-indigo-300" />
              <h2 className="text-base font-semibold text-white">Limites de consommation</h2>
            </div>
            <Badge variant="warning">Mois : {formatUsd(monthlySpendUsd)}</Badge>
          </div>

          <form onSubmit={saveLimits} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Budget mensuel Apify ($)</label>
                <Input
                  type="number"
                  step="0.5"
                  min={0.1}
                  max={200}
                  disabled={isDemo}
                  value={settings.monthlyApifyBudgetUsd}
                  onChange={(e) =>
                    setSettings({ ...settings, monthlyApifyBudgetUsd: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Plafond par run ($)</label>
                <Input
                  type="number"
                  step="0.05"
                  min={0.05}
                  max={20}
                  disabled={isDemo}
                  value={settings.maxCostPerRunUsd}
                  onChange={(e) =>
                    setSettings({ ...settings, maxCostPerRunUsd: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Max offres / source</label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  disabled={isDemo}
                  value={settings.maxItemsPerSource}
                  onChange={(e) =>
                    setSettings({ ...settings, maxItemsPerSource: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Timeout Apify (sec)</label>
                <Input
                  type="number"
                  min={30}
                  max={600}
                  disabled={isDemo}
                  value={settings.runTimeoutSecs}
                  onChange={(e) =>
                    setSettings({ ...settings, runTimeoutSecs: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Max analyses Gemini / run</label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  disabled={isDemo}
                  value={settings.maxGeminiScoresPerRun}
                  onChange={(e) =>
                    setSettings({ ...settings, maxGeminiScoresPerRun: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Délai anti-doublon (min)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={120}
                  disabled={isDemo}
                  value={settings.minCooldownMinutes}
                  onChange={(e) =>
                    setSettings({ ...settings, minCooldownMinutes: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                disabled={isDemo}
                checked={settings.autoScoreOnSync}
                onChange={(e) => setSettings({ ...settings, autoScoreOnSync: e.target.checked })}
                className="rounded border-white/20 bg-slate-900"
              />
              Analyser automatiquement les nouvelles offres avec Gemini après chaque collecte
            </label>

            {!isDemo && (
              <Button type="submit" className="w-full" disabled={savingLimits}>
                <Save className="h-4 w-4" />
                {savingLimits ? 'Enregistrement...' : 'Enregistrer les limites'}
              </Button>
            )}
          </form>

          <div className="border-t border-white/[0.08] pt-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Terminal className="h-3.5 w-3.5 text-cyan-300" />
              Grille de scoring Gemini (1 à 10)
            </div>
            <ul className="space-y-1 text-[11.5px] text-slate-300">
              {meta?.scoringRubric?.weights &&
                Object.values(meta.scoringRubric.weights).map((w, i) => (
                  <li key={i} className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-2.5 py-1.5">
                    {w}
                  </li>
                ))}
            </ul>
          </div>

          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 flex items-start gap-2 text-[11.5px] text-emerald-100">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              <strong>Sécurité :</strong> clés Apify &amp; Gemini strictement serveur, aucune donnée
              personnelle (CV/nom/email) transmise à Apify, protection anti-injection de prompts,
              mode démo isolé et zéro envoi automatique de candidature.
            </span>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
