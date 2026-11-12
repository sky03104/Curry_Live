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

**設定哪個禮物對應哪個動作：**
1. 在開播的電腦用瀏覽器開 `https://sky03104.github.io/Curry_Live/?tikfinity=1`（有面板的版本）。
2. 面板的「TikTok 禮物設定」：打禮物的英文名稱（照 TikFinity 的 Gift Browser）選動作按「加入」；
   或等觀眾送禮後，從「最近收到的 TikTok 禮物」直接選。
3. 按「直播用網址」旁的「複製」，貼到直播軟體的連結／瀏覽器來源。**每次改設定都要重貼。**

沒被指定的禮物，預設照價值分級（1～4 鑽普攻、5～19 鑽回血、20～99 鑽全場攻擊、100 鑽以上技能），也可以改成忽略。

**送禮沒反應時：** 開上面有面板的網址，看最下面的「事件紀錄」。有出現「📦 TikTok 禮物：…」代表有收到，
後面會寫它對應到哪個動作或為什麼被忽略；完全沒出現代表 TikFinity 沒把禮物傳過來。

### 備案：不用 TikFinity，改用本專案的橋接程式
1. 安裝 Node.js（https://nodejs.org 的 LTS 版），把專案整包下載解壓縮。
2. 開播後，雙擊 `bridge` 資料夾裡的 `啟動.bat`，輸入 TikTok 帳號（不用打 @）。
   不輸入直接按 Enter 是示範模式（自動產生假留言和假禮物）。
3. OBS 瀏覽器來源網址填 `http://localhost:8081/?obs=1`。直播期間黑色視窗不要關。

## 想調數值
改 `js/config.js`：禮物對應的動作、傷害、血量、復活秒數都在裡面，有中文說明。

詳細規則與檔案說明見 `CLAUDE.md`。
