// menu.js — หน้าจัดการเมนูอาหาร (เจ้าของร้านเท่านั้น): เพิ่ม แก้ไข ลบ เมนู กำหนดสูตรวัตถุดิบ และจัดการรูปเมนู

// ย่อรูปที่เลือกจากเครื่องเป็น JPEG กว้างไม่เกิน 480px (ไม่ต้องใช้ที่เก็บไฟล์ภายนอก รูปเก็บในเมนูโดยตรง ขนาดไม่เกิน ~120 KB)
function fileToDataUrl(file){
  return new Promise((res,rej)=>{
    if(!file||!/^image\//.test(file.type))return rej(new Error('ไฟล์ที่เลือกไม่ใช่รูปภาพ'));
    if(file.size>15e6)return rej(new Error('ไฟล์ใหญ่เกิน 15 MB'));
    const url=URL.createObjectURL(file),im=new Image();
    im.onload=()=>{
      URL.revokeObjectURL(url);
      for(const [w,q] of [[480,.78],[400,.65],[320,.55]]){
        const s=Math.min(1,w/im.width),c=document.createElement('canvas');
        c.width=Math.max(1,Math.round(im.width*s));c.height=Math.max(1,Math.round(im.height*s));
        const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);
        const d=c.toDataURL('image/jpeg',q);
        if(d.length<=170000)return res(d);
      }
      rej(new Error('รูปซับซ้อนเกินไป ลองรูปอื่น'));
    };
    im.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('อ่านรูปนี้ไม่ได้ (ใช้ไฟล์ JPG/PNG)'))};
    im.src=url;
  });
}
// หน้าต่างเพิ่ม/เปลี่ยน/ลบรูปของเมนู
function imageDialog(m){
  let picked='';
  openDialog(`<h2>รูปเมนู: ${esc(m.name)}</h2>
    <div class="imgprev" id="imgPrev">${m.img?`<img src="${esc(m.img)}" alt="${esc(m.name)}">`:'<div class="empty">ยังไม่มีรูป</div>'}</div>
    <label class="field" for="imgFile" style="margin-top:12px">เลือกรูปใหม่จากเครื่อง<input type="file" id="imgFile" accept="image/*"></label>
    <p class="sub">ระบบย่อรูปให้อัตโนมัติ · ควรใช้รูปที่ตรงกับชื่อเมนูและเป็นรูปที่คุณมีสิทธิ์ใช้ (ถ่ายเองหรือได้รับอนุญาต)</p>
    <div class="acts" style="justify-content:space-between"><span>${m.img?'<button class="btn danger" id="imgDel">ลบรูป</button>':''}</span><span><button class="btn" id="dlgClose">ปิด</button> <button class="btn primary" id="imgSave" disabled>บันทึกรูปใหม่</button></span></div>`,d=>{
    d.querySelector('#dlgClose').onclick=closeModal;
    const save=d.querySelector('#imgSave');
    d.querySelector('#imgFile').onchange=async e=>{
      save.disabled=true;picked='';
      try{picked=await fileToDataUrl(e.target.files[0]);d.querySelector('#imgPrev').innerHTML=`<img src="${picked}" alt="ตัวอย่างรูปใหม่">`;save.disabled=false}
      catch(err){toast(err.message);e.target.value=''}
    };
    save.onclick=async()=>{save.disabled=true;const ok=await act(()=>api(`/api/menu/${m.id}/image`,{method:'POST',body:{image:picked}}),'บันทึกรูป '+m.name+' แล้ว');if(ok)closeModal();else save.disabled=false};
    const del=d.querySelector('#imgDel');
    if(del)del.onclick=async()=>{if(await act(()=>api(`/api/menu/${m.id}/image`,{method:'POST',body:{image:''}}),'ลบรูป '+m.name+' แล้ว'))closeModal()};
  });
}
R.menu=()=>{
  const cats=CATS.filter(c=>c!=='ทั้งหมด');
  const stockName=id=>(S.stock.find(s=>s.id===id)||{name:id}).name;
  const recipeText=m=>Object.entries(m.r).map(([k,v])=>{const s=S.stock.find(s=>s.id===k);return `${esc(stockName(k))} ${fmtQ(v)}${s?' '+esc(s.unit):''}`}).join(' · ')||'<span class="sub">ไม่ตัดสต็อก</span>';
  $('#main').innerHTML=`<div class="head"><h1>จัดการเมนู</h1><span class="sub">${MENU.length} รายการ · สูตรใช้ตัดสต็อกอัตโนมัติเมื่อมีออเดอร์</span><span class="grow"></span><button class="btn primary" id="addM">เพิ่มเมนู</button></div>
  <div class="panel tablewrap"><table><thead><tr><th>รูป</th><th>เมนู</th><th>หมวด</th><th class="r">ราคา</th><th>สูตร (ต่อ 1 จาน)</th><th></th></tr></thead><tbody>
  ${MENU.map(m=>`<tr><td>${m.img?`<img class="mthumb" src="${esc(m.img)}" alt="" loading="lazy">`:'<span class="mthumb none">ไม่มีรูป</span>'}</td><td>${esc(m.name)}</td><td style="white-space:nowrap">${esc(m.cat)}</td><td class="r num">${baht(m.price)}</td><td>${recipeText(m)}</td><td style="white-space:nowrap">${m.soldout?'<span class="pill p-pend">หมดชั่วคราว</span> ':''}<button class="btn sm" data-img="${m.id}">${m.img?'เปลี่ยนรูป':'เพิ่มรูป'}</button> <button class="btn sm" data-so="${m.id}">${m.soldout?'เปิดขาย':'ตั้งเป็นหมด'}</button> <button class="btn sm" data-ed="${m.id}">แก้ไข</button> <button class="btn sm danger" data-del="${m.id}">ลบ</button></td></tr>`).join('')||'<tr><td colspan="6"><div class="empty">ยังไม่มีเมนู กด "เพิ่มเมนู" เพื่อเริ่มต้น</div></td></tr>'}</tbody></table></div>`;
  const form=m=>openForm(m?'แก้ไขเมนู':'เพิ่มเมนูใหม่',[
    {id:'name',label:'ชื่อเมนู',value:m?.name,req:true},
    {id:'category',label:'หมวดหมู่',type:'select',options:cats,value:m?.cat||cats[0]},
    {id:'price',label:'ราคา (บาท)',type:'number',step:'any',value:m?.price,req:true},
    {id:'hint',type:'note',label:'สูตรวัตถุดิบ (ต่อ 1 จาน)',value:'ใส่เฉพาะวัตถุดิบที่ใช้ เว้นว่างถ้าไม่ใช้'},
    ...S.stock.map(s=>({id:'r_'+s.id,label:`${s.name} (${s.unit})`,type:'number',step:'any',value:m?.r[s.id]??''}))],
    v=>{
      const price=parseFloat(v.price);
      if(!(price>0)){toast('ราคาต้องมากกว่า 0');return false}
      const recipe={};S.stock.forEach(s=>{const a=parseFloat(v['r_'+s.id]);if(a>0)recipe[s.id]=a});
      const d={name:v.name,category:v.category,price,recipe};
      return act(()=>m?api('/api/menu/'+m.id,{method:'PUT',body:d}):api('/api/menu',{method:'POST',body:d}),m?'บันทึกเมนู '+v.name+' แล้ว':'เพิ่มเมนู '+v.name+' แล้ว');
    });
  $('#addM').onclick=()=>form();
  $('#main').querySelectorAll('[data-ed]').forEach(b=>b.onclick=()=>form(MENU.find(m=>m.id===b.dataset.ed)));
  $('#main').querySelectorAll('[data-img]').forEach(b=>b.onclick=()=>imageDialog(MENU.find(m=>m.id===b.dataset.img)));
  $('#main').querySelectorAll('[data-so]').forEach(b=>b.onclick=()=>{const m=MENU.find(m=>m.id===b.dataset.so);
    act(()=>api(`/api/menu/${m.id}/soldout`,{method:'POST',body:{soldout:!m.soldout}}),m.soldout?`เปิดขาย ${m.name} อีกครั้งแล้ว`:`ตั้ง ${m.name} เป็นหมดชั่วคราวแล้ว (ลูกค้าสั่งไม่ได้)`)});
  $('#main').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{const m=MENU.find(m=>m.id===b.dataset.del);
    confirmBox('ลบเมนู',`ลบ ${m.name} ออกจากเมนู (ออเดอร์เก่าที่สั่งไปแล้วยังอยู่ แต่ถ้ายกเลิกออเดอร์เก่าที่มีเมนูนี้ ระบบจะคืนวัตถุดิบเข้าสต็อกให้ไม่ได้)`,()=>{pos.cart=pos.cart.filter(x=>x.m!==m.id);return act(()=>api('/api/menu/'+m.id,{method:'DELETE'}),'ลบ '+m.name+' แล้ว')},'ลบ')});
};
