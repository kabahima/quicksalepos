#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend/bookkeeping"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8000/api}"
REQ_FILE="$SCRIPT_DIR/backend/requirements.txt"
VENV_DIR="$SCRIPT_DIR/backend/.venv"
VENV_PYTHON="$VENV_DIR/bin/python"
VENV_PIP="$VENV_DIR/bin/pip"

echo "Checking backend virtualenv..."

if [ ! -s "$VENV_PYTHON" ] || ! -x "$VENV_PYTHON" || ! "$VENV_PYTHON" -c "import sys" >/dev/null 2>&1; then
  rm -rf "$VENV_DIR"
  echo "Virtualenv not found. Creating with python3 -m venv..."
  cd "$SCRIPT_DIR/backend"
  python3 -m venv .venv
  echo "Installing backend dependencies..."
  "$VENV_PIP" install -r "$REQ_FILE"
else
  echo "Virtualenv found at $VENV_DIR"
fi

echo "Verifying dependencies in virtualenv..."
if ! "$VENV_PYTHON" -c "import django" 2>/dev/null; then
  echo "Django not found in venv. Installing requirements..."
  "$VENV_PYTHON" -m pip install -r "$REQ_FILE"
else
  echo "Requirements already installed in venv."
fi

echo "Running migrations..."
cd "$BACKEND_DIR"
"$VENV_PYTHON" manage.py migrate --noinput

echo "Checking frontend dependencies..."
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "Installing frontend dependencies..."
  cd "$FRONTEND_DIR"
  npm install
else
  echo "Frontend dependencies already installed."
fi

kill_port() {
  local port=$1
  echo "Attempting to free port $port..."
  
  if command -v powershell.exe >/dev/null 2>&1; then
    echo "Trying to kill Windows process on port $port via PowerShell..."
    powershell.exe -Command "Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue" 2>/dev/null || true
    sleep 1
  fi
  
  if command -v lsof >/dev/null 2>&1; then
    local pids=$(lsof -Pi :$port -sTCP:LISTEN -t 2>/dev/null || true)
    if [ -n "$pids" ]; then
      echo "Found Linux process(es) on port $port: $pids"
      kill $pids 2>/dev/null || true
      sleep 1
    fi
  fi

  if command -v fuser >/dev/null 2>&1; then
    fuser -k "$port/tcp" >/dev/null 2>&1 || true
  fi
  
  if command -v cmd.exe >/dev/null 2>&1; then
    echo "Trying to kill Windows process on port $port via taskkill..."
    local win_pids=$(cmd.exe /c "netstat -ano | findstr :$port | findstr LISTENING" 2>/dev/null | awk '{print $5}' | sort -u)
    if [ -n "$win_pids" ]; then
      for pid in $win_pids; do
        echo "Killing Windows process PID: $pid"
        cmd.exe /c "taskkill /F /PID $pid" 2>/dev/null || true
      done
      sleep 1
    fi
  fi
}

wait_for_port() {
  local port=$1
  local timeout=30
  local start=$(date +%s)
  
  echo "Waiting for port $port to be available..."
  while true; do
    local in_use=0
    
    if command -v lsof >/dev/null 2>&1; then
      if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        in_use=1
      fi
    fi
    
    if command -v cmd.exe >/dev/null 2>&1; then
      if cmd.exe /c "netstat -ano | findstr :$port | findstr LISTENING" 2>/dev/null | grep -q .; then
        in_use=1
      fi
    fi
    
    if [ $in_use -eq 0 ]; then
      echo "Port $port is free"
      return 0
    fi
    
    local now=$(date +%s)
    if [ $((now - start)) -gt $timeout ]; then
      echo "Timeout waiting for port $port"
      return 1
    fi
    sleep 1
  done
}

echo ""
echo "=========================================="
echo "Starting Backend"
echo "=========================================="

kill_port 8000
wait_for_port 8000

echo "Starting Backend (Django) on http://localhost:8000 ..."
cd "$BACKEND_DIR"
"$VENV_PYTHON" manage.py runserver 0.0.0.0:8000 --noreload &
BACKEND_PID=$!

echo "Backend started with PID: $BACKEND_PID"
echo "Waiting for backend to be ready..."
sleep 3

echo ""
echo "=========================================="
echo "Starting Frontend"
echo "=========================================="

kill_port 3000
wait_for_port 3000

echo "Starting Frontend (Next.js) on http://localhost:3000 ..."
cd "$FRONTEND_DIR"
PORT=3000 npm run dev &
FRONTEND_PID=$!

echo ""
echo "=========================================="
echo "Both servers are starting."
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo "=========================================="
echo ""
echo "Press Ctrl+C to stop both."

cleanup() {
  if [ "${CLEANED_UP:-0}" -eq 1 ]; then
    return
  fi
  CLEANED_UP=1
  echo "Stopping servers..."
  kill "${BACKEND_PID:-}" "${FRONTEND_PID:-}" 2>/dev/null || true
}

trap 'cleanup; exit 130' INT TERM
trap 'cleanup' EXIT
wait
