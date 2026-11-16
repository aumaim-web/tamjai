// orders.js — หน้าคำสั่งซื้อ
R.orders=()=>{
  const list=S.orders.filter(o=>(ordFilter==='all'||o.status===ordFilter||(ordFilter==='pending'&&payOf(o)?.status==='pending'))&&(!ordQ||o.id.includes(ordQ)||orderCust(o).includes(ordQ)||o.table===ordQ)).slice().reverse().slice(0,150);
  const cnt=f=>f==='all'?S.orders.length:f==='pending'?S.payments.filter(p=>p.status==='pending').length:S.orders.filter(o=>o.status===f).length;
  const F=[['all','ทั้งหมด'],['cooking','กำลังทำ'],['served','เสิร์ฟแล้ว'],['pending','รอชำระ'],['cancelled','ยกเลิก']];
  $('#main').innerHTML=`<div class="head"><h1>คำสั่งซื้อ</h1><span class="grow"></span><input type="search" id="oq" placeholder="ค้นหาเลขที่ ชื่อลูกค้า หรือโต๊ะ" value="${esc(ordQ)}" aria-label="ค้นหาคำสั่งซื้อ"></div>
  <div class="chips">${F.map(([k,l])=>`<button class="chip" data-f="${k}" aria-pressed="${k===ordFilter}">${l} <span class="num">${cnt(k)}</span></button>`).join('')}</div>
  <div class="panel tablewrap">${ordersTable(list,true)}</div>`;
  $('#oq').oninput=e=>{ordQ=e.target.value.trim();const p=e.target.selectionStart;R.orders();const n=$('#oq');n.focus();n.setSelectionRange(p,p)};
  $('#main').querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{ordFilter=b.dataset.f;R.orders()});
  $('#main').querySelectorAll('[data-serve]').forEach(b=>b.onclick=()=>act(()=>api(`/api/orders/${b.dataset.serve.slice(1)}/serve`,{method:'PATCH'}),`ออเดอร์ ${b.dataset.serve} เสิร์ฟแล้ว`));
  bindCancelButtons();
};
// ปุ่มยกเลิก/อนุมัติ/ปฏิเสธ (ใช้ร่วมกับหน้าจัดการโต๊ะ) — ต้องใส่เหตุผลทุกครั้ง
function bindCancelButtons(){
  const find=id=>S.orders.find(o=>o.id===id);
  $('#main').querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>{const o=find(b.dataset.cancel);const owner=role==='owner';
    openForm((owner?'ยกเลิกออเดอร์ ':'ขอยกเลิกออเดอร์ ')+o.id,[
      {id:'n',type:'note',label:'',value:esc(owner?`ยกเลิกออเดอร์ยอด ${baht(total(o))} และคืนวัตถุดิบเข้าสต็อก`:`ส่งคำขอให้เจ้าของร้านอนุมัติ (ยอด ${baht(total(o))}) ยังไม่ยกเลิกจนกว่าจะอนุมัติ`)},
      {id:'reason',label:'เหตุผล',req:true}],
      v=>act(()=>api(`/api/orders/${o.id.slice(1)}/cancel`,{method:'POST',body:{reason:v.reason}}),r=>r.requested?'ส่งคำขอยกเลิก '+o.id+' แล้ว รอเจ้าของร้านอนุมัติ':'ยกเลิกออเดอร์ '+o.id+' แล้ว'),owner?'ยืนยันยกเลิก':'ส่งคำขอ')});
  $('#main').querySelectorAll('[data-capp]').forEach(b=>b.onclick=()=>{const o=find(b.dataset.capp);
    confirmBox('อนุมัติยกเลิก '+o.id,`${o.cancelReq.by} ขอยกเลิก: ${o.cancelReq.reason} — ยอด ${baht(total(o))} จะคืนวัตถุดิบเข้าสต็อก`,()=>act(()=>api(`/api/orders/${o.id.slice(1)}/cancel/approve`,{method:'POST'}),'อนุมัติยกเลิก '+o.id+' แล้ว'),'อนุมัติ')});
  $('#main').querySelectorAll('[data-crej]').forEach(b=>b.onclick=()=>{const o=find(b.dataset.crej);
    confirmBox('ปฏิเสธคำขอยกเลิก '+o.id,`ออเดอร์ ${o.id} จะกลับไปเป็นปกติ`,()=>act(()=>api(`/api/orders/${o.id.slice(1)}/cancel/reject`,{method:'POST'}),'ปฏิเสธคำขอยกเลิก '+o.id+' แล้ว'),'ปฏิเสธ')});
}

