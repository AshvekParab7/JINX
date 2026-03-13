from django.contrib import admin

from .models import ChatMessage, ChatSession, CopingResource, VoiceAnalysis


@admin.register(ChatSession)
class ChatSessionAdmin(admin.ModelAdmin):
    list_display = ['session_id', 'overall_risk_score', 'created_at']
    readonly_fields = ['session_id', 'created_at', 'updated_at']


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ['session', 'role', 'stress_score', 'created_at']
    list_filter = ['role']
    search_fields = ['text']
    readonly_fields = ['created_at']


@admin.register(VoiceAnalysis)
class VoiceAnalysisAdmin(admin.ModelAdmin):
    list_display = ['session', 'stress_level', 'risk_score', 'created_at']
    readonly_fields = ['created_at']


@admin.register(CopingResource)
class CopingResourceAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'duration_minutes', 'is_active']
    list_filter = ['category', 'is_active']
    search_fields = ['title']

