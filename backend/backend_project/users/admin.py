from django.contrib import admin

from .models import UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
	list_display = ('full_name', 'user', 'emergency_sms', 'emergency_whatsapp', 'updated_at')
	search_fields = ('full_name', 'user__username', 'user__email', 'emergency_sms', 'emergency_whatsapp')
