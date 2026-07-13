# Authentication & Per-User Data Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sign-up, sign-in, sign-out, and persistent login to ScholarAI, and make every chat session, message, source, and dashboard stat strictly scoped to `request.user`.

**Architecture:** Django REST Framework + `djangorestframework-simplejwt` issue a short-lived access token (returned in the JSON body, held in memory on the frontend) and a long-lived refresh token (set as an httpOnly cookie). A Next.js Zustand store hydrates auth state on load via a silent refresh call, an `api.ts` fetch wrapper attaches the access token and retries once on 401, and `middleware.ts` gates `/chat` and `/research` at the edge. Every chat/research/dashboard Django view is rewritten to filter by `request.user` and 404 on cross-user access.

**Tech Stack:** Django 5.2, DRF, `djangorestframework-simplejwt`, Next.js 14 App Router, Zustand (already a dependency, unused so far), TypeScript.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-13-authentication-design.md` — read it if anything below is ambiguous.
- Keep `django.contrib.auth.models.User` — no custom user model. `username` is set equal to `email` on signup.
- Access token: 15 min lifetime, kept in memory only on the frontend (never `localStorage`).
- Refresh token: 7 day lifetime, httpOnly cookie named `refresh_token`, path `/api/auth/`, `Secure`/`SameSite=None` in production (`DEBUG=False`), `Secure=False`/`SameSite=Lax` in local dev.
- Every non-public API view requires `IsAuthenticated` and scopes its queries to `request.user`. Cross-user access returns `404`, never `403`.
- `health_check` stays public. Nothing else is exempted.
- Backend working directory for all `python manage.py` / `pytest` commands below: `backend/` (relative to repo root `ScholarAI/`).
- Frontend working directory for all `npm` commands: `frontend/`.

---

### Task 1: Add SimpleJWT dependency and Django settings

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/core/settings.py`

**Interfaces:**
- Produces: `settings.AUTH_COOKIE_NAME` (`str`), `settings.AUTH_COOKIE_PATH` (`str`), `settings.AUTH_COOKIE_SECURE` (`bool`), `settings.AUTH_COOKIE_SAMESITE` (`str`), `settings.SIMPLE_JWT` (`dict`, has key `'REFRESH_TOKEN_LIFETIME'` as a `timedelta`) — later tasks read these.

- [ ] **Step 1: Add the dependency**

Append to `backend/requirements.txt`:
```
djangorestframework-simplejwt==5.3.1
```

- [ ] **Step 2: Install it**

Run: `pip install djangorestframework-simplejwt==5.3.1`
Expected: `Successfully installed djangorestframework-simplejwt-5.3.1` (plus `pyjwt` if not already present)

- [ ] **Step 3: Register the blacklist app**

In `backend/core/settings.py`, change the `INSTALLED_APPS` list (currently ends with the three local apps):
```python
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party apps
    'rest_framework',
    'corsheaders',
    'channels',
    'rest_framework_simplejwt.token_blacklist',
    
    # Local apps
    'users',
    'chat',
    'research',
]
```

- [ ] **Step 4: Add JWT to the authentication classes and configure SIMPLE_JWT + cookie settings**

In `backend/core/settings.py`, replace the `REST_FRAMEWORK` block:
```python
# REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.BasicAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}
```

Then add this block right after it (still in `backend/core/settings.py`):
```python
# JWT auth settings
from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# The refresh token is never readable by JS - it only ever travels as an
# httpOnly cookie scoped to the auth endpoints. Secure/SameSite=None is
# required for the cross-domain Vercel/Railway production deployment;
# relaxed to Lax/non-Secure locally since plain http://localhost can't set
# Secure cookies and doesn't need SameSite=None (frontend and backend are
# same-site to each other on localhost regardless of port).
AUTH_COOKIE_NAME = 'refresh_token'
AUTH_COOKIE_PATH = '/api/auth/'
AUTH_COOKIE_SECURE = not DEBUG
AUTH_COOKIE_SAMESITE = 'None' if not DEBUG else 'Lax'
```

- [ ] **Step 5: Run migrations for the new blacklist app**

Run: `python manage.py migrate`
Expected: output includes `Applying token_blacklist.0001_initial... OK` (and several more `token_blacklist.000x_...` migrations)

- [ ] **Step 6: Verify Django still boots clean**

Run: `python manage.py check`
Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 7: Commit**

```bash
git add backend/requirements.txt backend/core/settings.py
git commit -m "Add SimpleJWT dependency and JWT/cookie settings"
```

---

### Task 2: Signup endpoint

**Files:**
- Create: `backend/users/serializers.py`
- Modify: `backend/users/views.py`
- Create: `backend/users/urls.py`
- Modify: `backend/core/urls.py`
- Modify: `backend/users/tests.py`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `users.serializers.SignupSerializer` (fields `email`, `password`), `users.serializers.UserSerializer` (fields `id`, `email`), `users.views._issue_tokens_response(user, status_code)` — helper other auth views in Tasks 3-5 also use, `users.views.signup` — `POST /api/auth/signup/`.

- [ ] **Step 1: Write the failing test**

Replace the contents of `backend/users/tests.py` (currently just the default stub) with:
```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python manage.py test users`
Expected: `FAIL` / `ERROR` — `/api/auth/signup/` doesn't exist yet (404s, or `NoReverseMatch`/connection-style failure from the test client getting a 404 response instead of 201)

- [ ] **Step 3: Write the serializers**

Create `backend/users/serializers.py`:
```python
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers


class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data['email'],
            email=validated_data['email'],
            password=validated_data['password'],
        )


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email']
```

- [ ] **Step 4: Write the view**

Replace the contents of `backend/users/views.py` (currently just the default stub) with:
```python
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import SignupSerializer, UserSerializer


def _issue_tokens_response(user, status_code):
    """Build the {access, user} body + set the httpOnly refresh cookie. Shared by signup and login (Task 3)."""
    refresh = RefreshToken.for_user(user)
    response = Response(
        {'access': str(refresh.access_token), 'user': UserSerializer(user).data},
        status=status_code,
    )
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=str(refresh),
        max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        path=settings.AUTH_COOKIE_PATH,
    )
    return response


@api_view(['POST'])
@permission_classes([])
def signup(request):
    serializer = SignupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return _issue_tokens_response(user, status.HTTP_201_CREATED)
```

- [ ] **Step 5: Wire the URL**

Create `backend/users/urls.py`:
```python
from django.urls import path
from . import views

urlpatterns = [
    path('signup/', views.signup, name='signup'),
]
```

