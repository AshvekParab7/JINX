from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient


class MentalHealthVoiceApiTests(TestCase):
	def setUp(self):
		self.client = APIClient()

	def test_voice_analysis_returns_live_voice_fields(self):
		audio = SimpleUploadedFile(
			'sample.m4a',
			b'0' * 240000,
			content_type='audio/m4a',
		)

		response = self.client.post('/api/mental-health/voice/', {'audio': audio}, format='multipart')

		self.assertEqual(response.status_code, 200)
		self.assertIn('session_id', response.data)
		self.assertIn('mood', response.data)
		self.assertIn('mood_label', response.data)
		self.assertIn('visual_theme', response.data)
		self.assertIn('ai_reply', response.data)
		self.assertIn('duration_seconds', response.data)
		self.assertIn('session_risk', response.data)
		self.assertIn('primary', response.data['visual_theme'])
		self.assertIn('secondary', response.data['visual_theme'])

	def test_voice_analysis_reuses_session_and_updates_session_risk(self):
		first_audio = SimpleUploadedFile(
			'first.m4a',
			b'1' * 180000,
			content_type='audio/m4a',
		)
		first_response = self.client.post('/api/mental-health/voice/', {'audio': first_audio}, format='multipart')

		second_audio = SimpleUploadedFile(
			'second.m4a',
			b'2' * 320000,
			content_type='audio/m4a',
		)
		second_response = self.client.post(
			'/api/mental-health/voice/',
			{'audio': second_audio, 'session_id': first_response.data['session_id']},
			format='multipart',
		)

		self.assertEqual(second_response.status_code, 200)
		self.assertEqual(first_response.data['session_id'], second_response.data['session_id'])
		self.assertGreaterEqual(second_response.data['session_risk'], 0)
