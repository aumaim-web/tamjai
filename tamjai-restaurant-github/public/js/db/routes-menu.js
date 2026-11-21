// db/routes-menu.js — เส้นทาง: เมนูอาหาร  (ส่วนหนึ่งของชั้นข้อมูล เดิมอยู่ใน db.js ไฟล์เดียว · โหลดตามลำดับใน index.html)
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

