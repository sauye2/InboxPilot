import crypto from "node:crypto";
import { cleanEmailText, decodeHtmlEntities } from "@/lib/email/clean-email-text";
import { normalizeOutgoingEmailBody } from "@/lib/email-providers/gmail-oauth";

export const OUTLOOK_SCOPES = [
  "offline_access",
  "User.Read",
  "Mail.Read",
  "Mail.Send",
  "Mail.ReadWrite",
].join(" ");

export class OutlookApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "OutlookApiError";
  }
}

export function isOutlookAuthError(error: unknown) {
  return (
    error instanceof OutlookApiError &&
    (error.status === 400 || error.status === 401 || error.status === 403)
  );
}

export function getOutlookRedirectUri() {
  return (
    process.env.MICROSOFT_OUTLOOK_REDIRECT_URI ??
    "http://localhost:3000/api/email-providers/outlook/callback"
  );
}

export function assertOutlookEnv() {
  if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
    throw new Error("Microsoft OAuth credentials are not configured.");
  }
}

function createOAuthState(userId: string) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const issuedAt = Date.now();
  const payload = `${userId}.${issuedAt}.${nonce}`;
  const signature = crypto
    .createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev-secret")
    .update(payload)
    .digest("hex");

  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function verifyOutlookOAuthState(state: string, userId: string) {
  const decoded = Buffer.from(state, "base64url").toString("utf8");
  const [stateUserId, issuedAtRaw, nonce, signature] = decoded.split(".");

  if (!stateUserId || !issuedAtRaw || !nonce || !signature) {
    return false;
  }

  if (stateUserId !== userId) {
    return false;
  }

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > 10 * 60 * 1000) {
    return false;
  }

  const payload = `${stateUserId}.${issuedAtRaw}.${nonce}`;
  const expected = crypto
    .createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev-secret")
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function buildOutlookAuthorizationUrl(userId: string) {
  assertOutlookEnv();

  const url = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  url.searchParams.set("client_id", process.env.MICROSOFT_CLIENT_ID!);
  url.searchParams.set("redirect_uri", getOutlookRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", OUTLOOK_SCOPES);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("state", createOAuthState(userId));

  return url;
}

export async function exchangeOutlookCode(code: string) {
  assertOutlookEnv();

  const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      code,
      redirect_uri: getOutlookRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new OutlookApiError(
      `Microsoft token exchange failed with ${response.status}.`,
      response.status,
    );
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };
}

export async function refreshOutlookAccessToken(refreshToken: string) {
  assertOutlookEnv();

  const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      refresh_token: refreshToken,
      redirect_uri: getOutlookRedirectUri(),
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new OutlookApiError(
      `Microsoft refresh failed with ${response.status}.`,
      response.status,
    );
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
    token_type: string;
  };
}

export async function fetchOutlookProfile(accessToken: string) {
  const response = await graphFetch(accessToken, "/me?$select=displayName,mail,userPrincipalName");

  return (await response.json()) as {
    displayName?: string | null;
    mail?: string | null;
    userPrincipalName?: string | null;
  };
}

type OutlookMessage = {
  id: string;
  conversationId?: string | null;
  subject?: string | null;
  bodyPreview?: string | null;
  receivedDateTime?: string | null;
  isRead?: boolean | null;
  categories?: string[] | null;
  from?: {
    emailAddress?: {
      name?: string | null;
      address?: string | null;
    } | null;
  } | null;
  sender?: {
    emailAddress?: {
      name?: string | null;
      address?: string | null;
    } | null;
  } | null;
  body?: {
    contentType?: "text" | "html";
    content?: string | null;
  } | null;
};

