#!/usr/bin/env node
// Route smoke test against a running server: signs in as every role, requests
// every page in both locales and checks status, RBAC outcome, untranslated keys
// and banned placeholder wording. Usage: node scripts/smoke.mjs [baseUrl]
import { PrismaClient } from "@prisma/client";

const BASE = process.argv[2] || process.env.SMOKE_BASE_URL || "http://localhost:3001";
const PASSWORD = process.env.SEED_USER_PASSWORD || "Verify@2026";
const LOCALES = ["en", "hi"];

const ROLES = {
  SUPER_ADMIN: "admin@nyayamapan.local",
  STATE_ADMIN: "state@nyayamapan.local",
  LMO: "lmo@nyayamapan.local",
  INSPECTOR: "inspector@nyayamapan.local",
  GATC_ADMIN: "gatc.admin@nyayamapan.local",
  GATC_OFFICER: "gatc@nyayamapan.local",
  BUSINESS_USER: "business@nyayamapan.local",
  AUDITOR: "auditor@nyayamapan.local",
};

const ALL = Object.keys(ROLES);
const MODULES = {
  dashboard: ALL,
  applications: ALL,
  instruments: ["SUPER_ADMIN", "STATE_ADMIN", "BUSINESS_USER", "AUDITOR", "LMO", "INSPECTOR"],
  verification: ["LMO", "INSPECTOR", "GATC_OFFICER"],
  scheduling: ["SUPER_ADMIN", "STATE_ADMIN", "GATC_ADMIN", "LMO", "INSPECTOR", "GATC_OFFICER"],
  certificates: ALL,
  gatc: ["SUPER_ADMIN", "STATE_ADMIN", "GATC_ADMIN", "GATC_OFFICER", "AUDITOR"],
  reports: ["SUPER_ADMIN", "STATE_ADMIN", "AUDITOR", "GATC_ADMIN"],
  notifications: ALL,
  rules: ["SUPER_ADMIN", "STATE_ADMIN", "AUDITOR"],
  users: ["SUPER_ADMIN", "STATE_ADMIN", "GATC_ADMIN"],
  geography: ["SUPER_ADMIN"],
  audit: ["SUPER_ADMIN", "STATE_ADMIN", "AUDITOR"],
  profile: ALL,
  settings: ALL,
};

const NAMESPACES = "common|nav|roles|palette|table|status|errors|apiErrors|upload|documents|dashboard|applications|applyForm|instruments|instrumentForm|verification|field|scheduling|certificates|gatc|reports|notifications|rules|users|audit|profile|settings|public|landing|login|register|verify";
const MISSING_KEY = new RegExp(`(?<![\\w/.-])(?:${NAMESPACES})\\.[a-zA-Z][\\w]*(?:\\.[\\w-]+)*(?![\\w/.@-])`, "g");
const BANNED = /\b(demo|demonstration|prototype|sample data|mock|fake|lorem ipsum|dummy)\b/i;
const FORBIDDEN_MARK = { en: "have access to this page", hi: "पहुँच नहीं है" };

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ");
}

class Jar {
  cookies = new Map();
  store(res) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      this.cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function signIn(email) {
  const jar = new Jar();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  jar.store(csrfRes);
  const { csrfToken } = await csrfRes.json();
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar.header() },
    body: new URLSearchParams({ csrfToken, email, password: PASSWORD, callbackUrl: `${BASE}/en/dashboard` }),
  });
  jar.store(res);
  if (![...jar.cookies.keys()].some((k) => k.includes("session-token"))) throw new Error(`Sign-in failed for ${email}`);
  const mark = await fetch(`${BASE}/api/session/mark`, { method: "POST", headers: { cookie: jar.header() } });
  jar.store(mark);
  if (mark.status !== 204) throw new Error(`Browser-session marker failed for ${email}: HTTP ${mark.status}`);
  return jar;
}

async function get(path, jar) {
  const t0 = performance.now();
  const res = await fetch(`${BASE}${path}`, { redirect: "manual", headers: jar ? { cookie: jar.header() } : {} });
  const body = res.headers.get("content-type")?.includes("text/html") ? await res.text() : "";
  return { status: res.status, location: res.headers.get("location"), body, ms: Math.round(performance.now() - t0) };
}

