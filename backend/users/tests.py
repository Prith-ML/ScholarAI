from django.contrib.auth.models import User
from django.test import TestCase


class SignupTests(TestCase):
    def test_signup_creates_user_and_returns_tokens(self):
        response = self.client.post(
            '/api/auth/signup/',
            data={'email': 'alice@example.com', 'password': 'correct horse battery staple'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertIn('access', data)
        self.assertEqual(data['user']['email'], 'alice@example.com')

        user = User.objects.get(email='alice@example.com')
        self.assertEqual(user.username, 'alice@example.com')
        self.assertTrue(user.check_password('correct horse battery staple'))

        self.assertIn('refresh_token', response.cookies)
        cookie = response.cookies['refresh_token']
        self.assertTrue(cookie['httponly'])

    def test_signup_rejects_duplicate_email(self):
        User.objects.create_user(username='alice@example.com', email='alice@example.com', password='x')

        response = self.client.post(
            '/api/auth/signup/',
            data={'email': 'alice@example.com', 'password': 'correct horse battery staple'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.json())

    def test_signup_rejects_weak_password(self):
        response = self.client.post(
            '/api/auth/signup/',
            data={'email': 'bob@example.com', 'password': '123'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.json())


class LoginTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='alice@example.com', email='alice@example.com', password='correct horse battery staple'
        )

    def test_login_with_correct_credentials_returns_tokens(self):
        response = self.client.post(
            '/api/auth/login/',
            data={'email': 'alice@example.com', 'password': 'correct horse battery staple'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('access', data)
        self.assertEqual(data['user']['email'], 'alice@example.com')
        self.assertIn('refresh_token', response.cookies)

    def test_login_with_wrong_password_returns_401(self):
        response = self.client.post(
            '/api/auth/login/',
            data={'email': 'alice@example.com', 'password': 'wrong password'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 401)
        self.assertNotIn('refresh_token', response.cookies)

    def test_login_with_unknown_email_returns_401(self):
        response = self.client.post(
            '/api/auth/login/',
            data={'email': 'nobody@example.com', 'password': 'whatever'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 401)
