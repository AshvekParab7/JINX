from django.db import models

class FallEvent(models.Model):
	contact_number = models.CharField(max_length=32, blank=True)
	mode = models.CharField(max_length=32, default='simulated')
	activity = models.CharField(max_length=64, blank=True)
	confidence = models.PositiveSmallIntegerField(default=0)
	severity = models.CharField(max_length=24, default='Normal')
	source = models.CharField(max_length=32, default='mobile')
	auto_alert_triggered = models.BooleanField(default=False)
	notes = models.TextField(blank=True)
	sensor_payload = models.JSONField(default=dict, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ['-created_at']


class ActivitySnapshot(models.Model):
	mode = models.CharField(max_length=32, default='simulated')
	activity = models.CharField(max_length=64)
	confidence = models.PositiveSmallIntegerField(default=0)
	source = models.CharField(max_length=32, default='mobile')
	sensor_payload = models.JSONField(default=dict, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ['-created_at']
