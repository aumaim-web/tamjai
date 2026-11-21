// db/loaders.js — โหลดข้อมูลสำหรับแสดงผล (เมนู โต๊ะ สต็อก ลูกค้า พนักงาน ออเดอร์ บิล)  (ส่วนหนึ่งของชั้นข้อมูล เดิมอยู่ใน db.js ไฟล์เดียว · โหลดตามลำดับใน index.html)
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

