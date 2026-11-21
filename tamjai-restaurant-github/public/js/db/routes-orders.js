// db/routes-orders.js — เส้นทาง: ออเดอร์ ยกเลิก และการชำระเงิน  (ส่วนหนึ่งของชั้นข้อมูล เดิมอยู่ใน db.js ไฟล์เดียว · โหลดตามลำดับใน index.html)
// ── ออเดอร์ ──
// ลูกค้าสั่งได้โดยไม่ล็อกอิน (ชำระที่เคาน์เตอร์) — ออเดอร์เข้าคิวรอแคชเชียร์รับ และได้รหัสคิวไว้ติดตามสถานะ
// แคชเชียร์เลือกลูกค้าและรับเงินทันทีได้ — สร้างออเดอร์เลย
route('POST', '/api/orders', async ({ body: b }) => {
  const table = str(b.table, 20);
  if (!ME || ME.role === 'customer') {
    const merged = mergeItems(b.items);
    const ref = await col('guestOrders').add({
      items: Object.entries(merged).map(([m, x]) => ({ m, q: x.q, ...(x.note ? { note: x.note } : {}) })), table, created_at: Date.now(),
      ...(ME ? { email: ME.username } : {}), // ลูกค้าที่ล็อกอิน: แนบอีเมลให้แคชเชียร์เห็น
    });
    const total = Object.entries(merged).reduce((a, [m, x]) => a + x.q * (MENU.find(y => y.id === m)?.price || 0), 0);
    return { queued: true, ticket: ref.id, id: '', total, paid: false };
  }
  if (!CASHIER.includes(ME.role)) fail(403, 'บัญชีนี้ไม่มีสิทธิ์ขายหน้าร้าน');
  const customerId = b.cust ? str(b.cust, 20) : 'c0';
  if (!validId(customerId)) fail(400, 'ไม่พบลูกค้า');
  const payNow = !!b.payNow;
  if (payNow && !METHODS.includes(b.method)) fail(400, 'วิธีชำระเงินไม่ถูกต้อง');
  return createOrder({ items: b.items, customerId, table, payNow, method: b.method });
});

route('PATCH', '/api/orders/:id/serve', async ({ params: [id] }) => {
  need(...STAFF);
  const r = col('orders').doc(String(orderNo(id)));
  await fs.runTransaction(async tx => {
    const o = await tx.get(r);
    if (!o.exists || o.data().status !== 'cooking') fail(409, 'ออเดอร์นี้ไม่ได้อยู่ในสถานะกำลังทำ');
    tx.update(r, { status: 'served' });
    trackSet(tx, o.data().ticket, { status: 'served' });
    auditTx(tx, ME.role === 'kitchen' ? 'ทำอาหารเสร็จ' : 'เสิร์ฟออเดอร์', '#' + r.id, '');
  });
  return { ok: true };
});

const cancelReason = b => {
  const reason = str(b?.reason, 200);
  if (!reason) fail(400, 'กรุณาใส่เหตุผลการยกเลิก');
  return reason;
};
// เจ้าของร้าน = ยกเลิกได้เลย · ฝ่ายการเงิน = ส่งคำขอให้เจ้าของร้านอนุมัติ (ยกเลิกได้เฉพาะที่ยังไม่ชำระ)
route('POST', '/api/orders/:id/cancel', async ({ params: [id], body }) => {
  need(...CASHIER);
  const reason = cancelReason(body);
  if (ME.role === 'owner') { await cancelOrder(orderNo(id), reason, ME.name); return { ok: true }; }
  await requestCancel(orderNo(id), reason);
  return { ok: true, requested: true };
});
route('POST', '/api/orders/:id/cancel/approve', async ({ params: [id] }) => {
  need('owner');
  const no = orderNo(id);
  const o = await col('orders').doc(String(no)).get();
  if (!o.exists) fail(404, 'ไม่พบออเดอร์');
  const rq = o.data().cancel_request;
  if (!rq) fail(409, 'ออเดอร์นี้ไม่มีคำขอยกเลิก');
  await cancelOrder(no, rq.reason, `${rq.by} ขอ · ${ME.name} อนุมัติ`);
  return { ok: true };
});
route('POST', '/api/orders/:id/cancel/reject', async ({ params: [id] }) => {
  need('owner');
  const r = col('orders').doc(String(orderNo(id)));
  await fs.runTransaction(async tx => {
    const o = await tx.get(r);
    if (!o.exists) fail(404, 'ไม่พบออเดอร์');
    if (!o.data().cancel_request) fail(409, 'ออเดอร์นี้ไม่มีคำขอยกเลิก');
    tx.update(r, { cancel_request: FV.delete() });
    auditTx(tx, 'ปฏิเสธคำขอยกเลิก', '#' + r.id, `คำขอของ ${o.data().cancel_request.by}: ${o.data().cancel_request.reason}`);
  });
  return { ok: true };
});

// ── การชำระเงิน ──
route('POST', '/api/payments/:id/pay', async ({ params: [id], body }) => {
  need(...CASHIER);
  const method = body.method;
  if (!METHODS.includes(method)) fail(400, 'วิธีชำระเงินไม่ถูกต้อง');
  if (!validId(id)) fail(404, 'ไม่พบบิล');
  return payBills([id], method);
});

