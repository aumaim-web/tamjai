// customers.js — หน้าลูกค้า
R.cust=()=>{
  const spent=id=>S.payments.filter(p=>p.status==='paid'&&S.orders.find(o=>o.id===p.order)?.cust===id).reduce((a,p)=>a+p.amount,0);
  const visits=id=>S.orders.filter(o=>o.cust===id&&o.status!=='cancelled').length;
  const list=S.customers.filter(c=>c.id!=='c0');
  $('#main').innerHTML=`<div class="head"><h1>ลูกค้าสมาชิก</h1><span class="sub">${list.length} คน · สะสม 1 แต้มทุก ฿25</span><span class="grow"></span><button class="btn primary" id="addC">เพิ่มลูกค้า</button></div>
  <div class="panel tablewrap"><table><thead><tr><th>ชื่อ</th><th>เบอร์โทร</th><th class="r">มาใช้บริการ</th><th class="r">ยอดใช้จ่ายรวม</th><th class="r">แต้มสะสม</th><th></th></tr></thead><tbody>
  ${list.map(c=>`<tr><td>${esc(c.name)}</td><td class="num">${esc(c.phone)}</td><td class="r num">${visits(c.id)} ครั้ง</td><td class="r num">${baht(spent(c.id))}</td><td class="r num">${c.points}</td><td><button class="btn sm" data-ed="${c.id}">แก้ไข</button></td></tr>`).join('')}</tbody></table></div>`;
  const form=(c)=>openForm(c?'แก้ไขข้อมูลลูกค้า':'เพิ่มลูกค้าใหม่',[{id:'name',label:'ชื่อ-นามสกุล',value:c?.name,req:true},{id:'phone',label:'เบอร์โทร',type:'tel',value:c?.phone,req:true}],v=>act(()=>c?api('/api/customers/'+c.id,{method:'PUT',body:v}):api('/api/customers',{method:'POST',body:v}),c?'บันทึกข้อมูลลูกค้าแล้ว':'เพิ่มลูกค้า '+v.name+' แล้ว'));
  $('#addC').onclick=()=>form();
  $('#main').querySelectorAll('[data-ed]').forEach(b=>b.onclick=()=>form(S.customers.find(c=>c.id===b.dataset.ed)));
};

