@echo off
setlocal
cd /d "%~dp0"
title Field Shift Diagnostics
set OUT=%~dp0field-shift-diagnostics.txt
(
  echo FIELD SHIFT DIAGNOSTICS
  echo Date: %DATE% %TIME%
  echo Project folder: %CD%
  echo.
  echo ==== Python launcher ====
  where py 2^>^&1
  py --version 2^>^&1
  echo.
  echo ==== Python ====
  python --version 2^>^&1
  echo.
  echo ==== Node / npm ====
  node --version 2^>^&1
  npm --version 2^>^&1
  echo.
  echo ==== Project files ====
  dir /b
  echo.
  echo ==== Backend dependencies ====
  if exist "backend\.venv\Scripts\python.exe" (
    "backend\.venv\Scripts\python.exe" -m pip show fastapi httpx pydantic reportlab pytest 2^>^&1
  ) else (
    echo backend\.venv not found
  )
  echo.
  echo ==== Frontend dependencies ====
  if exist "frontend\node_modules\vite\bin\vite.js" (
    echo Vite installed
    cd frontend
    npm run build 2^>^&1
    cd ..
  ) else (
    echo frontend/node_modules/Vite not found. Run npm install in frontend.
  )
  echo.
  echo ==== Backend health check ====
  curl.exe -sS --max-time 3 http://127.0.0.1:8000/api/health 2^>^&1
  echo.
) > "%OUT%" 2>&1

echo Diagnostics written to:
echo %OUT%
echo.
echo Open that text file and send its contents or a screenshot of the error.
pause
endlocal
