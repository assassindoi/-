@echo off
setlocal
pushd "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Please install Node.js LTS from https://nodejs.org/ and try again.
  pause
  exit /b 1
)
echo Preparing tone. Please wait...
call npm.cmd ci
if errorlevel 1 (
  echo Setup failed. Please share a screenshot of this window.
  pause
  exit /b 1
)
echo Starting tone. Keep this window open while using the app.
echo If port 5173 is in use, close the previous tone window and try again.
call npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort --open
pause
popd
