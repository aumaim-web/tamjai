// db.js — ชั้นข้อมูล: คุยกับ Firebase (Authentication + Firestore) โดยตรงจากเบราว์เซอร์
// dbApi('/api/...') รับเส้นทางและคืนข้อมูลรูปแบบเดิมที่หน้าจอใช้ จึงไม่ต้องแก้แต่ละหน้า
// สิทธิ์จริงถูกบังคับที่ firestore.rules (โค้ดตรวจสิทธิ์ในไฟล์นี้มีไว้ให้ข้อความ error อ่านง่ายเท่านั้น)
//
// โครงสร้างข้อมูล:
//   users/{uid}         username, role (owner|finance|stock|kitchen|customer), display_name, email
//   customers/{id}      name, phone, points, seq              (สมาชิกสะสมแต้ม ไม่ใช่บัญชีล็อกอิน)
//   employees/{id}      name, role, phone, start_date, seq
//   stock/{id}          name, unit, qty, min_qty, seq
//   menu/{id}           name, category, price, recipe {stockId: ปริมาณ}, soldout?, seq
//   tables/{id}         name, seq                              (โต๊ะ — QR ของโต๊ะ = ?table=ชื่อโต๊ะ)
//   orders/{เลขออเดอร์}   created_at, customer_id, table_no, status, items [{m, q, p, note?}], ticket?, cust_email?,
//                       cancel_request? {by, role, reason, at}, cancel_reason?, cancelled_by?
//   payments/{เลขบิล}    seq, order_id, customer_id, amount, method, status, paid_at, ticket?
//   meta/counters       orders, payments  (เลขล่าสุดที่ใช้ไป)
//   guestOrders/{id}    items [{m, q, note?}], table, created_at, email?   (ออเดอร์ที่ลูกค้าส่งเอง รอฝ่ายรับออเดอร์/แคชเชียร์รับ; id = รหัสคิว)
//   track/{ticket}      status, order, table, paid, total, items, reason?  (ให้ลูกค้าติดตามออเดอร์ด้วยรหัสคิว)
//   audit/{id}          at, uid, name, role, action, target, detail        (บันทึกการใช้งาน เขียนอย่างเดียว)
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth(), fs = firebase.firestore();
const FV = firebase.firestore.FieldValue;
if (USE_EMULATOR) { auth.useEmulator('http://127.0.0.1:9099'); fs.useEmulator('127.0.0.1', 8080); }

const SESSION_MS = 12 * 3600e3;            // เข้าสู่ระบบค้างไว้ได้ 12 ชั่วโมง
const POINT_PER_BAHT = 25;                 // 1 แต้มทุก 25 บาท
const CASHIER = ['owner', 'finance'];      // ขายหน้าร้าน/รับเงินได้
const STAFF = ['owner', 'finance', 'stock', 'kitchen'];
const TAKERS = ['owner', 'finance', 'kitchen']; // รับออเดอร์ที่ลูกค้าส่งเข้ามาได้ (kitchen = ฝ่ายรับออเดอร์/ครัว)

let ME = null;     // ผู้ใช้ที่ล็อกอินอยู่ { id, username, role, name } หรือ null = ลูกค้า
let TOKEN = null;  // true เมื่อล็อกอินอยู่ (หน้าจอใช้ดูว่าล็อกอินหรือยัง)

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };
const col = name => fs.collection(name);
const str = (v, max = 100) => String(v ?? '').trim().slice(0, max);
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };
const round3 = n => Math.round(n * 1000) / 1000;
const validId = id => /^[\w-]{1,40}$/.test(String(id));
const docs = async q => (await q.get()).docs.map(d => ({ id: d.id, ...d.data() }));

function need(...roles) {
  if (!ME) fail(401, 'กรุณาเข้าสู่ระบบก่อน');
  if (!roles.includes(ME.role)) fail(403, 'บัญชีนี้ไม่มีสิทธิ์ใช้ส่วนนี้');
}

// ───────────── บันทึกการใช้งาน (Audit Log) ─────────────
// เวลาใช้เวลาของเซิร์ฟเวอร์ (กฎฐานข้อมูลบังคับ) ผู้ใช้แก้/ลบย้อนหลังไม่ได้
const auditData = (action, target, detail) => ({
  at: FV.serverTimestamp(), uid: ME.id, name: ME.name, role: ME.role,
  action: str(action, 60), target: str(target, 100), detail: str(detail, 300),
});
const auditTx = (tx, action, target, detail) => tx.set(col('audit').doc(), auditData(action, target, detail));
const audit = (action, target, detail) => ME && STAFF.includes(ME.role)
  ? col('audit').add(auditData(action, target, detail)).catch(() => {}) : Promise.resolve();

// ───────────── เข้าสู่ระบบ ─────────────
async function loadProfile(u) {
  const d = await col('users').doc(u.uid).get();
  if (!d.exists) return null;
  const x = d.data();
  return { id: u.uid, username: x.username, role: x.role, name: x.display_name };
}

let loggingIn = false;
const LOGIN_KEY = 'tamjai-login-at';
const authReady = new Promise(resolve => {
  setTimeout(resolve, 8000); // กันค้าง: ถ้า Firebase Auth ไม่ตอบใน 8 วินาที ให้เปิดหน้าเป็นลูกค้าก่อน
  // เรียกครั้งแรกตอนเปิดหน้า (กู้การล็อกอินเดิม) และทุกครั้งที่สถานะเปลี่ยน
  auth.onAuthStateChanged(async u => {
    if (loggingIn) return; // ให้ขั้นตอนล็อกอินจัดการเอง
    try {
      ME = null; TOKEN = null;
      if (u) {
        let at = 0; try { at = +localStorage.getItem(LOGIN_KEY) || 0; } catch (e) {}
        if (at && Date.now() - at > SESSION_MS) await auth.signOut();
        else { ME = await loadProfile(u); if (ME) TOKEN = true; else await auth.signOut(); }
      }
    } catch (e) { ME = null; TOKEN = null; }
    resolve();
  });
});

// ───────────── ข้อมูลสำหรับแสดงผล ─────────────
const loadMenu = async () => (await docs(col('menu').orderBy('seq'))).map(m => ({
  id: m.id, name: m.name, cat: m.category, price: m.price, r: m.recipe || {}, soldout: !!m.soldout, // สูตร {stockId: ปริมาณ}
  img: m.image || '', // รูปเมนู: path ของรูปในเว็บ (img/menu/…) หรือรูปที่เจ้าของร้านอัปโหลด (data URL ย่อแล้ว)
}));
const loadTables = async () => (await docs(col('tables').orderBy('seq'))).map(t => ({ id: t.id, name: t.name }));
const loadStock = async () => (await docs(col('stock').orderBy('seq')))
  .map(s => ({ id: s.id, name: s.name, unit: s.unit, qty: s.qty, min: s.min_qty }));
const loadCustomers = async () => (await docs(col('customers').orderBy('seq')))
  .map(c => ({ id: c.id, name: c.name, phone: c.phone, points: c.points }));
const loadEmployees = async () => (await docs(col('employees').orderBy('seq')))
  .map(e => ({ id: e.id, name: e.name, role: e.role, phone: e.phone, start: e.start_date }));
