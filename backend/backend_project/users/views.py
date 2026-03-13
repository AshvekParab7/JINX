from django.contrib.auth import authenticate, get_user_model
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import UserProfile

User = get_user_model()


def _normalize_email(email):
	return (email or '').strip().lower()


def _profile_payload(profile):
	return {
		'id': profile.user_id,
		'name': profile.full_name,
		'email': profile.user.email,
		'emergency_sms': profile.emergency_sms,
		'emergency_whatsapp': profile.emergency_whatsapp,
	}


def _get_or_create_profile(user, full_name=''):
	profile, created = UserProfile.objects.get_or_create(
		user=user,
		defaults={'full_name': full_name or user.get_full_name() or user.email or user.username},
	)
	if full_name and profile.full_name != full_name:
		profile.full_name = full_name
		profile.save(update_fields=['full_name', 'updated_at'])
	return profile


@api_view(['POST'])
def register_user(request):
	payload = request.data or {}
	full_name = (payload.get('name') or '').strip()
	email = _normalize_email(payload.get('email'))
	password = payload.get('password') or ''
	emergency_sms = (payload.get('emergency_sms') or '').strip()
	emergency_whatsapp = (payload.get('emergency_whatsapp') or '').strip()

	if not full_name or not email or not password:
		return Response(
			{'error': 'Name, email, and password are required.'},
			status=status.HTTP_400_BAD_REQUEST,
		)

	if User.objects.filter(username__iexact=email).exists() or User.objects.filter(email__iexact=email).exists():
		return Response(
			{'error': 'An account with this email already exists.'},
			status=status.HTTP_400_BAD_REQUEST,
		)

	user = User.objects.create_user(
		username=email,
		email=email,
		password=password,
		first_name=full_name,
	)
	profile = _get_or_create_profile(user, full_name=full_name)
	profile.emergency_sms = emergency_sms
	profile.emergency_whatsapp = emergency_whatsapp
	profile.save(update_fields=['emergency_sms', 'emergency_whatsapp', 'updated_at'])

	token, _ = Token.objects.get_or_create(user=user)
	return Response(
		{'token': token.key, 'user': _profile_payload(profile)},
		status=status.HTTP_201_CREATED,
	)


@api_view(['POST'])
def login_user(request):
	payload = request.data or {}
	email = _normalize_email(payload.get('email'))
	password = payload.get('password') or ''

	if not email or not password:
		return Response(
			{'error': 'Email and password are required.'},
			status=status.HTTP_400_BAD_REQUEST,
		)

	user = authenticate(username=email, password=password)
	if user is None:
		return Response(
			{'error': 'Invalid email or password.'},
			status=status.HTTP_401_UNAUTHORIZED,
		)

	profile = _get_or_create_profile(user)
	token, _ = Token.objects.get_or_create(user=user)
	return Response({'token': token.key, 'user': _profile_payload(profile)})


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def current_user_profile(request):
	profile = _get_or_create_profile(request.user)
	return Response({'user': _profile_payload(profile)})
