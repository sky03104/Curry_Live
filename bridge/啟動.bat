@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 萌戰三國・直播亂鬥 橋接程式

where node >nul 2>nul
if errorlevel 1 (
  echo 這台電腦還沒有安裝 Node.js。
  echo 請到 https://nodejs.org 下載「LTS」版本安裝，裝好後再重新執行這個檔案。
  pause
  exit /b
)

if not exist node_modules (
  echo 第一次執行，正在下載需要的元件，請稍等一兩分鐘...
  call npm install
  if errorlevel 1 (
    echo 下載失敗，請確認網路正常後再試一次。
    pause
    exit /b
  )
)

set /p ACCOUNT=請輸入要連線的 TikTok 帳號（不用打 @，直接按 Enter 則進入示範模式）：
if "%ACCOUNT%"=="" (
  node server.js --demo
) else (
  node server.js %ACCOUNT%
)
pause