const failures = [];
const timings = [];
function check(label, r, { expect = 200, allowForbidden = false, locale = "en" } = {}) {
  timings.push({ label, ms: r.ms });
  if (r.status !== expect) {
    failures.push(`${label}: HTTP ${r.status}${r.location ? ` -> ${r.location}` : ""} (expected ${expect})`);
    return;
  }
  if (expect !== 200) return;
  const text = visibleText(r.body);
  const forbidden = text.includes(FORBIDDEN_MARK[locale]);
  if (forbidden !== allowForbidden) failures.push(`${label}: ${forbidden ? "unexpected 403 page" : "expected 403 page but content rendered"}`);
  const missing = [...new Set(text.match(MISSING_KEY) ?? [])];
  if (missing.length) failures.push(`${label}: untranslated keys ${missing.slice(0, 5).join(", ")}`);
  const banned = text.match(BANNED);
  if (banned) failures.push(`${label}: banned wording "${banned[0]}"`);
}

const prisma = new PrismaClient();
const [app, cert, instrument, inspectionApp, rule] = await Promise.all([
  prisma.application.findFirst({ where: { status: "CERTIFICATE_ISSUED" }, select: { id: true } }),
  prisma.certificate.findFirst({ where: { status: "ACTIVE" }, select: { id: true } }),
  prisma.instrument.findFirst({ select: { id: true } }),
  prisma.application.findFirst({ where: { status: { in: ["ASSIGNED", "FIELD_VERIFICATION"] } }, select: { id: true } }),
  prisma.legalRule.findFirst({ select: { id: true } }),
]);
await prisma.$disconnect();

for (const locale of LOCALES) {
  for (const path of ["", "/login", "/register", "/verify", "/verify/not-a-real-token", "/c/not-a-real-token"]) {
    check(`public ${locale}${path || "/"}`, await get(`/${locale}${path}`), { locale });
  }
  check(`public ${locale}/missing-page`, await get(`/${locale}/this-page-does-not-exist`), { expect: 404, locale });
  const r = await get(`/${locale}/dashboard`);
  check(`anon ${locale}/dashboard`, r, { expect: 307, locale });
}

for (const [role, email] of Object.entries(ROLES)) {
  const jar = await signIn(email);
  for (const locale of LOCALES) {
    for (const [mod, roles] of Object.entries(MODULES)) {
      check(`${role} ${locale}/${mod}`, await get(`/${locale}/${mod}`, jar), { allowForbidden: !roles.includes(role), locale });
    }
  }
  const creators = ["BUSINESS_USER"];
  const details = [
    ["applications/new", creators],
    ["instruments/new", creators],
    app && [`applications/${app.id}`, null],
    cert && [`certificates/${cert.id}`, null],
    instrument && [`instruments/${instrument.id}`, null],
    inspectionApp && [`verification/${inspectionApp.id}`, null],
    rule && [`rules?rule=${rule.id}`, MODULES.rules],
  ].filter(Boolean);
  for (const [path, roles] of details) {
    const r = await get(`/en/${path}`, jar);
    // Records outside a user's scope return the not-found page, which is the intended isolation.
    if (!roles && r.status === 404) continue;
    check(`${role} en/${path}`, r, { allowForbidden: roles ? !roles.includes(role) : visibleText(r.body).includes(FORBIDDEN_MARK.en) });
  }
}

// API authorisation boundaries
async function api(path, jar, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    ...init,
    headers: { ...(init.body ? { "content-type": "application/json" } : {}), ...(jar ? { cookie: jar.header() } : {}) },
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}
function expectStatus(label, r, statuses) {
  if (!statuses.includes(r.status)) failures.push(`${label}: HTTP ${r.status} (expected ${statuses.join(" or ")})`);
}

for (const path of ["/api/applications", "/api/certificates", "/api/instruments", "/api/audit", "/api/reports?type=applications", "/api/search?q=LM", "/api/gatc", "/api/rules"]) {
  expectStatus(`anon GET ${path}`, await api(path), [401]);
}
for (const path of ["/api/users", "/api/notifications", "/api/settings", "/api/profile"]) {
  expectStatus(`anon PATCH/POST ${path}`, await api(path, null, { method: path === "/api/users" ? "POST" : "PATCH", body: "{}" }), [401]);
}
expectStatus("anon cron/expiry", await api("/api/cron/expiry"), [401]);

