// modal.js — หน้าต่างฟอร์มและหน้าต่างยืนยัน
function closeModal(){$('#modalHost').innerHTML=''}
function openForm(title,fields,onOk,okLabel='บันทึก'){
  $('#modalHost').innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><form class="dialog" id="mf"><h2>${esc(title)}</h2>
  ${fields.map(f=>`<label class="field" for="f_${f.id}">${esc(f.label)}${f.type==='select'?`<select id="f_${f.id}">${f.options.map(o=>`<option ${o===f.value?'selected':''}>${esc(o)}</option>`).join('')}</select>`:f.type==='note'?`<span style="color:var(--ink)">${f.value}</span>`:`<input id="f_${f.id}" type="${f.type||'text'}" value="${esc(f.value??'')}" ${f.step?`step="${f.step}"`:''} ${f.req?'required':''}>`}</label>`).join('')}
  <div class="acts"><button type="button" class="btn" id="mCancel">ยกเลิก</button><button class="btn primary" type="submit">${esc(okLabel)}</button></div></form></div>`;
  $('#mCancel').onclick=closeModal;
  $('.modal').addEventListener('click',e=>{if(e.target.classList.contains('modal'))closeModal()});
  const first=$('#mf input,#mf select');if(first)first.focus();
  $('#mf').addEventListener('submit',e=>{e.preventDefault();const v={};fields.forEach(f=>{const el=$('#f_'+f.id);if(el)v[f.id]=el.value.trim()});const btn=$('#mf [type=submit]');btn.disabled=true;Promise.resolve(onOk(v)).then(ok=>{if(ok!==false)closeModal();else if(btn.isConnected)btn.disabled=false})});
}
// หน้าต่างที่มีเนื้อหา HTML เอง (ใช้กับหน้าจัดการโต๊ะ) — bind(dialogEl) ผูกปุ่มข้างใน
function openDialog(html,bind){
  $('#modalHost').innerHTML=`<div class="modal" role="dialog" aria-modal="true"><div class="dialog wide">${html}</div></div>`;
  $('.modal').addEventListener('click',e=>{if(e.target.classList.contains('modal'))closeModal()});
  if(bind)bind($('.dialog'));
}
function confirmBox(title,msg,onOk,okLabel){openForm(title,[{id:'m',type:'note',label:'',value:esc(msg)}],()=>onOk(),okLabel)}
