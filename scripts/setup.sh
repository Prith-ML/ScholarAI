#!/bin/bash

# Setup script for Agentic Research Assistant

echo "🚀 Setting up Agentic Research Assistant..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please edit .env file with your API keys before continuing."
    echo "   Required keys: CLAUDE_API_KEY, PINECONE_API_KEY, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p backend/static
mkdir -p backend/media
mkdir -p frontend/public

# Install backend dependencies
echo "🐍 Installing Python dependencies..."
cd backend
pip install -r requirements.txt
cd ..

# Install frontend dependencies (if Node.js is available)
if command -v npm &> /dev/null; then
    echo "📦 Installing Node.js dependencies..."
    cd frontend
    npm install
    cd ..
else
    echo "⚠️  Node.js not found. Frontend dependencies will be installed when you run Docker."
fi

# Build Docker images
echo "🐳 Building Docker images..."
docker-compose build

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your API keys"
echo "2. Run: docker-compose up -d"
echo "3. Access the application at http://localhost:3000"
echo ""
echo "For development:"
echo "- Backend: http://localhost:8000"
echo "- Frontend: http://localhost:3000"
echo "- Database: localhost:5432"
echo "- Redis: localhost:6379" 