Modify `backend/core/urls.py` — replace:
```python
urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/chat/', include('chat.urls')),
    path('api/health/', chat_views.health_check, name='health_check'),
]
```
with:
```python
urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/chat/', include('chat.urls')),
    path('api/auth/', include('users.urls')),
    path('api/health/', chat_views.health_check, name='health_check'),
]
```

- [ ] **Step 6: Run test to verify it passes**

Run: `python manage.py test users`
Expected: `Ran 3 tests in ...s` / `OK`

- [ ] **Step 7: Commit**

```bash
git add backend/users backend/core/urls.py
git commit -m "Add signup endpoint with JWT + httpOnly refresh cookie"
```

---

### Task 3: Login endpoint

**Files:**
- Modify: `backend/users/views.py`
- Modify: `backend/users/urls.py`
- Modify: `backend/users/tests.py`

**Interfaces:**
- Consumes: `_issue_tokens_response` from Task 2, `UserSerializer` from Task 2.
- Produces: `users.views.login` — `POST /api/auth/login/`.

- [ ] **Step 1: Write the failing test**

Append to `backend/users/tests.py`:
```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python manage.py test users.tests.LoginTests`
Expected: `FAIL` — `/api/auth/login/` doesn't exist yet

- [ ] **Step 3: Write the view**

In `backend/users/views.py`, add the import and view:
```python
from django.contrib.auth import authenticate
```
(add alongside the existing imports at the top)

Then append:
```python
@api_view(['POST'])
@permission_classes([])
def login(request):
    email = request.data.get('email', '')
    password = request.data.get('password', '')
    user = authenticate(request, username=email, password=password)
    if user is None:
        return Response({'error': 'Invalid email or password'}, status=status.HTTP_401_UNAUTHORIZED)
    return _issue_tokens_response(user, status.HTTP_200_OK)
```

- [ ] **Step 4: Wire the URL**

In `backend/users/urls.py`, add the route:
```python
from django.urls import path
from . import views

urlpatterns = [
    path('signup/', views.signup, name='signup'),
    path('login/', views.login, name='login'),
]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python manage.py test users`
Expected: `Ran 6 tests in ...s` / `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/users
git commit -m "Add login endpoint"
```

---

### Task 4: Cookie-based token refresh endpoint

**Files:**
- Modify: `backend/users/views.py`
- Modify: `backend/users/urls.py`
- Modify: `backend/users/tests.py`

**Interfaces:**
- Consumes: `settings.AUTH_COOKIE_NAME`/`AUTH_COOKIE_PATH`/`AUTH_COOKIE_SECURE`/`AUTH_COOKIE_SAMESITE` from Task 1.
- Produces: `users.views.token_refresh` — `POST /api/auth/token/refresh/`, reads `request.COOKIES[settings.AUTH_COOKIE_NAME]`, returns `{'access': str}` and rotates the cookie.

- [ ] **Step 1: Write the failing test**

Append to `backend/users/tests.py`:
```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python manage.py test users.tests.TokenRefreshTests`
Expected: `FAIL` — `/api/auth/token/refresh/` doesn't exist yet

- [ ] **Step 3: Write the view**

In `backend/users/views.py`, add imports:
```python
from django.contrib.auth.models import User
from rest_framework_simplejwt.exceptions import TokenError
```
(add alongside the existing imports at the top)

Then append:
```python
@api_view(['POST'])
@permission_classes([])
def token_refresh(request):
    raw_token = request.COOKIES.get(settings.AUTH_COOKIE_NAME)
    if not raw_token:
        return Response({'error': 'No refresh token'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        refresh = RefreshToken(raw_token)
        access = refresh.access_token
        user = User.objects.get(id=refresh['user_id'])
        refresh.blacklist()
    except (TokenError, User.DoesNotExist):
        return Response({'error': 'Invalid or expired refresh token'}, status=status.HTTP_401_UNAUTHORIZED)

    new_refresh = RefreshToken.for_user(user)
    response = Response({'access': str(access)}, status=status.HTTP_200_OK)
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=str(new_refresh),
        max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        path=settings.AUTH_COOKIE_PATH,
    )
    return response
```

- [ ] **Step 4: Wire the URL**

In `backend/users/urls.py`:
```python
from django.urls import path
from . import views

urlpatterns = [
    path('signup/', views.signup, name='signup'),
    path('login/', views.login, name='login'),
    path('token/refresh/', views.token_refresh, name='token_refresh'),
]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python manage.py test users`
Expected: `Ran 9 tests in ...s` / `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/users
git commit -m "Add cookie-based token refresh endpoint with rotation"
```

---

### Task 5: Logout and me endpoints

**Files:**
- Modify: `backend/users/views.py`
- Modify: `backend/users/urls.py`
- Modify: `backend/users/tests.py`

**Interfaces:**
- Produces: `users.views.logout` — `POST /api/auth/logout/` (requires auth), `users.views.me` — `GET /api/auth/me/` (requires auth, returns `UserSerializer` data).

- [ ] **Step 1: Write the failing tests**

Append to `backend/users/tests.py`:
```python
from rest_framework.test import APIClient


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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python manage.py test users.tests.LogoutTests users.tests.MeTests`
Expected: `FAIL` — `/api/auth/logout/` and `/api/auth/me/` don't exist yet

- [ ] **Step 3: Write the views**

In `backend/users/views.py`, add the import:
```python
from rest_framework.permissions import IsAuthenticated
```
(add alongside the existing imports at the top)

Then append:
```python
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    raw_token = request.COOKIES.get(settings.AUTH_COOKIE_NAME)
    if raw_token:
        try:
            RefreshToken(raw_token).blacklist()
        except TokenError:
            pass
    response = Response(status=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(settings.AUTH_COOKIE_NAME, path=settings.AUTH_COOKIE_PATH)
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(UserSerializer(request.user).data)
```

- [ ] **Step 4: Wire the URLs**

In `backend/users/urls.py`:
```python
from django.urls import path
from . import views

urlpatterns = [
    path('signup/', views.signup, name='signup'),
    path('login/', views.login, name='login'),
    path('token/refresh/', views.token_refresh, name='token_refresh'),
    path('logout/', views.logout, name='logout'),
    path('me/', views.me, name='me'),
]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python manage.py test users`
Expected: `Ran 13 tests in ...s` / `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/users
git commit -m "Add logout and me endpoints"
```

---

### Task 6: Require `user` on ChatSession and ResearchStats

