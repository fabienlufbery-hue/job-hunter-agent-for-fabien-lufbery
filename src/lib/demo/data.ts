import type {
  CvCertification,
  CvEducation,
  CvExperience,
  CvLanguage,
  CvLink,
  CvSuggestion,
  BulletRewrite,
  JobProvenance,
  JobSource,
  ApplicationStatus,
  AutomationErrorEntry,
} from '@/db/schema';

export interface DemoCv {
  id: string;
  isDemo: true;
  fileName: string;
  fileType: string;
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
  contentHash: string;
  uploadedAt: string;
  updatedAt: string;
}

export interface DemoPreferences {
  id: string;
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
  updatedAt: string;
}

export interface DemoJobWithAnalysis {
  id: string;
  externalId: string | null;
  dedupeHash: string;
  contentHash: string;
  title: string;
  company: string | null;
  location: string | null;
  contractType: string | null;
  salary: string | null;
  description: string;
  skills: string[];
  publishedAt: string | null;
  collectedAt: string;
  originalUrl: string;
  source: JobSource;
  provenance: JobProvenance[];
  applicationStatus: ApplicationStatus;
  isFavorite: boolean;
  recruiterEmail: string | null;
  notes: string | null;
  analysis: {
    fitScore: number;
    reasoningSummary: string;
    matchedSkills: string[];
    missingSkills: string[];
    experienceMatch: string;
    educationMatch: string;
    languageMatch: string;
    atsKeywords: string[];
    strengths: string[];
    weaknesses: string[];
    recommendation: string;
    modelUsed: string;
    updatedAt: string;
  } | null;
}

export interface DemoApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string | null;
  source: JobSource;
  originalUrl: string;
  jobDescription: string;
  fitScore: number | null;
  status: string;
  coverLetter: string;
  presentationPage: string;
  cvSuggestions: CvSuggestion[];
  bulletRewrites: BulletRewrite[];
  atsKeywords: string[];
  emailSubject: string;
  emailBody: string;
  recipientEmail: string | null;
  gmailDraftId: string | null;
  gmailMessageId: string | null;
  modelUsed: string;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DemoAutomationRun {
  id: string;
  triggerType: string;
  sources: string[];
  status: string;
  jobsFetched: number;
  jobsNew: number;
  jobsDuplicates: number;
  jobsScored: number;
  errors: AutomationErrorEntry[];
  startedAt: string;
  finishedAt: string;
}

