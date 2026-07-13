# Authentication & Per-User Data Isolation — Design

Date: 2026-07-13
Status: Approved (pending spec review)

## Problem

ScholarAI has no authentication today. The `users` app is an empty stub. `ChatSession.user`
and `ResearchStats.user` are nullable FKs that nothing ever sets. Several backend views have
no auth decorator at all and operate over *all* sessions/messages globally
(`send_message`, `dashboard_stats`, `recent_sessions`, `ai_insights`,
`delete_session_dashboard`, `save_to_notion`). The frontend has no login/signup UI, no auth
state, and makes plain `fetch()` calls with no credentials.

This design adds sign-up, sign-in, sign-out, persistent login, and strict per-user data
isolation across the chat/research/dashboard surface.

## Constraints

- Frontend (Next.js 14, Vercel) and backend (Django 5.2 + DRF, Railway) are deployed on
  **different domains**. `CORS_ALLOW_CREDENTIALS = True` and specific origins are already
  whitelisted in `backend/core/settings.py`.
- Keep using `django.contrib.auth.models.User` — no custom user model swap.
  `ChatSession`/`ResearchStats` already FK directly to it and no migrations exist yet, so a
  swap would add risk for no benefit here.
- `chat/consumers.py` (referenced by `backend/core/routing.py`'s WebSocket route) does not
  exist in the repo — Channels/WebSocket chat is dead/unfinished code today and is out of
  scope for this change.
- No automated frontend test framework exists in the repo; frontend verification is manual.

## Decisions

1. **Auth transport: JWT access token + httpOnly refresh cookie**, via
   `djangorestframework-simplejwt`. Chosen over Django session cookies because cross-site
   session cookies (`SameSite=None`) are fragile in practice (Safari/iOS ITP, browser
   cookie-blocking) and add a CSRF-token dance to every mutating request. The access token
   lives in memory only on the frontend (never `localStorage`), limiting XSS blast radius;
   the refresh token is httpOnly and never touched by JS.
2. **Sign-up fields: email + password only.** `username` is auto-set equal to `email` under
   the hood so the existing `unique=True` on `username` enforces email uniqueness for free.
   No email-verification step at launch — account is active immediately.
3. **Legacy data:** existing `user=NULL` rows in `ChatSession`/`ResearchStats` are deleted in
   a data migration before the FK becomes non-nullable. Treated as disposable pre-auth test
   data.
4. **Ownership errors are 404, not 403** — accessing another user's session/message ID
   doesn't confirm the resource exists.

## Backend Design

### New dependency

- `djangorestframework-simplejwt` added to `backend/requirements.txt`.
- `rest_framework_simplejwt.token_blacklist` added to `INSTALLED_APPS` (needed for logout to
  actually invalidate the refresh token, not just delete the cookie).

### Settings changes (`backend/core/settings.py`)

- `REST_FRAMEWORK.DEFAULT_AUTHENTICATION_CLASSES` gains
  `rest_framework_simplejwt.authentication.JWTAuthentication`. Existing
  `SessionAuthentication`/`BasicAuthentication` stay (used by `/admin/`).
  `DEFAULT_PERMISSION_CLASSES` stays `IsAuthenticated` (already the case) — every endpoint is
  locked down unless it explicitly opts out (as `health_check` already does).
- `SIMPLE_JWT` config: short-lived access token (15 min), longer refresh token (7 days),
  `ROTATE_REFRESH_TOKENS=True`, `BLACKLIST_AFTER_ROTATION=True`.
- New cookie settings for the refresh token, driven by `DEBUG`/env so local dev over plain
  `http://localhost` still works:
  - `AUTH_COOKIE_SECURE = not DEBUG` (env-overridable)
  - `AUTH_COOKIE_SAMESITE = 'None' if not DEBUG else 'Lax'`
  - `AUTH_COOKIE_NAME = 'refresh_token'`, `httponly=True`, `path='/api/auth/'`

### `users` app (currently an empty stub)

New serializers (`users/serializers.py`):
- `SignupSerializer` — `email`, `password` (write-only, validated against the already
  configured `AUTH_PASSWORD_VALIDATORS`); explicit "email already registered" check beyond
  the DB-level unique constraint, for a clean error message.
- `UserSerializer` — `id`, `email` (read-only, used in login/signup/me responses).

New views (`users/views.py`):
- `POST /api/auth/signup/` — creates the user (`username = email`), logs them in (same
  response shape as login: `{ access, user }` body + refresh cookie set).
- `POST /api/auth/login/` — authenticates by email + password, returns `{ access, user }` in
  the body, sets the refresh token as the httpOnly cookie described above. Generic `401
  "Invalid email or password"` on failure (doesn't reveal which field was wrong).
- `POST /api/auth/logout/` — reads the refresh cookie, blacklists it via
  `token_blacklist`, deletes the cookie.
- `POST /api/auth/token/refresh/` — reads the refresh cookie (not the request body), issues
  a new access token, rotates the refresh cookie.
- `GET /api/auth/me/` — returns the current authenticated user; used by the frontend on load
  to silently check "am I still logged in."

New URLs (`users/urls.py`, included from `core/urls.py` under `api/auth/`).

### Data model changes

- `backend/chat/models.py`: `ChatSession.user` and `ResearchStats.user` FKs change from
  `null=True, blank=True` to required (`null=False`).
- Migration sequence: (1) data migration deleting all `ChatSession`/`ResearchStats` rows
  where `user_id IS NULL`, (2) schema migration altering both FKs to non-nullable.

### `chat/views.py` rewrite — closing the actual security gap

Every view becomes `@api_view` + `@permission_classes([IsAuthenticated])` and every query is
scoped to `request.user`:

| View | Change |
|---|---|
| `send_message` | New sessions created with `user=request.user`; an incoming `session_id` is looked up as `get_object_or_404(ChatSession, id=session_id, user=request.user)` instead of a global `.get()` |
| `dashboard_stats` | `ResearchStats.get_or_create_stats(user=request.user)` instead of the global/no-user call |
| `recent_sessions` | `ChatSession.objects.filter(user=request.user)` instead of `.all()` |
| `ai_insights` | Topic/activity analysis computed only from `request.user`'s sessions/messages |
| `delete_session_dashboard` | `get_object_or_404(ChatSession, id=session_id, user=request.user)` instead of deleting any session by raw ID |
| `save_to_notion` | Adds `IsAuthenticated`; 404s unless `message.session.user == request.user` |
| `chat_sessions`, `chat_session_detail`, `delete_session` | Already `IsAuthenticated` + user-filtered; no behavior change beyond the new JWT auth class |
| `health_check` | Unchanged — stays open, no auth (used for uptime checks) |

## Frontend Design

### Auth state (`frontend/src/store/authStore.ts`)

Zustand store (dependency already present in `package.json`, currently unused) holding
`{ user, accessToken, status: 'loading' | 'authenticated' | 'unauthenticated', login, signup, logout }`.
The access token lives only in this in-memory store — never persisted to `localStorage`.

On root layout mount, the store calls `POST /api/auth/token/refresh/` once (the refresh
cookie rides along automatically via `credentials: 'include'`). Success hydrates
`user`/`accessToken` without re-entering credentials — this is what makes login persistent
across reloads/tabs. Failure sets `status: 'unauthenticated'`.

### API client (`frontend/src/lib/api.ts`)

Thin `fetch` wrapper replacing the raw `fetch(...)` calls currently in `chat/page.tsx`,
`research/page.tsx`, and the Notion-save action:
- Attaches `Authorization: Bearer <accessToken>` from the store.
- Always sends `credentials: 'include'`.
- On a `401`, attempts one silent refresh-and-retry; if that also fails, clears the store
  (→ `unauthenticated`).

### Route protection (belt-and-suspenders)

- `frontend/middleware.ts` checks for the mere *presence* of the refresh cookie (its value is
  httpOnly/unreadable, but presence is enough to gate on). Absent → redirect `/chat` and
  `/research` to `/signin?next=<path>` before any render.
- A client-side guard also checks the Zustand store's `status`, so a stale/invalid cookie
  (e.g. a blacklisted refresh token) still bounces the user to `/signin` once hydration
  resolves to logged-out.

### New pages & UI wiring

- `/signin`, `/signup` — new App Router pages styled consistently with the existing
  dark-glass aesthetic (`app-panel`, `glow-border`, existing `Card`/`Button`/`Input`
  components).
- `AppSidebar`'s footer (currently a static "Research engine online" line) becomes a small
  user menu: email + "Sign out" when logged in, "Sign in" link when logged out.
- Landing page (`app/page.tsx`) hero gets sign-in/sign-up CTAs.

## Error Handling

- Signup: `400` with field errors (email already registered, or Django's password-validator
  messages).
- Login: `401`, generic "Invalid email or password".
- Expired access token mid-session: API client silently refreshes once and retries; if the
  refresh cookie itself is invalid/expired, the user is dropped back to `/signin`.
- Direct navigation to a protected page while logged out: `middleware.ts` redirects before
  render.
- Guessing another user's `session_id`/`message_id` anywhere: `404`.

## Testing

- Backend: `users/tests.py` covers signup validation, login success/failure, refresh
  rotation, logout blacklist. `chat/tests.py` is extended with a two-user fixture proving
  each rewritten endpoint requires auth, a second user gets `404` on the first user's
  sessions/messages/notion-save, and dashboard stats/sessions/insights only ever reflect the
  requesting user's own data.
- Frontend: no automated test framework exists in this repo; verified manually after
  implementation (via the `/verify` skill) — sign up, sign in, reload the page and confirm
  the session persists, sign out, direct-nav to `/chat` while logged out redirects to
  `/signin`, and two separate browser profiles don't see each other's sessions/dashboard
  data.

## Out of Scope

- Email verification, password reset, social login (all explicitly deferred).
- Fixing/implementing the dead `chat/consumers.py` WebSocket path — unrelated pre-existing
  gap.
- Rate limiting / account lockout on login attempts.
