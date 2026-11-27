'use client';

import React, { useEffect, useState } from 'react';
import {
  FileDown,
  Mail,
  Save,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  FileText,
  Copy,
  Check,
  ClipboardList,
} from 'lucide-react';
import {
  Badge,
  Button,
  GlassCard,
  Input,
  ScoreBadge,
  SectionHeader,
  Select,
  Textarea,
} from '@/components/ui/primitives';
import {
  APPLICATION_TRACKING_LABELS,
  formatFrDate,
  PLATFORM_DISPLAY,
} from '@/lib/utils';

interface ApplicationItem {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string | null;
  source: string;
  originalUrl: string;
  jobDescription: string;
  fitScore: number | null;
  status: string;
  coverLetter: string;
  presentationPage: string;
  cvSuggestions: Array<{
    section: string;
    currentText: string;
    suggestedImprovement: string;
    reason: string;
  }>;
  bulletRewrites: Array<{
    original: string;
    rewritten: string;
    impactNote: string;
  }>;
  atsKeywords: string[];
  emailSubject: string;
  emailBody: string;
  recipientEmail: string | null;
  notes: string | null;
  sentAt: string | null;
  updatedAt: string;
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState<ApplicationItem[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'letter' | 'presentation' | 'cv_tips' | 'message'>(
    'letter'
  );

  // Editable draft fields
  const [coverLetter, setCoverLetter] = useState('');
  const [presentationPage, setPresentationPage] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [status, setStatus] = useState('ready');
  const [notes, setNotes] = useState('');

  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function loadApps() {
    return fetch('/api/applications')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur chargement candidatures');
        setApps(data.applications || []);
        setIsDemo(Boolean(data.isDemo));
        const firstId = data.applications?.[0]?.id || null;
        setSelectedId((prev) =>
          prev && (data.applications || []).some((a: ApplicationItem) => a.id === prev)
            ? prev
            : firstId
        );
      })
      .catch((err) => {
        setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Erreur' });
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    void loadApps();
  }, []);

  const selected = apps.find((a) => a.id === selectedId) || null;

  const [draftSource, setDraftSource] = useState<ApplicationItem | null>(null);
  if (selected !== draftSource) {
    setDraftSource(selected);
    setCoverLetter(selected?.coverLetter ?? '');
    setPresentationPage(selected?.presentationPage ?? '');
    setEmailSubject(selected?.emailSubject ?? '');
    setEmailBody(selected?.emailBody ?? '');
    setRecipientEmail(selected?.recipientEmail ?? '');
    setStatus(selected?.status ?? 'ready');
    setNotes(selected?.notes ?? '');
  }

  async function handleSaveEdits(overrideStatus?: string) {
    if (!selected) return;
    setBusy('save');
    setFeedback(null);
    const nextStatus = overrideStatus ?? status;
    try {
      const res = await fetch(`/api/applications/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coverLetter,
          presentationPage,
          emailSubject,
          emailBody,
          recipientEmail: recipientEmail.trim() || null,
          notes: notes.trim() || null,
          status: nextStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur sauvegarde');
      setStatus(nextStatus);
      setFeedback({
        kind: 'ok',
        text: 'Candidature et statut manuel enregistrés dans PostgreSQL.',
      });
      await loadApps();
    } catch (err) {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Erreur' });
    } finally {
      setBusy(null);
    }
  }

  async function copyDraftMessage() {
    try {
      await navigator.clipboard.writeText(`${emailSubject}\n\n${emailBody}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFeedback({ kind: 'err', text: 'Impossible de copier dans le presse-papiers.' });
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Applications — Studio de candidature & Suivi manuel"
        subtitle="Éditez votre lettre côte à côte avec l’offre, adaptez votre CV, exportez en PDF/DOCX et suivez manuellement vos envois."
      />

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-xl border p-3.5 text-xs ${
            feedback.kind === 'ok'
              ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-100'
              : 'border-rose-500/35 bg-rose-500/15 text-rose-200'
          }`}
        >
          {feedback.kind === 'ok' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {loading ? (
        <GlassCard className="py-12 text-center text-sm text-slate-400">
          Chargement des candidatures...
        </GlassCard>
      ) : apps.length === 0 ? (
        <GlassCard className="py-12 text-center space-y-2">
          <p className="text-sm font-medium text-white">Aucune candidature générée</p>
          <p className="text-xs text-slate-400">
            Rendez-vous dans <strong>Job Matches</strong>, sélectionnez une offre et cliquez sur «
            Générer candidature personnalisée ».
          </p>
        </GlassCard>
      ) : (
        <>
          {/* Horizontal selector strip */}
          <div className="flex gap-3 overflow-x-auto pb-1">
            {apps.map((app) => {
              const active = app.id === selected?.id;
              const badgeInfo = APPLICATION_TRACKING_LABELS[app.status] || {
                label: app.status,
                variant: 'default' as const,
              };
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => setSelectedId(app.id)}
                  className={`min-w-[260px] text-left rounded-xl border p-3.5 transition-all cursor-pointer ${
                    active
                      ? 'border-indigo-400/50 bg-indigo-500/15'
                      : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={badgeInfo.variant}>{badgeInfo.label}</Badge>
                    <ScoreBadge score={app.fitScore} />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-white truncate">{app.jobTitle}</p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {app.company || 'Entreprise non précisée'} ·{' '}
                    {PLATFORM_DISPLAY[app.source]?.short || app.source}
                  </p>
                </button>
              );
            })}
          </div>

