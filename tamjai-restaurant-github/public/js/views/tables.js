// tables.js — จัดการโต๊ะ: สถานะโต๊ะ, เสิร์ฟ, สรุปยอด/ปิดบิลโต๊ะ, QR Code ของโต๊ะ (เจ้าของร้านเพิ่ม/แก้/ลบโต๊ะได้)
// โต๊ะ "มีออเดอร์" = มีออเดอร์ที่กำลังทำ หรือบิลที่ยังไม่ชำระ (ชำระครบแล้วโต๊ะกลับเป็นว่าง)
function tableInfo(name){
  const os=S.orders.filter(o=>o.table===name&&o.status!=='cancelled'&&(o.status==='cooking'||payOf(o)?.status==='pending'));
  const unpaid=os.filter(o=>payOf(o)?.status==='pending');
  return {os,cooking:os.filter(o=>o.status==='cooking').length,unpaid:unpaid.length,due:unpaid.reduce((a,o)=>a+(payOf(o)?.amount||0),0)};
}
// ลิงก์ที่ฝังใน QR ของโต๊ะ: เปิดเว็บแล้วโต๊ะถูกกรอกให้อัตโนมัติ
const tableUrl=name=>location.origin+location.pathname.replace(/index\.html$/,'')+'?table='+encodeURIComponent(name);
function qrSvg(text){const q=qrcode(0,'M');q.addData(text);q.make();return q.createSvgTag({cellSize:4,margin:2,scalable:true})}
function printQr(){document.body.classList.add('print-qr');window.print();setTimeout(()=>document.body.classList.remove('print-qr'),800)}

R.tables=()=>{
  const owner=role==='owner';
  const known=S.tables.map(t=>t.name);
  // ออเดอร์ที่มีโต๊ะไม่อยู่ในรายการ (เช่น กลับบ้าน หรือโต๊ะที่ถูกลบไปแล้ว) ก็ต้องเห็นเพื่อปิดบิลได้
  const extra=[...new Set(S.orders.map(o=>o.table).filter(n=>n&&!known.includes(n)&&tableInfo(n).os.length))];
  const cards=[...S.tables.map(t=>({name:t.name,id:t.id})),...extra.map(n=>({name:n}))];
  const busy=cards.filter(c=>tableInfo(c.name).os.length).length;
  $('#main').innerHTML=`<div class="head"><h1>จัดการโต๊ะ</h1><span class="sub">${S.tables.length} โต๊ะ · มีออเดอร์ ${busy} โต๊ะ</span><span class="grow"></span>
  ${owner?`<button class="btn" id="qrAll" ${S.tables.length?'':'disabled'}>QR ทุกโต๊ะ</button><button class="btn primary" id="addT">เพิ่มโต๊ะ</button>`:''}</div>
  ${cards.length?`<div class="tbls">${cards.map(c=>{const i=tableInfo(c.name);
    const cls=i.unpaid?'t-due':i.cooking?'t-cook':'t-free';
    return `<button class="tbl ${cls}" data-t="${esc(c.name)}"><b>${esc(c.name)}</b><span>${i.unpaid?`รอชำระ ${baht(i.due)}`:i.cooking?`กำลังทำ ${i.cooking} ออเดอร์`:'ว่าง'}</span>${i.os.length?`<span class="sub">${i.os.length} ออเดอร์</span>`:''}</button>`}).join('')}</div>`
  :`<div class="panel empty">ยังไม่มีโต๊ะ${owner?'<br><br><button class="btn primary" id="seedT">สร้างโต๊ะ 1–12</button>':''}</div>`}`;
  $('#main').querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>openTable(b.dataset.t));
  if(owner){
    $('#addT').onclick=()=>openForm('เพิ่มโต๊ะ',[{id:'name',label:'ชื่อ/หมายเลขโต๊ะ (เช่น 13 หรือ VIP1)',req:true}],v=>act(()=>api('/api/tables',{method:'POST',body:{name:v.name}}),'เพิ่มโต๊ะ '+v.name+' แล้ว'));
    if($('#seedT'))$('#seedT').onclick=()=>act(()=>api('/api/tables/seed',{method:'POST',body:{count:12}}),'สร้างโต๊ะ 1–12 แล้ว');
    $('#qrAll').onclick=()=>openDialog(`<h2>QR Code ทุกโต๊ะ</h2><p class="sub noprint">ลูกค้าสแกนแล้วเปิดหน้าสั่งอาหารพร้อมโต๊ะนั้นอัตโนมัติ — พิมพ์ไปวางที่โต๊ะได้เลย</p>
      <div class="qrgrid">${S.tables.map(t=>`<div class="qrcard">${qrSvg(tableUrl(t.name))}<b>โต๊ะ ${esc(t.name)}</b></div>`).join('')}</div>
      <div class="acts noprint"><button class="btn" id="dlgClose">ปิด</button><button class="btn primary" id="dlgPrint">พิมพ์</button></div>`,d=>{d.querySelector('#dlgClose').onclick=closeModal;d.querySelector('#dlgPrint').onclick=printQr});
  }
};

