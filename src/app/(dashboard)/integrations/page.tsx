'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Sparkles,
  Database,
  Cloud,
  ArrowRight,
} from 'lucide-react';
import { Badge, Button, GlassCard, SectionHeader } from '@/components/ui/primitives';
import { formatFrDate } from '@/lib/utils';

interface IntegrationItem {
  id: 'gemini' | 'apify' | 'database';
  name: string;
  category: string;
  status: string;
  statusLabel: string;
  mode: string;
  detail: string;
  lastVerifiedAt?: string | null;
}

export default function IntegrationsPage() {
  const [items, setItems] = useState<IntegrationItem[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function load() {
    return fetch('/api/integrations/status')
      .then(async (res) => {
        if (!res.ok) throw new Error('Erreur chargement intégrations');
        const json = await res.json();
        setItems(json.integrations || []);
        setIsDemo(Boolean(json.isDemo));
      })
      .catch(() =>
        setNotice({ kind: 'err', text: 'Impossible de charger le statut des intégrations.' })
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    void load();
  }, []);

  async function runLiveTest(id: 'gemini' | 'apify') {
    setTestingId(id);
    setNotice(null);
    try {
      const endpoint =
        id === 'apify' ? '/api/integrations/apify/test' : '/api/integrations/gemini/test';
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.connected) {
        throw new Error(data.error || `Échec vérification ${id}`);
      }
      setNotice({
        kind: 'ok',
        text:
          id === 'apify'
            ? `Apify vérifié (${data.account?.username || 'OK'}, ${data.tasksCount ?? 0} tâche(s) détectée(s), ${data.latencyMs} ms).`
            : `Google Gemini vérifié (${data.model}, ${data.latencyMs} ms).`,
      });
      await load();
    } catch (err) {
      setNotice({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Erreur de vérification',
      });
      await load();
    } finally {
      setTestingId(null);
    }
  }

  const icons = {
    gemini: Sparkles,
    apify: Cloud,
    database: Database,
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Integrations — Google Gemini, Apify & PostgreSQL/Neon"
        subtitle="Architecture épurée à 2 API externes métier (Gemini + Apify) et 1 base persistante (PostgreSQL/Neon). Aucun statut connecté n’est jamais simulé."
        action={
          <>
            <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <Link href="/settings">
              <Button size="sm">
                Configurer dans Settings <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </>
        }
      />

      {notice && (
        <div
          className={`rounded-xl border p-3.5 text-xs ${
            notice.kind === 'ok'
              ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-100'
              : 'border-rose-500/35 bg-rose-500/15 text-rose-200'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        {items.map((item) => {
          const ServiceIcon = icons[item.id] || Cloud;
          const isOk = item.status === 'connected';
          const isWarn = item.status === 'configured_unverified';
          const StatusIcon = isOk ? CheckCircle2 : isWarn ? AlertTriangle : XCircle;

          return (
            <GlassCard key={item.id} hover className="flex flex-col justify-between gap-5">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-xl bg-white/[0.06] p-2.5 border border-white/10 text-cyan-300">
                      <ServiceIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-white">{item.name}</h2>
                      <p className="text-[11px] text-slate-400">
                        {item.id === 'gemini'
                          ? 'Intelligence artificielle'
                          : item.id === 'apify'
                            ? 'Recherche & collecte d’offres'
                            : 'Infrastructure de stockage'}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <Badge
                    variant={
                      isOk ? 'success' : isWarn ? 'warning' : item.status === 'error' ? 'danger' : 'default'
                    }
                  >
                    <StatusIcon className="h-3 w-3" />
                    {item.statusLabel}
                  </Badge>
                </div>

                <p className="text-xs leading-relaxed text-slate-300">{item.detail}</p>
              </div>

              <div className="space-y-2.5 border-t border-white/[0.08] pt-3">
                {item.lastVerifiedAt && (
                  <p className="text-[11px] text-slate-400">
                    Dernière vérification réelle : {formatFrDate(item.lastVerifiedAt)}
                  </p>
                )}

                {item.id !== 'database' ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      disabled={isDemo || testingId !== null}
                      onClick={() => void runLiveTest(item.id as 'gemini' | 'apify')}
                    >
                      {testingId === item.id ? 'Vérification...' : 'Tester maintenant'}
                    </Button>
                    <Link href="/settings">
                      <Button variant="ghost" size="sm" type="button">
                        Réglages
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <p className="text-[11px] text-emerald-300/90">
                    Vérifié en direct par requête SQL (<code className="font-mono">SELECT 1</code>).
                  </p>
                )}
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
