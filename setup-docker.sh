#!/bin/bash

# P2P Collaborative Notebook - Docker Setup Script
# This script sets up and runs the complete P2P notebook environment

set -e

echo "🚀 P2P Collaborative Notebook Docker Setup"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_status "Docker and Docker Compose are installed ✓"
}

# Create project structure
setup_structure() {
    print_step "Setting up project structure..."
    
    # Create directories if they don't exist
    mkdir -p auth-service
    mkdir -p p2p-signaling-server  
    mkdir -p client
    
    print_status "Project structure created ✓"
}

# Copy Docker files to appropriate locations
setup_docker_files() {
    print_step "Setting up Docker files..."
    
    # Copy Dockerfiles to respective directories
    if [ -f "auth-service-dockerfile" ]; then
        cp auth-service-dockerfile auth-service/Dockerfile
        print_status "Auth service Dockerfile copied ✓"
    fi
    
    if [ -f "p2p-signaling-dockerfile" ]; then
        cp p2p-signaling-dockerfile p2p-signaling-server/Dockerfile
        print_status "P2P signaling Dockerfile copied ✓"
    fi
    
    if [ -f "client-dockerfile-dev" ]; then
        cp client-dockerfile-dev client/Dockerfile.dev
        print_status "Client dev Dockerfile copied ✓"
    fi
    
    if [ -f "client-dockerfile-prod" ]; then
        cp client-dockerfile-prod client/Dockerfile.prod
        print_status "Client prod Dockerfile copied ✓"
    fi
    
    if [ -f "nginx-conf" ]; then
        cp nginx-conf client/nginx.conf
        print_status "Nginx configuration copied ✓"
    fi
}

# Setup environment file
setup_env() {
    print_step "Setting up environment configuration..."
    
    if [ ! -f ".env" ]; then
        if [ -f "env-example" ]; then
            cp env-example .env
            print_warning "Created .env file from template. Please edit it with your actual values."
            print_warning "You need to set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and JWT_SECRET"
        else
            print_error "Environment template not found. Creating minimal .env..."
            cat > .env << EOF
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
JWT_SECRET=please_change_this_to_a_secure_random_string_min_32_characters
NODE_ENV=development
EOF
        fi
    else
        print_status "Environment file already exists ✓"
    fi
}

# Function to start services
start_development() {
    print_step "Starting development environment..."
    
    docker-compose up -d yjs-signaling auth-service p2p-signaling frontend-dev
    
    print_status "Development services started! 🎉"
    echo ""
    echo "📋 Service URLs:"
    echo "   • Frontend (Dev):     http://localhost:5173"
    echo "   • Auth Service:       http://localhost:3001"
    echo "   • YJS Signaling:      ws://localhost:4444"
    echo "   • Custom Signaling:   ws://localhost:3003/signal"
    echo ""
    echo "🔍 To view logs: docker-compose logs -f"
    echo "🛑 To stop:      docker-compose down"
}

start_production() {
    print_step "Starting production environment..."
    
    docker-compose --profile production up -d
    
    print_status "Production services started! 🎉"
    echo ""
    echo "📋 Service URLs:"
    echo "   • Frontend (Prod):    http://localhost:8080"
    echo "   • Auth Service:       http://localhost:3001"
    echo "   • YJS Signaling:      ws://localhost:4444"
    echo "   • Custom Signaling:   ws://localhost:3003/signal"
}

# Function to show help
show_help() {
    echo "P2P Collaborative Notebook Docker Setup"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  setup     Set up project structure and Docker files"
    echo "  dev       Start development environment"
    echo "  prod      Start production environment"
    echo "  stop      Stop all services"
    echo "  logs      Show service logs"
    echo "  clean     Stop services and remove containers/volumes"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 setup     # Initial setup"
    echo "  $0 dev       # Start development"
    echo "  $0 logs      # View logs"
    echo "  $0 stop      # Stop services"
}

# Main script logic
case "${1:-help}" in
    "setup")
        check_docker
        setup_structure
        setup_docker_files
        setup_env
        print_status "Setup complete! Run '$0 dev' to start development environment."
        ;;
    
    "dev")
        check_docker
        start_development
        ;;
    
    "prod")
        check_docker
        start_production
        ;;
    
    "stop")
        print_step "Stopping all services..."
        docker-compose down
        print_status "All services stopped ✓"
        ;;
    
    "logs")
        docker-compose logs -f
        ;;
    
    "clean")
        print_step "Cleaning up containers and volumes..."
        docker-compose down -v --remove-orphans
        docker system prune -f
        print_status "Cleanup complete ✓"
        ;;
    
    "help"|*)
        show_help
        ;;
esac