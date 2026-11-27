'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Send,
  Clock,
  Plug,
  Settings,
  LogOut,
  ShieldCheck,
  Sparkles,
  Menu,
  X,
  FlaskConical,
} from 'lucide-react';
import type { SessionPayload } from '@/lib/auth';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/jobs', label: 'Job Matches', icon: Briefcase },
  { href: '/cv', label: 'My CV', icon: FileText },
  { href: '/applications', label: 'Applications', icon: Send },
  { href: '/automation', label: 'Automation', icon: Clock },
  { href: '/integrations', label: 'Integrations', icon: Plug },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function DashboardShell({
  session,
  children,
}: {
  session: SessionPayload;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isDemo = session.role === 'demo';

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-white/[0.08] px-5 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 font-bold text-slate-950 shadow-lg shadow-indigo-500/30">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight text-white">
            Job Hunter Agent
          </p>
          <p className="truncate text-xs font-medium text-cyan-300/90">
            for Fabien Lufbery
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-gradient-to-r from-indigo-500/20 via-indigo-500/10 to-cyan-500/10 text-white border border-indigo-400/30 shadow-sm'
                  : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100 border border-transparent'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 transition-colors',
                  active ? 'text-cyan-300' : 'text-slate-500 group-hover:text-slate-200'
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.08] p-4 space-y-3">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="truncate">{session.name}</span>
          </div>
          <p className="mt-1 truncate text-[11px] text-slate-400">{session.email}</p>
          <p className="mt-2 text-[10.5px] leading-relaxed text-slate-500">
            Confidentialité : seules les données nécessaires à l’analyse sont transmises à l’API Google Gemini côté serveur.
          </p>
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.09] hover:text-white transition-colors cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>{isDemo ? 'Quitter le Mode Démo' : 'Déconnexion'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-68 lg:flex-col lg:fixed lg:inset-y-0 border-r border-white/[0.08] bg-slate-950/65 backdrop-blur-2xl z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-72 border-r border-white/10 bg-[#070b16]/95 backdrop-blur-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Fermer le menu"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col lg:pl-68 min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#050811]/75 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setMobileOpen(true)}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-300 hover:bg-white/10 lg:hidden"
                aria-label="Ouvrir la navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  Job Hunter Agent for Fabien Lufbery
                </p>
                <p className="hidden sm:block text-xs text-slate-400">
                  Apify API v2 · Google Gemini AI · PostgreSQL / Neon
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {isDemo ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">
                  <FlaskConical className="h-3.5 w-3.5" />
                  Mode Démo (Fictif)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Session Privée
                </span>
              )}
            </div>
          </div>

          {isDemo && (
            <div className="border-t border-amber-400/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-100 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong>MODE DÉMONSTRATION PUBLIC — DONNÉES FICTIVES :</strong> Vous consultez un
                profil bac à sable (Alex Martin). Les données privées, le CV personnel et les tokens
                de Fabien Lufbery restent strictement protégés.
              </span>
              <Link
                href="/login"
                className="underline font-semibold text-amber-200 hover:text-white"
              >
                Connexion propriétaire
              </Link>
            </div>
          )}
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
