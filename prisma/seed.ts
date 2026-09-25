/**
 * Seeds a coherent reference dataset for local development and evaluation. All organisations,
 * people and instruments are fictional. Every application carries a status history that follows
 * the real workflow, and certificates exist only for applications that completed it.
 */
import { PrismaClient, Role, type ApplicationStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { customAlphabet, nanoid } from "nanoid";
import { dateOnly, payloadHash, type CertificatePayload } from "../src/lib/certificate-integrity";
import { PlatformHmacSigner } from "../src/services/certificate-signer";
import { syncGeography } from "./geo-sync";

config({ path: ".env" });

const prisma = new PrismaClient();
const PASSWORD = process.env.SEED_USER_PASSWORD || "Verify@2026";
const AUTHORITY = process.env.NEXT_PUBLIC_ISSUING_AUTHORITY || "Legal Metrology Verification Authority";
const certSerial = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 6);
const DAY = 86_400_000;

let seed = 20260924;
function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
const daysFromNow = (d: number) => new Date(Date.now() + d * DAY);
function addMonths(d: Date, m: number) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + m);
  return r;
}

const PATH: ApplicationStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "DOCUMENT_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "ASSIGNED",
  "FIELD_VERIFICATION",
  "INSPECTION_COMPLETED",
  "PASS",
  "STAMPING",
  "CERTIFICATE_GENERATED",
  "CERTIFICATE_ISSUED",
  "ACTIVE",
];

function historyFor(status: ApplicationStatus): ApplicationStatus[] {
  const upto = (s: ApplicationStatus) => PATH.slice(0, PATH.indexOf(s) + 1);
  switch (status) {
    case "RETURNED":
      return [...upto("DOCUMENT_REVIEW"), "RETURNED"];
    case "REJECTED":
      return [...upto("DOCUMENT_REVIEW"), "REJECTED"];
    case "FAIL":
      return [...upto("INSPECTION_COMPLETED"), "FAIL"];
    case "CANCELLED":
      return [...upto("SUBMITTED"), "CANCELLED"];
    case "EXPIRED":
    case "REVOKED":
    case "SUSPENDED":
      return [...upto("ACTIVE"), status];
    default:
      return upto(status);
  }
}

const REASONS: Partial<Record<ApplicationStatus, string>> = {
  RETURNED: "Previous certificate copy is illegible; please upload a clearer scan.",
  REJECTED: "Instrument model does not hold a valid approval of model.",
  FAIL: "Observed error exceeded the configured tolerance during the test.",
  CANCELLED: "Withdrawn by applicant — instrument decommissioned.",
  REVOKED: "Seal found tampered during market surveillance inspection.",
  SUSPENDED: "Complaint under investigation; certificate suspended pending re-inspection.",
};

async function reset() {
  const tables = [
    prisma.publicVerification,
    prisma.qrToken,
    prisma.certificateRevocation,
    prisma.certificateVersion,
    prisma.certificate,
    prisma.stampingRecord,
    prisma.inspectionPhoto,
    prisma.inspectionMeasurement,
    prisma.inspectionTest,
    prisma.inspectionChecklist,
    prisma.gpsRecord,
    prisma.inspection,
    prisma.verificationSchedule,
    prisma.verificationAssignment,
    prisma.applicationDocument,
    prisma.applicationStatusHistory,
    prisma.paymentTransaction,
    prisma.payment,
    prisma.application,
    prisma.notification,
    prisma.auditLog,
    prisma.gATCInstrumentAuthorization,
    prisma.gATCProfile,
    prisma.legalRuleVersion,
    prisma.legalRule,
    prisma.ruleAmendment,
    prisma.legalSource,
    prisma.instrument,
    prisma.instrumentModel,
    prisma.instrumentType,
    prisma.license,
    prisma.user,
    prisma.organization,
    prisma.district,
    prisma.stateRuleConfiguration,
    prisma.state,
    prisma.feeRule,
    prisma.notificationTemplate,
    prisma.systemSetting,
    prisma.enforcementAction,
    prisma.complaint,
  ] as unknown as { deleteMany: () => Promise<unknown> }[];
  for (const t of tables) await t.deleteMany();
}

