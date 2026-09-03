@echo off
cd /d "%~dp0"
echo ============================================
echo    STT CLAIM - Update System
echo ============================================
echo.

echo [1/4] Syntax check + guard tests (never push broken code)...
node "_tests\syntax-check.js"
if errorlevel 1 goto SYNTAXFAIL
node "_tests\guard-v0100.js"
if errorlevel 1 goto SYNTAXFAIL
echo.

echo [2/4] Backup (git local + GitHub)...
git config user.name  "Beer"
git config user.email "sasipa@suteetankers.com"
git add -A
git commit -m "update %date% %time%"
git push origin master
if errorlevel 1 echo *** WARNING: git push failed - code is safe locally
echo.

echo [3/4] Upload code (clasp push)...
cd deploy
call clasp push -f
if errorlevel 1 goto PUSHFAIL
echo.

echo [4/4] Publish to the SAME web address...
call clasp deploy -i AKfycbyps-WDVmA_FkR76GQlL_wvEsVIL3j2ZTmamQGZMjjhM4CWYQAjhvNcfEioYbB_AsVVww -d "auto update"
if errorlevel 1 goto DEPLOYFAIL
echo.
echo ============================================
echo    DONE! Code uploaded + published.
echo    Web address stays the SAME every time:
echo.
echo    https://script.google.com/macros/s/AKfycbyps-WDVmA_FkR76GQlL_wvEsVIL3j2ZTmamQGZMjjhM4CWYQAjhvNcfEioYbB_AsVVww/exec
echo.
echo    NEXT: close all app tabs, open fresh, press Ctrl+Shift+R,
echo          then CHECK THE VERSION BADGE went UP.
echo ============================================
echo.
pause
exit /b 0

:SYNTAXFAIL
echo.
echo *** TEST FAILED - nothing was uploaded. Read the error above.
echo *** This check exists so broken code can never reach the live system.
pause
exit /b 1

:PUSHFAIL
echo.
echo *** ERROR: clasp push FAILED - code was NOT uploaded.
echo *** Common cause = clasp login expired. Run:  clasp login
pause
exit /b 1

:DEPLOYFAIL
echo.
echo *** ERROR: clasp deploy FAILED - code IS uploaded but not published.
pause
exit /b 1