export const DEMO_MASTER_CV: DemoCv = {
  id: 'demo-cv',
  isDemo: true,
  fileName: 'CV_Alex_Martin_FICTIF_DEMO.pdf',
  fileType: 'pdf',
  fullName: 'Alex Martin (Profil Fictif — Mode Démo)',
  headline: 'Ingénieur Full-Stack TypeScript & IA Appliquée',
  summary:
    'Profil de démonstration entièrement fictif permettant aux évaluateurs de tester l’interface Job Hunter Agent for Fabien Lufbery sans accéder aux données personnelles de Fabien Lufbery.',
  email: 'alex.martin.demo@example.invalid',
  phone: '+33 6 00 00 00 00 (Fictif)',
  location: 'Paris, Île-de-France (Hybride / Remote)',
  experienceLevel: 'Confirmé (3–5 ans)',
  education: [
    {
      degree: 'Master Informatique — Systèmes Distribués & Intelligence Artificielle',
      institution: 'Université Exemple Paris-Saclay (Fictif)',
      startDate: '2020',
      endDate: '2022',
      location: 'Paris',
      details: 'Spécialisation architecture cloud, apprentissage automatique et génie logiciel.',
    },
    {
      degree: 'Licence Informatique',
      institution: 'Université Exemple Lyon (Fictif)',
      startDate: '2017',
      endDate: '2020',
      location: 'Lyon',
    },
  ],
  experiences: [
    {
      role: 'Développeur Full-Stack Senior (Next.js / Node.js)',
      company: 'Atelier Numérique Fictif SAS',
      location: 'Paris',
      startDate: '2023-03',
      endDate: 'Présent',
      sector: 'SaaS B2B / IA',
      bullets: [
        'Conception et déploiement d’une plateforme SaaS Next.js / TypeScript / PostgreSQL utilisée par 18 000 utilisateurs mensuels.',
        'Intégration de pipelines d’analyse documentaire via API LLM avec validation JSON stricte et réduction de 42 % de la latence.',
        'Mise en place de tests automatisés CI/CD GitHub Actions et couverture de tests de 86 %.',
      ],
    },
    {
      role: 'Ingénieur Logiciel Full-Stack',
      company: 'CloudBridge Demo Labs',
      location: 'Lyon',
      startDate: '2022-09',
      endDate: '2023-02',
      sector: 'FinTech / Cloud',
      bullets: [
        'Développement d’API REST sécurisées OAuth2 et intégration de webhooks partenaires.',
        'Refonte du tableau de bord React / Tailwind CSS avec amélioration du temps de chargement initial de 35 %.',
      ],
    },
  ],
  technicalSkills: [
    'TypeScript',
    'Next.js',
    'React',
    'Node.js',
    'PostgreSQL',
    'Tailwind CSS',
    'Python',
    'REST API',
    'OAuth2',
    'Docker',
    'GitHub Actions',
    'LLM / Gemini API',
  ],
  softSkills: [
    'Autonomie',
    'Résolution de problèmes complexes',
    'Communication technique claire',
    'Collaboration produit / design',
    'Rigueur sécurité & qualité',
  ],
  languages: [
    { name: 'Français', level: 'Langue maternelle' },
    { name: 'Anglais', level: 'Courant professionnel (C1)' },
  ],
  certifications: [
    { name: 'AWS Certified Developer — Associate (Démo)', issuer: 'AWS', date: '2024' },
  ],
  sectors: ['SaaS B2B', 'Intelligence Artificielle', 'Cloud & DevTools', 'FinTech'],
  links: [
    { label: 'Portfolio Démo', url: 'https://example.com/alex-martin-demo' },
  ],
  rawText:
    '[DONNÉES FICTIVES DE DÉMONSTRATION]\nAlex Martin — Ingénieur Full-Stack TypeScript & IA Appliquée — Paris\nExpériences : Atelier Numérique Fictif SAS (2023-Présent), CloudBridge Demo Labs (2022-2023)...',
  contentHash: 'demo-cv-hash-v1',
  uploadedAt: '2026-11-20T09:00:00.000Z',
  updatedAt: '2026-11-26T17:30:00.000Z',
};

export const DEMO_PREFERENCES: DemoPreferences = {
  id: 'demo-prefs',
  targetRoles: ['Ingénieur Full-Stack TypeScript', 'AI Product Engineer', 'Développeur Next.js Senior'],
  sectors: ['SaaS B2B', 'Intelligence Artificielle', 'FinTech'],
  cities: ['Paris', 'Lyon', 'Remote France'],
  departmentCodes: ['75', '92', '69'],
  communeCodes: ['75056'],
  contractTypes: ['CDI', 'Alternance'],
  duration: 'Temps plein',
  remotePolicy: 'hybrid',
  keywords: ['TypeScript', 'Next.js', 'PostgreSQL', 'IA', 'API'],
  minFitScore: 7,
  updatedAt: '2026-11-26T17:30:00.000Z',
};

