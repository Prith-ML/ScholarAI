# Notion MCP Export — Design

## Problem

ScholarAI's research agent produces answers (narrative + citations + follow-up
questions) that currently only live inside a chat session. There's no way to
persist a specific answer somewhere researchers actually keep notes. We want
users to be able to save an individual assistant message to Notion, using
Claude's MCP connector to talk to Notion's hosted MCP server rather than
writing a bespoke Notion API client.

## Decisions

- **Trigger:** explicit user action only (a "Save to Notion" button on an
  assistant message). Not automatic — avoids creating a Notion page for every
  throwaway chat turn.
- **Auth:** single shared Notion workspace via one bearer token in an env var.
  No per-user OAuth — ScholarAI has no existing per-user third-party OAuth
  infrastructure, and building one is out of scope for this feature.
- **Notion structure:** each save creates a new Notion page (titled from the
  original query) as a child of one configured parent page. Not a running log
  — separate pages are easier to find/organize later and match how a single
  research answer is a self-contained unit.

## Architecture

A new, isolated module `backend/ai/notion_export.py` makes one direct call to
the raw `anthropic` SDK (already a dependency — `anthropic>=0.64.0` in
`backend/requirements.txt` — but currently unused directly; the rest of the
codebase goes through `langchain_anthropic.ChatAnthropic`) using the **MCP
connector**:

```python
client.beta.messages.create(
    model=...,
    betas=["mcp-client-2025-11-20"],
    mcp_servers=[{
        "type": "url",
        "url": "https://mcp.notion.com/mcp",
        "name": "notion",
        "authorization_token": NOTION_MCP_TOKEN,
    }],
    tools=[{"type": "mcp_toolset", "mcp_server_name": "notion"}],
    messages=[...],
)
```

Claude picks the right Notion tool calls itself (e.g. create-page) — no
client-side MCP client or tool-execution loop needs to be built.

This deliberately bypasses LangChain for this one call. `django_agent_runner.py`
doesn't use LangChain's tool/agent machinery anywhere today — every LLM call is
a bare `llm.invoke(prompt)` (`intelligent_search`, `generate_narrative_response`,
`ProactiveAgent`). Introducing an agent-executor pattern just for this one
feature would be a bigger architectural change than the feature warrants.
Keeping `notion_export.py` a standalone module with a plain function matches
how the rest of the file is organized, and makes the export logic testable in
isolation from the search/chat pipeline.

## Backend components

### `backend/ai/notion_export.py` (new)

```python
def save_message_to_notion(query: str, content: str) -> dict:
    """
    Create a new Notion page (child of NOTION_PARENT_PAGE_ID) titled from
    `query`, with `content` as the page body. Returns {"notion_url": str} on
    success or {"error": str} on failure. Never raises.
    """
```

- `content` is the assistant message's full text as already stored — it
  already contains the narrative, citations, and follow-up questions as one
  formatted string (built by `generate_narrative_response` +
  `_add_agentic_features` in `django_agent_runner.py`). No need to
  reconstruct separate sections from `Source` rows.
- The prompt sent to Claude instructs it to create the page and then reply
  with a fixed sentinel line, e.g. `SAVED: <url>`, as the last line of its
  final text response. Parse that sentinel deterministically rather than
  reaching into Notion's MCP tool-result JSON shape (which this codebase
  doesn't control and shouldn't couple to).
- Catches all exceptions and returns `{"error": ...}` — this function must
  never raise into the view.

### `Message.notion_url` (new field + migration)

Nullable `URLField` on `backend.chat.models.Message`. Once a save succeeds,
store the returned URL so the UI can show "View in Notion" instead of "Save"
on subsequent renders/reloads of the same session.

### New view + route

`POST /api/chat/messages/<int:message_id>/save-to-notion/` in
`backend/chat/views.py` / `backend/chat/urls.py`:

1. Load the `Message` by id; 404 if missing or not `role='assistant'`.
2. Find the preceding `role='user'` `Message` in the same session (ordered by
   `timestamp`) to use as the query/title source.
3. Call `notion_export.save_message_to_notion(query, message.content)`.
4. On success: set `message.notion_url`, save, return
   `JsonResponse({"notion_url": ...})`.
5. On failure: return `JsonResponse({"error": ...}, status=502)` — never a
   raw 500.

### Fix `send_message` response

`backend/chat/views.py::send_message` currently returns
`{'message', 'sources', 'session_id'}` — it never includes the assistant
message's DB id. Add `'message_id': assistant_message.id` to the response.
This is required groundwork: without a real DB id, the frontend has no way to
address a specific message for the save action (today it fabricates
`id: Date.now().toString()` client-side — see Frontend section).

## Config

New env vars, documented in `env.example`:

- `NOTION_MCP_TOKEN` — bearer token sent as the MCP server's
  `authorization_token`.
- `NOTION_PARENT_PAGE_ID` — the Notion page all exported pages are created
  under.

**Open item to verify during implementation:** Notion's hosted MCP server
(`mcp.notion.com`) may require an interactive OAuth flow rather than accepting
a static integration token as a bearer credential. If so, the one-time setup
step becomes "complete the OAuth flow once, capture the resulting access
token" instead of "paste a Notion integration token" — but the rest of the
design (one shared token in an env var, no per-request/per-user auth) is
unaffected either way. This must be confirmed against Notion's MCP server
documentation before the implementation is considered done, not assumed.

## Frontend (`frontend/src/app/chat/page.tsx`)

- Change `Message.id` to come from the backend (`data.message_id`) instead of
  `Date.now().toString()`, using the fix above.
- Add a "Save to Notion" button to the `MessageActions` component (alongside
  the existing Copy / Good / Bad buttons, which currently have no handlers
  either — this feature is the first one to wire a real handler in that
  component).
- Button states: idle ("Save to Notion") → loading (spinner/disabled) →
  success (becomes "View in Notion", a link, using the returned URL) →
  error (inline error text, button resets to idle so the user can retry).

## Error handling

Every failure mode — bad/missing token, Notion rate limit, MCP tool error,
network failure — is caught inside `notion_export.py` and surfaced as a JSON
error from the view (HTTP 502), never an unhandled 500. The frontend shows
that error inline next to the button rather than failing silently or throwing
in the console only.

## Testing

- Unit test `notion_export.save_message_to_notion` with the `anthropic`
  client mocked. Assert: the `mcp-client-2025-11-20` beta header is present,
  `mcp_servers` points at `mcp.notion.com` with the configured token, the
  parent page id appears in the prompt, and the sentinel-line parser
  correctly extracts the URL from a mocked response (and returns an error
  dict when the sentinel is absent/malformed).
- View-level test for `POST /api/chat/messages/<id>/save-to-notion/` using
  that mock: success path (message gets `notion_url` set, 200 response),
  message-not-found path (404), and Notion-failure path (502, message
  `notion_url` stays null).

## Out of scope

- Per-user Notion OAuth / multi-tenant Notion connections.
- Automatic/implicit saving (every response, or response-with-sources).
- Editing or deleting a previously-saved Notion page from ScholarAI.
- Any other MCP server integration (GitHub, Slack, Drive) — this design is
  Notion-specific; a future integration would likely factor out a shared
  "MCP export" helper, but that generalization isn't done speculatively here.
