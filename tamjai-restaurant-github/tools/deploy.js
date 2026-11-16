// deploy.js — ปล่อยหน้าเว็บ + กฎความปลอดภัยขึ้น https://tamjaifood230.web.app (เรียกจาก deploy.bat)
// ถ้าเครื่องนี้ยังไม่มี Firebase CLI จะใช้ผ่าน npx ให้เอง และให้ล็อกอินบัญชี Google ครั้งแรก
// ใช้: node tools/deploy.js [ตัวเลือกเพิ่มเติม เช่น --dry-run]
const { spawnSync } = require('child_process');
const path = require('path');

const PROJECT = 'tamjaifood230';
if (+process.versions.node.split('.')[0] < 20) {
  console.log(`Node.js ในเครื่องนี้เป็นเวอร์ชัน ${process.versions.node} ซึ่งเก่าเกินไป — Firebase CLI ต้องใช้ Node.js 20 ขึ้นไป`);
  console.log('ติดตั้งเวอร์ชัน LTS ล่าสุดจาก https://nodejs.org แล้วลองใหม่');
  process.exit(1);
}
const CLI_VERSION = '15.33.0'; // ใช้เวอร์ชันเดียวกับเครื่องหลัก เมื่อต้องดาวน์โหลดผ่าน npx
process.chdir(path.join(__dirname, '..'));

// ต่อคำสั่งเป็นข้อความเดียว (ใส่เครื่องหมายคำพูดให้ค่าที่มีช่องว่าง) เพื่อให้หา firebase.cmd / npx.cmd บน Windows เจอ
const q = a => /[\s"&|<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a;
const run = (cmd, args, capture) => spawnSync([cmd, ...args].map(q).join(' '), { shell: true, stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8' });
const hasFirebase = run('firebase', ['--version'], true).status === 0;
const fb = (args, capture) => hasFirebase ? run('firebase', args, capture) : run('npx', ['--yes', `firebase-tools@${CLI_VERSION}`, ...args], capture);
if (!hasFirebase) console.log(`ไม่พบ Firebase CLI ในเครื่องนี้ — ใช้ผ่าน npx (firebase-tools@${CLI_VERSION}) ครั้งแรกอาจใช้เวลาดาวน์โหลดสักครู่`);

const who = fb(['login:list'], true);
if (!/Logged in as/.test((who.stdout || '') + (who.stderr || ''))) {
  console.log(`ต้องล็อกอินบัญชี Google ที่มีสิทธิ์ในโปรเจกต์ Firebase "${PROJECT}" ก่อน (เบราว์เซอร์จะเปิดขึ้นมา)`);
  if (fb(['login']).status !== 0) { console.log('ล็อกอินไม่สำเร็จ'); process.exit(1); }
}

console.log(`\nกำลัง deploy ขึ้น https://${PROJECT}.web.app ...`);
const r = fb(['deploy', '--only', 'hosting,firestore:rules', '--project', PROJECT, ...process.argv.slice(2)]);
if (r.status !== 0) {
  console.log('\ndeploy ไม่สำเร็จ — ถ้าขึ้นว่าไม่มีสิทธิ์ (403 / permission) ให้เจ้าของโปรเจกต์เพิ่มบัญชี Google นี้ที่');
  console.log('Firebase Console > Project settings > Users and permissions');
  process.exit(1);
}
console.log(`\nเสร็จแล้ว เปิด https://${PROJECT}.web.app แล้วกด Ctrl+Shift+R`);
