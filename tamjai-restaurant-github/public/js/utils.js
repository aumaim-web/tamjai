// utils.js — ฟังก์ชันช่วยทั่วไป: เลือก element, จัดรูปแบบเงิน/วันที่/ตัวเลข, toast
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const baht=n=>'฿'+Math.round(n).toLocaleString('th-TH');
const dkey=d=>{d=new Date(d);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const tday=d=>new Date(d).toLocaleDateString('th-TH',{day:'numeric',month:'short'});
const ttime=d=>new Date(d).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
function total(o){return o.items.reduce((a,x)=>a+x.p*x.q,0)}
const today=()=>dkey(new Date());
const shortName=n=>String(n||'').replace(/\s*\(.*\)\s*$/,'')||String(n||''); // "ปราณี (เจ้าของร้าน)" → "ปราณี"
function toast(t){const el=document.createElement('div');el.className='toast';el.textContent=t;document.body.appendChild(el);setTimeout(()=>el.remove(),2200)}
function fmtQ(n){return (Math.round(n*100)/100).toLocaleString('th-TH')}
function niceStep(x){const p=Math.pow(10,Math.floor(Math.log10(x||1)));const n=x/p;return (n<=1?1:n<=2?2:n<=5?5:10)*p}
