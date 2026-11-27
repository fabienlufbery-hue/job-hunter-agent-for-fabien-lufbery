/* Content script for Job Hunter Agent for Fabien Lufbery (Manifest V3)
 * Only reads accessible job listing DOM / JSON-LD. Never touches cookies or auth data.
 */
(function () {
  'use strict';

  function runExtraction() {
    const common = globalThis.JobHunterCommon;
    const extractors = globalThis.JobHunterExtractors || {};
    const pageUrl = window.location.href;
    const platform = common ? common.detectPlatform(pageUrl) : null;

    if (!platform || !extractors[platform]) {
      return {
        ok: false,
        platform: null,
        jobs: [],
        warning: 'Cette page ne fait pas partie des 4 plateformes supportées.',
        humanActionRequired: false,
        pageUrl,
      };
    }

    try {
      const result = extractors[platform](document, pageUrl);
      return {
        ok: true,
        platform,
        pageUrl,
        ...result,
      };
    } catch (err) {
      return {
        ok: false,
        platform,
        jobs: [],
        pageUrl,
        warning: `Erreur lecture DOM (${err instanceof Error ? err.message : 'structure modifiée'}). Utilisez l'importation assistée.`,
        humanActionRequired: true,
      };
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === 'EXTRACT_JOBS') {
      sendResponse(runExtraction());
      return true;
    }
    return false;
  });
})();
