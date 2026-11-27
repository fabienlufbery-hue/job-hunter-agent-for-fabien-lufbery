/* Welcome to the Jungle extractor (JSON-LD first + resilient DOM selectors) */
(function (root) {
  'use strict';

  function getCommon() {
    if (typeof module !== 'undefined' && module.exports) {
      return require('./common');
    }
    return root.JobHunterCommon;
  }

  function extractWttjJobs(doc, pageUrl) {
    const common = getCommon();
    const source = 'welcome_to_the_jungle';
    const barrier = common.detectAccessBarrier(doc);
    if (barrier.blocked) {
      return { source, jobs: [], warning: barrier.reason, humanActionRequired: true };
    }

    const jobs = [];

    // 1. JSON-LD JobPosting (detail pages)
    const ldPostings = common.extractJsonLdJobPostings(doc);
    for (const p of ldPostings) {
      const normalized = common.jobFromJsonLd(p, source, pageUrl);
      if (normalized) jobs.push(normalized);
    }

    // 2. Detail page DOM fallback
    if (jobs.length === 0 && /\/jobs\//i.test(pageUrl)) {
      const title = common.firstText(doc, [
        'h1[data-testid="job-header-title"]',
        'h2[data-testid="job-title"]',
        'main h1',
        'h1',
      ]);
      const company = common.firstText(doc, [
        '[data-testid="job-header-organization-name"]',
        'a[href*="/companies/"] span',
        'a[href*="/companies/"]',
      ]);
      const location = common.firstText(doc, [
        '[data-testid="job-metadata-location"]',
        '[data-testid="job-header-location"]',
      ]);
      const contractType = common.firstText(doc, [
        '[data-testid="job-metadata-contract-type"]',
        '[data-testid="job-header-contract-type"]',
      ]);
      const salary = common.firstText(doc, ['[data-testid="job-metadata-salary"]']);
      const description = common.firstText(doc, [
        '[data-testid="job-section-description"]',
        '[data-testid="job-description"]',
        'section[id*="description"]',
        'main article',
      ]);

      if (title) {
        const slugMatch = pageUrl.match(/\/jobs\/([^/?#]+)/i);
        jobs.push({
          externalId: slugMatch ? slugMatch[1] : null,
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

    // 3. Search listing cards DOM extraction
    const cards = Array.from(
      doc.querySelectorAll(
        'li[data-testid="search-results-list-item-wrapper"], article[data-testid="job-card"], [data-testid="jobs-search-item"]'
      )
    );
    for (const card of cards.slice(0, 40)) {
      const linkEl = card.querySelector('a[href*="/jobs/"]');
      const href = linkEl ? common.toAbsoluteUrl(linkEl.getAttribute('href'), pageUrl) : pageUrl;
      const title =
        common.firstText(card, ['h4', 'h3', 'h2', '[role="heading"]', 'a[href*="/jobs/"]']) || '';
      const company = common.firstText(card, [
        '[data-testid="job-card-company-name"]',
        'span[class*="company"]',
        'header span',
      ]);
      const location = common.firstText(card, [
        '[data-testid="job-card-location"]',
        '[data-icon-name="location"] + span',
      ]);
      const contractType = common.firstText(card, [
        '[data-testid="job-card-contract-type"]',
        '[data-icon-name="contract"] + span',
      ]);
      const salary = common.firstText(card, ['[data-testid="job-card-salary"]']);

      if (title) {
        const slugMatch = href.match(/\/jobs\/([^/?#]+)/i);
        jobs.push({
          externalId: slugMatch ? slugMatch[1] : null,
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
          ? 'Aucune offre détectée sur cette page Welcome to the Jungle. Ouvrez une page de résultats ou une fiche de poste.'
          : null,
      humanActionRequired: false,
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { extractWttjJobs };
  } else {
    root.JobHunterExtractors = root.JobHunterExtractors || {};
    root.JobHunterExtractors.welcome_to_the_jungle = extractWttjJobs;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
