export interface DigiLockerExporter {
  exportCertificate(certificateId: string): Promise<{
    status: "MOCK_QUEUED";
    demo: boolean;
    note: string;
  }>;
}

export class MockDigiLockerExporter implements DigiLockerExporter {
  async exportCertificate(certificateId: string) {
    return {
      status: "MOCK_QUEUED" as const,
      demo: true,
      note: `DigiLocker export stub for ${certificateId} — not a real government integration`,
    };
  }
}

export function getDigiLockerExporter(): DigiLockerExporter {
  return new MockDigiLockerExporter();
}
