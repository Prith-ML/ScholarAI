# 🤖 Agentic Research Assistant

A full-stack AI research assistant with agentic capabilities, built with Next.js, Django, and your existing AI code.

## 🚀 Features

- **Real-time Chat Interface** - Interactive chat with AI
- **Research Dashboard** - Comprehensive research tools
- **Agentic AI** - Your existing intelligent AI capabilities
- **Multi-database Search** - Academic papers + Industry articles
- **User Authentication** - Secure user management
- **Real-time Updates** - WebSocket-powered live updates
- **Export Functionality** - JSON, CSV export options
- **Responsive Design** - Works on all devices

## 🏗️ Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Shadcn/ui** - Beautiful components
- **Zustand** - State management
- **Socket.io** - Real-time communication

### Backend
- **Django 5.2** - Python web framework
- **Django REST Framework** - API development
- **Django Channels** - WebSocket support
- **Celery** - Background task processing
- **PostgreSQL** - Primary database
- **Redis** - Caching and message broker

### AI/ML
- **Your Existing AI Code** - agent_runner.py
- **Anthropic Claude API** - AI language model
- **Pinecone** - Vector database
- **AWS Bedrock** - Embeddings

### Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Multi-service orchestration
- **Environment Variables** - Secure configuration

## 📦 Installation

### Prerequisites
- Docker and Docker Compose
- Python 3.11+
- Node.js 18+ (optional, for local development)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd agentic-research-assistant
   ```

2. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your API keys
   ```

3. **Run the setup script**
   ```bash
   chmod +x scripts/setup.sh
   ./scripts/setup.sh
   ```

4. **Start the application**
   ```bash
   docker-compose up -d
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - Django Admin: http://localhost:8000/admin

## 🔧 Development

### Local Development

1. **Backend Development**
   ```bash
   cd backend
   pip install -r requirements.txt
   python manage.py runserver
   ```

2. **Frontend Development**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Docker Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Database Management

```bash
# Run migrations
docker-compose exec backend python manage.py migrate

# Create superuser
docker-compose exec backend python manage.py createsuperuser

# Access database
docker-compose exec postgres psql -U postgres -d research_assistant
```

## 📁 Project Structure

```
agentic-research-assistant/
├── backend/                 # Django backend
│   ├── core/               # Django settings
│   ├── apps/               # Django apps
│   │   ├── users/          # User management
│   │   ├── chat/           # Chat functionality
│   │   └── research/       # Research features
│   ├── ai/                 # Your AI code
│   └── requirements.txt    # Python dependencies
├── frontend/               # Next.js frontend
│   ├── src/
│   │   ├── app/           # Next.js App Router
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom hooks
│   │   └── lib/           # Utilities
│   └── package.json       # Node.js dependencies
├── docker-compose.yml      # Docker orchestration
├── env.example            # Environment template
└── scripts/               # Setup and deployment scripts
```

## 🔑 Environment Variables

Create a `.env` file with the following variables:

```env
# Django Settings
DEBUG=True
SECRET_KEY=your-secret-key
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DATABASE_URL=postgresql://postgres:password@postgres:5432/research_assistant
POSTGRES_DB=research_assistant
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password

# Redis
REDIS_URL=redis://redis:6379/0

# AI APIs
CLAUDE_API_KEY=your-claude-api-key
PINECONE_API_KEY=your-pinecone-api-key

# AWS
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
```

## 🚀 Deployment

### Production Deployment

1. **Update environment variables**
   ```bash
   # Set DEBUG=False
   # Update ALLOWED_HOSTS
   # Use production database URLs
   ```

2. **Build and deploy**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

### Cloud Deployment

- **Vercel** - Frontend deployment
- **Railway** - Backend deployment
- **Supabase** - Database hosting
- **Redis Cloud** - Redis hosting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

If you encounter any issues:

1. Check the logs: `docker-compose logs`
2. Verify environment variables
3. Ensure all services are running
4. Check the documentation

## 🎯 Roadmap

- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Mobile app
- [ ] Advanced search filters
- [ ] Collaborative features
- [ ] API rate limiting
- [ ] Advanced caching
- [ ] Performance monitoring

---

**Built with ❤️ using modern web technologies** 