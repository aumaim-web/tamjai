// db/core.js — ชั้นข้อมูล: คุยกับ Firebase (Authentication + Firestore) โดยตรงจากเบราว์เซอร์ (แยกเป็นหลายไฟล์ในโฟลเดอร์ db/)
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

