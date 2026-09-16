$ErrorActionPreference = "Stop"

$backendPath = "C:\Users\workstation\Documents\GitHub\hml\backend\bookkeeping"
$frontendPath = "C:\Users\workstation\Documents\GitHub\hml\frontend"
$venvPython = "C:\Users\workstation\Documents\GitHub\hml\backend\.venv\Scripts\python.exe"
$apiUrl = if ($env:NEXT_PUBLIC_API_URL) { $env:NEXT_PUBLIC_API_URL } else { "http://localhost:8000/api" }

Write-Host "Starting Backend (Django)..." -ForegroundColor Cyan
$backendProcess = Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "Set-Location '$backendPath'; & '$venvPython' manage.py runserver 0.0.0.0:8000" -PassThru -WindowStyle Normal

Write-Host "Starting Frontend (Next.js)..." -ForegroundColor Cyan
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendPath'; `$env:NEXT_PUBLIC_API_URL='$apiUrl'; npm run dev" -PassThru -WindowStyle Normal

Write-Host ""
Write-Host "Both servers are starting in separate windows." -ForegroundColor Green
Write-Host "Backend: http://localhost:8000" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C in this window to stop monitoring (servers will keep running in their windows)." -ForegroundColor Gray

try {
    while ($true) {
        Start-Sleep -Seconds 1
        if ($backendProcess.HasExited) {
            Write-Host "Backend process has exited." -ForegroundColor Red
            break
        }
    }
} catch {
    Write-Host "Shutting down..." -ForegroundColor Yellow
    if (!$backendProcess.HasExited) {
        Stop-Process -Id $backendProcess.Id -Force
    }
}
