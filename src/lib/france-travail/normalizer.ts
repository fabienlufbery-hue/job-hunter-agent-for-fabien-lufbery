import type { RawJobInput } from '@/lib/jobs/normalize';

export interface FranceTravailOffer {
  id: string;
  intitule: string;
  description?: string;
  dateCreation?: string;
  dateActualisation?: string;
  lieuTravail?: {
    libelle?: string;
    codePostal?: string;
    commune?: string;
  };
  entreprise?: {
    nom?: string;
    description?: string;
  };
  typeContrat?: string;
  typeContratLibelle?: string;
  natureContrat?: string;
  salaire?: {
    libelle?: string;
    commentaire?: string;
  };
  competences?: Array<{
    code?: string;
    libelle?: string;
    exigence?: string;
  }>;
  qualitesProfessionnelles?: Array<{
    libelle?: string;
  }>;
  origineOffre?: {
    origine?: string;
    urlOrigine?: string;
  };
  contact?: {
    nom?: string;
    courriel?: string;
    urlPostulation?: string;
  };
}

export function normalizeFranceTravailOffer(offer: FranceTravailOffer): RawJobInput {
  const originalUrl =
    offer.origineOffre?.urlOrigine ||
    offer.contact?.urlPostulation ||
    `https://candidat.francetravail.fr/offres/recherche/detail/${encodeURIComponent(offer.id)}`;

  const skills = [
    ...(offer.competences || []).map((c) => c.libelle?.trim() || '').filter(Boolean),
    ...(offer.qualitesProfessionnelles || []).map((q) => q.libelle?.trim() || '').filter(Boolean),
  ];

  const salary = offer.salaire?.libelle?.trim() || offer.salaire?.commentaire?.trim() || null;

  const location = offer.lieuTravail?.libelle?.trim() || offer.lieuTravail?.codePostal?.trim() || null;

  const recruiterEmail =
    offer.contact?.courriel && offer.contact.courriel.includes('@')
      ? offer.contact.courriel.trim()
      : null;

  return {
    externalId: offer.id,
    title: offer.intitule?.trim() || `Offre France Travail #${offer.id}`,
    company: offer.entreprise?.nom?.trim() || null,
    location,
    contractType: offer.typeContratLibelle?.trim() || offer.typeContrat?.trim() || null,
    salary,
    description: offer.description?.trim() || '',
    skills,
    publishedAt: offer.dateCreation || offer.dateActualisation || null,
    originalUrl,
    source: 'france_travail',
    recruiterEmail,
  };
}
