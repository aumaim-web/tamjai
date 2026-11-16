// users.js — ผู้ใช้และสิทธิ์ (เจ้าของร้านเท่านั้น): เพิ่มบัญชีพนักงาน เปลี่ยนบทบาท ระงับสิทธิ์ และดูตารางสิทธิ์ของแต่ละบทบาท
const STAFF_ROLE_OPTS=['เจ้าของร้าน','ฝ่ายการเงิน','ฝ่ายคลังสินค้า','ฝ่ายรับออเดอร์'];
const roleKey=n=>({'เจ้าของร้าน':'owner','ฝ่ายการเงิน':'finance','ฝ่ายคลังสินค้า':'stock','ฝ่ายรับออเดอร์':'kitchen','ลูกค้า':'customer'})[n];
const PERMS=[ // [ความสามารถ, owner, finance, stock, kitchen, customer]
  ['ดูเมนู / สั่งอาหาร / ติดตามออเดอร์ตัวเอง','✓','✓','—','—','✓'],
  ['รับออเดอร์ลูกค้า / ทำอาหาร / กดทำเสร็จ (หน้าครัว)','✓','✓ (รับอัตโนมัติ)','—','✓','—'],
  ['ขายหน้าร้าน รับเงิน ปิดบิล','✓','✓','—','—','—'],
  ['ดูคำสั่งซื้อ / เสิร์ฟ / จัดการโต๊ะ','✓','✓','✓','—','—'],
  ['ขอยกเลิกออเดอร์','✓ (ยกเลิกเอง)','✓ (รออนุมัติ)','—','—','—'],
  ['อนุมัติ/ปฏิเสธการยกเลิก','✓','—','—','—','—'],
  ['ลูกค้าสมาชิก / บิล / รายงานยอดขาย / เมนูขายดี','✓','✓','—','—','—'],
  ['สต็อก: รับเข้า/เบิกออก/เพิ่ม/แก้ไข','✓','—','✓','—','—'],
  ['ลบวัตถุดิบ / จัดการเมนู / พนักงาน / โต๊ะ+QR','✓','—','—','—','—'],
  ['ผู้ใช้และสิทธิ์ / Audit Log / รีเซ็ตข้อมูล','✓','—','—','—','—'],
];
R.users=async()=>{
  $('#main').innerHTML='<div class="head"><h1>ผู้ใช้และสิทธิ์</h1></div><div class="panel empty">กำลังโหลด…</div>';
  let list;
  try{list=await api('/api/users')}catch(e){if(view==='users')$('#main').innerHTML=`<div class="panel empty">${esc(e.message)}</div>`;return}
  if(view!=='users')return;
  const staff=list.filter(u=>u.role!=='customer'),custs=list.filter(u=>u.role==='customer');
  const rowHtml=u=>`<tr><td>${esc(u.name)}${u.me?' <span class="sub">(คุณ)</span>':''}</td><td>${esc(u.email)}</td><td><span class="pill ${u.role==='customer'?'p-cancel':u.role==='owner'?'p-paid':'p-served'}" style="text-decoration:none">${ROLE_NAME[u.role]||u.role}</span></td><td>${u.me?'':`<button class="btn sm" data-ed="${u.id}">เปลี่ยนบทบาท</button>`}</td></tr>`;
  $('#main').innerHTML=`<div class="head"><h1>ผู้ใช้และสิทธิ์</h1><span class="sub">พนักงาน ${staff.length} · ลูกค้าที่สมัคร ${custs.length}</span><span class="grow"></span><button class="btn primary" id="addU">เพิ่มบัญชีพนักงาน</button></div>
  <div class="panel tablewrap" style="margin-bottom:16px"><h2>บัญชีพนักงาน</h2><table><thead><tr><th>ชื่อ</th><th>อีเมล</th><th>บทบาท</th><th></th></tr></thead><tbody>${staff.map(rowHtml).join('')}</tbody></table></div>
  <div class="panel tablewrap" style="margin-bottom:16px"><h2>ตารางสิทธิ์ของแต่ละบทบาท</h2><table><thead><tr><th>ความสามารถ</th><th>เจ้าของร้าน</th><th>ฝ่ายการเงิน</th><th>ฝ่ายคลังสินค้า</th><th>ฝ่ายรับออเดอร์</th><th>ลูกค้า</th></tr></thead><tbody>${PERMS.map(p=>`<tr><td>${p[0]}</td>${p.slice(1).map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <p class="sub">สิทธิ์ถูกบังคับที่ฐานข้อมูลโดยตรง ไม่ใช่แค่ซ่อนปุ่มในหน้าเว็บ · เปลี่ยนบทบาทแล้วมีผลกับฐานข้อมูลทันที (หน้าจอของผู้ใช้นั้นอัปเดตเมื่อเข้าสู่ระบบใหม่)</p></div>
  <div class="panel tablewrap"><h2>ลูกค้าที่สมัครสมาชิก (${custs.length})</h2>${custs.length?`<table><thead><tr><th>ชื่อ</th><th>อีเมล</th><th>บทบาท</th><th></th></tr></thead><tbody>${custs.map(rowHtml).join('')}</tbody></table>`:'<div class="empty">ยังไม่มีลูกค้าสมัคร</div>'}</div>`;
  $('#addU').onclick=()=>openForm('เพิ่มบัญชีพนักงาน',[
    {id:'name',label:'ชื่อที่แสดง',req:true},{id:'email',label:'อีเมล (ใช้ล็อกอิน)',type:'email',req:true},
    {id:'password',label:'รหัสผ่านเริ่มต้น (อย่างน้อย 6 ตัว)',type:'password',req:true},
    {id:'role',label:'บทบาท',type:'select',options:STAFF_ROLE_OPTS,value:'ฝ่ายการเงิน'}],
    v=>act(()=>api('/api/users',{method:'POST',body:{name:v.name,email:v.email,password:v.password,role:roleKey(v.role)}}),'เพิ่มบัญชี '+v.email+' แล้ว'),'สร้างบัญชี');
  $('#main').querySelectorAll('[data-ed]').forEach(b=>b.onclick=()=>{const u=list.find(u=>u.id===b.dataset.ed);
    openForm('เปลี่ยนบทบาท '+u.email,[{id:'role',label:'บทบาท (เลือก "ลูกค้า" = ระงับสิทธิ์พนักงาน)',type:'select',options:[...STAFF_ROLE_OPTS,'ลูกค้า'],value:ROLE_NAME[u.role]}],
      v=>act(()=>api('/api/users/'+u.id,{method:'PUT',body:{role:roleKey(v.role)}}),'เปลี่ยนบทบาท '+u.email+' เป็น '+v.role+' แล้ว').then(ok=>{if(ok&&view==='users')R.users();return ok}),'บันทึก')});
};
