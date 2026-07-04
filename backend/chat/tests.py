import json
import os
import importlib
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.utils import timezone
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


from unittest.mock import patch as mock_patch


class SaveToNotionViewTests(TestCase):
    def setUp(self):
        self.session = ChatSession.objects.create(title="Test session")
        self.user_msg = Message.objects.create(
            session=self.session, role='user', content="What is RAG?"
        )
        self.assistant_msg = Message.objects.create(
            session=self.session, role='assistant', content="RAG is..."
        )

    def test_404_when_message_missing(self):
        response = self.client.post('/api/chat/messages/999999/save-to-notion/')
        self.assertEqual(response.status_code, 404)

    @mock_patch('chat.views.notion_export.save_message_to_notion')
    def test_saves_notion_url_on_success(self, mock_save):
        mock_save.return_value = {"notion_url": "https://notion.so/abc123"}

        response = self.client.post(
            f'/api/chat/messages/{self.assistant_msg.id}/save-to-notion/'
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"notion_url": "https://notion.so/abc123"})
        mock_save.assert_called_once_with("What is RAG?", "RAG is...")
        self.assistant_msg.refresh_from_db()
        self.assertEqual(self.assistant_msg.notion_url, "https://notion.so/abc123")

    @mock_patch('chat.views.notion_export.save_message_to_notion')
    def test_returns_502_on_notion_failure(self, mock_save):
        mock_save.return_value = {"error": "Notion export request failed: boom"}

        response = self.client.post(
            f'/api/chat/messages/{self.assistant_msg.id}/save-to-notion/'
        )

        self.assertEqual(response.status_code, 502)
        self.assistant_msg.refresh_from_db()
        self.assertIsNone(self.assistant_msg.notion_url)

    @mock_patch('chat.views.notion_export.save_message_to_notion')
    def test_uses_most_recent_preceding_user_message_in_same_session(self, mock_save):
        mock_save.return_value = {"notion_url": "https://notion.so/xyz789"}

        base_time = timezone.now() - timedelta(minutes=10)
        session = ChatSession.objects.create(title="Ordering test session")

        older_user_msg = Message.objects.create(
            session=session, role='user', content="What is RAG?"
        )
        Message.objects.filter(id=older_user_msg.id).update(timestamp=base_time)

        newer_user_msg = Message.objects.create(
            session=session, role='user', content="How does retrieval work?"
        )
        Message.objects.filter(id=newer_user_msg.id).update(
            timestamp=base_time + timedelta(minutes=1)
        )

        assistant_msg = Message.objects.create(
            session=session, role='assistant', content="Retrieval works by..."
        )
        Message.objects.filter(id=assistant_msg.id).update(
            timestamp=base_time + timedelta(minutes=2)
        )

        # A user message in a different session, timestamped between the two
        # in-session user messages, to prove the query is scoped by session.
        other_session = ChatSession.objects.create(title="Other session")
        other_user_msg = Message.objects.create(
            session=other_session, role='user', content="What is a transformer?"
        )
        Message.objects.filter(id=other_user_msg.id).update(
            timestamp=base_time + timedelta(minutes=1, seconds=30)
        )

        response = self.client.post(
            f'/api/chat/messages/{assistant_msg.id}/save-to-notion/'
        )

        self.assertEqual(response.status_code, 200)
        mock_save.assert_called_once_with(
            "How does retrieval work?", "Retrieval works by..."
        )