const loadOrders = async () => (await docs(col('orders').orderBy('created_at'))).map(o => ({
  id: '#' + o.id, time: o.created_at, cust: o.customer_id, table: o.table_no || '', items: o.items || [], status: o.status,
  email: o.cust_email || '', // อีเมลของลูกค้าที่ล็อกอินแล้วสั่งเอง
  cancelReq: o.cancel_request || null, cancelReason: o.cancel_reason || '', cancelledBy: o.cancelled_by || '',
}));
const loadPayments = async () => (await docs(col('payments').orderBy('seq'))).map(p => ({
  id: p.id, order: '#' + p.order_id, time: p.paid_at, amount: p.amount, method: p.method, status: p.status,
}));

// ───────────── ออเดอร์ ─────────────
// เพิ่มแต้มให้ลูกค้าสมาชิกเมื่อชำระเงิน (ลูกค้าทั่วไป c0 ไม่ได้แต้ม) — เรียกภายใน transaction
function addPoints(tx, customerId, total) {
  if (customerId !== 'c0') tx.update(col('customers').doc(customerId), { points: FV.increment(Math.floor(total / POINT_PER_BAHT)) });
}

// อัปเดตสถานะที่ลูกค้าติดตามอยู่ (ถ้าออเดอร์นี้มีรหัสคิว) — เรียกภายใน transaction
const trackSet = (tx, ticket, patch) => {
  if (ticket) tx.set(col('track').doc(ticket), { ...patch, updated_at: Date.now() }, { merge: true });
};

// รวมเมนูซ้ำ + ตรวจจำนวน → { รหัสเมนู: { q, note } }
function mergeItems(items) {
  if (!Array.isArray(items) || !items.length) fail(400, 'ยังไม่มีรายการอาหาร');
  if (items.length > 30) fail(400, 'รายการมากเกินไป');
  const merged = {};
  for (const it of items) {
    const qty = num(it?.q);
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) fail(400, 'จำนวนต่อรายการต้องอยู่ระหว่าง 1–50');
    const mid = str(it.m, 20);
    if (!validId(mid)) fail(400, 'ไม่พบเมนู ' + mid);
    const note = str(it.note, 100);
    const x = merged[mid] ||= { q: 0, notes: [] };
    x.q += qty;
    if (note && !x.notes.includes(note)) x.notes.push(note);
  }
  for (const x of Object.values(merged)) { x.note = x.notes.join(' / ').slice(0, 100); delete x.notes; }
  return merged;
}

// สร้างออเดอร์: ตรวจสต็อก → ตัดสต็อก → บันทึกออเดอร์ + บิล (transaction เดียว ถ้าพังจะไม่บันทึกอะไรเลย)
// queueRef = ออเดอร์ของลูกค้าที่รออยู่ใน guestOrders จะถูกลบในจังหวะเดียวกัน (กันรับซ้ำ), ticket = รหัสคิวของลูกค้า
async function createOrder({ items, customerId, table, payNow, method, queueRef, email, ticket }) {
  const merged = mergeItems(items);
  const mids = Object.keys(merged);
  return fs.runTransaction(async tx => {
    // Firestore: ต้องอ่านให้ครบก่อนเริ่มเขียน
    const counterRef = col('meta').doc('counters');
    const [queued, counter, cust, ...menus] = await Promise.all([
      queueRef ? tx.get(queueRef) : null, tx.get(counterRef), tx.get(col('customers').doc(customerId)),
      ...mids.map(id => tx.get(col('menu').doc(id)))]);
    if (queueRef && !queued.exists) return null; // มีคนรับไปแล้ว
    if (!cust.exists) fail(400, 'ไม่พบลูกค้า');

    // ราคาใช้จากฐานข้อมูล ไม่เชื่อราคาจากหน้าจอ / คำนวณวัตถุดิบที่ต้องใช้
    const needAmt = {};
    const lines = menus.map((m, i) => {
      if (!m.exists) fail(400, 'ไม่พบเมนู ' + mids[i]);
      const d = m.data();
      if (d.soldout) fail(409, `${d.name} หมดชั่วคราว`);
      const { q, note } = merged[m.id];
      for (const [sid, amt] of Object.entries(d.recipe || {})) needAmt[sid] = (needAmt[sid] || 0) + amt * q;
      return { m: m.id, q, p: d.price, ...(note ? { note } : {}) };
    });

    // ตรวจว่าวัตถุดิบพอ แล้วตัดสต็อก
    const sids = Object.keys(needAmt);
    const stocks = await Promise.all(sids.map(id => tx.get(col('stock').doc(id))));
    stocks.forEach(s => {
      if (!s.exists || s.data().qty < needAmt[s.id] - 1e-9) fail(409, `วัตถุดิบไม่พอ: ${s.exists ? s.data().name : s.id}`);
    });
    stocks.forEach(s => tx.update(s.ref, { qty: round3(s.data().qty - needAmt[s.id]) }));

    // ออกเลขออเดอร์และเลขบิลใหม่
    const c = counter.data() || {};
    const id = (c.orders || 0) + 1, pid = (c.payments || 0) + 1;
    tx.set(counterRef, { orders: id, payments: pid }, { merge: true });

    // บันทึกออเดอร์ (พร้อมรายการ) และบิล
    const now = Date.now();
    const total = lines.reduce((a, l) => a + l.p * l.q, 0);
    tx.set(col('orders').doc(String(id)), {
      created_at: now, customer_id: customerId, table_no: table, status: 'cooking', items: lines,
      ...(email ? { cust_email: email } : {}), ...(ticket ? { ticket } : {}),
    });
    tx.set(col('payments').doc(String(pid)), {
      seq: pid, order_id: id, customer_id: customerId, amount: total,
      method: payNow ? method : null, status: payNow ? 'paid' : 'pending', paid_at: payNow ? now : null,
      ...(ticket ? { ticket } : {}),
    });
    if (payNow) addPoints(tx, customerId, total);
    if (queueRef) tx.delete(queueRef);
    trackSet(tx, ticket, {
      status: 'cooking', order: '#' + id, table, paid: !!payNow, total,
      items: lines.map(l => ({ m: l.m, q: l.q, ...(l.note ? { note: l.note } : {}) })),
    });
    auditTx(tx, queueRef ? 'รับออเดอร์ลูกค้า' : 'สร้างออเดอร์', '#' + id,
      `โต๊ะ ${table || '-'} ยอด ${total} บาท${payNow ? ' รับเงินแล้ว (' + method + ')' : ''}${email ? ' · ' + email : ''}`);
    return { id: '#' + id, total, paid: !!payNow };
  });
}

// รับออเดอร์ที่ลูกค้าส่งเข้ามา (ทำโดยฝ่ายรับออเดอร์หรือแคชเชียร์) — คืนข้อความแจ้งเตือนของออเดอร์ที่รับไม่ได้
async function processGuestOrders() {
  const notes = [];
  const snap = await col('guestOrders').orderBy('created_at').get();
  for (const d of snap.docs) {
    const g = d.data();
    try {
      await createOrder({
        items: g.items, customerId: 'c0', table: str(g.table, 20), payNow: false, queueRef: d.ref,
        email: str(g.email, 100), ticket: d.id,
      });
    } catch (e) {
      if (!e.status) throw e; // ปัญหาเครือข่าย ฯลฯ — ไว้ลองใหม่รอบหน้า
      notes.push(`ออเดอร์ลูกค้า${g.email ? ' ' + g.email : ''}${g.table ? ' โต๊ะ ' + g.table : ''} รับไม่ได้: ${e.message}`);
      // บอกลูกค้าที่ติดตามอยู่ว่ารับไม่ได้เพราะอะไร แล้วเอาออกจากคิว
      await col('track').doc(d.id).set({ status: 'rejected', reason: e.message, updated_at: Date.now() }, { merge: true }).catch(() => {});
      await d.ref.delete().catch(() => {});
    }
  }
  return notes;
}

