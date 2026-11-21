// db/routes-stock.js — เส้นทาง: สต็อกวัตถุดิบ  (ส่วนหนึ่งของชั้นข้อมูล เดิมอยู่ใน db.js ไฟล์เดียว · โหลดตามลำดับใน index.html)
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

