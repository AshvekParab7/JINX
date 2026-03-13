import uuid
from django.db import models


class ChatSession(models.Model):
    session_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    overall_risk_score = models.FloatField(default=0.0)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Session {self.session_id} (risk={self.overall_risk_score:.2f})"


class ChatMessage(models.Model):
    ROLE_CHOICES = [('user', 'User'), ('bot', 'Bot')]

    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    text = models.TextField()
    stress_score = models.FloatField(default=0.0)
    detected_keywords = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.role}: {self.text[:60]}"


class VoiceAnalysis(models.Model):
    STRESS_LEVELS = [
        ('low', 'Low'),
        ('moderate', 'Moderate'),
        ('high', 'High'),
        ('crisis', 'Crisis'),
    ]

    session = models.ForeignKey(
        ChatSession, on_delete=models.CASCADE,
        null=True, blank=True, related_name='voice_analyses'
    )
    audio_file = models.FileField(upload_to='voice_analysis/')
    stress_level = models.CharField(max_length=20, choices=STRESS_LEVELS, default='low')
    risk_score = models.FloatField(default=0.0)
    duration_seconds = models.FloatField(default=0.0)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Voice – {self.stress_level} ({self.risk_score:.2f})"


class CopingResource(models.Model):
    CATEGORY_CHOICES = [
        ('breathing', 'Breathing Exercise'),
        ('grounding', 'Grounding Technique'),
        ('activity', 'Physical Activity'),
        ('mindfulness', 'Mindfulness'),
        ('cognitive', 'Cognitive Reframe'),
        ('emergency', 'Emergency Contact'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField()
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    steps = models.JSONField(default=list)
    duration_minutes = models.IntegerField(default=5)
    min_risk_score = models.FloatField(default=0.0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['category', 'duration_minutes']

    def __str__(self):
        return f"{self.title} ({self.category})"

