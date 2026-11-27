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
  notes: string | null;
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
  costUsd: number;
  apifyRunIds: string[];
  summary: string;
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
    'Profil de démonstration entièrement fictif permettant d’explorer l’interface Job Hunter Agent for Fabien Lufbery sans accéder aux données personnelles de Fabien Lufbery.',
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
        'Intégration de pipelines d’analyse documentaire via API Gemini avec validation JSON stricte et réduction de 42 % de la latence.',
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
        'Développement d’API REST sécurisées et orchestration de collectes de données asynchrones.',
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
    'Docker',
    'GitHub Actions',
    'Google Gemini API',
    'Apify API',
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
  links: [{ label: 'Portfolio Démo', url: 'https://example.com/alex-martin-demo' }],
  rawText:
    '[DONNÉES FICTIVES DE DÉMONSTRATION]\nAlex Martin — Ingénieur Full-Stack TypeScript & IA Appliquée — Paris\nExpériences : Atelier Numérique Fictif SAS (2023-Présent), CloudBridge Demo Labs (2022-2023)...',
  contentHash: 'demo-cv-hash-v2',
  uploadedAt: '2026-11-20T09:00:00.000Z',
  updatedAt: '2026-11-26T17:30:00.000Z',
};

export const DEMO_PREFERENCES: DemoPreferences = {
  id: 'demo-prefs',
  targetRoles: ['Ingénieur Full-Stack TypeScript', 'AI Product Engineer', 'Développeur Next.js Senior'],
  sectors: ['SaaS B2B', 'Intelligence Artificielle', 'FinTech'],
  cities: ['Paris', 'Lyon', 'Remote France'],
  departmentCodes: [],
  communeCodes: [],
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
      '[OFFRE FICTIVE DE DÉMONSTRATION — Collecte Apify] Helios Data Lab recherche un(e) Senior Full-Stack AI Engineer pour concevoir nos assistants métier basés sur Next.js, TypeScript, PostgreSQL et Google Gemini. Vous piloterez l’architecture API, les pipelines de scoring structuré et les interfaces React modernes.',
    skills: ['TypeScript', 'Next.js', 'React', 'PostgreSQL', 'Google Gemini API', 'Tailwind CSS'],
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
    notes: 'Dédupliquée automatiquement entre Welcome to the Jungle et Indeed via Apify.',
    analysis: {
      fitScore: 9,
      reasoningSummary:
        'Adéquation exceptionnelle : maîtrise directe de Next.js, TypeScript, PostgreSQL et pipelines Gemini sur un poste CDI hybride à Paris aligné avec vos préférences.',
      matchedSkills: ['TypeScript', 'Next.js', 'React', 'PostgreSQL', 'Google Gemini API', 'Tailwind CSS'],
      missingSkills: ['Kubernetes'],
      experienceMatch: 'Forte correspondance : 3+ ans en SaaS B2B TypeScript et intégration LLM en production.',
      educationMatch: 'Master Informatique IA & Systèmes Distribués parfaitement aligné.',
      languageMatch: 'Français natif + Anglais C1 conformes aux attentes.',
      atsKeywords: ['Next.js', 'TypeScript', 'PostgreSQL', 'Gemini', 'SaaS B2B', 'CI/CD'],
      strengths: [
        'Expérience démontrée sur des pipelines documentaires LLM avec validation JSON',
        'Stack Next.js + PostgreSQL identique à l’offre',
        'Alignement complet avec la préférence CDI Hybride Paris',
      ],
      weaknesses: ['Pas de mention Kubernetes en production sur le CV'],
      recommendation: 'Candidature fortement recommandée (priorité haute)',
      modelUsed: 'gemini-3.5-flash-lite (démo)',
      updatedAt: '2026-11-26T09:03:00.000Z',
    },
  },
  {
    id: 'demo-job-2',
    externalId: 'li-demo-4012',
    dedupeHash: 'demo-hash-2',
    contentHash: 'demo-content-2',
    title: 'AI Product Engineer — TypeScript / Node.js & Cloud [Offre Fictive]',
    company: 'NovaPulse Solutions (Démo)',
    location: 'Paris (75008) — Hybride',
    contractType: 'CDI',
    salary: '54 k€ – 62 k€',
    description:
      '[OFFRE FICTIVE DE DÉMONSTRATION — Source LinkedIn via Apify] Rejoignez notre équipe produit pour concevoir des workflows IA asynchrones Node.js/TypeScript, industrialiser nos connecteurs API et maintenir nos bases PostgreSQL.',
    skills: ['TypeScript', 'Node.js', 'PostgreSQL', 'REST API', 'Docker'],
    publishedAt: '2026-11-26T07:45:00.000Z',
    collectedAt: '2026-11-26T09:00:14.000Z',
    originalUrl: 'https://www.linkedin.com/jobs/view/demo-4012',
    source: 'linkedin',
    provenance: [
      {
        source: 'linkedin',
        url: 'https://www.linkedin.com/jobs/view/demo-4012',
        externalId: 'li-demo-4012',
        seenAt: '2026-11-26T09:00:14.000Z',
      },
    ],
    applicationStatus: 'applied',
    isFavorite: true,
    recruiterEmail: null,
    notes: 'Collectée automatiquement via Apify LinkedIn Scraper.',
    analysis: {
      fitScore: 8,
      reasoningSummary:
        'Très bonne adéquation backend TypeScript, pipelines asynchrones et PostgreSQL, en phase avec vos métiers cibles.',
      matchedSkills: ['TypeScript', 'Node.js', 'PostgreSQL', 'REST API', 'Docker'],
      missingSkills: ['GraphQL'],
      experienceMatch: 'Expérience SaaS & workflows asynchrones directement transférable.',
      educationMatch: 'Master Informatique conforme.',
      languageMatch: 'Français et Anglais adaptés.',
      atsKeywords: ['Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'API REST'],
      strengths: ['Expérience API asynchrone déjà éprouvée', 'Maîtrise PostgreSQL et Docker'],
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
      '[OFFRE FICTIVE DE DÉMONSTRATION — Source HelloWork via Apify] Au sein d’une équipe produit de 12 personnes, vous développez des tableaux de bord analytiques React/Next.js/Tailwind CSS et collaborez étroitement avec les designers.',
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
      '[OFFRE FICTIVE DE DÉMONSTRATION — Source Indeed via Apify] Conception d’agents autonomes et d’outils d’automatisation documentaire en Python et TypeScript avec évaluation qualité et observabilité.',
    skills: ['Python', 'TypeScript', 'Google Gemini API', 'REST API', 'Docker'],
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
      matchedSkills: ['Python', 'TypeScript', 'Google Gemini API', 'REST API', 'Docker'],
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
      '[OFFRE FICTIVE DE DÉMONSTRATION — Source Meteojob via Apify] Accompagnement de clients grands comptes sur la modernisation d’applications web React, Node.js et PostgreSQL.',
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
    coverLetter: `[EXEMPLE FICTIF — MODE DÉMONSTRATION]\n\nObjet : Candidature au poste de Senior Full-Stack AI Engineer\n\nMadame, Monsieur,\n\nVotre offre chez Helios Data Lab retient toute mon attention : vous réunissez précisément les deux axes qui structurent mon parcours — l'ingénierie produit Next.js / TypeScript / PostgreSQL et l'intégration fiable de modèles Gemini en production.\n\nAu sein d'Atelier Numérique Fictif SAS, j'ai conçu et maintenu une plateforme SaaS utilisée par 18 000 utilisateurs mensuels, tout en industrialisant des pipelines d'analyse documentaire avec validation JSON stricte ayant réduit la latence de 42 %. Mon expérience en automatisation CI/CD (86 % de couverture de tests) me permettrait d'être rapidement opérationnel sur vos enjeux de fiabilité.\n\nJe serais ravi d'échanger avec votre équipe technique sur la façon dont je peux contribuer à vos prochains lancements produit.\n\nCordialement,\nAlex Martin (Profil Démo)`,
    presentationPage: `# Synthèse de candidature — Senior Full-Stack AI Engineer\n\n## Alignement immédiat\n- **Stack cible** : Next.js, TypeScript, React, PostgreSQL, Tailwind CSS\n- **IA appliquée** : Pipelines documentaires Gemini structurés et validés (latence -42 %)\n- **Qualité logicielle** : CI/CD GitHub Actions, 86 % de couverture de tests\n\n## Points clés à aborder en entretien\n1. Architecture de validation structurée et protection contre les injections de prompts\n2. Scalabilité des bases PostgreSQL serverless (Neon)\n3. Collaboration produit/design en cycle court`,
    cvSuggestions: [
      {
        section: 'Accroche / Titre',
        currentText: 'Ingénieur Full-Stack TypeScript & IA Appliquée',
        suggestedImprovement: 'Senior Full-Stack AI Engineer — Next.js, TypeScript, PostgreSQL & Gemini',
        reason: 'Reprend les mots-clés exacts de l’offre sans ajouter de compétence fictive.',
      },
      {
        section: 'Expérience — Atelier Numérique Fictif SAS',
        currentText: 'Intégration de pipelines d’analyse documentaire via API Gemini...',
        suggestedImprovement:
          'Mettre en avant la validation de schémas JSON et la sécurité des appels API côté serveur.',
        reason: 'Répond directement à l’exigence de scoring structuré et fiabilité API.',
      },
    ],
    bulletRewrites: [
      {
        original:
          'Intégration de pipelines d’analyse documentaire via API Gemini avec validation JSON stricte et réduction de 42 % de la latence.',
        rewritten:
          'Architecture et mise en production de pipelines Gemini (validation JSON stricte, gestion quotas/retries), réduisant la latence d’analyse de 42 % sur une plateforme SaaS de 18 000 utilisateurs/mois.',
        impactNote: 'Relie l’impact technique mesuré à l’échelle produit réelle du CV.',
      },
    ],
    atsKeywords: ['Next.js', 'TypeScript', 'PostgreSQL', 'Gemini', 'SaaS B2B', 'React', 'CI/CD'],
    emailSubject: 'Candidature — Senior Full-Stack AI Engineer (Next.js / TypeScript) — Alex Martin',
    emailBody: `Bonjour,\n\nJe vous adresse ma candidature pour le poste de Senior Full-Stack AI Engineer chez Helios Data Lab.\n\nFort de mon expérience en développement Next.js / TypeScript / PostgreSQL et en industrialisation de pipelines IA structurés, je serais ravi de discuter de vos projets techniques.\n\nVous trouverez ci-joint mon CV ainsi que ma lettre de motivation personnalisée.\n\nBien cordialement,\nAlex Martin (Profil Fictif Démo)`,
    recipientEmail: null,
    notes: 'Relance prévue J+5 si pas de réponse.',
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
    status: 'applied',
    coverLetter: `[EXEMPLE FICTIF — MODE DÉMONSTRATION]\n\nMadame, Monsieur,\n\nSuite à votre annonce sur LinkedIn pour le poste d'AI Product Engineer chez NovaPulse Solutions, je souhaite vous proposer ma candidature.\n\nMon expérience récente sur les architectures Node.js/TypeScript, l'orchestration de pipelines asynchrones et PostgreSQL en environnement Docker correspond pleinement aux besoins de votre équipe produit.\n\nRestant disponible pour un entretien,\nAlex Martin (Profil Démo)`,
    presentationPage: `# Synthèse — NovaPulse Solutions (Démo)\n- Workflows IA asynchrones en production\n- TypeScript, Node.js, PostgreSQL, Docker`,
    cvSuggestions: [
      {
        section: 'Compétences Techniques',
        currentText: 'REST API, Docker',
        suggestedImprovement: 'Grouper Node.js, TypeScript, PostgreSQL, API REST et Docker en tête de section.',
        reason: 'Aligne immédiatement le scan recruteur sur les 5 prérequis principaux.',
      },
    ],
    bulletRewrites: [
      {
        original: 'Développement d’API REST sécurisées et orchestration de collectes de données asynchrones.',
        rewritten:
          'Conception d’API REST Node.js/TypeScript et orchestration résiliente de pipelines asynchrones avec gestion de quotas.',
        impactNote: 'Met en valeur la fiabilité backend sans rien inventer.',
      },
    ],
    atsKeywords: ['Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'REST API'],
    emailSubject: 'Candidature — AI Product Engineer (TypeScript / Node.js) — Alex Martin',
    emailBody: `Bonjour,\n\nJe vous transmets ma candidature pour le poste d'AI Product Engineer chez NovaPulse Solutions.\n\nBien cordialement,\nAlex Martin (Profil Démo)`,
    recipientEmail: null,
    notes: 'Envoyée manuellement sur le portail LinkedIn le 26 nov.',
    modelUsed: 'gemini-3.5-flash-lite (démo)',
    sentAt: '2026-11-26T11:30:00.000Z',
    createdAt: '2026-11-26T11:00:00.000Z',
    updatedAt: '2026-11-26T11:30:00.000Z',
  },
];

export const DEMO_AUTOMATION_RUNS: DemoAutomationRun[] = [
  {
    id: 'demo-run-1',
    triggerType: 'scheduled_18',
    sources: ['welcome_to_the_jungle', 'indeed', 'linkedin'],
    status: 'success',
    jobsFetched: 24,
    jobsNew: 5,
    jobsDuplicates: 19,
    jobsScored: 5,
    costUsd: 0.042,
    apifyRunIds: ['demo-apify-run-1800'],
    summary: '24 récupérées, 5 nouvelles, 19 doublons, 5 notées IA.',
    errors: [],
    startedAt: '2026-11-26T17:00:02.000Z',
    finishedAt: '2026-11-26T17:00:41.000Z',
  },
  {
    id: 'demo-run-2',
    triggerType: 'scheduled_09',
    sources: ['hellowork', 'meteojob'],
    status: 'success',
    jobsFetched: 18,
    jobsNew: 4,
    jobsDuplicates: 14,
    jobsScored: 4,
    costUsd: 0.031,
    apifyRunIds: ['demo-apify-run-0900'],
    summary: '18 récupérées, 4 nouvelles, 14 doublons, 4 notées IA.',
    errors: [],
    startedAt: '2026-11-26T08:00:03.000Z',
    finishedAt: '2026-11-26T08:00:36.000Z',
  },
];

export const DEMO_APIFY_SOURCES = [
  {
    id: 'demo-src-1',
    name: 'Indeed France — Full-Stack & IA (Démo)',
    kind: 'actor' as const,
    apifyId: 'curious_coder/indeed-scraper',
    platform: 'indeed' as const,
    executionMode: 'run_and_fetch' as const,
    enabled: true,
    maxItems: 30,
    maxCostUsd: 0.4,
    timeoutSecs: 120,
    memoryMbytes: 512,
    inputTemplate: {},
    lastDatasetId: 'demo-ds-1',
    lastRunAt: '2026-11-26T17:00:41.000Z',
    lastStatus: 'SUCCEEDED',
  },
  {
    id: 'demo-src-2',
    name: 'Welcome to the Jungle — SaaS Paris (Démo)',
    kind: 'actor' as const,
    apifyId: 'bebity/welcome-to-the-jungle-jobs-scraper',
    platform: 'welcome_to_the_jungle' as const,
    executionMode: 'run_and_fetch' as const,
    enabled: true,
    maxItems: 25,
    maxCostUsd: 0.35,
    timeoutSecs: 120,
    memoryMbytes: 512,
    inputTemplate: {},
    lastDatasetId: 'demo-ds-2',
    lastRunAt: '2026-11-26T17:00:41.000Z',
    lastStatus: 'SUCCEEDED',
  },
];
