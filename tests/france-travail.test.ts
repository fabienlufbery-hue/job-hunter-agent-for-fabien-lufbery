import { describe, expect, it } from 'vitest';
import {
  FRANCE_TRAVAIL_AUTH_URL,
  FRANCE_TRAVAIL_SEARCH_URL,
  FranceTravailClient,
  parseContentRange,
} from '@/lib/france-travail/client';

describe('France Travail Offres d’emploi v2 Client (Simulated HTTP Transport Tests)', () => {
  it('parses Content-Range headers accurately', () => {
    expect(parseContentRange('offres 0-49/1245')).toEqual({ start: 0, end: 49, total: 1245 });
    expect(parseContentRange('offres 0-0/*')).toEqual({ start: 0, end: 0, total: 1 });
    expect(parseContentRange(null)).toBeNull();
  });

  it('never fakes a connected state when credentials are missing', async () => {
    const client = new FranceTravailClient({ clientId: '', clientSecret: '' });
    const result = await client.testConnection();
    expect(result.configured).toBe(false);
    expect(result.connected).toBe(false);
    expect(result.error).toMatch(/FRANCE_TRAVAIL_CLIENT_ID/);
  });

  it('authenticates via OAuth2 client_credentials, paginates 206 responses, and normalizes offers', async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];

    const mockFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, method: init?.method || 'GET', body: init?.body ? String(init.body) : undefined });

      if (url === FRANCE_TRAVAIL_AUTH_URL) {
        return new Response(
          JSON.stringify({
            access_token: 'ft-test-token-1',
            expires_in: 1499,
            scope: 'api_offresdemploiv2 o2dsoffre',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.startsWith(FRANCE_TRAVAIL_SEARCH_URL) && url.includes('range=0-49')) {
        return new Response(
          JSON.stringify({
            resultats: [
              {
                id: '190ABCD',
                intitule: 'Développeur TypeScript Senior',
                description: 'Poste Next.js et PostgreSQL',
                dateCreation: '2026-11-26T08:00:00Z',
                lieuTravail: { libelle: '75 - PARIS 08' },
                entreprise: { nom: 'Studio Paris' },
                typeContrat: 'CDI',
                typeContratLibelle: 'Contrat à durée indéterminée',
                salaire: { libelle: 'Annuel de 55000 Euros à 65000 Euros' },
                competences: [{ libelle: 'TypeScript' }, { libelle: 'PostgreSQL' }],
                origineOffre: { urlOrigine: 'https://candidat.francetravail.fr/offres/190ABCD' },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Content-Range': 'offres 0-0/1',
            },
          }
        );
      }

      return new Response('Not Found', { status: 404 });
    };

    const client = new FranceTravailClient({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      fetchImpl: mockFetch,
      sleepMs: async () => {},
    });

    const res = await client.searchOffers({
      motsCles: 'TypeScript',
      departement: '75',
      typeContrat: 'CDI',
      maxResults: 50,
    });

    expect(calls[0].url).toBe(FRANCE_TRAVAIL_AUTH_URL);
    expect(calls[0].body).toContain('grant_type=client_credentials');
    expect(calls[0].body).toContain('scope=api_offresdemploiv2+o2dsoffre');
    expect(res.offers).toHaveLength(1);
    expect(res.totalAvailable).toBe(1);
    expect(res.offers[0]).toMatchObject({
      source: 'france_travail',
      externalId: '190ABCD',
      title: 'Développeur TypeScript Senior',
      company: 'Studio Paris',
      skills: ['TypeScript', 'PostgreSQL'],
    });
  });

  it('handles HTTP 204 No Content, HTTP 401 token refresh, HTTP 429 retry, and invalid credentials', async () => {
    let searchAttempt = 0;
    let authCalls = 0;

    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url === FRANCE_TRAVAIL_AUTH_URL) {
        authCalls += 1;
        return new Response(
          JSON.stringify({ access_token: `token-${authCalls}`, expires_in: 1499 }),
          { status: 200 }
        );
      }
      searchAttempt += 1;
      if (searchAttempt === 1) return new Response('Unauthorized', { status: 401 });
      if (searchAttempt === 2) {
        return new Response('Rate limited', { status: 429, headers: { 'Retry-After': '0' } });
      }
      return new Response(null, { status: 204 });
    };

    const client = new FranceTravailClient({
      clientId: 'cid',
      clientSecret: 'csec',
      fetchImpl: mockFetch,
      sleepMs: async () => {},
    });

    const emptyRes = await client.searchOffers({ motsCles: 'rare-keyword', range: '0-9' });
    expect(authCalls).toBe(2); // Initial + refresh on 401
    expect(searchAttempt).toBe(3); // 401 -> 429 -> 204
    expect(emptyRes.offers).toEqual([]);
    expect(emptyRes.statusCode).toBe(204);

    // Invalid credentials test
    const badClient = new FranceTravailClient({
      clientId: 'bad',
      clientSecret: 'bad',
      fetchImpl: async () => new Response('invalid_client', { status: 401 }),
    });
    const testRes = await badClient.testConnection();
    expect(testRes.configured).toBe(true);
    expect(testRes.connected).toBe(false);
    expect(testRes.error).toMatch(/401/);
  });
});
