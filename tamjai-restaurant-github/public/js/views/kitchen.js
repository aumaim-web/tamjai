// kitchen.js — หน้าครัว / ฝ่ายรับออเดอร์: ออเดอร์ที่ลูกค้าสั่งขึ้นที่นี่ทันที (real-time) เรียงจากเก่าไปใหม่
// กด "ทำเสร็จแล้ว" → ออเดอร์เปลี่ยนเป็นเสร็จ และลูกค้าที่ติดตามอยู่เห็นสถานะเปลี่ยนในมือถือทันที
const LATE_MIN=15; // รอนานกว่านี้ (นาที) การ์ดเป็นสีแดง
const ageText=t=>{const m=Math.max(0,Math.floor((Date.now()-t)/60000));return m<1?'เพิ่งสั่ง':m<60?`รอ ${m} นาที`:`รอ ${Math.floor(m/60)} ชม. ${m%60} นาที`};

R.kitchen=()=>{
  const cooking=S.orders.filter(o=>o.status==='cooking').sort((a,b)=>a.time-b.time);
  const done=S.orders.filter(o=>o.status==='served'&&dkey(o.time)===today()).slice(-8).reverse();
  const card=o=>{const late=Date.now()-o.time>LATE_MIN*60000;
    return `<div class="kcard${late?' late':''}" data-at="${o.time}">
    <div class="kh"><b>${o.id}</b><span class="kt">${o.table?'โต๊ะ '+esc(o.table):'กลับบ้าน'}</span><span class="k-age">${ageText(o.time)}</span></div>
    <ul>${o.items.map(x=>`<li><span class="q">${x.q}×</span>${esc(menuName(x.m))}${x.note?`<span class="kn">📝 ${esc(x.note)}</span>`:''}</li>`).join('')}</ul>
    ${o.email?`<div class="sub">ลูกค้า: ${esc(o.email)}</div>`:''}
    ${o.cancelReq?`<div><span class="pill p-pend">มีคำขอยกเลิก</span> <span class="sub">${esc(o.cancelReq.reason)}</span></div>`:''}
    <button class="btn good" data-done="${o.id}">✓ ทำเสร็จแล้ว</button></div>`};
  $('#main').innerHTML=`<div class="head"><h1>ครัว / รับออเดอร์</h1><span class="sub">ออเดอร์ใหม่ขึ้นเองอัตโนมัติ · กด "ทำเสร็จแล้ว" เมื่ออาหารพร้อม ลูกค้าจะเห็นสถานะทันที</span></div>
  <div class="kpis" style="grid-template-columns:repeat(2,minmax(0,1fr))">
    <div class="kpi${cooking.length?' alert':''}"><div class="l">กำลังทำ</div><div class="v num">${cooking.length}</div><div class="d">ออเดอร์</div></div>
    <div class="kpi"><div class="l">ทำเสร็จวันนี้</div><div class="v num">${S.orders.filter(o=>o.status==='served'&&dkey(o.time)===today()).length}</div><div class="d">ออเดอร์</div></div>
  </div>
  ${cooking.length?`<div class="kq">${cooking.map(card).join('')}</div>`:'<div class="panel empty" style="margin-bottom:22px">ยังไม่มีออเดอร์ที่ต้องทำ — ออเดอร์ใหม่จะขึ้นที่นี่ทันทีเมื่อลูกค้าสั่ง</div>'}
  <div class="panel tablewrap"><h2>ทำเสร็จล่าสุด (วันนี้)</h2>${done.length?`<table><thead><tr><th>เลขที่</th><th>เวลาสั่ง</th><th>โต๊ะ</th><th>รายการ</th></tr></thead><tbody>${done.map(o=>`<tr><td class="num"><b>${o.id}</b></td><td class="num">${ttime(o.time)}</td><td>${esc(o.table)||'-'}</td><td>${itemsText(o)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">ยังไม่มี</div>'}</div>`;
  $('#main').querySelectorAll('[data-done]').forEach(b=>b.onclick=()=>{b.disabled=true;
    act(()=>api(`/api/orders/${b.dataset.done.slice(1)}/serve`,{method:'PATCH'}),`ออเดอร์ ${b.dataset.done} ทำเสร็จแล้ว`).then(ok=>{if(!ok)b.disabled=false})});
};
// อัปเดตเวลารอบนการ์ดทุก 30 วินาที (ไม่ต้องวาดหน้าใหม่)
setInterval(()=>{if(view!=='kitchen')return;
  $('#main').querySelectorAll('.kcard[data-at]').forEach(c=>{const t=+c.dataset.at;c.querySelector('.k-age').textContent=ageText(t);c.classList.toggle('late',Date.now()-t>LATE_MIN*60000)})},30000);
