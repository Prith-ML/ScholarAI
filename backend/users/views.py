from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

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


@api_view(['POST'])
@permission_classes([])
def login(request):
    email = request.data.get('email', '')
    password = request.data.get('password', '')
    user = authenticate(request, username=email, password=password)
    if user is None:
        return Response({'error': 'Invalid email or password'}, status=status.HTTP_401_UNAUTHORIZED)
    return _issue_tokens_response(user, status.HTTP_200_OK)


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
