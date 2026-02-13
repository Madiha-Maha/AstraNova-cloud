#!/bin/bash

# AstraNova Cloud Python Backend Startup Script (Linux/Mac)

echo "Checking for Python..."

if command -v python3 &> /dev/null; then
    echo "Python3 found! Starting server..."
    cd "$(dirname "$0")"
    
    # Create virtual environment if it doesn't exist
    if [ ! -d venv ]; then
        echo "Creating virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install dependencies
    echo "Installing dependencies..."
    pip install -q flask flask-cors
    
    # Start the server
    python app.py
else
    echo ""
    echo "ERROR: Python3 is not installed"
    echo ""
    echo "Please install Python from: https://www.python.org"
    echo ""
    exit 1
fi
