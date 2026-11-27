import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseURL = 'http://127.0.0.1:3000';
const pages = [
  ['overview', '/', /^Overview — Job Hunter Agent for Fabien Lufbery$/, '/api/overview'],
  ['jobs', '/jobs', /^Job Matches$/, '/api/jobs'],
  ['cv', '/cv', /^My CV —/, '/api/cv'],
  ['applications', '/applications', /^Applications —/, '/api/applications'],
  ['automation', '/automation', /^Automation —/, '/api/automation'],
  ['integrations', '/integrations', /^Integrations —/, '/api/integrations/status'],
  ['settings', '/settings', /^Settings —/, '/api/integrations/status'],
];

await mkdir('browser-evidence', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const [device, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    const context = await browser.newContext({ baseURL, viewport: { width, height } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto('/login');
    await page.screenshot({ path: `browser-evidence/${device}-login.png`, fullPage: true });
    await page.getByRole('button', { name: /^Explorer le Mode Démonstration/ }).click();
    await page.waitForURL(baseURL + '/');
    assert.equal((await context.request.get('/api/auth/session')).status(), 200);
    assert.equal((await context.request.delete('/api/cv')).status(), 403);

    for (const [name, path, heading, endpoint] of pages) {
      const [response] = await Promise.all([
        page.waitForResponse((r) => new URL(r.url()).pathname === endpoint),
        page.goto(path),
      ]);
      assert.equal(response.status(), 200, `${device}: ${endpoint}`);
      const payload = await response.json();
      assert.equal(payload.isDemo, true, `${device}: ${endpoint} is demo`);
      await page.getByRole('heading', { name: heading }).waitFor();
      await page.getByText(/MODE DÉMONSTRATION PUBLIC/).waitFor();
      await page.waitForFunction(() => !document.body.innerText.match(/Chargement (des|du|du tableau)/));
      if (name === 'jobs') {
        const search = page.getByPlaceholder('Rechercher poste, entreprise, compétence...');
        const changed = page.waitForResponse((r) => new URL(r.url()).searchParams.get('q') === 'TypeScript');
        await search.fill('TypeScript');
        assert.equal((await changed).status(), 200);
        await search.clear();
      }
      if (name === 'applications') {
        await page.getByText('Description originale du poste (référence)').waitFor();
        assert.match(await page.locator('textarea').inputValue(), /Madame|Bonjour|Monsieur/i);
      }

      await page.screenshot({ path: `browser-evidence/${device}-${name}.png`, fullPage: true });
      console.log(`PASS ${device.padEnd(7)} ${path} · dashboard public · API 200`);
    }

    await page.goto('/applications');
    await page.getByRole('button', { name: 'Mail & Validation Gmail' }).click();
    assert.equal(await page.getByRole('button', { name: 'Confirmer et envoyer via Gmail' }).isEnabled(), false);
    await page.screenshot({ path: `browser-evidence/${device}-gmail.png`, fullPage: true });
    assert.deepEqual(pageErrors, [], `Unexpected error on ${device}`);
    console.log(`PASS ${device.padEnd(7)} mode démo sans accès aux mutations, envoi Gmail désactivé`);
    await context.close();
  }
} finally {
  await browser.close();
}
