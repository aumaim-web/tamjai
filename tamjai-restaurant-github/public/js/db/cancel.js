// db/cancel.js — ยกเลิกออเดอร์และขอยกเลิก  (ส่วนหนึ่งของชั้นข้อมูล เดิมอยู่ใน db.js ไฟล์เดียว · โหลดตามลำดับใน index.html)
async function cancelOrder(id, reason, by) {
  const payRefs = (await col('payments').where('order_id', '==', id).get()).docs.map(d => d.ref);
  return fs.runTransaction(async tx => {
    const oRef = col('orders').doc(String(id));
    const [o, ...pays] = await Promise.all([tx.get(oRef), ...payRefs.map(r => tx.get(r))]);
    if (!o.exists) fail(404, 'ไม่พบออเดอร์');
    if (o.data().status === 'cancelled') fail(409, 'ออเดอร์นี้ถูกยกเลิกไปแล้ว');
    if (pays.some(p => p.exists && p.data().status === 'paid')) fail(409, 'ออเดอร์ที่ชำระแล้วยกเลิกไม่ได้');

    // คำนวณวัตถุดิบที่ต้องคืนจากสูตรปัจจุบัน
    const items = o.data().items || [];
    const mids = [...new Set(items.map(i => i.m))];
    const menus = await Promise.all(mids.map(m => tx.get(col('menu').doc(m))));
    const back = {};
    menus.filter(m => m.exists).forEach(m => {
      const rec = m.data().recipe || {};
      items.filter(i => i.m === m.id).forEach(i => {
        for (const [sid, amt] of Object.entries(rec)) back[sid] = (back[sid] || 0) + amt * i.q;
      });
    });
    const stocks = await Promise.all(Object.keys(back).map(s => tx.get(col('stock').doc(s))));

    stocks.filter(s => s.exists).forEach(s => tx.update(s.ref, { qty: round3(s.data().qty + back[s.id]) }));
    pays.filter(p => p.exists).forEach(p => tx.delete(p.ref));
    tx.update(oRef, { status: 'cancelled', cancel_reason: reason, cancelled_by: by, cancel_request: FV.delete() });
    trackSet(tx, o.data().ticket, { status: 'cancelled', reason });
    auditTx(tx, 'ยกเลิกออเดอร์', '#' + id, `เหตุผล: ${reason} · โดย ${by}`);
  });
}

// ฝ่ายการเงินขอยกเลิก → รอเจ้าของร้านอนุมัติ
async function requestCancel(id, reason) {
  const payRefs = (await col('payments').where('order_id', '==', id).get()).docs.map(d => d.ref);
  return fs.runTransaction(async tx => {
    const oRef = col('orders').doc(String(id));
    const [o, ...pays] = await Promise.all([tx.get(oRef), ...payRefs.map(r => tx.get(r))]);
    if (!o.exists) fail(404, 'ไม่พบออเดอร์');
    if (o.data().status === 'cancelled') fail(409, 'ออเดอร์นี้ถูกยกเลิกไปแล้ว');
    if (pays.some(p => p.exists && p.data().status === 'paid')) fail(409, 'ออเดอร์ที่ชำระแล้วยกเลิกไม่ได้');
    if (o.data().cancel_request) fail(409, 'ออเดอร์นี้ขอยกเลิกไปแล้ว รอเจ้าของร้านอนุมัติ');
    tx.update(oRef, { cancel_request: { by: ME.name, role: ME.role, reason, at: Date.now() } });
    auditTx(tx, 'ขอยกเลิกออเดอร์', '#' + id, `เหตุผล: ${reason}`);
  });
}