export async function fetchRecentOutlookMessages(accessToken: string, maxResults = 50) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const url = new URL("https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages");
  url.searchParams.set("$top", String(maxResults));
  url.searchParams.set("$orderby", "receivedDateTime desc");
  url.searchParams.set("$filter", `receivedDateTime ge ${since}`);
  url.searchParams.set(
    "$select",
    "id,conversationId,subject,bodyPreview,receivedDateTime,isRead,categories,from,sender,body",
  );

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.body-content-type="text"',
    },
  });

  if (!response.ok) {
    throw new OutlookApiError(
      `Outlook message list failed with ${response.status}.`,
      response.status,
    );
  }

  const payload = (await response.json()) as { value?: OutlookMessage[] };

  return (payload.value ?? []).map((message) => {
    const sender = message.from?.emailAddress ?? message.sender?.emailAddress;
    const body = cleanEmailText(message.body?.content ?? "");
    const snippet = cleanEmailText(decodeHtmlEntities(message.bodyPreview ?? ""));

    return {
      id: `outlook:${message.id}`,
      provider: "outlook" as const,
      senderName: sender?.name ?? sender?.address ?? "Unknown sender",
      senderEmail: sender?.address ?? "unknown@example.com",
      subject: message.subject || "(No subject)",
      body: body || snippet,
      snippet,
      receivedAt: message.receivedDateTime ?? new Date().toISOString(),
      isRead: Boolean(message.isRead),
      labels: message.categories ?? [],
      threadId: message.conversationId ?? message.id,
    };
  });
}

export async function sendOutlookThreadReply({
  accessToken,
  outlookMessageId,
  body,
  replyToEmail,
}: {
  accessToken: string;
  outlookMessageId: string;
  body: string;
  replyToEmail?: string | null;
}) {
  const draftResponse = await graphFetch(
    accessToken,
    `/me/messages/${encodeURIComponent(outlookMessageId)}/createReply`,
    {
      method: "POST",
    },
  );
  const draft = (await draftResponse.json()) as { id?: string };

  if (!draft.id) {
    throw new OutlookApiError("Outlook reply draft did not include a message id.", 500);
  }

  const replyPatch: {
    body: {
      contentType: "HTML";
      content: string;
    };
    replyTo?: Array<{
      emailAddress: {
        address: string;
      };
    }>;
  } = {
      body: {
        contentType: "HTML",
        content: formatOutlookReplyHtml(body),
      },
    };

  const normalizedReplyTo = normalizeUsableReplyToEmail(replyToEmail);
  if (normalizedReplyTo) {
    replyPatch.replyTo = [
      {
        emailAddress: {
          address: normalizedReplyTo,
        },
      },
    ];
  }

  try {
    await graphFetch(accessToken, `/me/messages/${encodeURIComponent(draft.id)}`, {
      method: "PATCH",
      body: JSON.stringify(replyPatch),
    });
  } catch (error) {
    if (!normalizedReplyTo) {
      throw error;
    }

    await graphFetch(accessToken, `/me/messages/${encodeURIComponent(draft.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        body: replyPatch.body,
      }),
    });
  }

  await graphFetch(accessToken, `/me/messages/${encodeURIComponent(draft.id)}/send`, {
    method: "POST",
  });

  return { id: outlookMessageId };
}

export async function archiveOutlookMessage({
  accessToken,
  outlookMessageId,
}: {
  accessToken: string;
  outlookMessageId: string;
}) {
  const response = await graphFetch(
    accessToken,
    `/me/messages/${encodeURIComponent(outlookMessageId)}/move`,
    {
      method: "POST",
      body: JSON.stringify({ destinationId: "archive" }),
    },
  );

  return (await response.json()) as { id: string; conversationId?: string };
}

async function graphFetch(accessToken: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new OutlookApiError(`Microsoft Graph request failed with ${response.status}.`, response.status);
  }

  return response;
}

function formatOutlookReplyHtml(value: string) {
  const paragraphs = normalizeOutgoingEmailBody(value)
    .split(/\r\n\r\n|\n\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 14px 0; line-height:1.55;">${escapeHtml(paragraph).replace(/\r?\n/g, "<br />")}</p>`,
    )
    .join("");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeUsableReplyToEmail(value?: string | null) {
  const email = value?.trim().toLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (/^outlook_[a-z0-9]+@outlook\.com$/i.test(email)) return null;
  return email;
}