          {selected && (
            <GlassCard className="space-y-4">
              {/* Top Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">{selected.jobTitle}</h2>
                  <p className="text-xs text-slate-400">
                    {selected.company || 'Entreprise non précisée'} · Mise à jour{' '}
                    {formatFrDate(selected.updatedAt)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <a href={`/api/applications/${selected.id}/export?format=pdf`}>
                    <Button variant="secondary" size="sm" type="button">
                      <FileDown className="h-3.5 w-3.5" />
                      Exporter PDF
                    </Button>
                  </a>
                  <a href={`/api/applications/${selected.id}/export?format=docx`}>
                    <Button variant="secondary" size="sm" type="button">
                      <FileDown className="h-3.5 w-3.5" />
                      Exporter DOCX
                    </Button>
                  </a>
                  {!isDemo && (
                    <Button size="sm" onClick={() => void handleSaveEdits()} disabled={busy === 'save'}>
                      <Save className="h-3.5 w-3.5" />
                      {busy === 'save' ? 'Sauvegarde...' : 'Enregistrer'}
                    </Button>
                  )}
                </div>
              </div>

              {/* Sub-navigation Tabs */}
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'letter', label: 'Lettre côte à côte', icon: FileText },
                  { id: 'presentation', label: 'Page de présentation', icon: Sparkles },
                  { id: 'cv_tips', label: 'Suggestions CV & ATS', icon: CheckCircle2 },
                  { id: 'message', label: 'Message & Suivi manuel', icon: Mail },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-medium cursor-pointer transition-colors ${
                        isActive
                          ? 'border-indigo-400/50 bg-indigo-500/20 text-white'
                          : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-white'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab 1: Side-by-side Cover Letter Editor + Job Description */}
              {activeTab === 'letter' && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-cyan-300">
                        Éditeur de lettre de motivation personnalisée
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {coverLetter.length} caractères
                      </span>
                    </div>
                    <Textarea
                      rows={18}
                      value={coverLetter}
                      onChange={(e) => setCoverLetter(e.target.value)}
                      className="font-sans leading-relaxed"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-indigo-300">
                        Description originale du poste (référence)
                      </span>
                      <a
                        href={selected.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-cyan-300 hover:underline"
                      >
                        Ouvrir l’offre <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="h-[430px] overflow-y-auto rounded-xl border border-white/[0.09] bg-slate-950/65 p-4 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
                      {selected.jobDescription || 'Description non disponible.'}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Presentation Page */}
              {activeTab === 'presentation' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-cyan-300 block">
                    Page de présentation de candidature (incluse dans les exports PDF/DOCX)
                  </label>
                  <Textarea
                    rows={14}
                    value={presentationPage}
                    onChange={(e) => setPresentationPage(e.target.value)}
                  />
                </div>
              )}

              {/* Tab 3: CV Suggestions, Bullet Rewrites & ATS Keywords */}
              {activeTab === 'cv_tips' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2">
                      Mots-clés ATS recommandés
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.atsKeywords.map((kw) => (
                        <Badge key={kw} variant="violet">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-white">
                        Suggestions d’adaptation du CV (zéro hallucination)
                      </h3>
                      {selected.cvSuggestions.map((s, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5 space-y-1.5 text-xs"
                        >
                          <Badge variant="info">{s.section}</Badge>
                          <p className="text-slate-400">
                            <strong>Actuel :</strong> {s.currentText}
                          </p>
                          <p className="text-emerald-200">
                            <strong>Proposition :</strong> {s.suggestedImprovement}
                          </p>
                          <p className="text-slate-400 italic">{s.reason}</p>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-white">
                        Reformulations de bullet points
                      </h3>
                      {selected.bulletRewrites.map((b, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5 space-y-1.5 text-xs"
                        >
                          <p className="text-slate-400 line-through">{b.original}</p>
                          <p className="text-cyan-200 font-medium">{b.rewritten}</p>
                          <p className="text-slate-400">{b.impactNote}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Application Message & Manual Tracking */}
              {activeTab === 'message' && (
                <div className="grid gap-5 lg:grid-cols-12">
                  <div className="lg:col-span-7 space-y-3.5">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Objet du message de candidature
                      </label>
                      <Input
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Message professionnel prêt à envoyer
                      </label>
                      <Textarea
                        rows={10}
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Contact / destinataire noté (optionnel)
                      </label>
                      <Input
                        type="email"
                        placeholder="contact@entreprise.fr (saisie manuelle)"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Manual Tracking Panel */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/[0.08] p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        Contrôle humain intégral
                      </div>
                      <p className="text-xs leading-relaxed text-slate-300">
                        Aucune candidature n’est jamais envoyée automatiquement. Copiez ce message
                        ou téléchargez votre dossier PDF/DOCX, puis postulez directement sur le lien
                        officiel de l’offre.
                      </p>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                          variant="secondary"
                          className="w-full"
                          disabled={isDemo}
                          onClick={copyDraftMessage}
                        >
                          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                          {copied ? 'Copié' : 'Copier le message'}
                        </Button>
                        <a
                          href={selected.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full"
                        >
                          <Button variant="primary" className="w-full" type="button">
                            <ExternalLink className="h-4 w-4" />
                            Postuler sur l’offre
                          </Button>
                        </a>
                      </div>

                      <div className="border-t border-white/10 pt-3 space-y-2.5">
                        <label className="text-xs font-medium text-slate-200 block">
                          Statut manuel de la candidature
                        </label>
                        <Select
                          disabled={isDemo}
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                        >
                          <option value="draft">Brouillon</option>
                          <option value="ready">Prête à envoyer</option>
                          <option value="applied">Candidature envoyée</option>
                          <option value="interview">Entretien obtenu</option>
                          <option value="offer">Offre reçue</option>
                          <option value="rejected">Refusée / clôturée</option>
                        </Select>

                        <label className="text-xs text-slate-400 block">
                          Notes de suivi (date de relance, interlocuteur...)
                        </label>
                        <Textarea
                          rows={3}
                          disabled={isDemo}
                          value={notes}
                          placeholder="Ex : Postulé sur WTTJ le 27/11, relance prévue J+7..."
                          onChange={(e) => setNotes(e.target.value)}
                        />

                        {!isDemo && (
                          <Button
                            variant="emerald"
                            className="w-full"
                            onClick={() => void handleSaveEdits()}
                            disabled={busy === 'save'}
                          >
                            <Save className="h-4 w-4" />
                            Enregistrer le suivi manuel
                          </Button>
                        )}
                      </div>
                    </div>

                    {selected.sentAt && (
                      <div className="text-xs text-emerald-200 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                        Marquée comme envoyée le {formatFrDate(selected.sentAt)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </GlassCard>
          )}

          {/* Manual Tracking Table */}
          <GlassCard className="space-y-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-cyan-300" />
              <h3 className="text-sm font-semibold text-white">
                Tableau de suivi manuel des candidatures ({apps.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/[0.08] text-slate-400">
                  <tr>
                    <th className="py-2 pr-4">Poste &amp; Entreprise</th>
                    <th className="py-2 pr-4">Plateforme</th>
                    <th className="py-2 pr-4">Score IA</th>
                    <th className="py-2 pr-4">Statut</th>
                    <th className="py-2 pr-4">Notes</th>
                    <th className="py-2">Mise à jour</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-slate-300">
                  {apps.map((app) => {
                    const st = APPLICATION_TRACKING_LABELS[app.status] || {
                      label: app.status,
                      variant: 'default' as const,
                    };
                    return (
                      <tr
                        key={app.id}
                        onClick={() => setSelectedId(app.id)}
                        className="cursor-pointer hover:bg-white/[0.03]"
                      >
                        <td className="py-2.5 pr-4">
                          <p className="font-medium text-white">{app.jobTitle}</p>
                          <p className="text-[11px] text-slate-400">{app.company || '—'}</p>
                        </td>
                        <td className="py-2.5 pr-4">
                          {PLATFORM_DISPLAY[app.source]?.short || app.source}
                        </td>
                        <td className="py-2.5 pr-4">
                          <ScoreBadge score={app.fitScore} />
                        </td>
                        <td className="py-2.5 pr-4">
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </td>
                        <td className="py-2.5 pr-4 max-w-[220px] truncate text-slate-400">
                          {app.notes || '—'}
                        </td>
                        <td className="py-2.5 whitespace-nowrap text-slate-400">
                          {formatFrDate(app.updatedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      )}
    </div>
  );
}
