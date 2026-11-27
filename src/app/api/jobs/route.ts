import { NextResponse } from 'next/server';
import { requireSessionOrDemo } from '@/lib/auth';
import { DEMO_JOBS } from '@/lib/demo/data';
import { listJobsWithAnalyses } from '@/lib/jobs/repository';

export async function GET(request: Request) {
  const auth = await requireSessionOrDemo();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').trim().toLowerCase();
  const source = (searchParams.get('source') || '').trim();
  const location = (searchParams.get('location') || '').trim().toLowerCase();
  const contract = (searchParams.get('contract') || '').trim().toLowerCase();
  const minScore = Number.parseInt(searchParams.get('minScore') || '0', 10) || 0;
  const favoritesOnly = searchParams.get('favorites') === 'true';
  const sortBy = searchParams.get('sort') || 'score';

  try {
    let items = auth.isDemo ? [...DEMO_JOBS] : await listJobsWithAnalyses();

    if (query) {
      items = items.filter(
        (j) =>
          j.title.toLowerCase().includes(query) ||
          (j.company || '').toLowerCase().includes(query) ||
          j.description.toLowerCase().includes(query) ||
          j.skills.some((s) => s.toLowerCase().includes(query))
      );
    }

    if (source && source !== 'all') {
      items = items.filter((j) => j.source === source);
    }

    if (location) {
      items = items.filter((j) => (j.location || '').toLowerCase().includes(location));
    }

    if (contract && contract !== 'all') {
      items = items.filter((j) => (j.contractType || '').toLowerCase().includes(contract));
    }

    if (minScore > 0) {
      items = items.filter((j) => (j.analysis?.fitScore ?? 0) >= minScore);
    }

    if (favoritesOnly) {
      items = items.filter((j) => j.isFavorite);
    }

    if (sortBy === 'date') {
      items.sort(
        (a, b) =>
          new Date(b.publishedAt || b.collectedAt).getTime() -
          new Date(a.publishedAt || a.collectedAt).getTime()
      );
    } else {
      items.sort((a, b) => {
        const scoreDiff = (b.analysis?.fitScore ?? -1) - (a.analysis?.fitScore ?? -1);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime();
      });
    }

    return NextResponse.json({
      isDemo: auth.isDemo,
      total: items.length,
      jobs: items,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur chargement des offres' },
      { status: 500 }
    );
  }
}
