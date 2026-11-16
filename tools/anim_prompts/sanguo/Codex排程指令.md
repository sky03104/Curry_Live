# Codex（ChatGPT 桌面版）每天生圖指令

用 ChatGPT 桌面版的 **Codex**：它直接在你電腦的 repo 資料夾裡讀檔、生圖、存檔、commit，不需要上傳下載。

## 一次性設定
1. 把 repo 抓到你電腦：`git clone https://github.com/sky03104/Curry_Live.git`（已經有就 `git pull`）。
2. Codex 左邊「專案」→ 新增專案 → 選這個 Curry_Live 資料夾（**不要**用你原本的 jiuyao-tianxu 專案，不同專案）。
3. 確認 Codex 的 git 有權限推送（登入 GitHub）。沒有的話，它會只存在你電腦上，你手動 `git push` 即可。

## 每天貼給 Codex 的指令（也可以設成排程／自動化，如果你的 Codex 有這功能）
```
請照 tools/anim_prompts/sanguo/Codex排程指令.md 的「每次執行」做事。
```

## 每次執行（Codex 照這個做）
**目標**：替三國武將生逐格動畫連續圖。**一天只能生 3～4 張圖，額度用完就停。**

1. 切到分支 `anim-inbox`（沒有就從 main 開）：`git checkout -B anim-inbox origin/main`（已存在就 `git checkout anim-inbox && git pull`）。
2. 讀 `tools/anim_prompts/sanguo/隊列.txt`（照順序，一行一個武將代號 heroId）。
3. 看 `tools/anim_prompts/sanguo/inbox/` 資料夾裡已有哪些檔案。檔名是 `<heroId>_<動作>.png`（動作＝attack／skill／idle／walk）。
4. **決定今天要生哪幾張（照這個優先順序，不要跳）**：
   - 第一輪：依隊列順序，每隻武將先補「attack」和「skill」。
   - 第二輪（第一輪全部完成後）：每隻補「idle」。
   - 第三輪：每隻補「walk」。
   - 從隊列最前面「還缺的那一張」開始，依序往後做。
5. 每張圖的做法（一次只生一張）：
   - 打開那隻武將的提示詞檔 `tools/anim_prompts/sanguo/<heroId>.md`。
   - **把參考圖 `assets/heroes/<heroId>.png` 當作附圖（真的附上圖片檔，不要只讀網址）。**
   - 提示詞＝該檔「共用規格」＋該動畫的內容。另外強制加上這幾句：
     「請嚴格照附圖的角色畫（Q 版大頭小身體，不是寫實風），每一格的臉、服裝、顏色、武器都要跟附圖一樣。圖片橫式 3:2。純綠色 #00FF00 背景。不要畫任何文字、編號、標籤、刀光或特效。」
   - 生成一張 8 格（4 欄×2 列）連續圖，存成 `tools/anim_prompts/sanguo/inbox/<heroId>_<動作>.png`。
6. 每張生好先自己檢查：8 格都在、角色沒被切到邊、背景純綠、**角色看起來是附圖那個人（Q 版）**。不合格就重生一次；第二次還是不合格，照存但檔名改成 `<heroId>_<動作>_待檢查.png`。
7. **撞到額度限制時（額度用完、請稍後再試、rate limit 之類）：立刻停，不要重試、不要換方法硬做。**
8. 結束前（不管是做完今天的量還是撞到額度）：
   - 改寫 `tools/anim_prompts/sanguo/inbox/交接.md`，內容用白話寫：日期時間、今天生了哪些檔、下一張要生哪隻哪個動作、有沒有撞到額度（原文錯誤訊息）、有沒有待檢查的。
   - `git add tools/anim_prompts/sanguo/inbox` → `git commit -m "動畫生圖：<日期>"` → `git push -u origin anim-inbox`。
9. 不要改任何其他檔案，不要動 main，不要開 PR。

## 交接怎麼運作
進度＝`inbox/` 資料夾裡有哪些圖檔＋`inbox/交接.md`。Claude 每天晚上 21:17 會 `git fetch` 這個分支檢查，把做好的圖接進遊戲（只推到開發分支，不合併，等你說「開PR合併」）。
