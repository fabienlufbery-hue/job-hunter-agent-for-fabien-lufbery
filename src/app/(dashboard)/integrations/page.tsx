'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Mail,
  ExternalLink,
  Unplug,
} from 'lucide-react';
import { Badge, Button, GlassCard, SectionHeader } from '@/components/ui/primitives';
import { formatFrDate } from '@/lib/utils';

interface IntegrationItem {
  id: string;
  name: string;
  category: string;
  status: string;
  statusLabel: string;
  mode: string;
  detail: string;
  lastActivityAt?: string | null;
}

interface IntegrationsResponse {
  isDemo: boolean;
  integrations: IntegrationItem[];
  metadata: {
    geminiModelActive: string;
    geminiModelAcademicOriginal: string;
    geminiDeprecationNote: string;
    franceTravailAppName: string;
  };
}

export default function IntegrationsPage() {
  const [data, setData] = useState<IntegrationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    return fetch('/api/integrations/status').then(async (res) => {
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur chargement intégrations');
      setData(json);
    }).catch((error) => {
      setMessage(error instanceof Error ? error.message : 'Erreur réseau');
    }).finally(() => {
      setLoading(false);
    });
  }

  useEffect(() => {
    void load();
  }, []);

  async function disconnectGmail() {
    setBusy('gmail-disconnect');
    const res = await fetch('/api/integrations/gmail/disconnect', { method: 'POST' });
    if (res.ok) {
      setMessage('Compte Gmail déconnecté et tokens chiffrés supprimés.');
      await load();
    }
    setBusy(null);
  }

  function statusBadgeVariant(status: string) {
    if (status === 'connected') return 'success' as const;
    if (status === 'configured_unverified' || status === 'needs_attention') return 'warning' as const;
    if (status === 'error') return 'danger' as const;
    return 'default' as const;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Integrations — État réel vérifié (9 services)"
        subtitle="Aucun statut « Connected » n’est affiché artificiellement : chaque état reflète la configuration et les vérifications réelles."
        action={
          <>
            <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Vérifier l’état
            </Button>
            <Link href="/settings">
              <Button size="sm">Tests de connexion (Settings)</Button>
            </Link>
          </>
        }
      />

      {message && (
        <GlassCard className="border-emerald-500/35 bg-emerald-500/10 text-xs text-emerald-100">
          {message}
        </GlassCard>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(data?.integrations || []).map((item) => {
          const isOk = item.status === 'connected';
          const isWarn =
            item.status === 'configured_unverified' || item.status === 'needs_attention';
          const Icon = isOk ? CheckCircle2 : isWarn ? AlertTriangle : XCircle;

          return (
            <GlassCard key={item.id} hover className="flex flex-col justify-between gap-4">
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isOk
                          ? 'text-emerald-400'
                          : isWarn
                            ? 'text-amber-400'
                            : 'text-slate-500'
                      }`}
                    />
                    <h2 className="text-sm font-semibold text-white">{item.name}</h2>
                  </div>
                  <Badge variant={statusBadgeVariant(item.status)}>{item.statusLabel}</Badge>
                </div>

                <p className="text-xs leading-relaxed text-slate-400">{item.detail}</p>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[11px] text-slate-400">
                <span>
                  {item.lastActivityAt
                    ? `Dernière activité : ${formatFrDate(item.lastActivityAt)}`
                    : `Mode : ${item.mode}`}
                </span>

                {item.id === 'gmail' && !data?.isDemo && (
                  item.status === 'connected' ? (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={disconnectGmail}
                      disabled={busy === 'gmail-disconnect'}
                    >
                      <Unplug className="h-3 w-3" />
                      Déconnecter
                    </Button>
                  ) : (
                    <a href="/api/integrations/gmail/connect">
                      <Button variant="secondary" size="sm" type="button">
                        <Mail className="h-3 w-3" />
                        Connecter Google
                      </Button>
                    </a>
                  )
                )}

                {item.id === 'welcome_to_the_jungle' && (
                  <Link href="/jobs" className="inline-flex items-center gap-1 text-cyan-300 hover:underline">
                    Importer une offre <ExternalLink className="h-3 w-3" />
                  </Link>
                )}

                {(item.id === 'france_travail' || item.id === 'gemini') && (
                  <Link
                    href="/settings"
                    className="inline-flex items-center gap-1 text-cyan-300 hover:underline"
                  >
                    Tester <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </GlassCard>
          );
        })}
      </div>

      {data?.metadata && (
        <GlassCard className="space-y-2 border-indigo-400/20">
          <h3 className="text-sm font-semibold text-white">
            Note technique — Modèle Google Gemini actif ({data.metadata.geminiModelActive})
          </h3>
          <p className="text-xs leading-relaxed text-slate-300">
            {data.metadata.geminiDeprecationNote}
          </p>
        </GlassCard>
      )}
    </div>
  );
}
