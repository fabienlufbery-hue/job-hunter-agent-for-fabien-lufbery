/* Indeed extractor (JSON-LD first + resilient DOM selectors + strict anti-bot respect) */
(function (root) {
  'use strict';

  function getCommon() {
    if (typeof module !== 'undefined' && module.exports) {
      return require('./common');
    }
    return root.JobHunterCommon;
  }

  function extractIndeedJobs(doc, pageUrl) {
    const common = getCommon();
    const source = 'indeed';
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

    // 2. Currently selected / detail job view
    const detailTitle = common.firstText(doc, [
      'h1.jobsearch-JobInfoHeader-title',
      'h2.jobsearch-JobInfoHeader-title',
      '[data-testid="jobsearch-JobInfoHeader-title"]',
    ]);
    if (detailTitle) {
      const company = common.firstText(doc, [
        '[data-testid="inlineHeader-companyName"]',
        '[data-company-name="true"]',
        '.jobsearch-CompanyInfoContainer a',
      ]);
      const location = common.firstText(doc, [
        '[data-testid="inlineHeader-companyLocation"]',
        '[data-testid="job-location"]',
      ]);
      const salary = common.firstText(doc, [
        '#salaryInfoAndJobType span',
        '[data-testid="attribute_snippet_testid"]',
      ]);
      const description = common.firstText(doc, ['#jobDescriptionText', '.jobsearch-jobDescriptionText']);
      const jkMatch = pageUrl.match(/[?&](?:vjk|jk)=([a-zA-Z0-9_-]+)/);

      jobs.push({
        externalId: jkMatch ? jkMatch[1] : null,
        title: detailTitle.replace(/\s*-\s*job post$/i, '').trim(),
        company: company || null,
        location: location || null,
        contractType: null,
        salary: salary || null,
        description: description || '',
        skills: [],
        publishedAt: null,
        originalUrl: pageUrl,
        source,
      });
    }

    // 3. Job search result cards
    const cards = Array.from(
      doc.querySelectorAll('.job_seen_beacon, [data-testid="slider_item"], li .cardOutline')
    );
    for (const card of cards.slice(0, 40)) {
      const linkEl = card.querySelector('a.jcs-JobTitle, a[data-jk], h2.jobTitle a');
      const jk =
        (linkEl && linkEl.getAttribute('data-jk')) ||
        (card.querySelector('[data-jk]') && card.querySelector('[data-jk]').getAttribute('data-jk')) ||
        null;
      const href = linkEl
        ? common.toAbsoluteUrl(linkEl.getAttribute('href'), pageUrl)
        : jk
          ? `https://fr.indeed.com/viewjob?jk=${encodeURIComponent(jk)}`
          : pageUrl;

      const title = common.firstText(card, ['h2.jobTitle span', 'h2.jobTitle', 'a.jcs-JobTitle']);
      const company = common.firstText(card, [
        '[data-testid="company-name"]',
        '.companyName',
      ]);
      const location = common.firstText(card, [
        '[data-testid="text-location"]',
        '.companyLocation',
      ]);
      const salary = common.firstText(card, [
        '.salary-snippet-container',
        '[data-testid="attribute_snippet_testid"]',
      ]);
      const snippet = common.firstText(card, ['.job-snippet', '[data-testid="jobsnippet_footer"]']);

      if (title) {
        jobs.push({
          externalId: jk,
          title,
          company: company || null,
          location: location || null,
          contractType: null,
          salary: salary || null,
          description: snippet || common.cleanText(card.textContent).slice(0, 1000),
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
          ? 'Aucune offre détectée sur cette page Indeed. Affichez une liste de résultats ou une fiche de poste, ou utilisez l’importation assistée.'
          : null,
      humanActionRequired: false,
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { extractIndeedJobs };
  } else {
    root.JobHunterExtractors = root.JobHunterExtractors || {};
    root.JobHunterExtractors.indeed = extractIndeedJobs;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
