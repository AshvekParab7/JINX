from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image
from rest_framework.test import APIClient


class HealthDetectApiTests(TestCase):
	def setUp(self):
		self.client = APIClient()

	def _make_upload(self, color=(220, 110, 110)):
		image = Image.new('RGB', (64, 64), color)
		buffer = BytesIO()
		image.save(buffer, format='JPEG')
		buffer.seek(0)
		return SimpleUploadedFile('scan.jpg', buffer.read(), content_type='image/jpeg')

	def test_rejects_missing_image(self):
		response = self.client.post('/api/health-detect/', {}, format='multipart')

		self.assertEqual(response.status_code, 400)
		self.assertEqual(response.data['error'], 'No image provided.')

	def test_returns_analysis_payload(self):
		response = self.client.post(
			'/api/health-detect/',
			{'image': self._make_upload()},
			format='multipart',
		)

		self.assertEqual(response.status_code, 200)
		self.assertIn('condition', response.data)
		self.assertIn('confidence', response.data)
		self.assertIn('advice', response.data)
		self.assertIn('analysis_source', response.data)
		self.assertIn(response.data['scan_type'], {'skin', 'retina'})
