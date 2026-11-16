// firebase-config.js — ค่าเชื่อมต่อโปรเจกต์ Firebase (คีย์ชุดนี้เป็นค่าสาธารณะ ไม่ใช่ความลับ
// ความปลอดภัยของข้อมูลอยู่ที่ firestore.rules ไม่ใช่ที่คีย์นี้)
var FIREBASE_CONFIG = {
  apiKey: 'AIzaSyA9WoKrlyUlRyxlDLSO7IO8qUwq3ioKIe0',
  authDomain: 'tamjaifood230.firebaseapp.com',
  projectId: 'tamjaifood230',
  storageBucket: 'tamjaifood230.firebasestorage.app',
  messagingSenderId: '1086483235737',
  appId: '1:1086483235737:web:32cfbd1b74762f388c0908',
};
// เปิดหน้าเว็บด้วย ?emulator เพื่อทดลองกับ Firebase Emulator ในเครื่องแทนของจริง
var USE_EMULATOR = typeof location !== 'undefined' && /[?&]emulator\b/.test(location.search);
// อีเมลพนักงานทุกบัญชีลงท้ายด้วยโดเมนนี้ (เช่น owner@tamjaifood230.web.app) พิมพ์แค่ชื่อ เช่น owner ก็ได้
// ลูกค้าสมัครด้วยอีเมลอะไรก็ได้ ยกเว้นโดเมนนี้ — ต้องตรงกับ tools/create-users.js
var EMAIL_DOMAIN = '@tamjaifood230.web.app';
