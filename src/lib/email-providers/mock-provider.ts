import { mockEmails } from "@/lib/mock/mock-emails";
import type { EmailProviderAdapter } from "@/lib/email-providers/provider.types";

export class MockEmailProviderAdapter implements EmailProviderAdapter {
  id = "mock" as const;
  name = "Mock Inbox";
  private status = "connected" as const;

  async connect() {
    return this.status;
  }

  async disconnect() {
    return this.status;
  }

  async fetchMessages() {
    return mockEmails;
  }

  async getConnectionStatus() {
    return this.status;
  }
}

export const mockEmailProvider = new MockEmailProviderAdapter();
