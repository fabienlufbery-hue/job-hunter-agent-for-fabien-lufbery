/* Background Service Worker — Job Hunter Agent for Fabien Lufbery (Manifest V3)
 * Handles secure backend synchronization, status checks, and 09:00 / 18:00 schedule alarms.
 * Strictly never transmits cookies, passwords, or session credentials.
 */

importScripts('extractors/common.js');

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
    ingestToken: stored.ingestToken
      || ((!stored.backendUrl || stored.backendUrl === DEFAULT_CONFIG.backendUrl) ? DEFAULT_CONFIG.ingestToken : ''),
    lastSyncAt: stored.lastSyncAt || null,
    totalImported: Number(stored.totalImported || 0),
    lastError: stored.lastError || null,
    lastPlatform: stored.lastPlatform || null,
  };
}

const SCHEDULE_ALARM = 'job_hunter_schedule_check';
const HEARTBEAT_ALARM = 'job_hunter_heartbeat';
const parisClock = new Intl.DateTimeFormat('fr-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', hourCycle: 'h23',
});

async function setupDailyAlarms() {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  if (!(await chrome.alarms.get(SCHEDULE_ALARM))) {
    await chrome.alarms.create(SCHEDULE_ALARM, { periodInMinutes: 1 });
  }
  if (!(await chrome.alarms.get(HEARTBEAT_ALARM))) {
    await chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 30 });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.clear(SCHEDULE_ALARM);
  await setupDailyAlarms();
});
chrome.runtime.onStartup.addListener(setupDailyAlarms);
void setupDailyAlarms();

async function sendHeartbeat(browserStatus, lastError) {
  try {
    const cfg = await getConfig();
    if (!cfg.backendUrl || !cfg.ingestToken) return;
    await fetch(`${cfg.backendUrl}/api/extension/status`, {
      method: 'POST',
      redirect: 'error',
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

let scheduledRunInProgress = false;

async function runBrowserSchedule(now) {
  const paris = Object.fromEntries(parisClock.formatToParts(now).map(({ type, value }) => [type, value]));
  if (scheduledRunInProgress || !['09', '18'].includes(paris.hour)) return;
  scheduledRunInProgress = true;
  try {
    const slot = `${paris.year}-${paris.month}-${paris.day}:${paris.hour}`;
    const { lastScheduleSlot, authorizedSources = [] } = await chrome.storage.local.get([
      'lastScheduleSlot', 'authorizedSources',
    ]);
    if (lastScheduleSlot === slot) return;

    const tabs = await chrome.tabs.query({});
    const candidates = tabs.filter((tab) => tab.id != null &&
      authorizedSources.includes(globalThis.JobHunterCommon.detectPlatform(tab.url)));
    if (candidates.length === 0) {
      await chrome.storage.local.set({
        scheduleStatus: 'Collecte en attente d’un onglet ouvert sur une plateforme autorisée.',
      });
      return;
    }

    await chrome.storage.local.set({ lastScheduleSlot: slot });
    let imported = 0;
    let needsAttention = false;
    for (const tab of candidates) {
      try {
        const result = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_JOBS' });
        if (!result?.ok || result.humanActionRequired || !authorizedSources.includes(result.platform)) {
          needsAttention = true;
          continue;
        }
        if (!result.jobs?.length) continue;
        const synchronized = await syncJobsToBackend({
          platform: result.platform, jobs: result.jobs.slice(0, 100),
        });
        imported += synchronized.inserted || 0;
        needsAttention = needsAttention || !synchronized.ok;
      } catch {
        needsAttention = true;
      }
    }
    const status = `${slot.replace(':', ' à ')}h · ${imported} nouvelle(s) offre(s)${needsAttention ? ' · Intervention requise' : ''}`;
    await chrome.storage.local.set({ scheduleStatus: status });
    await chrome.action.setBadgeText({ text: needsAttention ? '!' : '' });
    await sendHeartbeat(needsAttention ? 'needs_attention' : 'active', needsAttention ? status : null);
  } finally {
    scheduledRunInProgress = false;
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SCHEDULE_ALARM) return runBrowserSchedule(new Date());
  if (alarm.name === HEARTBEAT_ALARM) return sendHeartbeat('active', null);
});

async function checkBackendStatus() {
  const cfg = await getConfig();
  try {
    const res = await fetch(`${cfg.backendUrl}/api/extension/status`, {
      method: 'GET',
      redirect: 'error',
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
  if (!cfg.ingestToken) return { ok: false, error: 'Token de synchronisation absent.' };
  if (jobs.length === 0) {
    return { ok: false, error: 'Aucune offre à synchroniser.' };
  }

  try {
    const res = await fetch(`${cfg.backendUrl}/api/jobs/ingest`, {
      method: 'POST',
      redirect: 'error',
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type || sender.url !== chrome.runtime.getURL('popup.html')) return false;

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
