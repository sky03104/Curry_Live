// ============================================================
// 萌戰三國・直播亂鬥 —— TikTok 橋接程式（在主播自己的電腦上執行）
//
// 它做三件事：
//   1. 連上指定帳號的 TikTok 直播，收留言和送禮
//   2. 把它們整理成遊戲看得懂的統一格式，傳給遊戲網頁
//   3. 順便在本機提供遊戲網頁（http://localhost:8081），給 OBS 直接用
//
// 用法：
//   node server.js <TikTok帳號>      例如  node server.js curry_live
//   node server.js --demo            不連 TikTok，自動產生假留言和假禮物（測試用）
//   加上 --raw 會把收到的原始資料印出來（對不上欄位時除錯用）
// ============================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 8081;
const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const DEMO = args.includes('--demo');
const RAW = args.includes('--raw');
const username = (args.find(a => !a.startsWith('--')) || '').replace(/^@/, '');

// ---------- 把 TikTok 的資料整理成遊戲的統一格式 ----------
// TikTok 套件不同版本的欄位名稱不一樣，這裡新舊兩種都認。
function toUser(u) {
  if (!u) return null;
  const id = String(u.userId || u.id || u.uniqueId || u.displayId || '');
  const name = u.nickname || u.uniqueId || u.displayId || '';
  return id && name ? { id: 'tt:' + id, name } : null;
}

export function mapChat(data) {
  const user = toUser(data.user);
  const text = data.comment ?? data.content ?? '';
  return user && text ? { type: 'chat', user, text } : null;
}

// 連送（連擊）的處理：TikTok 在連送期間會一直重複通知「目前累計送了幾個」，
// 結束時再通知一次。這裡只把「比上次多出來的數量」傳給遊戲，才不會重複計算。
const streaks = new Map();
export function mapGift(data) {
  const user = toUser(data.user);
  if (!user) return null;
  // 每個欄位都要「每一層都找一遍」（見 js/events.js 同一段的說明）
  const layers = [data, data.giftDetails, data.gift, data.extendedGiftInfo].filter(x => x && typeof x === 'object');
  const pick = (...keys) => { for (const o of layers) for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]; };
  const giftId = String(pick('giftId', 'gift_id', 'id') || '');
  const total = Number(pick('repeatCount', 'repeat_count')) || 1;
  let count = total;
  if (Number(pick('giftType', 'gift_type', 'type')) === 1) {
    const key = `${user.id}|${giftId}|${data.groupId || ''}`;
    const ended = pick('repeatEnd', 'repeat_end');
    count = total - (streaks.get(key) || 0);
    if (ended && ended !== '0') streaks.delete(key); else streaks.set(key, total);
    if (streaks.size > 5000) streaks.clear();
  }
  if (count <= 0) return null;
  return { type: 'gift', user, count,
    tiktokGift: { id: giftId, name: String(pick('giftName', 'name') || ''), diamonds: Number(pick('diamondCount', 'diamond_count')) || 0 } };
}

// ---------- 本機網頁 + 傳事件給網頁的通道 ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8' };

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(SITE_ROOT, rel);
  // 只提供遊戲網頁本身的檔案，不給資料夾外面的、也不給這支程式的資料夾
  const inside = file.startsWith(SITE_ROOT + path.sep) && !file.startsWith(path.join(SITE_ROOT, 'bridge')) && !rel.includes('/.');
  if (!inside || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
});
const wss = new WebSocketServer({ server });
let status = { type: 'status', connected: false, text: '尚未連線' };

function broadcast(msg) {
  const text = JSON.stringify(msg);
  for (const client of wss.clients) if (client.readyState === 1) client.send(text);
}
function setStatus(connected, text) {
  status = { type: 'status', connected, text };
  console.log((connected ? '✅ ' : '⚠️  ') + text);
  broadcast(status);
}
function send(ev) {
  if (!ev) return;
  console.log(ev.type === 'chat' ? `💬 ${ev.user.name}：${ev.text}`
    : `🎁 ${ev.user.name} 送出 ${ev.tiktokGift.name || ev.tiktokGift.id}（${ev.tiktokGift.diamonds} 鑽）×${ev.count}`);
  broadcast(ev);
}
wss.on('connection', client => client.send(JSON.stringify(status)));

