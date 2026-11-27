import React from 'react';
import { cn } from '@/lib/utils';

export function GlassCard({
  className,
  hover = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={cn(
        'glass-panel rounded-2xl p-5',
        hover && 'glass-panel-hover',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Badge({
  className,
  variant = 'default',
  children,
}: {
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'violet';
  children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    default: 'bg-white/[0.06] text-slate-300 border-white/[0.12]',
    success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    danger: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    info: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    violet: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-tight',
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return (
      <span className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-slate-400">
        Non noté
      </span>
    );
  }

  const color =
    score >= 8
      ? 'from-emerald-500/25 to-cyan-500/20 border-emerald-400/40 text-emerald-200'
      : score >= 6
        ? 'from-indigo-500/25 to-sky-500/20 border-indigo-400/40 text-indigo-200'
        : 'from-amber-500/25 to-rose-500/20 border-amber-400/40 text-amber-200';

  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-0.5 rounded-xl border bg-gradient-to-br px-3 py-1 font-mono text-sm font-bold shadow-sm',
        color
      )}
    >
      <span>{score}</span>
      <span className="text-[11px] font-normal opacity-75">/10</span>
    </span>
  );
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'emerald';
  size?: 'sm' | 'md' | 'lg';
}) {
  const variants: Record<string, string> = {
    primary:
      'bg-gradient-to-r from-indigo-500 via-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/25 hover:brightness-110 border border-indigo-400/30',
    secondary:
      'bg-white/[0.06] text-slate-100 border border-white/[0.12] hover:bg-white/[0.11] hover:border-white/[0.2]',
    ghost: 'bg-transparent text-slate-300 hover:bg-white/[0.06] hover:text-white border border-transparent',
    danger:
      'bg-rose-500/15 text-rose-200 border border-rose-500/35 hover:bg-rose-500/25',
    emerald:
      'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20 hover:brightness-110 border border-emerald-300/30',
  };

  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-4 py-2 text-sm rounded-xl',
    lg: 'px-5 py-2.5 text-sm rounded-xl',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-xl border border-white/[0.11] bg-slate-950/60 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors',
        className
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-xl border border-white/[0.11] bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors',
        className
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full rounded-xl border border-white/[0.11] bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors',
        className
      )}
      {...props}
    />
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
