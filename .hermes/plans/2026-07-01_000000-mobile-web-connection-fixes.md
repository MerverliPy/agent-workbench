# Hermes Mobile-Web Connection Handling Fixes — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Fix vague error messages, settings/app URL contradiction, generic status display, and file browser UX in the mobile-web client so users can actually debug connection failures.

**Architecture:** The mobile-web app (SolidJS + Tailwind) uses `@agent-workbench/sdk` over HTTP to connect to the local Bun/Hono server. Errors flow through: SDK `HttpTransport` → `SdkError`/`ApiError` → app components → `StatusBar`/panel error displays. The fix chain is upstream-first: fix the SDK error messages, then propagate meaningful diagnostics through the UI.

**Tech Stack:** TypeScript, Bun, SolidJS, Zod v4, Hono, Vite, Tailwind CSS

---

## Root Cause Analysis (from investigation)

| # | Symptom | Root Cause | File:Line |
|---|---------|-----------|-----------|
| 1 | `Request failed: GET /global/health` — no URL | `HttpTransport.request()` catch block shows only path | `packages/sdk/src/transport/http.ts:54` |
| 2 | `HTTP 501: Not Implemented` — no URL | `parseError()` fallback message has no URL | `packages/sdk/src/transport/http.ts:88` |
| 3 | Settings shows `100.x.x.x:3000`, chat says `localhost:3000` | `testConnection()` uses input value but never saves to localStorage | `apps/mobile-web/src/components/panels/SettingsPanel.tsx:33-44` |
| 4 | Status always shows "Error" | `StatusBar` ignores `connectionError()` signal | `apps/mobile-web/src/components/StatusBar.tsx:14-21` |
| 5 | Connection catch doesn't distinguish ApiError vs SdkError | Generic `err instanceof Error` catch | `apps/mobile-web/src/App.tsx:61-64` |
| 6 | File browser shows cryptic error for 501 | No special handling for Not Implemented routes | `apps/mobile-web/src/components/panels/FileBrowserPanel.tsx:57-58` |

---

### Task 1: Fix SDK HttpTransport — include full URL in network error messages

**Objective:** Network fetch failures must include the full resolved URL and a diagnostic reason (connection refused, CORS, timeout, etc.) instead of just the bare path.

**Files:**
- Modify: `packages/sdk/src/transport/http.ts:50-55`

**Step 1: Extract resolved URL before fetch**

The `url` object is built at line 26 via `new URL(...)`. Extract it to a variable so it's available in the catch block.

**Step 2: Replace the vague error message**

Current (lines 50-55):
```typescript
    let response: Response;
    try {
      response = await fetch(url.toString(), fetchOptions);
    } catch (error) {
      throw new SdkError(`Request failed: ${method} ${path}`, error);
    }
```

Replace with:
```typescript
    const resolvedUrl = url.toString();

    let response: Response;
    try {
      response = await fetch(resolvedUrl, fetchOptions);
    } catch (error) {
      const reason =
        error instanceof TypeError && error.message === "Failed to fetch"
          ? " (connection refused, unreachable, or CORS blocked)"
          : error instanceof DOMException && error.name === "AbortError"
            ? " (request timed out or was cancelled)"
            : error instanceof Error
              ? ` (${error.message})`
              : "";
      throw new SdkError(
        `${method} ${resolvedUrl} failed${reason}`,
        error,
      );
    }
```

**Step 3: Update `parseError` signature and message**

`parseError(response: Response)` → `parseError(response: Response, resolvedUrl: string)`

Fallback message (line 88) from:
```typescript
message = `HTTP ${response.status}: ${response.statusText}`;
```
to:
```typescript
message = `${response.status} ${response.statusText} from ${resolvedUrl}`;
```

**Step 4: Update the call site (line 70)**

From:
```typescript
const parsed = await this.parseError(response);
```
To:
```typescript
const parsed = await this.parseError(response, resolvedUrl);
```

**Step 5: Verify**

Run the existing HTTP transport tests — they don't assert on exact error message text, so they should pass without changes:
```bash
cd tests && bun test integration/sdk/http-transport.test.ts
```
Expected: 12 pass, 0 fail

**Before/After examples:**
- Before: `Request failed: GET /global/health`
- After: `GET http://100.81.83.98:3000/global/health failed (connection refused, unreachable, or CORS blocked)`

---

### Task 2: Fix SettingsPanel — auto-save before Test Connection

**Objective:** When the user clicks "Test Connection", persist settings to localStorage first so the main chat screen reads the same URL and doesn't show a contradictory `localhost:3000` message.