export const DEMO_JOBS: DemoJobWithAnalysis[] = [
  {
    id: 'demo-job-1',
    externalId: 'wttj-demo-901',
    dedupeHash: 'demo-hash-1',
    contentHash: 'demo-content-1',
    title: 'Senior Full-Stack AI Engineer (Next.js / TypeScript) [Offre Fictive]',
    company: 'Helios Data Lab (Démo)',
    location: 'Paris 9e — Hybride 2j/sem',
    contractType: 'CDI',
    salary: '58 k€ – 68 k€',
    description:
      '[OFFRE FICTIVE DE DÉMONSTRATION] Helios Data Lab recherche un(e) Senior Full-Stack AI Engineer pour concevoir nos assistants métier basés sur Next.js, TypeScript, PostgreSQL et Google Gemini. Vous piloterez l’architecture API, les pipelines de scoring structuré, la sécurité OAuth2 et les interfaces React modernes.',
    skills: ['TypeScript', 'Next.js', 'React', 'PostgreSQL', 'LLM / Gemini API', 'OAuth2', 'Tailwind CSS'],
    publishedAt: '2026-11-26T08:15:00.000Z',
    collectedAt: '2026-11-26T09:02:00.000Z',
    originalUrl: 'https://www.welcometothejungle.com/fr/companies/demo-example/jobs/demo-1',
    source: 'welcome_to_the_jungle',
    provenance: [
      {
        source: 'welcome_to_the_jungle',
        url: 'https://www.welcometothejungle.com/fr/companies/demo-example/jobs/demo-1',
        externalId: 'wttj-demo-901',
        seenAt: '2026-11-26T09:02:00.000Z',
      },
      {
        source: 'indeed',
        url: 'https://fr.indeed.com/viewjob?jk=demo-dup-901',
        externalId: 'demo-dup-901',
        seenAt: '2026-11-26T18:01:00.000Z',
      },
    ],
    applicationStatus: 'tailored',
    isFavorite: true,
    recruiterEmail: null,
    notes: 'Dédupliquée automatiquement entre Welcome to the Jungle et Indeed.',
    analysis: {
      fitScore: 9,
      reasoningSummary:
        'Adéquation exceptionnelle : maîtrise directe de Next.js, TypeScript, PostgreSQL, OAuth2 et pipelines LLM structurés sur un poste hybride à Paris.',
      matchedSkills: ['TypeScript', 'Next.js', 'React', 'PostgreSQL', 'LLM / Gemini API', 'OAuth2', 'Tailwind CSS'],
      missingSkills: ['Kubernetes'],
      experienceMatch: 'Forte correspondance : 3+ ans en SaaS B2B TypeScript et intégration LLM en production.',
      educationMatch: 'Master Informatique IA & Systèmes Distribués parfaitement aligné.',
      languageMatch: 'Français natif + Anglais C1 conformes aux attentes.',
      atsKeywords: ['Next.js', 'TypeScript', 'PostgreSQL', 'LLM', 'OAuth2', 'SaaS B2B', 'CI/CD'],
      strengths: [
        'Expérience démontrée sur des pipelines documentaires LLM avec validation JSON',
        'Stack Next.js + PostgreSQL identique à l’offre',
        'Sensibilité sécurité et tests automatisés',
      ],
      weaknesses: ['Pas de mention Kubernetes en production sur le CV'],
      recommendation: 'Candidature fortement recommandée (priorité haute)',
      modelUsed: 'gemini-3.5-flash-lite (démo)',
      updatedAt: '2026-11-26T09:03:00.000Z',
    },
  },
  {
    id: 'demo-job-2',
    externalId: 'ft-demo-182AB90',
    dedupeHash: 'demo-hash-2',
    contentHash: 'demo-content-2',
    title: 'Développeur Full-Stack TypeScript / Node.js — API & Cloud [Offre Fictive]',
    company: 'NovaPulse Solutions (Démo)',
    location: 'Paris (75008)',
    contractType: 'CDI',
    salary: '52 k€ – 60 k€',
    description:
      '[OFFRE FICTIVE DE DÉMONSTRATION — Source France Travail API v2] Rejoignez notre équipe produit pour concevoir des API Node.js/TypeScript hautement disponibles, connecter des services partenaires OAuth2 et maintenir nos bases PostgreSQL.',
    skills: ['TypeScript', 'Node.js', 'PostgreSQL', 'REST API', 'OAuth2', 'Docker'],
    publishedAt: '2026-11-26T07:45:00.000Z',
    collectedAt: '2026-11-26T09:00:14.000Z',
    originalUrl: 'https://candidat.francetravail.fr/offres/recherche/detail/DEMO182',
    source: 'france_travail',
    provenance: [
      {
        source: 'france_travail',
        url: 'https://candidat.francetravail.fr/offres/recherche/detail/DEMO182',
        externalId: 'ft-demo-182AB90',
        seenAt: '2026-11-26T09:00:14.000Z',
      },
    ],
    applicationStatus: 'draft_ready',
    isFavorite: true,
    recruiterEmail: 'recrutement-demo@example.invalid',
    notes: 'Collectée via le flux serveur France Travail API v2.',
    analysis: {
      fitScore: 8,
      reasoningSummary:
        'Très bonne adéquation backend et API OAuth2 avec Node.js, TypeScript et PostgreSQL.',
      matchedSkills: ['TypeScript', 'Node.js', 'PostgreSQL', 'REST API', 'OAuth2', 'Docker'],
      missingSkills: ['GraphQL'],
      experienceMatch: 'Expérience FinTech / API OAuth2 directement transférable.',
      educationMatch: 'Master Informatique conforme.',
      languageMatch: 'Français et Anglais adaptés.',
      atsKeywords: ['Node.js', 'TypeScript', 'PostgreSQL', 'OAuth2', 'Docker', 'API REST'],
      strengths: ['Expérience OAuth2 & webhooks déjà éprouvée', 'Maîtrise PostgreSQL et Docker'],
      weaknesses: ['GraphQL mentionné en bonus absent du CV'],
      recommendation: 'Candidature recommandée',
      modelUsed: 'gemini-3.5-flash-lite (démo)',
      updatedAt: '2026-11-26T09:01:00.000Z',
    },
  },
  {
    id: 'demo-job-3',
    externalId: 'hw-demo-4410',
    dedupeHash: 'demo-hash-3',
    contentHash: 'demo-content-3',
    title: 'Product Engineer React / Next.js — SaaS B2B [Offre Fictive]',
    company: 'Veridian Analytics (Démo)',
    location: 'Lyon 2e — Hybride',
    contractType: 'CDI',
    salary: '50 k€ – 58 k€',
    description:
      '[OFFRE FICTIVE DE DÉMONSTRATION] Au sein d’une équipe produit de 12 personnes, vous développez des tableaux de bord analytiques React/Next.js/Tailwind CSS et collaborez étroitement avec les designers.',
    skills: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'GitHub Actions'],
    publishedAt: '2026-11-25T16:20:00.000Z',
    collectedAt: '2026-11-26T18:02:10.000Z',
    originalUrl: 'https://www.hellowork.com/fr-fr/emplois/demo-4410.html',
    source: 'hellowork',
    provenance: [
      {
        source: 'hellowork',
        url: 'https://www.hellowork.com/fr-fr/emplois/demo-4410.html',
        externalId: 'hw-demo-4410',
        seenAt: '2026-11-26T18:02:10.000Z',
      },
    ],
    applicationStatus: 'saved',
    isFavorite: false,
    recruiterEmail: null,
    notes: null,
    analysis: {
      fitScore: 8,
      reasoningSummary: 'Profil produit frontend/full-stack très compatible avec la stack React/Next.js/Tailwind.',
      matchedSkills: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'GitHub Actions'],
      missingSkills: ['Storybook', 'Playwright'],
      experienceMatch: 'Expérience prouvée en refonte de tableaux de bord React.',
      educationMatch: 'Formation supérieure en informatique validée.',
      languageMatch: 'Français natif requis et présent.',
      atsKeywords: ['React', 'Next.js', 'Tailwind CSS', 'SaaS B2B', 'Product Engineer'],
      strengths: ['Gain de performance front-end chiffré (-35 %)', 'Forte culture produit'],
      weaknesses: ['Storybook non mentionné dans le Master CV'],
      recommendation: 'Candidature recommandée',
      modelUsed: 'gemini-3.5-flash-lite (démo)',
      updatedAt: '2026-11-26T18:03:00.000Z',
    },
  },
  {
    id: 'demo-job-4',
    externalId: 'indeed-demo-7782',
    dedupeHash: 'demo-hash-4',
    contentHash: 'demo-content-4',
    title: 'AI Automation Engineer (Python / TypeScript) [Offre Fictive]',
    company: 'SynapseOps France (Démo)',
    location: 'Télétravail France entière',
    contractType: 'CDI',
    salary: '55 k€ – 65 k€',
    description:
      '[OFFRE FICTIVE DE DÉMONSTRATION] Conception d’agents autonomes et d’outils d’automatisation documentaire en Python et TypeScript avec évaluation qualité et observabilité.',
    skills: ['Python', 'TypeScript', 'LLM / Gemini API', 'REST API', 'Docker'],
    publishedAt: '2026-11-25T11:00:00.000Z',
    collectedAt: '2026-11-26T18:05:00.000Z',
    originalUrl: 'https://fr.indeed.com/viewjob?jk=demo7782',
    source: 'indeed',
    provenance: [
      {
        source: 'indeed',
        url: 'https://fr.indeed.com/viewjob?jk=demo7782',
        externalId: 'indeed-demo-7782',
        seenAt: '2026-11-26T18:05:00.000Z',
      },
    ],
    applicationStatus: 'new',
    isFavorite: true,
    recruiterEmail: null,
    notes: null,
    analysis: {
      fitScore: 7,
      reasoningSummary: 'Solide adéquation IA et TypeScript ; Python principal un peu moins mis en avant que JS/TS.',
      matchedSkills: ['Python', 'TypeScript', 'LLM / Gemini API', 'REST API', 'Docker'],
      missingSkills: ['FastAPI', 'Celery'],
      experienceMatch: 'Expérience LLM pertinente ; poste davantage orienté backend Python.',
      educationMatch: 'Master IA très pertinent.',
      languageMatch: 'Anglais C1 apprécié pour l’équipe distribuée.',
      atsKeywords: ['Python', 'LLM', 'Agents IA', 'Docker', 'Observabilité'],
      strengths: ['Expérience concrète sur la validation structurée de sorties LLM'],
      weaknesses: ['FastAPI et Celery non listés dans le CV'],
      recommendation: 'Candidature pertinente en mettant en avant les projets Python',
      modelUsed: 'gemini-3.5-flash-lite (démo)',
      updatedAt: '2026-11-26T18:06:00.000Z',
    },
  },
  {
    id: 'demo-job-5',
    externalId: 'mj-demo-3109',
    dedupeHash: 'demo-hash-5',
    contentHash: 'demo-content-5',
    title: 'Ingénieur Études et Développement Web Full-Stack [Offre Fictive]',
    company: 'Kestrel Digital Services (Démo)',
    location: 'La Défense (92)',
    contractType: 'CDI',
    salary: '46 k€ – 53 k€',
    description:
      '[OFFRE FICTIVE DE DÉMONSTRATION] Accompagnement de clients grands comptes sur la modernisation d’applications web React, Node.js et PostgreSQL.',
    skills: ['React', 'Node.js', 'PostgreSQL', 'TypeScript', 'GitHub Actions'],
    publishedAt: '2026-11-24T14:30:00.000Z',
    collectedAt: '2026-11-25T18:03:00.000Z',
    originalUrl: 'https://www.meteojob.com/candidat/offres/demo-3109',
    source: 'meteojob',
    provenance: [
      {
        source: 'meteojob',
        url: 'https://www.meteojob.com/candidat/offres/demo-3109',
        externalId: 'mj-demo-3109',
        seenAt: '2026-11-25T18:03:00.000Z',
      },
    ],
    applicationStatus: 'new',
    isFavorite: false,
    recruiterEmail: null,
    notes: null,
    analysis: {
      fitScore: 6,
      reasoningSummary: 'Compétences techniques compatibles mais contexte ESN moins aligné avec la préférence produit SaaS IA.',
      matchedSkills: ['React', 'Node.js', 'PostgreSQL', 'TypeScript'],
      missingSkills: ['Java Spring Boot'],
      experienceMatch: 'Niveau d’expérience adapté.',
      educationMatch: 'Diplôme Bac+5 conforme.',
      languageMatch: 'Français natif OK.',
      atsKeywords: ['Full-Stack', 'React', 'Node.js', 'PostgreSQL'],
      strengths: ['Maîtrise complète de la stack JS/TS'],
      weaknesses: ['Mission mixte Java/React et fourchette salariale inférieure à la cible'],
      recommendation: 'À considérer en second choix',
      modelUsed: 'gemini-3.5-flash-lite (démo)',
      updatedAt: '2026-11-25T18:04:00.000Z',
    },
  },
];

