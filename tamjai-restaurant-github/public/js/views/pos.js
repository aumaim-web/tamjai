// pos.js — หน้าขายหน้าร้าน / สั่งอาหาร (ลูกค้าสแกน QR ของโต๊ะแล้วโต๊ะถูกกรอกให้อัตโนมัติ)
const qrTable=()=>QR_TABLE&&S.tables.some(t=>t.name===QR_TABLE)?QR_TABLE:'';
R.pos=()=>{
  const cust=role==='customer';
  if(qrTable()&&cust)pos.table=qrTable();
  $('#main').innerHTML=`
  ${cust?`<div class="hero"><div class="hero-text"><span class="eyebrow">🍜 ยินดีต้อนรับสู่ร้านตามใจ</span><h1>หิวเมื่อไหร่<br>สั่งได้ตามใจ</h1><span class="sub">เลือกเมนูที่ชอบแล้วกดส่งออเดอร์ · ชำระเงินที่เคาน์เตอร์</span>${qrTable()?`<div><span class="badge">โต๊ะของคุณ <b>${esc(qrTable())}</b></span></div>`:''}</div>
    <div class="stack" aria-hidden="true">${MENU.filter(m=>m.img&&!m.soldout).slice(0,3).map(m=>`<img src="${esc(m.img)}" alt="">`).join('')}</div></div>`
  :`<div class="head"><h1>ขายหน้าร้าน</h1><span class="sub">คลิกเมนูเพื่อเพิ่ม · พิมพ์ค้นหาแล้วกด Enter เพื่อเพิ่มรายการแรก</span></div>`}
  <div class="pos">
    <section>
      <input type="search" id="posQ" placeholder="ค้นหาเมนู เช่น กะเพรา" value="${esc(pos.q)}" style="width:100%" aria-label="ค้นหาเมนู">
      <div class="chips" id="posCats">${CATS.map(c=>`<button class="chip" data-cat="${c}" aria-pressed="${c===pos.cat}">${c}</button>`).join('')}</div>
      <div class="menu" id="posGrid"></div>
    </section>
    <aside class="panel cart" id="cart"></aside>
  </div>`;
  const q=$('#posQ');
  q.addEventListener('input',()=>{pos.q=q.value;drawGrid()});
  q.addEventListener('keydown',e=>{if(e.key==='Enter'){const m=filtered().find(m=>canMake(m,1));if(m){addItem(m.id);q.value='';pos.q='';drawGrid()}}});
  $('#posCats').addEventListener('click',e=>{const b=e.target.closest('[data-cat]');if(!b)return;pos.cat=b.dataset.cat;document.querySelectorAll('#posCats .chip').forEach(c=>c.setAttribute('aria-pressed',c.dataset.cat===pos.cat));drawGrid()});
  $('#posGrid').addEventListener('click',e=>{const b=e.target.closest('[data-add]');if(b)addItem(b.dataset.add)});
  drawGrid();drawCart();
  if(!cust)q.focus();
};
const filtered=()=>MENU.filter(m=>(pos.cat==='ทั้งหมด'||m.cat===pos.cat)&&m.name.includes(pos.q.trim()));
function needFor(cart){const need={};cart.forEach(x=>{const m=MENU.find(m=>m.id===x.m);for(const k in m.r)need[k]=(need[k]||0)+m.r[k]*x.q});return need}
function canMake(m,extra){if(m.soldout)return false;const cart=pos.cart.map(x=>({...x}));const ex=cart.find(x=>x.m===m.id);ex?ex.q+=extra:cart.push({m:m.id,q:extra});const need=needFor(cart);return Object.keys(need).every(k=>{const s=S.stock.find(s=>s.id===k);return s&&s.qty>=need[k]-1e-9})}
function drawGrid(){
  const list=filtered();
  $('#posGrid').innerHTML=list.length?list.map(m=>{const ok=canMake(m,1);return `<button class="dish" data-add="${m.id}" ${ok?'':'disabled'}><div class="dpic${m.img?'':' noimg'}">${m.img?`<img class="dimg" src="${esc(m.img)}" alt="${esc(m.name)}" loading="lazy" onerror="this.parentNode.classList.add('noimg');this.remove()">`:'🍽️'}${ok?`<span class="dprice num">${baht(m.price)}</span><span class="dadd" aria-hidden="true">+</span>`:`<span class="dstate">${m.soldout?'หมดชั่วคราว':'วัตถุดิบหมด'}</span>`}</div><div class="dbody"><span class="c">${m.cat}</span><span class="n">${esc(m.name)}</span></div></button>`}).join(''):'<div class="empty">ไม่พบเมนูที่ค้นหา</div>';
}
function addItem(id){const m=MENU.find(m=>m.id===id);if(!canMake(m,1)){toast((m.soldout?'หมดชั่วคราว: ':'วัตถุดิบไม่พอสำหรับ ')+m.name);return}const ex=pos.cart.find(x=>x.m===id);ex?ex.q++:pos.cart.push({m:id,q:1,p:m.price});drawCart();drawGrid()}
// ตัวเลือกโต๊ะ: ลูกค้าที่สแกน QR ล็อกโต๊ะไว้ให้ ที่เหลือเลือกจากรายการโต๊ะ (หรือกลับบ้าน)
function tableField(cust){
  const qt=cust&&qrTable();
  if(qt)return `<div class="field">โต๊ะ<b style="color:var(--ink)">โต๊ะ ${esc(qt)} <span class="sub">(จากการสแกน QR)</span></b></div>`;
  const names=S.tables.map(t=>t.name);
  return `<label class="field" for="posTable">โต๊ะ<select id="posTable"><option value="">${cust?'เลือกโต๊ะ…':'ไม่ระบุ'}</option>${names.map(n=>`<option ${n===pos.table?'selected':''}>${esc(n)}</option>`).join('')}<option ${pos.table==='กลับบ้าน'?'selected':''}>กลับบ้าน</option></select></label>`;
}
function drawCart(){
  const cust=role==='customer';const sum=pos.cart.reduce((a,x)=>a+x.p*x.q,0);
  $('#cart').innerHTML=`<h2>รายการสั่ง</h2>
  ${pos.cart.length?pos.cart.map((x,i)=>`<div class="line"><span>${esc(menuName(x.m))}<br><span class="sub num">${baht(x.p)}</span> <button class="linkbtn" data-note="${i}">${x.note?'แก้หมายเหตุ':'+ หมายเหตุ'}</button>${x.note?`<br><span class="sub">📝 ${esc(x.note)}</span>`:''}</span><span class="qty"><button data-dec="${i}" aria-label="ลด">−</button><span class="num" style="min-width:20px;text-align:center">${x.q}</span><button data-inc="${i}" aria-label="เพิ่ม">+</button></span><span class="num" style="min-width:56px;text-align:right">${baht(x.p*x.q)}</span></div>`).join(''):'<div class="empty">ยังไม่มีรายการ<br>คลิกเมนูทางซ้ายเพื่อเพิ่ม</div>'}
  <div class="total"><span>รวม</span><span class="num">${baht(sum)}</span></div>
  <div class="row">
    ${tableField(cust)}
    ${cust?'':`<label class="field" for="posCust">ลูกค้า<select id="posCust">${S.customers.map(c=>`<option value="${c.id}" ${c.id===pos.cust?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>`}
  </div>
  ${cust?`<button class="btn primary" id="posSend" style="width:100%" ${pos.cart.length?'':'disabled'}>ส่งออเดอร์เข้าครัว</button>`:`
  <label class="field" for="posMethod">วิธีชำระ<select id="posMethod">${METHODS.map(m=>`<option ${m===pos.method?'selected':''}>${m}</option>`).join('')}</select></label>
  <div class="row"><button class="btn" id="posSend" ${pos.cart.length?'':'disabled'}>ส่งครัว ชำระทีหลัง</button><button class="btn good" id="posPay" ${pos.cart.length?'':'disabled'}>รับเงินและส่งครัว</button></div>
  ${pos.cart.length?'<button class="linkbtn" id="posClear" style="margin-top:10px">ล้างรายการ</button>':''}`}`;
  const c=$('#cart');
  c.querySelectorAll('[data-inc]').forEach(b=>b.onclick=()=>{const x=pos.cart[b.dataset.inc];addItem(x.m)});
  c.querySelectorAll('[data-dec]').forEach(b=>b.onclick=()=>{const x=pos.cart[b.dataset.dec];x.q--;if(!x.q)pos.cart.splice(b.dataset.dec,1);drawCart();drawGrid()});
  c.querySelectorAll('[data-note]').forEach(b=>b.onclick=()=>{const x=pos.cart[b.dataset.note];
    openForm('หมายเหตุ: '+menuName(x.m),[{id:'note',label:'เช่น ไม่ใส่ผักชี · เผ็ดน้อย · แยกน้ำจิ้ม',value:x.note||''}],v=>{x.note=v.note.slice(0,100);drawCart()},'บันทึก')});
  if($('#posTable'))$('#posTable').onchange=e=>pos.table=e.target.value;
  if($('#posCust'))$('#posCust').onchange=e=>pos.cust=e.target.value;
  if($('#posMethod'))$('#posMethod').onchange=e=>pos.method=e.target.value;
  if($('#posClear'))$('#posClear').onclick=()=>{pos.cart=[];drawCart();drawGrid()};
  $('#posSend').onclick=()=>placeOrder(false);
  if($('#posPay'))$('#posPay').onclick=()=>placeOrder(true);
}
async function placeOrder(payNow){
  if(!pos.cart.length)return;
  const cust=role==='customer';
  if(cust&&!pos.table){toast('กรุณาเลือกโต๊ะ (หรือกลับบ้าน) ก่อนส่งออเดอร์');return}
  const body={items:pos.cart.map(x=>({m:x.m,q:x.q,note:x.note})),table:pos.table.trim(),cust:pos.cust,payNow,method:pos.method};
  const r=await act(()=>api('/api/orders',{method:'POST',body}),r=>r.queued?`ส่งออเดอร์ยอด ${baht(r.total)} แล้ว · ติดตามสถานะได้ที่เมนู "ติดตามออเดอร์"`:r.paid?`รับเงิน ${baht(r.total)} แล้ว · ออเดอร์ ${r.id} ส่งเข้าครัว`:`ออเดอร์ ${r.id} ส่งเข้าครัวแล้ว`);
  if(r){
    if(r.queued){rememberTicket({id:r.ticket,at:Date.now(),total:r.total,table:pos.table});}
    pos.cart=[];if(!qrTable())pos.table='';pos.cust='c0';
    if(r.queued){go('track');return}
    if(view==='pos'){drawCart();drawGrid()}
  }
}