**Files:**
- Modify: `backend/chat/models.py`
- Create: `backend/chat/migrations/0006_delete_anonymous_rows.py`
- Create: `backend/chat/migrations/0007_require_user.py`
- Modify: `backend/chat/tests.py`

**Interfaces:**
- Produces: `ChatSession.user` and `ResearchStats.user` are non-nullable — Task 7's rewritten views and tests can now assume every row has an owner.

- [ ] **Step 1: Write the failing test**

Append to `backend/chat/tests.py` (add `from django.db import IntegrityError` to the existing imports at the top, and `from django.contrib.auth.models import User`):
```python
class UserFieldRequiredTests(TestCase):
    def test_chat_session_requires_user(self):
        with self.assertRaises(IntegrityError):
            ChatSession.objects.create(title='No owner')

    def test_research_stats_requires_user(self):
        with self.assertRaises(IntegrityError):
            ResearchStats.objects.create()
```
Also add `ResearchStats` to the existing `from chat.models import ChatSession, Message` import line, making it:
```python
from chat.models import ChatSession, Message, ResearchStats
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python manage.py test chat.tests.UserFieldRequiredTests`
Expected: `FAIL` — both currently succeed (no `IntegrityError` raised) since `user` is still nullable

- [ ] **Step 3: Update the models**

In `backend/chat/models.py`, change both occurrences of:
```python
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
```
to:
```python
    user = models.ForeignKey(User, on_delete=models.CASCADE)
```
(one occurrence is on `ChatSession`, the other on `ResearchStats` — change both)

- [ ] **Step 4: Write the data migration deleting legacy anonymous rows**

Create `backend/chat/migrations/0006_delete_anonymous_rows.py`:
```python
from django.db import migrations


def delete_anonymous_rows(apps, schema_editor):
    ChatSession = apps.get_model('chat', 'ChatSession')
    ResearchStats = apps.get_model('chat', 'ResearchStats')
    ChatSession.objects.filter(user__isnull=True).delete()
    ResearchStats.objects.filter(user__isnull=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0005_message_notion_url'),
    ]

    operations = [
        migrations.RunPython(delete_anonymous_rows, migrations.RunPython.noop),
    ]
```

- [ ] **Step 5: Write the schema migration making the field required**

Run: `python manage.py makemigrations chat --name require_user`
Expected: creates `backend/chat/migrations/0007_require_user.py` with two `AlterField` operations (one for `ChatSession.user`, one for `ResearchStats.user`), each dropping `null=True, blank=True`

- [ ] **Step 6: Apply migrations**

Run: `python manage.py migrate chat`
Expected: `Applying chat.0006_delete_anonymous_rows... OK` then `Applying chat.0007_require_user... OK`

- [ ] **Step 7: Run test to verify it passes**

Run: `python manage.py test chat.tests.UserFieldRequiredTests`
Expected: `Ran 2 tests in ...s` / `OK`

- [ ] **Step 8: Commit**

```bash
git add backend/chat/models.py backend/chat/migrations backend/chat/tests.py
git commit -m "Require user on ChatSession and ResearchStats, drop legacy anonymous rows"
```

---

### Task 7: Scope every chat/dashboard view to request.user

**Files:**
- Modify: `backend/chat/views.py`
- Modify: `backend/chat/tests.py`

**Interfaces:**
- Consumes: `ChatSession.user`/`ResearchStats.user` now required (Task 6).
- Produces: every view in `chat/views.py` except `health_check` requires `IsAuthenticated` and filters by `request.user`.

- [ ] **Step 1: Update existing tests to authenticate, and add cross-user isolation tests**

In `backend/chat/tests.py`, add `from rest_framework.test import APIClient` to the imports at the top.

Replace the `SendMessageResponseTests` class with:
```python
class SendMessageResponseTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='alice@example.com', email='alice@example.com', password='pw12345'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

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
        self.assertEqual(assistant_message.session.user, self.user)

    def test_requires_authentication(self):
        anonymous_client = APIClient()

        response = anonymous_client.post(
            '/api/chat/send/',
            data=json.dumps({'message': 'Hello'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 401)

    def test_cannot_send_into_another_users_session(self):
        other_user = User.objects.create_user(username='bob@example.com', email='bob@example.com', password='pw12345')
        other_session = ChatSession.objects.create(title='Bob session', user=other_user)

        response = self.client.post(
            '/api/chat/send/',
            data=json.dumps({'message': 'Hello', 'session_id': str(other_session.id)}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 404)
```

Replace the `SaveToNotionViewTests` class's `setUp` and the two ownership-relevant tests — change:
```python
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
```
to:
```python
class SaveToNotionViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='alice@example.com', email='alice@example.com', password='pw12345'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.session = ChatSession.objects.create(title="Test session", user=self.user)
        self.user_msg = Message.objects.create(
            session=self.session, role='user', content="What is RAG?"
        )
        self.assistant_msg = Message.objects.create(
            session=self.session, role='assistant', content="RAG is..."
        )

    def test_404_when_message_missing(self):
        response = self.client.post('/api/chat/messages/999999/save-to-notion/')
        self.assertEqual(response.status_code, 404)

    def test_404_when_message_belongs_to_another_user(self):
        other_user = User.objects.create_user(username='bob@example.com', email='bob@example.com', password='pw12345')
        other_session = ChatSession.objects.create(title='Bob session', user=other_user)
        other_msg = Message.objects.create(session=other_session, role='assistant', content='Not yours')

        response = self.client.post(f'/api/chat/messages/{other_msg.id}/save-to-notion/')

        self.assertEqual(response.status_code, 404)

    def test_requires_authentication(self):
        anonymous_client = APIClient()

        response = anonymous_client.post(f'/api/chat/messages/{self.assistant_msg.id}/save-to-notion/')

        self.assertEqual(response.status_code, 401)
```
The other three test methods already in `SaveToNotionViewTests` (`test_saves_notion_url_on_success`, `test_returns_502_on_notion_failure`, `test_uses_most_recent_preceding_user_message_in_same_session`) are unchanged — they'll now run authenticated as `self.user` thanks to the new `setUp`.

