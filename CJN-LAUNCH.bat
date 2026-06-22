@echo off
setlocal

pushd "%~dp0"

echo Stock Screener full-stack launcher
echo.
echo This starts the full Docker app: frontend, backend, PostgreSQL, Redis, and workers.
echo Scanner and Backtest run without paid API keys. Assistant/AI features need keys later.
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo ERROR: Docker is not available on PATH.
  echo Install Docker Desktop, start it, then run this launcher again.
  pause
  exit /b 1
)

docker compose version >nul 2>nul
if errorlevel 1 (
  echo ERROR: Docker Compose v2 is not available.
  echo Update Docker Desktop, then run this launcher again.
  pause
  exit /b 1
)

if not exist ".env" (
  echo Creating local Docker .env with no paid API keys...
  > ".env" echo SERVER_AUTH_PASSWORD=stockscanner-local
  >> ".env" echo SERVER_AUTH_SESSION_SECRET=stockscanner-local-session
  >> ".env" echo CORS_ORIGINS=http://localhost,http://localhost:80
  >> ".env" echo FRONTEND_PORT=80
  >> ".env" echo ENABLED_MARKETS=US
  >> ".env" echo POSTGRES_DB=stockscanner
  >> ".env" echo POSTGRES_USER=stockscanner
  >> ".env" echo POSTGRES_PASSWORD=stockscanner
  >> ".env" echo SERVER_AUTH_SECURE_COOKIE=false
  >> ".env" echo SERVER_EXPOSE_API_DOCS=true
  >> ".env" echo STATIC_EXPORT_ENABLED=false
  >> ".env" echo SETUP_ENGINE_ENABLED=true
  >> ".env" echo LLM_DEFAULT_PROVIDER=groq
  >> ".env" echo LLM_FALLBACK_ENABLED=false
  >> ".env" echo GROQ_API_KEY=
  >> ".env" echo GEMINI_API_KEY=
  >> ".env" echo GOOGLE_API_KEY=
  >> ".env" echo MINIMAX_API_KEY=
  >> ".env" echo ZAI_API_KEY=
  >> ".env" echo TAVILY_API_KEY=
  >> ".env" echo SERPER_API_KEY=
  >> ".env" echo ALPHA_VANTAGE_API_KEY=
  >> ".env" echo TWITTER_BEARER_TOKEN=
)

set ENABLED_MARKETS=US
set COMPOSE_PROFILES=market-us

echo Building and starting the full app...
docker compose up -d --build
if errorlevel 1 (
  echo.
  echo ERROR: Docker stack failed to start.
  docker compose ps
  pause
  exit /b 1
)

echo.
echo Waiting for frontend and backend health checks...
docker compose ps
echo.
echo Open: http://localhost
echo Login password: stockscanner-local
echo.
start "" "http://localhost"

popd
pause