// ───────────── แจ้งเตือนแบบ Real-time (เฉพาะพนักงาน) ─────────────
// ฟังเฉพาะข้อมูลชุดเล็ก (ออเดอร์ที่กำลังทำ, บิลค้าง, คิวลูกค้า, คำขอยกเลิก) ไม่ฟังออเดอร์ทั้งหมด จะได้ไม่เปลืองการอ่านฐานข้อมูล
// onChange() = มีอะไรเปลี่ยนจากเครื่องอื่น ให้โหลดหน้าใหม่ · onNew(kind, id, data) = มีออเดอร์/คำขอใหม่
let unwatchers = [];
function stopLive() { unwatchers.forEach(u => u()); unwatchers = []; }
function watchLive(onChange, onNew) {
  stopLive();
  if (!ME || !STAFF.includes(ME.role)) return;
  const sub = (q, { initialNotify, kind } = {}) => {
    let first = true;
    unwatchers.push(q.onSnapshot(s => {
      if (s.metadata.hasPendingWrites) return; // การเปลี่ยนแปลงจากเครื่องนี้เอง ไม่ต้องโหลดซ้ำ
      if (first) { first = false; if (initialNotify && !s.empty) onChange(); return; }
      const ch = s.docChanges();
      if (!ch.length) return;
      onChange();
      if (kind) ch.filter(c => c.type === 'added').forEach(c => onNew && onNew(kind, c.doc.id, c.doc.data()));
    }, () => {}));
  };
  sub(col('orders').where('status', '==', 'cooking'), { kind: 'order' });
  if (ME.role !== 'kitchen') sub(col('payments').where('status', '==', 'pending')); // ฝ่ายรับออเดอร์ไม่เห็นบิล
  if (TAKERS.includes(ME.role)) sub(col('guestOrders'), { initialNotify: true });
  if (CASHIER.includes(ME.role)) sub(col('orders').where('cancel_request', '!=', null), { kind: 'cancel' });
}
// ลูกค้าติดตามออเดอร์ตามรหัสคิว — คืนฟังก์ชันหยุดฟัง
function watchTrack(ticket, cb) {
  return col('track').doc(ticket).onSnapshot(s => cb(s.exists ? s.data() : null), () => cb(null));
}

const orderNo = p => {
  const n = parseInt(String(p).replace('#', ''), 10);
  if (!n) fail(400, 'เลขที่ออเดอร์ไม่ถูกต้อง');
  return n;
};

// ยกเลิกออเดอร์ (เจ้าของร้านเท่านั้น หรือเมื่ออนุมัติคำขอ): ได้เฉพาะที่ยังไม่ชำระ คืนวัตถุดิบเข้าสต็อก และบันทึกเหตุผล
async function cancelOrder(id, reason, by) {
  const payRefs = (await col('payments').where('order_id', '==', id).get()).docs.map(d => d.ref);
  return fs.runTransaction(async tx => {
    const oRef = col('orders').doc(String(id));
    const [o, ...pays] = await Promise.all([tx.get(oRef), ...payRefs.map(r => tx.get(r))]);
    if (!o.exists) fail(404, 'ไม่พบออเดอร์');
    if (o.data().status === 'cancelled') fail(409, 'ออเดอร์นี้ถูกยกเลิกไปแล้ว');
    if (pays.some(p => p.exists && p.data().status === 'paid')) fail(409, 'ออเดอร์ที่ชำระแล้วยกเลิกไม่ได้');

    // คำนวณวัตถุดิบที่ต้องคืนจากสูตรปัจจุบัน
    const items = o.data().items || [];
    const mids = [...new Set(items.map(i => i.m))];
    const menus = await Promise.all(mids.map(m => tx.get(col('menu').doc(m))));
    const back = {};
    menus.filter(m => m.exists).forEach(m => {
      const rec = m.data().recipe || {};
      items.filter(i => i.m === m.id).forEach(i => {
        for (const [sid, amt] of Object.entries(rec)) back[sid] = (back[sid] || 0) + amt * i.q;
      });
    });
    const stocks = await Promise.all(Object.keys(back).map(s => tx.get(col('stock').doc(s))));

    stocks.filter(s => s.exists).forEach(s => tx.update(s.ref, { qty: round3(s.data().qty + back[s.id]) }));
    pays.filter(p => p.exists).forEach(p => tx.delete(p.ref));
    tx.update(oRef, { status: 'cancelled', cancel_reason: reason, cancelled_by: by, cancel_request: FV.delete() });
    trackSet(tx, o.data().ticket, { status: 'cancelled', reason });
    auditTx(tx, 'ยกเลิกออเดอร์', '#' + id, `เหตุผล: ${reason} · โดย ${by}`);
  });
}

// ฝ่ายการเงินขอยกเลิก → รอเจ้าของร้านอนุมัติ
async function requestCancel(id, reason) {
  const payRefs = (await col('payments').where('order_id', '==', id).get()).docs.map(d => d.ref);
  return fs.runTransaction(async tx => {
    const oRef = col('orders').doc(String(id));
    const [o, ...pays] = await Promise.all([tx.get(oRef), ...payRefs.map(r => tx.get(r))]);
    if (!o.exists) fail(404, 'ไม่พบออเดอร์');
    if (o.data().status === 'cancelled') fail(409, 'ออเดอร์นี้ถูกยกเลิกไปแล้ว');
    if (pays.some(p => p.exists && p.data().status === 'paid')) fail(409, 'ออเดอร์ที่ชำระแล้วยกเลิกไม่ได้');
    if (o.data().cancel_request) fail(409, 'ออเดอร์นี้ขอยกเลิกไปแล้ว รอเจ้าของร้านอนุมัติ');
    tx.update(oRef, { cancel_request: { by: ME.name, role: ME.role, reason, at: Date.now() } });
    auditTx(tx, 'ขอยกเลิกออเดอร์', '#' + id, `เหตุผล: ${reason}`);
  });
}

// ───────────── รับชำระเงิน ─────────────
// ชำระหลายบิลในครั้งเดียว (ปิดบิลโต๊ะ) หรือบิลเดียว — เพิ่มแต้ม อัปเดตสถานะที่ลูกค้าติดตาม และบันทึก Audit Log
function payBills(ids, method) {
  return fs.runTransaction(async tx => {
    const found = await Promise.all(ids.map(id => tx.get(col('payments').doc(id))));
    found.forEach(d => {
      if (!d.exists) fail(404, 'ไม่พบบิล');
      if (d.data().status === 'paid') fail(409, 'บิลนี้ชำระแล้ว');
    });
    const now = Date.now(), pts = {};
    let total = 0;
    found.forEach(d => {
      const p = d.data();
      total += p.amount;
      pts[p.customer_id] = (pts[p.customer_id] || 0) + p.amount;
      tx.update(d.ref, { status: 'paid', method, paid_at: now });
      trackSet(tx, p.ticket, { paid: true });
      auditTx(tx, 'รับชำระเงิน', `บิล ${d.id} (ออเดอร์ #${p.order_id})`, `${p.amount} บาท · ${method}`);
    });
    Object.entries(pts).forEach(([cid, amt]) => addPoints(tx, cid, amt));
    return { id: ids[0], amount: total, total, count: ids.length, method };
  });
}

