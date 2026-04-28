import type { EmailMessage, EmailProviderId } from "@/types/email";

export type ConnectionStatus = "connected" | "not_connected" | "coming_soon";

export type EmailProviderAdapter = {
  id: EmailProviderId;
  name: string;
  connect: () => Promise<ConnectionStatus>;
  disconnect: () => Promise<ConnectionStatus>;
  fetchMessages: () => Promise<EmailMessage[]>;
  getConnectionStatus: () => Promise<ConnectionStatus>;
};
