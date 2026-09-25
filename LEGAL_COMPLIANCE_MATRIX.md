# Legal Compliance Matrix

**Problem Statement ID:** 26036  
**Platform:** Online Verification System for Weighing and Measuring Instruments  
**Official source hierarchy:** Gazette / DoCA publications → Act → Consolidated Rules → State Enforcement Rules → Official SOPs  

> **Principle:** The software adapts to the law; it does not invent the law.  
> Values that cannot be verified from an authoritative source are marked **`CONFIGURATION REQUIRED`**.

Primary official index: [https://consumeraffairs.gov.in/pages/legal-metrology-act](https://consumeraffairs.gov.in/pages/legal-metrology-act)

---

## 1. Authoritative document inventory (DoCA-listed)

### 1.1 Primary Act

| Document | Status | Platform relevance |
|----------|--------|-------------------|
| Legal Metrology Act, 2009 | Authoritative | Verification/stamping obligations; LMO powers; offences architecture (penalties not invented) |
| Jan Vishwas (Amendment of Provisions) Act, 2023 | Listed on DoCA | Penalty/decriminalisation awareness — enforcement module uses config, not hard-coded penalties |
| Notification — enforcement of LM Act provisions under Jan Vishwas Act, 2023 | Listed | Enforcement config flags |
| Jan Vishwas (Amendment of Provisions) Act, 2026 | Listed | Living regulatory awareness |
| Implementation of JV Act 2026 for LM Act, 2009 | Listed | Living regulatory awareness |

### 1.2 Legal Metrology (General) Rules, 2011 and amendments (DoCA list)

| Document | Notes for platform |
|----------|-------------------|
| General Rules, 2011 | Baseline schedules, verification framework |
| Corrigendum — General Rules, 2011 | Text corrections |
| Amendment Rules, 2012 | Living rules |
| Amendment Rules, 2016 — Automatic instruments for weighing road vehicles in motion / axle loads | Instrument-type driven tests |
| (Amendment) Rules, 2021 | Living rules |
| Amendment Rules, 2022 | Living rules |
| Amendment Rules, 2025 — Radar equipment (vehicle speed) | New instrument category via admin rules |
| Second Amendment Rules, 2025 — Gas Meters (+ corrigendum) | Inserts Rule 27A special re-verification; Part XI gas meters — effective 1 Sep 2025 (per Gazette G.S.R. 242(E)) |
| Third Amendment Rules, 2025 — Sphygmomanometer | New instrument category |
| Fourth Amendment Rules, 2025 — Moisture Meters | New instrument category |
| Fifth Amendment Rules, 2025 — Thermometers | New instrument category |
| Sixth Amendment Rules, 2025 — Breath Analyser | New instrument category |
| **Seventh Amendment Rules, 2025** | **Rule 27(2)(a):** twenty-four months for weights, capacity measures, length measures, tape, beam scale, counter machine and fuel dispensers (petrol/diesel). Effective **18 Dec 2025** (G.S.R. 905(E)). Seeded in rules engine. |
| Amendment Rules, 2026 | Living rules — configure via admin |
| Second Amendment Rules, 2026 — Continuous Electrical Thermometer | New instrument category |
| Third Amendment Rules, 2026 | Omits Rules 16, 21, 21A (G.S.R. 175(E), 12 Mar 2026) — workflow flags CONFIGURATION REQUIRED for affected procedures |
| Fourth Amendment Rules, 2026 | NAWI verification procedure / Twelfth Schedule fee changes — fees = CONFIGURATION REQUIRED until admin loads Gazette values |
| Fifth Amendment Rules, 2026 — Energy Meters | New instrument category |

### 1.3 GATC Rules

| Document | Notes |
|----------|-------|
| GATC Rules, 2013 | GATC approval, eligible weights/measures |
| Amendment Rules, 2016 / 2021 / 2025 / 2026 / Second Amendment 2026 | First Schedule of GATC-eligible instruments is **configurable**, never hard-coded |

### 1.4 Related rules (supporting, not primary verification workflow)

| Document | Platform use |
|----------|--------------|
| National Standards Rules, 2011 (+ 2019 amendment) | Reference only |
| Numeration Rules, 2011 (+ amendment) | Reference only |
| Approval of Models Rules, 2011 (+ 2019) | Statutory approval entity separate from platform account |
| Packaged Commodities Rules, 2011 (+ amendments) | Out of primary verification scope; not mixed into W&M verification UI |
| Indian Institute of Legal Metrology Rules, 2011 | Reference only |

### 1.5 State Legal Metrology (Enforcement) Rules

| Item | Status |
|------|--------|
| State-specific fees, workflow variations, jurisdiction | **CONFIGURATION REQUIRED** — State Admin configures per state; Central Rules alone do not define every State procedure |

---

## 2. Requirement → system mapping

| Legal / product requirement | Feature | DB | UI | Workflow | Validation | Source |
|----------------------------|---------|-----|----|----------|------------|--------|
| Periodic verification & stamping before use (Act / General Rules) | Applications, inspections, stamping, certificates | `applications`, `inspections`, `stamping_records`, `certificates` | Business apply; LMO field; certificate | DRAFT→…→CERTIFICATE_ISSUED | Status machine + officer action | Act 2009; General Rules 2011 |
| Verification period not universal | Expiry engine | `legal_rules`, `legal_rule_versions`, `instruments.next_due_date`, `rule_version_id` | Instrument / certificate validity | Post-PASS calculate | `LegalRuleEngine.calculateValidity` | Rule 27(2)(a) Seventh Amendment 2025 for listed categories; others CONFIGURATION REQUIRED |
| Special re-verification (Rule 27A) | Conditional validity | `legal_rules.parameter = special_validity` | Rules admin; instrument type | Rule evaluation | Engine returns special validity when configured | Second Amendment Rules, 2025 |
| LMO verification | LMO role, assignments | `users.role`, `verification_assignments` | LMO dashboard / field PWA | SCHEDULED→ASSIGNED→FIELD | Jurisdiction checks | Act / State enforcement |
| GATC verification where notified | GATC module | `gatc_profiles`, authorized instrument types | GATC dashboard | Eligibility before assign | `getApplicableGATCs` | GATC Rules 2013 + amendments |
| Instrument-specific tests | Dynamic checklists | `inspection_checklists`, `inspection_tests`, rule versions | Field inspection UI | FIELD_VERIFICATION | Deterministic measurement engine; officer records PASS/FAIL | Schedules in General Rules — detailed MPE values CONFIGURATION REQUIRED unless seeded from Gazette |
| Digital certificate + QR | Certificates, public verify | `certificates`, `qr_tokens` | PDF + `/verify/[token]` | After PASS + stamping config | Status ACTIVE/EXPIRED/REVOKED | Product requirement (demo issuance unless authority integrated) |
| Stakeholder “registration” | Platform accounts vs statutory licences | `users` vs `licenses` / `approvals` | Clear labels | Separate flows | Never claim platform signup = statutory registration | Act (where licence/approval actually required) |
| Fees | Payment module | `fees`, `payments` | Shown only if fee rule exists | Optional | Fee amount from rule config | Twelfth Schedule etc. — CONFIGURATION REQUIRED |
| State procedures | State rule configuration | `state_rule_configurations` | State Admin | Workflow variations | State + central merge | State Enforcement Rules |
| Amendments over time | Versioned rules | `legal_rule_versions`, never overwrite | Rules admin lifecycle | Historical verifications pin version | effective_from / until | All DoCA amendments |
| Penalties / offences | Enforcement architecture | `complaints`, `enforcement_actions` | Admin monitoring | Findings → action | Penalty amounts CONFIGURATION REQUIRED | Act + Jan Vishwas evolutions |
| Public authentication of certificate | Public QR page | Public fields only | Bilingual verify UI | Read-only | Opaque token | Privacy / product |

---

## 3. Seeded vs CONFIGURATION REQUIRED

### 3.1 Safely seedable (documented)

| Rule ID (seed) | Parameter | Value | Effective | Source |
|----------------|-----------|-------|-----------|--------|
| `LM-GR-27-2-a-2025-12-18` | `verification_period_months` | `24` | 2025-12-18 | Seventh Amendment Rules, 2025; Rule 27(2)(a); G.S.R. 905(E) |
| Instrument categories listed in that clause | weights, capacity measures, length measures, tape, beam scale, counter machine, petrol/diesel fuel dispensers | linked to above | same | same |
| `LM-GR-27A-EXISTS-2025` | `special_reverificaton_provision` | `true` (structure only) | 2025-09-01 | Second Amendment Rules, 2025 — detailed conditions CONFIGURATION REQUIRED |

### 3.2 CONFIGURATION REQUIRED (do not invent)

- Permissible errors / MPE tables per instrument class  
- Exact test procedures / load points (except configurable templates)  
- Stamp identifier formats  
- Certificate statutory field sets per State  
- Fee amounts (including post–Fourth Amendment 2026 Twelfth Schedule changes)  
- State-specific re-verification intervals differing from Central Rules  
- GATC First Schedule eligibility lists (load from admin / amendment PDFs)  
- Exact GPS geofence distances for field verification  
- Alert notice periods (90/60/30… are **app preferences**, not assumed statutory)  
- Penalty amounts for enforcement actions  
- Whether online payment is mandatory for a given State workflow  

---

## 4. Platform vs statutory registration

| Concept | Meaning | UI label |
|---------|---------|----------|
| Platform Account | Login identity for the software | “Platform account” |
| Statutory Registration / Licence / Approval / Model Approval / GATC Approval | Legal status under Act/Rules where applicable | “Statutory registration / licence / approval” |

Never claim: “Registration is legally mandatory” for platform signup alone.

---

## 5. AI safety (non-legal)

AI may assist OCR, classification, missing docs, NL search.  
AI must **never** decide PASS/FAIL, validity period, offence, penalty, revocation, or activate legal rules.

---

## 6. Disclaimer

This matrix supports a **software prototype**. Official issuance, DSC, fees, and statutory procedures require integration with and authorisation by the competent authority.

**Last reviewed against DoCA page listing:** 2026-09-24 (prototype build date context).
