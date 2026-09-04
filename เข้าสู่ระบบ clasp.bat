@echo off
REM ==== STT CLAIM - clasp login helper (ASCII only) ====
cd /d "%~dp0deploy"
echo ============================================
echo   STT CLAIM - Login to clasp (Google)
echo ============================================
echo A browser window will open.
echo Sign in with sasipa@suteetankers.com  (the account that
echo owns the script), then click ALLOW on every screen.
echo.
call clasp login
echo.
if errorlevel 1 (
  echo *** Login FAILED. Try again or check internet.
) else (
  echo Login OK. Now double-click  UPDATE  bat again to deploy v0.3.0
)
echo.
pause
