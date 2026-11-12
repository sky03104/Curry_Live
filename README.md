# 萌戰三國・直播亂鬥（Curry_Live）

TikTok 直播互動小遊戲：觀眾留言武將名字上場、送禮互打。純網頁，給 OBS 瀏覽器來源使用。

## 怎麼試玩
直接雙擊 `index.html`，右邊會有「假事件面板」，按按鈕模擬觀眾留言和送禮。

## 給 OBS 用
網址最後加上 `?obs=1`（例如 `index.html?obs=1`），就只剩透明背景的遊戲畫面。

## 接真的 TikTok 直播（用 TikFinity，建議）
遊戲直接跟 TikFinity 電腦版拿留言和送禮，不用另外裝東西。

**第一次要先準備：**
1. 安裝 **TikFinity 電腦版**（Desktop App，不是網頁版），登入並完成它的 Setup，連上你的 TikTok 帳號。

**每次直播前：**
1. 在 TikTok 開始直播，打開 TikFinity 電腦版並確認它已連上直播。
2. OBS 新增「瀏覽器」來源，網址填：
   `https://sky03104.github.io/Curry_Live/?obs=1&tikfinity=1`
   寬高填你直播畫面的大小。
3. 直播期間 TikFinity 不要關。

**怎麼知道有沒有連上：** 畫面左下角出現紅色「🔴 連不到 TikFinity」就是沒連上（TikFinity 沒開，或開的是網頁版）；
連上後不會顯示任何字。想看得到狀態和面板，用瀏覽器開 `https://sky03104.github.io/Curry_Live/?tikfinity=1`。

**TikTok 禮物對應哪個動作：** 在 `js/config.js` 的 `tiktok` 那段，預設照禮物價值分級
（1～4 鑽普攻、5～19 鑽回血、20～99 鑽全場攻擊、100 鑽以上技能），也可以指定禮物名稱。

### 備案：不用 TikFinity，改用本專案的橋接程式
1. 安裝 Node.js（https://nodejs.org 的 LTS 版），把專案整包下載解壓縮。
2. 開播後，雙擊 `bridge` 資料夾裡的 `啟動.bat`，輸入 TikTok 帳號（不用打 @）。
   不輸入直接按 Enter 是示範模式（自動產生假留言和假禮物）。
3. OBS 瀏覽器來源網址填 `http://localhost:8081/?obs=1`。直播期間黑色視窗不要關。

## 想調數值
改 `js/config.js`：禮物對應的動作、傷害、血量、復活秒數都在裡面，有中文說明。

詳細規則與檔案說明見 `CLAUDE.md`。