**Files:**
- Modify: `apps/mobile-web/src/components/panels/SettingsPanel.tsx:33-44`

**Step 1: Save before testing**

Current `testConnection()`:
```typescript
  async function testConnection(): Promise<void> {
    setTesting(true);
    setTestResult(null);
    try {
      const client = reconnectClient(serverUrl());
      await client.health.check();
      setTestResult("✓ Connected successfully");
    } catch (err) {
      setTestResult(`✕ ${err instanceof Error ? err.message : "Connection failed"}`);
    } finally {
      setTesting(false);
    }
  }
```

Replace with:
```typescript
  async function testConnection(): Promise<void> {
    setTesting(true);
    setTestResult(null);

    // Persist settings BEFORE testing so the main app sees the same URL.
    const saved = saveSettings({
      serverUrl: serverUrl(),
      autoConnect: autoConnect(),
      preferredAgent: agent(),
    });

    try {
      const client = reconnectClient(saved.serverUrl);
      await client.health.check();
      setTestResult("✓ Connected successfully");
    } catch (err) {
      setTestResult(`✕ ${err instanceof Error ? err.message : "Connection failed"}`);
    } finally {
      setTesting(false);
    }
  }
```

**Step 2: Verify**

This is a pure logic change — the existing `saveSettings` import is already in scope. No new imports needed. The mobile-web build already passes.

---

### Task 3: Fix StatusBar — show specific error label instead of generic "Error"

**Objective:** The `connectionError()` signal carries a detailed error string from the SDK. Parse it to show concise user-facing labels like "Server unreachable", "HTTP 404", "CORS blocked", etc.

**Files:**
- Modify: `apps/mobile-web/src/components/StatusBar.tsx`

**Step 1: Import `connectionError`**

Add to line 2 import:
```typescript
import { connectionStatus, connectionError, currentAgentId, setDrawerOpen } from "../state/app";
```

**Step 2: Use `computeErrorLabel` in statusLabel**

Line 15, change `"error": return "Error";` to:
```typescript
case "error": return computeErrorLabel(connectionError());
```

**Step 3: Add title tooltip on the status area**

Line 37, add `title` attribute to the status `<div>` so users can long-press/see full error:
```typescript
<div class="flex items-center gap-2" title={connectionError() ?? ""}>
```

**Step 4: Add the `computeErrorLabel` helper function**

At end of file, before closing, add:
```typescript
/** Classify the raw error string into a concise, user-facing label. */
function computeErrorLabel(error: string | null): string {
  if (!error) return "Error";
  const msg = error.toLowerCase();
  if (msg.includes("connection refused") || msg.includes("unreachable")) return "Server unreachable";
  if (msg.includes("timed out") || msg.includes("cancelled")) return "Request timed out";
  if (msg.includes("cors")) return "CORS blocked";
  if (msg.includes("401") || msg.includes("unauthorized")) return "Unauthorized";
  if (msg.includes("403") || msg.includes("forbidden")) return "Forbidden";
  if (msg.includes("404") || msg.includes("not found")) return "Route not found";
  if (msg.includes("500") || msg.includes("internal")) return "Server error";
  if (msg.includes("501") || msg.includes("not implemented")) return "Not implemented";
  if (msg.includes("502") || msg.includes("bad gateway")) return "Bad gateway";
  if (msg.includes("503") || msg.includes("unavailable")) return "Service unavailable";
  const statusMatch = error.match(/\b(\d{3})\b/);
  if (statusMatch) return `HTTP ${statusMatch[1]}`;
  return "Error";
}
```

**Step 5: Verify**

No new dependencies. The `connectionError` signal is already defined in `state/app.ts:9`. Build check:
```bash
cd apps/mobile-web && bun run build
```

---

### Task 4: Fix App.tsx — distinguish ApiError from network errors in connect()

**Objective:** The `connect()` catch block should distinguish between `ApiError` (server responded with an error code — e.g. 501, 404) and `SdkError` (network failure, timeout). This feeds correctly into the StatusBar classification from Task 3.

**Files:**
- Modify: `apps/mobile-web/src/App.tsx`

**Step 1: Import ApiError**

Add to imports:
```typescript
import { ApiError } from "@agent-workbench/sdk";
```

**Step 2: Classify errors in catch block**

Current (lines 61-64):
```typescript
    } catch (err: unknown) {
      setConnectionStatus("error");
      setConnectionError(err instanceof Error ? err.message : "Server unreachable");
```

