#!/bin/bash

# Knowledge Dreamer Setup Script

echo "🌟 Knowledge Dreamer Setup"
echo "=========================="
echo ""

# Check if .env exists
if [ -f .env ]; then
    echo "✓ .env file already exists"
else
    if [ -f .env.example ]; then
        echo "Creating .env file from .env.example..."
        cp .env.example .env
        echo "✓ .env file created"
        echo ""
        echo "⚠️  IMPORTANT: Edit .env and add your GEMINI_API_KEY"
        echo "   Get your key from: https://makersuite.google.com/app/apikey"
        echo ""
    else
        echo "❌ .env.example not found"
        exit 1
    fi
fi

# Install dependencies
echo "Installing dependencies..."
pnpm install

echo ""
echo "✓ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env and add your GEMINI_API_KEY"
echo "2. Run 'pnpm dreamer' to start the backend"
echo "3. Run 'cd frontend && pnpm dev' to start the frontend"
echo ""
