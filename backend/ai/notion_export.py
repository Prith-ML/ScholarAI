"""Export a chat message to Notion via Notion's REST API.

Notion's hosted MCP server (mcp.notion.com) requires interactive
browser-based OAuth for every authorization and does not support a static
bearer token for headless/server-to-server use, so this calls Notion's
REST API directly with a Notion internal integration token instead.
"""
import os
import logging

import requests

logger = logging.getLogger(__name__)

NOTION_API_TOKEN = os.getenv('NOTION_API_TOKEN')
NOTION_PARENT_PAGE_ID = os.getenv('NOTION_PARENT_PAGE_ID')

NOTION_API_URL = "https://api.notion.com/v1/pages"
NOTION_API_VERSION = "2022-06-28"

_BLOCK_TEXT_LIMIT = 2000
_MAX_BLOCKS = 100


def _chunk_text(text: str, limit: int = _BLOCK_TEXT_LIMIT) -> list:
    """Split text into Notion rich_text-sized chunks (max 2000 chars each)."""
    if not text:
        return [""]
    return [text[i:i + limit] for i in range(0, len(text), limit)]


def save_message_to_notion(query: str, content: str) -> dict:
    """
    Create a new Notion page (child of NOTION_PARENT_PAGE_ID) titled from
    `query`, with `content` as the page body, via Notion's REST API.

    Returns {"notion_url": str} on success or {"error": str} on failure.
    Never raises.
    """
    if not NOTION_API_TOKEN:
        return {"error": "Notion is not configured (NOTION_API_TOKEN missing)."}
    if not NOTION_PARENT_PAGE_ID:
        return {"error": "Notion is not configured (NOTION_PARENT_PAGE_ID missing)."}

    title = query.strip()[:100] if query and query.strip() else "ScholarAI Research Note"

    payload = {
        "parent": {"page_id": NOTION_PARENT_PAGE_ID},
        "properties": {
            "title": {
                "title": [{"text": {"content": title}}]
            }
        },
        "children": [
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{"type": "text", "text": {"content": chunk}}]
                },
            }
            for chunk in _chunk_text(content)[:_MAX_BLOCKS]
        ],
    }

    try:
        response = requests.post(
            NOTION_API_URL,
            headers={
                "Authorization": f"Bearer {NOTION_API_TOKEN}",
                "Notion-Version": NOTION_API_VERSION,
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=15,
        )
    except requests.RequestException as e:
        logger.error(f"Notion export request failed: {e}")
        return {"error": "Notion export request failed. Please try again later."}

    if response.status_code not in (200, 201):
        logger.error(f"Notion export failed with status {response.status_code}: {response.text}")
        return {"error": "Notion export failed. Please try again later."}

    data = response.json()
    notion_url = data.get("url")
    if not notion_url:
        logger.error(f"Notion export: response missing 'url' field: {data!r}")
        return {"error": "Notion export did not complete (no confirmation received)."}

    return {"notion_url": notion_url}
