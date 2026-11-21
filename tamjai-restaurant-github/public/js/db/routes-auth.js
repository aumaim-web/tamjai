// db/routes-auth.js — เส้นทาง: เข้าสู่ระบบ สมัครสมาชิก ออกจากระบบ โหลดข้อมูลทั้งหมด รีเซ็ต  (ส่วนหนึ่งของชั้นข้อมูล เดิมอยู่ใน db.js ไฟล์เดียว · โหลดตามลำดับใน index.html)

// เข้าสู่ระบบ: พนักงานพิมพ์ owner หรืออีเมลเต็มก็ได้ ลูกค้าพิมพ์อีเมลที่สมัครไว้
route('POST', '/api/login', async ({ body }) => {
  const bad = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  const raw = str(body.email ?? body.username, 100).toLowerCase();
  const email = raw.includes('@') ? raw : raw + EMAIL_DOMAIN;
  if (!EMAIL_RE.test(email) || (!raw.includes('@') && !validId(raw)) || !body.password) fail(401, bad);
  loggingIn = true;
  try {
    let cred;
    try { cred = await auth.signInWithEmailAndPassword(email, String(body.password)); }
    catch (e) {
      if (e.code === 'auth/network-request-failed') fail(503, netMsg);
      if (e.code === 'auth/too-many-requests') fail(429, 'ลองผิดหลายครั้งเกินไป รอสักครู่แล้วลองใหม่');
      fail(401, bad);
    }
    let p = await loadProfile(cred.user);
    if (!p && !isStaffEmail(email)) p = await createCustomerProfile(cred.user); // สมัครค้างไว้/สร้างจากที่อื่น
    if (!p) { await auth.signOut(); fail(401, bad); }
    try { localStorage.setItem(LOGIN_KEY, String(Date.now())); } catch (e) {}
    ME = p; TOKEN = true;
    await audit('เข้าสู่ระบบ', p.username, '');
    return { token: 'firebase', user: { username: p.username, role: p.role, name: p.name } };
  } finally { loggingIn = false; }
});

// สมัครสมาชิกลูกค้า: อีเมลอะไรก็ได้ (ไม่ต้องยืนยันอีเมล) รหัสผ่านอย่างน้อย 6 ตัว
route('POST', '/api/signup', async ({ body }) => {
  const email = str(body.email, 100).toLowerCase(), password = String(body.password ?? '');
  if (!EMAIL_RE.test(email)) fail(400, 'อีเมลไม่ถูกต้อง');
  if (isStaffEmail(email)) fail(400, 'อีเมลนี้สงวนไว้สำหรับพนักงาน กรุณาใช้อีเมลอื่น');
  if (password.length < 6) fail(400, 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร');
  loggingIn = true;
  try {
    let cred;
    try { cred = await auth.createUserWithEmailAndPassword(email, password); }
    catch (e) {
      if (e.code === 'auth/email-already-in-use') fail(409, 'อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน');
      if (e.code === 'auth/invalid-email') fail(400, 'อีเมลไม่ถูกต้อง');
      if (e.code === 'auth/weak-password') fail(400, 'รหัสผ่านง่ายเกินไป');
      if (e.code === 'auth/operation-not-allowed') fail(403, 'ระบบยังไม่เปิดให้สมัครสมาชิก');
      if (e.code === 'auth/network-request-failed') fail(503, netMsg);
      throw e;
    }
    const p = await createCustomerProfile(cred.user, body.name);
    try { localStorage.setItem(LOGIN_KEY, String(Date.now())); } catch (e) {}
    ME = p; TOKEN = true;
    return { token: 'firebase', user: { username: p.username, role: p.role, name: p.name } };
  } finally { loggingIn = false; }
});

route('POST', '/api/logout', async () => {
  stopLive();
  await audit('ออกจากระบบ', ME?.username, '');
  ME = null; TOKEN = null;
  try { localStorage.removeItem(LOGIN_KEY); } catch (e) {}
  await auth.signOut();
  return { ok: true };
});

route('GET', '/api/me', async () => { need(...STAFF); return { user: ME }; });

// ข้อมูลทั้งหมดที่หน้าจอต้องใช้ในครั้งเดียว — ลูกค้า (ไม่ล็อกอิน/ล็อกอินเป็นลูกค้า) ได้เฉพาะเมนู โต๊ะ และจำนวนคงเหลือ
route('GET', '/api/state', async () => {
  if (!ME || ME.role === 'customer') {
    const [menu, tables, stock] = await Promise.all([loadMenu(), loadTables(), loadStock()]);
    return { ...(ME ? { user: ME } : {}), menu, tables, stock: stock.map(s => ({ id: s.id, qty: s.qty, min: s.min })) };
  }
  const notes = TAKERS.includes(ME.role) ? await processGuestOrders() : []; // รับออเดอร์ลูกค้าก่อนโหลด
  if (ME.role === 'kitchen') { // ฝ่ายรับออเดอร์: เห็นเมนู โต๊ะ สต็อก และออเดอร์ — ไม่เห็นข้อมูลลูกค้า บิล และเงิน
    const [menu, tables, stock, orders] = await Promise.all([loadMenu(), loadTables(), loadStock(), loadOrders()]);
    return { user: ME, notes, menu, tables, stock, orders };
  }
  const [menu, tables, stock, customers, employees, orders, payments] = await Promise.all([
    loadMenu(), loadTables(), loadStock(), loadCustomers(), ME.role === 'owner' ? loadEmployees() : [], loadOrders(), loadPayments()]);
  return { user: ME, notes, menu, tables, stock, customers, employees, orders, payments };
});

route('POST', '/api/reset', async () => { need('owner'); await resetShop(); await audit('รีเซ็ตข้อมูลร้านเป็นข้อมูลตัวอย่าง', '', ''); return { ok: true }; });

