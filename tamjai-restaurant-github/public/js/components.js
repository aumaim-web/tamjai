// components.js — ชิ้นส่วนที่ใช้หลายหน้า: ป้ายสถานะ, ตารางออเดอร์, กราฟแท่ง
function statusPill(o){
  if(o.status==='cancelled')return '<span class="pill p-cancel">ยกเลิก</span>'+(o.cancelReason?`<div class="sub">${esc(o.cancelReason)}</div>`:'');
  const base=o.status==='cooking'?'<span class="pill p-cook">กำลังทำ</span>':'<span class="pill p-served">เสิร์ฟแล้ว</span>';
  return o.cancelReq?base+`<div><span class="pill p-pend">รออนุมัติยกเลิก</span></div><div class="sub">${esc(o.cancelReq.by)}: ${esc(o.cancelReq.reason)}</div>`:base;
}
// รายการอาหารในออเดอร์ พร้อมหมายเหตุ เช่น "ผัดไทย ×2 (ไม่ใส่ถั่ว)"
const itemsText=o=>o.items.map(x=>esc(menuName(x.m))+(x.q>1?' ×'+x.q:'')+(x.note?` <span class="sub">(${esc(x.note)})</span>`:'')).join(', ');
// ปุ่มยกเลิกของออเดอร์ (เจ้าของร้าน = ยกเลิกเลย · ฝ่ายการเงิน = ขอยกเลิก รอเจ้าของร้านอนุมัติ)
function cancelButtons(o){
  if(o.status==='cancelled'||payOf(o)?.status!=='pending'||role==='stock'||role==='kitchen')return '';
  if(o.cancelReq)return role==='owner'?`<button class="btn sm good" data-capp="${o.id}">อนุมัติยกเลิก</button> <button class="btn sm" data-crej="${o.id}">ปฏิเสธ</button>`:'';
  return `<button class="btn sm danger" data-cancel="${o.id}">${role==='owner'?'ยกเลิก':'ขอยกเลิก'}</button>`;
}
function payPill(o){const p=payOf(o);if(!p)return '<span class="sub">-</span>';return p.status==='paid'?'<span class="pill p-paid">ชำระแล้ว</span>':'<span class="pill p-pend">รอชำระ</span>'}
function ordersTable(list,actions){
  if(!list.length)return '<div class="empty">ไม่มีคำสั่งซื้อตามเงื่อนไขนี้</div>';
  return `<table><thead><tr><th>เลขที่</th><th>เวลา</th><th>โต๊ะ</th><th>ลูกค้า</th><th>รายการ</th><th class="r">ยอดรวม</th><th>สถานะ</th><th>ชำระเงิน</th>${actions?'<th></th>':''}</tr></thead><tbody>
  ${list.map(o=>`<tr><td class="num"><b>${o.id}</b></td><td class="num">${dkey(o.time)===today()?'':tday(o.time)+' '}${ttime(o.time)}</td><td>${esc(o.table)||'-'}</td><td>${esc(orderCust(o))}</td>
  <td style="max-width:260px">${itemsText(o)}</td><td class="r num">${baht(total(o))}</td><td>${statusPill(o)}</td><td>${payPill(o)}</td>
  ${actions?`<td style="white-space:nowrap">${o.status==='cooking'?`<button class="btn sm" data-serve="${o.id}">เสิร์ฟแล้ว</button> `:''}${cancelButtons(o)}</td>`:''}</tr>`).join('')}</tbody></table>`;
}

function barChart(days){
  const W=640,H=230,L=56,B=30,T=24;const max=Math.max(...days.map(d=>d.v),1);
  const step=niceStep(max/4);const top=Math.ceil(max/step)*step;
  const sy=v=>H-B-(v/top)*(H-B-T);const bw=(W-L-10)/days.length;
  let g='';for(let v=0;v<=top;v+=step){g+=`<line x1="${L}" x2="${W-6}" y1="${sy(v)}" y2="${sy(v)}" stroke="var(--line)"/><text x="${L-8}" y="${sy(v)+4}" text-anchor="end" font-size="11" fill="var(--muted)">${v>=1000?(v/1000)+'k':v}</text>`}
  const bars=days.map((d,i)=>{const x=L+i*bw+bw*.18,w=bw*.64,y=sy(d.v),last=i===days.length-1;
    return `<rect x="${x}" y="${y}" width="${w}" height="${H-B-y}" rx="6" fill="url(#barg)" opacity="${last?1:.5}"/>
    <text x="${x+w/2}" y="${y-6}" text-anchor="middle" font-size="11" fill="var(--ink)" ${last?'font-weight="600"':''}>${d.v?Math.round(d.v).toLocaleString('th-TH'):''}</text>
    <text x="${x+w/2}" y="${H-10}" text-anchor="middle" font-size="11" fill="var(--muted)">${last?'วันนี้':d.d.toLocaleDateString('th-TH',{weekday:'short',day:'numeric'})}</text>`}).join('');
  return `<div class="tablewrap"><svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="กราฟยอดขาย 7 วัน" style="min-width:420px;font-family:inherit"><defs><linearGradient id="barg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--gold)"/><stop offset="1" style="stop-color:var(--accent-2)"/></linearGradient></defs>${g}${bars}</svg></div>`;
}
