@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if exist "HRM-app\HRM-Desktop.exe" (
  start "" "%~dp0HRM-app\HRM-Desktop.exe"
  exit /b 0
)

echo HRM-app\HRM-Desktop.exe 가 없습니다.
echo 프로젝트 폴더에서 SETUP.bat 을 실행하거나:  npm run pack
pause
exit /b 1
