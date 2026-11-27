/* Background Service Worker — Job Hunter Agent for Fabien Lufbery (Manifest V3)
 * Handles secure backend synchronization, status checks, and 09:00 / 18:00 schedule alarms.
 * Strictly never transmits cookies, passwords, or session credentials.
 */

const DEFAULT_CONFIG = {
  backendUrl: 'http://localhost:3000',
  ingestToken: 'dev-extension-token',
};

const EXTENSION_VERSION = '1.0.0';

async function getConfig() {
  const stored = await chrome.storage.local.get([
    'backendUrl',
    'ingestToken',
    'lastSyncAt',
    'totalImported',
    'lastError',
    'lastPlatform',
  ]);
  return {
    backendUrl: (stored.backendUrl || DEFAULT_CONFIG.backendUrl).replace(/\/+$/, ''),
    ingestToken: stored.ingestToken || DEFAULT_CONFIG.ingestToken,
    lastSyncAt: stored.lastSyncAt || null,
    totalImported: Number(stored.totalImported || 0),
    lastError: stored.lastError || null,
    lastPlatform: stored.lastPlatform || null,
  };
}

function setupDailyAlarms() {
  // Check hourly and highlight badge at 09:00 and 18:00 Europe/Paris when Chrome is open
  chrome.alarms.create('job_hunter_schedule_check', { periodInMinutes: 60 });
  chrome.alarms.create('job_hunter_heartbeat', { periodInMinutes: 30 });
}

chrome.runtime.onInstalled.addListener(() => {
  setupDailyAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  setupDailyAlarms();
  sendHeartbeat('active', null);
});

async function sendHeartbeat(browserStatus, lastError) {
  try {
    const cfg = await getConfig();
    if (!cfg.backendUrl || !cfg.ingestToken) return;
    await fetch(`${cfg.backendUrl}/api/extension/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Token': cfg.ingestToken,
      },
      body: JSON.stringify({
        extensionVersion: EXTENSION_VERSION,
        lastPlatform: cfg.lastPlatform,
        browserStatus: browserStatus || 'active',
        lastError: lastError || null,
      }),
    });
  } catch {
    // Backend may be offline locally — fail silently during background heartbeat
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'job_hunter_heartbeat') {
    await sendHeartbeat('active', null);
    return;
  }

  if (alarm.name === 'job_hunter_schedule_check') {
    const parisHour = Number.parseInt(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Paris',
        hour: '2-digit',
        hour12: false,
      }).format(new Date()),
      10
    );

    if (parisHour === 9 || parisHour === 18) {
      chrome.action.setBadgeText({ text: 'SYNC' });
      chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
    }
    await sendHeartbeat('active', null);
  }
});

async function checkBackendStatus() {
  const cfg = await getConfig();
  try {
    const res = await fetch(`${cfg.backendUrl}/api/extension/status`, {
      method: 'GET',
      headers: {
        'X-Extension-Token': cfg.ingestToken,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        connected: false,
        statusCode: res.status,
        error: data.error || `Erreur HTTP ${res.status}`,
      };
    }
    await sendHeartbeat('active', null);
    return {
      connected: true,
      statusCode: res.status,
      databaseConnected: data.databaseConnected,
      heartbeat: data.heartbeat || null,
    };
  } catch (err) {
    return {
      connected: false,
      statusCode: 0,
      error: `Backend inaccessible (${err instanceof Error ? err.message : 'réseau'})`,
    };
  }
}

async function syncJobsToBackend(payload) {
  const cfg = await getConfig();
  const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
  if (jobs.length === 0) {
    return { ok: false, error: 'Aucune offre à synchroniser.' };
  }

  try {
    const res = await fetch(`${cfg.backendUrl}/api/jobs/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Token': cfg.ingestToken,
      },
      body: JSON.stringify({
        extensionVersion: EXTENSION_VERSION,
        platform: payload.platform || jobs[0].source,
        jobs,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data.error || `Erreur backend HTTP ${res.status}`;
      await chrome.storage.local.set({ lastError: errMsg });
      await sendHeartbeat('needs_attention', errMsg);
      return { ok: false, error: errMsg };
    }

    const totalImported =
      typeof data.totalImportedAllTime === 'number'
        ? data.totalImportedAllTime
        : cfg.totalImported + Number(data.inserted || 0);

    await chrome.storage.local.set({
      lastSyncAt: data.syncedAt || new Date().toISOString(),
      totalImported,
      lastPlatform: payload.platform || jobs[0].source,
      lastError: null,
    });
    chrome.action.setBadgeText({ text: '' });

    return {
      ok: true,
      inserted: data.inserted || 0,
      duplicates: data.duplicates || 0,
      updated: data.updated || 0,
      totalImported,
      syncedAt: data.syncedAt || new Date().toISOString(),
    };
  } catch (err) {
    const errMsg = `Échec synchronisation : ${err instanceof Error ? err.message : 'réseau'}`;
    await chrome.storage.local.set({ lastError: errMsg });
    return { ok: false, error: errMsg };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === 'CHECK_STATUS') {
    checkBackendStatus().then(sendResponse);
    return true;
  }

  if (message.type === 'SYNC_JOBS') {
    syncJobsToBackend(message).then(sendResponse);
    return true;
  }

  if (message.type === 'REPORT_BARRIER') {
    sendHeartbeat('needs_attention', message.reason || 'Action humaine requise').then(() =>
      sendResponse({ ok: true })
    );
    return true;
  }

  return false;
});
