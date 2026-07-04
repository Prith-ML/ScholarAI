import json
import os
import importlib
from types import SimpleNamespace
from unittest.mock import patch, MagicMock
from django.test import TestCase
from chat.models import ChatSession, Message
from ai import notion_export


class SendMessageResponseTests(TestCase):
    def test_response_includes_assistant_message_id(self):
        response = self.client.post(
            '/api/chat/send/',
            data=json.dumps({'message': 'Hello'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('message_id', data)

        assistant_message = Message.objects.get(id=data['message_id'])
        self.assertEqual(assistant_message.role, 'assistant')


def _make_response(text, stop_reason="end_turn"):
    return SimpleNamespace(
        stop_reason=stop_reason,
        content=[SimpleNamespace(type="text", text=text)],
    )


class SaveMessageToNotionTests(TestCase):
    def setUp(self):
        self.env_patcher = patch.dict(os.environ, {
            "CLAUDE_API_KEY": "test-claude-key",
            "NOTION_MCP_TOKEN": "test-notion-token",
            "NOTION_PARENT_PAGE_ID": "test-parent-page-id",
        })
        self.env_patcher.start()
        importlib.reload(notion_export)

    def tearDown(self):
        self.env_patcher.stop()
        importlib.reload(notion_export)

    @patch("ai.notion_export.anthropic.Anthropic")
    def test_returns_notion_url_on_success(self, mock_anthropic_cls):
        mock_client = MagicMock()
        mock_client.beta.messages.create.return_value = _make_response(
            "I created the page.\nSAVED: https://notion.so/abc123"
        )
        mock_anthropic_cls.return_value = mock_client

        result = notion_export.save_message_to_notion("What is RAG?", "RAG is...")

        self.assertEqual(result, {"notion_url": "https://notion.so/abc123"})
        _, kwargs = mock_client.beta.messages.create.call_args
        self.assertIn("mcp-client-2025-11-20", kwargs["betas"])
        self.assertEqual(kwargs["mcp_servers"][0]["url"], "https://mcp.notion.com/mcp")
        self.assertEqual(kwargs["mcp_servers"][0]["authorization_token"], "test-notion-token")
        self.assertIn("test-parent-page-id", kwargs["messages"][0]["content"])

    @patch("ai.notion_export.anthropic.Anthropic")
    def test_returns_error_when_sentinel_missing(self, mock_anthropic_cls):
        mock_client = MagicMock()
        mock_client.beta.messages.create.return_value = _make_response(
            "Something went wrong, I could not create the page."
        )
        mock_anthropic_cls.return_value = mock_client

        result = notion_export.save_message_to_notion("What is RAG?", "RAG is...")

        self.assertIn("error", result)

    @patch("ai.notion_export.anthropic.Anthropic")
    def test_returns_error_on_refusal(self, mock_anthropic_cls):
        mock_client = MagicMock()
        mock_client.beta.messages.create.return_value = _make_response(
            "", stop_reason="refusal"
        )
        mock_anthropic_cls.return_value = mock_client

        result = notion_export.save_message_to_notion("What is RAG?", "RAG is...")

        self.assertIn("error", result)

    def test_returns_error_when_notion_token_missing(self):
        with patch.dict(os.environ, {"NOTION_MCP_TOKEN": ""}):
            importlib.reload(notion_export)
            result = notion_export.save_message_to_notion("q", "c")
            self.assertIn("error", result)
        importlib.reload(notion_export)
