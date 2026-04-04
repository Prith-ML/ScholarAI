# Agentic Research Assistant

A full-stack AI research platform that combines academic research with industry insights using advanced AI/ML capabilities. Built with modern web technologies and deployed on cloud infrastructure, this platform provides intelligent research assistance through semantic search, context-aware AI responses, and comprehensive research management.

## Live Demo

**Experience the platform:** [https://scholar-ai-proj.vercel.app/](https://scholar-ai-proj.vercel.app/)

## Overview

The Agentic Research Assistant represents a sophisticated approach to research automation and AI-powered knowledge discovery. By leveraging dual vector databases, advanced embedding models, and intelligent AI agents, the platform delivers comprehensive research insights that bridge the gap between academic rigor and practical industry applications.

The system processes over 4,000 research sources, including peer-reviewed arXiv papers and curated AI technology articles, blogs, and whitepapers. Through semantic search capabilities powered by AWS Bedrock embeddings and Pinecone vector database technology, users can discover relevant research materials that traditional keyword-based search methods might miss.

## Core Capabilities

### Intelligent AI Research Assistant
The platform features an advanced AI system built on Anthropic's Claude API that understands research context and generates intelligent responses. The AI automatically selects the most appropriate knowledge base for each query, whether it requires academic research papers, industry insights, or a combination of both sources.

### Semantic Search Engine
Unlike traditional search systems that rely on keyword matching, this platform employs vector embeddings to understand the semantic meaning of research queries. The system can identify conceptual relationships, find relevant research across different domains, and provide contextually appropriate results even when exact terminology doesn't match.

### Dual Knowledge Base Architecture
The platform maintains two specialized vector databases: one populated with vectorized arXiv academic papers and another with curated AI technology articles, blogs, and industry reports. This dual approach ensures balanced insights drawn from both rigorous scholarship and real-world applications.

### Proactive Research Guidance
Beyond answering direct questions, the AI system generates follow-up questions and suggests research directions. This proactive approach helps researchers explore related topics, identify gaps in their understanding, and discover new areas of investigation.

### Real-time Research Collaboration
The platform provides a real-time chat interface powered by WebSocket technology, enabling dynamic research conversations and immediate access to AI insights. Users can maintain research sessions, track their progress, and export findings in multiple formats.

## Technical Architecture

### Frontend Infrastructure
Built with Next.js 14 and the App Router, the frontend provides a modern, responsive user experience. The interface uses TypeScript for type safety, Tailwind CSS for styling, and Shadcn/ui components for a professional appearance. State management is handled through Zustand, ensuring efficient data flow and real-time updates.

### Backend Services
The Django 5.2 backend provides a robust RESTful API with Django REST Framework. Real-time features are implemented through Django Channels and WebSockets, while background task processing is handled by Celery with Redis as the message broker. The system uses PostgreSQL for primary data storage and Redis for caching and session management.

### AI/ML Pipeline
The AI pipeline integrates multiple advanced technologies: Anthropic Claude API for natural language understanding and response generation, AWS Bedrock for text vectorization and embedding generation, and Pinecone for high-performance vector similarity search across large-scale research databases.

### Data Processing and Storage
The platform processes research documents through a sophisticated pipeline that extracts metadata, generates vector embeddings, and stores information in optimized vector databases. The system maintains separate indices for different types of research content, enabling specialized search capabilities while maintaining overall system performance.

## Key Features

**Research Intelligence**: Advanced AI that understands research context and provides nuanced responses with automatic source citation.

**Semantic Discovery**: Vector-based search that goes beyond keywords to understand research concepts and relationships.

**Comprehensive Dashboard**: Research session tracking, statistics, and history management with visual progress indicators.

**Real-time Collaboration**: Live chat interface with instant AI responses and collaborative research capabilities.

**Multi-format Export**: Support for JSON and CSV export formats to facilitate research documentation and sharing.

**Responsive Design**: Optimized interface that works seamlessly across desktop, tablet, and mobile devices.

## Technology Stack

### Frontend Technologies
- Next.js 14 with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- Shadcn/ui component library
- Zustand for state management
- WebSocket integration for real-time features

### Backend Technologies
- Django 5.2 web framework
- Django REST Framework for API development
- Django Channels for WebSocket support
- Celery for background task processing
- PostgreSQL for primary database
- Redis for caching and message brokering

### AI and Machine Learning
- Anthropic Claude API for language model capabilities
- AWS Bedrock for text embedding generation
- Pinecone for vector database operations
- Custom AI agent implementation for proactive research guidance

### Infrastructure and Deployment
- Docker containerization for consistent deployment
- Railway for backend hosting and PostgreSQL database
- Vercel for frontend deployment and hosting
- Cloud-based vector database services

## Project Structure

```
agentic-research-assistant/
├── backend/                 # Django backend application
│   ├── ai/                 # AI/ML pipeline and agent implementation
│   ├── chat/               # Chat functionality and WebSocket handling
│   ├── users/              # User management and authentication
│   └── core/               # Django settings and configuration
├── frontend/               # Next.js frontend application
│   ├── src/app/           # Next.js App Router pages and routing
│   ├── src/components/    # React components and UI elements
│   └── src/store/         # State management and data handling
├── docker-compose.yml      # Service orchestration and configuration
└── requirements.txt        # Python dependencies and packages
```

## Research Applications

This platform serves researchers, academics, industry professionals, and students across various domains. It's particularly valuable for:

**Academic Research**: Access to peer-reviewed papers and academic literature with intelligent search and analysis capabilities.

**Industry Research**: Integration of academic insights with practical industry applications and current technology trends.

**Technology Development**: Comprehensive understanding of AI and technology landscapes through multi-source analysis.

**Educational Purposes**: Learning and discovery through AI-guided research exploration and source discovery.

## License

This project is licensed under the MIT License, allowing for free use, modification, and distribution for both personal and commercial purposes.

---

Built with modern web technologies and AI/ML capabilities for intelligent research assistance. 