Also add this new class at the end of the file:
```python
class DashboardIsolationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='alice@example.com', email='alice@example.com', password='pw12345')
        self.other_user = User.objects.create_user(username='bob@example.com', email='bob@example.com', password='pw12345')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.my_session = ChatSession.objects.create(title='Mine', user=self.user)
        Message.objects.create(session=self.my_session, role='user', content='hi')
        self.other_session = ChatSession.objects.create(title='Not mine', user=self.other_user)
        Message.objects.create(session=self.other_session, role='user', content='hi')

    def test_recent_sessions_only_shows_own_sessions(self):
        response = self.client.get('/api/chat/dashboard/sessions/')

        self.assertEqual(response.status_code, 200)
        titles = [s['title'] for s in response.json()['sessions']]
        self.assertIn('Mine', titles)
        self.assertNotIn('Not mine', titles)

    def test_dashboard_stats_only_counts_own_sessions(self):
        response = self.client.get('/api/chat/dashboard/stats/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['research_sessions'], 1)

    def test_cannot_delete_another_users_session_from_dashboard(self):
        response = self.client.delete(f'/api/chat/dashboard/sessions/{self.other_session.id}/delete/')

        self.assertEqual(response.status_code, 404)
        self.assertTrue(ChatSession.objects.filter(id=self.other_session.id).exists())

    def test_dashboard_endpoints_require_authentication(self):
        anonymous_client = APIClient()

        for response in (
            anonymous_client.get('/api/chat/dashboard/stats/'),
            anonymous_client.get('/api/chat/dashboard/sessions/'),
            anonymous_client.get('/api/chat/dashboard/insights/'),
        ):
            self.assertEqual(response.status_code, 401)
```

- [ ] **Step 2: Run tests to verify the new/modified ones fail**

