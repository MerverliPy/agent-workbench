# Phase 18 Exit Gates — Implementation Plan

## Current State
- 357 tests pass ✓
- 7-panel drawer with lazy-loaded panels ✓
- SDK connected, SSE events working ✓
- Permission prompt modal ✓
- StatusBar, ErrorBoundary, LoadingSkeleton, offline detection ✓
- **File routes are 501 placeholders** — FileBrowser makes real calls but gets errors
- **GitTree shows guidance text** — no real data
- **Sessions works** with real API, but messageCount is hardcoded 0
- **No service worker** — PWA is not installable
- **No theme toggle** in Settings

## Tasks

### 1. PWA Service Worker (NEW)
- Create `src/sw.ts` — Cache-first service worker for app shell
- Create `src/lib/pwa.ts` — Registration + install prompt
- Update `index.html` to register the service worker
- Update `vite.config.ts` to include sw.ts in build

### 2. Server File Routes (SERVER CHANGE)
- Implement `GET /file` — List directory contents
- Implement `GET /file/content` — Read file content  
- Remove from placeholder routes

### 3. FileBrowser Panel Polish
- Add LoadingSkeleton during load
- Add empty state for empty directories

### 4. GitTree Panel — Real Data
- Add server endpoint `GET /git/status` for git branch + status + commits
- Rewrite GitTreePanel to fetch real data with branch, status, recent commits
- Add LoadingSkeleton during load

### 5. Settings Panel — Theme Toggle
- Add dark/light/system theme selector
- Persist to localStorage
- Apply theme class to document

### 6. Sessions Panel — Real messageCount
- Fetch message count per session via `client.messages.list()`
- Show real counts instead of "0 messages"

### 7. Offline Banner UI
- Add offline banner component using existing offline.ts signals
- Show when `navigator.onLine` is false

### 8. Verification
- `bun test` — all 357 tests pass
- `bun run typecheck` in apps/mobile-web — clean
- `bun run build` in apps/mobile-web — succeeds
