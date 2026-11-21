// db/payments.js — รับชำระเงิน  (ส่วนหนึ่งของชั้นข้อมูล เดิมอยู่ใน db.js ไฟล์เดียว · โหลดตามลำดับใน index.html)
// ───────────── รับชำระเงิน ─────────────
// ชำระหลายบิลในครั้งเดียว (ปิดบิลโต๊ะ) หรือบิลเดียว — เพิ่มแต้ม อัปเดตสถานะที่ลูกค้าติดตาม และบันทึก Audit Log
function payBills(ids, method) {
  return fs.runTransaction(async tx => {
    const found = await Promise.all(ids.map(id => tx.get(col('payments').doc(id))));
    found.forEach(d => {
      if (!d.exists) fail(404, 'ไม่พบบิล');
      if (d.data().status === 'paid') fail(409, 'บิลนี้ชำระแล้ว');
    });
    const now = Date.now(), pts = {};
    let total = 0;
    found.forEach(d => {
      const p = d.data();
      total += p.amount;
      pts[p.customer_id] = (pts[p.customer_id] || 0) + p.amount;
      tx.update(d.ref, { status: 'paid', method, paid_at: now });
      trackSet(tx, p.ticket, { paid: true });
      auditTx(tx, 'รับชำระเงิน', `บิล ${d.id} (ออเดอร์ #${p.order_id})`, `${p.amount} บาท · ${method}`);
    });
    Object.entries(pts).forEach(([cid, amt]) => addPoints(tx, cid, amt));
    return { id: ids[0], amount: total, total, count: ids.length, method };
  });
}

