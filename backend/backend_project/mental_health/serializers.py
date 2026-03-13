from rest_framework import serializers
from .models import ChatSession, ChatMessage, VoiceAnalysis, CopingResource


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'role', 'text', 'stress_score', 'detected_keywords', 'created_at']
        read_only_fields = ['id', 'created_at']


class ChatSessionSummarySerializer(serializers.ModelSerializer):
    title = serializers.SerializerMethodField()
    preview = serializers.SerializerMethodField()
    message_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatSession
        fields = ['session_id', 'overall_risk_score', 'created_at', 'updated_at', 'title', 'preview', 'message_count']
        read_only_fields = ['session_id', 'created_at', 'updated_at']

    def get_title(self, obj):
        first_user_message = obj.messages.filter(role='user').order_by('created_at').first()
        first_message = first_user_message or obj.messages.order_by('created_at').first()
        if not first_message:
            return 'New chat'
        return first_message.text[:36].strip() or 'New chat'

    def get_preview(self, obj):
        last_message = obj.messages.order_by('-created_at').first()
        if not last_message:
            return 'No messages yet.'
        return last_message.text[:90].strip()

    def get_message_count(self, obj):
        return obj.messages.count()


class ChatSessionSerializer(ChatSessionSummarySerializer):
    messages = ChatMessageSerializer(many=True, read_only=True)

    class Meta:
        model = ChatSession
        fields = ['session_id', 'overall_risk_score', 'created_at', 'updated_at', 'title', 'preview', 'message_count', 'messages']
        read_only_fields = ['session_id', 'created_at', 'updated_at']


class VoiceAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = VoiceAnalysis
        fields = ['id', 'stress_level', 'risk_score', 'duration_seconds', 'notes', 'created_at']
        read_only_fields = ['id', 'stress_level', 'risk_score', 'notes', 'created_at']


class CopingResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CopingResource
        fields = ['id', 'title', 'description', 'category', 'steps', 'duration_minutes']
