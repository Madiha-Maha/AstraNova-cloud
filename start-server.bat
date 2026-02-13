@echo off
REM AstraNova Cloud Backend Startup Script
echo Checking for Node.js...
where node >nul 2>nul
if %errorlevel%==0 (
    echo Node.js found! Starting server...
    cd /d "%~dp0"
    if not exist node_modules (
        echo Installing dependencies...
        call npm install
    )
    node server.js
) else (
    echo.
    echo ERROR: Node.js is not installed or not in PATH
    echo.
    echo Please download and install Node.js from: https://nodejs.org
    echo Make sure to add Node.js to your PATH during installation
    echo.
    pause
)
