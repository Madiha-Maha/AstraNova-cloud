#!/bin/bash

# AstraNova Cloud Backend Startup Script (Linux/Mac)

echo "Checking for Node.js..."

if command -v node &> /dev/null; then
    echo "Node.js found! Starting server..."
    cd "$(dirname "$0")"
    
    if [ ! -d node_modules ]; then
        echo "Installing dependencies..."
        npm install
    fi
    
    node server.js
else
    echo ""
    echo "ERROR: Node.js is not installed"
    echo ""
    echo "Please download and install Node.js from: https://nodejs.org"
    echo ""
    exit 1
fi
