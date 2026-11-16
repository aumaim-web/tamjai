// config.js — ค่าคงที่: ไอคอน, หน้าจอและสิทธิ์แต่ละบทบาท, วิธีชำระ, หมวดเมนู
const ICON={
 dash:'<path d="M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z"/>',
 pos:'<path d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM5.2 4H2V2h4.6l1 2H21l-3.5 8H8.1l-1 2H19v2H4l2.4-4.7z"/>',
 orders:'<path d="M6 2h12l2 3v17H4V5zm0 4v14h12V6zm2 3h8v2H8zm0 4h8v2H8z"/>',
 pay:'<path d="M2 5h20v14H2zm2 2v2h16V7zm0 5v5h16v-5zm2 2h5v1.5H6z"/>',
 cust:'<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5z"/>',
 emp:'<path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm7 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM9 13c-3.3 0-7 1.6-7 4.5V20h14v-2.5C16 14.6 12.3 13 9 13zm7.5.1c1.5 1 2.5 2.3 2.5 4.4V20h3v-2.5c0-2.6-3-4.1-5.5-4.4z"/>',
 stock:'<path d="M12 2 3 6.5v11L12 22l9-4.5v-11zm0 2.2 6.6 3.3L12 10.8 5.4 7.5zM5 9.1l6 3v7.6l-6-3zm8 10.6v-7.6l6-3v7.6z"/>',
 rep:'<path d="M4 20V10h3v10zm6.5 0V4h3v16zM17 20v-7h3v7z"/>',
 tables:'<path d="M3 10h18v2H3zm2 3h2v7H5zm12 0h2v7h-2zM6 4h12l2 4H4z"/>',
 kitchen:'<path d="M12 3a5 5 0 0 0-4.900 4A4 4 0 0 0 6 14.500V15h12v-.5a4 4 0 0 0-1.100-7.500A5 5 0 0 0 12 3zM6 16.500h12V21H6z"/>',
 track:'<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 5v5.2l4 2.4-1 1.7-5-3V7z"/>',
 users:'<path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5zm0 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0 14c-2.4-.9-4.4-3-5.4-5.6 1.4-1.2 3.4-1.9 5.4-1.9s4 .7 5.4 1.9C16.400 18 14.400 20.100 12 21z"/>',
 audit:'<path d="M6 2h9l5 5v15H6zm8 1.500V8h4.500zM8 12h8v2H8zm0 4h8v2H8z"/>',
 menu:'<path d="M8.1 13.34l2.83-2.83L3.91 3.5a4 4 0 0 0 0 5.66zm6.78-1.81c1.53.71 3.68.21 5.27-1.38a4 4 0 0 0 0-5.66c-1.59-1.59-3.74-2.09-5.27-1.38L12 5.91l-2.12 2.12 5 5zM3.9 18.8l7.1-7.1 1.4 1.4-7.1 7.1zM17 14l-1.4 1.4 4.3 4.3 1.4-1.4z"/>'
};
const VIEWS=[
 {id:'dash',label:'ภาพรวม',roles:['owner','finance','stock']},
 {id:'pos',label:'ขายหน้าร้าน',clabel:'สั่งอาหาร',roles:['owner','finance','customer']},
 {id:'track',label:'ติดตามออเดอร์',roles:['customer']},
 {id:'orders',label:'คำสั่งซื้อ',roles:['owner','finance','stock']},
 {id:'kitchen',label:'ครัว / รับออเดอร์',roles:['owner','kitchen']},
 {id:'tables',label:'จัดการโต๊ะ',roles:['owner','finance','stock']},
 {id:'pay',label:'การชำระเงิน',roles:['owner','finance']},
 {id:'cust',label:'ลูกค้า',roles:['owner','finance']},
 {id:'emp',label:'พนักงาน',roles:['owner']},
 {id:'stock',label:'สต็อกวัตถุดิบ',roles:['owner','stock']},
 {id:'menu',label:'จัดการเมนู',roles:['owner']},
 {id:'rep',label:'รายงาน',roles:['owner','finance']},
 {id:'users',label:'ผู้ใช้และสิทธิ์',roles:['owner']},
 {id:'audit',label:'Audit Log',roles:['owner']},
];
const ROLE_NAME={owner:'เจ้าของร้าน',finance:'ฝ่ายการเงิน',stock:'ฝ่ายคลังสินค้า',kitchen:'ฝ่ายรับออเดอร์',customer:'ลูกค้า'};
const METHODS=['เงินสด','โอน/พร้อมเพย์','บัตร'];
let MENU=[];
const CATS=['ทั้งหมด','จานเดียว','กับข้าว','ของหวาน','เครื่องดื่ม'];
