import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFrDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatFrDateShort(iso: string | null | undefined): string {
  if (!iso) return 'Non précisée';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatUsd(amount: number | null | undefined): string {
  const n = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  return `$${n.toFixed(3)}`;
}

export const PLATFORM_DISPLAY: Record<
  string,
  { label: string; short: string; colorClass: string }
> = {
  welcome_to_the_jungle: {
    label: 'Welcome to the Jungle',
    short: 'WTTJ',
    colorClass: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
  },
  indeed: {
    label: 'Indeed',
    short: 'Indeed',
    colorClass: 'bg-blue-400/15 text-blue-300 border-blue-400/30',
  },
  hellowork: {
    label: 'HelloWork',
    short: 'HelloWork',
    colorClass: 'bg-rose-400/15 text-rose-300 border-rose-400/30',
  },
  meteojob: {
    label: 'Meteojob',
    short: 'Meteojob',
    colorClass: 'bg-violet-400/15 text-violet-300 border-violet-400/30',
  },
  linkedin: {
    label: 'LinkedIn',
    short: 'LinkedIn',
    colorClass: 'bg-sky-400/15 text-sky-300 border-sky-400/30',
  },
  other: {
    label: 'Autre source Apify',
    short: 'Autre',
    colorClass: 'bg-teal-400/15 text-teal-300 border-teal-400/30',
  },
  france_travail: {
    label: 'Archive (France Travail)',
    short: 'Archive',
    colorClass: 'bg-slate-400/15 text-slate-300 border-slate-400/30',
  },
};

export const APPLICATION_TRACKING_LABELS: Record<
  string,
  { label: string; variant: 'default' | 'info' | 'violet' | 'success' | 'warning' | 'danger' }
> = {
  draft: { label: 'Brouillon', variant: 'default' },
  ready: { label: 'Prête à envoyer', variant: 'violet' },
  applied: { label: 'Candidature envoyée', variant: 'info' },
  sent: { label: 'Candidature envoyée', variant: 'info' },
  interview: { label: 'Entretien', variant: 'warning' },
  offer: { label: 'Offre reçue', variant: 'success' },
  rejected: { label: 'Refusée', variant: 'danger' },
};
