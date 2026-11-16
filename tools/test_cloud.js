// 雲端存檔（Supabase 主要、Firebase 備份）的自動測試：node tools/test_cloud.js
// 不連真的網路：用假的 Supabase（照 supabase/schema.sql 的 live_get / live_put 規則）和假的 Firestore 取代 fetch。
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  ✗ ' + msg); } };

// ---------- 假的雲端 ----------
function makeWorld() {
  const w = { sb: new Map(), fb: new Map(), sbMode: 'ok', fbMode: 'ok', offset: 0, calls: { sb: 0, fb: 0, fbWrite: 0 }, stamp: 1000 };
  const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  w.fetch = async (url, init) => {
    init = init || {};
    if (url.includes('.supabase.co/rest/v1/rpc/')) {
      w.calls.sb++;
      if (w.sbMode === 'down') throw new TypeError('network down');
      if (w.sbMode === 'bad') return res(401, { message: 'Invalid API key' });
      if (w.sbMode === 'nofunc') return res(404, { code: 'PGRST202', message: 'no function' });
      const fn = url.split('/rpc/')[1], a = JSON.parse(init.body), k = a.p_code + '|' + a.p_slot;
      if (fn === 'live_get') { const d = w.sb.get(k); return res(200, a.p_code.length < 16 || !d ? [] : [{ data: d.data, version: d.version, updated_at: 'x' }]); }
      if (fn === 'live_put') {
        if (a.p_code.length < 16 || a.p_code.length > 64) return res(200, { ok: false, reason: 'invalid' });
        const d = w.sb.get(k);
        if (!d) { if (a.p_expected != null && a.p_expected !== 0) return res(200, { ok: false, reason: 'conflict', version: 0 }); w.sb.set(k, { data: a.p_data, version: 1 }); return res(200, { ok: true, version: 1 }); }
        if (a.p_expected != null && a.p_expected !== d.version) return res(200, { ok: false, reason: 'conflict', version: d.version });
        d.data = a.p_data; d.version++; return res(200, { ok: true, version: d.version });
      }
    }
    if (url.includes('firestore.googleapis.com')) {
      w.calls.fb++;
      if (w.fbMode === 'down') throw new TypeError('network down');
      if (w.fbMode === 'denied') return res(403, { error: { status: 'PERMISSION_DENIED', message: 'denied' } });
      if (url.includes(':commit')) {
        w.calls.fbWrite++;
        const wr = JSON.parse(init.body).writes[0], name = wr.update.name, cur = w.fb.get(name), pre = wr.currentDocument;
        if (pre && pre.exists === false && cur) return res(409, { error: { status: 'ALREADY_EXISTS' } });
        if (pre && pre.updateTime && (!cur || cur.updateTime !== pre.updateTime)) return res(409, { error: { status: 'FAILED_PRECONDITION' } });
        const t = 'T' + (++w.stamp); w.fb.set(name, { fields: wr.update.fields, updateTime: t });
        return res(200, { writeResults: [{ updateTime: t }] });
      }
      const m = decodeURIComponent(url.split('?')[0]).match(/documents\/(curryLiveSaves\/.+)$/);
      const d = m && w.fb.get('projects/mengzhan-sanguo/databases/(default)/documents/' + m[1]);
      return d ? res(200, { fields: d.fields, updateTime: d.updateTime }) : res(404, { error: { status: 'NOT_FOUND' } });
    }
    throw new Error('意外的網址 ' + url);
  };
  return w;
}
function loadCloud(world, overrides) {
  const store = {};
  const RealDate = Date;
  class FakeDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + world.offset); } static now() { return RealDate.now() + world.offset; } }
  const sb = { console, Math, Date: FakeDate, URLSearchParams, AbortController, setTimeout, clearTimeout, btoa, JSON, Promise, Uint8Array, String, Number, Array, Map, Object, Error,
    fetch: world.fetch, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
  sb.window = sb; sb.crypto = require('crypto').webcrypto; vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/config.js'), 'utf8'), sb);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/cloud-save.js'), 'utf8'), sb);
  const cfg = sb.GAME_CONFIG; Object.assign(cfg.save.cloud, overrides || {});
  return { ML: sb.ML, config: cfg };
}
const TOKEN = 'abcdefghijklmnopqrstuvwxyz012345';
const mk = (env, slot, canWrite) => env.ML.createCloudSave(env.config, new URLSearchParams('cloud=' + TOKEN), slot || 'main', { canWrite: canWrite !== false });
const P = (id, level, xp, extra) => Object.assign({ id: 'tt:' + id, name: id, level, xp: xp || 0, kills: 0, seen: 1 }, extra || {});
const settle = () => new Promise(r => setTimeout(r, 20));

