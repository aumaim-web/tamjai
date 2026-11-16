// stock.js — หน้าสต็อกวัตถุดิบ
R.stock=()=>{
  const list=S.stock.slice().sort((a,b)=>(a.qty/a.min)-(b.qty/b.min));
  $('#main').innerHTML=`<div class="head"><h1>สต็อกวัตถุดิบ</h1><span class="sub">ตัดสต็อกอัตโนมัติเมื่อมีออเดอร์ · แถวสีเหลืองคือต่ำกว่าขั้นต่ำ</span><span class="grow"></span><button class="btn primary" id="addS">เพิ่มวัตถุดิบ</button></div>
  <div class="panel tablewrap"><table><thead><tr><th>วัตถุดิบ</th><th class="r">คงเหลือ</th><th>หน่วย</th><th class="r">ขั้นต่ำ</th><th>สถานะ</th><th></th></tr></thead><tbody>
  ${list.map(s=>{const low=s.qty<s.min;return `<tr class="${low?'low':''}"><td>${esc(s.name)}</td><td class="r num"><b>${fmtQ(s.qty)}</b></td><td>${esc(s.unit)}</td><td class="r num">${fmtQ(s.min)}</td><td>${low?'<span class="pill p-pend">ต้องสั่งเพิ่ม</span>':s.qty<s.min*1.5?'<span class="pill p-cook">ใกล้หมด</span>':'<span class="pill p-paid">ปกติ</span>'}</td>
  <td style="white-space:nowrap"><button class="btn sm" data-in="${s.id}">รับเข้า</button> <button class="btn sm" data-out="${s.id}">เบิกออก</button> <button class="btn sm" data-ed="${s.id}">แก้ไข</button>${role==='owner'?` <button class="btn sm danger" data-del="${s.id}">ลบ</button>`:''}</td></tr>`}).join('')}</tbody></table></div>`;
  const adj=(s,sign)=>openForm((sign>0?'รับเข้า ':'เบิกออก ')+s.name,[{id:'n',type:'note',label:'คงเหลือตอนนี้',value:`${fmtQ(s.qty)} ${esc(s.unit)}`},{id:'q',label:`จำนวน (${s.unit})`,type:'number',step:'any',req:true}],v=>{
    const q=parseFloat(v.q);if(!(q>0)){toast('กรุณาใส่จำนวนมากกว่า 0');return false}
    return act(()=>api(`/api/stock/${s.id}/adjust`,{method:'POST',body:{delta:sign*q}}),r=>`${r.name} คงเหลือ ${fmtQ(r.qty)} ${r.unit}`)},sign>0?'รับเข้า':'เบิกออก');
  const form=s=>openForm(s?'แก้ไขวัตถุดิบ':'เพิ่มวัตถุดิบใหม่',[{id:'name',label:'ชื่อวัตถุดิบ',value:s?.name,req:true},{id:'unit',label:'หน่วย',value:s?.unit||'กก.',req:true},{id:'qty',label:'คงเหลือ',type:'number',step:'any',value:s?.qty??0},{id:'min',label:'จำนวนขั้นต่ำที่ต้องมี',type:'number',step:'any',value:s?.min??1}],v=>{
    const d={name:v.name,unit:v.unit,qty:parseFloat(v.qty)||0,min:parseFloat(v.min)||0};
    return act(()=>s?api('/api/stock/'+s.id,{method:'PUT',body:d}):api('/api/stock',{method:'POST',body:d}),'บันทึก '+v.name+' แล้ว')});
  $('#addS').onclick=()=>form();
  const f=id=>S.stock.find(s=>s.id===id);
  $('#main').querySelectorAll('[data-in]').forEach(b=>b.onclick=()=>adj(f(b.dataset.in),1));
  $('#main').querySelectorAll('[data-out]').forEach(b=>b.onclick=()=>adj(f(b.dataset.out),-1));
  $('#main').querySelectorAll('[data-ed]').forEach(b=>b.onclick=()=>form(f(b.dataset.ed)));
  $('#main').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{const s=f(b.dataset.del);confirmBox('ลบวัตถุดิบ',`ลบ ${s.name} (คงเหลือ ${fmtQ(s.qty)} ${s.unit}) ออกจากสต็อก ถ้ายังมีเมนูใช้วัตถุดิบนี้อยู่ จะลบไม่ได้`,()=>act(()=>api('/api/stock/'+s.id,{method:'DELETE'}),'ลบ '+s.name+' แล้ว'),'ลบ')});
};

