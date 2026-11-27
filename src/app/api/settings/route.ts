import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwnerSession, requireSessionOrDemo } from '@/lib/auth';
import {
  DEFAULT_APP_SETTINGS,
  getAppSettings,
  getMonthlyApifySpendUsd,
  upsertAppSettings,
} from '@/lib/apify/repository';

const updateSettingsSchema = z.object({
  monthlyApifyBudgetUsd: z.number().min(0.1).max(200).optional(),
  maxCostPerRunUsd: z.number().min(0.05).max(20).optional(),
  maxItemsPerSource: z.number().int().min(1).max(200).optional(),
  runTimeoutSecs: z.number().int().min(30).max(600).optional(),
  maxGeminiScoresPerRun: z.number().int().min(1).max(50).optional(),
  autoScoreOnSync: z.boolean().optional(),
  minCooldownMinutes: z.number().int().min(0).max(120).optional(),
});

export async function GET() {
  const auth = await requireSessionOrDemo();
  if (!auth.ok) return auth.response;

  if (auth.isDemo) {
    return NextResponse.json({
      isDemo: true,
      settings: DEFAULT_APP_SETTINGS,
      monthlySpendUsd: 0.073,
    });
  }

  try {
    const [settings, monthlySpendUsd] = await Promise.all([
      getAppSettings(),
      getMonthlyApifySpendUsd(),
    ]);
    return NextResponse.json({
      isDemo: false,
      settings,
      monthlySpendUsd: Number(monthlySpendUsd.toFixed(4)),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur lecture paramètres' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const parsed = updateSettingsSchema.parse(body);
    const saved = await upsertAppSettings(parsed);
    const monthlySpendUsd = await getMonthlyApifySpendUsd();
    return NextResponse.json({
      ok: true,
      settings: saved,
      monthlySpendUsd: Number(monthlySpendUsd.toFixed(4)),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof z.ZodError
            ? err.issues[0]?.message
            : err instanceof Error
              ? err.message
              : 'Erreur sauvegarde paramètres',
      },
      { status: err instanceof z.ZodError ? 400 : 500 }
    );
  }
}
