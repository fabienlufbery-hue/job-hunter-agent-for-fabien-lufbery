import crypto from 'node:crypto';
import { google } from 'googleapis';
import MailComposer from 'nodemailer/lib/mail-composer';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { decryptSecret, encryptSecret } from '@/lib/crypto';

export const GMAIL_MINIMAL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/userinfo.email',
];

export interface EmailAttachmentInput {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface ComposeEmailInput {
  to: string;
  subject: string;
  body: string;
  attachments?: EmailAttachmentInput[];
}

export function isGmailOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      (process.env.GOOGLE_REDIRECT_URI?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim())
  );
}

export function getGmailRedirectUri(): string {
  if (process.env.GOOGLE_REDIRECT_URI?.trim()) {
    return process.env.GOOGLE_REDIRECT_URI.trim();
  }
  const base = (process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000').replace(
    /\/+$/,
    ''
  );
  return `${base}/api/integrations/gmail/callback`;
}

export function createGoogleOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET doivent être configurés.');
  }
  return new google.auth.OAuth2(clientId, clientSecret, getGmailRedirectUri());
}

export function buildGmailAuthUrl(state: string): string {
  const oauth2Client = createGoogleOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_MINIMAL_SCOPES,
    state,
  });
}

export async function exchangeGmailCodeAndStore(code: string): Promise<{
  accountEmail: string | null;
  scope: string;
}> {
  const oauth2Client = createGoogleOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.access_token) {
    throw new Error('Aucun access_token retourné par Google OAuth2.');
  }

  oauth2Client.setCredentials(tokens);

  let accountEmail: string | null = null;
  try {
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2Client });
    const info = await oauth2Api.userinfo.get();
    accountEmail = info.data.email || null;
  } catch {
    accountEmail = null;
  }

  const db = await getDb();
  const existingRows = await db
    .select()
    .from(schema.oauthTokens)
    .where(eq(schema.oauthTokens.provider, 'gmail'))
    .limit(1);

  const encryptedAccessToken = encryptSecret(tokens.access_token);
  const oldAccountToken = accountEmail && accountEmail === existingRows[0]?.accountEmail
    ? existingRows[0].encryptedRefreshToken : null;
  const encryptedRefreshToken = tokens.refresh_token
    ? encryptSecret(tokens.refresh_token)
    : oldAccountToken;
  const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
  const scope = tokens.scope || GMAIL_MINIMAL_SCOPES.join(' ');

  if (existingRows[0]) {
    await db
      .update(schema.oauthTokens)
      .set({
        accountEmail,
        encryptedAccessToken,
        encryptedRefreshToken,
        scope,
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.oauthTokens.provider, 'gmail'));
  } else {
    await db.insert(schema.oauthTokens).values({
      provider: 'gmail',
      accountEmail,
      encryptedAccessToken,
      encryptedRefreshToken,
      scope,
      expiresAt,
      updatedAt: new Date(),
    });
  }

  return { accountEmail, scope };
}

export async function getGmailConnectionStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  accountEmail: string | null;
  scopes: string[];
  expiresAt: string | null;
}> {
  const configured = isGmailOAuthConfigured();
  if (!configured) {
    return {
      configured: false,
      connected: false,
      accountEmail: null,
      scopes: GMAIL_MINIMAL_SCOPES,
      expiresAt: null,
    };
  }

  try {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(schema.oauthTokens)
      .where(eq(schema.oauthTokens.provider, 'gmail'))
      .limit(1);

    if (!row) {
      return {
        configured: true,
        connected: false,
        accountEmail: null,
        scopes: GMAIL_MINIMAL_SCOPES,
        expiresAt: null,
      };
    }

    return {
      configured: true,
      connected: true,
      accountEmail: row.accountEmail || null,
      scopes: row.scope ? row.scope.split(/\s+/) : GMAIL_MINIMAL_SCOPES,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    };
  } catch {
    return {
      configured,
      connected: false,
      accountEmail: null,
      scopes: GMAIL_MINIMAL_SCOPES,
      expiresAt: null,
    };
  }
}

export async function disconnectGmail(): Promise<void> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.oauthTokens)
    .where(eq(schema.oauthTokens.provider, 'gmail'))
    .limit(1);

  if (row && isGmailOAuthConfigured()) {
    try {
      const oauth2Client = createGoogleOAuth2Client();
      const token = decryptSecret(row.encryptedRefreshToken || row.encryptedAccessToken);
      await oauth2Client.revokeToken(token);
    } catch {
      // Ignore revocation network error and still remove local encrypted tokens
    }
  }

  await db.delete(schema.oauthTokens).where(eq(schema.oauthTokens.provider, 'gmail'));
}