Replace with:
```typescript
    } catch (err: unknown) {
      setConnectionStatus("error");

      let errorMsg: string;
      if (err instanceof ApiError) {
        // Server responded with an error (4xx/5xx) — show the exact status.
        errorMsg = `${err.message}`;
      } else if (err instanceof Error) {
        // Network failure, timeout, or SDK validation error.
        errorMsg = err.message;
      } else {
        errorMsg = "Server unreachable";
      }
      setConnectionError(errorMsg);
```

**Step 3: Verify**

The `ApiError` class is exported from `@agent-workbench/sdk`. This import mirrors what the FileBrowserPanel already does.

---

### Task 5: Fix FileBrowserPanel — handle 501 placeholder gracefully

**Objective:** The `/file`, `/file/content`, `/file/diff`, `/file/tree` routes are registered as 501 `Not Implemented` in `apps/server/src/routes/placeholders.ts`. Instead of showing a raw `HTTP 501: Not Implemented from http://...` (which is now improved from Task 1), show a user-friendly message.

**Files:**
- Modify: `apps/mobile-web/src/components/panels/FileBrowserPanel.tsx`

**Step 1: Import ApiError**

Add to imports:
```typescript
import { ApiError } from "@agent-workbench/sdk";
```

**Step 2: Add `formatFileError` helper**

After the `joinPath` function, add:
```typescript
/** Provide user-friendly error messages, especially for placeholder (501) routes. */
function formatFileError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 501) {
      return "File browsing is not yet available (server route not implemented).";
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Failed to access filesystem";
}
```

**Step 3: Use in error handlers**

Replace both error catch blocks:

Line 57-58 (`loadDirectory`):
```typescript
setError(err instanceof Error ? err.message : "Failed to load directory");
```
→
```typescript
setError(formatFileError(err));
```

Line 70-71 (`openFile`):
```typescript
setError(err instanceof Error ? err.message : "Failed to read file");
```
→
```typescript
setError(formatFileError(err));
```

**Step 4: Verify**

Build: `cd apps/mobile-web && bun run build`

---

### Task 6: Rebuild and run full test suite

**Objective:** Confirm all changes compile and all existing tests pass.

**Commands:**

```bash
# Full package build
cd /home/calvin/workspace/agent-workbench && bun run build

# Mobile web build (Vite + PWA)
cd apps/mobile-web && bun run build

# Full test suite
cd tests && bun test
```

**Expected:** All 357 tests pass, both builds succeed.

---

## Acceptance Criteria Verification

| # | Criterion | How Verified | Covered By |
|---|-----------|-------------|------------|
| 1 | Main chat no longer says `localhost:3000` when Settings has remote URL | Test Connection auto-saves, so localStorage always matches input | Task 2 |
| 2 | Test Connection error includes full resolved URL + reason | `GET http://100.x.x.x:3000/global/health failed (connection refused...)` | Task 1 |
| 3 | File browser error includes full resolved URL + HTTP status or friendly message | 501 → friendly message; other errors → full URL in message | Task 1 + Task 5 |
| 4 | One API base URL resolver used consistently | `reconnectClient()` is the single source; `getClient()` lazily initializes from saved settings | Existing code (verified correct) |
| 5 | No accidental hardcoded localhost in production paths | Remaining instances are named defaults (`DEFAULTS.serverUrl`, `baseUrl` fallback), not runtime overrides | Confirmed via grep |
| 6 | Auto-connect doesn't race against settings load | Settings are loaded synchronously from localStorage in `connect()` — no async race | Existing code (verified correct) |
| 7 | Status message is specific, not generic | "Server unreachable" / "HTTP 404" / "CORS blocked" etc. from `computeErrorLabel()` | Task 3 + Task 4 |
| 8 | Build/lint/typecheck/test results reported | Full suite run at end | Task 6 |

---

## Remaining Issues (User Action Required)

1. **Server must bind to `0.0.0.0`** for phone access. The server's `config.ts` rejects non-loopback hosts (Phase 3 constraint). Start with:
   ```bash
   cd apps/server && HOST=0.0.0.0 bun run dev
   ```

2. **File browsing is a future phase.** Routes exist as 501 placeholders. The file browser now shows a clear message. No server-side changes in scope.

3. **CORS:** If the mobile web app is served on a different port/domain than the server, CORS headers may be needed on the server. This is outside the current scope.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| SDK error message format breaks existing API consumers | Low | Low — tests don't assert exact message format | Existing tests pass |
| `connectionError` signal null in edge cases | Low | Low — `computeErrorLabel` returns "Error" for null | Guard clause at top |
| Mobile-web build fails due to import paths | Low | Medium | Build verified in investigation phase; paths already correct |
