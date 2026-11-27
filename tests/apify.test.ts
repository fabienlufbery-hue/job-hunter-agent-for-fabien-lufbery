import { describe, expect, it } from 'vitest';
import { normalizeApifyItem } from '@/lib/apify/client';
describe('Apify normalization', () => {
  it('maps job URL and common fields', () => {
    expect(normalizeApifyItem({ jobTitle: 'Consultant junior', companyName: 'Example', jobUrl: 'https://www.welcometothejungle.com/fr/companies/example/jobs/role' })).toMatchObject({ title: 'Consultant junior', company: 'Example', source: 'welcome_to_the_jungle' });
  });
  it('rejects invalid URLs and unrelated data', () => {
    expect(normalizeApifyItem({ title: 'Consultant', url: 'https://example.test/jobs/role' })).toBeNull();
    expect(normalizeApifyItem({ title: 'Consultant', url: 'https://www.welcometothejungle.com/fr/jobs' })).toBeNull();
  });
});
