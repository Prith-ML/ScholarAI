import json
from django.test import TestCase
from chat.models import ChatSession, Message


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