async function getAuthorizedGmailClient() {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.oauthTokens)
    .where(eq(schema.oauthTokens.provider, 'gmail'))
    .limit(1);

  if (!row) {
    throw new Error('Compte Gmail non connecté. Connectez votre compte Google dans Integrations.');
  }

  const oauth2Client = createGoogleOAuth2Client();
  const accessToken = decryptSecret(row.encryptedAccessToken);
  const refreshToken = row.encryptedRefreshToken ? decryptSecret(row.encryptedRefreshToken) : undefined;

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: row.expiresAt ? row.expiresAt.getTime() : undefined,
  });

  oauth2Client.on('tokens', async (newTokens) => {
    try {
      if (newTokens.access_token) {
        await db
          .update(schema.oauthTokens)
          .set({
            encryptedAccessToken: encryptSecret(newTokens.access_token),
            encryptedRefreshToken: newTokens.refresh_token
              ? encryptSecret(newTokens.refresh_token)
              : row.encryptedRefreshToken,
            expiresAt: newTokens.expiry_date ? new Date(newTokens.expiry_date) : row.expiresAt,
            updatedAt: new Date(),
          })
          .where(eq(schema.oauthTokens.provider, 'gmail'));
      }
    } catch {
      // Non-fatal background refresh persistence error
    }
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export function validateRecipientEmail(email: string | null | undefined): string {
  const cleaned = (email || '').trim();
  if (!cleaned) {
    throw new Error(
      'Aucune adresse email destinataire vérifiée. Ouvrez l’offre originale ou renseignez manuellement un destinataire.'
    );
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(cleaned)) {
    throw new Error(`Adresse email destinataire invalide : "${cleaned}".`);
  }
  if (cleaned.toLowerCase().endsWith('.invalid')) {
    throw new Error('Adresse email de démonstration (.invalid) — envoi réel bloqué par sécurité.');
  }
  return cleaned;
}

export async function buildRawMimeBase64Url(input: ComposeEmailInput): Promise<string> {
  const mail = new MailComposer({
    to: input.to,
    subject: input.subject,
    text: input.body,
    attachments: (input.attachments || []).map((att) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
    })),
  });

  const message = await new Promise<Buffer>((resolve, reject) => {
    mail.compile().build((err, buf) => {
      if (err) return reject(err);
      resolve(buf);
    });
  });

  return message
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function createGmailDraftForApplication(params: {
  applicationId: string;
  jobId: string;
  to: string;
  subject: string;
  body: string;
  attachments?: EmailAttachmentInput[];
}): Promise<{ draftId: string; messageId: string | null }> {
  const recipient = validateRecipientEmail(params.to);
  const gmail = await getAuthorizedGmailClient();
  const raw = await buildRawMimeBase64Url({
    to: recipient,
    subject: params.subject,
    body: params.body,
    attachments: params.attachments,
  });

  const response = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: { raw },
    },
  });

  const draftId = response.data.id || '';
  const messageId = response.data.message?.id || null;

  const db = await getDb();
  await db.insert(schema.emailLogs).values({
    id: crypto.randomUUID(),
    applicationId: params.applicationId,
    jobId: params.jobId,
    recipientEmail: recipient,
    subject: params.subject,
    action: 'draft_created',
    gmailDraftId: draftId,
    gmailMessageId: messageId,
    attachments: (params.attachments || []).map((a) => a.filename),
    humanConfirmed: false,
    createdAt: new Date(),
  });

  await db
    .update(schema.applications)
    .set({
      recipientEmail: recipient,
      emailSubject: params.subject,
      emailBody: params.body,
      gmailDraftId: draftId,
      status: 'gmail_draft',
      updatedAt: new Date(),
    })
    .where(eq(schema.applications.id, params.applicationId));

  return { draftId, messageId };
}

export function assertHumanConfirmation(input: {
  humanConfirmed?: boolean;
  confirmationText?: string;
}): void {
  if (input.humanConfirmed !== true) {
    throw new Error(
      'Validation humaine explicite obligatoire : aucun email ne peut être envoyé automatiquement.'
    );
  }
}

export async function sendGmailForApplication(params: {
  applicationId: string;
  jobId: string;
  to: string;
  subject: string;
  body: string;
  humanConfirmed: boolean;
  attachments?: EmailAttachmentInput[];
  dryRun?: boolean;
}): Promise<{ messageId: string; dryRun: boolean }> {
  assertHumanConfirmation({ humanConfirmed: params.humanConfirmed });
  const recipient = validateRecipientEmail(params.to);

  if (params.dryRun || process.env.NODE_ENV === 'test') {
    throw new Error('Envoi réel Gmail bloqué en mode test / dry-run par politique de sécurité.');
  }

  const gmail = await getAuthorizedGmailClient();
  const raw = await buildRawMimeBase64Url({
    to: recipient,
    subject: params.subject,
    body: params.body,
    attachments: params.attachments,
  });

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  const messageId = response.data.id || '';
  const now = new Date();
  const db = await getDb();

  await db.insert(schema.emailLogs).values({
    id: crypto.randomUUID(),
    applicationId: params.applicationId,
    jobId: params.jobId,
    recipientEmail: recipient,
    subject: params.subject,
    action: 'sent',
    gmailMessageId: messageId,
    attachments: (params.attachments || []).map((a) => a.filename),
    humanConfirmed: true,
    createdAt: now,
  });

  await db
    .update(schema.applications)
    .set({
      recipientEmail: recipient,
      emailSubject: params.subject,
      emailBody: params.body,
      gmailMessageId: messageId,
      status: 'sent',
      sentAt: now,
      updatedAt: now,
    })
    .where(eq(schema.applications.id, params.applicationId));

  await db
    .update(schema.jobs)
    .set({
      applicationStatus: 'applied',
      updatedAt: now,
    })
    .where(eq(schema.jobs.id, params.jobId));

  return { messageId, dryRun: false };
}
