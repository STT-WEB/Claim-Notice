@echo off
cd /d "%~dp0"
echo ============================================
echo    STT CLAIM - FIRST TIME SETUP
echo    (already done once - keep for reference)
echo ============================================
echo.
echo This project is ALREADY set up:
echo   Apps Script id : 139gkd7Mph1nYIgyhe79tpNISsUlhuOjox7TcYOFAQHTtOKgxwRWBbOlR
echo   Web address    : https://script.google.com/macros/s/AKfycbyps-WDVmA_FkR76GQlL_wvEsVIL3j2ZTmamQGZMjjhM4CWYQAjhvNcfEioYbB_AsVVww/exec
echo.
echo To update the system from now on, double-click the UPDATE bat file.
echo.
echo If you really need to connect GitHub again, this will do it:
echo.
pause
git config user.name  "Beer"
git config user.email "sasipa@suteetankers.com"
git remote remove origin 2>nul
git remote add origin https://github.com/STT-WEB/Claim-Notice.git
git add -A
git commit -m "STT CLAIM - setup"
git branch -M master
git push -u origin master
echo.
pause
exit /b 0
