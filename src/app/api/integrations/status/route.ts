import { NextResponse } from 'next/server';
import { requireSessionOrDemo } from '@/lib/auth';
import { getAllIntegrationsStatus } from '@/lib/integrations/status';
import {
  ACADEMIC_ORIGINAL_MODEL,
  DEFAULT_GEMINI_MODEL,
  GEMINI_MODEL_DEPRECATION_NOTE,
  getGeminiModel,
} from '@/lib/gemini/client';
import { SCORING_RUBRIC_DOC } from '@/lib/gemini/scoring';
import { FRANCE_TRAVAIL_APP_NAME } from '@/lib/france-travail/client';

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
      geminiModelAcademicOriginal: ACADEMIC_ORIGINAL_MODEL,
      geminiDeprecationNote: GEMINI_MODEL_DEPRECATION_NOTE,
      scoringRubric: SCORING_RUBRIC_DOC,
      franceTravailAppName: FRANCE_TRAVAIL_APP_NAME,
    },
  });
}
