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
  france_travail: {
    label: 'France Travail',
    short: 'France Travail',
    colorClass: 'bg-cyan-400/15 text-cyan-300 border-cyan-400/30',
  },
};