export const DEMO_APPLICATIONS: DemoApplication[] = [
  {
    id: 'demo-app-1',
    jobId: 'demo-job-1',
    jobTitle: DEMO_JOBS[0].title,
    company: DEMO_JOBS[0].company,
    source: DEMO_JOBS[0].source,
    originalUrl: DEMO_JOBS[0].originalUrl,
    jobDescription: DEMO_JOBS[0].description,
    fitScore: 9,
    status: 'ready',
    coverLetter: `[EXEMPLE FICTIF — MODE DÉMONSTRATION]\n\nObjet : Candidature au poste de Senior Full-Stack AI Engineer\n\nMadame, Monsieur,\n\nVotre offre chez Helios Data Lab retient toute mon attention : vous réunissez précisément les deux axes qui structurent mon parcours — l'ingénierie produit Next.js / TypeScript / PostgreSQL et l'intégration fiable de modèles LLM en production.\n\nAu sein d'Atelier Numérique Fictif SAS, j'ai conçu et maintenu une plateforme SaaS utilisée par 18 000 utilisateurs mensuels, tout en industrialisant des pipelines d'analyse documentaire avec validation JSON stricte ayant réduit la latence de 42 %. Mon expérience antérieure sur les API OAuth2 et l'automatisation CI/CD (86 % de couverture de tests) me permettrait d'être rapidement opérationnel sur vos enjeux de fiabilité et de sécurité.\n\nJe serais ravi d'échanger avec votre équipe technique sur la façon dont je peux contribuer à vos prochains lancements produit.\n\nCordialement,\nAlex Martin (Profil Démo)`,
    presentationPage: `# Synthèse de candidature — Senior Full-Stack AI Engineer\n\n## Alignement immédiat\n- **Stack cible** : Next.js, TypeScript, React, PostgreSQL, Tailwind CSS, OAuth2\n- **IA appliquée** : Pipelines documentaires LLM structurés et validés (latence -42 %)\n- **Qualité logicielle** : CI/CD GitHub Actions, 86 % de couverture de tests\n\n## Points clés à aborder en entretien\n1. Architecture de validation structurée et protection contre les injections de prompts\n2. Scalabilité des bases PostgreSQL serverless\n3. Collaboration produit/design en cycle court`,
    cvSuggestions: [
      {
        section: 'Accroche / Titre',
        currentText: 'Ingénieur Full-Stack TypeScript & IA Appliquée',
        suggestedImprovement: 'Senior Full-Stack AI Engineer — Next.js, TypeScript, PostgreSQL & LLM',
        reason: 'Reprend les mots-clés exacts de l’offre sans ajouter de compétence fictive.',
      },
      {
        section: 'Expérience — Atelier Numérique Fictif SAS',
        currentText: 'Intégration de pipelines d’analyse documentaire via API LLM...',
        suggestedImprovement:
          'Mettre en avant la validation de schémas JSON et la sécurité des appels API côté serveur.',
        reason: 'Répond directement à l’exigence de scoring structuré et sécurité OAuth2.',
      },
    ],
    bulletRewrites: [
      {
        original:
          'Intégration de pipelines d’analyse documentaire via API LLM avec validation JSON stricte et réduction de 42 % de la latence.',
        rewritten:
          'Architecture et mise en production de pipelines LLM (validation JSON stricte, gestion quotas/retries), réduisant la latence d’analyse de 42 % sur une plateforme SaaS de 18 000 utilisateurs/mois.',
        impactNote: 'Relie l’impact technique mesuré à l’échelle produit réelle du CV.',
      },
    ],
    atsKeywords: ['Next.js', 'TypeScript', 'PostgreSQL', 'LLM', 'OAuth2', 'SaaS B2B', 'React', 'CI/CD'],
    emailSubject: 'Candidature — Senior Full-Stack AI Engineer (Next.js / TypeScript) — Alex Martin',
    emailBody: `Bonjour,\n\nJe vous adresse ma candidature pour le poste de Senior Full-Stack AI Engineer chez Helios Data Lab.\n\nFort de mon expérience en développement Next.js / TypeScript / PostgreSQL et en industrialisation de pipelines LLM structurés, je serais ravi de discuter de vos projets techniques.\n\nVous trouverez ci-joint mon CV ainsi que ma lettre de motivation personnalisée.\n\nBien cordialement,\nAlex Martin (Profil Fictif Démo)`,
    recipientEmail: null,
    gmailDraftId: null,
    gmailMessageId: null,
    modelUsed: 'gemini-3.5-flash-lite (démo)',
    sentAt: null,
    createdAt: '2026-11-26T10:15:00.000Z',
    updatedAt: '2026-11-26T10:20:00.000Z',
  },
  {
    id: 'demo-app-2',
    jobId: 'demo-job-2',
    jobTitle: DEMO_JOBS[1].title,
    company: DEMO_JOBS[1].company,
    source: DEMO_JOBS[1].source,
    originalUrl: DEMO_JOBS[1].originalUrl,
    jobDescription: DEMO_JOBS[1].description,
    fitScore: 8,
    status: 'gmail_draft',
    coverLetter: `[EXEMPLE FICTIF — MODE DÉMONSTRATION]\n\nMadame, Monsieur,\n\nSuite à votre annonce publiée sur France Travail pour le poste de Développeur Full-Stack TypeScript / Node.js chez NovaPulse Solutions, je souhaite vous proposer ma candidature.\n\nMon expérience récente sur des API REST sécurisées OAuth2, des bases PostgreSQL et des architectures Node.js/TypeScript en environnement Docker correspond pleinement aux besoins de votre équipe produit.\n\nRestant disponible pour un entretien,\nAlex Martin (Profil Démo)`,
    presentationPage: `# Synthèse — NovaPulse Solutions (Démo)\n- API REST & OAuth2 en production\n- TypeScript, Node.js, PostgreSQL, Docker`,
    cvSuggestions: [
      {
        section: 'Compétences Techniques',
        currentText: 'REST API, OAuth2, Docker',
        suggestedImprovement: 'Grouper Node.js, TypeScript, PostgreSQL, OAuth2 et Docker en tête de section.',
        reason: 'Aligne immédiatement le scan recruteur sur les 5 prérequis principaux.',
      },
    ],
    bulletRewrites: [
      {
        original: 'Développement d’API REST sécurisées OAuth2 et intégration de webhooks partenaires.',
        rewritten:
          'Conception d’API REST Node.js/TypeScript sécurisées par OAuth2 et intégration résiliente de webhooks partenaires avec gestion de quotas.',
        impactNote: 'Met en valeur la fiabilité backend sans rien inventer.',
      },
    ],
    atsKeywords: ['Node.js', 'TypeScript', 'PostgreSQL', 'OAuth2', 'Docker', 'REST API'],
    emailSubject: 'Candidature — Développeur Full-Stack TypeScript / Node.js — Alex Martin',
    emailBody: `Bonjour,\n\nJe vous transmets ma candidature pour le poste de Développeur Full-Stack TypeScript / Node.js chez NovaPulse Solutions.\n\nBien cordialement,\nAlex Martin (Profil Démo)`,
    recipientEmail: 'recrutement-demo@example.invalid',
    gmailDraftId: 'demo-draft-id-001',
    gmailMessageId: null,
    modelUsed: 'gemini-3.5-flash-lite (démo)',
    sentAt: null,
    createdAt: '2026-11-26T11:00:00.000Z',
    updatedAt: '2026-11-26T11:05:00.000Z',
  },
];

