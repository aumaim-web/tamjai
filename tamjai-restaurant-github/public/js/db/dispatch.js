// db/dispatch.js — dbApi(): ตัวเรียก route ที่หน้าจอใช้  (ส่วนหนึ่งของชั้นข้อมูล เดิมอยู่ใน db.js ไฟล์เดียว · โหลดตามลำดับใน index.html)
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
