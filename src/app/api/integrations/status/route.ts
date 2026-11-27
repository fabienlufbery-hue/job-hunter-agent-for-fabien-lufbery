import { NextResponse } from 'next/server';
import { requireSessionOrDemo } from '@/lib/auth';
import { getAllIntegrationsStatus } from '@/lib/integrations/status';
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_MODEL_INFO_NOTE,
  RECOMMENDED_GEMINI_MODELS,
  getGeminiModel,
} from '@/lib/gemini/client';
import { SCORING_RUBRIC_DOC } from '@/lib/gemini/scoring';
import { VERIFIED_APIFY_ACTOR_CATALOG } from '@/lib/apify/preferences-mapper';

export async function GET() {
  const auth = await requireSessionOrDemo();
  if (!auth.ok) return auth.response;

  const integrations = await getAllIntegrationsStatus({ isDemo: auth.isDemo });
  return NextResponse.json({
    isDemo: auth.isDemo,
    integrations,
    metadata: {
      geminiModelActive: getGeminiModel(),
      geminiModelDefault: DEFAULT_GEMINI_MODEL,
      geminiModelInfoNote: GEMINI_MODEL_INFO_NOTE,
      recommendedGeminiModels: RECOMMENDED_GEMINI_MODELS,
      scoringRubric: SCORING_RUBRIC_DOC,
      apifyActorCatalog: VERIFIED_APIFY_ACTOR_CATALOG,
    },
  });
}