Run: `python manage.py test chat`
Expected: `FAIL` on the new isolation/auth-required assertions and on `SendMessageResponseTests`/`SaveToNotionViewTests` setup (views don't require auth or filter by user yet)

- [ ] **Step 3: Rewrite the views**

In `backend/chat/views.py`, change the imports at the top — replace:
```python
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import ChatSession, Message, Source, ResearchStats
from .serializers import ChatSessionSerializer, ChatMessageSerializer, MessageSerializer
import sys
import os
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from datetime import timedelta
import json
import uuid
from ai.django_agent_runner import chat as ai_chat
from ai import notion_export
```
with:
```python
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import ChatSession, Message, Source, ResearchStats
from .serializers import ChatSessionSerializer, ChatMessageSerializer, MessageSerializer
import sys
import os
from django.shortcuts import render
from django.http import JsonResponse
from django.utils import timezone
from datetime import timedelta
import json
import uuid
from ai.django_agent_runner import chat as ai_chat
from ai import notion_export
```
(this drops the now-unused `csrf_exempt`/`require_http_methods` imports — every view below becomes a DRF `@api_view`, which doesn't need either)

Replace `send_message` entirely — from:
```python
@csrf_exempt
@require_http_methods(["POST"])
def send_message(request):
    """Send a message and get AI response"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.info("=== Starting send_message function ===")
        logger.info(f"Request body: {request.body}")
        
        data = json.loads(request.body)
        message_text = data.get('message', '').strip()
        session_id = data.get('session_id')
        
        logger.info(f"Message text: {message_text}")
        logger.info(f"Session ID: {session_id}")
        
        if not message_text:
            logger.error("Message is empty")
            return JsonResponse({'error': 'Message is required'}, status=400)
        
        # Get or create session
        logger.info("Starting session creation/retrieval...")
        if session_id:
            try:
                logger.info(f"Looking for existing session: {session_id}")
                session = ChatSession.objects.get(id=session_id)
                logger.info(f"Found existing session: {session.id}")
            except ChatSession.DoesNotExist:
                logger.warning(f"Session {session_id} not found, creating new session")
                session = None
        else:
            # Create new session with title from first message
            logger.info("Creating new session...")
            title = message_text[:50] + "..." if len(message_text) > 50 else message_text
            logger.info(f"Session title will be: {title}")
            try:
                session = ChatSession.objects.create(title=title)
                logger.info(f"Created new session: {session.id} with title: {title}")
            except Exception as e:
                logger.error(f"Error creating session: {str(e)}")
                logger.error(f"Error type: {type(e).__name__}")
                import traceback
                logger.error(f"Session creation traceback: {traceback.format_exc()}")
                return JsonResponse({'error': 'Session creation failed', 'details': str(e)}, status=500)
        
        # Save user message
        logger.info("Starting user message creation...")
        try:
            user_message = Message.objects.create(
                session=session,
                role='user',
                content=message_text
            )
            logger.info(f"Saved user message: {user_message.id}")
        except Exception as e:
            logger.error(f"Error creating user message: {str(e)}")
            logger.error(f"Error type: {type(e).__name__}")
            import traceback
            logger.error(f"User message creation traceback: {traceback.format_exc()}")
            return JsonResponse({'error': 'Message creation failed', 'details': str(e)}, status=500)
        
        # Get AI response
        logger.info("Calling AI chat function...")
        try:
            ai_response = ai_chat(message_text, str(session.id))
            logger.info("AI chat function completed successfully")
            logger.info(f"AI response keys: {list(ai_response.keys()) if isinstance(ai_response, dict) else 'Not a dict'}")
        except Exception as e:
            logger.error(f"AI chat error: {str(e)}")
            logger.error(f"Error type: {type(e).__name__}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return JsonResponse({
                'error': 'AI service error',
                'details': str(e)
            }, status=500)
        
        # Save AI message
        assistant_message = Message.objects.create(
            session=session,
            role='assistant',
            content=ai_response['response']
        )
        
        # Save sources if provided
        if ai_response.get('sources'):
            for source_data in ai_response['sources']:
                Source.objects.create(
                    message=assistant_message,
                    title=source_data.get('title', ''),
                    url=source_data.get('url', ''),
                    snippet=source_data.get('snippet', ''),
                    source_type=source_data.get('source_type', 'web'),
                    relevance_score=source_data.get('relevance_score', 0.0)
                )
        
        # Update session topics based on message content
        update_session_topics(session, message_text)
        
        # Update research stats
        stats = ResearchStats.get_or_create_stats()
        stats.update_stats()
        
        return JsonResponse({
            'message': ai_response['response'],
            'sources': ai_response.get('sources', []),
            'session_id': str(session.id),
            'message_id': assistant_message.id
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
```
to:
```python
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_message(request):
    """Send a message and get AI response"""
    import logging
    logger = logging.getLogger(__name__)

    try:
        message_text = (request.data.get('message') or '').strip()
        session_id = request.data.get('session_id')

        if not message_text:
            return Response({'error': 'Message is required'}, status=400)

        if session_id:
            session = get_object_or_404(ChatSession, id=session_id, user=request.user)
        else:
            title = message_text[:50] + "..." if len(message_text) > 50 else message_text
            session = ChatSession.objects.create(title=title, user=request.user)

        Message.objects.create(session=session, role='user', content=message_text)

        try:
            ai_response = ai_chat(message_text, str(session.id))
        except Exception as e:
            logger.error(f"AI chat error: {str(e)}")
            return Response({'error': 'AI service error', 'details': str(e)}, status=500)

        assistant_message = Message.objects.create(
            session=session,
            role='assistant',
            content=ai_response['response']
        )

        if ai_response.get('sources'):
            for source_data in ai_response['sources']:
                Source.objects.create(
                    message=assistant_message,
                    title=source_data.get('title', ''),
                    url=source_data.get('url', ''),
                    snippet=source_data.get('snippet', ''),
                    source_type=source_data.get('source_type', 'web'),
                    relevance_score=source_data.get('relevance_score', 0.0)
                )

        update_session_topics(session, message_text)

        stats = ResearchStats.get_or_create_stats(user=request.user)
        stats.update_stats()

        return Response({
            'message': ai_response['response'],
            'sources': ai_response.get('sources', []),
            'session_id': str(session.id),
            'message_id': assistant_message.id
        })

    except Exception as e:
        return Response({'error': str(e)}, status=500)
```

Replace `save_to_notion` — from:
```python
@csrf_exempt
@require_http_methods(["POST"])
def save_to_notion(request, message_id):
    """Save an assistant message to Notion via the MCP connector."""
    try:
        message = Message.objects.get(id=message_id, role='assistant')
    except Message.DoesNotExist:
        return JsonResponse({'error': 'Message not found'}, status=404)
```
to:
```python
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_to_notion(request, message_id):
    """Save an assistant message to Notion via the MCP connector."""
    message = get_object_or_404(Message, id=message_id, role='assistant', session__user=request.user)
```
(the rest of the function body is unchanged — leave `if message.notion_url: ...` through the end exactly as-is, just note it now returns `JsonResponse` still, which is fine since it's independent of the `@api_view` decorator change)

Replace `delete_session`, `health_check`, `dashboard_stats`, `recent_sessions`, and `delete_session_dashboard`, and `ai_insights` — from:
```python
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_session(request, session_id):
    """Delete a chat session"""
    session = get_object_or_404(ChatSession, id=session_id, user=request.user)
    session.delete()
    return Response({'message': 'Session deleted successfully'})

@api_view(['GET'])
@permission_classes([])  # No authentication required
def health_check(request):
    """Health check endpoint"""
    return Response({'status': 'healthy', 'message': 'Backend is running'})

@require_http_methods(["GET"])
def dashboard_stats(request):
    """Get dashboard statistics"""
    try:
        stats = ResearchStats.get_or_create_stats()
        stats.update_stats()
        
        return JsonResponse({
            'research_sessions': stats.total_sessions,
            'messages_exchanged': stats.total_messages,
            'sources_cited': stats.total_sources,
            'research_hours': stats.total_research_hours,
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@require_http_methods(["GET"])
def recent_sessions(request):
    """Get recent research sessions"""
    try:
        sessions = ChatSession.objects.all().order_by('-updated_at')[:10]
        
        sessions_data = []
        for session in sessions:
            # Calculate time ago
            time_ago = get_time_ago(session.updated_at)
            
            sessions_data.append({
                'id': session.id,
                'title': session.title,
                'messages': session.get_message_count(),
                'lastActive': time_ago,
                'topics': session.topics or [],
                'status': session.status,

            })
        
        return JsonResponse({'sessions': sessions_data})
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
```
to:
```python
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_session(request, session_id):
    """Delete a chat session"""
    session = get_object_or_404(ChatSession, id=session_id, user=request.user)
    session.delete()
    return Response({'message': 'Session deleted successfully'})

@api_view(['GET'])
@permission_classes([])  # No authentication required
def health_check(request):
    """Health check endpoint"""
    return Response({'status': 'healthy', 'message': 'Backend is running'})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """Get dashboard statistics"""
    try:
        stats = ResearchStats.get_or_create_stats(user=request.user)
        stats.update_stats()

        return Response({
            'research_sessions': stats.total_sessions,
            'messages_exchanged': stats.total_messages,
            'sources_cited': stats.total_sources,
            'research_hours': stats.total_research_hours,
        })

    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def recent_sessions(request):
    """Get recent research sessions"""
    try:
        sessions = ChatSession.objects.filter(user=request.user).order_by('-updated_at')[:10]

        sessions_data = []
        for session in sessions:
            time_ago = get_time_ago(session.updated_at)

            sessions_data.append({
                'id': session.id,
                'title': session.title,
                'messages': session.get_message_count(),
                'lastActive': time_ago,
                'topics': session.topics or [],
                'status': session.status,

            })

        return Response({'sessions': sessions_data})

    except Exception as e:
        return Response({'error': str(e)}, status=500)
```

Replace `delete_session_dashboard` and `ai_insights` — from:
```python
@csrf_exempt
@require_http_methods(["DELETE"])
def delete_session_dashboard(request, session_id):
    """Delete a chat session from dashboard"""
    try:
        session = ChatSession.objects.get(id=session_id)
        session.delete()
        
        # Update research stats after deletion
        stats = ResearchStats.get_or_create_stats()
        stats.update_stats()
        
        return JsonResponse({'message': 'Session deleted successfully'})
        
    except ChatSession.DoesNotExist:
        return JsonResponse({'error': 'Session not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@require_http_methods(["GET"])
def ai_insights(request):
    """Get AI-generated insights based on user activity"""
    try:
        # Get recent activity
        recent_sessions = ChatSession.objects.all().order_by('-updated_at')[:5]
        recent_messages = Message.objects.all().order_by('-timestamp')[:20]
```
to:
```python
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_session_dashboard(request, session_id):
    """Delete a chat session from dashboard"""
    try:
        session = get_object_or_404(ChatSession, id=session_id, user=request.user)
        session.delete()

        stats = ResearchStats.get_or_create_stats(user=request.user)
        stats.update_stats()

        return Response({'message': 'Session deleted successfully'})

    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ai_insights(request):
    """Get AI-generated insights based on user activity"""
    try:
        recent_sessions = ChatSession.objects.filter(user=request.user).order_by('-updated_at')[:5]
        recent_messages = Message.objects.filter(session__user=request.user).order_by('-timestamp')[:20]
```
(leave the rest of `ai_insights`'s body — the topic-counting and insights-building logic below `recent_messages = ...` — exactly as-is; it already only reads from the two querysets just reassigned above)

Also change `ai_insights`'s final `return` — from:
```python
        return JsonResponse({'insights': insights})
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
```
to:
```python
        return Response({'insights': insights})

    except Exception as e:
        return Response({'error': str(e)}, status=500)
```

`get_object_or_404` on a `DELETE`/`get_object_or_404` miss raises `Http404`, which DRF's `@api_view` already converts to a `404` response automatically — no extra `try`/`except` needed for that path.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python manage.py test chat`
Expected: `Ran N tests in ...s` / `OK` (all pre-existing tests plus all new isolation/auth tests from Step 1)

- [ ] **Step 5: Run the full backend suite**

Run: `python manage.py test`
Expected: `OK` — confirms Task 6/7 didn't break `users` tests either

- [ ] **Step 6: Commit**

```bash
git add backend/chat/views.py backend/chat/tests.py
git commit -m "Scope every chat/dashboard view to request.user"
```

---

### Task 8: Frontend auth store

**Files:**
- Create: `frontend/src/store/authStore.ts`

**Interfaces:**
- Produces: `useAuthStore()` hook returning `{ user: {id: number, email: string} | null, accessToken: string | null, status: 'loading' | 'authenticated' | 'unauthenticated', signup(email, password): Promise<void>, login(email, password): Promise<void>, logout(): Promise<void>, hydrate(): Promise<void>, setAccessToken(token: string): void }`. Task 9's `api.ts` and Tasks 10-13's pages/components all consume this.

- [ ] **Step 1: Write the store**

Create `frontend/src/store/authStore.ts`:
```typescript
import { create } from "zustand"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

export interface AuthUser {
  id: number
  email: string
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated"

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  status: AuthStatus
  setAccessToken: (token: string) => void
  hydrate: () => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json()
    if (typeof data.error === "string") return data.error
    const firstField = Object.values(data)[0]
    if (Array.isArray(firstField) && typeof firstField[0] === "string") return firstField[0]
  } catch {
    // fall through to generic message
  }
  return "Something went wrong. Please try again."
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: "loading",

  setAccessToken: (token: string) => set({ accessToken: token }),

  hydrate: async () => {
    try {
      const refreshResponse = await fetch(`${API_BASE}/api/auth/token/refresh/`, {
        method: "POST",
        credentials: "include",
      })
      if (!refreshResponse.ok) {
        set({ user: null, accessToken: null, status: "unauthenticated" })
        return
      }
      const { access } = await refreshResponse.json()

      const meResponse = await fetch(`${API_BASE}/api/auth/me/`, {
        headers: { Authorization: `Bearer ${access}` },
        credentials: "include",
      })
      if (!meResponse.ok) {
        set({ user: null, accessToken: null, status: "unauthenticated" })
        return
      }
      const user = await meResponse.json()
      set({ user, accessToken: access, status: "authenticated" })
    } catch {
      set({ user: null, accessToken: null, status: "unauthenticated" })
    }
  },

  signup: async (email: string, password: string) => {
    const response = await fetch(`${API_BASE}/api/auth/signup/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    })
    if (!response.ok) throw new Error(await parseErrorMessage(response))
    const data = await response.json()
    set({ user: data.user, accessToken: data.access, status: "authenticated" })
  },

  login: async (email: string, password: string) => {
    const response = await fetch(`${API_BASE}/api/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    })
    if (!response.ok) throw new Error(await parseErrorMessage(response))
    const data = await response.json()
    set({ user: data.user, accessToken: data.access, status: "authenticated" })
  },

  logout: async () => {
    const { accessToken } = useAuthStore.getState()
    await fetch(`${API_BASE}/api/auth/logout/`, {
      method: "POST",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      credentials: "include",
    })
    set({ user: null, accessToken: null, status: "unauthenticated" })
  },
}))
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors referencing `authStore.ts`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/store/authStore.ts
git commit -m "Add Zustand auth store with silent-refresh hydration"
```

---

### Task 9: Frontend API client wrapper

**Files:**
- Create: `frontend/src/lib/api.ts`

**Interfaces:**
- Consumes: `useAuthStore` from Task 8.
- Produces: `apiFetch(path: string, init?: RequestInit): Promise<Response>` — Task 13 uses this in place of raw `fetch()`.

- [ ] **Step 1: Write the client**

Create `frontend/src/lib/api.ts`:
```typescript
import { useAuthStore } from "@/store/authStore"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

async function attemptRefresh(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/api/auth/token/refresh/`, {
      method: "POST",
      credentials: "include",
    })
    if (!response.ok) return null
    const { access } = await response.json()
    useAuthStore.getState().setAccessToken(access)
    return access
  } catch {
    return null
  }
}

