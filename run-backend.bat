@echo off
setlocal
cd /d "%~dp0backend"
if not exist ".venv\Scripts\python.exe" (
  echo Python environment missing. Run start-field-shift.bat from the project root first.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
endlocal
