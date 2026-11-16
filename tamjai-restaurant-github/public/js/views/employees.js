// employees.js — หน้าพนักงาน
R.emp=()=>{
  const ROLES=['เจ้าของร้าน','ฝ่ายการเงิน','ฝ่ายคลังสินค้า','แคชเชียร์','พนักงานเสิร์ฟ','พ่อครัว','ผู้ช่วยครัว'];
  $('#main').innerHTML=`<div class="head"><h1>พนักงาน</h1><span class="sub">${S.employees.length} คน</span><span class="grow"></span><button class="btn primary" id="addE">เพิ่มพนักงาน</button></div>
  <div class="panel tablewrap"><table><thead><tr><th>ชื่อ</th><th>ตำแหน่ง</th><th>เบอร์โทร</th><th>เริ่มงาน</th><th></th></tr></thead><tbody>
  ${S.employees.map(e=>`<tr><td>${esc(e.name)}</td><td>${esc(e.role)}</td><td class="num">${esc(e.phone)}</td><td class="num">${e.start?new Date(e.start).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}):'-'}</td><td style="white-space:nowrap"><button class="btn sm" data-ed="${e.id}">แก้ไข</button> <button class="btn sm danger" data-del="${e.id}">ลบ</button></td></tr>`).join('')}</tbody></table></div>`;
  const form=e=>openForm(e?'แก้ไขข้อมูลพนักงาน':'เพิ่มพนักงานใหม่',[{id:'name',label:'ชื่อ-นามสกุล',value:e?.name,req:true},{id:'role',label:'ตำแหน่ง',type:'select',options:ROLES,value:e?.role||'พนักงานเสิร์ฟ'},{id:'phone',label:'เบอร์โทร',type:'tel',value:e?.phone},{id:'start',label:'วันเริ่มงาน',type:'date',value:e?.start||today()}],v=>act(()=>e?api('/api/employees/'+e.id,{method:'PUT',body:v}):api('/api/employees',{method:'POST',body:v}),e?'บันทึกข้อมูลพนักงานแล้ว':'เพิ่ม '+v.name+' แล้ว'));
  $('#addE').onclick=()=>form();
  $('#main').querySelectorAll('[data-ed]').forEach(b=>b.onclick=()=>form(S.employees.find(e=>e.id===b.dataset.ed)));
  $('#main').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{const e=S.employees.find(e=>e.id===b.dataset.del);confirmBox('ลบพนักงาน',`ลบ ${e.name} (${e.role}) ออกจากระบบ`,()=>act(()=>api('/api/employees/'+e.id,{method:'DELETE'}),'ลบ '+e.name+' แล้ว'),'ลบ')});
};