const jars = {};
for (const role of ["BUSINESS_USER", "INSPECTOR", "AUDITOR", "SUPER_ADMIN"]) jars[role] = await signIn(ROLES[role]);

// A session token without the browser-session marker (browser was closed) must not open the portal.
{
  const closed = new Jar();
  for (const [k, v] of jars.AUDITOR.cookies) if (k !== "nm_bs") closed.cookies.set(k, v);
  const page = await get("/en/dashboard", closed);
  if (page.status !== 307 || !page.location?.includes("/login")) failures.push(`token without browser-session marker: HTTP ${page.status} (expected redirect to login)`);
  expectStatus("token without browser-session marker (API)", await api("/api/audit", closed), [401]);
}

expectStatus("BUSINESS GET /api/audit", await api("/api/audit", jars.BUSINESS_USER), [403]);
expectStatus("BUSINESS POST /api/users", await api("/api/users", jars.BUSINESS_USER, { method: "POST", body: "{}" }), [403]);
expectStatus("BUSINESS PATCH /api/settings", await api("/api/settings", jars.BUSINESS_USER, { method: "PATCH", body: "{}" }), [403]);
expectStatus("BUSINESS POST /api/rules", await api("/api/rules", jars.BUSINESS_USER, { method: "POST", body: "{}" }), [403]);
expectStatus("INSPECTOR POST /api/rules", await api("/api/rules", jars.INSPECTOR, { method: "POST", body: "{}" }), [403]);
expectStatus("AUDITOR POST /api/schedules", await api("/api/schedules", jars.AUDITOR, { method: "POST", body: "{}" }), [403]);
expectStatus("BUSINESS POST /api/schedules", await api("/api/schedules", jars.BUSINESS_USER, { method: "POST", body: "{}" }), [403]);
expectStatus("SUPER_ADMIN POST /api/schedules", await api("/api/schedules", jars.SUPER_ADMIN, { method: "POST", body: "{}" }), [403]);
expectStatus("BUSINESS POST /api/geography/states", await api("/api/geography/states", jars.BUSINESS_USER, { method: "POST", body: "{}" }), [403]);
expectStatus("AUDITOR POST /api/geography/districts", await api("/api/geography/districts", jars.AUDITOR, { method: "POST", body: "{}" }), [403]);
if (inspectionApp) {
  expectStatus("SUPER_ADMIN start verification", await api(`/api/verifications/${inspectionApp.id}/start`, jars.SUPER_ADMIN, { method: "POST" }), [403, 404]);
  expectStatus("BUSINESS record verification result", await api(`/api/verifications/${inspectionApp.id}/result`, jars.BUSINESS_USER, { method: "POST", body: JSON.stringify({ result: "PASS" }) }), [403, 404]);
  expectStatus("AUDITOR start verification", await api(`/api/verifications/${inspectionApp.id}/start`, jars.AUDITOR, { method: "POST" }), [403, 404]);
}
if (cert) {
  expectStatus("AUDITOR revoke certificate", await api(`/api/certificates/${cert.id}/revoke`, jars.AUDITOR, { method: "POST", body: JSON.stringify({ action: "revoke", reason: "smoke test attempt" }) }), [403]);
}