/**
 * Drop-in replacement for fetch() against the Django API: attaches the
 * bearer token, always sends the refresh cookie, and retries once after a
 * silent token refresh on 401 before giving up.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = (token: string | null) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

  const { accessToken } = useAuthStore.getState()
  let response = await doFetch(accessToken)

  if (response.status === 401) {
    const refreshedToken = await attemptRefresh()
    if (refreshedToken) {
      response = await doFetch(refreshedToken)
    } else {
      useAuthStore.setState({ user: null, accessToken: null, status: "unauthenticated" })
    }
  }

  return response
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors referencing `api.ts`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "Add API client wrapper with bearer auth and refresh-and-retry"
```

---

### Task 10: Root layout hydration

**Files:**
- Create: `frontend/src/components/AuthHydrator.tsx`
- Modify: `frontend/src/app/layout.tsx`

**Interfaces:**
- Consumes: `useAuthStore` from Task 8.

`layout.tsx` stays a server component (so `export const metadata` keeps working) — the hydration side effect lives in a tiny client component rendered inside it instead of converting the whole layout to `"use client"`.

- [ ] **Step 1: Write the hydrator component**

Create `frontend/src/components/AuthHydrator.tsx`:
```tsx
"use client"

import { useEffect } from "react"
import { useAuthStore } from "@/store/authStore"

/** Fires the silent-refresh call once on app load so a returning user's session resumes without re-entering credentials. Renders nothing. */
export default function AuthHydrator() {
  const hydrate = useAuthStore((state) => state.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  return null
}
```

- [ ] **Step 2: Render it from the root layout**

In `frontend/src/app/layout.tsx`, add the import alongside the existing ones at the top:
```tsx
import AuthHydrator from "@/components/AuthHydrator"
```

Then change:
```tsx
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
          {children}
          <Toaster
```
to:
```tsx
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
          <AuthHydrator />
          {children}
          <Toaster
```

- [ ] **Step 3: Verify it compiles and runs**

Run: `npm run build`
Expected: build succeeds with no type errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AuthHydrator.tsx frontend/src/app/layout.tsx
git commit -m "Hydrate auth state on app load via silent refresh"
```

---

### Task 11: Sign-in and sign-up pages

**Files:**
- Create: `frontend/src/app/signin/page.tsx`
- Create: `frontend/src/app/signup/page.tsx`

**Interfaces:**
- Consumes: `useAuthStore` (`login`, `signup`) from Task 8.

- [ ] **Step 1: Write the sign-in page**

Create `frontend/src/app/signin/page.tsx`. `useSearchParams()` requires a `Suspense` boundary in Next 14 (the same pattern `chat/page.tsx` already uses for its `session_id` param), so the form lives in a `SignInForm` child and the default export just wraps it:
```tsx
"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuthStore } from "@/store/authStore"

function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const login = useAuthStore((state) => state.login)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await login(email, password)
      router.push(searchParams.get("next") || "/chat")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign in failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#05060a] px-4">
      <Card className="app-panel glow-border w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-white text-xl">Sign in to ScholarAI</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <p className="text-sm text-white/50 mt-4 text-center">
            No account?{" "}
            <Link href="/signup" className="text-white underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  )
}
```

- [ ] **Step 2: Write the sign-up page**

Create `frontend/src/app/signup/page.tsx`:
```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuthStore } from "@/store/authStore"

export default function SignUpPage() {
  const router = useRouter()
  const signup = useAuthStore((state) => state.signup)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await signup(email, password)
      router.push("/chat")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign up failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#05060a] px-4">
      <Card className="app-panel glow-border w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-white text-xl">Create your account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
            />
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Creating account..." : "Sign up"}
            </Button>
          </form>
          <p className="text-sm text-white/50 mt-4 text-center">
            Already have an account?{" "}
            <Link href="/signin" className="text-white underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Verify it compiles and manually check in the browser**

Run: `npm run dev`
Then visit `http://localhost:3000/signup`, create an account, confirm redirect to `/chat`. Visit `http://localhost:3000/signin` in a private window and sign back in.
Expected: both forms render with the app's dark-glass styling, submit without console errors, and redirect on success.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/signin frontend/src/app/signup
git commit -m "Add sign-in and sign-up pages"
```

---

### Task 12: Route protection middleware

**Files:**
- Create: `frontend/middleware.ts`
- Modify: `frontend/src/components/AppShell.tsx`

**Interfaces:**
- Consumes: `useAuthStore` from Task 8.

- [ ] **Step 1: Write the edge middleware**

Create `frontend/middleware.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server"

const PROTECTED_PATHS = ["/chat", "/research"]

export function middleware(request: NextRequest) {
  const isProtected = PROTECTED_PATHS.some((path) => request.nextUrl.pathname.startsWith(path))
  if (!isProtected) return NextResponse.next()

  const hasRefreshCookie = request.cookies.has("refresh_token")
  if (hasRefreshCookie) return NextResponse.next()

  const signInUrl = new URL("/signin", request.url)
  signInUrl.searchParams.set("next", request.nextUrl.pathname)
  return NextResponse.redirect(signInUrl)
}

export const config = {
  matcher: ["/chat/:path*", "/research/:path*"],
}
```
This only works when the frontend and backend share a top-level domain in production (the cookie is set with `path=/api/auth/` scoped to the *backend's* domain — see the note in Step 2 below for why the client-side guard is the one that actually enforces this cross-domain, and middleware is a same-domain fast path / defense-in-depth for local dev where both run on `localhost`).

- [ ] **Step 2: Add a client-side guard as the authoritative check**

In `frontend/src/components/AppShell.tsx`, replace the whole file:
```tsx
"use client"

import type React from "react"
import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import AppSidebar from "./AppSidebar"
import { useAuthStore } from "@/store/authStore"

const PROTECTED_PATHS = ["/chat", "/research"]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const status = useAuthStore((state) => state.status)

  useEffect(() => {
    const isProtected = PROTECTED_PATHS.some((path) => pathname?.startsWith(path))
    if (isProtected && status === "unauthenticated") {
      router.replace(`/signin?next=${encodeURIComponent(pathname || "/chat")}`)
    }
  }, [pathname, status, router])

  return (
    <div className="flex min-h-[100dvh] bg-[#05060a] relative">
      <div className="fixed inset-0 command-glow command-grid pointer-events-none" aria-hidden="true" />
      <AppSidebar />
      <div className="flex-1 min-w-0 relative z-10 flex flex-col">{children}</div>
    </div>
  )
}
```
This is the check that actually matters in production: the `refresh_token` cookie lives on the Railway backend's domain (set by `Set-Cookie` from API responses), not the Vercel frontend's domain, so Next.js middleware running on the frontend can never see it there. The middleware in Step 1 is a same-domain fast path for local dev; in production, this `status === 'unauthenticated'` check (driven by the failed silent-refresh call in Task 10) is what redirects logged-out users away from `/chat` and `/research`.

- [ ] **Step 3: Manually verify**

Run: `npm run dev`. With no account logged in, navigate directly to `http://localhost:3000/chat`.
Expected: redirected to `/signin?next=%2Fchat`. After signing in, navigating to `/chat` stays on `/chat`.

