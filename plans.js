const state={plans:[]};
const $=s=>document.querySelector(s);
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
async function loadPlans(){
  const list=$('#plansList');
  try{const r=await fetch('/api/v1/plans',{cache:'no-store'});const d=await r.json();state.plans=d.plans||[];$('#orderPlan').innerHTML=state.plans.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');list.innerHTML=state.plans.map((p,i)=>`<article class="plan-card ${i===1?'featured-plan':''}"><div class="plan-tag">${i===1?'POPULAR':i===0?'STARTER':'BUSINESS'}</div><h3>${esc(p.name)}</h3><div class="price">Contact</div><p>${esc(p.description)}</p><ul>${p.features.map(f=>`<li>${esc(f)}</li>`).join('')}</ul><button class="plan-btn buy-plan" data-plan="${esc(p.id)}">${i===1?'Buy Premium':'Request Plan'}</button></article>`).join('')||'<div class="feature-card">No plans available.</div>';document.querySelectorAll('.buy-plan').forEach(b=>b.onclick=()=>openOrder(b.dataset.plan));}
  catch(e){list.innerHTML='<div class="feature-card">Failed to load plans.</div>'}
}
function openOrder(plan){$('#orderPlan').value=plan;$('#orderModal').hidden=false;$('#orderEmail').focus()}
function closeOrder(){$('#orderModal').hidden=true;$('#orderResult').textContent=''}
async function submitOrder(e){e.preventDefault();const plan=$('#orderPlan').value,email=$('#orderEmail').value.trim(),out=$('#orderResult');out.textContent='Creating order...';try{const r=await fetch('/api/v1/plans/buy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan,email})});const d=await r.json();out.textContent=JSON.stringify(d,null,2)}catch(err){out.textContent=JSON.stringify({status:false,error:err.message},null,2)}}
document.addEventListener('DOMContentLoaded',()=>{loadPlans();$('#closeOrder').onclick=closeOrder;$('#orderForm').onsubmit=submitOrder});
