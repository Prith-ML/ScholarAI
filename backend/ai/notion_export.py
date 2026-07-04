"""Export a chat message to Notion via Claude's MCP connector."""
import os
import re
import logging

import anthropic

logger = logging.getLogger(__name__)

CLAUDE_API_KEY = os.getenv('CLAUDE_API_KEY')
CLAUDE_MODEL = os.getenv('CLAUDE_MODEL', 'claude-haiku-4-5')
NOTION_MCP_TOKEN = os.getenv('NOTION_MCP_TOKEN')
NOTION_PARENT_PAGE_ID = os.getenv('NOTION_PARENT_PAGE_ID')

NOTION_MCP_SERVER_URL = "https://mcp.notion.com/mcp"

_SAVED_SENTINEL = re.compile(r'SAVED:\s*(\S+)')


def save_message_to_notion(query: str, content: str) -> dict:
    """
    Create a new Notion page (child of NOTION_PARENT_PAGE_ID) titled from
    `query`, with `content` as the page body, via Claude's MCP connector.

    Returns {"notion_url": str} on success or {"error": str} on failure.
    Never raises.
    """
    if not CLAUDE_API_KEY:
        return {"error": "Claude API key is not configured."}
    if not NOTION_MCP_TOKEN:
        return {"error": "Notion is not configured (NOTION_MCP_TOKEN missing)."}
    if not NOTION_PARENT_PAGE_ID:
        return {"error": "Notion is not configured (NOTION_PARENT_PAGE_ID missing)."}

    title = query.strip()[:100] if query and query.strip() else "ScholarAI Research Note"

    prompt = (
        f'Create a new Notion page titled "{title}" as a child of the Notion '
        f'page with id {NOTION_PARENT_PAGE_ID}. Set the page body to the '
        f'following content, preserving structure/headings where sensible:\n\n'
        f'{content}\n\n'
        f'After the page is created, reply with exactly one final line in '
        f'this exact format and nothing else on that line: SAVED: <page_url>'
    )

    try:
        client = anthropic.Anthropic(api_key=CLAUDE_API_KEY)
        response = client.beta.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=2048,
            betas=["mcp-client-2025-11-20"],
            mcp_servers=[{
                "type": "url",
                "url": NOTION_MCP_SERVER_URL,
                "name": "notion",
                "authorization_token": NOTION_MCP_TOKEN,
            }],
            tools=[{"type": "mcp_toolset", "mcp_server_name": "notion"}],
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception as e:
        logger.error(f"Notion export request failed: {e}")
        return {"error": "Notion export request failed. Please try again later."}

    if response.stop_reason == "refusal":
        return {"error": "Notion export was declined by the model."}

    text_parts = [
        block.text for block in response.content
        if getattr(block, "type", None) == "text"
    ]
    full_text = "\n".join(text_parts)

    match = _SAVED_SENTINEL.search(full_text)
    if not match:
        logger.error(f"Notion export: no SAVED sentinel found in response: {full_text!r}")
        return {"error": "Notion export did not complete (no confirmation received)."}

    return {"notion_url": match.group(1)}
