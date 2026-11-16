// track.js — หน้าติดตามออเดอร์ของลูกค้า: ดูสถานะแบบสดๆ จากรหัสคิวที่ได้ตอนสั่ง (เก็บไว้ในเครื่องลูกค้า)
let trackUnsubs=[];
let memTickets=[];
function loadTickets(){try{return JSON.parse(localStorage.getItem('tamjai-tickets')||'[]')}catch(e){return memTickets}}
function rememberTicket(t){
  const list=[t,...loadTickets().filter(x=>x.id!==t.id)].slice(0,15);
  memTickets=list;
  try{localStorage.setItem('tamjai-tickets',JSON.stringify(list))}catch(e){}
}
function clearTrack(){trackUnsubs.forEach(u=>u());trackUnsubs=[]}

// ข้อความ/สีสถานะตามข้อมูลใน track (ไม่มีข้อมูล = ฝ่ายรับออเดอร์ยังไม่รับ)
// แถบความคืบหน้า 3 ขั้น: ส่งออเดอร์แล้ว → ครัวกำลังทำ → ทำเสร็จแล้ว
const steps=n=>`<div class="ksteps" aria-hidden="true">${[0,1,2].map(i=>`<span class="${i<n?'on':i===n?'now':''}"></span>`).join('')}</div>`;
function trackStatus(d){
  if(!d)return {pill:'<span class="pill p-pend">รอร้านรับออเดอร์</span>'+steps(0),text:'ออเดอร์ถึงร้านแล้ว รอฝ่ายรับออเดอร์รับ'};
  if(d.status==='rejected')return {pill:'<span class="pill p-cancel">รับออเดอร์ไม่ได้</span>',text:d.reason||''};
  if(d.status==='cancelled')return {pill:'<span class="pill p-cancel">ยกเลิก</span>',text:d.reason||''};
  const pay=d.paid?'<span class="pill p-paid">ชำระแล้ว</span>':'<span class="pill p-pend">ชำระที่เคาน์เตอร์</span>';
  const done=d.status==='served';
  return {pill:(done?'<span class="pill p-served">ทำเสร็จแล้ว</span>':'<span class="pill p-cook">กำลังทำอาหาร</span>')+' '+pay+(done?steps(3):steps(1)),
    text:(d.order?'ออเดอร์ '+d.order+' · ':'')+(done?'อาหารของคุณเสร็จแล้ว กำลังนำไปเสิร์ฟ':'ครัวกำลังทำอาหารของคุณอยู่')};
}

R.track=()=>{
  const list=loadTickets();
  $('#main').innerHTML=`<div class="head"><h1>ติดตามออเดอร์</h1><span class="sub">สถานะอัปเดตเองทันทีเมื่อครัวรับออเดอร์/ทำเสร็จ</span></div>
  ${list.length?list.map(t=>`<div class="panel" style="margin-bottom:12px" data-t="${esc(t.id)}"><div class="head" style="margin-bottom:6px"><h2 style="margin:0">${t.table?'โต๊ะ '+esc(t.table):'ออเดอร์'} · ${new Date(t.at).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</h2><span class="grow"></span><span class="num"><b>${baht(t.total)}</b></span></div><div class="t-status"></div><div class="sub t-text"></div><div class="t-items sub" style="margin-top:6px"></div></div>`).join(''):'<div class="panel empty">ยังไม่มีออเดอร์ — สั่งอาหารที่เมนู "สั่งอาหาร" แล้วสถานะจะมาแสดงที่นี่</div>'}`;
  list.forEach(t=>{
    const card=$('#main').querySelector(`[data-t="${CSS.escape(t.id)}"]`);
    trackUnsubs.push(watchTrack(t.id,d=>{
      if(!card.isConnected)return;
      const s=trackStatus(d);
      card.querySelector('.t-status').innerHTML=s.pill;
      card.querySelector('.t-text').textContent=s.text;
      card.querySelector('.t-items').innerHTML=d&&d.items?d.items.map(x=>esc(menuName(x.m))+(x.q>1?' ×'+x.q:'')+(x.note?` (${esc(x.note)})`:'')).join(', '):'';
    }));
  });
};
