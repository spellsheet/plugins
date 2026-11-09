// Checks the registry index (index.json) the way SpellSheet reads it, and
// every entry a pull request adds or changes: downloads its zip, compares the
// SHA-256, unpacks it, and checks its manifest with `spellsheet plugin check`.
// Writes what each entry is (nodes, data sent outside, program, secrets) to
// the job summary so the reviewer reads it in one place.
//
//   node scripts/check.mjs [--base <index.json of the base branch>]
//
// Node.js 22, no dependencies. Needs `unzip`, and `spellsheet` on PATH (or
// SPELLSHEET_CLI) for the manifest check.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const NAME = /^[a-z][a-z0-9]*$/;
const SHA = /^[0-9a-fA-F]{64}$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const FIELDS = new Set(["name", "label", "description", "version", "publisher", "homepage", "source", "url", "sha256", "withdrawn"]);
const MANIFEST = "spellsheet-plugin.json";
const MAX_BYTES = 512 * 1024 * 1024;

const args = process.argv.slice(2);
const basePath = args[args.indexOf("--base") + 1] ?? null;
const problems = [];
const summary = [];

function read(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    problems.push(`${path}: ${e.message}`);
    return null;
  }
}

const index = read("index.json");
const base = basePath && existsSync(basePath) ? read(basePath) : { extensions: [] };
if (!index || !Array.isArray(index.extensions)) {
  problems.push('index.json: needs an "extensions" list');
} else {
  checkIndex(index.extensions);
  const before = new Map((base?.extensions ?? []).map((e) => [e.name, JSON.stringify(e)]));
  const changed = index.extensions.filter((e) => before.get(e.name) !== JSON.stringify(e));
  for (const e of changed) await checkEntry(e, before.has(e.name));
  for (const name of before.keys()) {
    if (!index.extensions.some((e) => e.name === name)) {
      problems.push(`${name}: an entry is never removed (people have it installed); set "withdrawn" with the reason instead`);
    }
  }
}

function checkIndex(entries) {
  const seen = new Set();
  entries.forEach((e, i) => {
    const at = `extensions[${i}] (${e?.name})`;
    for (const key of Object.keys(e ?? {})) if (!FIELDS.has(key)) problems.push(`${at}: unknown field "${key}"`);
    if (!NAME.test(e.name ?? "") || e.name.length > 32) problems.push(`${at}: name must match ${NAME} (32 characters at most)`);
    if (seen.has(e.name)) problems.push(`${at}: listed twice`);
    seen.add(e.name);
    if (!e.label) problems.push(`${at}: needs a label`);
    if (!e.publisher) problems.push(`${at}: needs a publisher`);
    // The official registry pins every entry: no "latest release" entries.
    if (!e.url || !e.sha256 || !e.version) problems.push(`${at}: needs version, url and sha256 (the official registry pins every entry)`);
    if (e.url && !e.url.startsWith("https://")) problems.push(`${at}: url must be https`);
    if (e.sha256 && !SHA.test(e.sha256)) problems.push(`${at}: sha256 must be 64 hex digits`);
    if (e.version && !SEMVER.test(e.version)) problems.push(`${at}: version must be semver (1.2.3)`);
    if (e.homepage && !e.homepage.startsWith("https://")) problems.push(`${at}: homepage must be https`);
    if (e.source && !e.source.startsWith("https://")) problems.push(`${at}: source must be https`);
  });
}

async function checkEntry(e, update) {
  const at = e.name;
  const lines = [`### ${e.label} (\`${e.name}\` ${e.version ?? ""})${update ? " — update" : " — new"}`, ""];
  if (e.withdrawn) {
    lines.push(`Withdrawn: ${e.withdrawn}`, "");
    summary.push(lines.join("\n"));
    return;
  }
  if (!e.url || !SHA.test(e.sha256 ?? "")) return;
  const work = mkdtempSync(join(tmpdir(), `plugin-${e.name}-`));
  const zip = join(work, "download.zip");
  let bytes;
  try {
    const res = await fetch(e.url, { redirect: "follow" });
    if (!res.ok) throw new Error(`the server answered ${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    problems.push(`${at}: cannot download ${e.url}: ${err.message}`);
    return;
  }
  if (bytes.length > MAX_BYTES) return problems.push(`${at}: the zip is larger than 512 MB`);
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== e.sha256.toLowerCase()) return problems.push(`${at}: sha256 of the zip is ${sha}, the entry says ${e.sha256}`);
  writeFileSync(zip, bytes);
  const out = join(work, "content");
  try {
    execFileSync("unzip", ["-q", zip, "-d", out]);
  } catch {
    return problems.push(`${at}: the download is not a readable zip`);
  }
  const dir = findPluginDir(out);
  if (!dir) return problems.push(`${at}: no ${MANIFEST} at the top of the zip or in its only folder`);
  const manifest = read(join(dir, MANIFEST));
  if (!manifest) return;
  if (manifest.name !== e.name) problems.push(`${at}: the zip holds "${manifest.name}"`);
  if (manifest.version !== e.version) problems.push(`${at}: the zip holds version ${manifest.version}, the entry says ${e.version}`);
  const cli = process.env.SPELLSHEET_CLI || "spellsheet";
  try {
    execFileSync(cli, ["plugin", "check", dir], { stdio: "pipe" });
  } catch (err) {
    problems.push(`${at}: spellsheet plugin check failed:\n${String(err.stdout ?? "")}${String(err.stderr ?? "")}`);
  }
  const program = [manifest.command?.program, ...(manifest.command?.args ?? [])].filter(Boolean).join(" ");
  lines.push(`- Publisher: ${e.publisher}${manifest.publisher && manifest.publisher !== e.publisher ? ` (manifest says ${manifest.publisher})` : ""}`);
  lines.push(`- Source: ${e.source ?? "-"} / zip: ${e.url}`);
  lines.push(`- Program it starts: \`${program}\``);
  for (const s of manifest.steps ?? []) {
    const sends = s.external ? ` — **sends ${s.external.data} to ${s.external.service}**` : "";
    const targets = (s.targets ?? []).map((t) => `${t.kind}:${t.param}`).join(", ");
    lines.push(`- Node \`${e.name}.${s.action}\` (${s.label}, risk ${s.risk ?? "interactive"})${sends}${targets ? `, targets ${targets}` : ""}`);
    if (/https?:\/\//.test(JSON.stringify(s.params ?? {})) && !s.external) lines.push(`  - Its settings mention a URL but it declares no \`external\`: check what it sends`);
  }
  for (const c of manifest.credentials ?? []) lines.push(`- Secret it takes: ${c.label} (${c.kind})`);
  lines.push(`- Files: ${countFiles(dir)}`, "");
  summary.push(lines.join("\n"));
}

function findPluginDir(content) {
  if (existsSync(join(content, MANIFEST))) return content;
  const entries = readdirSync(content);
  if (entries.length === 1 && statSync(join(content, entries[0])).isDirectory() && existsSync(join(content, entries[0], MANIFEST))) return join(content, entries[0]);
  return null;
}

function countFiles(dir) {
  let n = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    n += statSync(p).isDirectory() ? countFiles(p) : 1;
  }
  return n;
}

const report = [
  problems.length ? `## Problems (${problems.length})\n\n${problems.map((p) => `- ${p.replace(/\n/g, "\n  ")}`).join("\n")}\n` : "## No problems found\n",
  summary.length ? `## What changes\n\n${summary.join("\n")}` : "",
].join("\n");
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
process.exit(problems.length ? 1 : 0);
