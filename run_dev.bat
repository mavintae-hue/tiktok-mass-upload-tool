@echo off
pushd "%~dp0"

echo ==========================================================
echo    TIKTOK SHOP MASS UPLOAD & IMAGE BRANDING ENGINE
echo ==========================================================
echo.
echo [INFO] Starting Next.js Dev Server...
echo [INFO] App will be accessible via: http://192.168.1.221:3000
echo.
echo [IMPORTANT] Ensure GEMINI_API_KEY is configured in .env.local!
echo.

npm run dev

echo.
echo [DEBUG] Process ended.
pause