// ───────────── รีเซ็ตเป็นข้อมูลตัวอย่าง ─────────────
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// เขียน/ลบเป็นชุด ชุดละไม่เกิน 400 รายการ ([ref, ข้อมูล] — ข้อมูลเป็น null = ลบ)
async function commitOps(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = fs.batch();
    ops.slice(i, i + 400).forEach(([ref, data]) => data === null ? b.delete(ref) : b.set(ref, data));
    await b.commit();
  }
}

// สร้างโต๊ะเริ่มต้น 1..n
const tableOps = n => Array.from({ length: n }, (_, i) => [col('tables').doc('t' + (i + 1)), { name: String(i + 1), seq: i + 1 }]);

// สร้างข้อมูลตัวอย่าง: โต๊ะ ลูกค้า พนักงาน สต็อก เมนู และออเดอร์ย้อนหลัง 7 วัน
function seedOps() {
  const r = rng(1012);
  const ops = tableOps(12), points = {};
  const put = (name, id, data) => ops.push([col(name).doc(String(id)), data]);
  SEED.employees.forEach(([id, name, role, phone, start], i) => put('employees', id, { name, role, phone, start_date: start, seq: i }));
  SEED.stock.forEach(([id, name, unit, qty, min], i) => put('stock', id, { name, unit, qty, min_qty: min, seq: i }));
  SEED.menu.forEach(([id, name, category, price, recipe, image], i) => put('menu', id, { name, category, price, recipe, ...(image ? { image } : {}), seq: i }));

  let next = 1001, pid = 0;
  const now = new Date();
  for (let d = 6; d >= 0; d--) {
    const day = new Date(now); day.setDate(now.getDate() - d); day.setHours(0, 0, 0, 0);
    const times = [];
    if (d > 0) {
      const n = 20 + Math.floor(r() * 14);
      for (let i = 0; i < n; i++) { const t = new Date(day); t.setHours(10 + Math.floor(r() * 11), Math.floor(r() * 60)); times.push(+t); }
    } else {
      const span = now - day;
      const n = Math.max(4, Math.min(16, Math.floor(span / 3600000 * 1.5)));
      for (let i = 0; i < n; i++) times.push(Math.round(+day + span * (i + .5) / n));
    }
    times.sort((a, b) => a - b);
    times.forEach((t, i) => {
      const items = [];
      const k = 1 + Math.floor(r() * 4);
      for (let j = 0; j < k; j++) {
        const m = SEED.menu[Math.floor(r() * SEED.menu.length)];
        const ex = items.find(x => x.m === m[0]);
        ex ? ex.q++ : items.push({ m: m[0], q: 1 + (r() < .2 ? 1 : 0), p: m[3] });
      }
      const cust = r() < .6 ? 'c0' : 'c' + (1 + Math.floor(r() * 6));
      const recent = d === 0 && i >= times.length - 4;
      const status = recent ? (i >= times.length - 2 ? 'cooking' : 'served') : (r() < .03 ? 'cancelled' : 'served');
      const id = next++;
      put('orders', id, { created_at: t, customer_id: cust, table_no: String(1 + Math.floor(r() * 12)), status, items });
      if (status !== 'cancelled') {
        const total = items.reduce((a, x) => a + x.p * x.q, 0);
        const paid = !recent;
        const method = paid ? METHODS[r() < .45 ? 0 : r() < .85 ? 1 : 2] : null;
        pid++;
        put('payments', pid, {
          seq: pid, order_id: id, customer_id: cust, amount: total, method,
          status: paid ? 'paid' : 'pending', paid_at: paid ? t + 20 * 60000 : null,
        });
        if (paid && cust !== 'c0') points[cust] = (points[cust] || 0) + Math.floor(total / POINT_PER_BAHT);
      }
    });
  }
  SEED.customers.forEach(([id, name, phone], i) => put('customers', id, { name, phone, points: points[id] || 0, seq: i }));
  put('meta', 'counters', { orders: next - 1, payments: pid });
  return ops;
}

// ล้างข้อมูลร้าน (ไม่ลบบัญชีผู้ใช้และ Audit Log) แล้วใส่ข้อมูลตัวอย่างใหม่
// หมายเหตุ: ทำเป็นหลายชุดต่อเนื่อง ไม่ใช่ transaction เดียว ถ้าล้มกลางทางให้กดรีเซ็ตซ้ำ
async function resetShop() {
  const del = [];
  for (const name of ['payments', 'orders', 'menu', 'stock', 'customers', 'employees', 'meta', 'guestOrders', 'tables', 'track']) {
    (await col(name).get()).docs.forEach(d => del.push([d.ref, null]));
  }
  await commitOps(del);
  await commitOps(seedOps());
}

// ───────────── รายงาน ─────────────
// อ่าน ?from=&to= (ค่าเริ่มต้น 7 วันล่าสุด) แล้วคืนช่วงเวลาเป็น ms
function dateRange(query) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const to = re.test(query.to) ? query.to : dkey(Date.now());
  let from = query.from;
  if (!re.test(from)) { const d = new Date(to + 'T00:00'); d.setDate(d.getDate() - 6); from = dkey(d); }
  if (from > to) fail(400, 'วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด');
  const start = +new Date(from + 'T00:00');
  const end = +new Date(to + 'T00:00') + 86400000; // ไม่รวมเวลานี้
  return { from, to, start, end };
}

// ───────────── เส้นทาง (เหมือน API เดิม) ─────────────
const ROUTES = [];
const route = (method, pattern, fn) => ROUTES.push({ method, re: new RegExp('^' + pattern.replace(/:\w+/g, '([^/]+)') + '$'), fn });
const missing = msg => e => { if (e.code === 'not-found') fail(404, msg); throw e; };

// อีเมลพนักงานลงท้ายด้วย EMAIL_DOMAIN — ลูกค้าใช้โดเมนนี้สมัครเองไม่ได้
const isStaffEmail = email => email.endsWith(EMAIL_DOMAIN);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const netMsg = 'เชื่อมต่อฐานข้อมูลไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่';

// บัญชีลูกค้า: โปรไฟล์ role = customer (กฎฐานข้อมูลอนุญาตให้สร้างได้เฉพาะ role นี้เท่านั้น)
async function createCustomerProfile(user, name) {
  const email = String(user.email || '').toLowerCase();
  const display_name = str(name, 60) || email.split('@')[0];
  await col('users').doc(user.uid).set({ username: email, role: 'customer', display_name, email });
  return { id: user.uid, username: email, role: 'customer', name: display_name };
}

// เข้าสู่ระบบ: พนักงานพิมพ์ owner หรืออีเมลเต็มก็ได้ ลูกค้าพิมพ์อีเมลที่สมัครไว้
route('POST', '/api/login', async ({ body }) => {
  const bad = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  const raw = str(body.email ?? body.username, 100).toLowerCase();
  const email = raw.includes('@') ? raw : raw + EMAIL_DOMAIN;
  if (!EMAIL_RE.test(email) || (!raw.includes('@') && !validId(raw)) || !body.password) fail(401, bad);
  loggingIn = true;
  try {
    let cred;
    try { cred = await auth.signInWithEmailAndPassword(email, String(body.password)); }
    catch (e) {
      if (e.code === 'auth/network-request-failed') fail(503, netMsg);
      if (e.code === 'auth/too-many-requests') fail(429, 'ลองผิดหลายครั้งเกินไป รอสักครู่แล้วลองใหม่');
      fail(401, bad);
    }
    let p = await loadProfile(cred.user);
    if (!p && !isStaffEmail(email)) p = await createCustomerProfile(cred.user); // สมัครค้างไว้/สร้างจากที่อื่น
    if (!p) { await auth.signOut(); fail(401, bad); }
    try { localStorage.setItem(LOGIN_KEY, String(Date.now())); } catch (e) {}
    ME = p; TOKEN = true;
    await audit('เข้าสู่ระบบ', p.username, '');
    return { token: 'firebase', user: { username: p.username, role: p.role, name: p.name } };
  } finally { loggingIn = false; }
});

