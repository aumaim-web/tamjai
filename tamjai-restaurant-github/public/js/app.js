// app.js — โครงโปรแกรม: เมนูซ้าย, สลับหน้า, คีย์ลัด, นาฬิกา, เริ่มต้นโปรแกรม (โหลดเป็นไฟล์สุดท้าย)
function renderSide(){
  const vs=VIEWS.filter(v=>v.roles.includes(role));
  if(!vs.find(v=>v.id===view))view=vs[0].id;
  $('#side').innerHTML=vs.map((v,i)=>`<button class="nav" data-view="${v.id}" ${v.id===view?'aria-current="page"':''}><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICON[v.id]}</svg>${role==='customer'&&v.clabel?v.clabel:v.label}<kbd>Alt+${i+1}</kbd></button>`).join('');
  $('#stUser').textContent=TOKEN&&S.user?`ผู้ใช้: ${shortName(S.user.name)} (${ROLE_NAME[role]})`:'ผู้ใช้: ลูกค้า (ยังไม่ได้เข้าสู่ระบบ)';
  $('#logoutBtn').hidden=!TOKEN;
  $('#resetBtn').hidden=role!=='owner';
  const pend=S.payments.filter(p=>p.status==='pending').length;
  const cr=S.orders.filter(o=>o.cancelReq&&o.status!=='cancelled').length;
  $('#stInfo').textContent=role==='customer'?'':role==='kitchen'?`กำลังทำ ${S.orders.filter(o=>o.status==='cooking').length} ออเดอร์`:`รอชำระ ${pend} บิล · วัตถุดิบใกล้หมด ${lowStock().length} รายการ${cr&&(role==='owner'||role==='finance')?` · รออนุมัติยกเลิก ${cr}`:''}`;
}
function go(v){view=v;render()}
function render(){clearTrack();renderSide();const fn=R[view];$('#main').innerHTML='';fn();$('#main').scrollTop=0}
$('#side').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)go(b.dataset.view)});
async function logout(){
  try{await api('/api/logout',{method:'POST'})}catch(e){}
  role='customer';view='pos';pos.cart=[];pos.cust='c0';syncAuthUI();
  try{await reload()}catch(e){toast(e.message)}
  render();
}
$('#logoutBtn').onclick=logout;
$('#loginBtn').onclick=()=>TOKEN?logout():showLogin();
document.addEventListener('keydown',e=>{
  if(e.altKey&&/^[1-9]$/.test(e.key)){const vs=VIEWS.filter(v=>v.roles.includes(role));const v=vs[+e.key-1];if(v){e.preventDefault();go(v.id)}}
  if(e.key==='Escape')closeModal();
});
// โหมดสว่าง/มืด: ค่าเริ่มต้นตามเครื่อง กดปุ่มเพื่อสลับ และจำไว้ในเครื่องนี้
const SUN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>';
const isDark=()=>{const t=document.documentElement.dataset.theme;return t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches};
function syncThemeBtn(){$('#themeBtn').innerHTML=isDark()?SUN:MOON}
$('#themeBtn').onclick=()=>{const t=isDark()?'light':'dark';document.documentElement.dataset.theme=t;try{localStorage.setItem('tamjai-theme',t)}catch(e){}syncThemeBtn();if(view==='dash')render()};
syncThemeBtn();
function tick(){$('#clock').textContent=new Date().toLocaleString('th-TH',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
tick();setInterval(tick,30000);

$('#resetBtn').onclick=()=>confirmBox('รีเซ็ตข้อมูล','ลบข้อมูลร้านทั้งหมดในฐานข้อมูล แล้วใส่ข้อมูลตัวอย่างใหม่ (บัญชีผู้ใช้ยังอยู่)',()=>{pos.cart=[];return act(()=>api('/api/reset',{method:'POST'}),'รีเซ็ตเป็นข้อมูลตัวอย่างแล้ว')},'รีเซ็ต');

(async function boot(){
  await authReady; // รอให้ Firebase กู้การล็อกอินเดิม (ถ้ามี) ก่อน
  role=TOKEN?ME.role:'customer';
  syncAuthUI();
  try{await reload();render();startLive()}
  catch(e){$('#stConn').textContent='ไม่ได้เชื่อมต่อ';$('#main').innerHTML=`<div class="panel empty">${esc(e.message)}</div>`}
})();
