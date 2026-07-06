#!/usr/bin/env bash
# ── SBOM Generator ─────────────────────────────────────────────────────────
# Generates a CycloneDX v1.5 Software Bill of Materials for agent-workbench.
# Uses `bun pm ls --all` and `bun pm audit` for dependency data.
#
# Output files:
#   bom.json  — CycloneDX JSON SBOM
#   bom.csv   — Human-readable dependency list (optional)
#
# Usage:
#   bash scripts/sbom.sh          # Generate SBOM
#   bash scripts/sbom.sh --audit  # Generate SBOM + run audit
#   bash scripts/sbom.sh --csv    # Generate SBOM + CSV summary
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail
cd "$(dirname "$0")/.." || exit 1

SCRIPT_DIR="$(dirname "$0")"
OUT_DIR="."
GENERATE_CSV=false
RUN_AUDIT=false

# Parse flags and positional args
for arg in "$@"; do
  case "$arg" in
    --csv)   GENERATE_CSV=true ;;
    --audit) RUN_AUDIT=true ;;
    *)       OUT_DIR="$arg" ;;   # positional: output directory
  esac
done

echo "🔍 Generating SBOM for agent-workbench..."

# ── Metadata ─────────────────────────────────────────────────────────────
PACKAGE_NAME="agent-workbench"
PACKAGE_VERSION=$(node -e "console.log(require('./package.json').version || '0.0.0')" 2>/dev/null || echo "0.0.0")
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
BUN_VERSION=$(bun --version 2>/dev/null || echo "unknown")
OS_NAME=$(uname -s 2>/dev/null || echo "unknown")
OS_ARCH=$(uname -m 2>/dev/null || echo "unknown")

echo "  Package: ${PACKAGE_NAME}@${PACKAGE_VERSION}"
echo "  Bun: v${BUN_VERSION}"
echo "  OS: ${OS_NAME}/${OS_ARCH}"
echo ""

# ── Collect dependencies ─────────────────────────────────────────────────
echo "  Collecting dependencies from bun.lock..."

# Parse package.json files in workspaces to get declared dependencies
declare -A ALL_DEPS
declare -A DEV_DEPS
declare -A DEP_VERSIONS

# Get all workspace package.json files
WORKSPACE_PKGS=$(find packages apps plugins tests -name "package.json" -not -path "*/node_modules/*" 2>/dev/null || true)

# Also include root
WORKSPACE_PKGS="package.json ${WORKSPACE_PKGS}"

