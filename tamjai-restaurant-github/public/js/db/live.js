// db/live.js — แจ้งเตือนแบบ real-time และติดตามสถานะของลูกค้า  (ส่วนหนึ่งของชั้นข้อมูล เดิมอยู่ใน db.js ไฟล์เดียว · โหลดตามลำดับใน index.html)
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