(async () => {
  // 1. 第一次：兩邊都空 → 存進 Supabase，Firebase 留備份
  { const w = makeWorld(), env = loadCloud(w), c = mk(env);
    ok((await c.load()).length === 0, '全新代號讀到空的');
    const r = await c.store([P('甲', 3, 10)]); await settle();
    ok(r && r.length === 1 && c.status.state === 'ok', '存檔成功');
    const row = w.sb.get(TOKEN + '|main'); ok(row && row.data.profiles[0].level === 3 && row.version === 1, 'Supabase 有資料（version 1）');
    ok(w.fb.size === 1, 'Firebase 同時有一份備份');
    const fb0 = w.calls.fb, c2 = mk(env); const got = await c2.load(); ok(got.length === 1 && got[0].level === 3, '另一個畫面能從 Supabase 讀回');
    ok(w.calls.fb === fb0, '讀取時完全沒碰 Firebase（Supabase 正常）'); }

  // 2. 第一次換過來：Supabase 空、Firebase 有舊存檔 → 自動搬
  { const w = makeWorld(), env = loadCloud(w, { primary: 'firebase' });   // 先用「只有 Firebase」的模式存一份舊資料
    const old = mk(env); await old.load(); await old.store([P('舊', 7, 50)]);
    ok(w.sb.size === 0 && w.fb.size === 1, '（前置）舊存檔只在 Firebase');
    const env2 = loadCloud(w); w.fb = w.fb;   // 同一個假世界，換成 Supabase 主要的設定
    const c = mk(env2); const got = await c.load();
    ok(got.length === 1 && got[0].level === 7, 'Supabase 沒資料時讀到 Firebase 的舊存檔');
    ok(/搬到 Supabase/.test(c.status.text), '狀態寫明下次會搬過去');
    await c.store(got); await settle();
    ok(w.sb.get(TOKEN + '|main') && w.sb.get(TOKEN + '|main').data.profiles[0].level === 7, '存檔後已搬進 Supabase'); }

  // 3. 兩個畫面同時寫：衝突後重新合併，兩邊的觀眾都留著
  { const w = makeWorld(), env = loadCloud(w), a = mk(env), b = mk(env);
    await a.load(); await b.load();
    await a.store([P('甲', 5, 1)]); await settle();
    const r = await b.store([P('乙', 4, 2)]);
    ok(r && r.length === 2, '後寫的被擋下、重讀合併，兩位觀眾都在');
    ok(w.sb.get(TOKEN + '|main').data.profiles.length === 2 && w.sb.get(TOKEN + '|main').version === 2, 'Supabase 版本 2、兩位都有'); }

  // 4. 設定（settings）保留：存進度不會弄丟主播設定
  { const w = makeWorld(), env = loadCloud(w), c = mk(env); await c.load();
    await c.store([P('甲', 2)], { force: true, settings: { host: { id: 'tt:1' } } }); await c.store([P('甲', 3)]); await settle();
    const c2 = mk(env); await c2.load(); ok(c2.settings && c2.settings.host && c2.settings.host.id === 'tt:1', '設定還在'); }

  // 5. Supabase 連不上：改走 Firebase、不當機；恢復後合併回 Supabase
  { const w = makeWorld(), env = loadCloud(w), c = mk(env); await c.load();
    await c.store([P('甲', 2, 5)]); await settle();
    w.sbMode = 'down';
    const r = await c.store([P('甲', 3, 9), P('乙', 4)]); await settle();
    ok(r && r.length === 2, 'Supabase 掛了照樣存得進去（走 Firebase）');
    ok(/Supabase 連不上/.test(c.status.text), '狀態說明改用 Firebase');
    ok(w.sb.get(TOKEN + '|main').data.profiles.length === 1, 'Supabase 那份還是舊的');
    const callsBefore = w.calls.sb; await c.store([P('甲', 3, 9), P('乙', 4), P('丙', 1)]);
    ok(w.calls.sb === callsBefore, '剛連不上的 30 秒內不會再白等 Supabase');
    w.sbMode = 'ok'; w.offset = 60000;   // 過 60 秒，Supabase 也恢復了
    const r2 = await c.store([P('甲', 3, 9), P('乙', 4), P('丙', 1)]); await settle();
    const sbp = w.sb.get(TOKEN + '|main').data.profiles;
    ok(r2 && sbp.length === 3 && sbp.find(p => p.id === 'tt:乙').level === 4, '恢復後 Supabase 補上這段時間的進度（含丙）'); }

  // 6. 連續錯誤：金鑰不對／函式沒建 → 一樣退回 Firebase
  for (const mode of ['bad', 'nofunc']) { const w = makeWorld(); w.sbMode = mode; const env = loadCloud(w), c = mk(env); await c.load();
    const r = await c.store([P('甲', 2)]); ok(r && r.length === 1 && w.fb.size === 1, `Supabase 回「${mode}」時退回 Firebase 存得進去`); }

  // 7. 兩邊都不行 → 存檔失敗但不丟例外
  { const w = makeWorld(); w.sbMode = 'down'; w.fbMode = 'down'; const env = loadCloud(w), c = mk(env);
    let threw = false; try { await c.load(); } catch (e) { threw = true; }
    ok(threw && c.status.state === 'error', '兩邊都掛了：讀取丟友善的錯誤、狀態是 error');
    const r = await c.store([P('甲', 2)]); ok(r === null && c.status.state === 'error', '兩邊都掛了：存檔回 null、不當機'); }

  // 8. Firebase 備份壞了：主要存檔照樣成功，只在狀態多一句警告
  { const w = makeWorld(), env = loadCloud(w), c = mk(env); await c.load(); w.fbMode = 'denied';
    const r = await c.store([P('甲', 2)]); await settle();
    ok(r && w.sb.get(TOKEN + '|main'), 'Firebase 備份失敗不影響 Supabase 存檔');
    ok(c.status.state === 'ok' && c.status.text.includes('Firebase 備份沒成功'), '狀態提醒備份沒成功');
    w.fbMode = 'ok'; await c.store([P('甲', 3)]); await settle(); ok(!c.status.text.includes('備份沒成功'), '備份恢復後警告消失'); }

  // 9. backup:false → 完全不碰 Firebase
  { const w = makeWorld(), env = loadCloud(w, { backup: false }), c = mk(env); await c.load(); await c.store([P('甲', 2)]); await settle();
    await c.sendCommand({ action: 'attack' }); await settle();
    ok(w.calls.fb === 0, 'backup:false 時一次 Firebase 都沒呼叫');
    w.sbMode = 'down'; w.offset = 5000; let threw = false; try { await c.load(); } catch (e) { threw = true; } ok(threw && w.calls.fb === 0, 'backup:false 且 Supabase 掛了：回報錯誤，不偷偷碰 Firebase'); }

  // 10. 主播按鈕指令
  { const w = makeWorld(), env = loadCloud(w), pad = mk(env, 'pad', false), live = mk(env, 'main', true);
    const f0 = await live.fetchCommand(); ok(f0 && f0.seq === 0, '還沒有指令：seq 0');
    const s = await pad.sendCommand({ action: 'attack', count: 3 }); await settle();
    ok(s.ok, '送指令成功');
    const f1 = await live.fetchCommand(); ok(f1 && f1.action === 'attack' && f1.count === 3 && f1.seq > 0, '直播畫面從 Supabase 收到指令');
    const fbBefore = w.calls.fb; await live.fetchCommand(); ok(w.calls.fb === fbBefore, '平常收指令完全不讀 Firebase（不吃 Firebase 額度）');
    ok(w.fb.size === 1, '指令也在 Firebase 留了一份');
    w.sbMode = 'down'; const f2 = await live.fetchCommand(); ok(f2 && f2.action === 'attack', 'Supabase 掛了：改從 Firebase 備份收到同一個指令');
    const s2 = await pad.sendCommand({ action: 'skill' }); await settle(); ok(s2.ok, 'Supabase 掛了：送指令靠 Firebase 備份仍成功');
    const f3 = await live.fetchCommand(); ok(f3 && f3.action === 'skill', '…直播畫面收得到');
    w.fbMode = 'down'; const s3 = await pad.sendCommand({ action: 'heal' }); ok(!s3.ok && s3.text, '兩邊都掛：回報失敗與原因'); }

  // 11. 連線測試
  { const w = makeWorld(), env = loadCloud(w), c = mk(env);
    let t = await c.test(); ok(t.ok && /Supabase（主要）/.test(t.text) && /Firebase 備份也正常/.test(t.text), '測試：兩邊都正常');
    w.sbMode = 'down'; t = await c.test(); ok(!t.ok && /Firebase 備份是正常的/.test(t.text), '測試：Supabase 掛了會說，並告知 Firebase 可以接手');
    w.sbMode = 'ok'; w.fbMode = 'denied'; t = await c.test(); ok(t.ok && /Firebase 備份有問題/.test(t.text), '測試：只有備份壞時主要仍算成功並提醒'); }

  // 12. 只用 Firebase 的舊模式仍然可用
  { const w = makeWorld(), env = loadCloud(w, { primary: 'firebase' }), c = mk(env); await c.load();
    const r = await c.store([P('甲', 2)]); ok(r && w.sb.size === 0 && w.calls.sb === 0 && w.fb.size === 1, "primary:'firebase' 時完全不碰 Supabase");
    const t = await c.test(); ok(t.ok, '舊模式的連線測試正常'); }

  // 13. 面板（canWrite:false）不寫入
  { const w = makeWorld(), env = loadCloud(w), c = mk(env, 'main', false); await c.load(); const r = await c.store([P('甲', 2)]); ok(r === null && w.sb.size === 0, '面板視窗只讀取、不寫入'); }

  console.log(`${pass} 項通過、${fail} 項失敗`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
