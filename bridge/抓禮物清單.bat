@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo 第一次使用，先安裝需要的套件，請稍等…
  call npm install
)
set /p USER=請輸入一個「正在直播」的 TikTok 帳號（不用加 @）：
node gifts.js %USER%
echo.
pause
