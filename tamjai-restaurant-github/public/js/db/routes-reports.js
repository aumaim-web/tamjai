// db/routes-reports.js — เส้นทาง: รายงานยอดขาย  (ส่วนหนึ่งของชั้นข้อมูล เดิมอยู่ใน db.js ไฟล์เดียว · โหลดตามลำดับใน index.html)
// ───────────── รายงาน ─────────────
// อ่าน ?from=&to= (ค่าเริ่มต้น 7 วันล่าสุด) แล้วคืนช่วงเวลาเป็น ms
function dateRange(query) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const to = re.test(query.to) ? query.to : dkey(Date.now());
  let from = query.from;
  if (!re.test(from)) { const d = new Date(to + 'T00:00'); d.setDate(d.getDate() - 6); from = dkey(d); }
  if (from > to) fail(400, 'วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด');
  const start = +new Date(from + 'T00:00');
  const end = +new Date(to + 'T00:00') + 86400000; // ไม่รวมเวลานี้
  return { from, to, start, end };
}

// ── รายงานยอดขาย ──
route('GET', '/api/reports/sales', async ({ query }) => {
  need(...CASHIER);
  const { from, to, start, end } = dateRange(query);
  // บิลค้างชำระมี paid_at = null จึงไม่ติดมา
  const pays = (await docs(col('payments').where('paid_at', '>=', start).where('paid_at', '<', end))).filter(p => p.status === 'paid');
  const days = {};
  pays.forEach(p => {
    const k = dkey(p.paid_at);
    days[k] ||= { date: k, count: 0, total: 0 };
    days[k].count++;
    days[k].total += p.amount;
  });
  const dayList = Object.values(days).sort((a, b) => a.date.localeCompare(b.date));
  const total = pays.reduce((a, p) => a + p.amount, 0);
  return {
    from, to, total, count: pays.length,
    avgPerBill: pays.length ? total / pays.length : 0,
    avgPerDay: dayList.length ? total / dayList.length : 0,
    days: dayList,
    methods: METHODS.map(m => {
      const ps = pays.filter(p => p.method === m);
      return { method: m, count: ps.length, total: ps.reduce((a, p) => a + p.amount, 0) };
    }),
  };
});

