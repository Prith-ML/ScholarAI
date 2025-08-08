from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import json

class ChatSession(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('paused', 'Paused'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    title = models.CharField(max_length=200)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')
    topics = models.JSONField(default=list, blank=True)  # Store research topics as JSON

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_activity = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-updated_at']
    
    def __str__(self):
        username = self.user.username if self.user else "Anonymous"
        return f"{self.title} - {username}"
    
    def get_message_count(self):
        return self.messages.count()
    
    def get_duration_minutes(self):
        """Calculate total duration of the session in minutes"""
        if self.messages.exists():
            first_message = self.messages.first()
            last_message = self.messages.last()
            duration = last_message.timestamp - first_message.timestamp
            return int(duration.total_seconds() / 60)
        return 0
    


class Message(models.Model):
    ROLE_CHOICES = [
        ('user', 'User'),
        ('assistant', 'Assistant'),
    ]
    
    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['timestamp']
    
    def __str__(self):
        return f"{self.role}: {self.content[:50]}..."
    


class Source(models.Model):
    SOURCE_TYPES = [
        ('academic', 'Academic'),
        ('industry', 'Industry'),
        ('web', 'Web'),
    ]
    
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='sources')
    title = models.CharField(max_length=200)
    url = models.URLField()
    snippet = models.TextField()
    source_type = models.CharField(max_length=10, choices=SOURCE_TYPES, default='web')
    relevance_score = models.FloatField(default=0.0)
    
    def __str__(self):
        return self.title

class ResearchStats(models.Model):
    """Model to store aggregated research statistics"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    total_sessions = models.IntegerField(default=0)
    total_messages = models.IntegerField(default=0)
    total_sources = models.IntegerField(default=0)
    total_research_hours = models.FloatField(default=0.0)
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name_plural = "Research Stats"
    
    def __str__(self):
        username = self.user.username if self.user else "Anonymous"
        return f"Stats for {username}"
    
    @classmethod
    def get_or_create_stats(cls, user=None):
        """Get or create stats for a user"""
        stats, created = cls.objects.get_or_create(user=user)
        if created:
            stats.update_stats()
        return stats
    
    def update_stats(self):
        """Update statistics based on actual data"""
        sessions = ChatSession.objects.filter(user=self.user)
        self.total_sessions = sessions.count()
        
        total_messages = 0
        total_sources = 0
        total_minutes = 0
        
        for session in sessions:
            total_messages += session.get_message_count()
            total_sources += Source.objects.filter(message__session=session).count()
            total_minutes += session.get_duration_minutes()
        
        self.total_messages = total_messages
        self.total_sources = total_sources
        self.total_research_hours = round(total_minutes / 60, 1)
        self.save()
