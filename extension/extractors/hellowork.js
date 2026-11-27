/* HelloWork extractor (JSON-LD first + resilient DOM selectors) */
(function (root) {
  'use strict';

  function getCommon() {
    if (typeof module !== 'undefined' && module.exports) {
      return require('./common');
    }
    return root.JobHunterCommon;
  }

  function extractHelloWorkJobs(doc, pageUrl) {
    const common = getCommon();
    const source = 'hellowork';
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

    // 2. Detail page DOM fallback
    if (jobs.length === 0 && /\/emplois\/\d+/i.test(pageUrl)) {
      const title = common.firstText(doc, ['h1[data-cy="jobTitle"]', 'main h1', 'h1']);
      const company = common.firstText(doc, [
        '[data-cy="companyName"]',
        'a[href*="/entreprises/"]',
      ]);
      const location = common.firstText(doc, ['[data-cy="localisationCard"]', '[data-cy="jobLocation"]']);
      const contractType = common.firstText(doc, ['[data-cy="contractCard"]', '[data-cy="contractType"]']);
      const salary = common.firstText(doc, ['[data-cy="salaryCard"]', '[data-cy="salary"]']);
      const description = common.firstText(doc, [
        '[data-cy="jobDescription"]',
        'section[data-cy="offer-description"]',
        'main article',
      ]);

      if (title) {
        const idMatch = pageUrl.match(/\/emplois\/(\d+)/i);
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

    // 3. Listing cards
    const cards = Array.from(
      doc.querySelectorAll('li[data-id-storage-target="item"], [data-cy="serpCard"], article[data-offer-id]')
    );
    for (const card of cards.slice(0, 40)) {
      const linkEl = card.querySelector('a[data-cy="offerTitle"], a[href*="/emplois/"]');
      const href = linkEl ? common.toAbsoluteUrl(linkEl.getAttribute('href'), pageUrl) : pageUrl;
      const title = common.firstText(card, ['[data-cy="offerTitle"]', 'h3', 'h2', 'a[href*="/emplois/"]']);
      const company = common.firstText(card, ['[data-cy="companyName"]', 'p.tw-typo-s']);
      const location = common.firstText(card, ['[data-cy="localisationCard"]']);
      const contractType = common.firstText(card, ['[data-cy="contractCard"]']);
      const salary = common.firstText(card, ['[data-cy="salaryCard"]']);
      const idMatch = href.match(/\/emplois\/(\d+)/i);

      if (title) {
        jobs.push({
          externalId: card.getAttribute('data-offer-id') || (idMatch ? idMatch[1] : null),
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
          ? 'Aucune offre détectée sur cette page HelloWork. Ouvrez une recherche ou une annonce HelloWork.'
          : null,
      humanActionRequired: false,
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { extractHelloWorkJobs };
  } else {
    root.JobHunterExtractors = root.JobHunterExtractors || {};
    root.JobHunterExtractors.hellowork = extractHelloWorkJobs;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