const prisma2 = new PrismaClient();
const business = await prisma2.user.findUnique({ where: { email: ROLES.BUSINESS_USER }, select: { organizationId: true } });
const foreignApp = await prisma2.application.findFirst({ where: { instrument: { organizationId: { not: business?.organizationId ?? "" } } }, select: { id: true, applicationNumber: true } });
const foreignCert = await prisma2.certificate.findFirst({ where: { application: { instrument: { organizationId: { not: business?.organizationId ?? "" } } } }, select: { id: true, certificateNumber: true } });
await prisma2.$disconnect();
if (foreignApp) {
  expectStatus("BUSINESS GET foreign application API", await api(`/api/applications/${foreignApp.id}`, jars.BUSINESS_USER), [404, 403]);
  // With streamed metadata Next.js may answer 200 with the not-found UI; what matters is that nothing leaks.
  const page = await get(`/en/applications/${foreignApp.id}`, jars.BUSINESS_USER);
  if (page.body.includes(foreignApp.applicationNumber)) failures.push("BUSINESS foreign application page leaks the application number");
  if (page.status !== 404 && !page.body.includes("NEXT_HTTP_ERROR_FALLBACK;404")) failures.push(`BUSINESS foreign application page: HTTP ${page.status} without not-found fallback`);
}
if (foreignCert) {
  expectStatus("BUSINESS foreign certificate PDF", await api(`/api/certificates/${foreignCert.id}/pdf`, jars.BUSINESS_USER), [404, 403]);
  const page = await get(`/en/certificates/${foreignCert.id}`, jars.BUSINESS_USER);
  if (page.body.includes(foreignCert.certificateNumber)) failures.push("BUSINESS foreign certificate page leaks the certificate number");
  if (page.status !== 404 && !page.body.includes("NEXT_HTTP_ERROR_FALLBACK;404")) failures.push(`BUSINESS foreign certificate page: HTTP ${page.status} without not-found fallback`);
}
const own = await api("/api/applications", jars.BUSINESS_USER);
const ownRows = own.json?.data ?? own.json?.items ?? own.json?.applications ?? [];
if (foreignApp && ownRows.some((a) => a.id === foreignApp.id)) failures.push("BUSINESS application list includes another organisation's record");

// A suspension must end an existing session immediately, not at token expiry.
{
  const prisma3 = new PrismaClient();
  const auditor = await prisma3.user.findUnique({ where: { email: ROLES.AUDITOR }, select: { id: true } });
  await prisma3.$disconnect();
  const before = await api("/api/audit", jars.AUDITOR);
  expectStatus("AUDITOR audit API before suspension", before, [200]);
  const suspend = await api(`/api/users/${auditor.id}`, jars.SUPER_ADMIN, { method: "PATCH", body: JSON.stringify({ status: "SUSPENDED", reason: "Automated session revocation check" }) });
  expectStatus("SUPER_ADMIN suspends auditor", suspend, [200]);
  try {
    expectStatus("suspended AUDITOR reuses token (API)", await api("/api/audit", jars.AUDITOR), [401]);
    const page = await get("/en/dashboard", jars.AUDITOR);
    if (page.status !== 307 || !page.location?.includes("/login")) failures.push(`suspended AUDITOR dashboard: HTTP ${page.status} ${page.location ?? ""} (expected redirect to login)`);
  } finally {
    const restore = await api(`/api/users/${auditor.id}`, jars.SUPER_ADMIN, { method: "PATCH", body: JSON.stringify({ status: "ACTIVE", reason: "Automated session revocation check — restore" }) });
    expectStatus("SUPER_ADMIN reactivates auditor", restore, [200]);
  }
}

if (cert) {
  const page = await get(`/en/certificates/${cert.id}`, jars.SUPER_ADMIN);
  const token = page.body.match(/\/c\/([A-Za-z0-9_-]{16,})/)?.[1];
  if (!token) failures.push("Could not find the public verification link on the certificate page");
  else {
    const pub = await api(`/api/public/certificates/${token}`);
    expectStatus("public certificate API", pub, [200]);
    const leaked = JSON.stringify(pub.json ?? {}).match(/"(email|mobile|phone|address|gstin|holderName|organization|applicant|lat|lng|latitude|longitude)"/i);
    if (leaked) failures.push(`public certificate API exposes "${leaked[1]}"`);
    if (pub.json?.status !== "VALID") failures.push(`public certificate API status ${pub.json?.status} (expected VALID)`);
    const bad = await api("/api/public/certificates/AAAAAAAAAAAAAAAAAAAAAAAA");
    if (bad.json?.status !== "INVALID") failures.push(`unknown token returned ${bad.status} ${bad.json?.status}`);
    const html = await get(`/en/c/${token}`);
    check("public en/c/<token>", html);
  }
}

timings.sort((a, b) => b.ms - a.ms);
const total = timings.length;
const median = timings[Math.floor(total / 2)]?.ms;
console.log(`Checked ${total} requests. Median ${median} ms, slowest: ${timings.slice(0, 5).map((t) => `${t.label} ${t.ms}ms`).join(", ")}`);
if (failures.length) {
  console.log(`\n${failures.length} problem(s):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("Smoke test passed.");
