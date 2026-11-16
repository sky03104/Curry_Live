// 一次抓下 TikTok 的整份禮物清單（名稱、鑽石數、圖片網址），存成 gifts.json，再貼到控制面板「禮物對應」的匯入框。
// 用法（在這個資料夾，要先 npm install；Windows 可雙擊 抓禮物清單.bat）：
//   node gifts.js <TikTok帳號>          抓清單存成 gifts.json
//   node gifts.js <TikTok帳號> --raw    另外印出第一筆的原始資料（圖片沒抓到時，用來對欄位名稱）
// ⚠️ 需要那個帳號「正在直播」（取得房間編號才抓得到清單）；任何正在直播的帳號都可以，不一定是你自己。
// ⚠️ 這支沒用真的 TikTok 測過（雲端環境連不到 TikTok），整理格式的部分用假資料測過（tools/test_gifts.js）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapGiftList } from './gift-catalog.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), RAW = args.includes('--raw');
const username = (args.find(a => !a.startsWith('--')) || '').replace(/^@/, '');
if (!username) { console.log('用法：node gifts.js <TikTok帳號> [--raw]\n（需要那個帳號正在直播）'); process.exit(1); }

try {
  const { TikTokLiveConnection } = await import('tiktok-live-connector');
  const conn = new TikTokLiveConnection(username, process.env.EULER_API_KEY ? { signApiKey: process.env.EULER_API_KEY } : {});
  console.log(`正在向 TikTok 要 @${username} 直播間的禮物清單…`);
  await conn.fetchRoomId();
  const raw = await conn.fetchAvailableGifts();
  const list = mapGiftList(raw);
  if (RAW) console.log('[第一筆原始資料]', JSON.stringify(Array.isArray(raw) ? raw[0] : (raw && raw.gifts ? raw.gifts[0] : raw), null, 1)?.slice(0, 1500));
  if (!list.length) { console.log('⚠️ 沒有讀到任何禮物。加 --raw 重跑，把印出來的資料貼給 Claude。'); process.exit(2); }
  const withIcon = list.filter(g => g.icon).length;
  const out = path.join(here, 'gifts.json');
  fs.writeFileSync(out, JSON.stringify({ from: '@' + username, fetchedAt: new Date().toISOString(), gifts: list }, null, 1));
  fs.writeFileSync(path.join(here, 'gifts.txt'), list.map(g => `${g.name} ${g.diamonds}`).join('\n'));
  console.log(`✔ 讀到 ${list.length} 個禮物，其中 ${withIcon} 個有圖片網址。\n  已存成：${out}\n  （另有 gifts.txt：只有「名稱 鑽石數」，圖片抓不到時可以退而求其次貼這個）\n  下一步：打開 gifts.json，全選複製，貼到控制面板「禮物對應」→「貼上 TikFinity 的禮物清單」→ 匯入。`);
  if (withIcon === 0) console.log('⚠️ 圖片網址一個都沒抓到。加 --raw 重跑，把印出來的第一筆原始資料貼給 Claude，我再對欄位名稱。');
} catch (err) {
  const msg = String(err?.message || err);
  console.log('⚠️ 失敗：' + msg);
  if (/offline|not.*live|room/i.test(msg)) console.log('   可能是 @' + username + ' 目前沒有在直播，換一個正在直播的帳號試試。');
  process.exit(3);
}
