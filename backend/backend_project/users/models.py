from django.conf import settings
from django.db import models


class UserProfile(models.Model):
	user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
	full_name = models.CharField(max_length=150)
	emergency_sms = models.CharField(max_length=32, blank=True)
	emergency_whatsapp = models.CharField(max_length=32, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ['full_name', 'id']

	def __str__(self):
		return self.full_name or self.user.email or self.user.username