// สมัครสมาชิกลูกค้า: อีเมลอะไรก็ได้ (ไม่ต้องยืนยันอีเมล) รหัสผ่านอย่างน้อย 6 ตัว
route('POST', '/api/signup', async ({ body }) => {
  const email = str(body.email, 100).toLowerCase(), password = String(body.password ?? '');
  if (!EMAIL_RE.test(email)) fail(400, 'อีเมลไม่ถูกต้อง');
  if (isStaffEmail(email)) fail(400, 'อีเมลนี้สงวนไว้สำหรับพนักงาน กรุณาใช้อีเมลอื่น');
  if (password.length < 6) fail(400, 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร');
  loggingIn = true;
  try {
    let cred;
    try { cred = await auth.createUserWithEmailAndPassword(email, password); }
    catch (e) {
      if (e.code === 'auth/email-already-in-use') fail(409, 'อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน');
      if (e.code === 'auth/invalid-email') fail(400, 'อีเมลไม่ถูกต้อง');
      if (e.code === 'auth/weak-password') fail(400, 'รหัสผ่านง่ายเกินไป');
      if (e.code === 'auth/operation-not-allowed') fail(403, 'ระบบยังไม่เปิดให้สมัครสมาชิก');
      if (e.code === 'auth/network-request-failed') fail(503, netMsg);
      throw e;
    }
    const p = await createCustomerProfile(cred.user, body.name);
    try { localStorage.setItem(LOGIN_KEY, String(Date.now())); } catch (e) {}
    ME = p; TOKEN = true;
    return { token: 'firebase', user: { username: p.username, role: p.role, name: p.name } };
  } finally { loggingIn = false; }
});

route('POST', '/api/logout', async () => {
  stopLive();
  await audit('ออกจากระบบ', ME?.username, '');
  ME = null; TOKEN = null;
  try { localStorage.removeItem(LOGIN_KEY); } catch (e) {}
  await auth.signOut();
  return { ok: true };
});

route('GET', '/api/me', async () => { need(...STAFF); return { user: ME }; });

// ข้อมูลทั้งหมดที่หน้าจอต้องใช้ในครั้งเดียว — ลูกค้า (ไม่ล็อกอิน/ล็อกอินเป็นลูกค้า) ได้เฉพาะเมนู โต๊ะ และจำนวนคงเหลือ
route('GET', '/api/state', async () => {
  if (!ME || ME.role === 'customer') {
    const [menu, tables, stock] = await Promise.all([loadMenu(), loadTables(), loadStock()]);
    return { ...(ME ? { user: ME } : {}), menu, tables, stock: stock.map(s => ({ id: s.id, qty: s.qty, min: s.min })) };
  }
  const notes = TAKERS.includes(ME.role) ? await processGuestOrders() : []; // รับออเดอร์ลูกค้าก่อนโหลด
  if (ME.role === 'kitchen') { // ฝ่ายรับออเดอร์: เห็นเมนู โต๊ะ สต็อก และออเดอร์ — ไม่เห็นข้อมูลลูกค้า บิล และเงิน
    const [menu, tables, stock, orders] = await Promise.all([loadMenu(), loadTables(), loadStock(), loadOrders()]);
    return { user: ME, notes, menu, tables, stock, orders };
  }
  const [menu, tables, stock, customers, employees, orders, payments] = await Promise.all([
    loadMenu(), loadTables(), loadStock(), loadCustomers(), ME.role === 'owner' ? loadEmployees() : [], loadOrders(), loadPayments()]);
  return { user: ME, notes, menu, tables, stock, customers, employees, orders, payments };
});

route('POST', '/api/reset', async () => { need('owner'); await resetShop(); await audit('รีเซ็ตข้อมูลร้านเป็นข้อมูลตัวอย่าง', '', ''); return { ok: true }; });

// ── ลูกค้า (สมาชิกสะสมแต้ม) ──
function validCustomer(b = {}) {
  const name = str(b.name), phone = str(b.phone, 20);
  if (!name) fail(400, 'กรุณาใส่ชื่อลูกค้า');
  if (!/^[0-9-+ ]{9,15}$/.test(phone)) fail(400, 'เบอร์โทรไม่ถูกต้อง');
  return { name, phone };
}
route('POST', '/api/customers', async ({ body }) => {
  need(...CASHIER);
  const c = validCustomer(body), id = uid('c');
  await col('customers').doc(id).set({ ...c, points: 0, seq: Date.now() });
  await audit('เพิ่มลูกค้าสมาชิก', c.name, '');
  return { id, ...c, points: 0 };
});
route('PUT', '/api/customers/:id', async ({ params: [id], body }) => {
  need(...CASHIER);
  if (id === 'c0') fail(400, 'แก้ไขลูกค้าทั่วไปไม่ได้');
  const c = validCustomer(body);
  if (!validId(id)) fail(404, 'ไม่พบลูกค้า');
  await col('customers').doc(id).update(c).catch(missing('ไม่พบลูกค้า'));
  await audit('แก้ไขลูกค้าสมาชิก', c.name, '');
  return { id, ...c };
});

// ── พนักงาน ──
function validEmployee(b = {}) {
  const e = { name: str(b.name), role: str(b.role, 50), phone: str(b.phone, 20), start: str(b.start, 10) };
  if (!e.name) fail(400, 'กรุณาใส่ชื่อพนักงาน');
  if (!e.role) fail(400, 'กรุณาเลือกตำแหน่ง');
  if (e.start && !/^\d{4}-\d{2}-\d{2}$/.test(e.start)) fail(400, 'วันเริ่มงานไม่ถูกต้อง');
  return e;
}
const empFields = e => ({ name: e.name, role: e.role, phone: e.phone, start_date: e.start || null });
route('POST', '/api/employees', async ({ body }) => {
  need('owner');
  const e = validEmployee(body), id = uid('e');
  await col('employees').doc(id).set({ ...empFields(e), seq: Date.now() });
  await audit('เพิ่มพนักงาน', e.name, e.role);
  return { id, ...e };
});
route('PUT', '/api/employees/:id', async ({ params: [id], body }) => {
  need('owner');
  const e = validEmployee(body);
  if (!validId(id)) fail(404, 'ไม่พบพนักงาน');
  await col('employees').doc(id).update(empFields(e)).catch(missing('ไม่พบพนักงาน'));
  await audit('แก้ไขพนักงาน', e.name, e.role);
  return { id, ...e };
});
route('DELETE', '/api/employees/:id', async ({ params: [id] }) => {
  need('owner');
  if (!validId(id)) fail(404, 'ไม่พบพนักงาน');
  const r = col('employees').doc(id);
  const d = await r.get();
  if (!d.exists) fail(404, 'ไม่พบพนักงาน');
  await r.delete();
  await audit('ลบพนักงาน', d.data().name, '');
  return { ok: true };
});

// ── สต็อก ──
function validStock(b = {}) {
  const s = { name: str(b.name), unit: str(b.unit, 20), qty: num(b.qty), min: num(b.min) };
  if (!s.name || !s.unit) fail(400, 'กรุณาใส่ชื่อและหน่วยของวัตถุดิบ');
  if (!(s.qty >= 0) || !(s.min >= 0)) fail(400, 'จำนวนต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
  return s;
}
const stockFields = s => ({ name: s.name, unit: s.unit, qty: s.qty, min_qty: s.min });
route('POST', '/api/stock', async ({ body }) => {
  need('owner', 'stock');
  const s = validStock(body), id = uid('s');
  await col('stock').doc(id).set({ ...stockFields(s), seq: Date.now() });
  await audit('เพิ่มวัตถุดิบ', s.name, `${s.qty} ${s.unit}`);
  return { id, ...s };
});
route('PUT', '/api/stock/:id', async ({ params: [id], body }) => {
  need('owner', 'stock');
  const s = validStock(body);
  if (!validId(id)) fail(404, 'ไม่พบวัตถุดิบ');
  await col('stock').doc(id).update(stockFields(s)).catch(missing('ไม่พบวัตถุดิบ'));
  await audit('แก้ไขวัตถุดิบ', s.name, `${s.qty} ${s.unit}`);
  return { id, ...s };
});
// ลบวัตถุดิบ (เจ้าของร้านเท่านั้น) — ลบไม่ได้ถ้ายังมีเมนูใช้อยู่ในสูตร (ไม่งั้นเมนูนั้นจะสั่งไม่ได้)
route('DELETE', '/api/stock/:id', async ({ params: [id] }) => {
  need('owner');
  if (!validId(id)) fail(404, 'ไม่พบวัตถุดิบ');
  const r = col('stock').doc(id);
  const d = await r.get();
  if (!d.exists) fail(404, 'ไม่พบวัตถุดิบ');
  const used = (await docs(col('menu'))).filter(m => m.recipe && m.recipe[id] > 0);
  if (used.length) fail(409, `ลบไม่ได้ ยังมีเมนูใช้วัตถุดิบนี้: ${used.map(m => m.name).join(', ')} (แก้สูตรหรือลบเมนูก่อน)`);
  await r.delete();
  await audit('ลบวัตถุดิบ', d.data().name, '');
  return { ok: true };
});
// บวก = รับเข้า, ลบ = เบิกออก
route('POST', '/api/stock/:id/adjust', async ({ params: [id], body }) => {
  need('owner', 'stock');
  const delta = num(body.delta);
  if (!Number.isFinite(delta) || delta === 0) fail(400, 'กรุณาใส่จำนวนที่ไม่ใช่ 0');
  if (!validId(id)) fail(404, 'ไม่พบวัตถุดิบ');
  const r = col('stock').doc(id);
  return fs.runTransaction(async tx => {
    const doc = await tx.get(r);
    if (!doc.exists) fail(404, 'ไม่พบวัตถุดิบ');
    const s = doc.data();
    const qty = round3(s.qty + delta);
    if (qty < 0) fail(400, `เบิกเกินจำนวนคงเหลือ (เหลือ ${s.qty} ${s.unit})`);
    tx.update(r, { qty });
    auditTx(tx, delta > 0 ? 'รับวัตถุดิบเข้า' : 'เบิกวัตถุดิบออก', s.name, `${delta > 0 ? '+' : ''}${delta} ${s.unit} (เหลือ ${qty})`);
    return { id: doc.id, name: s.name, unit: s.unit, qty };
  });
});

// ── เมนูอาหาร (เจ้าของร้านเท่านั้น) ──
const MENU_CATS = CATS.filter(c => c !== 'ทั้งหมด');
// recipe = { รหัสวัตถุดิบ: ปริมาณต่อ 1 จาน } — ไม่ใส่/เป็น 0 = ไม่ใช้วัตถุดิบนั้น
async function validMenu(b = {}) {
  const name = str(b.name, 60), category = str(b.category, 30), price = num(b.price);
  if (!name) fail(400, 'กรุณาใส่ชื่อเมนู');
  if (!MENU_CATS.includes(category)) fail(400, 'หมวดหมู่ไม่ถูกต้อง');
  if (!(price > 0) || price > 100000) fail(400, 'ราคาต้องมากกว่า 0');
  const recipe = {};
  for (const [sid, amt] of Object.entries(b.recipe || {})) {
    const a = num(amt);
    if (!(a >= 0) || a > 1000) fail(400, 'ปริมาณวัตถุดิบไม่ถูกต้อง');
    if (a > 0) recipe[sid] = a;
  }
  const ids = Object.keys(recipe);
  if (ids.some(id => !validId(id))) fail(400, 'ไม่พบวัตถุดิบ');
  const found = await Promise.all(ids.map(id => col('stock').doc(id).get()));
  const lost = found.find(d => !d.exists);
  if (lost) fail(400, 'ไม่พบวัตถุดิบ ' + lost.id);
  return { name, category, price, recipe };
}
route('POST', '/api/menu', async ({ body }) => {
  need('owner');
  const m = await validMenu(body), id = uid('m');
  await col('menu').doc(id).set({ ...m, seq: Date.now() });
  await audit('เพิ่มเมนู', m.name, `${m.price} บาท`);
  return { id, name: m.name, cat: m.category, price: m.price, r: m.recipe };
});
route('PUT', '/api/menu/:id', async ({ params: [id], body }) => {
  need('owner');
  const m = await validMenu(body);
  if (!validId(id)) fail(404, 'ไม่พบเมนู');
  await col('menu').doc(id).update(m).catch(missing('ไม่พบเมนู'));
  await audit('แก้ไขเมนู', m.name, `${m.price} บาท`);
  return { id, name: m.name, cat: m.category, price: m.price, r: m.recipe };
});
route('DELETE', '/api/menu/:id', async ({ params: [id] }) => {
  need('owner');
  if (!validId(id)) fail(404, 'ไม่พบเมนู');
  const r = col('menu').doc(id);
  const d = await r.get();
  if (!d.exists) fail(404, 'ไม่พบเมนู');
  await r.delete();
  await audit('ลบเมนู', d.data().name, '');
  return { ok: true };
});
// เพิ่ม/เปลี่ยน/ลบรูปเมนู (เจ้าของร้านเท่านั้น): image = '' (ลบ) · path ของรูปในเว็บ img/menu/xxx.jpg · หรือ data URL ของ JPEG ที่ย่อแล้ว
const IMG_MAX_CHARS = 180000;
route('POST', '/api/menu/:id/image', async ({ params: [id], body }) => {
  need('owner');
  if (!validId(id)) fail(404, 'ไม่พบเมนู');
  const image = String(body.image ?? '');
  const okPath = /^img\/menu\/[\w.-]{1,60}\.(jpe?g|png|webp)$/.test(image);
  const okData = image.startsWith('data:image/jpeg;base64,') && image.length <= IMG_MAX_CHARS && /^[A-Za-z0-9+/=]+$/.test(image.slice(23));
  if (image && !okPath && !okData) fail(400, image.startsWith('data:') && image.length > IMG_MAX_CHARS ? 'รูปใหญ่เกินไป ลองรูปอื่นหรือรูปที่เล็กกว่านี้' : 'รูปภาพไม่ถูกต้อง');
  const r = col('menu').doc(id);
  const d = await r.get();
  if (!d.exists) fail(404, 'ไม่พบเมนู');
  await r.update({ image: image || FV.delete() });
  await audit(image ? 'เปลี่ยนรูปเมนู' : 'ลบรูปเมนู', d.data().name, '');
  return { ok: true, image };
});
// ตั้งเมนูเป็น "หมดชั่วคราว" (ลูกค้า/แคชเชียร์สั่งไม่ได้) หรือเปิดขายอีกครั้ง
route('POST', '/api/menu/:id/soldout', async ({ params: [id], body }) => {
  need('owner');
  if (!validId(id)) fail(404, 'ไม่พบเมนู');
  const soldout = !!body.soldout;
  const r = col('menu').doc(id);
  const d = await r.get();
  if (!d.exists) fail(404, 'ไม่พบเมนู');
  await r.update({ soldout });
  await audit(soldout ? 'ตั้งเมนูหมดชั่วคราว' : 'เปิดขายเมนูอีกครั้ง', d.data().name, '');
  return { ok: true, soldout };
});

// ── โต๊ะ (เจ้าของร้านจัดการ · ทุกคนอ่านได้) ──
const tableName = b => {
  const name = str(b?.name, 20);
  if (!name) fail(400, 'กรุณาใส่ชื่อ/หมายเลขโต๊ะ');
  if (/[\/\\?#&=%]/.test(name)) fail(400, 'ชื่อโต๊ะห้ามมีเครื่องหมายพิเศษ / \\ ? # & = %');
  return name;
};
route('POST', '/api/tables', async ({ body }) => {
  need('owner');
  const name = tableName(body);
  if ((await loadTables()).some(t => t.name === name)) fail(409, 'มีโต๊ะชื่อนี้แล้ว');
  const id = uid('t');
  await col('tables').doc(id).set({ name, seq: Date.now() });
  await audit('เพิ่มโต๊ะ', name, '');
  return { id, name };
});
// สร้างโต๊ะเริ่มต้น 1..n (เฉพาะตอนยังไม่มีโต๊ะเลย)
route('POST', '/api/tables/seed', async ({ body }) => {
  need('owner');
  const n = num(body.count);
  if (!Number.isInteger(n) || n < 1 || n > 100) fail(400, 'จำนวนโต๊ะต้องอยู่ระหว่าง 1–100');
  if ((await loadTables()).length) fail(409, 'มีโต๊ะอยู่แล้ว');
  await commitOps(tableOps(n));
  await audit('สร้างโต๊ะเริ่มต้น', `1–${n}`, '');
  return { ok: true, count: n };
});
route('PUT', '/api/tables/:id', async ({ params: [id], body }) => {
  need('owner');
  const name = tableName(body);
  if (!validId(id)) fail(404, 'ไม่พบโต๊ะ');
  if ((await loadTables()).some(t => t.name === name && t.id !== id)) fail(409, 'มีโต๊ะชื่อนี้แล้ว');
  await col('tables').doc(id).update({ name }).catch(missing('ไม่พบโต๊ะ'));
  await audit('เปลี่ยนชื่อโต๊ะ', name, '');
  return { id, name };
});
route('DELETE', '/api/tables/:id', async ({ params: [id] }) => {
  need('owner');
  if (!validId(id)) fail(404, 'ไม่พบโต๊ะ');
  const r = col('tables').doc(id);
  const d = await r.get();
  if (!d.exists) fail(404, 'ไม่พบโต๊ะ');
  const open = (await docs(col('orders').where('table_no', '==', d.data().name))).filter(o => o.status === 'cooking');
  if (open.length) fail(409, 'โต๊ะนี้ยังมีออเดอร์ที่กำลังทำอยู่');
  await r.delete();
  await audit('ลบโต๊ะ', d.data().name, '');
  return { ok: true };
});

// ปิดบิลโต๊ะ: รับชำระทุกบิลที่ยังค้างของโต๊ะนี้ในครั้งเดียว
route('POST', '/api/bills/close', async ({ body }) => {
  need(...CASHIER);
  const table = str(body.table, 20), method = body.method;
  if (!table) fail(400, 'กรุณาเลือกโต๊ะ');
  if (!METHODS.includes(method)) fail(400, 'วิธีชำระเงินไม่ถูกต้อง');
  const ids = (await docs(col('orders').where('table_no', '==', table))).filter(o => o.status !== 'cancelled').map(o => +o.id);
  const pend = [];
  for (let i = 0; i < ids.length; i += 10) {
    (await docs(col('payments').where('order_id', 'in', ids.slice(i, i + 10)))).filter(p => p.status === 'pending').forEach(p => pend.push(p.id));
  }
  if (!pend.length) fail(409, 'ไม่มีบิลค้างชำระของโต๊ะนี้');
  const r = await payBills(pend, method);
  await audit('ปิดบิลโต๊ะ', 'โต๊ะ ' + table, `${r.count} บิล รวม ${r.total} บาท · ${method}`);
  return r;
});

// ── ออเดอร์ ──
// ลูกค้าสั่งได้โดยไม่ล็อกอิน (ชำระที่เคาน์เตอร์) — ออเดอร์เข้าคิวรอแคชเชียร์รับ และได้รหัสคิวไว้ติดตามสถานะ
// แคชเชียร์เลือกลูกค้าและรับเงินทันทีได้ — สร้างออเดอร์เลย
route('POST', '/api/orders', async ({ body: b }) => {
  const table = str(b.table, 20);
  if (!ME || ME.role === 'customer') {
    const merged = mergeItems(b.items);
    const ref = await col('guestOrders').add({
      items: Object.entries(merged).map(([m, x]) => ({ m, q: x.q, ...(x.note ? { note: x.note } : {}) })), table, created_at: Date.now(),
      ...(ME ? { email: ME.username } : {}), // ลูกค้าที่ล็อกอิน: แนบอีเมลให้แคชเชียร์เห็น
    });
    const total = Object.entries(merged).reduce((a, [m, x]) => a + x.q * (MENU.find(y => y.id === m)?.price || 0), 0);
    return { queued: true, ticket: ref.id, id: '', total, paid: false };
  }
  if (!CASHIER.includes(ME.role)) fail(403, 'บัญชีนี้ไม่มีสิทธิ์ขายหน้าร้าน');
  const customerId = b.cust ? str(b.cust, 20) : 'c0';
  if (!validId(customerId)) fail(400, 'ไม่พบลูกค้า');
  const payNow = !!b.payNow;
  if (payNow && !METHODS.includes(b.method)) fail(400, 'วิธีชำระเงินไม่ถูกต้อง');
  return createOrder({ items: b.items, customerId, table, payNow, method: b.method });
});

route('PATCH', '/api/orders/:id/serve', async ({ params: [id] }) => {
  need(...STAFF);
  const r = col('orders').doc(String(orderNo(id)));
  await fs.runTransaction(async tx => {
    const o = await tx.get(r);
    if (!o.exists || o.data().status !== 'cooking') fail(409, 'ออเดอร์นี้ไม่ได้อยู่ในสถานะกำลังทำ');
    tx.update(r, { status: 'served' });
    trackSet(tx, o.data().ticket, { status: 'served' });
    auditTx(tx, ME.role === 'kitchen' ? 'ทำอาหารเสร็จ' : 'เสิร์ฟออเดอร์', '#' + r.id, '');
  });
  return { ok: true };
});

const cancelReason = b => {
  const reason = str(b?.reason, 200);
  if (!reason) fail(400, 'กรุณาใส่เหตุผลการยกเลิก');
  return reason;
};
// เจ้าของร้าน = ยกเลิกได้เลย · ฝ่ายการเงิน = ส่งคำขอให้เจ้าของร้านอนุมัติ (ยกเลิกได้เฉพาะที่ยังไม่ชำระ)
route('POST', '/api/orders/:id/cancel', async ({ params: [id], body }) => {
  need(...CASHIER);
  const reason = cancelReason(body);
  if (ME.role === 'owner') { await cancelOrder(orderNo(id), reason, ME.name); return { ok: true }; }
  await requestCancel(orderNo(id), reason);
  return { ok: true, requested: true };
});
route('POST', '/api/orders/:id/cancel/approve', async ({ params: [id] }) => {
  need('owner');
  const no = orderNo(id);
  const o = await col('orders').doc(String(no)).get();
  if (!o.exists) fail(404, 'ไม่พบออเดอร์');
  const rq = o.data().cancel_request;
  if (!rq) fail(409, 'ออเดอร์นี้ไม่มีคำขอยกเลิก');
  await cancelOrder(no, rq.reason, `${rq.by} ขอ · ${ME.name} อนุมัติ`);
  return { ok: true };
});
route('POST', '/api/orders/:id/cancel/reject', async ({ params: [id] }) => {
  need('owner');
  const r = col('orders').doc(String(orderNo(id)));
  await fs.runTransaction(async tx => {
    const o = await tx.get(r);
    if (!o.exists) fail(404, 'ไม่พบออเดอร์');
    if (!o.data().cancel_request) fail(409, 'ออเดอร์นี้ไม่มีคำขอยกเลิก');
    tx.update(r, { cancel_request: FV.delete() });
    auditTx(tx, 'ปฏิเสธคำขอยกเลิก', '#' + r.id, `คำขอของ ${o.data().cancel_request.by}: ${o.data().cancel_request.reason}`);
  });
  return { ok: true };
});

// ── การชำระเงิน ──
route('POST', '/api/payments/:id/pay', async ({ params: [id], body }) => {
  need(...CASHIER);
  const method = body.method;
  if (!METHODS.includes(method)) fail(400, 'วิธีชำระเงินไม่ถูกต้อง');
  if (!validId(id)) fail(404, 'ไม่พบบิล');
  return payBills([id], method);
});

// ── รายงานยอดขาย ──
route('GET', '/api/reports/sales', async ({ query }) => {
  need(...CASHIER);
  const { from, to, start, end } = dateRange(query);
  // บิลค้างชำระมี paid_at = null จึงไม่ติดมา
  const pays = (await docs(col('payments').where('paid_at', '>=', start).where('paid_at', '<', end))).filter(p => p.status === 'paid');
  const days = {};
  pays.forEach(p => {
    const k = dkey(p.paid_at);
    days[k] ||= { date: k, count: 0, total: 0 };
    days[k].count++;
    days[k].total += p.amount;
  });
  const dayList = Object.values(days).sort((a, b) => a.date.localeCompare(b.date));
  const total = pays.reduce((a, p) => a + p.amount, 0);
  return {
    from, to, total, count: pays.length,
    avgPerBill: pays.length ? total / pays.length : 0,
    avgPerDay: dayList.length ? total / dayList.length : 0,
    days: dayList,
    methods: METHODS.map(m => {
      const ps = pays.filter(p => p.method === m);
      return { method: m, count: ps.length, total: ps.reduce((a, p) => a + p.amount, 0) };
    }),
  };
});

// ── ผู้ใช้และสิทธิ์ (เจ้าของร้านเท่านั้น) ──
const ROLE_KEYS = ['owner', 'finance', 'stock', 'kitchen'];
const RANK = { owner: 0, finance: 1, stock: 2, kitchen: 3, customer: 4 };
route('GET', '/api/users', async () => {
  need('owner');
  return (await docs(col('users').limit(500))).map(u => ({ id: u.id, email: u.email || u.username, name: u.display_name, role: u.role, me: u.id === ME.id }))
    .sort((a, b) => (RANK[a.role] ?? 9) - (RANK[b.role] ?? 9) || a.email.localeCompare(b.email));
});
// สร้างบัญชีพนักงานใหม่ โดยใช้ Firebase app ตัวที่สองสมัครบัญชี เพื่อไม่ให้เจ้าของร้านหลุดจากการล็อกอินของตัวเอง
let app2 = null;
function secondaryAuth() {
  if (!app2) {
    app2 = firebase.initializeApp(FIREBASE_CONFIG, 'secondary');
    if (USE_EMULATOR) app2.auth().useEmulator('http://127.0.0.1:9099');
  }
  return app2.auth();
}
route('POST', '/api/users', async ({ body }) => {
  need('owner');
  const email = str(body.email, 100).toLowerCase(), password = String(body.password ?? ''), role = body.role;
  const name = str(body.name, 60) || email.split('@')[0];
  if (!EMAIL_RE.test(email)) fail(400, 'อีเมลไม่ถูกต้อง');
  if (password.length < 6) fail(400, 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร');
  if (!ROLE_KEYS.includes(role)) fail(400, 'บทบาทไม่ถูกต้อง');
  let uidNew;
  try {
    const a = secondaryAuth();
    uidNew = (await a.createUserWithEmailAndPassword(email, password)).user.uid;
    await a.signOut();
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') fail(409, 'อีเมลนี้มีบัญชีอยู่แล้ว — ถ้าเป็นบัญชีลูกค้า ให้เปลี่ยนบทบาทในรายการผู้ใช้แทน');
    if (e.code === 'auth/invalid-email') fail(400, 'อีเมลไม่ถูกต้อง');
    if (e.code === 'auth/weak-password') fail(400, 'รหัสผ่านง่ายเกินไป');
    if (e.code === 'auth/network-request-failed') fail(503, netMsg);
    throw e;
  }
  await col('users').doc(uidNew).set({ username: email, role, display_name: name, email });
  await audit('เพิ่มผู้ใช้', email, `บทบาท ${role}`);
  return { id: uidNew, email, name, role };
});
route('PUT', '/api/users/:id', async ({ params: [id], body }) => {
  need('owner');
  if (!validId(id)) fail(404, 'ไม่พบผู้ใช้');
  if (id === ME.id) fail(400, 'เปลี่ยนบทบาทของตัวเองไม่ได้');
  const role = body.role;
  if (![...ROLE_KEYS, 'customer'].includes(role)) fail(400, 'บทบาทไม่ถูกต้อง');
  const r = col('users').doc(id);
  const d = await r.get();
  if (!d.exists) fail(404, 'ไม่พบผู้ใช้');
  const name = str(body.name, 60) || d.data().display_name;
  const email = d.data().email || d.data().username;
  await r.update({ role, display_name: name, username: d.data().username || email, email });
  await audit('เปลี่ยนบทบาทผู้ใช้', email, `${d.data().role} → ${role}`);
  return { id, role, name };
});

// ── Audit Log (เจ้าของร้านเท่านั้น) ──
route('GET', '/api/audit', async () => {
  need('owner');
  return (await col('audit').orderBy('at', 'desc').limit(300).get()).docs.map(d => {
    const x = d.data();
    return { id: d.id, time: x.at?.toMillis?.() || Date.now(), name: x.name, role: x.role, action: x.action, target: x.target, detail: x.detail };
  });
});

async function dbApi(path, opt = {}) {
  const method = opt.method || 'GET';
  const [p, qs] = path.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  for (const r of ROUTES) {
    const m = r.method === method && r.re.exec(p);
    if (!m) continue;
    try { return await r.fn({ params: m.slice(1), body: opt.body || {}, query }); }
    catch (e) {
      if (e.code === 'permission-denied') fail(403, 'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้');
      if (e.code === 'unavailable') fail(503, netMsg);
      throw e;
    }
  }
  fail(404, 'ไม่พบ API นี้');
}
