import crypto from "node:crypto";
import { cleanEmailText, decodeHtmlEntities } from "@/lib/email/clean-email-text";

export const GMAIL_READONLY_SCOPE =
  "https://www.googleapis.com/auth/gmail.readonly";
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const GMAIL_MODIFY_SCOPE = "https://www.googleapis.com/auth/gmail.modify";
export const GMAIL_SCOPES = [GMAIL_MODIFY_SCOPE].join(" ");

export class GmailApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "GmailApiError";
  }
}

export function isGmailAuthError(error: unknown) {
  return (
    error instanceof GmailApiError &&
    (error.status === 400 || error.status === 401 || error.status === 403)
  );
}

export function getGmailRedirectUri() {
  return (
    process.env.GOOGLE_GMAIL_REDIRECT_URI ??
    "http://localhost:3000/api/email-providers/gmail/callback"
  );
}

export function assertGmailEnv() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth credentials are not configured.");
  }
}

export function createOAuthState(userId: string) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const issuedAt = Date.now();
  const payload = `${userId}.${issuedAt}.${nonce}`;
  const signature = crypto
    .createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev-secret")
    .update(payload)
    .digest("hex");

  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function verifyOAuthState(state: string, userId: string) {
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

export function buildGmailAuthorizationUrl(userId: string) {
  assertGmailEnv();

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", getGmailRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", createOAuthState(userId));

  return url;
}

export async function exchangeGmailCode(code: string) {
  assertGmailEnv();

  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: getGmailRedirectUri(),
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new GmailApiError(
      `Google token exchange failed with ${response.status}.`,
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

export async function refreshGmailAccessToken(refreshToken: string) {
  assertGmailEnv();

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new GmailApiError(`Google refresh failed with ${response.status}.`, response.status);
  }

  return (await response.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
    token_type: string;
  };
}

export async function revokeGmailToken(token: string) {
  const response = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ token }),
  });

  if (!response.ok) {
    throw new GmailApiError(`Google token revoke failed with ${response.status}.`, response.status);
  }
}

export async function fetchGmailProfile(accessToken: string) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new GmailApiError(
      `Gmail profile request failed with ${response.status}.`,
      response.status,
    );
  }

  return (await response.json()) as {
    emailAddress: string;
    messagesTotal?: number;
    threadsTotal?: number;
  };
}

type GmailMessageListItem = {
  id: string;
  threadId: string;
};

type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: {
    mimeType?: string;
    body?: {
      data?: string;
    };
    parts?: GmailMessage["payload"][];
    headers?: Array<{
      name: string;
      value: string;
    }>;
  };
};

export type GmailReplyTarget = {
  gmailMessageId: string;
  threadId: string;
  from: string;
  replyTo: string;
  subject: string;
  messageId: string;
  references: string;
};

function header(message: GmailMessage, name: string) {
  return (
    message.payload?.headers?.find(
      (item) => item.name.toLowerCase() === name.toLowerCase(),
    )?.value ?? ""
  );
}

function parseSender(from: string) {
  const match = from.match(/^(.*?)\s*<([^>]+)>$/);

  if (!match) {
    return {
      senderName: from || "Unknown sender",
      senderEmail: from || "unknown@example.com",
    };
  }

  return {
    senderName: match[1]?.replace(/^"|"$/g, "").trim() || match[2],
    senderEmail: match[2],
  };
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function normalizeOutgoingEmailBody(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean)
    .join("\r\n\r\n");
}

function extractBodyOptions(payload: GmailMessage["payload"]): {
  plain: string;
  html: string;
} {
  if (!payload) {
    return { plain: "", html: "" };
  }

  const children = (payload.parts ?? []).map(extractBodyOptions).filter(Boolean);
  const childPlain = children.find((item) => item.plain);
  const childHtml = children.find((item) => item.html);

  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);

    if (payload.mimeType === "text/plain") {
      return {
        plain: cleanEmailText(decoded),
        html: childHtml?.html ?? "",
      };
    }

    if (payload.mimeType === "text/html") {
      return {
        plain: childPlain?.plain ?? "",
        html: cleanEmailText(decoded),
      };
    }
  }

  return {
    plain: childPlain?.plain ?? "",
    html: childHtml?.html ?? "",
  };
}

