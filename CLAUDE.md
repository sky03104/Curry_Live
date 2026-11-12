# CLAUDE.md — 萌戰三國・直播亂鬥（Curry_Live）專案規則

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
- 一位觀眾同時只有一隻武將；已經在場上時再留言別的武將名**不會換角**（避免用換角來補血）。
- 不同觀眾可以選同一隻武將。
- 復活用的那份禮物只負責復活，不會同時攻擊。
- 鎖定的對象倒地時，那一下改打隨機對象，鎖定本身保留。
- 場上人數上限、倒地太久自動離場的秒數，都在 `js/config.js`。

## 素材與資料：來自 Curry_Games（只讀）
- `sky03104/Curry_Games` 是另一個遊戲「萌戰三國」。**只能讀，不可修改、不可 commit、不可 push。**
- 武將資料以 `Curry_Games/UnityProject/Assets/_Project/Data/heroes.json` 為準（38 隻）。
  中文名、英文 ID、陣營的對應**一律照這個檔，不要自己猜**。
  - 注意：檔案裡陣營的寫法是 `Wei`／`Shu`／`Wu`／`Qun`（群不是寫「群」）。
- 頭像在 `Curry_Games/UnityProject/Assets/_Project/Resources/HeroPortraits/`，檔名是英文 ID。
  它們是 Git LFS 檔，剛下載只是 130 bytes 的佔位檔，要先在 Curry_Games 目錄執行：
  `git lfs pull --include="UnityProject/Assets/_Project/Resources/HeroPortraits/*.png"`
- 同步方式：`node tools/sync-from-curry-games.js`，會重新產生 `data/heroes.js` 並複製頭像到 `assets/heroes/`。
  `data/heroes.js` 是自動產生的，不要手改。
- **本 repo 不啟用 Git LFS**，頭像當一般檔案 commit。
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
- **畫角色是獨立一層**（`js/hero-sprite.js`）：現在是「頭像＋程式做的動態」（彈跳、衝撞、閃白、震動），
  之後要換成連續圖動畫只改這個檔。
- 遊戲規則（`js/game.js`）不碰畫面；畫面（`js/render.js`）不改規則。

## 檔案地圖
| 檔案 | 做什麼 |
|---|---|
| `index.html` | 入口。直接開＝帶假事件面板的試玩模式；網址加 `?obs=1`＝只有透明遊戲畫面（給 OBS） |
| `js/config.js` | **設定檔**：禮物、傷害、血量、復活秒數、顏色 |
| `data/heroes.js` | 38 隻武將資料（自動產生） |
| `assets/heroes/` | 38 張武將頭像 |
| `js/events.js` | 事件來源層（假面板／之後的 TikTok） |
| `js/game.js` | 遊戲規則：上場、攻擊、鎖定、倒地、復活、排行榜 |
| `js/hero-sprite.js` | 畫角色層 |
| `js/render.js` | 畫面：排位、動態效果、血條、排行榜 |
| `js/panel.js` | 假事件面板（試玩用） |
| `js/main.js` | 把以上接起來 |
| `tools/sync-from-curry-games.js` | 從 Curry_Games 同步資料與頭像 |

## 工作方式
- 分支開發，**不直接推 main**；要合併走 PR（咖哩開口才開 PR）。
- 改完要用瀏覽器實際跑過（上場、攻擊、鎖定、倒地、復活）並截圖，回報時**誠實區分「測過」與「沒測過」**。

## 還沒做（第一版範圍外）
- 接真的 TikTok（TikTok-Live-Connector 本機 Node 程式）。`js/events.js` 已留一個接本機程式的接口，但**從未實測**。
- 真實 TikTok 禮物名稱與 `js/config.js` 禮物的對應表。
- 簡體字武將名（例如「吕布」）目前不會認得；`js/config.js` 的 `heroAliases` 可以手動加別名。
- 連續圖動畫、音效。
