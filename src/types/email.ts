export type EmailProviderId = "mock" | "gmail" | "outlook" | "yahoo";

export type EmailMessage = {
  id: string;
  provider: EmailProviderId;
  senderName: string;
  senderEmail: string;
  subject: string;
  body: string;
  snippet: string;
  receivedAt: string;
  isRead: boolean;
  labels: string[];
  threadId: string;
};
