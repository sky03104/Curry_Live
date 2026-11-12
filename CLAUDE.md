# CLAUDE.md — 萌戰三國・直播亂鬥（Curry_Live）專案規則

> 線上網址（GitHub Pages，main 合併後自動更新）：https://sky03104.github.io/Curry_Live/ （OBS 用加 `?obs=1`）

> TikTok 直播互動小遊戲。咖哩是保全主管不是工程師：**說明一律用白話、少用術語**。

## 這是什麼
主播把這個網頁掛在 OBS 的「瀏覽器來源」上（透明背景，疊在直播畫面上）。觀眾留言、送禮就能操控畫面上的三國武將互打。

## 玩法規則（已定案）
- 觀眾留言**武將名字**（例如「呂布」）→ 該武將帶著觀眾的名字上場。
- 觀眾**送禮** → 攻擊其他觀眾的武將。不同禮物對應：普攻／全場攻擊／技能／回血。
- 留言「**@對方名字**」鎖定攻擊目標；留言「**解除鎖定**」恢復隨機。
- 血量歸零 → 倒地。**60 秒後**再送禮可滿血復活；倒地期間（60 秒內）送禮不生效。
- 畫面上要有：每隻武將的觀眾名字、血條、傷害排行榜。

### 第一版實作時補上的細節（咖哩沒指定，可調整）
- 一位觀眾同時只有一隻武將。
- **換武將**（2026-11-12 咖哩選定）：已在場上的觀眾隨時可以換，**血量照比例帶過去**（剩三成血換過去也是三成），不能靠換角補血。
  - 留言必須**剛好只有武將名**才算換角（聊天提到「呂布好強」不會被誤換）；第一次上場則是留言裡含武將名就算。
  - 倒地時也能換，但仍是倒地狀態、倒數不重算；累計傷害照舊留在排行榜。
  - 換過後有冷卻秒數（`js/config.js` 的 `switchCooldownSeconds`）。
- 不同觀眾可以選同一隻武將。
- **閒置離場**（2026-11-12 咖哩定案 3 分鐘）：觀眾超過 `idleRemoveSeconds`（180 秒）沒留言也沒送禮，武將自動離場。
  任何留言（不限武將名或指令）和送禮都算有動作。TikTok 不會通知「誰離開直播間」，只能這樣判斷。
  離場後等級與累計傷害保留，再留言武將名可重新上場。
- **等級**（2026-11-12 咖哩要求：擊殺拿經驗、可升級、上限 99、升級加血／攻／防）：
  - 擊倒別人的武將拿經驗值（對手等級越高拿越多），滿了升級，一次可連升。只有擊倒才有經驗。
  - 等級跟著**觀眾**走，不是跟著武將：換武將、倒地、離場再回來都還在。**重新整理網頁會歸零**（沒有存檔）。
  - 升級時血量照比例帶過去，不會補滿。
  - 防禦用 heroes.json 的 `baseArmor`；實際傷害 = 原本傷害 × `defenseFactor` ÷（`defenseFactor` + 對方防禦）。
  - 經驗值公式、每級成長幅度、防禦係數都在 `js/config.js` 的 `leveling` 與 `defenseFactor`。
    這些數字是 Claude 先抓的，**沒經過真人試玩**（加入防禦後把三種攻擊的倍率調高了約三成來抵銷）。
- 復活用的那份禮物只負責復活，不會同時攻擊。
- 鎖定的對象倒地時，那一下改打隨機對象，鎖定本身保留。
- 場上人數上限、倒地太久自動離場的秒數（倒地後有留言但 5 分鐘都沒復活），都在 `js/config.js`。

## 素材與資料：來自 Curry_Games（只讀）
- `sky03104/Curry_Games` 是另一個遊戲「萌戰三國」。**只能讀，不可修改、不可 commit、不可 push。**
- 武將資料以 `Curry_Games/UnityProject/Assets/_Project/Data/heroes.json` 為準（38 隻）。
  中文名、英文 ID、陣營的對應**一律照這個檔，不要自己猜**。
  - 注意：檔案裡陣營的寫法是 `Wei`／`Shu`／`Wu`／`Qun`（群不是寫「群」）。
- 武將圖用**全身圖**：`Curry_Games/UnityProject/Assets/_Project/Resources/HeroPortraitsFullBody2D/`，
  38 張 520x660 透明背景 PNG，檔名是英文 ID。
  - **不要用同層的 `HeroPortraits/`（頭像）**：那套有 14 張是佔位圖、多張拍到後腦勺，咖哩看過說很醜（2026-11-12）。
  - 全身圖是 Git LFS 檔，剛下載只是 130 bytes 的佔位檔，要先在 Curry_Games 目錄執行：
    `git lfs pull --include="UnityProject/Assets/_Project/Resources/HeroPortraitsFullBody2D/*.png"`
