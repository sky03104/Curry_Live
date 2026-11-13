import { test } from 'node:test';
import fs from 'node:fs';
// 跑法：cd firebase/test && npm install && npx firebase-tools emulators:exec --only firestore --project mengzhan-sanguo-rules-test "npm test"
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';

let env;
test.before(async () => { env = await initializeTestEnvironment({ projectId: 'mengzhan-sanguo-rules-test',
  firestore: { rules: fs.readFileSync('../firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } }); });
test.after(async () => { await env.cleanup(); });
test.beforeEach(async () => { await env.clearFirestore(); });

const TOKEN = 'Abc123_-xyzABC123_-xyzABC123_-xy';           // 32 字
const good = (extra) => ({ v: 1, data: JSON.stringify({ profiles: [] }), savedAt: Date.now(), ...extra });
const slotRef = (db, tok = TOKEN, slot = 'default') => doc(db, `curryLiveSaves/${tok}/slots/${slot}`);
const anon = () => env.unauthenticatedContext().firestore();

test('不用登入：可以建立、讀取、更新自己的存檔', async () => {
  await assertSucceeds(setDoc(slotRef(anon()), good()));
  await assertSucceeds(getDoc(slotRef(anon())));
  await assertSucceeds(setDoc(slotRef(anon()), good({ savedAt: Date.now() + 1 })));
});
test('讀一份還不存在的存檔也可以（第一次開啟時會這樣）', async () => { await assertSucceeds(getDoc(slotRef(anon()))); });
test('不能列出清單（不能用掃描找別人的存檔）', async () => {
  await assertSucceeds(setDoc(slotRef(anon()), good()));
  await assertFails(getDocs(collection(anon(), `curryLiveSaves/${TOKEN}/slots`)));
});
test('不能刪除', async () => {
  await assertSucceeds(setDoc(slotRef(anon()), good()));
  await assertFails(deleteDoc(slotRef(anon())));
});
test('代號太短（23 字）或太長（65 字）都被拒絕', async () => {
  for (const tok of ['a'.repeat(23), 'a'.repeat(65)]) {
    await assertFails(getDoc(slotRef(anon(), tok)));
    await assertFails(setDoc(slotRef(anon(), tok), good()));
  }
  await assertSucceeds(setDoc(slotRef(anon(), 'a'.repeat(24)), good()));
  await assertSucceeds(setDoc(slotRef(anon(), 'a'.repeat(64)), good()));
});
test('內容限制：多餘欄位、v 不是 1、data 不是字串、savedAt 不是整數，都被拒絕', async () => {
  await assertFails(setDoc(slotRef(anon()), good({ extra: 'x' })));
  await assertFails(setDoc(slotRef(anon()), good({ v: 2 })));
  await assertFails(setDoc(slotRef(anon()), good({ data: { profiles: [] } })));
  await assertFails(setDoc(slotRef(anon()), good({ savedAt: 'now' })));
  await assertFails(setDoc(slotRef(anon()), good({ savedAt: 1.5 })));
  const { v, data } = good(); await assertFails(setDoc(slotRef(anon()), { v, data }));
});
test('大小限制：300000 字可以、300001 字被拒絕', async () => {
  await assertSucceeds(setDoc(slotRef(anon()), good({ data: 'x'.repeat(300000) })));
  await assertFails(setDoc(slotRef(anon()), good({ data: 'x'.repeat(300001) })));
});
test('存檔名稱最長 80 字', async () => {
  await assertSucceeds(setDoc(slotRef(anon(), TOKEN, 's'.repeat(80)), good()));
  await assertFails(setDoc(slotRef(anon(), TOKEN, 's'.repeat(81)), good()));
});
test('中文存檔名稱、「連線測試」這份都可以用', async () => {
  await assertSucceeds(setDoc(slotRef(anon(), TOKEN, '第二季'), good()));
  await assertSucceeds(setDoc(slotRef(anon(), TOKEN, '連線測試'), good()));
});
test('不同代號互相看不到：沒有代號就沒有任何路徑可讀', async () => {
  await assertFails(getDoc(doc(anon(), `curryLiveSaves/${TOKEN}`)));          // 代號那一層本身不開放
  await assertFails(getDocs(collection(anon(), 'curryLiveSaves')));            // 不能列出所有代號
});
test('不影響別的集合：萌戰三國的 playerProfiles 對未登入仍然全部拒絕', async () => {
  await assertFails(getDoc(doc(anon(), 'playerProfiles/someone')));
  await assertFails(setDoc(doc(anon(), 'playerProfiles/someone'), { nickname: 'x' }));
  await assertFails(setDoc(doc(anon(), 'other/thing'), { a: 1 }));
});
