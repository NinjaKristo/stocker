@echo off
setlocal

pushd "%~dp0"

echo Stock Screener local static launcher
echo.
echo This startup path uses read-only public static data:
echo https://xang1234.github.io/stock-screener/static-data/
echo.
echo No paid API keys, database, Redis, Celery, AI provider, or broker connection is required.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not available on PATH.
  echo Install Node.js 18 or newer, then run this launcher again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm is not available on PATH.
  echo Install Node.js 18 or newer, then run this launcher again.
  pause
  exit /b 1
)

if not exist "frontend\node_modules\" (
  echo Installing frontend dependencies...
  pushd "frontend"
  if exist "package-lock.json" (
    call npm ci
  ) else (
    call npm install
  )
  if errorlevel 1 (
    echo.
    echo ERROR: Frontend dependency install failed.
    popd
    pause
    exit /b 1
  )
  popd
)

set VITE_STATIC_SITE=true
set VITE_STATIC_DATA_BASE_URL=https://xang1234.github.io/stock-screener/static-data/

echo Starting local frontend at http://127.0.0.1:5173/
echo Keep this window open while using the app.
echo.

if not "%CJN_NO_OPEN%"=="1" (
  start "" "http://127.0.0.1:5173/"
)
pushd "frontend"
call npm run dev -- --host 127.0.0.1 --port 5173
set LAUNCH_EXIT=%ERRORLEVEL%
popd
popd

if not "%LAUNCH_EXIT%"=="0" (
  echo.
  echo ERROR: Local frontend exited with code %LAUNCH_EXIT%.
  pause
)

exit /b %LAUNCH_EXIT%
