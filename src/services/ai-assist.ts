/**
 * Advisory-only AI assistance.
 * HARD BLOCKS: never decide PASS/FAIL, activate rules, issue/revoke certificates,
 * set penalties, or mutate audit logs.
 */

export type AiSuggestion<T> = {
  source: "AI_SUGGESTED";
  confidence: number;
  data: T;
  requiresUserConfirmation: true;
};

export interface AiAssistService {
  extractInstrumentFieldsFromText(text: string): Promise<AiSuggestion<{
    manufacturer?: string;
    model?: string;
    serialNumber?: string;
    capacity?: string;
  }>>;
  suggestMissingDocuments(uploadedTypes: string[], requiredTypes: string[]): Promise<AiSuggestion<{ missing: string[] }>>;
  naturalLanguageToFilters(query: string): Promise<AiSuggestion<Record<string, string>>>;
}

export class MockAiAssistService implements AiAssistService {
  async extractInstrumentFieldsFromText(text: string) {
    const serial = text.match(/[A-Z0-9-]{6,}/i)?.[0];
    return {
      source: "AI_SUGGESTED" as const,
      confidence: 0.55,
      requiresUserConfirmation: true as const,
      data: {
        serialNumber: serial,
        manufacturer: text.toLowerCase().includes("avery") ? "Avery" : undefined,
      },
    };
  }

  async suggestMissingDocuments(uploadedTypes: string[], requiredTypes: string[]) {
    const missing = requiredTypes.filter((r) => !uploadedTypes.includes(r));
    return {
      source: "AI_SUGGESTED" as const,
      confidence: 0.9,
      requiresUserConfirmation: true as const,
      data: { missing },
    };
  }

  async naturalLanguageToFilters(query: string) {
    const q = query.toLowerCase();
    const filters: Record<string, string> = {};
    if (q.includes("delhi")) filters.state = "DL";
    if (q.includes("expir")) filters.expiryWithinDays = "30";
    if (q.includes("revok")) filters.status = "REVOKED";
    return {
      source: "AI_SUGGESTED" as const,
      confidence: 0.7,
      requiresUserConfirmation: true as const,
      data: filters,
    };
  }
}

export function getAiAssistService(): AiAssistService {
  // Real provider can be wired when AI_API_KEY is present; still advisory-only.
  return new MockAiAssistService();
}
