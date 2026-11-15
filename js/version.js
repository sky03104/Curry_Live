// 目前的版本號。每次有更新要上線，就跑 python3 tools/bump_version.py（會同時改這個檔和 version.json）。
// 直播畫面會定時去讀 version.json，發現跟自己不一樣就自動更新（見 js/updater.js）。
window.APP_VERSION = '2026-11-15.10';
