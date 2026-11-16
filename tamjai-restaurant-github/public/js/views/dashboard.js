// dashboard.js — หน้าภาพรวม
R.dash=()=>{
  const t=today();const yest=new Date();yest.setDate(yest.getDate()-1);const y=dkey(yest);
  const paidOn=k=>S.payments.filter(p=>p.status==='paid'&&dkey(p.time)===k).reduce((a,p)=>a+p.amount,0);
  const sT=paidOn(t),sY=paidOn(y);
  const ordT=S.orders.filter(o=>dkey(o.time)===t&&o.status!=='cancelled');
  const pend=S.payments.filter(p=>p.status==='pending');
  const low=lowStock();
  const diff=sY?Math.round((sT-sY)/sY*100):0;
  const days=[];for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push({k:dkey(d),d,v:paidOn(dkey(d))})}
  const recent=S.orders.slice(-6).reverse();
  const cancelReqs=S.orders.filter(o=>o.cancelReq&&o.status!=='cancelled');
  $('#main').innerHTML=`
  <div class="head"><h1>ภาพรวมร้านวันนี้</h1><span class="sub">${new Date().toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span></div>
  ${cancelReqs.length&&role==='owner'?`<div class="panel" style="margin-bottom:12px;border-color:var(--warn);background:var(--warn-soft)"><b>มีคำขอยกเลิกรออนุมัติ ${cancelReqs.length} ออเดอร์</b> · ${cancelReqs.slice(0,3).map(o=>`${o.id} (${esc(o.cancelReq.by)}: ${esc(o.cancelReq.reason)})`).join(' · ')} <button class="btn sm" data-go="orders" style="margin-left:8px">ไปอนุมัติ</button></div>`:''}
  <div class="kpis">
    <div class="kpi"><div class="l">ยอดขายวันนี้ (รับเงินแล้ว)</div><div class="v num">${baht(sT)}</div><div class="d">เมื่อวาน ${baht(sY)}${sY?` · ${diff>=0?'+':''}${diff}%`:''}</div></div>
    <div class="kpi"><div class="l">ออเดอร์วันนี้</div><div class="v num">${ordT.length}</div><div class="d">กำลังทำ ${ordT.filter(o=>o.status==='cooking').length} ออเดอร์</div></div>
    <div class="kpi ${pend.length?'alert':''}"><div class="l">รอชำระเงิน</div><div class="v num">${pend.length} บิล</div><div class="d">รวม ${baht(pend.reduce((a,p)=>a+p.amount,0))}</div></div>
    <div class="kpi ${low.length?'alert':''}"><div class="l">วัตถุดิบต่ำกว่าขั้นต่ำ</div><div class="v num">${low.length} รายการ</div><div class="d">${low.slice(0,3).map(s=>esc(s.name)).join(', ')||'สต็อกปกติ'}</div></div>
  </div>
  <div class="two">
    <div class="panel"><h2>ยอดขาย 7 วันล่าสุด</h2>${barChart(days)}</div>
    <div class="panel"><h2>ต้องสั่งวัตถุดิบเพิ่ม</h2>${low.length?`<table><thead><tr><th>วัตถุดิบ</th><th class="r">คงเหลือ</th><th class="r">ขั้นต่ำ</th></tr></thead><tbody>${low.map(s=>`<tr><td>${esc(s.name)}</td><td class="r num" style="color:var(--bad)">${fmtQ(s.qty)} ${s.unit}</td><td class="r num">${fmtQ(s.min)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">วัตถุดิบทุกรายการยังพอใช้</div>'}</div>
  </div>
  <div class="panel" style="margin-top:16px"><div class="head" style="margin-bottom:8px"><h2 style="margin:0">ออเดอร์ล่าสุด</h2><span class="grow"></span><button class="btn sm" data-go="orders">ดูทั้งหมด</button></div>
  <div class="tablewrap">${ordersTable(recent,false)}</div></div>`;
  $('#main').querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
};
