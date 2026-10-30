/* CrediGestor - Histórico de pagamentos por cliente (2026.10.30)
 * Lê os pagamentos já gravados em state.clients[].contracts[].payments,
 * então funciona no GitHub Pages e no Firebase (sincronizado via saveState).
 * Botão "Histórico de pagamentos" na ficha do cliente: filtros, totais,
 * CSV, impressão, comprovante por WhatsApp/cópia e exclusão de pagamento. */
(function(){
  if(typeof openClientDetail!=='function'||typeof state==='undefined')return;
  const METHODS={dinheiro:'💵 Dinheiro',pix:'📱 PIX',transferencia:'🏦 Transferência',cartao:'💳 Cartão'};
  let filters={month:'',type:'',method:''};

  function findClient(id){return (state.clients||[]).find(c=>c.id===id)}
  function phPhone(phone=''){let d=String(phone).replace(/\D/g,'');if((d.length===10||d.length===11)&&!d.startsWith('55'))d='55'+d;return d}
  function phType(p){return p.payoff?'payoff':(p.type==='partial'||p.status==='partial')?'partial':'total'}
  function phTypeLabel(t){return t==='payoff'?'Quitação total':t==='partial'?'Pagamento parcial':'Pagamento'}
  function phMethodKey(m=''){const s=String(m).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();return s.includes('pix')?'pix':s.includes('transf')?'transferencia':s.includes('cart')?'cartao':s.includes('dinheiro')||s.includes('especie')?'dinheiro':s}
  function phMethodLabel(m){return METHODS[phMethodKey(m)]||(m?esc(m):'—')}
  function phDate(iso){return iso?new Date(String(iso).slice(0,10)+'T12:00').toLocaleDateString('pt-BR'):'—'}

  function collect(cl){
    return (cl.contracts||[]).flatMap(k=>(k.payments||[]).map(p=>({
      id:p.id,contractId:k.id,loan:k.title||'Contrato',amount:Number(p.amount)||0,
      date:String(p.paidAt||p.date||p.createdAt||'').slice(0,10),reference:p.reference||p.ref||'',
      type:phType(p),method:p.method||'',note:p.note||p.notes||'',remaining:p.remainingForMonth
    }))).sort((a,b)=>b.date.localeCompare(a.date));
  }
  function applyFilters(list){
    return list.filter(p=>(!filters.month||p.date.slice(0,7)===filters.month)&&(!filters.type||p.type===filters.type)&&(!filters.method||phMethodKey(p.method)===filters.method));
  }
  function stats(list){const total=list.reduce((t,p)=>t+p.amount,0);return {total,count:list.length,avg:list.length?total/list.length:0}}

  function receiptText(cl,p){
    return `🧾 *Comprovante de Pagamento*\n\n👤 Cliente: ${cl.name}\n📄 Empréstimo: ${p.loan}\n🗓️ Referência: ${p.reference||'—'}\n📅 Data: ${phDate(p.date)}\n📌 Tipo: ${phTypeLabel(p.type)}\n💳 Forma: ${METHODS[phMethodKey(p.method)]?.replace(/^\S+\s/,'')||p.method||'—'}\n💰 Valor pago: ${brl(p.amount)}${Number.isFinite(Number(p.remaining))?`\n⏳ Restante do mês: ${brl(p.remaining)}`:''}${p.note?`\n📝 ${p.note}`:''}`;
  }

  function listHtml(list){
    if(!list.length)return '<div class="empty">Nenhum pagamento encontrado.</div>';
    let month='';
    return list.map(p=>{
      const m=p.date?new Date(p.date+'T12:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'}):'Sem data';
      const head=m!==month?`<div class="ph-month">${esc(m)}</div>`:'';month=m;
      return `${head}<div class="ph-item" data-ph-id="${esc(p.id)}">
        <div class="row space"><strong>${brl(p.amount)}</strong><span class="muted">${phDate(p.date)}</span></div>
        <div class="muted">${phTypeLabel(p.type)} • ${esc(p.loan)}${p.reference?` • ref. ${esc(p.reference)}`:''} • ${phMethodLabel(p.method)}</div>
        ${p.note?`<div class="note">${esc(p.note)}</div>`:''}
        <div class="inline-actions"><button type="button" class="small-btn ph-send">📤 WhatsApp</button><button type="button" class="small-btn ph-copy">📋 Copiar</button><button type="button" class="small-btn ph-delete">🗑️ Excluir pagamento</button></div>
      </div>`;
    }).join('');
  }

  function openPaymentHistory(clientId,contractId=null,fromLoans=false){
    const cl=findClient(clientId);if(!cl)return;
    const contract=contractId?(cl.contracts||[]).find(k=>k.id===contractId):null;
    if(contractId&&!contract)return;
    const all=collect(cl).filter(p=>!contractId||p.contractId===contractId),list=applyFilters(all),s=stats(list);
    const statementClient=contract?{...cl,name:cl.name+' — '+(contract.title||'Empréstimo')}:cl;
    openModal(`
      <div class="ph-wrap">
        <h2>${fromLoans?'Extrato de pagamentos':'Histórico de pagamentos'}</h2>
        <div class="muted">${esc(statementClient.name)}</div>
        <div class="ph-stats">
          <div class="card metric"><div class="kicker">TOTAL PAGO</div><strong>${brl(s.total)}</strong></div>
          <div class="card metric"><div class="kicker">PAGAMENTOS</div><strong>${s.count}</strong></div>
          <div class="card metric"><div class="kicker">MÉDIA</div><strong>${brl(s.avg)}</strong></div>
        </div>
        <div class="ph-filters">
          <input type="month" id="phMonth" value="${esc(filters.month)}" aria-label="Mês">
          <select id="phType" aria-label="Tipo"><option value="">Todos os tipos</option>${['total','partial','payoff'].map(t=>`<option value="${t}"${filters.type===t?' selected':''}>${phTypeLabel(t)}</option>`).join('')}</select>
          <select id="phMethod" aria-label="Forma"><option value="">Todas as formas</option>${Object.entries(METHODS).map(([k,v])=>`<option value="${k}"${filters.method===k?' selected':''}>${v}</option>`).join('')}</select>
          <button type="button" class="small-btn" id="phClear">Limpar filtros</button>
        </div>
        <div class="inline-actions"><button type="button" class="small-btn" id="phCsv">📊 Exportar CSV</button><button type="button" class="small-btn" id="phPrint">🖨️ Imprimir / PDF</button><button type="button" class="small-btn" id="phBack">← Voltar ${fromLoans?'aos empréstimos':'ao cliente'}</button></div>
        <div class="card ph-list">${listHtml(list)}</div>
      </div>`,()=>{
      const refresh=()=>openPaymentHistory(clientId,contractId,fromLoans);
      document.getElementById('phMonth').onchange=e=>{filters.month=e.target.value;refresh()};
      document.getElementById('phType').onchange=e=>{filters.type=e.target.value;refresh()};
      document.getElementById('phMethod').onchange=e=>{filters.method=e.target.value;refresh()};
      document.getElementById('phClear').onclick=()=>{filters={month:'',type:'',method:''};refresh()};
      document.getElementById('phCsv').onclick=()=>exportCsv(statementClient,list);
      document.getElementById('phPrint').onclick=()=>printStatement(statementClient,list,s);
      document.getElementById('phBack').onclick=()=>{closeModal();if(fromLoans){currentView='loans';syncNav();render()}else openClientDetail(clientId)};
      document.querySelectorAll('#modalContent .ph-item').forEach(row=>{
        const p=list.find(x=>x.id===row.dataset.phId);if(!p)return;
        row.querySelector('.ph-send').onclick=()=>{
          const phone=phPhone(cl.phone);
          if(phone.length<12){alert(`Cadastre um telefone com DDD para ${cl.name} para enviar o comprovante pelo WhatsApp.`);return}
          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(receiptText(cl,p))}`,'_blank','noopener');
        };
        row.querySelector('.ph-copy').onclick=async()=>{
          try{await navigator.clipboard.writeText(receiptText(cl,p));alert('Comprovante copiado.')}
          catch(e){prompt('Copie o comprovante:',receiptText(cl,p))}
        };
        row.querySelector('.ph-delete').onclick=()=>{
          const k=(cl.contracts||[]).find(x=>x.id===p.contractId);if(!k)return;
          const saved=(k.payments||[]).find(x=>x.id===p.id);if(!saved)return;
          const payoff=saved.payoff||saved.type==='payoff';
          if(!confirm(`Excluir o pagamento de ${brl(p.amount)} de ${phDate(p.date)}? ${payoff?'A quitação será desfeita e o empréstimo será reaberto.':'A cobrança da referência será recalculada.'}`))return;
          const previous=JSON.parse(JSON.stringify(k));
          try{
            if(payoff){
              const matches=(k.movements||[]).filter(m=>m.payoff&&m.type==='amortization'&&m.date===saved.paidAt&&Number(m.amount)===Number(saved.principalAmount));
              if((Number(saved.principalAmount)>0&&matches.length!==1)||(k.payments||[]).some(x=>x!==saved&&(x.payoff||x.type==='payoff')))
                throw Error('Não foi possível identificar com segurança a amortização desta quitação. Nenhum registro foi excluído.');
              k.movements=(k.movements||[]).filter(m=>!matches.includes(m));
              k.active=true;k.closed=false;k.status='active';k.loanStatus='active';k.notificationsDisabled=false;
              ['closedAt','paidOffAt','paidOffEarly','closedReason','nextDueDate'].forEach(key=>delete k[key]);
              k.currentPrincipal=contractBalance(k);
            }
            k.payments=(k.payments||[]).filter(x=>x!==saved);
            k.updatedAt=new Date().toISOString();
            saveState();
          }catch(error){
            Object.keys(k).forEach(key=>delete k[key]);Object.assign(k,previous);
            alert('Não foi possível excluir o pagamento: '+error.message);return;
          }
          if(typeof render==='function')render();refresh();
        };
      });
    });
  }

  function csvCell(v){const s=String(v??'');return /[;"\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
  function exportCsv(cl,list){
    const rows=[['Data','Tipo','Empréstimo','Referência','Forma','Valor','Observação'],...list.map(p=>[phDate(p.date),phTypeLabel(p.type),p.loan,p.reference,p.method,p.amount.toFixed(2).replace('.',','),p.note])];
    const blob=new Blob(['﻿'+rows.map(r=>r.map(csvCell).join(';')).join('\n')],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`extrato_${String(cl.name).replace(/\s+/g,'_')}_${todayISO()}.csv`;a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  function printStatement(cl,list,s){
    const w=window.open('','_blank');if(!w){alert('Permita janelas pop-up para imprimir o extrato.');return}
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Extrato - ${esc(cl.name)}</title><style>body{font-family:Arial,sans-serif;margin:20px;color:#0f172a}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #e2e8f0;padding:6px;text-align:left;font-size:12px}th{background:#f1f5f9}.r{text-align:right}</style></head><body>
      <h2>Extrato de pagamentos</h2><p><b>Cliente:</b> ${esc(cl.name)}<br><b>Gerado em:</b> ${new Date().toLocaleString('pt-BR')}</p>
      <p><b>Total pago:</b> ${brl(s.total)} • <b>Pagamentos:</b> ${s.count} • <b>Média:</b> ${brl(s.avg)}</p>
      <table><thead><tr><th>Data</th><th>Tipo</th><th>Empréstimo</th><th>Referência</th><th>Forma</th><th class="r">Valor</th></tr></thead><tbody>
      ${list.map(p=>`<tr><td>${phDate(p.date)}</td><td>${phTypeLabel(p.type)}</td><td>${esc(p.loan)}</td><td>${esc(p.reference)}</td><td>${esc(p.method||'—')}</td><td class="r">${brl(p.amount)}</td></tr>`).join('')}
      </tbody></table><script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  }

  const base=openClientDetail;
  openClientDetail=function(id){
    const out=base(id);
    const root=document.getElementById('modalContent');
    if(root&&!root.querySelector('#phOpenBtn')&&findClient(id)){
      const b=document.createElement('button');b.type='button';b.id='phOpenBtn';b.className='small-btn ph-open';b.textContent='🧾 Histórico de pagamentos';
      b.onclick=()=>{filters={month:'',type:'',method:''};openPaymentHistory(id)};
      const head=root.querySelector('.client-head');
      if(head)head.insertAdjacentElement('afterend',b);else root.prepend(b);
    }
    return out;
  };
  if(typeof renderLoans2==='function'){
    const loans=renderLoans2;
    renderLoans2=function(){
      const out=loans();
      document.querySelectorAll('#view .loan-card').forEach(card=>{
        const edit=card.querySelector('.edit-loan2');
        if(!edit||card.querySelector('.ph-loan-open'))return;
        const button=document.createElement('button');
        button.type='button';button.className='small-btn ph-loan-open';button.textContent='🧾 Extrato de pagamentos';
        button.onclick=()=>{filters={month:'',type:'',method:''};openPaymentHistory(edit.dataset.client,edit.dataset.loan,true)};
        card.querySelector('.inline-actions').append(button);
      });
      return out;
    };
    if(currentView==='loans')renderLoans2();
  }
  window.PaymentHistory={open:openPaymentHistory,collect:id=>{const cl=findClient(id);return cl?collect(cl):[]}};
})();
