// db/routes-people.js — เส้นทาง: ลูกค้าสมาชิกและพนักงาน (เช็กเบอร์โทรซ้ำ)  (ส่วนหนึ่งของชั้นข้อมูล เดิมอยู่ใน db.js ไฟล์เดียว · โหลดตามลำดับใน index.html)
// ── ลูกค้า (สมาชิกสะสมแต้ม) ──
function validCustomer(b = {}) {
  const name = str(b.name), phone = str(b.phone, 20);
  if (!name) fail(400, 'กรุณาใส่ชื่อลูกค้า');
  if (!/^[0-9-+ ]{9,15}$/.test(phone)) fail(400, 'เบอร์โทรไม่ถูกต้อง');
  return { name, phone };
}
// เบอร์โทรเทียบกันแบบไม่สนขีด/เว้นวรรค และ +66 ถือเป็น 0 (081-234-5678 = 0812345678 = +66 81 234 5678)
const phoneKey = p => { const d = String(p || '').replace(/\D/g, ''); return d.startsWith('66') && d.length >= 11 ? '0' + d.slice(2) : d; };
// เบอร์ซ้ำกับสมาชิกคนอื่นไม่ได้ (exceptId = คนที่กำลังแก้ไขอยู่ ไม่นับว่าซ้ำกับตัวเอง)
async function assertPhoneFree(collection, phone, exceptId) {
  const key = phoneKey(phone);
  if (!key) return;
  const dup = (await docs(col(collection))).find(x => x.id !== exceptId && phoneKey(x.phone) === key);
  if (dup) fail(409, `เบอร์โทรนี้ถูกใช้แล้ว (${dup.name}) กรุณาใช้เบอร์อื่น`);
}
route('POST', '/api/customers', async ({ body }) => {
  need(...CASHIER);
  const c = validCustomer(body), id = uid('c');
  await assertPhoneFree('customers', c.phone);
  await col('customers').doc(id).set({ ...c, points: 0, seq: Date.now() });
  await audit('เพิ่มลูกค้าสมาชิก', c.name, '');
  return { id, ...c, points: 0 };
});
route('PUT', '/api/customers/:id', async ({ params: [id], body }) => {
  need(...CASHIER);
  if (id === 'c0') fail(400, 'แก้ไขลูกค้าทั่วไปไม่ได้');
  const c = validCustomer(body);
  if (!validId(id)) fail(404, 'ไม่พบลูกค้า');
  await assertPhoneFree('customers', c.phone, id);
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
  await assertPhoneFree('employees', e.phone);
  await col('employees').doc(id).set({ ...empFields(e), seq: Date.now() });
  await audit('เพิ่มพนักงาน', e.name, e.role);
  return { id, ...e };
});
route('PUT', '/api/employees/:id', async ({ params: [id], body }) => {
  need('owner');
  const e = validEmployee(body);
  if (!validId(id)) fail(404, 'ไม่พบพนักงาน');
  await assertPhoneFree('employees', e.phone, id);
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

