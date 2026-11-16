// serve.js — เปิดหน้าเว็บในเครื่อง (ใช้ฐานข้อมูลจริงบน Firebase) ไม่ต้องติดตั้งอะไรเพิ่มนอกจาก Node.js
// ใช้: node tools/serve.js [พอร์ต]   แล้วเปิด http://localhost:5000
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'public');
const port = +process.argv[2] || +process.env.PORT || 5000;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('ไม่พบไฟล์');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).on('error', e => {
  console.error(e.code === 'EADDRINUSE' ? `พอร์ต ${port} ถูกใช้อยู่ ลองปิดโปรแกรมที่ใช้พอร์ตนี้ หรือรัน: node tools/serve.js 5050` : e.message);
  process.exit(1);
}).listen(port, () => {
  console.log(`หน้าเว็บร้านตามใจเปิดอยู่ที่ http://localhost:${port}  (ใช้ฐานข้อมูลจริงบน Firebase · กด Ctrl+C เพื่อหยุด)`);
});
