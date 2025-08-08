from django.urls import path
from . import views

urlpatterns = [
    path('sessions/', views.chat_sessions, name='chat_sessions'),
    path('sessions/<int:session_id>/', views.chat_session_detail, name='chat_session_detail'),
    path('sessions/<int:session_id>/delete/', views.delete_session, name='delete_session'),
    path('send/', views.send_message, name='send_message'),
    path('health/', views.health_check, name='health_check'),
    
    # Dashboard endpoints
    path('dashboard/stats/', views.dashboard_stats, name='dashboard_stats'),
    path('dashboard/sessions/', views.recent_sessions, name='recent_sessions'),
    path('dashboard/insights/', views.ai_insights, name='ai_insights'),
    path('dashboard/sessions/<int:session_id>/delete/', views.delete_session_dashboard, name='delete_session_dashboard'),
] 