function extractBody(payload: GmailMessage["payload"]) {
  const options = extractBodyOptions(payload);
  return options.plain || options.html || "";
}

export async function fetchRecentGmailMessages(accessToken: string, maxResults = 50) {
  const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  listUrl.searchParams.set("maxResults", String(maxResults));
  listUrl.searchParams.set("q", "newer_than:30d");

  const listResponse = await fetch(listUrl, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!listResponse.ok) {
    throw new GmailApiError(
      `Gmail message list failed with ${listResponse.status}.`,
      listResponse.status,
    );
  }

  const list = (await listResponse.json()) as {
    messages?: GmailMessageListItem[];
  };

  const messages = await Promise.all(
    (list.messages ?? []).map(async (item) => {
      const messageUrl = new URL(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}`,
      );
      messageUrl.searchParams.set("format", "full");

      const response = await fetch(messageUrl, {
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new GmailApiError(
          `Gmail message fetch failed with ${response.status}.`,
          response.status,
        );
      }

      return (await response.json()) as GmailMessage;
    }),
  );

  return messages.map((message) => {
    const sender = parseSender(header(message, "From"));
    const body = extractBody(message.payload);
    const snippet = decodeHtmlEntities(message.snippet ?? "");
    const receivedAt = message.internalDate
      ? new Date(Number(message.internalDate)).toISOString()
      : new Date(header(message, "Date") || Date.now()).toISOString();

    return {
      id: `gmail:${message.id}`,
      provider: "gmail" as const,
      senderName: sender.senderName,
      senderEmail: sender.senderEmail,
      subject: header(message, "Subject") || "(No subject)",
      body: body || snippet,
      snippet,
      receivedAt,
      isRead: !(message.labelIds ?? []).includes("UNREAD"),
      labels: message.labelIds ?? [],
      threadId: message.threadId,
    };
  });
}

export async function fetchGmailReplyTarget(
  accessToken: string,
  gmailMessageId: string,
): Promise<GmailReplyTarget> {
  const messageUrl = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMessageId}`,
  );
  messageUrl.searchParams.set("format", "metadata");
  messageUrl.searchParams.append("metadataHeaders", "From");
  messageUrl.searchParams.append("metadataHeaders", "Reply-To");
  messageUrl.searchParams.append("metadataHeaders", "Subject");
  messageUrl.searchParams.append("metadataHeaders", "Message-ID");
  messageUrl.searchParams.append("metadataHeaders", "References");

  const response = await fetch(messageUrl, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new GmailApiError(
      `Gmail reply target fetch failed with ${response.status}.`,
      response.status,
    );
  }

  const message = (await response.json()) as GmailMessage;
  const from = header(message, "From");

  return {
    gmailMessageId: message.id,
    threadId: message.threadId,
    from,
    replyTo: header(message, "Reply-To") || from,
    subject: header(message, "Subject") || "(No subject)",
    messageId: header(message, "Message-ID"),
    references: header(message, "References"),
  };
}

export async function sendGmailThreadReply({
  accessToken,
  target,
  body,
}: {
  accessToken: string;
  target: GmailReplyTarget;
  body: string;
}) {
  const to = parseSender(target.replyTo).senderEmail;
  const subject = /^re:/i.test(target.subject) ? target.subject : `Re: ${target.subject}`;
  const references = [target.references, target.messageId].filter(Boolean).join(" ");
  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    target.messageId ? `In-Reply-To: ${target.messageId}` : "",
    references ? `References: ${references}` : "",
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
  ].filter(Boolean);

  const raw = encodeBase64Url(
    `${headers.join("\r\n")}\r\n\r\n${normalizeOutgoingEmailBody(body)}`,
  );
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      raw,
      threadId: target.threadId,
    }),
  });

  if (!response.ok) {
    throw new GmailApiError(`Gmail send failed with ${response.status}.`, response.status);
  }

  return (await response.json()) as { id: string; threadId: string };
}

export async function archiveGmailMessage({
  accessToken,
  gmailMessageId,
}: {
  accessToken: string;
  gmailMessageId: string;
}) {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMessageId}/modify`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        removeLabelIds: ["INBOX"],
      }),
    },
  );

  if (!response.ok) {
    throw new GmailApiError(`Gmail archive failed with ${response.status}.`, response.status);
  }

  return (await response.json()) as { id: string; threadId: string; labelIds?: string[] };
}