for PKGJSON in ${WORKSPACE_PKGS}; do
  [ ! -f "${PKGJSON}" ] && continue
  
  # Extract dependencies
  while IFS=$'\t' read -r name ver; do
    [ -z "$name" ] && continue
    ALL_DEPS["$name"]=1
    DEP_VERSIONS["$name"]="$ver"
  done < <(node -e "
    const p = require('./${PKGJSON}');
    const deps = p.dependencies || {};
    const devDeps = p.devDependencies || {};
    for (const [k, v] of Object.entries(deps)) {
      if (!k.startsWith('@agent-workbench/')) console.log(k + '\t' + v);
    }
    for (const [k, v] of Object.entries(devDeps)) {
      if (!k.startsWith('@agent-workbench/')) { console.log(k + '\t' + v); DEV_DEPS[k]=1; }
    }
  " 2>/dev/null || true)
done

# Also get full list from bun pm ls --all for accurate version resolution
declare -A BUN_VERSIONS
while IFS='@' read -r rest; do
  # Parse lines like "├── package@version" or "│   └── sub@version"
  line_clean=$(echo "$rest" | sed 's/^[│├└─├┌┐└┘─│\s]*//' | xargs)
  # Skip workspace packages
  echo "$line_clean" | grep -q '@agent-workbench/' && continue
  echo "$line_clean" | grep -q '^@[a-z0-9_-]' || continue
  
  pkg_name=$(echo "$line_clean" | sed 's/@[^@]*$//' 2>/dev/null || echo "$line_clean")
  pkg_ver=$(echo "$line_clean" | grep -o '@[^@]*$' | sed 's/^@//' 2>/dev/null || echo "unknown")
  
  # Normalize scoped package names
  if echo "$line_clean" | grep -q '^@'; then
    # scoped: @scope/name@version
    pkg_name=$(echo "$line_clean" | sed 's/@[^@]*$//')
    pkg_ver=$(echo "$line_clean" | sed 's/.*@//')
  fi
  
  [ -n "$pkg_name" ] && BUN_VERSIONS["$pkg_name"]="$pkg_ver"
done < <(bun pm ls --all 2>/dev/null || true)

# Merge version info (prefer bun pm ls resolution)
for pkg in "${!ALL_DEPS[@]}"; do
  if [ -n "${BUN_VERSIONS[$pkg]:-}" ]; then
    DEP_VERSIONS["$pkg"]="${BUN_VERSIONS[$pkg]}"
  fi
done

# ── Generate CycloneDX JSON ──────────────────────────────────────────────
echo "  Writing CycloneDX v1.5 SBOM..."

COMPONENTS="["
FIRST=true
INDEX=0

# Sort keys for deterministic output
for PKG in $(printf '%s\n' "${!DEP_VERSIONS[@]}" | sort); do
  VER="${DEP_VERSIONS[$PKG]}"
  
  # Detect if this is a dev dependency
  IS_DEV="false"
  [ -n "${DEV_DEPS[$PKG]:-}" ] && IS_DEV="true"
  
  # Determine type
  if [[ "$PKG" == @types/* ]]; then
    TYPE="library"
  elif [[ "$PKG" == typescript ]] || [[ "$PKG" == eslint* ]]; then
    TYPE="library"
  else
    TYPE="library"
  fi
  
  COMPONENT=""
  COMPONENT+="    {\n"
  COMPONENT+="      \"bom-ref\": \"pkg:npm/${PKG}@${VER}\",\n"
  COMPONENT+="      \"type\": \"${TYPE}\",\n"
  COMPONENT+="      \"name\": \"${PKG}\",\n"
  COMPONENT+="      \"version\": \"${VER}\",\n"
  COMPONENT+="      \"purl\": \"pkg:npm/${PKG}@${VER}\",\n"
  COMPONENT+="      \"properties\": [\n"
  COMPONENT+="        {\n"
  COMPONENT+="          \"name\": \"dependency_type\",\n"
  COMPONENT+="          \"value\": \"$([ "$IS_DEV" == "true" ] && echo "devDependencies" || echo "dependencies")\"\n"
  COMPONENT+="        }\n"
  COMPONENT+="      ]\n"
  COMPONENT+="    }"
  
  if [ "$FIRST" = true ]; then
    COMPONENTS+="${COMPONENT}"
    FIRST=false
  else
    COMPONENTS+=",\n${COMPONENT}"
  fi
  
  INDEX=$((INDEX + 1))
done
COMPONENTS+="\n  ]"

# Write JSON SBOM
cat > "${OUT_DIR}/bom.json" << BOMEOF
{
  "\$schema": "https://cyclonedx.org/schema/bom-1.5.schema.json",
  "bomFormat": "CycloneDX",
  "specVersion": "1.5",
  "serialNumber": "urn:uuid:$(uuidgen 2>/dev/null || date +%s | md5sum | head -c 32 | sed 's/\(........\)\(....\)\(....\)\(....\)\(............\)/\1-\2-\3-\4-\5/')",
  "version": 1,
  "metadata": {
    "timestamp": "${TIMESTAMP}",
    "tools": [
      {
        "vendor": "agent-workbench",
        "name": "sbom-generator",
        "version": "1.0.0"
      }
    ],
    "component": {
      "bom-ref": "pkg:npm/${PACKAGE_NAME}@${PACKAGE_VERSION}",
      "type": "application",
      "name": "${PACKAGE_NAME}",
      "version": "${PACKAGE_VERSION}",
      "purl": "pkg:npm/${PACKAGE_NAME}@${PACKAGE_VERSION}"
    },
    "properties": [
      {
        "name": "bun:version",
        "value": "${BUN_VERSION}"
      },
      {
        "name": "os:name",
        "value": "${OS_NAME}"
      },
      {
        "name": "os:arch",
        "value": "${OS_ARCH}"
      }
    ]
  },
  "components": ${COMPONENTS},
  "dependencies": [
    {
      "ref": "pkg:npm/${PACKAGE_NAME}@${PACKAGE_VERSION}",
      "dependsOn": [
$(for PKG in $(printf '%s\n' "${!DEP_VERSIONS[@]}" | sort); do
  echo "        \"pkg:npm/${PKG}@${DEP_VERSIONS[$PKG]}\","
done)
      ]
    }
  ]
}
BOMEOF

TOTAL_DEPS=${#DEP_VERSIONS[@]}
echo "  ✅ SBOM written to ${OUT_DIR}/bom.json (${TOTAL_DEPS} components)"

# ── CSV summary ──────────────────────────────────────────────────────────
if [ "$GENERATE_CSV" = true ]; then
  echo "  Writing CSV summary..."
  echo "name,version,type" > "${OUT_DIR}/bom.csv"
  for PKG in $(printf '%s\n' "${!DEP_VERSIONS[@]}" | sort); do
    VER="${DEP_VERSIONS[$PKG]}"
    IS_DEV="false"
    [ -n "${DEV_DEPS[$PKG]:-}" ] && IS_DEV="true"
    echo "${PKG},${VER},$([ "$IS_DEV" == "true" ] && echo "dev" || echo "runtime")"
  done >> "${OUT_DIR}/bom.csv"
  echo "  ✅ CSV summary written to ${OUT_DIR}/bom.csv"
fi

# ── Dependency audit ─────────────────────────────────────────────────────
if [ "$RUN_AUDIT" = true ]; then
  echo ""
  echo "🔒 Running dependency audit..."
  AUDIT_OUTPUT=$(bun pm scan 2>&1 || true)
  echo "${AUDIT_OUTPUT}"
  
  # Save audit report
  echo "${AUDIT_OUTPUT}" > "${OUT_DIR}/audit-report.txt"
  echo "  ✅ Audit report written to ${OUT_DIR}/audit-report.txt"
fi

echo ""
echo "📊 Summary:"
echo "  Components: ${TOTAL_DEPS}"
echo "  Artifacts:"
echo "    - ${OUT_DIR}/bom.json"
[ "$GENERATE_CSV" = true ] && echo "    - ${OUT_DIR}/bom.csv"
[ "$RUN_AUDIT" = true ] && echo "    - ${OUT_DIR}/audit-report.txt"
echo ""
echo "✅ SBOM generation complete."