- [ ] **Step 4: Commit**

```bash
git add frontend/middleware.ts frontend/src/components/AppShell.tsx
git commit -m "Add route protection for /chat and /research"
```

---

### Task 13: Wire sign-out UI and replace raw fetch calls

**Files:**
- Modify: `frontend/src/components/AppSidebar.tsx`
- Modify: `frontend/src/app/chat/page.tsx`
- Modify: `frontend/src/app/research/page.tsx`
- Modify: `frontend/src/app/page.tsx`

**Interfaces:**
- Consumes: `useAuthStore` (Task 8), `apiFetch` (Task 9).

- [ ] **Step 1: Add a user menu to the sidebar footer**

In `frontend/src/components/AppSidebar.tsx`, add the import:
```tsx
import { useAuthStore } from "@/store/authStore"
```
(add alongside the existing imports at the top)

Replace the footer block — from:
```tsx
      <div className="px-5 py-5 border-t border-white/[0.06]">
        <div className="flex items-center gap-2 text-[11px] text-white/35">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Research engine online
        </div>
      </div>
```
to:
```tsx
      <div className="px-5 py-5 border-t border-white/[0.06]">
        <SidebarAccount />
      </div>
```

Add this component right above `function SidebarContent(...)`  in the same file:
```tsx
function SidebarAccount() {
  const { user, status, logout } = useAuthStore()

  if (status !== "authenticated" || !user) {
    return (
      <Link href="/signin" className="text-sm text-white/60 hover:text-white transition-colors">
        Sign in
      </Link>
    )
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-white/50 truncate">{user.email}</span>
      <button
        onClick={() => logout()}
        className="text-xs text-white/60 hover:text-white transition-colors shrink-0"
      >
        Sign out
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Replace raw fetch calls in the chat page**

In `frontend/src/app/chat/page.tsx`, add the import:
```tsx
import { apiFetch } from "@/lib/api"
```
(add alongside the existing imports at the top; the `const API_BASE = ...` line can stay for now, it's unused by the two calls below after this change but other code may still reference it indirectly — leave it in place)

Replace:
```tsx
      const response = await fetch(`${API_BASE}/api/chat/messages/${message.id}/save-to-notion/`, {
        method: "POST",
      })
