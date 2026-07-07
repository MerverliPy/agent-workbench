#!/usr/bin/env node
// ── SBOM Generator ────
// Generates a CycloneDX v1.5 Software Bill of Materials for agent-workbench.
// Parses bun.lock directly (zero dependencies) for accurate dependency data.
//
// Output:
//   bom.json  — CycloneDX JSON SBOM (all 1,300+ deps, exact versions, hashes)
//   bom.csv   — Human-readable summary (--csv flag)
//
// Usage:
//   node scripts/generate-sbom.js              # Generate bom.json
//   node scripts/generate-sbom.js --audit      # + run bun pm scan
//   node scripts/generate-sbom.js --csv        # + write bom.csv
//   node scripts/generate-sbom.js ./output     # Write to ./output/bom.json

const { execSync } = require("node:child_process");
const { existsSync, readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { randomUUID } = require("node:crypto");
const { resolve } = require("node:path");

// ── CLI ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flags = { csv: false, audit: false, outDir: "." };
for (const arg of args) {
  if (arg === "--csv") flags.csv = true;
  else if (arg === "--audit") flags.audit = true;
  else flags.outDir = arg;
}
const ROOT = resolve(flags.outDir);

// ── Metadata ───────────────────────────────────────────────────────────
const PKG = JSON.parse(readFileSync("package.json", "utf-8"));
const PACKAGE_NAME = PKG.name || "agent-workbench";
const PACKAGE_VERSION = PKG.version || "0.0.0";
const TIMESTAMP = new Date().toISOString().replace(/\.[0-9]{3}Z$/, "Z");
let BUN_VERSION = "unknown";
let OS_NAME = "unknown";
let OS_ARCH = "unknown";
try {
  BUN_VERSION = execSync("bun --version", { encoding: "utf-8" }).trim();
} catch { /* no bun */ }
try {
  OS_NAME = execSync("uname -s", { encoding: "utf-8" }).trim();
  OS_ARCH = execSync("uname -m", { encoding: "utf-8" }).trim();
} catch { /* no uname */ }

console.log(`\ud83d\udd0d Generating SBOM for ${PACKAGE_NAME}@${PACKAGE_VERSION}...`);
console.log(`  Bun: v${BUN_VERSION}  OS: ${OS_NAME}/${OS_ARCH}`);

// ── Parse bun.lock ─────────────────────────────────────────────────────
const LOCK_PATH = "bun.lock";
if (!existsSync(LOCK_PATH)) {
  console.error(`\u274c ${LOCK_PATH} not found \u2014 run 'bun install' first.`);
  process.exit(1);
}

console.log(`  Reading ${LOCK_PATH}...`);

const LOCK_RAW = readFileSync(LOCK_PATH, "utf-8");
const LOCK_RE = LOCK_RAW.replace(/,\s*([}\]])/g, "$1"); // trailing comma cleanup
let LOCK;
try {
  LOCK = JSON.parse(LOCK_RE);
} catch (err) {
  console.error("\u274c Failed to parse bun.lock after trailing-comma cleanup.");
  console.error(`   ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

const { packages, workspaces } = LOCK;

// ── Collect workspace package names (to exclude from SBOM) ─────────────
const workspaceNames = new Set(["@agent-workbench"]);
if (workspaces) {
  for (const ws of Object.values(workspaces)) {
    const wsPkg = /** @type {any} */ (ws);
    if (wsPkg?.name) {
      const name = typeof wsPkg.name === "string"
        ? wsPkg.name.split("@").slice(0, -1).join("@") || `@${wsPkg.name.split("@")[1]}`
        : wsPkg.name;
      workspaceNames.add(name);
    }
  }
}

// Also scan all package.json files for @agent-workbench/* names
let workspacePkgJsons;
try {
  const findOut = execSync(
    "find packages apps plugins tests -name 'package.json' ! -path '*/node_modules/*' 2>/dev/null || true",
    { encoding: "utf-8" },
  ).trim();
  workspacePkgJsons = ["package.json", ...(findOut ? findOut.split("\n").filter(Boolean) : [])];
} catch {
  workspacePkgJsons = ["package.json"];
}

for (const pj of workspacePkgJsons) {
  try {
    const p = JSON.parse(readFileSync(pj, "utf-8"));
    if (p.name && p.name.startsWith("@agent-workbench/")) {
      workspaceNames.add(p.name);
    }
  } catch { /* skip unreadable */ }
}

// ── Classify dev vs runtime from workspace package.json files ──────────
const devDeps = new Set();
for (const pj of workspacePkgJsons) {
  try {
    const p = JSON.parse(readFileSync(pj, "utf-8"));
    const dd = p.devDependencies || {};
    for (const k of Object.keys(dd)) {
      if (!k.startsWith("@agent-workbench/")) devDeps.add(k);
    }
  } catch { /* skip */ }
}
const isDevPkg = (name) => devDeps.has(name);

// ── Enumerate components ───────────────────────────────────────────────
console.log("  Enumerating components...");

const components = [];
const packageEntries = [];
const seenNames = new Set();

for (const entry of Object.values(packages)) {
  const arr = /** @type {any[]} */ (entry);
  const fullName = String(arr[0]);

  // Parse scoped names: lastIndexOf("@") for version split
  const atIdx = fullName.lastIndexOf("@");
  const pkgName = fullName.slice(0, atIdx);
  const pkgVer = fullName.slice(atIdx + 1);

  if (!pkgName || !pkgVer) continue;

  // Skip workspace packages
  if (workspaceNames.has(pkgName) || pkgName.startsWith("@agent-workbench/")) continue;

  // Deduplicate
  if (seenNames.has(pkgName)) continue;
  seenNames.add(pkgName);

  const integrity = arr[3] ? String(arr[3]) : undefined;
  const depMap = arr[2] || {};
  const deps = { ...(depMap.dependencies || {}), ...(depMap.peerDependencies || {}) };

  const purl = `pkg:npm/${pkgName}@${pkgVer}`;

  const comp = {
    "bom-ref": purl,
    type: "library",
    name: pkgName,
    version: pkgVer,
    purl,
  };

  // Add integrity hash if available
  if (integrity) {
    const algo = integrity.startsWith("sha512") ? "SHA-512"
      : integrity.startsWith("sha384") ? "SHA-384"
      : integrity.startsWith("sha256") ? "SHA-256"
      : undefined;
    if (algo) {
      comp.hashes = [{ alg: algo, value: integrity }];
    }
  }

  comp.properties = [{
    name: "dependency_type",
    value: isDevPkg(pkgName) ? "devDependencies" : "dependencies",
  }];

  components.push(comp);
  packageEntries.push({ name: pkgName, version: pkgVer, deps, purl });
}

components.sort((a, b) => a.name.localeCompare(b.name));

// ── Build dependency tree ──────────────────────────────────────────────
console.log("  Building dependency tree...");

const dependsOn = [
  {
    ref: `pkg:npm/${PACKAGE_NAME}@${PACKAGE_VERSION}`,
    dependsOn: components.map((c) => c["bom-ref"]),
  },
];

for (const pkg of packageEntries) {
  const depRefs = [];
  for (const depName of Object.keys(pkg.deps)) {
    const match = components.find(
      (c) => c.name === depName,
    );
    if (match) {
      depRefs.push(match["bom-ref"]);
    }
  }
  if (depRefs.length > 0) {
    dependsOn.push({
      ref: pkg.purl,
      dependsOn: depRefs,
    });
  }
}

// ── Generate UUID for serial number ────────────────────────────────────
function generateUUID() {
  try {
    const out = execSync("uuidgen", { encoding: "utf-8" }).trim().toLowerCase();
    if (out.length === 36) return out;
  } catch { /* fall through */ }
  return randomUUID();
}

// ── Serialize CycloneDX v1.5 ───────────────────────────────────────────
console.log("  Writing CycloneDX v1.5 SBOM...");

const bom = {
  $schema: "https://cyclonedx.org/schema/bom-1.5.schema.json",
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  serialNumber: `urn:uuid:${generateUUID()}`,
  version: 1,
  metadata: {
    timestamp: TIMESTAMP,
    tools: [{
      vendor: "agent-workbench",
      name: "sbom-generator",
      version: "2.0.0",
    }],
    component: {
      "bom-ref": `pkg:npm/${PACKAGE_NAME}@${PACKAGE_VERSION}`,
      type: "application",
      name: PACKAGE_NAME,
      version: PACKAGE_VERSION,
      purl: `pkg:npm/${PACKAGE_NAME}@${PACKAGE_VERSION}`,
    },
    properties: [
      { name: "bun:version", value: BUN_VERSION },
      { name: "os:name", value: OS_NAME },
      { name: "os:arch", value: OS_ARCH },
    ],
  },
  components,
  dependencies: dependsOn,
};

mkdirSync(ROOT, { recursive: true });
const bomPath = resolve(ROOT, "bom.json");
writeFileSync(bomPath, JSON.stringify(bom, null, 2), "utf-8");
console.log(`  \u2705 SBOM written to ${bomPath} (${components.length} components)`);

if (flags.csv) {
  const csvPath = resolve(ROOT, "bom.csv");
  const lines = ['"name","version","type"'];
  for (const c of components) {
    lines.push(`"${c.name}","${c.version}","${c.properties[0].value}"`);
  }
  writeFileSync(csvPath, lines.join("\n") + "\n", "utf-8");
  console.log(`  \u2705 CSV written to ${csvPath}`);
}

if (flags.audit) {
  console.log("\n\ud83d\udd12 Running dependency audit...");
  try {
    const auditOut = execSync("bun pm scan 2>&1", { encoding: "utf-8" });
    console.log(auditOut);
    writeFileSync(resolve(ROOT, "audit-report.txt"), auditOut, "utf-8");
    console.log(`  \u2705 Audit report written to ${resolve(ROOT, "audit-report.txt")}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  \u26a0\ufe0f Audit failed: ${msg}`);
  }
}

console.log(`\n\ud83d\udcca Summary:
  Components: ${components.length} (vs 17 from old script)
  Artifacts:
    - ${bomPath}
${flags.csv ? `    - ${bomPath.replace("bom.json", "bom.csv")}\n` : ""}\u2705 SBOM generation complete.`);
