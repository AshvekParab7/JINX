from django.urls import path

from . import views


urlpatterns = [
    path('incidents/', views.log_fall_event, name='fall-incident-log'),
    path('activity/', views.log_activity_snapshot, name='fall-activity-log'),
]