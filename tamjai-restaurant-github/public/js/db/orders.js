// db/orders.js — สร้างออเดอร์ (transaction) และรับออเดอร์จากคิวลูกค้า  (ส่วนหนึ่งของชั้นข้อมูล เดิมอยู่ใน db.js ไฟล์เดียว · โหลดตามลำดับใน index.html)
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

