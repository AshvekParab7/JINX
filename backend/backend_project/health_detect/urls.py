from django.urls import path
from . import views

urlpatterns = [
    path('', views.analyze_health_image, name='health-detect'),
]
