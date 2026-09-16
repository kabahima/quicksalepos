@echo off
setlocal

set "BACKEND_PATH=C:\Users\workstation\Documents\GitHub\hml\backend\bookkeeping"
set "FRONTEND_PATH=C:\Users\workstation\Documents\GitHub\hml\frontend"
set "VENV_PYTHON=C:\Users\workstation\Documents\GitHub\hml\backend\.venv\Scripts\python.exe"
if not defined NEXT_PUBLIC_API_URL set "NEXT_PUBLIC_API_URL=http://localhost:8000/api"

echo Starting Backend (Django)...
start "Django Backend" cmd /k "cd /d "%BACKEND_PATH%" && "%VENV_PYTHON%" manage.py runserver 0.0.0.0:8000"

echo Starting Frontend (Next.js)...
start "Next.js Frontend" cmd /k "cd /d "%FRONTEND_PATH%" && set NEXT_PUBLIC_API_URL=%NEXT_PUBLIC_API_URL% && npm run dev"

echo.
echo Both servers are starting in separate windows.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
echo.
echo You can close this window. The servers will keep running in their own windows.
pause
