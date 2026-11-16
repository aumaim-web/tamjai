// api.js — เรียกชั้นข้อมูล (db.js), โหลดข้อมูลใหม่, เข้าสู่ระบบ/สมัครสมาชิก, รับออเดอร์ลูกค้าแบบอัตโนมัติ
async function api(path,opt={}){
  try{return await dbApi(path,opt)}
  catch(e){
    if(e.status===401&&path!=='/api/login'){role='customer';syncAuthUI();showLogin()}
    throw e;
  }
}
async function reload(){
  const d=await api('/api/state');
  if(d.notes&&d.notes.length)toast(d.notes.join(' · '));
  delete d.notes;
  S={customers:[],employees:[],orders:[],payments:[],...d};
  MENU=S.menu;
  $('#stConn').textContent='เชื่อมต่อฐานข้อมูลแล้ว';
}
// เรียก API แล้วโหลดข้อมูลใหม่ + วาดหน้าจอใหม่; คืน false เมื่อผิดพลาด (ให้หน้าต่างฟอร์มค้างไว้)
async function act(fn,msg){
  try{const r=await fn();await reload();render();if(msg)toast(typeof msg==='function'?msg(r):msg);return r??true}
  catch(e){toast(e.message);return false}
}
// ป้ายผู้ใช้และปุ่มเข้าสู่ระบบ/ออกจากระบบที่แถบบน
function syncAuthUI(){
  const who=TOKEN&&ME?ME.name:'';
  $('#roleTag').textContent=TOKEN?`${ROLE_NAME[role]} · ${shortName(who)}`:'ยังไม่ได้เข้าสู่ระบบ';
  $('#loginBtn').textContent=TOKEN?'ออกจากระบบ':'เข้าสู่ระบบ';
  $('#loginBtn').classList.toggle('primary',!TOKEN);
}
// Real-time: พนักงานเห็นออเดอร์ใหม่/ออเดอร์ที่ลูกค้าส่งมา/คำขอยกเลิกทันทีโดยไม่ต้องรีเฟรช
// (แคชเชียร์เปิดหน้าจออยู่จะรับออเดอร์ลูกค้าให้เองตอนโหลดข้อมูลใหม่ — ถ้ากำลังเปิดหน้าต่างฟอร์มอยู่จะรอจนปิดก่อน ฟอร์มที่กรอกค้างจะได้ไม่หาย)
let liveDirty=false;
async function flushLive(){
  if(!liveDirty||$('#modalHost').innerHTML)return;
  liveDirty=false;
  try{await reload();render()}catch(e){}
}
function startLive(){
  watchLive(()=>{liveDirty=true;flushLive()},(kind,id,d)=>{
    if(kind==='order')toast(`🔔 ออเดอร์ใหม่ #${id}${d.table_no?' · โต๊ะ '+d.table_no:''}`);
    if(kind==='cancel'&&role==='owner')toast(`⚠️ คำขอยกเลิกออเดอร์ #${id} รออนุมัติ`);
  });
}
setInterval(flushLive,10000);

// เข้าระบบสำเร็จ (ล็อกอินหรือสมัครใหม่) → ตั้งบทบาท โหลดข้อมูล วาดหน้าใหม่
async function afterAuth(r){
  role=r.user.role;view='';syncAuthUI();pos.cart=[];pos.cust='c0';
  await reload();render();startLive();syncAuthUI();toast('ยินดีต้อนรับ '+r.user.name);
}
function showLogin(){
  openForm('เข้าสู่ระบบ',[
    {id:'email',label:'อีเมล',type:'text',req:true},
    {id:'password',label:'รหัสผ่าน',type:'password',req:true},
    {id:'hint',type:'note',label:'',value:'พนักงาน: ใช้อีเมลที่ร้านให้ (พิมพ์แค่ owner / finance / stock / kitchen ก็ได้)<br>ลูกค้า: ใช้อีเมลที่สมัครไว้ · <button type="button" class="linkbtn" id="toSignup" style="font-size:inherit">สมัครสมาชิกใหม่</button>'}],
    async v=>{
      try{await afterAuth(await api('/api/login',{method:'POST',body:{email:v.email,password:v.password}}))}
      catch(e){toast(e.message);return false}
    },'เข้าสู่ระบบ');
  const t=$('#toSignup');if(t)t.onclick=()=>{closeModal();showSignup()};
  const f=$('#f_email');if(f)f.focus();
}
function showSignup(){
  openForm('สมัครสมาชิกลูกค้า',[
    {id:'name',label:'ชื่อที่แสดง (ไม่บังคับ)'},
    {id:'email',label:'อีเมล (ใช้อีเมลอะไรก็ได้)',type:'email',req:true},
    {id:'password',label:'รหัสผ่าน (อย่างน้อย 6 ตัว)',type:'password',req:true},
    {id:'hint',type:'note',label:'',value:'<button type="button" class="linkbtn" id="toLogin" style="font-size:inherit">มีบัญชีแล้ว? เข้าสู่ระบบ</button>'}],
    async v=>{
      try{await afterAuth(await api('/api/signup',{method:'POST',body:{name:v.name,email:v.email,password:v.password}}))}
      catch(e){toast(e.message);return false}
    },'สมัครสมาชิก');
  const t=$('#toLogin');if(t)t.onclick=()=>{closeModal();showLogin()};
  const f=$('#f_name');if(f)f.focus();
}
