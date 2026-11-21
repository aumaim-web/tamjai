// db/routes-tables.js — เส้นทาง: โต๊ะ  (ส่วนหนึ่งของชั้นข้อมูล เดิมอยู่ใน db.js ไฟล์เดียว · โหลดตามลำดับใน index.html)
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