// ---------- 事件來源：真的 TikTok，或示範模式 ----------
async function startTikTok() {
  const { TikTokLiveConnection, WebcastEvent, ControlEvent } = await import('tiktok-live-connector');
  const options = process.env.EULER_API_KEY ? { signApiKey: process.env.EULER_API_KEY } : {};
  let retryTimer = null;

  async function connect() {
    retryTimer = null;
    const conn = new TikTokLiveConnection(username, options);
    const retry = (why) => {
      setStatus(false, `${why}，30 秒後自動重試`);
      if (!retryTimer) retryTimer = setTimeout(connect, 30000);
    };
    conn.on(WebcastEvent.CHAT, data => { if (RAW) console.log('[原始留言]', JSON.stringify(data).slice(0, 600)); send(mapChat(data)); });
    conn.on(WebcastEvent.GIFT, data => { if (RAW) console.log('[原始禮物]', JSON.stringify(data).slice(0, 900)); send(mapGift(data)); });
    conn.on(WebcastEvent.STREAM_END, () => retry('直播已結束'));
    conn.on(ControlEvent.DISCONNECTED, () => retry('與 TikTok 的連線中斷'));
    conn.on(ControlEvent.ERROR, err => console.log('⚠️  TikTok 回報錯誤：', err?.info || err?.message || err));
    try {
      const state = await conn.connect();
      setStatus(true, `已連上 @${username} 的直播（房間 ${state.roomId}）`);
    } catch (err) {
      const offline = err?.name === 'UserOfflineError' || /offline|not.*live/i.test(String(err?.message));
      retry(offline ? `@${username} 目前沒有在直播` : `連不上 TikTok（${err?.message || err}）`);
    }
  }
  connect();
}

function startDemo() {
  setStatus(true, '示範模式：自動產生假留言和假禮物（沒有連 TikTok）');
  const names = ['示範小明', '示範阿華', '示範美玲', '示範大雄', '示範志豪'];
  const heroes = ['呂布', '關羽', '貂蟬', '曹操', '諸葛亮', '馬超', '周瑜'];
  const gifts = [{ id: '5655', name: 'Rose', diamondCount: 1, type: 1 }, { id: '5487', name: 'Finger Heart', diamondCount: 5, type: 1 },
                 { id: '5658', name: 'Perfume', diamondCount: 20, type: 2 }, { id: '6064', name: 'GG', diamondCount: 100, type: 2 }];
  const pick = list => list[Math.floor(Math.random() * list.length)];
  let n = 0;
  setInterval(() => {
    const i = Math.floor(Math.random() * names.length);
    // 故意新舊兩種欄位格式輪流用，確保兩種都能被正確整理
    const user = n % 2 ? { id: String(1000 + i), nickname: names[i], displayId: 'demo' + i }
                       : { userId: String(1000 + i), nickname: names[i], uniqueId: 'demo' + i };
    if (n < names.length * 2 || Math.random() < 0.25) {
      const text = Math.random() < 0.15 ? '@' + pick(names) : pick(heroes);
      send(mapChat(n % 2 ? { user, content: text } : { user, comment: text }));
    } else {
      const g = pick(gifts);
      const base = { user, giftId: g.id, repeatCount: 1, repeatEnd: g.type === 1 ? 0 : 1, groupId: 'g' + n };
      const data = n % 2 ? { ...base, gift: g } : { ...base, giftDetails: { giftName: g.name, giftType: g.type, diamondCount: g.diamondCount } };
      send(mapGift(data));
      if (g.type === 1) send(mapGift({ ...data, repeatEnd: 1 }));   // 連送結束的那次通知，不應該被重複計算
    }
    n++;
  }, 900);
}

if (!DEMO && !username) {
  console.log('請在後面加上 TikTok 帳號，例如：node server.js curry_live\n或用示範模式：node server.js --demo');
  process.exit(1);
}
server.on('error', err => {
  console.log(err.code === 'EADDRINUSE' ? `❌ ${PORT} 這個連接埠已經被占用，可能是這支程式已經開著一份了。` : '❌ ' + err.message);
  process.exit(1);
});
server.listen(PORT, '127.0.0.1', () => {   // 只開給這台電腦自己用，外面連不進來
  console.log('──────────────────────────────────────────');
  console.log(' 萌戰三國・直播亂鬥  橋接程式已啟動');
  console.log(` 試玩網址（有面板）：http://localhost:${PORT}/`);
  console.log(` OBS 用的網址      ：http://localhost:${PORT}/?obs=1`);
  console.log(' 要結束請按 Ctrl + C，或直接關掉這個視窗');
  console.log('──────────────────────────────────────────');
  DEMO ? startDemo() : startTikTok();
});
