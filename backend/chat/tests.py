import json
import os
import importlib
from datetime import timedelta
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


class SaveMessageToNotionTests(TestCase):
    def setUp(self):
        self.env_patcher = patch.dict(os.environ, {
            "NOTION_API_TOKEN": "test-notion-token",
            "NOTION_PARENT_PAGE_ID": "test-parent-page-id",
        })
        self.env_patcher.start()
        importlib.reload(notion_export)

    def tearDown(self):
        self.env_patcher.stop()
        importlib.reload(notion_export)

    @patch("ai.notion_export.requests.post")
    def test_returns_notion_url_on_success(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"url": "https://notion.so/abc123"}
        mock_post.return_value = mock_response

        result = notion_export.save_message_to_notion("What is RAG?", "RAG is...")

        self.assertEqual(result, {"notion_url": "https://notion.so/abc123"})
        _, kwargs = mock_post.call_args
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer test-notion-token")
        self.assertEqual(kwargs["headers"]["Notion-Version"], "2022-06-28")
        self.assertEqual(kwargs["json"]["parent"], {"page_id": "test-parent-page-id"})
        self.assertEqual(
            kwargs["json"]["properties"]["title"]["title"][0]["text"]["content"],
            "What is RAG?",
        )

    @patch("ai.notion_export.requests.post")
    def test_returns_error_on_non_2xx_status(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"
        mock_post.return_value = mock_response

        result = notion_export.save_message_to_notion("What is RAG?", "RAG is...")

        self.assertIn("error", result)

    @patch("ai.notion_export.requests.post")
    def test_returns_error_when_response_missing_url(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {}
        mock_post.return_value = mock_response

        result = notion_export.save_message_to_notion("What is RAG?", "RAG is...")

        self.assertIn("error", result)

    @patch("ai.notion_export.requests.post")
    def test_returns_error_on_request_exception(self, mock_post):
        import requests
        mock_post.side_effect = requests.ConnectionError("boom")

        result = notion_export.save_message_to_notion("What is RAG?", "RAG is...")

        self.assertIn("error", result)

    def test_returns_error_when_notion_token_missing(self):
        with patch.dict(os.environ, {"NOTION_API_TOKEN": ""}):
            importlib.reload(notion_export)
            result = notion_export.save_message_to_notion("q", "c")
            self.assertIn("error", result)
        importlib.reload(notion_export)

    def test_returns_error_when_parent_page_id_missing(self):
        with patch.dict(os.environ, {"NOTION_PARENT_PAGE_ID": ""}):
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

        # A non-user message in the *same* session, timestamped between the
        # newer in-session user message and the assistant message being
        # saved, to prove the `role='user'` filter is actually applied: if
        # it were dropped, this message would outrank newer_user_msg under
        # `-timestamp` ordering and get selected instead.
        non_user_msg = Message.objects.create(
            session=session, role='assistant', content="(interjection)"
        )
        Message.objects.filter(id=non_user_msg.id).update(
            timestamp=base_time + timedelta(minutes=1, seconds=45)
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

        # A later user message in the *same* session, timestamped after the
        # assistant message, to prove messages after it are excluded (i.e.
        # that the `timestamp__lt` filter is actually applied).
        later_user_msg = Message.objects.create(
            session=session, role='user', content="What about generation?"
        )
        Message.objects.filter(id=later_user_msg.id).update(
            timestamp=base_time + timedelta(minutes=3)
        )

        response = self.client.post(
            f'/api/chat/messages/{assistant_msg.id}/save-to-notion/'
        )

        self.assertEqual(response.status_code, 200)
        mock_save.assert_called_once_with(
            "How does retrieval work?", "Retrieval works by..."
        )
