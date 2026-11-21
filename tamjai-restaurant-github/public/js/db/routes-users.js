// db/routes-users.js — เส้นทาง: ผู้ใช้/สิทธิ์ และ Audit Log (เจ้าของร้าน)  (ส่วนหนึ่งของชั้นข้อมูล เดิมอยู่ใน db.js ไฟล์เดียว · โหลดตามลำดับใน index.html)
// ── ผู้ใช้และสิทธิ์ (เจ้าของร้านเท่านั้น) ──
const ROLE_KEYS = ['owner', 'finance', 'stock', 'kitchen'];
const RANK = { owner: 0, finance: 1, stock: 2, kitchen: 3, customer: 4 };
route('GET', '/api/users', async () => {
  need('owner');
  return (await docs(col('users').limit(500))).map(u => ({ id: u.id, email: u.email || u.username, name: u.display_name, role: u.role, me: u.id === ME.id }))
    .sort((a, b) => (RANK[a.role] ?? 9) - (RANK[b.role] ?? 9) || a.email.localeCompare(b.email));
});
// สร้างบัญชีพนักงานใหม่ โดยใช้ Firebase app ตัวที่สองสมัครบัญชี เพื่อไม่ให้เจ้าของร้านหลุดจากการล็อกอินของตัวเอง
let app2 = null;
function secondaryAuth() {
  if (!app2) {
    app2 = firebase.initializeApp(FIREBASE_CONFIG, 'secondary');
    if (USE_EMULATOR) app2.auth().useEmulator('http://127.0.0.1:9099');
  }
  return app2.auth();
}
route('POST', '/api/users', async ({ body }) => {
  need('owner');
  const email = str(body.email, 100).toLowerCase(), password = String(body.password ?? ''), role = body.role;
  const name = str(body.name, 60) || email.split('@')[0];
  if (!EMAIL_RE.test(email)) fail(400, 'อีเมลไม่ถูกต้อง');
  if (password.length < 6) fail(400, 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร');
  if (!ROLE_KEYS.includes(role)) fail(400, 'บทบาทไม่ถูกต้อง');
  let uidNew;
  try {
    const a = secondaryAuth();
    uidNew = (await a.createUserWithEmailAndPassword(email, password)).user.uid;
    await a.signOut();
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') fail(409, 'อีเมลนี้มีบัญชีอยู่แล้ว — ถ้าเป็นบัญชีลูกค้า ให้เปลี่ยนบทบาทในรายการผู้ใช้แทน');
    if (e.code === 'auth/invalid-email') fail(400, 'อีเมลไม่ถูกต้อง');
    if (e.code === 'auth/weak-password') fail(400, 'รหัสผ่านง่ายเกินไป');
    if (e.code === 'auth/network-request-failed') fail(503, netMsg);
    throw e;
  }
  await col('users').doc(uidNew).set({ username: email, role, display_name: name, email });
  await audit('เพิ่มผู้ใช้', email, `บทบาท ${role}`);
  return { id: uidNew, email, name, role };
});
route('PUT', '/api/users/:id', async ({ params: [id], body }) => {
  need('owner');
  if (!validId(id)) fail(404, 'ไม่พบผู้ใช้');
  if (id === ME.id) fail(400, 'เปลี่ยนบทบาทของตัวเองไม่ได้');
  const role = body.role;
  if (![...ROLE_KEYS, 'customer'].includes(role)) fail(400, 'บทบาทไม่ถูกต้อง');
  const r = col('users').doc(id);
  const d = await r.get();
  if (!d.exists) fail(404, 'ไม่พบผู้ใช้');
  const name = str(body.name, 60) || d.data().display_name;
  const email = d.data().email || d.data().username;
  await r.update({ role, display_name: name, username: d.data().username || email, email });
  await audit('เปลี่ยนบทบาทผู้ใช้', email, `${d.data().role} → ${role}`);
  return { id, role, name };
});

// ── Audit Log (เจ้าของร้านเท่านั้น) ──
route('GET', '/api/audit', async () => {
  need('owner');
  return (await col('audit').orderBy('at', 'desc').limit(300).get()).docs.map(d => {
    const x = d.data();
    return { id: d.id, time: x.at?.toMillis?.() || Date.now(), name: x.name, role: x.role, action: x.action, target: x.target, detail: x.detail };
  });
});

