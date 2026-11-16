// state.js — ข้อมูลที่หน้าจอถืออยู่ (โหลดจากเซิร์ฟเวอร์) + ตัวช่วยค้นข้อมูล
let S={menu:[],tables:[],stock:[],customers:[],employees:[],orders:[],payments:[]};
// โต๊ะจากการสแกน QR (เปิดเว็บด้วย ?table=ชื่อโต๊ะ) — ลูกค้าไม่ต้องเลือกโต๊ะเอง
const QR_TABLE=(()=>{try{return(new URLSearchParams(location.search).get('table')||'').trim().slice(0,20)}catch(e){return''}})();
let role='customer', view='pos';
const pos={q:'',cat:'ทั้งหมด',cart:[],cust:'c0',table:'',method:'เงินสด'};
let repTab='sales', ordFilter='all', ordQ='';
const custName=id=>(S.customers.find(c=>c.id===id)||{name:'-'}).name;
const orderCust=o=>(o&&o.email)||custName(o&&o.cust); // ออเดอร์ที่ลูกค้าล็อกอินสั่งเอง แสดงอีเมลของลูกค้า
const payOf=o=>S.payments.find(p=>p.order===o.id);
const menuName=id=>(MENU.find(m=>m.id===id)||{name:id}).name;
const lowStock=()=>S.stock.filter(s=>s.qty<s.min);
const R={}; // ฟังก์ชันวาดแต่ละหน้า (เติมจากไฟล์ใน js/views)
