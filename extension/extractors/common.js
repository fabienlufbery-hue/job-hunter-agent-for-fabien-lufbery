/* Shared extraction, JSON-LD parsing, anti-bot detection & normalization utilities.
 * STRICT PRIVACY POLICY: Never reads document.cookie, passwords, or session tokens.
 */
(function (root) {
  'use strict';

  function detectPlatform(urlString) {
    try {
      const url = new URL(urlString);
      if (url.protocol !== 'https:') return null;
      const hosts = {
        'www.welcometothejungle.com': 'welcome_to_the_jungle',
        'fr.indeed.com': 'indeed',
        'www.indeed.com': 'indeed',
        'www.hellowork.com': 'hellowork',
        'www.meteojob.com': 'meteojob',
      };
      return Object.hasOwn(hosts, url.hostname) ? hosts[url.hostname] : null;
    } catch {
      return null;
    }
  }

  function cleanText(value) {
    if (!value) return '';
    return String(value)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function firstText(rootEl, selectors) {
    if (!rootEl || !selectors) return '';
    for (const sel of selectors) {
      try {
        const el = rootEl.querySelector(sel);
        const txt = el ? cleanText(el.textContent) : '';
        if (txt) return txt;
      } catch {
        // Ignore invalid selector in older DOM
      }
    }
    return '';
  }

  function detectAccessBarrier(doc) {
    const title = cleanText(doc && doc.title ? doc.title : '').toLowerCase();
    const bodyText = cleanText(doc && doc.body ? doc.body.textContent : '').slice(0, 3000).toLowerCase();

    const hasCaptchaIframe = Boolean(
      doc &&
        doc.querySelector &&
        doc.querySelector(
          'iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="turnstile"], .cf-turnstile, #challenge-running, [data-testid="captcha"]'
        )
    );

    const barrierSignals = [
      'verify you are human',
      'vérifier que vous êtes humain',
      'just a moment',
      'attention required',
      'unusual traffic',
      'trafic inhabituel',
      'security check',
      'accès bloqué',
      'captcha',
    ];

    const matchedSignal = barrierSignals.find(
      (sig) => title.includes(sig) || bodyText.includes(sig)
    );

    if (hasCaptchaIframe || matchedSignal) {
      return {
        blocked: true,
        reason:
          'Protection anti-bot ou vérification humaine détectée sur cette page. L’extension ne contourne jamais les CAPTCHA : complétez la vérification manuellement ou utilisez le formulaire d’importation assistée.',
      };
    }

    return { blocked: false, reason: null };
  }

  function extractJsonLdJobPostings(doc) {
    if (!doc || !doc.querySelectorAll) return [];
    const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
    const postings = [];

    function collect(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach(collect);
        return;
      }
      const type = node['@type'];
      const isJobPosting =
        type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'));
      if (isJobPosting) {
        postings.push(node);
      }
      if (node['@graph']) {
        collect(node['@graph']);
      }
    }

    for (const s of scripts) {
      try {
        const raw = s.textContent || '';
        if (!raw.trim()) continue;
        collect(JSON.parse(raw));
      } catch {
        // Ignore malformed third-party JSON-LD
      }
    }

    return postings;
  }

  function formatJsonLdSalary(baseSalary) {
    if (!baseSalary) return null;
    if (typeof baseSalary === 'string') return cleanText(baseSalary) || null;
    const currency = baseSalary.currency || 'EUR';
    const val = baseSalary.value || baseSalary;
    if (val && (val.minValue || val.maxValue)) {
      const min = val.minValue ? `${val.minValue}` : '';
      const max = val.maxValue ? `${val.maxValue}` : '';
      const unit = val.unitText ? ` / ${val.unitText}` : '';
      return `${min}${min && max ? ' - ' : ''}${max} ${currency}${unit}`.trim();
    }
    if (val && val.value) {
      return `${val.value} ${currency}${val.unitText ? ` / ${val.unitText}` : ''}`.trim();
    }
    return null;
  }

  function formatJsonLdLocation(jobLocation) {
    if (!jobLocation) return null;
    const first = Array.isArray(jobLocation) ? jobLocation[0] : jobLocation;
    if (typeof first === 'string') return cleanText(first) || null;
    const addr = first && first.address ? first.address : first;
    if (!addr) return null;
    const parts = [addr.addressLocality, addr.postalCode, addr.addressRegion, addr.addressCountry]
      .map((p) => (typeof p === 'string' ? p.trim() : p && p.name ? String(p.name).trim() : ''))
      .filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }

  function jobFromJsonLd(posting, source, pageUrl) {
    const title = cleanText(posting.title);
    if (!title) return null;
    const company =
      posting.hiringOrganization && typeof posting.hiringOrganization === 'object'
        ? cleanText(posting.hiringOrganization.name) || null
        : typeof posting.hiringOrganization === 'string'
          ? cleanText(posting.hiringOrganization) || null
          : null;
    const employmentType = Array.isArray(posting.employmentType)
      ? posting.employmentType.join(', ')
      : cleanText(posting.employmentType) || null;

    let skills = [];
    if (Array.isArray(posting.skills)) {
      skills = posting.skills.map(cleanText).filter(Boolean);
    } else if (typeof posting.skills === 'string') {
      skills = posting.skills
        .split(/[,;•\n]/)
        .map(cleanText)
        .filter(Boolean);
    }

    const externalId =
      posting.identifier && typeof posting.identifier === 'object'
        ? cleanText(posting.identifier.value) || null
        : cleanText(posting.identifier) || null;

    return {
      externalId,
      title,
      company,
      location: formatJsonLdLocation(posting.jobLocation),
      contractType: employmentType,
      salary: formatJsonLdSalary(posting.baseSalary),
      description: cleanText(posting.description),
      skills: skills.slice(0, 30),
      publishedAt: posting.datePosted || null,
      originalUrl: posting.url && /^https?:\/\//.test(posting.url) ? posting.url : pageUrl,
      source,
    };
  }

  function toAbsoluteUrl(href, pageUrl) {
    if (!href) return pageUrl;
    try {
      return new URL(href, pageUrl).toString();
    } catch {
      return pageUrl;
    }
  }

  function dedupeExtracted(jobs) {
    const seen = new Set();
    const out = [];
    for (const job of jobs) {
      if (!job || !job.title || job.title.length < 2) continue;
      const key = `${job.source}|${job.originalUrl}|${job.title.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(job);
    }
    return out;
  }

  const api = {
    detectPlatform,
    cleanText,
    firstText,
    detectAccessBarrier,
    extractJsonLdJobPostings,
    jobFromJsonLd,
    toAbsoluteUrl,
    dedupeExtracted,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.JobHunterCommon = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
