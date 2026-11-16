// create-users.js — สร้างบัญชีพนักงาน (Firebase Authentication) แยกตามหน้าที่ + กำหนดบทบาทใน Firestore
// อีเมลพนักงาน: owner@tamjaifood230.web.app, finance@..., stock@..., kitchen@... (ฝ่ายรับออเดอร์) (ลูกค้าไม่ต้องสร้างที่นี่ สมัครเองในหน้าเว็บได้)
// ใช้: node tools/create-users.js                     สร้างเฉพาะบัญชีที่ยังไม่มี (รหัสผ่านสุ่ม)
//      node tools/create-users.js --reset-passwords   สุ่มรหัสผ่านใหม่ให้ทุกบัญชี
// รหัสผ่านที่สุ่มได้จะบันทึกใน initial-passwords.txt (ไม่แสดงบนหน้าจอ และอยู่ใน .gitignore) — เปลี่ยนเองได้ที่ Firebase Console
// ต้องมี serviceAccountKey.json ในโฟลเดอร์โปรเจกต์ (หรือใช้กับ Emulator: ตั้ง FIREBASE_AUTH_EMULATOR_HOST และ FIRESTORE_EMULATOR_HOST)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
try { require.resolve('firebase-admin/app'); } catch (e) {
  console.error('ยังไม่ได้ติดตั้งแพ็กเกจที่สคริปต์นี้ต้องใช้ — รัน  npm install  (หรือ npm.cmd install) ในโฟลเดอร์โปรเจกต์ก่อน');
  process.exit(1);
}
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const EMAIL_DOMAIN = '@tamjaifood230.web.app'; // ต้องตรงกับ public/js/firebase-config.js
const OLD_DOMAIN = '@tamjai.local';            // โดเมนเดิม — บัญชีเก่าจะถูกย้ายมาใช้อีเมลใหม่
const USERS = [ // [username, role, ชื่อที่แสดง]
  ['owner', 'owner', 'ปราณี (เจ้าของร้าน)'],
  ['finance', 'finance', 'สุดารัตน์ (การเงิน)'],
  ['stock', 'stock', 'บุญชัย (คลังสินค้า)'],
  ['kitchen', 'kitchen', 'สมใจ (ฝ่ายรับออเดอร์)'],
];

const keyFile = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT || path.join(__dirname, '..', 'serviceAccountKey.json'));
if (process.env.FIREBASE_AUTH_EMULATOR_HOST) initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-tamjai' });
else if (!fs.existsSync(keyFile)) {
  console.error(`ไม่พบไฟล์คีย์ ${keyFile}\nดาวน์โหลดจาก Firebase Console > Project settings > Service accounts > Generate new private key แล้วตั้งชื่อเป็น serviceAccountKey.json วางในโฟลเดอร์โปรเจกต์`);
  process.exit(1);
}
else initializeApp({ credential: cert(JSON.parse(fs.readFileSync(keyFile, 'utf8'))) });
const auth = getAuth(), db = getFirestore();

const find = email => auth.getUserByEmail(email).catch(e => { if (e.code === 'auth/user-not-found') return null; throw e; });
const newPassword = () => crypto.randomBytes(9).toString('base64url');

async function main() {
  const reset = process.argv.includes('--reset-passwords');
  const lines = [];
  for (const [username, role, name] of USERS) {
    const email = username + EMAIL_DOMAIN;
    let user = await find(email), password = null, status = 'มีอยู่แล้ว (ไม่เปลี่ยนรหัสผ่าน)';
    if (!user) {
      const old = await find(username + OLD_DOMAIN); // บัญชีจากเวอร์ชันก่อน: ย้ายมาใช้อีเมลใหม่
      password = newPassword();
      if (old) { user = await auth.updateUser(old.uid, { email, password, displayName: name }); status = 'ย้ายมาใช้อีเมลใหม่ + ตั้งรหัสผ่านใหม่แล้ว'; }
      else { user = await auth.createUser({ email, password, displayName: name }); status = 'สร้างบัญชีแล้ว'; }
    } else if (reset) { password = newPassword(); await auth.updateUser(user.uid, { password }); status = 'รีเซ็ตรหัสผ่านแล้ว'; }
    await db.collection('users').doc(user.uid).set({ username: email, role, display_name: name, email });
    console.log(`${email}: ${status}`);
    if (password) lines.push(`${email}\t${password}\t${role}`);
  }
  // ลบเอกสารผู้ใช้แบบเก่า (รหัสผ่านแฮชที่เคยเก็บไว้ในฐานข้อมูล) ที่ไม่ใช้แล้ว
  const old = (await db.collection('users').get()).docs.filter(d => d.data().password_hash !== undefined);
  await Promise.all(old.map(d => d.ref.delete()));
  if (old.length) console.log(`ลบข้อมูลผู้ใช้แบบเก่า ${old.length} รายการ`);
  if (lines.length) {
    const file = path.join(__dirname, '..', 'initial-passwords.txt');
    fs.writeFileSync(file, 'อีเมล\tรหัสผ่าน\tหน้าที่\n' + lines.join('\n') + '\n');
    console.log('บันทึกรหัสผ่านไว้ที่', file);
  }
}
main().then(() => process.exit(0), e => { console.error('ไม่สำเร็จ:', e.message); process.exit(1); });
