@echo off
REM AstraNova Cloud Python Backend Startup Script
echo Checking for Python...
where python >nul 2>nul
if %errorlevel%==0 (
    echo Python found! Starting server...
    cd /d "%~dp0"
    
    REM Check if virtual environment exists
    if not exist venv (
        echo Creating virtual environment...
        call python -m venv venv
    )
    
    REM Activate virtual environment
    call venv\Scripts\activate.bat
    
    REM Install/upgrade dependencies
    echo Installing dependencies...
    call pip install -q flask flask-cors
    
    REM Start the server
    python app.py
) else (
    echo.
    echo ERROR: Python is not installed or not in PATH
    echo.
    echo Please download and install Python from: https://www.python.org
    echo Make sure to check "Add Python to PATH" during installation
    echo.
    pause
)