async function main() {
  console.log("Seeding reference dataset…");
  await reset();
  const signer = new PlatformHmacSigner();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ---------------------------------------------------------------- geography
  const geo = [
    { code: "DL", name: "Delhi", nameHi: "दिल्ली", districts: [["New Delhi", "नई दिल्ली", 28.6139, 77.209], ["South Delhi", "दक्षिण दिल्ली", 28.5245, 77.1855], ["North West Delhi", "उत्तर पश्चिम दिल्ली", 28.7186, 77.0685]] },
    { code: "MH", name: "Maharashtra", nameHi: "महाराष्ट्र", districts: [["Mumbai City", "मुंबई शहर", 19.076, 72.8777], ["Pune", "पुणे", 18.5204, 73.8567]] },
    { code: "KA", name: "Karnataka", nameHi: "कर्नाटक", districts: [["Bengaluru Urban", "बेंगलुरु शहरी", 12.9716, 77.5946], ["Mysuru", "मैसूरु", 12.2958, 76.6394]] },
    { code: "GJ", name: "Gujarat", nameHi: "गुजरात", districts: [["Ahmedabad", "अहमदाबाद", 23.0225, 72.5714]] },
    { code: "WB", name: "West Bengal", nameHi: "पश्चिम बंगाल", districts: [["Kolkata", "कोलकाता", 22.5726, 88.3639]] },
    { code: "TN", name: "Tamil Nadu", nameHi: "तमिल नाडु", districts: [["Chennai", "चेन्नई", 13.0827, 80.2707]] },
    { code: "UP", name: "Uttar Pradesh", nameHi: "उत्तर प्रदेश", districts: [["Lucknow", "लखनऊ", 26.8467, 80.9462], ["Gautam Buddha Nagar", "गौतम बुद्ध नगर", 28.5355, 77.391]] },
  ] as const;

  const states: Record<string, { id: string; code: string; districts: { id: string; name: string; lat: number; lng: number }[] }> = {};
  for (const g of geo) {
    const s = await prisma.state.create({ data: { code: g.code, name: g.name, nameHi: g.nameHi } });
    const ds = [];
    for (const [name, nameHi, lat, lng] of g.districts) {
      const d = await prisma.district.create({ data: { name, nameHi, stateId: s.id } });
      ds.push({ id: d.id, name, lat, lng });
    }
    states[g.code] = { id: s.id, code: g.code, districts: ds };
  }
  const geoSync = await syncGeography(prisma);
  console.log(`Geography: ${geoSync.statesCreated} more states/UTs and ${geoSync.districtsCreated} more districts from the reference list.`);

  // ---------------------------------------------------------------- organisations
  const orgDefs = [
    { name: "Shree Ganesh Kirana Stores", type: "TRADER", state: "DL", d: 0, gstin: "07AAHFS1234K1Z5" },
    { name: "Konkan Fuels LLP", type: "FUEL_STATION", state: "MH", d: 0, gstin: "27AAKFK4521M1Z2" },
    { name: "Nandi Pharma Distributors", type: "TRADER", state: "KA", d: 0, gstin: "29AANFN7788P1Z9" },
    { name: "Sabarmati Agro Weighbridge", type: "INSTITUTION", state: "GJ", d: 0, gstin: "24AAGCS3310Q1Z1" },
    { name: "Yamuna Wholesale Mandi Traders", type: "TRADER", state: "DL", d: 2, gstin: "07AACFY9087R1Z6" },
    { name: "Deccan Jewellers", type: "TRADER", state: "MH", d: 1, gstin: "27AAEFD2231H1Z3" },
    { name: "Hooghly Cold Chain Pvt Ltd", type: "PACKER", state: "WB", d: 0, gstin: "19AAHCH5561J1Z8" },
    { name: "Gomti Fuel Point", type: "FUEL_STATION", state: "UP", d: 0, gstin: "09AAGFG6612L1Z4" },
  ] as const;
  const orgs = [];
  for (const o of orgDefs) {
    const district = states[o.state].districts[o.d];
    orgs.push(
      await prisma.organization.create({
        data: {
          name: o.name,
          type: o.type,
          gstin: o.gstin,
          stateId: states[o.state].id,
          districtId: district.id,
          address: `${Math.floor(rand() * 200) + 1}, Market Road, ${district.name}`,
          licenses: {
            create: {
              licenseType: "Statutory registration / licence",
              status: "CONFIGURATION_REQUIRED",
              notes: "To be verified by the competent Legal Metrology authority",
            },
          },
        },
      })
    );
  }
  const stateOfOrg = (i: number) => orgDefs[i].state;

  // ---------------------------------------------------------------- people
  const mk = (email: string, name: string, role: Role, { districtIds, ...extra }: { stateId?: string; organizationId?: string; mobile?: string; districtIds?: string[] } = {}) =>
    prisma.user.create({
      data: {
        email,
        name,
        role,
        passwordHash,
        lastLoginAt: daysFromNow(-rand() * 5),
        ...extra,
        jurisdiction: districtIds?.length ? { connect: districtIds.map((id) => ({ id })) } : undefined,
      },
    });

  const admin = await mk("admin@nyayamapan.local", "Anjali Verma", Role.SUPER_ADMIN);
  const stateDl = await mk("state@nyayamapan.local", "Rakesh Sharma", Role.STATE_ADMIN, { stateId: states.DL.id });
  await mk("state.mh@nyayamapan.local", "Sunita Patil", Role.STATE_ADMIN, { stateId: states.MH.id });
  // Each LMO covers districts of their state (by index into the seeded districts above); auto-assignment uses this.
  const lmoDefs: [string, string, string, number[]][] = [
    ["lmo@nyayamapan.local", "Vikram Singh", "DL", [0, 1]],
    ["lmo2@nyayamapan.local", "Pooja Nair", "DL", [2, 0]],
    ["lmo3@nyayamapan.local", "Sachin Kulkarni", "MH", [0, 1]],
    ["lmo4@nyayamapan.local", "Kavya Reddy", "KA", [0, 1]],
    ["lmo5@nyayamapan.local", "Harish Desai", "GJ", [0]],
    ["lmo6@nyayamapan.local", "Arnab Ghosh", "WB", [0]],
    ["lmo7@nyayamapan.local", "Neha Tripathi", "UP", [0, 1]],
  ];
  const lmos: { id: string; name: string; state: string; districtIds: string[] }[] = [];
  for (const [email, name, st, idx] of lmoDefs) {
    const districtIds = idx.map((n) => states[st].districts[n].id);
    const u = await mk(email, name, Role.LMO, { stateId: states[st].id, mobile: `98${Math.floor(10000000 + rand() * 89999999)}`, districtIds });
    lmos.push({ id: u.id, name, state: st, districtIds });
  }
  await mk("inspector@nyayamapan.local", "Farhan Qureshi", Role.INSPECTOR, { stateId: states.DL.id });
  await mk("gatc.admin@nyayamapan.local", "Meera Iyer", Role.GATC_ADMIN, { stateId: states.DL.id });
  const gatcOfficer = await mk("gatc@nyayamapan.local", "Rohit Bansal", Role.GATC_OFFICER, { stateId: states.DL.id });
  await mk("auditor@nyayamapan.local", "Lakshmi Menon", Role.AUDITOR);

  const owners: string[] = [];
  const ownerNames = ["Ramesh Gupta", "Imran Shaikh", "Suresh Gowda", "Bhavesh Patel", "Manoj Aggarwal", "Priya Joshi", "Debashis Roy", "Alok Mishra"];
  for (let i = 0; i < orgs.length; i++) {
    const email = i === 0 ? "business@nyayamapan.local" : `business${i + 1}@nyayamapan.local`;
    const u = await mk(email, ownerNames[i], Role.BUSINESS_USER, {
      organizationId: orgs[i].id,
      stateId: states[stateOfOrg(i)].id,
      mobile: `9${Math.floor(100000000 + rand() * 899999999)}`,
    });
    owners.push(u.id);
  }

  // ---------------------------------------------------------------- instrument master
  const checklist = [
    { key: "physical_condition", label: "Physical condition and cleanliness" },
    { key: "identification_marking", label: "Identification and mandatory markings" },
    { key: "model_approval_mark", label: "Model approval mark present" },
    { key: "seal_integrity", label: "Previous seal / stamp integrity" },
    { key: "display_indicator", label: "Display / indicator legible" },
  ];
  const typeDefs = [
    { code: "WEIGHTS", name: "Weights", nameHi: "बाट", listed: true, cap: ["1 kg", "5 kg", "10 kg", "20 kg"], unit: "kg" },
    { code: "CAPACITY_MEASURES", name: "Capacity measures", nameHi: "धारिता माप", listed: true, cap: ["500 mL", "1 L", "5 L"], unit: "L" },
    { code: "LENGTH_MEASURES", name: "Length measures", nameHi: "लंबाई माप", listed: true, cap: ["1 m", "2 m"], unit: "m" },
    { code: "TAPE", name: "Measuring tape", nameHi: "मापक टेप", listed: true, cap: ["15 m", "30 m"], unit: "m" },
    { code: "BEAM_SCALE", name: "Beam scale", nameHi: "बीम स्केल", listed: true, cap: ["50 kg", "100 kg"], unit: "kg" },
    { code: "COUNTER_MACHINE", name: "Counter machine", nameHi: "काउंटर मशीन", listed: true, cap: ["20 kg", "30 kg"], unit: "kg" },
    { code: "FUEL_DISPENSER", name: "Fuel dispenser (petrol / diesel)", nameHi: "ईंधन डिस्पेंसर (पेट्रोल / डीज़ल)", listed: true, cap: ["Nozzle 1–2", "Nozzle 1–4"], unit: "L" },
    { code: "NAWI", name: "Non-automatic weighing instrument", nameHi: "गैर-स्वचालित तौल उपकरण", listed: false, cap: ["30 kg", "60 kg", "300 kg"], unit: "kg" },
    { code: "WEIGHBRIDGE", name: "Weighbridge", nameHi: "धर्म कांटा", listed: false, cap: ["60 t", "100 t"], unit: "t" },
  ] as const;
  const types: Record<string, { id: string; name: string; listed: boolean; cap: readonly string[]; unit: string }> = {};
  for (const t of typeDefs) {
    const it = await prisma.instrumentType.create({
      data: {
        code: t.code,
        name: t.name,
        nameHi: t.nameHi,
        category: "Weights & Measures",
        requiredDocuments: ["previous_certificate", "model_approval", "purchase_invoice"],
        requiredPhotos: ["instrument_front", "serial_plate", "display", "seal"],
        eligibleVerificationAuthorities: ["LMO", "GATC"],
        testParameters: { checklist: checklist.map((c) => ({ ...c, ruleRef: "CONFIGURATION_REQUIRED" })) },
      },
    });
    types[t.code] = { id: it.id, name: t.name, listed: t.listed, cap: t.cap, unit: t.unit };
  }

  // ---------------------------------------------------------------- legal rules (sourced values only)
  const source = await prisma.legalSource.create({
    data: {
      title: "Legal Metrology (General) Seventh Amendment Rules, 2025",
      documentUrl:
        "https://consumeraffairs.gov.in/public/upload/files/2025.12.18%20Gen%20Rules%207th%20Amendment%202%20yr%20verification%20period%5F1766504014.pdf",
      publisher: "Department of Consumer Affairs",
      publishedAt: new Date("2025-12-18"),
      notes: "G.S.R. 905(E)",
    },
  });
  const validityVersion: Record<string, string> = {};
  for (const t of typeDefs.filter((x) => x.listed)) {
    const rule = await prisma.legalRule.create({
      data: {
        ruleKey: `LM.GR.27.2.A.${t.code}`,
        actName: "Legal Metrology Act, 2009",
        ruleName: "Legal Metrology (General) Rules, 2011",
        ruleNumber: "27(2)(a)",
        instrumentTypeId: types[t.code].id,
        requirement: "Period of re-verification for the listed categories",
        parameter: "verification_period_months",
        value: "24",
        unit: "months",
        valueStatus: "SET",
        sourceNotification: "G.S.R. 905(E)",
        amendmentReference: "Legal Metrology (General) Seventh Amendment Rules, 2025",
        sourceDocument: source.documentUrl,
        sourceId: source.id,
        status: "ACTIVE",
        versions: {
          create: {
            versionNumber: 1,
            value: "24",
            valueStatus: "SET",
            effectiveFrom: new Date("2025-12-18"),
            changeReason: "Seventh Amendment Rules, 2025 — Rule 27(2)(a)",
            approvedById: admin.id,
            snapshot: {
              text: "twenty-four months for all weights, capacity measures, length measures, tape, beam scale, counter machine and fuel dispensers (petrol and diesel)",
            },
          },
        },
      },
      include: { versions: true },
    });
    validityVersion[t.code] = rule.versions[0].id;
  }
  await prisma.legalRule.create({
    data: {
      ruleKey: "LM.GR.27A.SPECIAL",
      actName: "Legal Metrology Act, 2009",
      ruleName: "Legal Metrology (General) Rules, 2011",
      ruleNumber: "27A",
      requirement: "Special provision for re-verification — detailed conditions to be loaded from the notification",
      parameter: "special_reverification_provision",
      valueStatus: "CONFIGURATION_REQUIRED",
      sourceNotification: "G.S.R. 242(E)",
      amendmentReference: "Legal Metrology (General) Second Amendment Rules, 2025",
      status: "UNDER_REVIEW",
      versions: { create: { versionNumber: 1, valueStatus: "CONFIGURATION_REQUIRED", effectiveFrom: new Date("2025-09-01"), changeReason: "Initial version" } },
    },
  });
  await prisma.legalRule.create({
    data: {
      ruleKey: "LM.MPE.GENERIC",
      actName: "Legal Metrology Act, 2009",
      ruleName: "Legal Metrology (General) Rules, 2011",
      requirement: "Maximum permissible error tables per instrument class",
      parameter: "permissible_error",
      valueStatus: "CONFIGURATION_REQUIRED",
      status: "CONFIGURATION_REQUIRED",
      versions: { create: { versionNumber: 1, valueStatus: "CONFIGURATION_REQUIRED", effectiveFrom: new Date("2011-04-01"), changeReason: "Initial version" } },
    },
  });
  await prisma.legalRule.create({
    data: {
      ruleKey: "LM.GR.NAWI.PERIOD",
      actName: "Legal Metrology Act, 2009",
      ruleName: "Legal Metrology (General) Rules, 2011",
      instrumentTypeId: types.NAWI.id,
      requirement: "Re-verification period for non-automatic weighing instruments",
      parameter: "verification_period_months",
      valueStatus: "CONFIGURATION_REQUIRED",
      status: "DRAFT",
      versions: { create: { versionNumber: 1, valueStatus: "CONFIGURATION_REQUIRED", effectiveFrom: new Date("2026-01-01"), changeReason: "Awaiting source notification" } },
    },
  });
  await prisma.feeRule.create({
    data: {
      code: "VERIFICATION_FEE",
      description: "Verification fee — load from the applicable State Enforcement Rules",
      valueStatus: "CONFIGURATION_REQUIRED",
      sourceRef: "CONFIGURATION REQUIRED",
    },
  });

  // ---------------------------------------------------------------- GATCs
  const gatcDefs = [
    { name: "Capital Calibration & Testing Centre", no: "GATC/DL/2024/017", state: "DL", d: 0 },
    { name: "Western Metrology Services", no: "GATC/MH/2023/042", state: "MH", d: 1 },
    { name: "Silicon Precision Labs", no: "GATC/KA/2024/008", state: "KA", d: 0 },
  ] as const;
  const gatcs = [];
  for (const g of gatcDefs) {
    const d = states[g.state].districts[g.d];
    gatcs.push(
      await prisma.gATCProfile.create({
        data: {
          name: g.name,
          approvalNumber: g.no,
          stateId: states[g.state].id,
          districtId: d.id,
          address: `Industrial Area, ${d.name}`,
          approvalStatus: "APPROVED",
          approvalStart: new Date("2024-01-01"),
          approvalEnd: new Date("2028-12-31"),
          latitude: d.lat + 0.02,
          longitude: d.lng - 0.02,
          authorizations: {
            create: ["WEIGHTS", "CAPACITY_MEASURES", "COUNTER_MACHINE", "FUEL_DISPENSER"].map((c) => ({
              instrumentTypeId: types[c].id,
              sourceNote: "Scope to be confirmed against the GATC approval order",
            })),
          },
        },
      })
    );
  }
  await prisma.user.update({ where: { id: gatcOfficer.id }, data: { gatcId: gatcs[0].id } });
  const GATC_TYPES = ["WEIGHTS", "COUNTER_MACHINE", "FUEL_DISPENSER", "CAPACITY_MEASURES"];
  let gatcQueueSeeded = false;

  // ---------------------------------------------------------------- instruments & applications
  const makers: Record<string, [string, string][]> = {
    WEIGHTS: [["Avery India", "CI-W"], ["Kalpana Scales", "KW"]],
    CAPACITY_MEASURES: [["Metrix Brass", "CM"], ["Kalpana Scales", "KCM"]],
    LENGTH_MEASURES: [["Precise Rulers", "PR"]],
    TAPE: [["Freemans", "FT"], ["Stanley India", "ST"]],
    BEAM_SCALE: [["Avery India", "BS"], ["Samson Weighing", "SB"]],
    COUNTER_MACHINE: [["Essae Teraoka", "DS-252"], ["Phoenix Scales", "PX"]],
    FUEL_DISPENSER: [["Tokheim India", "Quantium"], ["Gilbarco Veeder-Root", "Encore"]],
    NAWI: [["Essae Teraoka", "DS-852"], ["Mettler Toledo", "ICS"]],
    WEIGHBRIDGE: [["Avery India", "WB-60"], ["Leotronics", "LT-100"]],
  };
  const orgTypes: Record<string, string[]> = {
    TRADER: ["WEIGHTS", "COUNTER_MACHINE", "NAWI", "BEAM_SCALE", "CAPACITY_MEASURES"],
    FUEL_STATION: ["FUEL_DISPENSER", "CAPACITY_MEASURES"],
    INSTITUTION: ["WEIGHBRIDGE", "NAWI", "TAPE"],
    PACKER: ["NAWI", "WEIGHTS", "LENGTH_MEASURES"],
  };

  // Target status per application, weighted towards a realistic mix.
  const plan: ApplicationStatus[] = [
    ...Array(14).fill("ACTIVE"),
    ...Array(4).fill("EXPIRED"),
    "REVOKED",
    "SUSPENDED",
    ...Array(4).fill("SUBMITTED"),
    ...Array(3).fill("DOCUMENT_REVIEW"),
    ...Array(4).fill("APPROVED"),
    ...Array(3).fill("SCHEDULED"),
    ...Array(4).fill("ASSIGNED"),
    "FIELD_VERIFICATION",
    "STAMPING",
    "RETURNED",
    "REJECTED",
    "FAIL",
    "CANCELLED",
    ...Array(2).fill("DRAFT"),
  ];

  let instrumentSeq = 1;
  let appSeq = 1;
  let certCount = 0;
  const year = new Date().getFullYear();
  const liveTokens: string[] = [];

  for (let i = 0; i < plan.length; i++) {
    const status = plan[i];
    const orgIdx = i % orgs.length;
    const org = orgs[orgIdx];
    const st = states[stateOfOrg(orgIdx)];
    const district = st.districts.find((d) => d.id === org.districtId) ?? st.districts[0];
    // One approved Delhi application goes the GATC route and waits in the GATC Admin's queue.
    const gatcQueueSample = status === "APPROVED" && st.code === "DL" && !gatcQueueSeeded;
    if (gatcQueueSample) gatcQueueSeeded = true;
    const typeCode = gatcQueueSample ? "WEIGHTS" : pick(orgTypes[orgDefs[orgIdx].type]);
    const type = types[typeCode];
    const [manufacturer, modelName] = pick(makers[typeCode]);
    const lat = district.lat + (rand() - 0.5) * 0.08;
    const lng = district.lng + (rand() - 0.5) * 0.08;

    // Certified applications are dated so their validity window matches their final state.
    const isCertified = ["ACTIVE", "EXPIRED", "REVOKED", "SUSPENDED"].includes(status);
    const expiringSoon = status === "ACTIVE" && i % 5 === 0;
    const verifiedAt =
      status === "EXPIRED"
        ? daysFromNow(-(24 * 30 + 20 + Math.floor(rand() * 90)))
        : expiringSoon
          ? daysFromNow(-(24 * 30 - 10 - Math.floor(rand() * 40)))
          : daysFromNow(-(20 + Math.floor(rand() * 300)));
    const validUntil = isCertified && type.listed ? addMonths(verifiedAt, 24) : null;
    const certifiedApp = isCertified && (status !== "EXPIRED" || validUntil);
    const effectiveStatus: ApplicationStatus = status === "EXPIRED" && !validUntil ? "ACTIVE" : status;

    const instrument = await prisma.instrument.create({
      data: {
        instrumentCode: `INS-${st.code}-${String(instrumentSeq++).padStart(6, "0")}`,
        instrumentTypeId: type.id,
        manufacturer,
        modelName,
        serialNumber: `${modelName.replace(/[^A-Z0-9]/gi, "").slice(0, 4).toUpperCase()}${Math.floor(100000 + rand() * 899999)}`,
        capacity: pick(type.cap),
        accuracy: "Class III",
        unit: type.unit,
        yearOfManufacture: 2016 + Math.floor(rand() * 9),
        organizationId: org.id,
        stateId: st.id,
        districtId: district.id,
        locationLabel: typeCode === "FUEL_DISPENSER" ? `Dispensing unit ${1 + (i % 4)}` : `Counter ${1 + (i % 3)}`,
        address: org.address,
        latitude: lat,
        longitude: lng,
        verificationStatus: certifiedApp
          ? effectiveStatus === "EXPIRED"
            ? "EXPIRED"
            : effectiveStatus === "ACTIVE"
              ? expiringSoon
                ? "EXPIRING_SOON"
                : "VERIFIED"
              : effectiveStatus
          : "PENDING",
        lastVerificationAt: certifiedApp ? verifiedAt : null,
        nextDueDate: certifiedApp ? validUntil : null,
      },
    });

    const history = historyFor(effectiveStatus);
    const createdAt = certifiedApp ? new Date(verifiedAt.getTime() - 12 * DAY) : daysFromNow(-(1 + Math.floor(rand() * 20)));
    const step = certifiedApp ? DAY : Math.max(3_600_000, (Date.now() - createdAt.getTime()) / (history.length + 1));
    const officer = lmos.find((l) => l.districtIds.includes(district.id)) ?? lmos.find((l) => l.state === st.code) ?? lmos[0];
    const useGatc = gatcQueueSample || (st.code === "DL" && i % 4 === 0 && GATC_TYPES.includes(typeCode));
    const fieldOfficerId = useGatc ? gatcOfficer.id : officer.id;

    const app = await prisma.application.create({
      data: {
        applicationNumber: `LMA-${year}-${String(appSeq++).padStart(6, "0")}`,
        organizationId: org.id,
        instrumentId: instrument.id,
        createdById: owners[orgIdx],
        verificationType: certifiedApp || i % 3 ? "RE_VERIFICATION" : "INITIAL_VERIFICATION",
        status: effectiveStatus,
        declarationAccepted: effectiveStatus !== "DRAFT",
        preferredDate: daysFromNow(3 + (i % 10)),
        preferredSlot: pick(["09:00-11:00", "11:00-13:00", "14:00-16:00"]),
        preferredGatcId: useGatc ? gatcs[0].id : null,
        ruleVersionId: type.listed ? validityVersion[typeCode] : null,
        createdAt,
        statusHistory: {
          create: history.map((s, idx) => ({
            previousStatus: idx === 0 ? null : history[idx - 1],
            newStatus: s,
            changedById: idx <= 1 ? owners[orgIdx] : ["SCHEDULED", "ASSIGNED", "DOCUMENT_REVIEW", "APPROVED", "RETURNED", "REJECTED"].includes(s) ? stateDl.id : officer.id,
            reason: REASONS[s],
            changedAt: new Date(createdAt.getTime() + idx * step),
          })),
        },
        documents:
          effectiveStatus === "DRAFT"
            ? undefined
            : {
                create: ["previous_certificate", "model_approval", "purchase_invoice"].map((docType) => ({
                  documentType: docType,
                  fileName: `${docType}.pdf`,
                  mimeType: "application/pdf",
                  sizeBytes: 120_000 + Math.floor(rand() * 400_000),
                  storageKey: `applications/seed/${docType}-${i}.pdf`,
                  checksum: nanoid(32),
                  uploadedById: owners[orgIdx],
                  status: history.includes("APPROVED") ? "VERIFIED" : "UPLOADED",
                })),
              },
      },
    });

    const reached = (s: ApplicationStatus) => history.includes(s);
    if (!reached("SCHEDULED")) continue;

    const scheduledDate = certifiedApp
      ? new Date(verifiedAt.getTime() - 0)
      : reached("FIELD_VERIFICATION")
        ? daysFromNow(0)
        : daysFromNow(1 + (i % 9));
    scheduledDate.setHours(0, 0, 0, 0);
    const assignment = await prisma.verificationAssignment.create({
      data: {
        applicationId: app.id,
        officerId: fieldOfficerId,
        gatcId: useGatc ? gatcs[0].id : null,
        authorityType: useGatc ? "GATC" : "LMO",
        status: reached("INSPECTION_COMPLETED") ? "COMPLETED" : "ASSIGNED",
        assignedAt: new Date(createdAt.getTime() + 4 * step),
      },
    });
    await prisma.verificationSchedule.create({
      data: {
        applicationId: app.id,
        assignmentId: assignment.id,
        scheduledDate,
        timeSlot: pick(["09:00-11:00", "11:00-13:00", "14:00-16:00"]),
        status: reached("INSPECTION_COMPLETED") ? "COMPLETED" : "SCHEDULED",
      },
    });

    if (!reached("FIELD_VERIFICATION")) continue;
    const completed = reached("INSPECTION_COMPLETED");
    const failed = effectiveStatus === "FAIL";
    const inspection = await prisma.inspection.create({
      data: {
        applicationId: app.id,
        officerId: fieldOfficerId,
        startedAt: scheduledDate,
        completedAt: completed ? new Date(scheduledDate.getTime() + 2 * 3_600_000) : null,
        overallResult: !completed ? "PENDING" : failed ? "FAIL" : "PASS",
        serialConfirmed: completed,
        observations: failed ? "Error beyond tolerance at 50% load." : completed ? "Instrument conforms on all checks performed." : null,
        checklists: {
          create: checklist.map((c, idx) => ({
            itemKey: c.key,
            itemLabel: c.label,
            result: !completed ? (idx < 2 ? "PASS" : "PENDING") : failed && c.key === "display_indicator" ? "FAIL" : "PASS",
            ruleRef: "CONFIGURATION_REQUIRED",
          })),
        },
        tests: completed
          ? {
              create: [
                {
                  testName: "Accuracy at nominal load",
                  expectedValue: "10.000",
                  observedValue: failed ? "10.180" : "10.002",
                  unit: type.unit,
                  permissibleError: "CONFIGURATION_REQUIRED",
                  calculatedError: failed ? "0.180" : "0.002",
                  result: failed ? "FAIL" : "PENDING",
                },
              ],
            }
          : undefined,
        gpsRecords: { create: { latitude: lat, longitude: lng, accuracy: 8 + rand() * 20, purpose: "ARRIVAL", userId: fieldOfficerId, capturedAt: scheduledDate } },
      },
    });

    if (!reached("STAMPING")) continue;
    await prisma.stampingRecord.create({
      data: {
        inspectionId: inspection.id,
        stampIdentifier: `STP-${st.code}-${Math.floor(10000 + rand() * 89999)}`,
        stampType: "Lead / wire seal",
        stampDate: new Date(scheduledDate.getTime() + 3 * 3_600_000),
        authority: useGatc ? gatcDefs[0].name : `Legal Metrology, ${st.code}`,
        officerId: fieldOfficerId,
      },
    });

    if (!certifiedApp) continue;
    const certificateNumber = `LMVC-${st.code}-${verifiedAt.getFullYear()}-${certSerial()}`;
    const payload: CertificatePayload = {
      certificateNumber,
      applicationNumber: app.applicationNumber,
      instrumentCode: instrument.instrumentCode,
      instrumentTypeCode: typeCode,
      manufacturer,
      modelName,
      serialNumber: instrument.serialNumber,
      organizationId: org.id,
      verificationDate: dateOnly(verifiedAt)!,
      validUntil: dateOnly(validUntil),
      result: "PASS",
      issuingAuthority: AUTHORITY,
      ruleVersionId: type.listed ? validityVersion[typeCode] : null,
    };
    const hash = payloadHash(payload);
    const signature = await signer.sign({ certificateNumber, content: hash });
    const certStatus = effectiveStatus === "ACTIVE" ? "ACTIVE" : effectiveStatus === "EXPIRED" ? "EXPIRED" : effectiveStatus === "REVOKED" ? "REVOKED" : "SUSPENDED";
    const token = nanoid(24);
    const cert = await prisma.certificate.create({
      data: {
        certificateNumber,
        applicationId: app.id,
        instrumentId: instrument.id,
        status: certStatus,
        verificationDate: verifiedAt,
        validUntil,
        result: "PASS",
        issuingAuthority: AUTHORITY,
        officerName: useGatc ? "Rohit Bansal" : officer.name,
        ruleVersionId: payload.ruleVersionId,
        validityCalcMethod: validUntil ? "add_months:24" : "CONFIGURATION_REQUIRED",
        contentHash: hash,
        signatureMeta: signature,
        publicFields: {
          certificateNumber,
          instrumentType: type.name,
          manufacturer,
          modelName,
          serialNumber: instrument.serialNumber,
          verificationDate: payload.verificationDate,
          validUntil: payload.validUntil,
          result: "PASS",
          issuingAuthority: AUTHORITY,
        },
        createdAt: verifiedAt,
        versions: { create: { version: 1, snapshot: { payload, hash, signature } } },
        qrToken: { create: { token } },
      },
      include: { qrToken: true },
    });
    certCount++;
    if (certStatus === "ACTIVE") liveTokens.push(token);
    await prisma.instrument.update({ where: { id: instrument.id }, data: { certificateNumber } });
    if (certStatus === "REVOKED" || certStatus === "SUSPENDED") {
      await prisma.certificateRevocation.create({
        data: { certificateId: cert.id, reason: `[${certStatus === "REVOKED" ? "REVOKE" : "SUSPEND"}] ${REASONS[certStatus]}`, revokedById: stateDl.id, revokedAt: daysFromNow(-5) },
      });
    }
    // A handful of public scans to populate verification analytics.
    const scans = Math.floor(rand() * 4);
    for (let s = 0; s < scans; s++) {
      await prisma.publicVerification.create({
        data: { qrTokenId: cert.qrToken!.id, result: certStatus === "ACTIVE" ? "VALID" : certStatus, verifiedAt: daysFromNow(-rand() * 30) },
      });
    }
    await prisma.notification.create({
      data: {
        userId: owners[orgIdx],
        type: "CERTIFICATE_ISSUED",
        title: `Certificate ${certificateNumber} issued`,
        body: `Verification certificate issued for application ${app.applicationNumber}.`,
        meta: { certificateId: cert.id, certificateNumber, applicationNumber: app.applicationNumber },
        readAt: rand() > 0.4 ? new Date() : null,
        createdAt: verifiedAt,
      },
    });
  }

  // ---------------------------------------------------------------- notifications & settings
  const lmo = lmos[0];
  await prisma.notification.createMany({
    data: [
      { userId: lmo.id, type: "ASSIGNMENT", title: "New verification assigned", body: "You have new field verifications scheduled this week.", createdAt: daysFromNow(-1) },
      { userId: stateDl.id, type: "QUEUE", title: "Applications awaiting review", body: "New applications are waiting for document review.", createdAt: daysFromNow(-0.2) },
      { userId: admin.id, type: "RULES", title: "Rule pending review", body: "Rule 27A special provision is awaiting review.", createdAt: daysFromNow(-2) },
      { userId: owners[0], type: "APPLICATION_STATUS", title: "Application scheduled", body: "Your verification visit has been scheduled.", createdAt: daysFromNow(-0.5) },
    ],
  });
  await prisma.notificationTemplate.createMany({
    data: [
      {
        key: "APPLICATION_SUBMITTED",
        channel: "IN_APP",
        subjectEn: "Application submitted",
        subjectHi: "आवेदन जमा किया गया",
        bodyEn: "Your verification application has been submitted.",
        bodyHi: "आपका सत्यापन आवेदन जमा कर दिया गया है।",
      },
      {
        key: "CERTIFICATE_EXPIRING",
        channel: "IN_APP",
        subjectEn: "Certificate due for re-verification",
        subjectHi: "प्रमाणपत्र का पुनः सत्यापन देय",
        bodyEn: "A verification certificate is approaching its due date.",
        bodyHi: "एक सत्यापन प्रमाणपत्र अपनी देय तिथि के निकट है।",
      },
    ],
  });
  await prisma.systemSetting.create({ data: { key: "expiry_alert_days", value: [90, 60, 30, 15, 7, 1] } });
  await prisma.auditLog.create({ data: { actorId: admin.id, action: "SEED_COMPLETED", entity: "System", after: { applications: plan.length, certificates: certCount } } });

  console.log(`Created ${plan.length} applications and ${certCount} sealed certificates.`);
  console.log(`Sign-in accounts use the password ${PASSWORD}:`);
  console.log("  admin@ / state@ / lmo@ / inspector@ / gatc@ / gatc.admin@ / auditor@ / business@ nyayamapan.local");
  if (liveTokens[0]) console.log(`Public verification link: /c/${liveTokens[0]}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
