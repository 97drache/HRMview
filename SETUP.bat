@echo off
setlocal EnableExtensions
cd /d "%~dp0"
where npm >nul 2>&1
if errorlevel 1 (
  if exist "%ProgramFiles%\nodejs\npm.cmd" set "PATH=%ProgramFiles%\nodejs;%PATH%"
)
where npm >nul 2>&1
if errorlevel 1 (
  echo npm 을 찾을 수 없습니다. Node.js LTS 를 설치한 뒤 이 배치를 다시 실행하세요.
  echo https://nodejs.org
  pause
  exit /b 1
)
call npm run setup
if errorlevel 1 (
  echo.
  echo SETUP failed. See messages above.
  pause
  exit /b 1
)
echo.
echo OK. Double-click:  HRM-app\HRM-Desktop.exe
pause
