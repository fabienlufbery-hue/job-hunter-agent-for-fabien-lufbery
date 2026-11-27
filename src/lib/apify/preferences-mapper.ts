import type { ActiveJobSource, ApifySourceKind } from '@/db/schema';

/**
 * Strictly non-personal search preferences passed to Apify Actors/Tasks.
 * NEVER includes candidate name, email, phone, CV text, or private identifiers.
 */
export interface NonPersonalSearchCriteria {
  targetRoles: string[];
  keywords: string[];
  cities: string[];
  sectors: string[];
  contractTypes: string[];
  remotePolicy: string;
  maxItems: number;
}

export interface VerifiedActorCatalogEntry {
  apifyId: string;
  name: string;
  platform: ActiveJobSource;
  description: string;
  notes: string;
}

/**
 * Real Apify Store Actor identifiers verified from apify.com/store (Nov 2026).
 * Users can select any of these OR use their own saved Apify Tasks (auto-discovered via API).
 */
export const VERIFIED_APIFY_ACTOR_CATALOG: VerifiedActorCatalogEntry[] = [
  {
    apifyId: 'curious_coder/indeed-scraper',
    name: 'Indeed Jobs Scraper',
    platform: 'indeed',
    description: 'Collecte des offres publiques Indeed France selon poste, ville et nombre max.',
    notes: 'Vérifiez votre quota Apify et respectez les conditions d’utilisation.',
  },
  {
    apifyId: 'curious_coder/linkedin-jobs-scraper',
    name: 'LinkedIn Jobs Scraper',
    platform: 'linkedin',
    description: 'Collecte des offres publiques LinkedIn Jobs par mots-clés et localisation.',
    notes: 'Sources publiques uniquement — ne jamais fournir d’identifiants de session.',
  },
  {
    apifyId: 'bebity/welcome-to-the-jungle-jobs-scraper',
    name: 'Welcome to the Jungle Jobs Scraper',
    platform: 'welcome_to_the_jungle',
    description: 'Collecte des offres Welcome to the Jungle (France / Europe).',
    notes: 'Conserve les liens directs /companies/.../jobs/...',
  },
  {
    apifyId: 'sbzh/hellowork-jobs-scraper',
    name: 'HelloWork Jobs Scraper',
    platform: 'hellowork',
    description: 'Collecte des annonces HelloWork selon métier, contrat et ville.',
    notes: 'Normalisation automatique contrat et localisation.',
  },
  {
    apifyId: 'stealth_mode/meteojob-jobs-search-scraper',
    name: 'Meteojob Jobs Search Scraper',
    platform: 'meteojob',
    description: 'Collecte des annonces Meteojob par mots-clés et localisation.',
    notes: 'Compatible avec la déduplication multi-sources.',
  },
];

function interpolateTemplateValue(
  value: unknown,
  vars: Record<string, string | number>
): unknown {
  if (typeof value === 'string') {
    if (value === '{{maxItems}}') return vars.maxItems;
    return value.replace(/\{\{(query|location|contract|sector|remote|maxItems)\}\}/g, (_m, k) =>
      String(vars[k] ?? '')
    );
  }
  if (Array.isArray(value)) {
    return value.map((v) => interpolateTemplateValue(v, vars));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = interpolateTemplateValue(v, vars);
    }
    return out;
  }
  return value;
}

/**
 * Builds a clean, PII-free Apify run input JSON derived strictly from search preferences
 * and optional source inputTemplate overrides.
 */
export function buildApifyRunInput(params: {
  kind: ApifySourceKind;
  platform: ActiveJobSource;
  preferences: NonPersonalSearchCriteria;
  inputTemplate?: Record<string, unknown> | null;
}): Record<string, unknown> {
  const { kind, platform, preferences, inputTemplate } = params;
  const maxItems = Math.max(1, Math.min(200, Math.floor(preferences.maxItems || 30)));
  const primaryQuery =
    [...preferences.targetRoles, ...preferences.keywords]
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(' ') || 'développeur';
  const primaryLocation = preferences.cities[0]?.trim() || 'France';
  const primaryContract = preferences.contractTypes[0]?.trim() || '';
  const primarySector = preferences.sectors[0]?.trim() || '';

  const templateVars: Record<string, string | number> = {
    query: primaryQuery,
    location: primaryLocation,
    contract: primaryContract,
    sector: primarySector,
    remote: preferences.remotePolicy || 'any',
    maxItems,
  };

  // For saved Apify Tasks: preserve the user's saved Apify Console input by default,
  // applying only explicit template overrides when provided.
  if (kind === 'task') {
    if (!inputTemplate || Object.keys(inputTemplate).length === 0) {
      return {};
    }
    return interpolateTemplateValue(inputTemplate, templateVars) as Record<string, unknown>;
  }

  // For Apify Store Actors: generate platform-aligned search parameters (zero PII)
  let baseInput: Record<string, unknown>;
  switch (platform) {
    case 'indeed':
      baseInput = {
        country: 'FR',
        position: primaryQuery,
        location: primaryLocation,
        maxItems,
        parseCompanyDetails: false,
      };
      break;
    case 'linkedin':
      baseInput = {
        title: primaryQuery,
        location: primaryLocation,
        rows: maxItems,
        maxItems,
      };
      break;
    case 'welcome_to_the_jungle':
      baseInput = {
        query: primaryQuery,
        location: primaryLocation,
        contractType: primaryContract || undefined,
        maxItems,
      };
      break;
    case 'hellowork':
    case 'meteojob':
      baseInput = {
        search: primaryQuery,
        location: primaryLocation,
        contractType: primaryContract || undefined,
        maxItems,
      };
      break;
    default:
      baseInput = {
        query: primaryQuery,
        location: primaryLocation,
        maxItems,
      };
  }

  // Strip undefined keys cleanly
  const cleanedBase: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(baseInput)) {
    if (v !== undefined && v !== '') cleanedBase[k] = v;
  }

  if (inputTemplate && Object.keys(inputTemplate).length > 0) {
    const interpolated = interpolateTemplateValue(inputTemplate, templateVars) as Record<
      string,
      unknown
    >;
    return { ...cleanedBase, ...interpolated };
  }

  return cleanedBase;
}
