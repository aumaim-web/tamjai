// db/session.js — สถานะล็อกอิน: โหลดโปรไฟล์ จำการล็อกอิน 12 ชั่วโมง  (ส่วนหนึ่งของชั้นข้อมูล เดิมอยู่ใน db.js ไฟล์เดียว · โหลดตามลำดับใน index.html)
// ───────────── เข้าสู่ระบบ ─────────────
async function loadProfile(u) {
  const d = await col('users').doc(u.uid).get();
  if (!d.exists) return null;
  const x = d.data();
  return { id: u.uid, username: x.username, role: x.role, name: x.display_name };
}

let loggingIn = false;
const LOGIN_KEY = 'tamjai-login-at';
const authReady = new Promise(resolve => {
  setTimeout(resolve, 8000); // กันค้าง: ถ้า Firebase Auth ไม่ตอบใน 8 วินาที ให้เปิดหน้าเป็นลูกค้าก่อน
  // เรียกครั้งแรกตอนเปิดหน้า (กู้การล็อกอินเดิม) และทุกครั้งที่สถานะเปลี่ยน
  auth.onAuthStateChanged(async u => {
    if (loggingIn) return; // ให้ขั้นตอนล็อกอินจัดการเอง
    try {
      ME = null; TOKEN = null;
      if (u) {
        let at = 0; try { at = +localStorage.getItem(LOGIN_KEY) || 0; } catch (e) {}
        if (at && Date.now() - at > SESSION_MS) await auth.signOut();
        else { ME = await loadProfile(u); if (ME) TOKEN = true; else await auth.signOut(); }
      }
    } catch (e) { ME = null; TOKEN = null; }
    resolve();
  });
});

