// audit.js — Audit Log (เจ้าของร้านเท่านั้น): ใครทำอะไรเมื่อไหร่ แก้/ลบย้อนหลังไม่ได้
let auditQ='';
R.audit=async()=>{
  $('#main').innerHTML='<div class="head"><h1>Audit Log</h1></div><div class="panel empty">กำลังโหลด…</div>';
  let list;
  try{list=await api('/api/audit')}catch(e){if(view==='audit')$('#main').innerHTML=`<div class="panel empty">${esc(e.message)}</div>`;return}
  if(view!=='audit')return;
  const draw=()=>{
    const q=auditQ.toLowerCase();
    const rows=list.filter(a=>!q||`${a.name} ${a.action} ${a.target} ${a.detail}`.toLowerCase().includes(q));
    $('#auditBody').innerHTML=rows.length?`<table><thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>การกระทำ</th><th>รายการ</th><th>รายละเอียด</th></tr></thead><tbody>${rows.map(a=>`<tr><td class="num" style="white-space:nowrap">${tday(a.time)} ${ttime(a.time)}</td><td>${esc(a.name)} <span class="sub">${ROLE_NAME[a.role]||''}</span></td><td>${esc(a.action)}</td><td>${esc(a.target)}</td><td class="sub">${esc(a.detail)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">ไม่พบรายการ</div>';
  };
  $('#main').innerHTML=`<div class="head"><h1>Audit Log</h1><span class="sub">${list.length} รายการล่าสุด · บันทึกเวลาโดยเซิร์ฟเวอร์ แก้/ลบไม่ได้</span><span class="grow"></span><input type="search" id="aq" placeholder="ค้นหา เช่น ยกเลิก, ชื่อผู้ใช้, #1005" value="${esc(auditQ)}" aria-label="ค้นหา Audit Log"></div>
  <div class="panel tablewrap" id="auditBody"></div>`;
  $('#aq').oninput=e=>{auditQ=e.target.value.trim();draw()};
  draw();
};
