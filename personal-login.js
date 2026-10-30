(function(){
  'use strict';
  const OWNER='r7XvaVZzBhglpaMAuMlBXuipBBt1',ORG='org_'+OWNER,KEY='credigestor_single_owner_v25';
  let epoch=0,started=false,launchPromise,auth;
  document.getElementById('v261Boot')?.remove();
  const gate=document.createElement('div');gate.className='v26-auth-overlay';gate.id='personalLogin';document.body.append(gate);
  const account=document.createElement('dialog');account.id='v26Account';document.body.append(account);
  function lock(text,error=false){document.getElementById('app').style.display='none';document.getElementById('modal').close();account.close();document.body.dataset.v26Locked='true';gate.style.display='grid';gate.innerHTML='<section class="v26-auth-card"><h2>CrediGestor</h2><p>Acesso pessoal com sua Conta Google.</p><p id="personalMessage" role="status"></p><button id="personalGoogle" type="button">Entrar com Google</button></section>';gate.querySelector('#personalMessage').textContent=text;gate.querySelector('#personalMessage').style.color=error?'#991b1b':'';gate.querySelector('button').onclick=async()=>{try{await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());}catch(e){lock(e.code==='auth/popup-closed-by-user'?'O login foi fechado. Tente novamente.':e.message,true);}};}
  function archive(value,key){return new Promise((resolve,reject)=>{const r=indexedDB.open('credigestor-individual-recovery',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onerror=()=>reject(Error('Não foi possível criar a cópia de recuperação no aparelho.'));r.onsuccess=()=>{const db=r.result,tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(value,key);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(Error('Não foi possível preservar a cópia de recuperação.'));};};});}
  async function seed(user,token){
    const existing=localStorage.getItem(KEY);if(existing){CrediGestorCore.validate(JSON.parse(existing));return;}
    const guard=()=>{if(token!==epoch||auth.currentUser?.uid!==OWNER)throw Error('A conta mudou. Abra novamente com sua conta.');};
    const db=firebase.firestore(),root=db.collection('organizations').doc(ORG),ref=root.collection('appData').doc('main');
    const snap=await ref.get({source:'server'});guard();if(!snap.exists)throw Error('Não foi encontrada a carteira anterior. Nenhum dado foi substituído.');
    const [head,receipts]=await Promise.all([CrediGestorCore.hydrate(ref,snap.data(),guard),root.collection('paymentEvents').get({source:'server'})]);guard();
    const projection=CrediGestorCore.materialize(head,new Map(receipts.docs.map(d=>[d.id,d.data()])));
    const wallet=CrediGestorCore.validate(projection.state),raw=JSON.stringify(wallet);
    await archive({organizationId:ORG,revision:head.revision,state:wallet,receiptWarnings:projection.warnings},'cloud-before-personal');guard();
    const legacy=localStorage.getItem('credigestor_v1');if(legacy)await archive(legacy,'local-before-personal');guard();
    if(localStorage.getItem(KEY))return;
    try{localStorage.setItem(KEY,raw);}catch(_){throw Error('Falta espaço no aparelho para a carteira. A cópia original permanece na nuvem.');}
  }
  async function launch(){
    // Downloads paralelos; scripts clássicos com async=false executam na ordem de inserção.
    await Promise.all(window.CREDIGESTOR_PERSONAL_SCRIPTS.map(name=>new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.async=false;s.src=name+'?v=20261030-2';
      s.onload=resolve;s.onerror=()=>reject(Error('Não foi possível carregar a tela. Recarregue a página.'));
      document.body.append(s);
    })));
    document.getElementById('accountQuickBtn').onclick=openAccount;
    const original=renderSettings;renderSettings=function(){const out=original();const section=document.createElement('div');section.className='card';section.innerHTML='<h2>Minha conta</h2><p>Entrada automática com sua Conta Google.</p><button id="personalSettingsAccount" class="soft-btn" type="button">Minha conta e backup</button>';document.getElementById('view').prepend(section);section.querySelector('button').onclick=openAccount;return out;};
    if(currentView==='settings')renderSettings();
    if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
  function download(raw,name){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function oldDraft(){const key='credigestor_v261_draft:'+OWNER+':'+ORG;try{const text=sessionStorage.getItem(key);if(text)return Promise.resolve(text);}catch(_){}return new Promise(resolve=>{const r=indexedDB.open('credigestor-wallet-recovery',1);r.onupgradeneeded=()=>r.result.createObjectStore('backups');r.onerror=()=>resolve(null);r.onsuccess=()=>{const db=r.result;if(!db.objectStoreNames.contains('backups')){db.close();resolve(null);return;}const tx=db.transaction('backups','readonly'),q=tx.objectStore('backups').get(key);tx.oncomplete=()=>{db.close();resolve(q.result||null);};tx.onerror=()=>{db.close();resolve(null);};};});}
  async function openAccount(){
    if(auth.currentUser?.uid!==OWNER)return;
    account.innerHTML='<div class="v26-actions"><button id="personalClose">Fechar</button><button id="personalLogout">Sair da conta</button></div><h2>Minha conta</h2><p id="personalEmail"></p><p>Entrada automática ativada neste aparelho.</p><p>As alterações são salvas neste navegador. Exporte um backup para guardar uma cópia ou transferir para outro aparelho.</p><div class="v26-actions"><button id="personalBackup">Baixar backup atual</button><button id="personalDraft" hidden>Recuperar alterações pendentes da versão anterior</button></div><p id="personalRecoveryMessage" role="status"></p>';
    account.querySelector('#personalEmail').textContent=auth.currentUser.email;account.querySelector('#personalClose').onclick=()=>account.close();
    account.querySelector('#personalLogout').onclick=async()=>{account.close();lock('Saindo da conta…');try{await auth.signOut();}catch(e){lock(e.message,true);}};
    account.querySelector('#personalBackup').onclick=()=>download(JSON.stringify(state,null,2),'credigestor-backup-'+todayISO()+'.json');account.showModal();
    const raw=await oldDraft();if(!raw||!account.open)return;
    try{const draft=JSON.parse(raw);if(draft.uid!==OWNER||draft.organizationId!==ORG)return;CrediGestorCore.validate(draft.state);const button=account.querySelector('#personalDraft');button.hidden=false;button.onclick=async()=>{if(!confirm('Recuperar as alterações pendentes? A carteira atual será preservada em uma cópia de recuperação neste aparelho.'))return;try{button.disabled=true;await archive(JSON.stringify(state),'before-draft-recovery-'+Date.now());Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,defaultState(),CrediGestorCore.clone(draft.state));saveState();account.close();applySettings();render();}catch(e){account.querySelector('#personalRecoveryMessage').textContent=e.message;button.disabled=false;}};}catch(_){account.querySelector('#personalRecoveryMessage').textContent='O rascunho anterior foi mantido. Baixe uma cópia antes de tentar importá-lo.';}
  }
  lock('Restaurando sua entrada automática…');
  try{firebase.initializeApp(window.CREDIGESTOR_FIREBASE_CONFIG);auth=firebase.auth();
    (async()=>{await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);auth.onAuthStateChanged(async user=>{const token=++epoch;if(!user){lock('Entre com sua conta para continuar.');return;}if(user.uid!==OWNER||!user.emailVerified){lock('Este CrediGestor permite somente o acesso da sua conta principal.',true);return;}try{lock('Preparando sua carteira…');await seed(user,token);if(token!==epoch)return;if(!started){await (launchPromise ||= launch());started=true;}if(token!==epoch||auth.currentUser?.uid!==OWNER)return;document.body.dataset.v26Locked='false';document.body.dataset.v26Role='administrador';document.getElementById('app').style.display='';document.getElementById('app').inert=false;document.getElementById('modal').inert=false;gate.style.display='none';}catch(e){if(token===epoch)lock(e.message,true);}});})().catch(e=>lock(e.message,true));
  }catch(e){lock(e.message,true);}
})();













