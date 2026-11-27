/* Popup controller for Job Hunter Agent for Fabien Lufbery (Manifest V3) */
(function () {
  'use strict';

  const PLATFORM_LABELS = {
    welcome_to_the_jungle: 'Welcome to the Jungle',
    indeed: 'Indeed',
    hellowork: 'HelloWork',
    meteojob: 'Meteojob',
  };

  let activeTab = null;
  let detectedPlatform = null;
  let extractedJobs = [];

  const $ = (id) => document.getElementById(id);

  function showAlert(kind, message) {
    const box = $('alertBox');
    box.className = `alert alert-${kind}`;
    box.textContent = message;
  }

  function hideAlert() {
    $('alertBox').className = 'alert hidden';
  }

  function detectPlatformFromUrl(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host.includes('welcometothejungle.com')) return 'welcome_to_the_jungle';
      if (host.includes('indeed.com')) return 'indeed';
      if (host.includes('hellowork.com')) return 'hellowork';
      if (host.includes('meteojob.com')) return 'meteojob';
      return null;
    } catch {
      return null;
    }
  }

  function formatDate(iso) {
    if (!iso) return 'Jamais';
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function renderPreview(jobs) {
    const box = $('previewBox');
    const list = $('previewList');
    const count = $('previewCount');
    list.innerHTML = '';

    if (!jobs || jobs.length === 0) {
      box.classList.add('hidden');
      $('syncBtn').disabled = true;
      return;
    }

    count.textContent = `${jobs.length} offre${jobs.length > 1 ? 's' : ''} prête${jobs.length > 1 ? 's' : ''} à synchroniser`;
    for (const job of jobs.slice(0, 15)) {
      const li = document.createElement('li');
      const titleEl = document.createElement('strong');
      titleEl.textContent = job.title;
      const metaEl = document.createElement('span');
      metaEl.textContent = [job.company || 'Entreprise non précisée', job.location || '']
        .filter(Boolean)
        .join(' · ');
      li.appendChild(titleEl);
      li.appendChild(metaEl);
      list.appendChild(li);
    }
    box.classList.remove('hidden');
    $('syncBtn').disabled = false;
  }

  async function refreshConnectionStatus() {
    const badge = $('connBadge');
    badge.className = 'badge badge-muted';
    badge.textContent = 'Test...';

    const status = await chrome.runtime.sendMessage({ type: 'CHECK_STATUS' });
    if (status && status.connected) {
      badge.className = 'badge badge-ok';
      badge.textContent = 'Connected';
      if (status.heartbeat && typeof status.heartbeat.totalImported === 'number') {
        $('totalImported').textContent = String(status.heartbeat.totalImported);
      }
      if (status.heartbeat && status.heartbeat.lastSyncAt) {
        $('lastSync').textContent = formatDate(status.heartbeat.lastSyncAt);
      }
    } else {
      badge.className = 'badge badge-err';
      badge.textContent = 'Hors ligne';
      if (status && status.error) {
        showAlert('warn', status.error);
      }
    }
  }

  async function init() {
    const stored = await chrome.storage.local.get([
      'backendUrl',
      'ingestToken',
      'lastSyncAt',
      'totalImported',
      'lastError',
    ]);

    const backendUrl = stored.backendUrl || 'http://localhost:3000';
    $('backendUrl').value = backendUrl;
    $('ingestToken').value = stored.ingestToken || 'dev-extension-token';
    $('lastSync').textContent = formatDate(stored.lastSyncAt);
    $('totalImported').textContent = String(stored.totalImported || 0);

    const preset = $('backendPreset');
    if (
      backendUrl === 'http://localhost:3000' ||
      backendUrl === 'https://job-hunter-agent-for-fabien-lufbery.vercel.app'
    ) {
      preset.value = backendUrl;
    } else {
      preset.value = 'custom';
    }

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tabs[0] || null;
    detectedPlatform = activeTab && activeTab.url ? detectPlatformFromUrl(activeTab.url) : null;
    $('platformName').textContent = detectedPlatform
      ? PLATFORM_LABELS[detectedPlatform]
      : 'Hors plateforme cible';

    if (!detectedPlatform) {
      $('scanBtn').disabled = true;
      showAlert(
        'info',
        'Ouvrez une page Welcome to the Jungle, Indeed, HelloWork ou Meteojob pour collecter les offres.'
      );
    }

    await refreshConnectionStatus();
  }

  $('backendPreset').addEventListener('change', (e) => {
    const val = e.target.value;
    if (val !== 'custom') {
      $('backendUrl').value = val;
    }
  });

  $('saveCfgBtn').addEventListener('click', async () => {
    hideAlert();
    const backendUrl = $('backendUrl').value.trim().replace(/\/+$/, '');
    const ingestToken = $('ingestToken').value.trim();
    if (!backendUrl) {
      showAlert('err', 'Renseignez une URL backend valide.');
      return;
    }
    await chrome.storage.local.set({ backendUrl, ingestToken });
    showAlert('info', 'Configuration enregistrée. Vérification de la connexion...');
    await refreshConnectionStatus();
  });

  $('scanBtn').addEventListener('click', async () => {
    hideAlert();
    if (!activeTab || !activeTab.id) return;

    try {
      const res = await chrome.tabs.sendMessage(activeTab.id, { type: 'EXTRACT_JOBS' });
      if (!res) {
        showAlert(
          'warn',
          'Impossible de communiquer avec la page. Rechargez l’onglet puis réessayez.'
        );
        return;
      }

      extractedJobs = Array.isArray(res.jobs) ? res.jobs : [];
      renderPreview(extractedJobs);

      if (res.humanActionRequired) {
        showAlert('warn', res.warning || 'Action humaine requise sur cette plateforme.');
        chrome.runtime.sendMessage({ type: 'REPORT_BARRIER', reason: res.warning });
      } else if (res.warning) {
        showAlert('info', res.warning);
      } else {
        showAlert('ok', `${extractedJobs.length} offre(s) extraite(s) avec succès.`);
      }
    } catch {
      showAlert(
        'warn',
        'Script non injecté sur cet onglet. Rechargez la page d’offres puis cliquez de nouveau.'
      );
    }
  });

  $('syncBtn').addEventListener('click', async () => {
    if (extractedJobs.length === 0) return;
    $('syncBtn').disabled = true;
    showAlert('info', 'Synchronisation avec le backend en cours...');

    const res = await chrome.runtime.sendMessage({
      type: 'SYNC_JOBS',
      platform: detectedPlatform,
      jobs: extractedJobs,
    });

    if (res && res.ok) {
      $('lastSync').textContent = formatDate(res.syncedAt);
      $('totalImported').textContent = String(res.totalImported);
      showAlert(
        'ok',
        `Synchronisé : ${res.inserted} nouvelle(s), ${res.duplicates} doublon(s) conservé(s) avec provenance.`
      );
      await refreshConnectionStatus();
    } else {
      showAlert('err', (res && res.error) || 'Erreur lors de la synchronisation.');
      $('syncBtn').disabled = false;
    }
  });

  $('manualSyncBtn').addEventListener('click', async () => {
    hideAlert();
    const title = $('manualTitle').value.trim();
    if (!title) {
      showAlert('err', 'L’intitulé du poste est obligatoire pour l’importation assistée.');
      return;
    }
    const source = detectedPlatform || 'indeed';
    const job = {
      title,
      company: $('manualCompany').value.trim() || null,
      location: $('manualLocation').value.trim() || null,
      contractType: $('manualContract').value.trim() || null,
      description: $('manualDesc').value.trim(),
      skills: [],
      originalUrl: (activeTab && activeTab.url) || 'https://www.welcometothejungle.com',
      source,
    };

    showAlert('info', 'Envoi de l’offre assistée...');
    const res = await chrome.runtime.sendMessage({
      type: 'SYNC_JOBS',
      platform: source,
      jobs: [job],
    });

    if (res && res.ok) {
      $('manualTitle').value = '';
      $('manualCompany').value = '';
      $('manualLocation').value = '';
      $('manualContract').value = '';
      $('manualDesc').value = '';
      $('lastSync').textContent = formatDate(res.syncedAt);
      $('totalImported').textContent = String(res.totalImported);
      showAlert('ok', `Offre assistée importée (${res.inserted} nouvelle, ${res.duplicates} doublon).`);
    } else {
      showAlert('err', (res && res.error) || 'Erreur lors de l’importation assistée.');
    }
  });

  init();
})();
