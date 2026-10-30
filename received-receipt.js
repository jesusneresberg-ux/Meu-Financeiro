(function(){
  'use strict';
  const clientsRender=renderClients;
  renderClients=function(){
    const out=clientsRender(),view=document.getElementById('view');
    document.getElementById('addClientFab')?.remove();
    const button=document.createElement('button');button.type='button';button.className='primary-btn';button.id='addClientQuick';button.textContent='+ Adicionar cliente';button.onclick=()=>openClientModal();
    view.querySelector('.section-title')?.after(button);return out;
  };  function attach(clientId,contractId,ref){
    const client=state.clients.find(x=>x.id===clientId),contract=client?.contracts.find(x=>x.id===contractId);if(!contract||isPaidContract(contract))return;
    const reference=ref||window.pendingCollectionCharges(client,contract)[0]?.ref||monthRef(),[y,m]=reference.split('-').map(Number),charge=chargeFor(client,contract,y,m-1);if(charge.remaining<=0||charge.status==='not_due'){alert('Esta parcela não possui valor em aberto.');return;}
    const text=`📩 *Mensagem de cobrança*\n\n👤 Olá, ${client.name}!\n\n📄 Seu débito referente ao contrato ${contract.loanCode||contract.title||contract.id} está em aberto.\n\n💰 Valor total para quitação (capital + juros atuais): ${brl(window.collectionPayoffQuote(contract).total)}\n\n\n💵 Valor da parcela em aberto: ${brl(charge.remaining)}\n🗓️ Referência: ${reference}\n📅 Vencimento: ${charge.due.toLocaleDateString('pt-BR')}\n\n🤝 Por favor, entre em contato para regularizar o pagamento.\n🧾 Caso já tenha pago, envie o comprovante para conferência.`;
    let phone=String(client.phone||'').replace(/\D/g,'');if(phone.length===10||phone.length===11)phone='55'+phone;const valid=/^55\d{10,11}$/.test(phone);
    openModal(`<h2>Mensagem de cobrança</h2><div class="field"><label>Confira a mensagem antes de enviar</label><textarea id="collectionText" readonly rows="16">${esc(text)}</textarea></div><div class="actions">${valid?`<a class="primary-btn" href="https://wa.me/${phone}?text=${encodeURIComponent(text)}" target="_self">Abrir WhatsApp</a>`:''}<button type="button" class="soft-btn" id="copyCollection">Copiar mensagem</button></div><p class="muted" id="collectionStatus" role="status">${valid?'Confirme o envio no WhatsApp.':'Cadastre um telefone com DDD para abrir o WhatsApp. Você pode copiar a mensagem.'}</p>`,()=>{
      document.getElementById('copyCollection').onclick=async()=>{const field=document.getElementById('collectionText'),status=document.getElementById('collectionStatus');try{await navigator.clipboard.writeText(text);status.textContent='Mensagem copiada.';}catch(_){field.focus();field.select();status.textContent='Texto selecionado. Copie e cole na conversa do cliente.';}};
    });
  }
  function decorate(root,clientId){
    root?.querySelectorAll('.loan-card,.contract-card,.list-item').forEach(card=>{
      if(card.querySelector('.received-attach'))return;
      const edit=card.querySelector('.edit-loan2,.edit-contract,[data-v21-client]');if(!edit)return;
      const c=clientId||edit.dataset.client||edit.dataset.v21Client,k=edit.dataset.loan||edit.dataset.id||edit.dataset.v21Loan;
      if(!c||!k)return;
      const contract=state.clients.find(x=>x.id===c)?.contracts.find(x=>x.id===k);if(!contract||contract.active===false)return;
      const button=document.createElement('button');button.type='button';button.className='small-btn received-attach';button.textContent='💬 Mensagem de cobrança';button.onclick=()=>attach(c,k,edit.dataset.v21Ref);(card.querySelector('.inline-actions')||card).append(button);
    });
  }
  const baseRender=render;render=function(){const out=baseRender();if(currentView==='charges')decorate(document.getElementById('view'));return out};
  const detail=openClientDetail;openClientDetail=function(id){const out=detail(id);const root=document.getElementById('modalContent');decorate(root,id);
    const client=state.clients.find(c=>c.id===id);
    for(const k of client?.contracts||[])for(const p of k.payments||[]){if(!p.receivedReceipt)continue;
      const b=document.createElement('button');b.type='button';b.className='soft-btn';b.textContent=`📎 ${p.reference} · ${brl(p.amount)} · ${p.receivedReceipt.name}`;
      b.onclick=()=>{const a=document.createElement('a');a.href=p.receivedReceipt.data;a.download=p.receivedReceipt.name;a.click()};root.append(b);
    }return out;
  };
  render();
})();