function openTable(name){
  const owner=role==='owner',cashier=role==='owner'||role==='finance';
  const i=tableInfo(name),tbl=S.tables.find(t=>t.name===name);
  const unpaid=i.os.filter(o=>payOf(o)?.status==='pending');
  // สรุปรายการทั้งหมดที่ยังไม่ชำระ รวมเมนูเดียวกัน (ใช้ตอนคิดเงิน)
  const sum={};unpaid.forEach(o=>o.items.forEach(x=>{const s=sum[x.m]||={q:0,amt:0};s.q+=x.q;s.amt+=x.q*x.p}));
  openDialog(`<h2>โต๊ะ ${esc(name)}</h2>
  ${i.os.length?i.os.map(o=>`<div class="line" style="grid-template-columns:1fr auto"><span><b class="num">${o.id}</b> <span class="sub num">${ttime(o.time)}</span><br>${itemsText(o)}${orderCust(o)&&o.cust!=='c0'||o.email?`<br><span class="sub">ลูกค้า: ${esc(orderCust(o))}</span>`:''}</span><span style="text-align:right">${statusPill(o)} ${payPill(o)}${o.status==='cooking'?`<br><button class="btn sm" data-serve="${o.id}">เสิร์ฟแล้ว</button>`:''}</span></div>`).join(''):'<div class="empty">โต๊ะว่าง ไม่มีออเดอร์ค้าง</div>'}
  ${unpaid.length?`<h2 style="margin-top:14px">สรุปยอดที่ต้องชำระ</h2>
    <table><tbody>${Object.entries(sum).map(([m,s])=>`<tr><td>${esc(menuName(m))} ×${s.q}</td><td class="r num">${baht(s.amt)}</td></tr>`).join('')}</tbody><tfoot><tr><td>รวม ${unpaid.length} บิล</td><td class="r num">${baht(i.due)}</td></tr></tfoot></table>
    ${cashier?`<div class="row" style="margin-top:10px">${METHODS.map(m=>`<button class="btn good" data-close="${m}">ปิดบิล · ${m}</button>`).join('')}</div>`:'<p class="sub">ให้แคชเชียร์เป็นผู้ปิดบิล</p>'}`:''}
  <div class="acts" style="justify-content:space-between;margin-top:14px"><span>${owner&&tbl?`<button class="btn sm" id="tQr">QR โต๊ะนี้</button> <button class="btn sm" id="tRen">เปลี่ยนชื่อ</button> <button class="btn sm danger" id="tDel">ลบโต๊ะ</button>`:''}</span><button class="btn" id="dlgClose">ปิด</button></div>`,d=>{
    d.querySelector('#dlgClose').onclick=closeModal;
    const again=ok=>{closeModal();if(ok&&tableInfo(name).os.length)openTable(name)};
    d.querySelectorAll('[data-serve]').forEach(b=>b.onclick=async()=>again(await act(()=>api(`/api/orders/${b.dataset.serve.slice(1)}/serve`,{method:'PATCH'}),`ออเดอร์ ${b.dataset.serve} เสิร์ฟแล้ว`)));
    d.querySelectorAll('[data-close]').forEach(b=>b.onclick=async()=>again(await act(()=>api('/api/bills/close',{method:'POST',body:{table:name,method:b.dataset.close}}),r=>`ปิดบิลโต๊ะ ${name}: ${r.count} บิล รวม ${baht(r.total)} (${r.method})`)));
    if(owner&&tbl){
      d.querySelector('#tQr').onclick=()=>openDialog(`<h2>QR โต๊ะ ${esc(name)}</h2><div class="qrgrid"><div class="qrcard">${qrSvg(tableUrl(name))}<b>โต๊ะ ${esc(name)}</b></div></div><p class="sub noprint" style="word-break:break-all">${esc(tableUrl(name))}</p><div class="acts noprint"><button class="btn" id="dlgClose">ปิด</button><button class="btn primary" id="dlgPrint">พิมพ์</button></div>`,q=>{q.querySelector('#dlgClose').onclick=closeModal;q.querySelector('#dlgPrint').onclick=printQr});
      d.querySelector('#tRen').onclick=()=>{closeModal();openForm('เปลี่ยนชื่อโต๊ะ '+name,[{id:'name',label:'ชื่อ/หมายเลขโต๊ะใหม่',value:name,req:true}],v=>act(()=>api('/api/tables/'+tbl.id,{method:'PUT',body:{name:v.name}}),'เปลี่ยนชื่อโต๊ะแล้ว (ต้องพิมพ์ QR ใหม่)'))};
      d.querySelector('#tDel').onclick=()=>{closeModal();confirmBox('ลบโต๊ะ '+name,'ลบโต๊ะนี้ออกจากรายการ (QR ของโต๊ะนี้จะใช้ไม่ได้อีก)',()=>act(()=>api('/api/tables/'+tbl.id,{method:'DELETE'}),'ลบโต๊ะ '+name+' แล้ว'),'ลบ')};
    }
  });
}
