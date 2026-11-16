// payments.js — หน้าการชำระเงิน
R.pay=()=>{
  const pend=S.payments.filter(p=>p.status==='pending');
  const paid=S.payments.filter(p=>p.status==='paid').slice().sort((a,b)=>b.time-a.time).slice(0,40);
  const ord=id=>S.orders.find(o=>o.id===id);
  $('#main').innerHTML=`<div class="head"><h1>การชำระเงิน</h1><span class="sub">รอชำระ ${pend.length} บิล รวม ${baht(pend.reduce((a,p)=>a+p.amount,0))}</span></div>
  <div class="panel tablewrap" style="margin-bottom:16px"><h2>บิลที่รอชำระ</h2>
  ${pend.length?`<table><thead><tr><th>ออเดอร์</th><th>เวลาสั่ง</th><th>โต๊ะ</th><th>ลูกค้า</th><th class="r">ยอด</th><th></th></tr></thead><tbody>${pend.map(p=>{const o=ord(p.order);return `<tr><td class="num"><b>${o.id}</b></td><td class="num">${ttime(o.time)}</td><td>${esc(o.table)||'-'}</td><td>${esc(orderCust(o))}</td><td class="r num"><b>${baht(p.amount)}</b></td><td style="white-space:nowrap">${METHODS.map(m=>`<button class="btn sm" data-pay="${p.id}" data-m="${m}">${m}</button>`).join(' ')}</td></tr>`}).join('')}</tbody></table>`:'<div class="empty">ไม่มีบิลค้างชำระ</div>'}</div>
  <div class="panel tablewrap"><h2>รับชำระล่าสุด</h2><table><thead><tr><th>เวลา</th><th>ออเดอร์</th><th>ลูกค้า</th><th>วิธีชำระ</th><th class="r">ยอด</th></tr></thead><tbody>
  ${paid.map(p=>{const o=ord(p.order);return `<tr><td class="num">${dkey(p.time)===today()?'':tday(p.time)+' '}${ttime(p.time)}</td><td class="num">${p.order}</td><td>${esc(orderCust(o))}</td><td>${p.method}</td><td class="r num">${baht(p.amount)}</td></tr>`}).join('')}</tbody></table></div>`;
  $('#main').querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>act(()=>api(`/api/payments/${b.dataset.pay}/pay`,{method:'POST',body:{method:b.dataset.m}}),r=>`รับชำระ ${baht(r.amount)} (${r.method}) แล้ว`));
};

