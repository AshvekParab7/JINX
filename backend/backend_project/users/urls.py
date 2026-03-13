from django.urls import path

from . import views


urlpatterns = [
    path('register/', views.register_user, name='users-register'),
    path('login/', views.login_user, name='users-login'),
    path('profile/', views.current_user_profile, name='users-profile'),
]