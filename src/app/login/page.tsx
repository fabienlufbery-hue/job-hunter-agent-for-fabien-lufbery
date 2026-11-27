'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Lock, FlaskConical, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';
import { Button, GlassCard, Input } from '@/components/ui/primitives';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{
    ownerAuthConfigured: boolean;
    isLocalDev: boolean;
  } | null>(null);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((d) => setSessionInfo(d))
      .catch(() => {});
  }, []);

  async function handleOwnerLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Échec de connexion.');
        setLoading(false);
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('Erreur réseau lors de la connexion.');
      setLoading(false);
    }
  }

  async function handleEnterDemo() {
    setError(null);
    setDemoLoading(true);
    try {
      const res = await fetch('/api/auth/demo', { method: 'POST' });
      if (!res.ok) {
        setError('Impossible d’activer le Mode Démonstration.');
        setDemoLoading(false);
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('Erreur réseau.');
      setDemoLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl grid gap-6 lg:grid-cols-2 items-stretch">
        {/* Brand & Architecture Pitch Card */}
        <GlassCard className="flex flex-col justify-between p-7 lg:p-8 border-indigo-400/20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-200">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              Apify · Google Gemini · PostgreSQL/Neon
            </div>

            <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-white leading-tight">
              Job Hunter Agent
              <span className="block bg-gradient-to-r from-indigo-400 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                for Fabien Lufbery
              </span>
            </h1>

            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              Assistant autonome cloud combinant{' '}
              <strong className="text-white">Apify API v2</strong> (collecte automatisée
              multi-plateformes : Welcome to the Jungle, LinkedIn, Indeed, HelloWork, Meteojob),{' '}
              <strong className="text-white">Google Gemini</strong> (scoring sur 10, lettres de
              motivation et adaptation CV) et{' '}
              <strong className="text-white">PostgreSQL / Neon</strong> pour un fonctionnement
              24h/24 à 09h00 et 18h00 (Europe/Paris).
            </p>
          </div>

          <div className="mt-8 space-y-3">
            <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-200">
                <FlaskConical className="h-4 w-4 shrink-0" />
                Visite publique / Évaluation
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-amber-100/85">
                Consultez l’intégralité du tableau de bord avec des données 100 % fictives clairement
                identifiées, sans accéder au CV privé ni aux clés API de Fabien Lufbery.
              </p>
              <Button
                variant="secondary"
                className="mt-3 w-full border-amber-400/35 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
                onClick={handleEnterDemo}
                disabled={demoLoading}
              >
                <FlaskConical className="h-4 w-4" />
                <span>
                  {demoLoading
                    ? 'Ouverture du Mode Démo...'
                    : 'Explorer le Mode Démonstration (Données Fictives)'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-start gap-2.5 text-[11.5px] text-slate-400">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Protection stricte : cookies de session signés HttpOnly, clés API uniquement côté
                serveur, zéro donnée personnelle transmise à Apify, aucun envoi automatique.
              </span>
            </div>
          </div>
        </GlassCard>

        {/* Owner Login Form */}
        <GlassCard className="p-7 lg:p-8 flex flex-col justify-center">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] border border-white/10">
              <Lock className="h-4 w-4 text-cyan-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Accès personnel sécurisé</h2>
              <p className="text-xs text-slate-400">Réservé à Fabien Lufbery</p>
            </div>
          </div>

          <form onSubmit={handleOwnerLogin} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-300 mb-1.5">
                Adresse email
              </label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="fabien.lufbery@..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Mot de passe
              </label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-500/35 bg-rose-500/15 p-3 text-xs text-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Authentification...' : 'Se connecter au tableau de bord'}
            </Button>
          </form>

          {sessionInfo?.isLocalDev && !sessionInfo.ownerAuthConfigured && (
            <div className="mt-5 rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-3 text-xs text-cyan-100">
              <p className="font-semibold">Mode développement local détecté</p>
              <p className="mt-1 text-cyan-200/80">
                Configurez <code className="font-mono">ADMIN_EMAIL</code> et{' '}
                <code className="font-mono">ADMIN_PASSWORD</code> dans{' '}
                <code className="font-mono">.env.local</code>, ou utilisez :{' '}
                <code className="font-mono">fabien.lufbery@local.dev</code> /{' '}
                <code className="font-mono">local-dev-only</code>.
              </p>
            </div>
          )}

          <p className="mt-6 text-[11px] leading-relaxed text-slate-500">
            Confidentialité : seules vos préférences de recherche (sans nom ni CV) sont transmises à
            Apify ; le texte anonymisé du Master CV et les offres sélectionnées sont envoyés à
            Google Gemini (avec <code className="font-mono">store: false</code>) uniquement pour le
            scoring et la rédaction assistée.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