export const DEMO_AUTOMATION_RUNS: DemoAutomationRun[] = [
  {
    id: 'demo-run-1',
    triggerType: 'scheduled_18',
    sources: ['france_travail'],
    status: 'success',
    jobsFetched: 18,
    jobsNew: 4,
    jobsDuplicates: 14,
    jobsScored: 4,
    errors: [],
    startedAt: '2026-11-26T17:00:02.000Z',
    finishedAt: '2026-11-26T17:00:19.000Z',
  },
  {
    id: 'demo-run-2',
    triggerType: 'extension_sync',
    sources: ['welcome_to_the_jungle', 'indeed', 'hellowork', 'meteojob'],
    status: 'partial',
    jobsFetched: 11,
    jobsNew: 3,
    jobsDuplicates: 8,
    jobsScored: 3,
    errors: [
      {
        source: 'indeed',
        message: 'Vérification anti-bot détectée — collecte assistée recommandée (aucun contournement effectué).',
        code: 'HUMAN_ASSIST_REQUIRED',
      },
    ],
    startedAt: '2026-11-26T17:02:00.000Z',
    finishedAt: '2026-11-26T17:02:11.000Z',
  },
  {
    id: 'demo-run-3',
    triggerType: 'scheduled_09',
    sources: ['france_travail'],
    status: 'success',
    jobsFetched: 22,
    jobsNew: 6,
    jobsDuplicates: 16,
    jobsScored: 6,
    errors: [],
    startedAt: '2026-11-26T08:00:03.000Z',
    finishedAt: '2026-11-26T08:00:24.000Z',
  },
];
