// reports.js — หน้ารายงาน
let rFrom,rTo;
R.rep=()=>{
  if(!rFrom){const d=new Date();d.setDate(d.getDate()-6);rFrom=dkey(d);rTo=today()}
  const inR=t=>{const k=dkey(t);return k>=rFrom&&k<=rTo};
  $('#main').innerHTML=`<div class="head"><h1>รายงาน</h1><span class="grow"></span>
  <label class="role" for="rf">ตั้งแต่ <input type="date" id="rf" value="${rFrom}"></label><label class="role" for="rt">ถึง <input type="date" id="rt" value="${rTo}"></label></div>
  <div class="tabs" role="tablist"><button class="tab" role="tab" data-t="sales" aria-selected="${repTab==='sales'}">รายงานยอดขาย</button><button class="tab" role="tab" data-t="orders" aria-selected="${repTab==='orders'}">รายงานคำสั่งซื้อ</button><button class="tab" role="tab" data-t="best" aria-selected="${repTab==='best'}">เมนูขายดี</button></div>
  <div id="repBody"></div>`;
  $('#rf').onchange=e=>{rFrom=e.target.value;R.rep()};$('#rt').onchange=e=>{rTo=e.target.value;R.rep()};
  $('#main').querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{repTab=b.dataset.t;R.rep()});
  const body=$('#repBody');
  if(repTab==='sales'){
    body.innerHTML='<div class="empty">กำลังโหลดรายงาน…</div>';
    api(`/api/reports/sales?from=${rFrom}&to=${rTo}`).then(d=>{
    const mx=Math.max(...d.methods.map(x=>x.total),1);
    body.innerHTML=`<div class="kpis">
      <div class="kpi"><div class="l">ยอดขายรวม</div><div class="v num">${baht(d.total)}</div></div>
      <div class="kpi"><div class="l">จำนวนบิล</div><div class="v num">${d.count}</div></div>
      <div class="kpi"><div class="l">เฉลี่ยต่อบิล</div><div class="v num">${baht(d.avgPerBill)}</div></div>
      <div class="kpi"><div class="l">เฉลี่ยต่อวัน</div><div class="v num">${baht(d.avgPerDay)}</div></div></div>
    <div class="two"><div class="panel tablewrap"><h2>ยอดขายรายวัน</h2>${d.days.length?`<table><thead><tr><th>วันที่</th><th class="r">บิล</th><th class="r">ยอดขาย</th><th class="r">เฉลี่ย/บิล</th></tr></thead><tbody>${d.days.map(x=>`<tr><td>${new Date(x.date+'T00:00').toLocaleDateString('th-TH',{weekday:'short',day:'numeric',month:'short',year:'2-digit'})}</td><td class="r num">${x.count}</td><td class="r num">${baht(x.total)}</td><td class="r num">${baht(x.total/x.count)}</td></tr>`).join('')}</tbody><tfoot><tr><td>รวม</td><td class="r num">${d.count}</td><td class="r num">${baht(d.total)}</td><td class="r num">${baht(d.avgPerBill)}</td></tr></tfoot></table>`:'<div class="empty">ไม่มียอดขายในช่วงวันที่นี้</div>'}</div>
    <div class="panel"><h2>แยกตามวิธีชำระ</h2><div class="bars">${d.methods.map(x=>`<div class="b"><span>${x.method}<br><span class="sub num">${x.count} บิล</span></span><span class="t"><i style="width:${x.total/mx*100}%"></i></span><span class="r num" style="text-align:right">${baht(x.total)}</span></div>`).join('')}</div></div></div>`;
    }).catch(e=>{body.innerHTML=`<div class="panel empty">${esc(e.message)}</div>`});
  }else if(repTab==='best'){
    // เมนูขายดี: รวมจากออเดอร์ที่ไม่ถูกยกเลิกในช่วงวันที่เลือก เรียงตามจำนวนจานที่ขายได้
    const agg={};
    S.orders.filter(o=>inR(o.time)&&o.status!=='cancelled').forEach(o=>o.items.forEach(x=>{const a=agg[x.m]||={q:0,amt:0};a.q+=x.q;a.amt+=x.q*x.p}));
    const rank=Object.entries(agg).map(([m,a])=>({m,...a})).sort((a,b)=>b.q-a.q||b.amt-a.amt);
    const mx=Math.max(...rank.map(r=>r.q),1),totalQ=rank.reduce((a,r)=>a+r.q,0),totalAmt=rank.reduce((a,r)=>a+r.amt,0);
    body.innerHTML=`<div class="kpis">
      <div class="kpi"><div class="l">เมนูที่ขายได้</div><div class="v num">${rank.length}</div></div>
      <div class="kpi"><div class="l">จำนวนจานทั้งหมด</div><div class="v num">${totalQ}</div></div>
      <div class="kpi"><div class="l">ยอดขายรวม</div><div class="v num">${baht(totalAmt)}</div></div>
      <div class="kpi"><div class="l">อันดับ 1</div><div class="v" style="font-size:18px">${rank[0]?esc(menuName(rank[0].m)):'-'}</div><div class="d">${rank[0]?rank[0].q+' จาน':''}</div></div></div>
    <div class="two"><div class="panel tablewrap"><h2>จัดอันดับเมนูขายดี</h2>${rank.length?`<table><thead><tr><th>#</th><th>เมนู</th><th class="r">จำนวน (จาน)</th><th class="r">ยอดขาย</th><th class="r">สัดส่วน</th></tr></thead><tbody>${rank.map((r,i)=>`<tr><td class="num">${i+1}</td><td>${esc(menuName(r.m))}</td><td class="r num">${r.q}</td><td class="r num">${baht(r.amt)}</td><td class="r num">${totalAmt?Math.round(r.amt/totalAmt*100):0}%</td></tr>`).join('')}</tbody></table>`:'<div class="empty">ไม่มีข้อมูลการขายในช่วงวันที่นี้</div>'}</div>
    <div class="panel"><h2>จำนวนจานที่ขาย</h2><div class="bars">${rank.slice(0,10).map(r=>`<div class="b"><span>${esc(menuName(r.m))}</span><span class="t"><i style="width:${r.q/mx*100}%"></i></span><span class="r num" style="text-align:right">${r.q}</span></div>`).join('')||'<div class="empty">ไม่มีข้อมูล</div>'}</div></div></div>`;
  }else{
    const os=S.orders.filter(o=>inR(o.time));
    const st=[['served','เสิร์ฟแล้ว','p-served'],['cooking','กำลังทำ','p-cook'],['cancelled','ยกเลิก','p-cancel']];
    const valid=os.filter(o=>o.status!=='cancelled');
    const hours={};valid.forEach(o=>{const h=new Date(o.time).getHours();hours[h]=(hours[h]||0)+1});const hk=Object.keys(hours).map(Number).sort((a,b)=>a-b);const hm=Math.max(...Object.values(hours),1);
    const members=valid.filter(o=>o.cust!=='c0').length;
    body.innerHTML=`<div class="kpis">
      <div class="kpi"><div class="l">คำสั่งซื้อทั้งหมด</div><div class="v num">${os.length}</div></div>
      ${st.map(([k,l])=>`<div class="kpi"><div class="l">${l}</div><div class="v num">${os.filter(o=>o.status===k).length}</div></div>`).join('')}</div>
    <div class="two"><div class="panel tablewrap"><h2>รายการคำสั่งซื้อ</h2>${ordersTable(os.slice().reverse().slice(0,60),false)}${os.length>60?`<p class="sub">แสดง 60 รายการล่าสุดจาก ${os.length}</p>`:''}</div>
    <div class="panel"><h2>ช่วงเวลาที่มีออเดอร์</h2><div class="bars">${hk.map(h=>`<div class="b"><span class="num">${String(h).padStart(2,'0')}:00</span><span class="t"><i style="width:${hours[h]/hm*100}%"></i></span><span class="num" style="text-align:right">${hours[h]}</span></div>`).join('')||'<div class="empty">ไม่มีข้อมูล</div>'}</div>
    <p class="sub" style="margin-top:12px">ลูกค้าสมาชิก ${members} ออเดอร์ · ลูกค้าทั่วไป ${valid.length-members} ออเดอร์</p></div></div>`;
  }
};

