'use client';

import React, { useEffect, useState } from 'react';
import {
  Upload,
  Save,
  Trash2,
  FileText,
  Sliders,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import {
  Badge,
  Button,
  GlassCard,
  Input,
  SectionHeader,
  Select,
  Textarea,
} from '@/components/ui/primitives';
import type {
  CvCertification,
  CvEducation,
  CvExperience,
  CvLanguage,
  CvLink,
} from '@/db/schema';

interface CvState {
  fileName: string | null;
  fileType: string | null;
  rawText: string;
  fullName: string;
  headline: string;
  summary: string;
  email: string;
  phone: string;
  location: string;
  experienceLevel: string;
  education: CvEducation[];
  experiences: CvExperience[];
  technicalSkills: string[];
  softSkills: string[];
  languages: CvLanguage[];
  certifications: CvCertification[];
  sectors: string[];
  links: CvLink[];
}

interface PrefsState {
  targetRoles: string[];
  sectors: string[];
  cities: string[];
  departmentCodes: string[];
  communeCodes: string[];
  contractTypes: string[];
  duration: string;
  remotePolicy: string;
  keywords: string[];
  minFitScore: number;
}

const EMPTY_CV: CvState = {
  fileName: null,
  fileType: null,
  rawText: '',
  fullName: '',
  headline: '',
  summary: '',
  email: '',
  phone: '',
  location: '',
  experienceLevel: '',
  education: [],
  experiences: [],
  technicalSkills: [],
  softSkills: [],
  languages: [],
  certifications: [],
  sectors: [],
  links: [],
};

const EMPTY_PREFS: PrefsState = {
  targetRoles: [],
  sectors: [],
  cities: [],
  departmentCodes: [],
  communeCodes: [],
  contractTypes: ['CDI'],
  duration: '',
  remotePolicy: 'any',
  keywords: [],
  minFitScore: 6,
};

function splitCsv(val: string): string[] {
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function MyCvPage() {
  const [cv, setCv] = useState<CvState | null>(null);
  const [prefs, setPrefs] = useState<PrefsState>(EMPTY_PREFS);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingCv, setSavingCv] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [cvRes, prefsRes] = await Promise.all([
        fetch('/api/cv').then((r) => r.json()),
        fetch('/api/cv/preferences').then((r) => r.json()),
      ]);
      setIsDemo(Boolean(cvRes.isDemo));
      setCv(cvRes.cv || null);
      if (prefsRes.preferences) {
        setPrefs({
          ...EMPTY_PREFS,
          ...prefsRes.preferences,
        });
      }
    } catch {
      setFeedback({ kind: 'err', text: 'Erreur lors du chargement du CV.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFeedback(null);

    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/cv/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec de l’importation');
      setCv(data.cv);
      setFeedback({
        kind: 'ok',
        text: `Master CV importé (${file.name}, méthode : ${data.method}).${data.warning ? ` ${data.warning}` : ''}`,
      });
    } catch (err) {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Erreur import' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleSaveCv() {
    if (!cv) return;
    setSavingCv(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/cv', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cv),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur sauvegarde');
      setCv(data.cv);
      setFeedback({ kind: 'ok', text: 'Master CV enregistré en base de données PostgreSQL.' });
    } catch (err) {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Erreur sauvegarde' });
    } finally {
      setSavingCv(false);
    }
  }

  async function handleDeleteCv() {
    if (!confirm('Supprimer définitivement votre Master CV enregistré ?')) return;
    const res = await fetch('/api/cv', { method: 'DELETE' });
    if (res.ok) {
      setCv(null);
      setFeedback({ kind: 'ok', text: 'Master CV supprimé.' });
    }
  }

  async function handleSavePrefs(e: React.FormEvent) {
    e.preventDefault();
    setSavingPrefs(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/cv/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur sauvegarde préférences');
      setFeedback({ kind: 'ok', text: 'Préférences de recherche enregistrées.' });
    } catch (err) {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Erreur' });
    } finally {
      setSavingPrefs(false);
    }
  }

  const activeCv = cv || EMPTY_CV;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="My CV — Master CV & Préférences"
        subtitle="Importez votre CV au format PDF ou DOCX, vérifiez chaque champ extrait et configurez vos critères de recherche."
        action={
          !isDemo && (
            <>
              <label className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white cursor-pointer hover:brightness-110 shadow-lg shadow-indigo-500/20">
                <Upload className="h-4 w-4" />
                <span>{uploading ? 'Analyse en cours...' : cv ? 'Remplacer le CV (PDF/DOCX)' : 'Importer mon CV (PDF/DOCX)'}</span>
                <input
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
              {cv && (
                <Button variant="danger" size="md" onClick={handleDeleteCv}>
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </Button>
              )}
            </>
          )
        }
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

      <div className="flex items-start gap-2.5 rounded-xl border border-indigo-400/25 bg-indigo-500/10 p-3.5 text-xs text-indigo-100">
        <ShieldAlert className="h-4 w-4 text-cyan-300 shrink-0 mt-0.5" />
        <span>
          <strong>Politique zéro hallucination &amp; confidentialité :</strong> Le système n’invente
          jamais de diplôme, d’expérience, de certification ou de compétence. Lorsque Gemini est
          activé, le texte du CV est envoyé côté serveur uniquement pour l’extraction et le scoring.
        </span>
      </div>

      {loading ? (
        <GlassCard className="py-12 text-center text-sm text-slate-400">
          Chargement du Master CV...
        </GlassCard>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Master CV Form */}
          <GlassCard className="lg:col-span-7 space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-cyan-300" />
                <h2 className="text-base font-semibold text-white">Master CV structuré</h2>
              </div>
              {activeCv.fileName && (
                <Badge variant="info">
                  {activeCv.fileName} ({activeCv.fileType?.toUpperCase() || 'CV'})
                </Badge>
              )}
            </div>

            {!cv && !isDemo ? (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center space-y-3">
                <p className="text-sm font-medium text-white">Aucun Master CV enregistré</p>
                <p className="text-xs text-slate-400">
                  Importez un fichier <strong>.pdf</strong> ou <strong>.docx</strong> ou créez
                  manuellement votre profil de référence.
                </p>
                <Button variant="secondary" size="sm" onClick={() => setCv({ ...EMPTY_CV })}>
                  Saisir manuellement
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Nom complet</label>
                    <Input
                      disabled={isDemo}
                      value={activeCv.fullName}
                      onChange={(e) => setCv({ ...activeCv, fullName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Titre / Poste visé</label>
                    <Input
                      disabled={isDemo}
                      value={activeCv.headline}
                      onChange={(e) => setCv({ ...activeCv, headline: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Localisation</label>
                    <Input
                      disabled={isDemo}
                      value={activeCv.location}
                      onChange={(e) => setCv({ ...activeCv, location: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Niveau d’expérience</label>
                    <Input
                      disabled={isDemo}
                      value={activeCv.experienceLevel}
                      placeholder="Junior, Alternant, Confirmé (3 ans)..."
                      onChange={(e) => setCv({ ...activeCv, experienceLevel: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Résumé professionnel</label>
                  <Textarea
                    rows={3}
                    disabled={isDemo}
                    value={activeCv.summary}
                    onChange={(e) => setCv({ ...activeCv, summary: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Compétences techniques (séparées par des virgules)
                  </label>
                  <Input
                    disabled={isDemo}
                    value={activeCv.technicalSkills.join(', ')}
                    onChange={(e) =>
                      setCv({ ...activeCv, technicalSkills: splitCsv(e.target.value) })
                    }
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Compétences comportementales
                    </label>
                    <Input
                      disabled={isDemo}
                      value={activeCv.softSkills.join(', ')}
                      onChange={(e) =>
                        setCv({ ...activeCv, softSkills: splitCsv(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Secteurs d’activité</label>
                    <Input
                      disabled={isDemo}
                      value={activeCv.sectors.join(', ')}
                      onChange={(e) => setCv({ ...activeCv, sectors: splitCsv(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Structured lists preview */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5">
                    <p className="text-xs font-semibold text-white mb-2">
                      Formation académique ({activeCv.education.length})
                    </p>
                    <ul className="space-y-2 text-xs text-slate-300">
                      {activeCv.education.length === 0 ? (
                        <li className="text-slate-500">Aucune formation extraite</li>
                      ) : (
                        activeCv.education.map((ed, i) => (
                          <li key={i} className="border-l-2 border-indigo-400/50 pl-2.5">
                            <p className="font-medium text-white">{ed.degree}</p>
                            <p className="text-slate-400">
                              {[ed.institution, ed.startDate, ed.endDate].filter(Boolean).join(' · ')}
                            </p>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5">
                    <p className="text-xs font-semibold text-white mb-2">
                      Langues ({activeCv.languages.length}) &amp; Certifications ({activeCv.certifications.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {activeCv.languages.map((l, i) => (
                        <Badge key={i} variant="info">
                          {l.name}
                          {l.level ? ` (${l.level})` : ''}
                        </Badge>
                      ))}
                    </div>
                    <ul className="space-y-1 text-xs text-slate-300">
                      {activeCv.certifications.map((c, i) => (
                        <li key={i}>• {c.name} {c.issuer ? `— ${c.issuer}` : ''}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Experiences */}
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5 space-y-3">
                  <p className="text-xs font-semibold text-white">
                    Expériences professionnelles ({activeCv.experiences.length})
                  </p>
                  {activeCv.experiences.length === 0 ? (
                    <p className="text-xs text-slate-500">Aucune expérience extraite.</p>
                  ) : (
                    activeCv.experiences.map((exp, i) => (
                      <div key={i} className="border-l-2 border-cyan-400/50 pl-3 space-y-1">
                        <p className="text-xs font-semibold text-white">
                          {exp.role} {exp.company ? `— ${exp.company}` : ''}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {[exp.startDate, exp.endDate, exp.location].filter(Boolean).join(' · ')}
                        </p>
                        {exp.bullets.length > 0 && (
                          <ul className="list-disc pl-4 space-y-0.5 text-xs text-slate-300">
                            {exp.bullets.map((b, bi) => (
                              <li key={bi}>{b}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {!isDemo && (
                  <Button onClick={handleSaveCv} disabled={savingCv}>
                    <Save className="h-4 w-4" />
                    {savingCv ? 'Enregistrement...' : 'Enregistrer les modifications du CV'}
                  </Button>
                )}
              </div>
            )}
          </GlassCard>

          {/* Search Preferences */}
          <GlassCard className="lg:col-span-5">
            <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 mb-4">
              <Sliders className="h-4 w-4 text-indigo-300" />
              <h2 className="text-base font-semibold text-white">Préférences de recherche</h2>
            </div>

            <form onSubmit={handleSavePrefs} className="space-y-3.5">
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Métiers ciblés (séparés par virgules)
                </label>
                <Input
                  disabled={isDemo}
                  value={prefs.targetRoles.join(', ')}
                  placeholder="Ingénieur Full-Stack, Product Manager, Data Analyst..."
                  onChange={(e) => setPrefs({ ...prefs, targetRoles: splitCsv(e.target.value) })}
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Secteurs recherchés</label>
                <Input
                  disabled={isDemo}
                  value={prefs.sectors.join(', ')}
                  placeholder="SaaS, IA, FinTech, Industrie..."
                  onChange={(e) => setPrefs({ ...prefs, sectors: splitCsv(e.target.value) })}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Villes souhaitées</label>
                  <Input
                    disabled={isDemo}
                    value={prefs.cities.join(', ')}
                    placeholder="Paris, Lyon, Bordeaux"
                    onChange={(e) => setPrefs({ ...prefs, cities: splitCsv(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Départements France Travail
                  </label>
                  <Input
                    disabled={isDemo}
                    value={prefs.departmentCodes.join(', ')}
                    placeholder="75, 92, 69"
                    onChange={(e) =>
                      setPrefs({ ...prefs, departmentCodes: splitCsv(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Types de contrat</label>
                  <Input
                    disabled={isDemo}
                    value={prefs.contractTypes.join(', ')}
                    placeholder="CDI, Alternance, Stage"
                    onChange={(e) =>
                      setPrefs({ ...prefs, contractTypes: splitCsv(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Durée</label>
                  <Input
                    disabled={isDemo}
                    value={prefs.duration}
                    placeholder="Temps plein, 12 mois..."
                    onChange={(e) => setPrefs({ ...prefs, duration: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Télétravail</label>
                  <Select
                    disabled={isDemo}
                    value={prefs.remotePolicy}
                    onChange={(e) => setPrefs({ ...prefs, remotePolicy: e.target.value })}
                  >
                    <option value="any">Indifférent</option>
                    <option value="hybrid">Hybride</option>
                    <option value="remote">Full Remote</option>
                    <option value="onsite">Présentiel</option>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Score minimal compatible ({prefs.minFitScore}/10)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    disabled={isDemo}
                    value={prefs.minFitScore}
                    onChange={(e) =>
                      setPrefs({ ...prefs, minFitScore: Number(e.target.value) || 6 })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Mots-clés prioritaires</label>
                <Input
                  disabled={isDemo}
                  value={prefs.keywords.join(', ')}
                  placeholder="TypeScript, Python, API, IA..."
                  onChange={(e) => setPrefs({ ...prefs, keywords: splitCsv(e.target.value) })}
                />
              </div>

              {!isDemo && (
                <Button type="submit" className="w-full" disabled={savingPrefs}>
                  <Save className="h-4 w-4" />
                  {savingPrefs ? 'Sauvegarde...' : 'Enregistrer les préférences'}
                </Button>
              )}
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
