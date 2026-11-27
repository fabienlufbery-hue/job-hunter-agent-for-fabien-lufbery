/* Meteojob extractor (JSON-LD first + resilient DOM selectors) */
(function (root) {
  'use strict';

  function getCommon() {
    if (typeof module !== 'undefined' && module.exports) {
      return require('./common');
    }
    return root.JobHunterCommon;
  }

  function extractMeteojobJobs(doc, pageUrl) {
    const common = getCommon();
    const source = 'meteojob';
    const barrier = common.detectAccessBarrier(doc);
    if (barrier.blocked) {
      return { source, jobs: [], warning: barrier.reason, humanActionRequired: true };
    }

    const jobs = [];

    // 1. JSON-LD JobPosting
    for (const p of common.extractJsonLdJobPostings(doc)) {
      const normalized = common.jobFromJsonLd(p, source, pageUrl);
      if (normalized) jobs.push(normalized);
    }

    // 2. Detail page fallback
    if (jobs.length === 0 && /\/offres\//i.test(pageUrl)) {
      const title = common.firstText(doc, ['h1.cc-offer-title', '[data-testid="offer-title"]', 'main h1', 'h1']);
      const company = common.firstText(doc, [
        '.cc-offer-company-name',
        '[data-testid="offer-company"]',
        'a[href*="/entreprise/"]',
      ]);
      const location = common.firstText(doc, ['.cc-offer-location', '[data-testid="offer-location"]']);
      const contractType = common.firstText(doc, [
        '.cc-offer-contract-type',
        '[data-testid="offer-contract"]',
      ]);
      const salary = common.firstText(doc, ['.cc-offer-salary', '[data-testid="offer-salary"]']);
      const description = common.firstText(doc, [
        '.cc-offer-description',
        '[data-testid="offer-description"]',
        'main article',
      ]);

      if (title) {
        const idMatch = pageUrl.match(/offres\/([^/?#]+)/i);
        jobs.push({
          externalId: idMatch ? idMatch[1] : null,
          title,
          company: company || null,
          location: location || null,
          contractType: contractType || null,
          salary: salary || null,
          description: description || '',
          skills: [],
          publishedAt: null,
          originalUrl: pageUrl,
          source,
        });
      }
    }

    // 3. Search results cards
    const cards = Array.from(
      doc.querySelectorAll('article.cc-job-offer-item, li[data-testid="job-offer-item"], .job-offer-card')
    );
    for (const card of cards.slice(0, 40)) {
      const linkEl = card.querySelector('a[href*="/offres/"], h2 a, h3 a');
      const href = linkEl ? common.toAbsoluteUrl(linkEl.getAttribute('href'), pageUrl) : pageUrl;
      const title = common.firstText(card, ['h2', 'h3', '.cc-job-offer-title', 'a[href*="/offres/"]']);
      const company = common.firstText(card, ['.cc-job-offer-company', '[data-testid="offer-company"]']);
      const location = common.firstText(card, ['.cc-job-offer-location', '[data-testid="offer-location"]']);
      const contractType = common.firstText(card, ['.cc-job-offer-contract', '[data-testid="offer-contract"]']);
      const salary = common.firstText(card, ['.cc-job-offer-salary', '[data-testid="offer-salary"]']);
      const idMatch = href.match(/offres\/([^/?#]+)/i);

      if (title) {
        jobs.push({
          externalId: idMatch ? idMatch[1] : null,
          title,
          company: company || null,
          location: location || null,
          contractType: contractType || null,
          salary: salary || null,
          description: common.cleanText(card.textContent).slice(0, 1200),
          skills: [],
          publishedAt: null,
          originalUrl: href,
          source,
        });
      }
    }

    const deduped = common.dedupeExtracted(jobs);
    return {
      source,
      jobs: deduped,
      warning:
        deduped.length === 0
          ? 'Aucune offre détectée sur cette page Meteojob. Ouvrez une liste de résultats ou une annonce Meteojob.'
          : null,
      humanActionRequired: false,
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { extractMeteojobJobs };
  } else {
    root.JobHunterExtractors = root.JobHunterExtractors || {};
    root.JobHunterExtractors.meteojob = extractMeteojobJobs;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