- 同步方式：`python3 tools/sync_from_curry_games.py`（需要 Pillow），會重新產生 `data/heroes.js`，
  並把全身圖縮成 312x396 放到 `assets/heroes/`（原圖每張約 0.5MB，縮小後整包約 7MB）。
  `data/heroes.js` 是自動產生的，不要手改。
- **本 repo 不啟用 Git LFS**，武將圖當一般檔案 commit。
- 陣營標示色：魏 `#4A7FA5`、蜀 `#5C9C89`、吳 `#C0872E`、群 `#A5527E`。
- **不可使用任何其他遊戲的名稱、角色圖或素材。**

## 技術規則
- 純網頁（HTML + JS + Canvas），不需要安裝或打包，直接雙擊 `index.html` 就能開。
  因此不用 `import`、不用 `fetch` 讀檔（這兩樣雙擊開啟時會被瀏覽器擋）。
- 透明背景，給 OBS 瀏覽器來源使用；之後用 GitHub Pages 發布。
- **數值不寫死在程式裡**：禮物對應的動作、傷害、血量、復活秒數全部放 `js/config.js`。
- **事件來源是獨立一層**（`js/events.js`）：遊戲只認「留言」「送禮」兩種統一格式的事件，
  不管它是假面板按出來的還是真的 TikTok 傳來的。之後接 TikTok-Live-Connector 的本機 Node 程式時，
  只加新的來源，不改遊戲邏輯。
- **接真的 TikTok：主要走 TikFinity**（2026-11-12 咖哩提供 TikFinity 的 Event API 頁面截圖後定案）。
  TikFinity **電腦版**（Desktop App，網頁版沒有）在本機提供 `ws://localhost:21213/`，
  訊息格式 `{ "event": "chat" | "gift" | "share" | "follow" | "like" | "roomUser" | "subscribe", "data": {...} }`，
  `data` 照 TikTok-Live-Connector 的結構。網址加 `?tikfinity=1` 就會直接連它，不需要 Node.js 也不需要下面的橋接程式。
  - OBS 網址：`https://sky03104.github.io/Curry_Live/?obs=1&tikfinity=1`
  - 轉換程式在 `js/events.js` 的 `createTikFinityReader`（攤平／包在 `user`、`giftDetails`、`gift` 裡的欄位擺法都認）。
  - **⚠️ 只用自製的「假 TikFinity」測過，沒接過真的 TikFinity**；咖哩截圖時 TikFinity 尚未登入完成 Setup。
- **TikTok 禮物設定面板**（2026-11-12 咖哩要求）：面板的「TikTok 禮物設定」可指定哪個 TikTok 禮物觸發哪個動作
  （手打禮物英文名稱，或從「最近收到的 TikTok 禮物」清單直接選），以及沒被指定的禮物要照價值分級還是忽略。
  - 程式在 `js/gift-settings.js`。設定存在瀏覽器裡，**同時寫進「直播用網址」**（`&gifts=attack:Rose;skill:Lion&other=ignore`）：
    直播軟體是另一個瀏覽器、讀不到面板存的設定，所以**每次改設定都要把新網址重貼進直播軟體**。
  - 網址裡有設定時以網址為準；都沒有時用 `js/config.js` 的 `tiktok.giftByName`。
  - 面板的事件紀錄會寫出每份 TikTok 禮物「對應到哪個動作／沒有對應已忽略」，名稱和價值都讀不到時會附上原始資料。
- **2026-11-12 第一次真實開播的結果**：咖哩回報「沒偵測到送禮事件」（留言是否正常未說明）。
  推測原因（**未用真資料證實**）：TikFinity 的禮物資料同時有攤在外層的 `giftName`／`diamondCount` 和一個只放編號的 `gift` 物件，
  舊程式只讀 `gift` 那層，結果名稱和價值都是空的、被當成 0 鑽忽略。已改成每個欄位每一層都找。
- **備案：本機橋接程式**（`bridge/`，2026-11-12）。在主播電腦上執行（需要 Node.js 20 以上），
  用 TikTok-Live-Connector（非官方套件，靠第三方 Euler Stream 服務簽章，免費但有次數限制）連直播，
  把留言／送禮整理成統一格式傳給網頁；同時在 `http://localhost:8081/` 提供遊戲網頁給 OBS 用。
  - 啟動：Windows 雙擊 `bridge/啟動.bat`；或 `cd bridge && npm install && node server.js <TikTok帳號>`。
  - `node server.js --demo` 是示範模式（不連 TikTok，自動產生假事件），用來測整條路有沒有通。
  - 網頁端：從 `localhost:8081` 開會自動連橋接程式；從 GitHub Pages 開要加 `?ws=ws://localhost:8081`。
  - TikTok 禮物 → 遊戲禮物的對應在 `js/config.js` 的 `tiktok`（可指定名稱，否則照鑽石數分級）。
  - 連送（連擊）只算新增的數量，不重複計算。
  - **⚠️ 只用示範模式測過整條路；從沒連上過真的 TikTok 直播**（雲端環境連不到 TikTok）。
    套件 2.5.0 的說明文件與實際型別定義的欄位名稱不一致（`comment`/`content`、`giftDetails`/`gift`、`uniqueId`/`displayId`），
    橋接程式兩種都認；第一次實測若留言或禮物沒反應，用 `node server.js <帳號> --raw` 看原始資料對欄位。
