'use client';

import React, { useEffect, useState } from 'react';
import {
  FileDown,
  Mail,
  Send,
  Save,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  FileText,
} from 'lucide-react';
import {
  Badge,
  Button,
  GlassCard,
  Input,
  ScoreBadge,
  SectionHeader,
  Textarea,
} from '@/components/ui/primitives';
import { formatFrDate, PLATFORM_DISPLAY } from '@/lib/utils';

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
  gmailDraftId: string | null;
  gmailMessageId: string | null;
  sentAt: string | null;
  updatedAt: string;
}

interface EmailLogItem {
  id: string;
  recipientEmail: string;
  subject: string;
  action: string;
  humanConfirmed: boolean;
  attachments: string[];
  createdAt: string;
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState<ApplicationItem[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLogItem[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'letter' | 'presentation' | 'cv_tips' | 'gmail'>(
    'letter'
  );

  // Editable draft fields
  const [coverLetter, setCoverLetter] = useState('');
  const [presentationPage, setPresentationPage] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [attachPdf, setAttachPdf] = useState(true);
  const [humanConfirmed, setHumanConfirmed] = useState(false);

  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function loadApps() {
    return fetch('/api/applications').then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur chargement candidatures');
      setApps(data.applications || []);
      setEmailLogs(data.emailLogs || []);
      setIsDemo(Boolean(data.isDemo));
      const firstId = data.applications?.[0]?.id || null;
      setSelectedId((prev) =>
        prev && (data.applications || []).some((a: ApplicationItem) => a.id === prev)
          ? prev
          : firstId
      );
    }).catch((err) => {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Erreur' });
    }).finally(() => {
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
    setHumanConfirmed(false);
  }

  async function handleSaveEdits() {
    if (!selected) return;
    setBusy('save');
    setFeedback(null);
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur sauvegarde');
      setFeedback({ kind: 'ok', text: 'Modifications de la candidature enregistrées.' });
      await loadApps();
    } catch (err) {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Erreur' });
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateGmailDraft() {
    if (!selected) return;
    setBusy('draft');
    setFeedback(null);
    try {
      const res = await fetch(`/api/applications/${selected.id}/gmail/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientEmail,
          subject: emailSubject,
          body: emailBody,
          attachCoverLetterPdf: attachPdf,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec création brouillon Gmail');
      setFeedback({
        kind: 'ok',
        text: `Brouillon Gmail créé avec succès (ID : ${data.draftId}). Vérifiez-le avant tout envoi.`,
      });
      await loadApps();
    } catch (err) {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Erreur Gmail' });
    } finally {
      setBusy(null);
    }
  }

  async function handleSendGmail() {
    if (!selected || !humanConfirmed) return;
    setBusy('send');
    setFeedback(null);
    try {
      const res = await fetch(`/api/applications/${selected.id}/gmail/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientEmail,
          subject: emailSubject,
          body: emailBody,
          humanConfirmed: true,
          attachCoverLetterPdf: attachPdf,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec envoi Gmail');
      setFeedback({
        kind: 'ok',
        text: `Email envoyé via Gmail après votre confirmation (Message ID : ${data.messageId}).`,
      });
      setHumanConfirmed(false);
      await loadApps();
    } catch (err) {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Erreur envoi' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Applications — Studio de candidature & Gmail"
        subtitle="Éditez votre lettre de motivation côte à côte avec l’offre, exportez en PDF/DOCX et validez manuellement chaque envoi Gmail."
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
                    <Badge
                      variant={
                        app.status === 'sent'
                          ? 'success'
                          : app.status === 'gmail_draft'
                            ? 'info'
                            : 'violet'
                      }
                    >
                      {app.status}
                    </Badge>
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
                    <Button size="sm" onClick={handleSaveEdits} disabled={busy === 'save'}>
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
                  { id: 'gmail', label: 'Mail & Validation Gmail', icon: Mail },
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
                        Suggestions d’adaptation du CV (sans ajout fictif)
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

              {/* Tab 4: Email Preview + Human-Confirmed Gmail Send */}
              {activeTab === 'gmail' && (
                <div className="grid gap-5 lg:grid-cols-12">
                  <div className="lg:col-span-7 space-y-3.5">
                    {!recipientEmail.trim() && (
                      <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 p-3.5 text-xs text-amber-100 flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <strong>Aucune adresse email de recruteur vérifiée</strong> dans cette
                          offre (nous n’inventons jamais d’adresse email). Ouvrez l’offre originale
                          ou renseignez manuellement le destinataire ci-dessous.
                        </span>
                        <a
                          href={selected.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 underline font-semibold text-amber-200"
                        >
                          Ouvrir l’offre <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Destinataire (vérifié ou saisi manuellement)
                      </label>
                      <Input
                        type="email"
                        placeholder="prenom.nom@entreprise.fr"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Objet du mail</label>
                      <Input
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Corps du mail</label>
                      <Textarea
                        rows={10}
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                      />
                    </div>

                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={attachPdf}
                        onChange={(e) => setAttachPdf(e.target.checked)}
                        className="rounded border-white/20 bg-slate-900"
                      />
                      Joindre automatiquement la lettre de motivation &amp; présentation en PDF
                    </label>
                  </div>

                  {/* Human Validation Box */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/[0.08] p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        Validation humaine obligatoire
                      </div>
                      <p className="text-xs leading-relaxed text-slate-300">
                        Aucun email n’est jamais envoyé automatiquement. Préparez d’abord un
                        brouillon dans Gmail, ou cochez la confirmation ci-dessous après relecture
                        complète du destinataire, de l’objet et des pièces jointes.
                      </p>

                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={handleCreateGmailDraft}
                        disabled={isDemo || !recipientEmail.trim() || busy === 'draft'}
                      >
                        <Mail className="h-4 w-4" />
                        {busy === 'draft'
                          ? 'Création du brouillon...'
                          : 'Créer un brouillon Gmail'}
                      </Button>

                      <div className="border-t border-white/10 pt-3 space-y-3">
                        <label className="flex items-start gap-2.5 text-xs text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={humanConfirmed}
                            onChange={(e) => setHumanConfirmed(e.target.checked)}
                            disabled={isDemo}
                            className="mt-0.5 rounded border-white/20 bg-slate-900"
                          />
                          <span>
                            Je confirme avoir vérifié l’adresse destinataire (
                            <strong className="text-cyan-300">
                              {recipientEmail.trim() || 'non renseignée'}
                            </strong>
                            ), le contenu du message et les pièces jointes, et j’autorise l’envoi
                            réel via Gmail.
                          </span>
                        </label>

                        <Button
                          variant="emerald"
                          className="w-full"
                          onClick={handleSendGmail}
                          disabled={
                            isDemo ||
                            !humanConfirmed ||
                            !recipientEmail.trim() ||
                            busy === 'send'
                          }
                        >
                          <Send className="h-4 w-4" />
                          {busy === 'send'
                            ? 'Envoi via Gmail...'
                            : 'Confirmer et envoyer via Gmail'}
                        </Button>
                      </div>
                    </div>

                    {selected.gmailDraftId && (
                      <div className="text-xs text-cyan-200 rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3">
                        Brouillon Gmail lié : <code className="font-mono">{selected.gmailDraftId}</code>
                      </div>
                    )}
                    {selected.sentAt && (
                      <div className="text-xs text-emerald-200 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                        Candidature envoyée le {formatFrDate(selected.sentAt)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </GlassCard>
          )}

          {/* Email History */}
          <GlassCard className="space-y-3">
            <h3 className="text-sm font-semibold text-white">
              Historique des brouillons et envois Gmail ({emailLogs.length})
            </h3>
            {emailLogs.length === 0 ? (
              <p className="text-xs text-slate-400">
                Aucun email ou brouillon enregistré pour le moment.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/[0.08] text-slate-400">
                    <tr>
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Action</th>
                      <th className="py-2 pr-4">Destinataire</th>
                      <th className="py-2 pr-4">Objet</th>
                      <th className="py-2">Validation humaine</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] text-slate-300">
                    {emailLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-2.5 pr-4 whitespace-nowrap">{formatFrDate(log.createdAt)}</td>
                        <td className="py-2.5 pr-4">
                          <Badge variant={log.action === 'sent' ? 'success' : 'info'}>
                            {log.action}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-4 font-mono">{log.recipientEmail}</td>
                        <td className="py-2.5 pr-4">{log.subject}</td>
                        <td className="py-2.5">
                          {log.humanConfirmed ? 'Oui (confirmée)' : 'Brouillon'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </>
      )}
    </div>
  );
}
