@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Field Shift Setup and Launcher

echo ============================================================
echo  FIELD SHIFT - Setup and Launcher
echo ============================================================
echo.

where py >nul 2>&1
if errorlevel 1 (
  echo ERROR: Python launcher 'py' was not found.
  echo Install Python 3.11 or newer from https://www.python.org/downloads/
  echo During setup, enable the Python launcher and PATH options.
  pause
  exit /b 1
)
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js was not found.
  echo Install Node.js 20 or newer from https://nodejs.org/
  pause
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm was not found. Reinstall Node.js with npm included.
  pause
  exit /b 1
)

echo [1/4] Checking Python environment...
if not exist "backend\.venv\Scripts\python.exe" (
  py -3 -m venv "backend\.venv"
  if errorlevel 1 (
    echo ERROR: Could not create the Python virtual environment.
    echo Try: py -m venv backend\.venv
    pause
    exit /b 1
  )
)

echo [2/4] Installing backend dependencies...
"backend\.venv\Scripts\python.exe" -m pip install -r "backend\requirements.txt"
if errorlevel 1 (
  echo ERROR: Backend dependency installation failed. See the error above.
  pause
  exit /b 1
)

echo [3/4] Installing frontend dependencies if needed...
if not exist "frontend\node_modules\vite\bin\vite.js" (
  pushd frontend
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    popd
    echo ERROR: Frontend dependency installation failed.
    echo Check internet access to https://registry.npmjs.org/ and retry.
    echo You can also run diagnose-field-shift.bat to collect diagnostics.
    pause
    exit /b 1
  )
  popd
)

echo [4/4] Opening backend and frontend servers...
start "Field Shift Backend" "%~dp0run-backend.bat"
timeout /t 2 /nobreak >nul
start "Field Shift Frontend" "%~dp0run-frontend.bat"
echo.
echo Backend docs: http://127.0.0.1:8000/docs
echo Frontend:     http://localhost:5173
echo Keep both server windows open while using Field Shift.
timeout /t 3 /nobreak >nul
start "" "http://localhost:5173"
endlocal
