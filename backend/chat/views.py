from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import ChatSession, Message, Source, ResearchStats
from .serializers import ChatSessionSerializer, ChatMessageSerializer, MessageSerializer
import sys
import os
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from datetime import timedelta
import json
import uuid
from ai.django_agent_runner import chat as ai_chat

# Import the Django agent runner
try:
    from ai.django_agent_runner import chat
except ImportError:
    # Fallback if the module is not available
    def chat(message, session_id=None):
        return {
            'response': f"AI response to: {message} (Note: AI integration needs API keys configured)",
            'sources': []
        }

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def chat_sessions(request):
    """Get all chat sessions for the current user"""
    sessions = ChatSession.objects.filter(user=request.user)
    serializer = ChatSessionSerializer(sessions, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def chat_session_detail(request, session_id):
    """Get a specific chat session"""
    session = get_object_or_404(ChatSession, id=session_id, user=request.user)
    serializer = ChatSessionSerializer(session)
    return Response(serializer.data)

@csrf_exempt
@require_http_methods(["POST"])
def send_message(request):
    """Send a message and get AI response"""
    try:
        data = json.loads(request.body)
        message_text = data.get('message', '').strip()
        session_id = data.get('session_id')
        
        if not message_text:
            return JsonResponse({'error': 'Message is required'}, status=400)
        
        # Get or create session
        if session_id:
            try:
                session = ChatSession.objects.get(id=session_id)
            except ChatSession.DoesNotExist:
                session = None
        else:
            # Create new session with title from first message
            title = message_text[:50] + "..." if len(message_text) > 50 else message_text
            session = ChatSession.objects.create(title=title)
        
        # Save user message
        user_message = Message.objects.create(
            session=session,
            role='user',
            content=message_text
        )
        
        # Get AI response
        ai_response = ai_chat(message_text, str(session.id))
        
        # Save AI message
        assistant_message = Message.objects.create(
            session=session,
            role='assistant',
            content=ai_response['response']
        )
        
        # Save sources if provided
        if ai_response.get('sources'):
            for source_data in ai_response['sources']:
                Source.objects.create(
                    message=assistant_message,
                    title=source_data.get('title', ''),
                    url=source_data.get('url', ''),
                    snippet=source_data.get('snippet', ''),
                    source_type=source_data.get('source_type', 'web'),
                    relevance_score=source_data.get('relevance_score', 0.0)
                )
        
        # Update session topics based on message content
        update_session_topics(session, message_text)
        
        # Update research stats
        stats = ResearchStats.get_or_create_stats()
        stats.update_stats()
        
        return JsonResponse({
            'message': ai_response['response'],
            'sources': ai_response.get('sources', []),
            'session_id': str(session.id)
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

def update_session_topics(session, message_text):
    """Extract and update session topics based on message content"""
    # Simple topic extraction - you can enhance this with NLP
    topics = []
    message_lower = message_text.lower()
    
    # Define topic keywords
    topic_keywords = {
        'AI': ['ai', 'artificial intelligence', 'machine learning', 'ml', 'neural', 'deep learning'],
        'Healthcare': ['health', 'medical', 'healthcare', 'medicine', 'clinical'],
        'Technology': ['tech', 'technology', 'software', 'programming', 'code'],
        'Climate': ['climate', 'environment', 'sustainability', 'green'],
        'Quantum': ['quantum', 'quantum computing', 'qubits'],
        'Research': ['research', 'study', 'analysis', 'investigation'],
        'Science': ['science', 'scientific', 'experiment', 'laboratory'],
        'Business': ['business', 'market', 'industry', 'commercial'],
    }
    
    for topic, keywords in topic_keywords.items():
        if any(keyword in message_lower for keyword in keywords):
            topics.append(topic)
    
    # Update session topics (avoid duplicates)
    existing_topics = session.topics or []
    for topic in topics:
        if topic not in existing_topics:
            existing_topics.append(topic)
    
    session.topics = existing_topics[:5]  # Limit to 5 topics
    session.save()

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_session(request, session_id):
    """Delete a chat session"""
    session = get_object_or_404(ChatSession, id=session_id, user=request.user)
    session.delete()
    return Response({'message': 'Session deleted successfully'})

@api_view(['GET'])
@permission_classes([])  # No authentication required
def health_check(request):
    """Health check endpoint"""
    return Response({'status': 'healthy', 'message': 'Backend is running'})

@require_http_methods(["GET"])
def dashboard_stats(request):
    """Get dashboard statistics"""
    try:
        stats = ResearchStats.get_or_create_stats()
        stats.update_stats()
        
        return JsonResponse({
            'research_sessions': stats.total_sessions,
            'messages_exchanged': stats.total_messages,
            'sources_cited': stats.total_sources,
            'research_hours': stats.total_research_hours,
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@require_http_methods(["GET"])
def recent_sessions(request):
    """Get recent research sessions"""
    try:
        sessions = ChatSession.objects.all().order_by('-updated_at')[:10]
        
        sessions_data = []
        for session in sessions:
            # Calculate time ago
            time_ago = get_time_ago(session.updated_at)
            
            sessions_data.append({
                'id': session.id,
                'title': session.title,
                'messages': session.get_message_count(),
                'lastActive': time_ago,
                'topics': session.topics or [],
                'status': session.status,

            })
        
        return JsonResponse({'sessions': sessions_data})
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["DELETE"])
def delete_session_dashboard(request, session_id):
    """Delete a chat session from dashboard"""
    try:
        session = ChatSession.objects.get(id=session_id)
        session.delete()
        
        # Update research stats after deletion
        stats = ResearchStats.get_or_create_stats()
        stats.update_stats()
        
        return JsonResponse({'message': 'Session deleted successfully'})
        
    except ChatSession.DoesNotExist:
        return JsonResponse({'error': 'Session not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@require_http_methods(["GET"])
def ai_insights(request):
    """Get AI-generated insights based on user activity"""
    try:
        # Get recent activity
        recent_sessions = ChatSession.objects.all().order_by('-updated_at')[:5]
        recent_messages = Message.objects.all().order_by('-timestamp')[:20]
        
        # Analyze topics
        all_topics = []
        for session in recent_sessions:
            all_topics.extend(session.topics or [])
        
        # Get most common topics
        topic_counts = {}
        for topic in all_topics:
            topic_counts[topic] = topic_counts.get(topic, 0) + 1
        
        top_topics = sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        
        # Generate insights
        insights = []
        
        if top_topics:
            insights.append({
                'title': 'Research Focus',
                'description': f"Your top research area is {top_topics[0][0]} with {top_topics[0][1]} sessions",
                'action': 'Explore more'
            })
        else:
            insights.append({
                'title': 'Research Focus',
                'description': 'Start your first research session to discover your focus areas',
                'action': 'Begin research'
            })
        
        # Add more insights based on activity
        if recent_messages.count() > 10:
            insights.append({
                'title': 'Trending Topics',
                'description': 'You\'re actively researching multiple areas. Consider diving deeper into specific topics.',
                'action': 'Learn more'
            })
        else:
            insights.append({
                'title': 'Trending Topics',
                'description': 'Explore current trends in AI, machine learning, and technology',
                'action': 'Explore topics'
            })
        
        insights.append({
            'title': 'Knowledge Gaps',
            'description': 'Consider exploring new research areas to expand your knowledge base',
            'action': 'Start exploring'
        })
        
        insights.append({
            'title': 'Global Trends',
            'description': 'Stay updated with the latest developments in your research areas',
            'action': 'Learn more'
        })
        
        return JsonResponse({'insights': insights})
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

def get_time_ago(timestamp):
    """Convert timestamp to human-readable time ago"""
    now = timezone.now()
    diff = now - timestamp
    
    if diff.days > 0:
        return f"{diff.days} day{'s' if diff.days != 1 else ''} ago"
    elif diff.seconds >= 3600:
        hours = diff.seconds // 3600
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    elif diff.seconds >= 60:
        minutes = diff.seconds // 60
        return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
    else:
        return "Just now"