```
with:
```tsx
      const response = await apiFetch(`/api/chat/messages/${message.id}/save-to-notion/`, {
        method: "POST",
      })
```

Replace:
```tsx
      const response = await fetch(`${API_BASE}/api/chat/send/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend, session_id: sessionId }),
      })
```
with:
```tsx
      const response = await apiFetch(`/api/chat/send/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend, session_id: sessionId }),
      })
```

- [ ] **Step 3: Replace raw fetch calls in the research (dashboard) page**

In `frontend/src/app/research/page.tsx`, add the import:
```tsx
import { apiFetch } from "@/lib/api"
```
(add alongside the existing imports at the top)

Replace:
```tsx
      const [statsResponse, sessionsResponse, insightsResponse] = await Promise.all([
        fetch(`${API_BASE}/api/chat/dashboard/stats/`),
        fetch(`${API_BASE}/api/chat/dashboard/sessions/`),
        fetch(`${API_BASE}/api/chat/dashboard/insights/`),
      ])
```
with:
```tsx
      const [statsResponse, sessionsResponse, insightsResponse] = await Promise.all([
        apiFetch(`/api/chat/dashboard/stats/`),
        apiFetch(`/api/chat/dashboard/sessions/`),
        apiFetch(`/api/chat/dashboard/insights/`),
      ])
```

`research/page.tsx` has one more raw call, in `deleteSession`. Replace:
```tsx
      const response = await fetch(`${API_BASE}/api/chat/dashboard/sessions/${sessionId}/delete/`, { method: "DELETE" })
```
with:
```tsx
      const response = await apiFetch(`/api/chat/dashboard/sessions/${sessionId}/delete/`, { method: "DELETE" })
```

- [ ] **Step 4: Add sign-in/sign-up CTAs to the landing page**

In `frontend/src/app/page.tsx`, add the import alongside the existing ones at the top:
```tsx
import { useAuthStore } from "@/store/authStore"
```

In the `HomePage` component, add the status selector next to the existing `reduceMotion` line — change:
```tsx
export default function HomePage() {
  const reduceMotion = useReducedMotion()
```
to:
```tsx
export default function HomePage() {
  const reduceMotion = useReducedMotion()
  const status = useAuthStore((state) => state.status)
```

Then add a conditional sign-in/sign-up line right after the existing hero CTA row — change:
```tsx
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/chat">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white font-semibold px-6 py-5 rounded-xl text-base shadow-lg shadow-indigo-500/25">
                    <MessageSquare className="mr-2 w-4 h-4" />
                    Start Researching
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </motion.div>
              </Link>
              <Link href="/research">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button className="app-glass text-white/80 hover:text-white hover:bg-white/10 font-semibold px-6 py-5 rounded-xl text-base">
                    <LayoutDashboard className="mr-2 w-4 h-4" />
                    View Dashboard
                  </Button>
```
to:
```tsx
            {status !== "authenticated" && (
              <p className="mb-4 text-sm text-white/50">
                <Link href="/signup" className="text-white underline">
                  Sign up
                </Link>{" "}
                or{" "}
                <Link href="/signin" className="text-white underline">
                  sign in
                </Link>{" "}
                to save your research sessions.
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/chat">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white font-semibold px-6 py-5 rounded-xl text-base shadow-lg shadow-indigo-500/25">
                    <MessageSquare className="mr-2 w-4 h-4" />
                    Start Researching
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </motion.div>
              </Link>
              <Link href="/research">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button className="app-glass text-white/80 hover:text-white hover:bg-white/10 font-semibold px-6 py-5 rounded-xl text-base">
                    <LayoutDashboard className="mr-2 w-4 h-4" />
                    View Dashboard
                  </Button>
```
(the line after this closing `</Link>` continues unchanged — this edit only inserts the new conditional block before the existing `<div className="flex flex-col sm:flex-row gap-3 justify-center">`)

- [ ] **Step 5: Manually verify end-to-end**

Run `npm run dev` (frontend) and `python manage.py runserver` (backend). Sign up, send a chat message, confirm it succeeds and appears under `/research` dashboard stats. Save a message to Notion (or confirm the expected error toast if Notion env vars aren't configured locally) to confirm the request carries the auth header. Sign out from the sidebar, confirm redirect/guard behavior on `/chat`.
Expected: no unauthenticated 401s in the browser console for any of these actions while logged in; guard redirects to `/signin` after sign-out + revisit.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/AppSidebar.tsx frontend/src/app/chat/page.tsx frontend/src/app/research/page.tsx frontend/src/app/page.tsx
git commit -m "Wire sign-out UI and route all chat/dashboard calls through apiFetch"
```

---

### Task 14: Full-stack manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend test suite**

Run: `python manage.py test`
Expected: `OK`, all tests pass including the new `users` and `chat` isolation tests

- [ ] **Step 2: Run the frontend build**

Run: `npm run build`
Expected: build succeeds with no type errors

- [ ] **Step 3: Two-user manual isolation check**

With both dev servers running, sign up as `usera@example.com` in one browser and `userb@example.com` in a private/incognito window. Send a chat message as each. Confirm:
- `/research` dashboard for each user shows only their own session/stats.
- Neither user's `/chat` session list includes the other's session.
- Reloading the page keeps each user logged in as themselves (persistent login via silent refresh).
- Signing out in one window and then navigating to `/chat` redirects to `/signin`.

Expected: all four checks pass with no cross-user data leakage.

- [ ] **Step 4: Commit (if any fixes were needed)**

If Step 3 surfaced a bug, fix it, re-run the relevant checks, then:
```bash
git add -A
git commit -m "Fix cross-user isolation issue found in manual verification"
```
