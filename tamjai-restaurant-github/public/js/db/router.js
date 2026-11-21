// db/router.js — ตัวลงทะเบียนเส้นทาง (route) และฟังก์ชันสร้างโปรไฟล์ลูกค้า  (ส่วนหนึ่งของชั้นข้อมูล เดิมอยู่ใน db.js ไฟล์เดียว · โหลดตามลำดับใน index.html)
// ───────────── เส้นทาง (เหมือน API เดิม) ─────────────
const ROUTES = [];
const route = (method, pattern, fn) => ROUTES.push({ method, re: new RegExp('^' + pattern.replace(/:\w+/g, '([^/]+)') + '$'), fn });
const missing = msg => e => { if (e.code === 'not-found') fail(404, msg); throw e; };

// อีเมลพนักงานลงท้ายด้วย EMAIL_DOMAIN — ลูกค้าใช้โดเมนนี้สมัครเองไม่ได้
const isStaffEmail = email => email.endsWith(EMAIL_DOMAIN);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const netMsg = 'เชื่อมต่อฐานข้อมูลไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่';

// บัญชีลูกค้า: โปรไฟล์ role = customer (กฎฐานข้อมูลอนุญาตให้สร้างได้เฉพาะ role นี้เท่านั้น)
async function createCustomerProfile(user, name) {
  const email = String(user.email || '').toLowerCase();
  const display_name = str(name, 60) || email.split('@')[0];
  await col('users').doc(user.uid).set({ username: email, role: 'customer', display_name, email });
  return { id: user.uid, username: email, role: 'customer', name: display_name };
}
