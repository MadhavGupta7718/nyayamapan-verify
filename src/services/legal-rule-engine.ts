import { prisma } from "@/db/client";

export type ApplicableRulesQuery = {
  instrumentTypeCode?: string;
  instrumentTypeId?: string;
  stateCode?: string;
  verificationType?: string;
  verificationDate?: Date;
};

export type MeasurementValidation = {
  observedValue: number;
  referenceValue: number;
  permissibleError?: number | null;
};

export class LegalRuleEngine {
  async getApplicableRules(q: ApplicableRulesQuery) {
    const at = q.verificationDate ?? new Date();
    const rules = await prisma.legalRule.findMany({
      where: {
        status: { in: ["ACTIVE", "CONFIGURATION_REQUIRED"] },
        OR: [
          { instrumentTypeId: q.instrumentTypeId ?? undefined },
          { instrumentType: q.instrumentTypeCode ? { code: q.instrumentTypeCode } : undefined },
          { instrumentTypeId: null },
        ],
        AND: [
          {
            OR: [{ stateCode: null }, { stateCode: q.stateCode ?? undefined }],
          },
        ],
      },
      include: {
        versions: {
          where: {
            effectiveFrom: { lte: at },
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: at } }],
          },
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
        source: true,
        instrumentType: true,
      },
    });

    return rules.map((r) => ({
      ruleId: r.id,
      ruleKey: r.ruleKey,
      actName: r.actName,
      ruleName: r.ruleName,
      ruleNumber: r.ruleNumber,
      parameter: r.parameter,
      value: r.versions[0]?.value ?? r.value,
      valueStatus: r.versions[0]?.valueStatus ?? r.valueStatus,
      unit: r.unit,
      requirement: r.requirement,
      ruleVersion: r.versions[0] ?? null,
      sourceNotification: r.sourceNotification,
      sourceDocument: r.sourceDocument,
      amendmentReference: r.amendmentReference,
      status: r.status,
      traceability: {
        act: r.actName,
        rule: r.ruleName,
        ruleNumber: r.ruleNumber,
        notification: r.sourceNotification,
        sourceDocument: r.sourceDocument,
        amendment: r.amendmentReference,
        effectiveFrom: r.versions[0]?.effectiveFrom ?? null,
      },
    }));
  }

  async calculateValidity(input: {
    instrumentTypeCode: string;
    stateCode?: string;
    verificationDate: Date;
  }) {
    const rules = await this.getApplicableRules({
      instrumentTypeCode: input.instrumentTypeCode,
      stateCode: input.stateCode,
      verificationDate: input.verificationDate,
    });

    const validity = rules.find((r) => r.parameter === "verification_period_months");
    if (!validity || validity.valueStatus === "CONFIGURATION_REQUIRED" || !validity.value) {
      return {
        nextDueDate: null as Date | null,
        calculationMethod: "CONFIGURATION_REQUIRED",
        ruleVersionId: validity?.ruleVersion?.id ?? null,
        traceability: validity?.traceability ?? null,
        message:
          "Verification period not configured for this instrument type/state. Do not invent a default period.",
      };
    }

    const months = Number(validity.value);
    if (!Number.isFinite(months) || months <= 0) {
      return {
        nextDueDate: null,
        calculationMethod: "CONFIGURATION_REQUIRED",
        ruleVersionId: validity.ruleVersion?.id ?? null,
        traceability: validity.traceability,
        message: "Invalid configured verification period",
      };
    }

    const next = new Date(input.verificationDate);
    next.setMonth(next.getMonth() + months);
    return {
      nextDueDate: next,
      calculationMethod: `add_months:${months}`,
      ruleVersionId: validity.ruleVersion?.id ?? null,
      traceability: validity.traceability,
      message: `Validity calculated using ${validity.amendmentReference ?? validity.ruleName} ${validity.ruleNumber ?? ""}`.trim(),
    };
  }

  async getVerificationChecklist(input: {
    instrumentTypeCode: string;
    stateCode?: string;
    verificationType?: string;
    verificationDate?: Date;
  }) {
    const type = await prisma.instrumentType.findUnique({
      where: { code: input.instrumentTypeCode },
    });
    const configured = (type?.testParameters as { checklist?: { key: string; label: string; ruleRef?: string }[] } | null)
      ?.checklist;
    if (!configured || configured.length === 0) {
      return {
        items: [
          { key: "physical_condition", label: "Physical condition", ruleRef: "CONFIGURATION_REQUIRED" },
          { key: "display", label: "Display", ruleRef: "CONFIGURATION_REQUIRED" },
          { key: "identification_marking", label: "Identification / marking", ruleRef: "CONFIGURATION_REQUIRED" },
        ],
        note: "Detailed statutory acceptance criteria: CONFIGURATION REQUIRED from applicable schedules.",
      };
    }
    return { items: configured, note: null as string | null };
  }

  validateMeasurement(m: MeasurementValidation) {
    const error = Math.abs(m.observedValue - m.referenceValue);
    if (m.permissibleError == null || Number.isNaN(m.permissibleError)) {
      return {
        error,
        result: "CONFIGURATION_REQUIRED" as const,
        message: "Permissible error not configured — officer must apply applicable rule manually.",
      };
    }
    const pass = error <= m.permissibleError;
    return {
      error,
      result: pass ? ("PASS" as const) : ("FAIL" as const),
      message: pass ? "Within configured permissible error" : "Exceeds configured permissible error",
    };
  }

  async getApplicableGATCs(instrumentTypeId: string, stateId?: string) {
    const now = new Date();
    return prisma.gATCProfile.findMany({
      where: {
        approvalStatus: "APPROVED",
        AND: [
          { OR: [{ approvalStart: null }, { approvalStart: { lte: now } }] },
          { OR: [{ approvalEnd: null }, { approvalEnd: { gte: now } }] },
          stateId ? { stateId } : {},
          {
            authorizations: {
              some: { instrumentTypeId },
            },
          },
        ],
      },
      include: { authorizations: true, state: true },
    });
  }

  async getEligibleAuthority(instrumentTypeId: string) {
    const type = await prisma.instrumentType.findUnique({ where: { id: instrumentTypeId } });
    const eligible = type?.eligibleVerificationAuthorities as string[] | null;
    return eligible ?? ["LMO", "GATC"];
  }

  async getCertificateRequirements(instrumentTypeCode: string) {
    const type = await prisma.instrumentType.findUnique({ where: { code: instrumentTypeCode } });
    const fields = (type?.verificationParameters as { certificateFields?: string[] } | null)
      ?.certificateFields;
    return {
      fields: fields ?? [
        "certificateNumber",
        "instrument",
        "serialNumber",
        "verificationDate",
        "result",
        "authority",
        "qr",
      ],
      note: "Statutory certificate field set may vary — extend via instrument type configuration.",
    };
  }
}

export const legalRuleEngine = new LegalRuleEngine();
