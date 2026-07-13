from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient


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


class TokenRefreshTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='alice@example.com', email='alice@example.com', password='correct horse battery staple'
        )

    def _login(self):
        response = self.client.post(
            '/api/auth/login/',
            data={'email': 'alice@example.com', 'password': 'correct horse battery staple'},
            content_type='application/json',
        )
        self.client.cookies['refresh_token'] = response.cookies['refresh_token'].value
        return response

    def test_refresh_with_valid_cookie_returns_new_access_token(self):
        self._login()

        response = self.client.post('/api/auth/token/refresh/', content_type='application/json')

        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.json())
        self.assertIn('refresh_token', response.cookies)

    def test_refresh_rotates_the_cookie_and_invalidates_the_old_one(self):
        self._login()
        old_cookie_value = self.client.cookies['refresh_token'].value

        first = self.client.post('/api/auth/token/refresh/', content_type='application/json')
        self.client.cookies['refresh_token'] = old_cookie_value  # simulate reusing the old (now rotated-out) token

        second = self.client.post('/api/auth/token/refresh/', content_type='application/json')

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 401)

    def test_refresh_without_cookie_returns_401(self):
        response = self.client.post('/api/auth/token/refresh/', content_type='application/json')

        self.assertEqual(response.status_code, 401)


class LogoutTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='alice@example.com', email='alice@example.com', password='correct horse battery staple'
        )
        self.client = APIClient()
        login = self.client.post(
            '/api/auth/login/',
            data={'email': 'alice@example.com', 'password': 'correct horse battery staple'},
            format='json',
        )
        self.access_token = login.json()['access']
        self.client.cookies['refresh_token'] = login.cookies['refresh_token'].value

    def test_logout_blacklists_the_refresh_token(self):
        response = self.client.post(
            '/api/auth/logout/',
            HTTP_AUTHORIZATION=f'Bearer {self.access_token}',
        )
        self.assertEqual(response.status_code, 204)
        self.assertEqual(response.cookies['refresh_token'].value, '')

        refresh_attempt = self.client.post('/api/auth/token/refresh/')
        self.assertEqual(refresh_attempt.status_code, 401)

    def test_logout_requires_authentication(self):
        anonymous_client = APIClient()
        response = anonymous_client.post('/api/auth/logout/')
        self.assertEqual(response.status_code, 401)


class MeTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='alice@example.com', email='alice@example.com', password='correct horse battery staple'
        )
        self.client = APIClient()

    def test_me_returns_current_user(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get('/api/auth/me/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'id': self.user.id, 'email': 'alice@example.com'})

    def test_me_requires_authentication(self):
        response = self.client.get('/api/auth/me/')

        self.assertEqual(response.status_code, 401)