- **畫角色是獨立一層**（`js/hero-sprite.js`）：現在是「全身圖＋程式做的動態」（彈跳、衝撞、閃白、震動），
  之後要換成連續圖動畫只改這個檔。
  - 武將腳下**不畫陣營色圓盤**（2026-11-12 咖哩要求拿掉）；陣營只靠腳下「魏・曹操」那行字的顏色分辨。
- **特效是獨立一層**（`js/effects.js`）：刀光、火花、法陣、落雷、光彈、光柱、地裂、集氣，全部用程式畫、不用圖檔。
  `js/render.js` 決定何時何地放，`js/effects.js` 決定長什麼樣。
  - 技能演出依兵種分四種（對應表在 `js/config.js` 的 `troops`）：猛將＝重擊地裂、謀士＝法陣落雷、遊俠＝光彈、統帥＝光環＋光柱。
  - 特效顏色跟著武將的陣營色。38 隻沒有各自專屬的特效，只差技能名文字。
- **待機走動**（2026-11-12 咖哩要求）：武將待機時在場上隨機走動，不再固定站格子。
  會挑空曠的地方走、互相靠太近會推開、不會走出畫面或走到排行榜底下；倒地、出招、挨打時站定。
  速度、停留秒數、開關都在 `js/config.js` 的 `wander`（`enabled: false` 就回到固定站格子）。
- **左右轉身**（2026-11-12 咖哩要求）：往左走面向左、往右走面向右，出招時轉身面向對手。做法是把全身圖左右翻面。
  程式假設原圖都面向左；原圖其實面向右的武將要列在 `js/config.js` 的 `artFacesRight`
  （目前只列了太史慈，是 Claude 看圖判斷的，**其餘 37 隻沒有逐隻跟咖哩確認過**，發現倒退走的就加進去）。
- 遊戲規則（`js/game.js`）不碰畫面；畫面（`js/render.js`）不改規則。

## 檔案地圖
| 檔案 | 做什麼 |
|---|---|
| `index.html` | 入口。直接開＝帶假事件面板的試玩模式；網址加 `?obs=1`＝只有透明遊戲畫面（給 OBS） |
| `js/config.js` | **設定檔**：禮物、傷害、血量、復活秒數、顏色 |
| `data/heroes.js` | 38 隻武將資料（自動產生） |
| `assets/heroes/` | 38 張武將全身圖（已縮小） |
| `js/events.js` | 事件來源層（假面板／之後的 TikTok） |
| `js/gift-settings.js` | TikTok 禮物 → 動作的設定（存在瀏覽器與直播用網址裡） |
| `js/game.js` | 遊戲規則：上場、攻擊、鎖定、倒地、復活、排行榜 |
| `js/hero-sprite.js` | 畫角色層 |
| `js/effects.js` | 特效層：每種特效長什麼樣子 |
| `js/render.js` | 畫面：排位、動態效果、血條、排行榜 |
| `js/panel.js` | 假事件面板（試玩用） |
| `js/main.js` | 把以上接起來 |
| `bridge/server.js` | TikTok 橋接程式（在主播電腦上跑，不是網頁的一部分） |
| `bridge/啟動.bat` | Windows 一鍵啟動橋接程式 |
| `tools/make_roster.js` | 產生武將名冊圖片（發給觀眾看有哪些武將可選），輸出到 `roster/` |
| `roster/` | 武將名冊圖片：全武將長圖一張＋魏蜀吳群各一張。武將資料或圖有變就重跑 `node tools/make_roster.js` |
| `tools/sync_from_curry_games.py` | 從 Curry_Games 同步資料與全身圖 |

## 工作方式
- 分支開發，**不直接推 main**；要合併走 PR（咖哩開口才開 PR）。
- 改完要用瀏覽器實際跑過（上場、攻擊、鎖定、倒地、復活）並截圖，回報時**誠實區分「測過」與「沒測過」**。

## 還沒做（第一版範圍外）
- 用真的 TikFinity 電腦版實測 `?tikfinity=1`（目前只用假的 TikFinity 測過）。
- 橋接程式用真的 TikTok 直播實測（目前只跑過示範模式）；`bridge/啟動.bat` 也沒在真的 Windows 上跑過。
- 簡體字武將名（例如「吕布」）目前不會認得；`js/config.js` 的 `heroAliases` 可以手動加別名。
- 連續圖動畫（武將自己揮刀、後仰的逐格動作）：現在只有整張圖傾斜／衝撞／擊退。
  萌戰三國有 3D 動作檔，但要先在有 Unity 或 Blender 的電腦上轉成連續圖片才能用，雲端環境做不了。
- 音效。
