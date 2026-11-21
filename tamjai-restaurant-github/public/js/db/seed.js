// db/seed.js — ข้อมูลตัวอย่างและรีเซ็ตร้าน  (ส่วนหนึ่งของชั้นข้อมูล เดิมอยู่ใน db.js ไฟล์เดียว · โหลดตามลำดับใน index.html)
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

