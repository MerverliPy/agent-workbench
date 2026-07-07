# SBOM Generator Rewrite: Design Document

## 1. Executive Summary

Replace the fragile 251-line bash script `scripts/sbom.sh` (CycloneDX v1.5 generator) with a minimal Node.js script (`scripts/generate-sbom.js`). The rewrite eliminates multiple classes of **practical breakage** (malformed JSON output, massive undercount of dependencies, unresolved version ranges) while maintaining CLI compatibility with existing `package.json` script hooks.

---

## 2. Assessment: Practical Breakage vs. Theoretical Fragility

### 2.1 The existing script is PRACTICALLY BROKEN — not just theoretically fragile

| Issue | Classification | Evidence |
|---|---|---|
| **Malformed JSON output** | 🔴 BROKEN | The heredoc `cat > bom.json << BOMEOF` preserves `\n` and `\"` escape sequences literally. Generated output contains `\\n` (literal backslash-n) and `\\\"` (literal backslash-quote) inside string values, making the JSON structurally invalid. |
| **Severe dependency undercount** | 🔴 BROKEN | Script reports 17 components. Real count: **1,345 resolved packages** in `bun.lock`. Misses **98.7% of dependencies** because it only scans declared `dependencies`/`devDependencies` in workspace `package.json` files, ignoring all transitive deps. |
| **Unresolved version ranges** | 🔴 BROKEN | Output contains `diff@^9.0.0`, `dompurify@^3.4.11` — semver ranges, not resolved versions. An SBOM with unresolvable version specifiers is useless for vulnerability scanning (can't match CVEs to exact versions). |
| **Trailing commas in JSON** | 🔴 BROKEN | The `dependsOn` array has a trailing comma after the last element (output line 60: `"pkg:npm/zod@^4.4.3",`), making JSON invalid per spec. |
| **UUID generation fallback** | 🟡 Fragile | Falls back to `date +%s | md5sum | head -c 32` when `uuidgen` is missing. Produces deterministic UUIDs (same second → same UUID). |
| **Scoped package parsing** | 🟡 Fragile | `sed 's/@[^@]*$//'` on `@scope/name@version` may produce `@scope/name` correctly in most cases, but the code has two different parsing paths (lines 86-100) with conflicting logic. The `grep -q '^@'` guard can also silently skip valid scoped packages. |
| **Workspace scanning** | 🟡 Fragile | Hardcoded `find packages apps plugins tests -name "package.json"` — misses any new workspace directory not in this list. |
| **Performance** | ⚠️ Slow | Takes ~45-60 seconds. Parses `bun pm ls --all` tree output via bash `while read` subprocess — 1,346 lines of formatting that must be manually deconstructed. |

**Bottom line:** The output file is demonstrably broken on every run. This is not a "might fail someday" scenario — the script creates an invalid CycloneDX document that cannot be consumed by SBOM tools.

---

## 3. Design Overview

### 3.1 Approach: Lightweight — Parse `bun.lock` directly, emit JSON inline

**Why NOT `@cyclonedx/cyclonedx-library`:** Adding a dependency (`@cyclonedx/cyclonedx-library` v10.1.0, zero deps itself) is reasonable, but for a minimal replacement we can emit well-formed CycloneDX JSON directly from a tight Node.js script. The library is heavy for this use case and would pull in serialization pipelines we don't need. The CycloneDX JSON schema is simple — we only need `metadata`, `components`, and `dependencies` arrays.

**Why NOT `@cyclonedx/cyclonedx-npm`:** It works with `package-lock.json` / `yarn.lock` / `pnpm-lock.yaml` but has no built-in support for Bun's lockfile format (v1 JSON-like with trailing commas).

**Data source:** `bun.lock` (v1 format) is a JSON-like file that is *almost* valid JSON. The only issue is trailing commas before `]` and `}`. A simple regex cleanup (`content.replace(/,(\s*[}\]])/g, '$1')`) makes it fully parseable. This gives us **all 1,345 resolved packages** with their exact versions, integrity hashes, and dependency trees — no need for `bun pm ls --all` at all.

### 3.2 Architecture

```
scripts/generate-sbom.js   ← single-file Node.js script (~250 lines)
  ├── parse bun.lock        ← JSON-parse after trailing-comma cleanup
  ├── collect metadata      ← from package.json, os, bun version
  ├── build component list  ← all non-workspace packages from bun.lock
  ├── build dependency tree ← from per-package deps in bun.lock
  ├── serialize CycloneDX   ← well-formed JSON output
  └── optional CSV export   ← --csv flag
```

### 3.3 Output Format

- **Primary:** CycloneDX v1.5 JSON (`bom.json`)
- **Optional:** CSV summary (`--csv`, writes `bom.csv`)
- **Optional:** Audit report (`--audit`, runs `bun pm scan`)

---

## 4. Data Model from `bun.lock`

### 4.1 Parsing

```js
// Step 1: Clean trailing commas (bun.lock v1 format)
const raw = fs.readFileSync('bun.lock', 'utf-8');
const json = raw.replace(/,(\s*[}\]])/g, '$1');
const lock = JSON.parse(json);
```

### 4.2 Top-level structure

| Key | Type | Description |
|---|---|---|
| `lockfileVersion` | number | Always `1` for v1 format |
| `workspaces` | object | Keyed by workspace path (e.g., `"apps/cli"`), each with `name`, `dependencies`, `devDependencies` |
| `packages` | object | Keyed by resolved package name, ~1,345 entries |
| `overrides` | object | Any dependency overrides |

### 4.3 Package entry format

Each entry in `packages` is an array:
```
[0] "name@version"         // e.g. "@ai-sdk/provider@3.0.13"
[1] ""                     // optional package.json dir (usually "")
[2] { deps object }        // {dependencies:{...}, peerDependencies:{...}, optionalDependencies:{...}}
[3] "sha512-..."           // integrity hash
```

Key extraction detail: `lastIndexOf('@')` splits scoped names correctly:
- `@scope/name@1.2.3` → name=`@scope/name`, version=`1.2.3` ✓
- `name@1.2.3` → name=`name`, version=`1.2.3` ✓

### 4.4 Excluded from SBOM

- Workspace packages (`@agent-workbench/*`) — these are the project's own packages, not third-party dependencies
- Packages with `workspace:*` version — same reason

---

## 5. CLI Interface

### 5.1 Usage

```bash
node scripts/generate-sbom.js                    # Generate bom.json
node scripts/generate-sbom.js --audit             # Generate bom.json + run audit
node scripts/generate-sbom.js --csv               # Generate bom.json + bom.csv
node scripts/generate-sbom.js ./output            # Write to ./output/bom.json
```

Exactly mirrors the existing `sbom.sh` interface.

### 5.2 Package.json hooks (unchanged)

```json
{
  "sbom": "node scripts/generate-sbom.js",
  "sbom:audit": "node scripts/generate-sbom.js --audit"
}
```

---

## 6. Component Metadata

Each component in the SBOM will include:

| Field | Source | Example |
|---|---|---|
| `bom-ref` | Constructed PURL | `pkg:npm/@ai-sdk/provider@3.0.13` |
| `type` | Always `"library"` | `"library"` |
| `name` | Package name | `"@ai-sdk/provider"` |
| `version` | Resolved version | `"3.0.13"` |
| `purl` | Package URL | `"pkg:npm/@ai-sdk/provider@3.0.13"` |
| `hashes` (optional) | SHA-512 from lockfile | `[{ "alg": "SHA-512", "value": "sha512-ZPtVYt5..." }]` |
| `properties` | Dev vs runtime classification | `[{ "name": "dependency_type", "value": "dependencies" }]` |

### 6.1 Dev-vs-runtime classification

Walk workspace `package.json` declarations. A package is "devDependencies" if it appears in ANY workspace's `devDependencies` (or `peerDependencies`); otherwise "dependencies". Not perfect but matches the existing heuristic.

---

## 7. Dependency Graph

The `bun.lock` packages section already encodes per-package dependencies. We can build a proper dependency tree:

```json
"dependencies": [
  {
    "ref": "pkg:npm/agent-workbench@0.0.0",
    "dependsOn": [
      "pkg:npm/drizzle-orm@0.45.2",
      "pkg:npm/husky@9.1.7"
    ]
  },
  {
    "ref": "pkg:npm/drizzle-orm@0.45.2",
    "dependsOn": [
      "pkg:npm/@opentelemetry/api@1.9.0"
    ]
  }
]
```

This gives real transitive dependency information, enabling proper vulnerability graph traversal.

---

## 8. Error Handling

- **Missing `bun.lock`** — Print clear error, exit code 1
- **Trailing-comma cleanup fails** — Fall back to `bun pm ls --all` parsing (last resort)
- **`bun` not installed** — Print warning, proceed with version "unknown"
- **Invalid lockfile JSON** — Report parse error with position

---

## 9. File: `scripts/generate-sbom.js`

### 9.1 Estimate: ~250-300 lines

Structure:

| Section | Est. Lines |
|---|---|
| Shebang, imports | 5 |
| CLI argument parsing | 15 |
| `bun.lock` reading & cleanup | 20 |
| `bun.lock` JSON parsing | 10 |
| Package enumeration (exclude workspaces) | 25 |
| Metadata collection (version, os, bun) | 15 |
| Dev-vs-runtime classification | 20 |
| CycloneDX builder — components | 40 |
| CycloneDX builder — dependencies tree | 30 |
| CycloneDX builder — metadata | 20 |
| JSON serialization & write | 15 |
| CSV export (optional) | 15 |
| CLI flags (--audit, --csv) | 15 |
| Help text, error handling | 15 |
| **Total** | **~260** |

---

## 10. Migration Plan

### 10.1 Steps

1. Write `scripts/generate-sbom.js`
2. Test: generate output, validate with `npx @cyclonedx/cyclonedx-cli validate`
3. Compare component count against `bun.lock` package count (should match exactly for non-workspace packages)
4. Update `package.json` scripts (optional — both scripts can coexist initially)
5. Optionally remove `scripts/sbom.sh` after deprecation period

### 10.2 Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `bun.lock` v1 format changes | Low | High | Retain bash script as fallback; add format-version check |
| Trailing comma regex misses edge case | Low | Medium | Test with current lockfile; add JSON parse error fallback |
| Missing packages (false negatives) | Low | High | Verify component count == lockfile package count |
| Integrity hash format changes | Low | Medium | Graceful: omit hashes if parsing fails |
| `node` vs `bun` runtime | Medium | Low | Script uses only Node.js stdlib — runs on both |

### 10.3 Estimated Effort

- **Implementation:** 2-3 hours (single file, no deps)
- **Testing/validation:** 1 hour
- **Integration/CI update:** 30 min
- **Total:** ~4 hours

---

## 11. Verification

After implementation, validate with:

```bash
# Generate SBOM
node scripts/generate-sbom.js

# Validate CycloneDX conformance
npx @cyclonedx/cyclonedx-cli validate --input-format json --input-file bom.json

# Verify component count matches expected
node -e "const j=require('./bom.json'); console.log('Components:', j.components.length);"

# Expected: 1,316 components (1,345 total - 29 workspace packages)
# Current broken script: 17 components
```

---

## 12. Alternatives Considered

| Approach | Pros | Cons |
|---|---|---|
| **Fix bash script** | No new file | Bash string escaping for JSON is inherently fragile; still limited by `bun pm ls --all` parsing; 1,316 deps would make it even slower |
| **Use `@cyclonedx/cyclonedx-npm` CLI** | Official tool, well-tested | Requires npm lockfile format; no bun.lock support; would need lockfile conversion |
| **Use `@cyclonedx/cyclonedx-library`** | API covers all CDX features | Heavy dependency chain for a simple task; adds maintenance burden |
| **Write Go binary** | Fast, single binary | Overkill for 260 lines; breaks the JS toolchain convention |
| **✅ Minimal Node.js script (chosen)** | Zero deps, fast, correct, compatible | Must manage CycloneDX schema manually |

---

## Appendix A: Manual Validation Results (Current Script)

```
Current sbom.sh:
  Components:    17  (of 1,345 in bun.lock)
  Output valid:  NO  (literal escape sequences, trailing commas)
  Versions:      RANGES (^9.0.0) not resolved
  Generation:    45-60 seconds

Replacement target:
  Components:    ~1,316  (non-workspace packages)
  Output valid:  YES
  Versions:      RESOLVED (3.0.13)
  Generation:    < 1 second  (direct JSON parse, no subprocess)
```

## Appendix B: Key Findings from Investigation

- **bun.lock v1** is ~340 KB, 3,062 lines, contains all resolved dependency data
- It's nearly valid JSON — only trailing commas differ from strict JSON
- Each package entry has: resolved name@version, dependency list (with resolved sub-versions), SHA-512 hash
- bun.lock has 1,345 package entries — 29 workspace packages, 1,316 third-party packages
- The existing script only reads declared dependencies from 30 workspace package.json files — it never accesses the lockfile's transitive dependency information
