#!/usr/bin/env node
/**
 * Verifies that every translation key referenced in src/ exists in every locale file, and that
 * all locales have the same key set. Dynamic keys (template literals) are checked by prefix.
 *
 *   node scripts/check-i18n.mjs          # check
 *   node scripts/check-i18n.mjs --list   # print extracted keys per namespace
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const LOCALES = ["en", "hi"];
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== "__tests__" && name !== "node_modules") walk(p);
    } else if (/\.(tsx?|mjs)$/.test(name)) files.push(p);
  }
})(join(ROOT, "src"));

const TRANSLATOR = /(useTranslations|getTranslations)\(\s*(?:"([^"]*)"|\{[^}]*namespace:\s*"([^"]*)"[^}]*\}|\{[^}]*\})?\s*\)/g;
const used = new Map();
const dynamic = new Map();
const add = (m, ns, key, file) => {
  const full = ns ? `${ns}.${key}` : key;
  if (!m.has(full)) m.set(full, new Set());
  m.get(full).add(relative(ROOT, file));
};

for (const file of files) {
  const src = readFileSync(file, "utf8");
  /** name → [{ at, ns }] so each call resolves to the nearest preceding binding (several components per file). */
  const bindings = new Map();
  const bind = (name, ns, at) => {
    if (!bindings.has(name)) bindings.set(name, []);
    bindings.get(name).push({ at, ns });
  };

  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:"([^"]*)"|\{[^}]*namespace:\s*"([^"]*)"[^}]*\})?\s*\)/g)) {
    bind(m[1], m[2] ?? m[3] ?? "", m.index);
  }
  for (const m of src.matchAll(/const\s+\[([^\]]+)\]\s*=\s*await\s+Promise\.all\(\[([\s\S]*?)\]\s*\)/g)) {
    const names = m[1].split(",").map((s) => s.trim().replace(/^\{.*\}$/, ""));
    const exprs = [];
    let depth = 0;
    let cur = "";
    for (const ch of m[2]) {
      if ("([{".includes(ch)) depth++;
      if (")]}".includes(ch)) depth--;
      if (ch === "," && depth === 0) {
        exprs.push(cur);
        cur = "";
      } else cur += ch;
    }
    if (cur.trim()) exprs.push(cur);
    names.forEach((n, i) => {
      const e = exprs[i] ?? "";
      const tm = /^\s*getTranslations\(\s*(?:"([^"]*)"|\{[^}]*namespace:\s*"([^"]*)"[^}]*\}|\{[^}]*\})?\s*\)\s*$/.exec(e);
      if (n && tm) bind(n, tm[1] ?? tm[2] ?? "", m.index);
    });
  }

  for (const [name, list] of bindings) {
    list.sort((a, b) => a.at - b.at);
    const nsAt = (idx) => [...list].reverse().find((b) => b.at < idx)?.ns ?? list[0].ns;
    const esc = name.replace(/\$/g, "\\$");
    for (const m of src.matchAll(new RegExp(`(?<![\\w.])${esc}(?:\\.has|\\.rich|\\.raw)?\\(\\s*"([^"]+)"`, "g"))) add(used, nsAt(m.index), m[1], file);
    for (const m of src.matchAll(new RegExp(`(?<![\\w.])${esc}(?:\\.has|\\.rich|\\.raw)?\\(\\s*\`([^\`$]*)\\$\\{`, "g"))) add(dynamic, nsAt(m.index), m[1], file);
    for (const m of src.matchAll(new RegExp(`(?<![\\w.])${esc}\\(\\s*\`([^\`$]+)\``, "g"))) add(used, nsAt(m.index), m[1], file);
    // t(cond ? "a" : "b") — both branches are static keys
    for (const m of src.matchAll(new RegExp(`(?<![\\w.])${esc}\\(\\s*(?:[^"\`(),?]|"[^"]*")+\\?\\s*"([^"]+)"\\s*:\\s*"([^"]+)"`, "g"))) {
      add(used, nsAt(m.index), m[1], file);
      add(used, nsAt(m.index), m[2], file);
    }
  }
  void TRANSLATOR;
}

const flatten = (obj, prefix = "", out = new Set()) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flatten(v, key, out);
    else out.add(key);
  }
  return out;
};
const catalogs = Object.fromEntries(LOCALES.map((l) => [l, flatten(JSON.parse(readFileSync(join(ROOT, "messages", `${l}.json`), "utf8")))]));

if (process.argv.includes("--list")) {
  const byNs = {};
  for (const k of [...used.keys()].sort()) (byNs[k.split(".")[0]] ??= []).push(k);
  for (const k of [...dynamic.keys()].sort()) (byNs[k.split(".")[0]] ??= []).push(`${k}* (dynamic)`);
  for (const [ns, keys] of Object.entries(byNs).sort()) console.log(`\n[${ns}]\n  ${keys.join("\n  ")}`);
  process.exit(0);
}

let problems = 0;
const hasUsage = (usedKey, file) => [...used.get(usedKey) ?? []].some(() => true) && file;
for (const l of LOCALES) {
  const cat = catalogs[l];
  for (const [key, where] of used) {
    if (!cat.has(key) && ![...cat].some((k) => k.startsWith(`${key}.`))) {
      console.error(`[${l}] missing "${key}"  (${[...where][0]})`);
      problems++;
    }
  }
  for (const [prefix, where] of dynamic) {
    if (![...cat].some((k) => k.startsWith(prefix))) {
      console.error(`[${l}] no keys under dynamic prefix "${prefix}"  (${[...where][0]})`);
      problems++;
    }
  }
}
const [base, ...rest] = LOCALES;
for (const l of rest) {
  for (const k of catalogs[base]) if (!catalogs[l].has(k)) (console.error(`[${l}] missing "${k}" present in ${base}`), problems++);
  for (const k of catalogs[l]) if (!catalogs[base].has(k)) (console.error(`[${base}] missing "${k}" present in ${l}`), problems++);
}
void hasUsage;
if (problems) {
  console.error(`\n${problems} i18n problem(s).`);
  process.exit(1);
}
console.log(`i18n OK — ${used.size} static keys and ${dynamic.size} dynamic prefixes verified across ${LOCALES.join(", ")} (${catalogs[base].size} messages each).`);
