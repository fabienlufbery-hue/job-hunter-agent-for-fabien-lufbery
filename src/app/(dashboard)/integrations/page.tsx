'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, GlassCard, SectionHeader } from '@/components/ui/primitives';

interface Item { id: string; name: string; status: string; statusLabel: string; detail: string; }
export default function IntegrationsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState('');
  function load() {
    fetch('/api/integrations/status').then(async res => {
      if (!res.ok) throw new Error('Erreur chargement intégrations');
      setItems((await res.json()).integrations);
      setError('');
    }).catch(() => setError('Impossible de charger les intégrations.'));
  }
  useEffect(() => { load(); }, []);
  return <div className="space-y-6">
    <SectionHeader title="Integrations — Gemini & Apify" subtitle="Deux API externes ; PostgreSQL reste le stockage." action={<Button onClick={load}>Actualiser</Button>} />
    {error && <p className="text-rose-300">{error}</p>}
    <div className="grid gap-4 md:grid-cols-3">
      {items.map(item => <GlassCard key={item.id} className="space-y-3">
        <h2 className="font-semibold">{item.name}</h2>
        <Badge variant={item.status === 'connected' ? 'success' : item.status === 'error' ? 'danger' : 'warning'}>{item.statusLabel}</Badge>
        <p className="text-xs text-slate-300">{item.detail}</p>
        {item.id !== 'database' && <Link href="/settings" className="text-cyan-300 text-xs">Tester la connexion</Link>}
      </GlassCard>)}
    </div>
  </div>;
}
