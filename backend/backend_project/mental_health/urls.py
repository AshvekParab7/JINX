from django.urls import path

from .views import ChatHistoryView, ChatSessionsView, ChatView, CopingResourcesView, VoiceAnalysisView

urlpatterns = [
    path('chat/', ChatView.as_view(), name='mental-health-chat'),
    path('sessions/', ChatSessionsView.as_view(), name='mental-health-sessions'),
    path('voice/', VoiceAnalysisView.as_view(), name='mental-health-voice'),
    path('resources/', CopingResourcesView.as_view(), name='mental-health-resources'),
    path('history/<str:session_id>/', ChatHistoryView.as_view(), name='mental-health-history'),
]
