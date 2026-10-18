@echo off
setlocal
cd /d "%~dp0frontend"
if not exist "node_modules\vite\bin\vite.js" (
  echo Frontend dependencies missing. Run start-field-shift.bat from the project root first.
  pause
  exit /b 1
)
call npm run dev
endlocal
