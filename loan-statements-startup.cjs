const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const file=path.join(repo,new URL(req.url,'http://localhost').pathname);
  fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data)});
});
const payment=(id,amount)=>({id,amount,paidAt:'2026-10-08',reference:'2026-10',method:'PIX'});
const loan=(id,active,payments)=>({id,title:id,active,initialPrincipal:1000,billingType:'fixed',fixedAmount:100,interestRate:10,startDate:'2026-09-08',baseDueDay:8,movements:[],payments});
const wallet={clients:[{id:'ana',name:'Ana',phone:'11999999999',level:'Bronze',creditLimit:10000,guarantees:[],crm:[],contracts:[loan('active',true,[payment('p1',40)]),loan('closed',false,[payment('p2',200)]),loan('empty',true,[])]}],settings:{pixKey:'test-pix',pixName:'Teste',notifyDays:[]},goals:{monthlyReceipt:0,maxDelinquency:10}};
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  for(const site of ['', 'firebase-hosting/']){
   const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
   await context.route(/https:\/\//,r=>r.abort());
   await context.addInitScript(({wallet,site})=>{
    const key=site?'credigestor_single_owner_v25':'credigestor_v1';if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(wallet));
    const user={uid:'r7XvaVZzBhglpaMAuMlBXuipBBt1',emailVerified:true,email:'test@example.com'};
    const auth={currentUser:user,setPersistence:async()=>{},onAuthStateChanged:fn=>{window.testAuth=fn;fn(user)}};
    window.firebase={initializeApp(){},auth:Object.assign(()=>auth,{Auth:{Persistence:{LOCAL:'local'}}})};
   },{wallet,site});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   // Hold the first script: the last module must still be requested during its download.
   let firstPending=false,parallel=false;
   if(site){
    await page.route('**/app.js?*',async r=>{firstPending=true;await new Promise(resolve=>setTimeout(resolve,700));await r.continue();firstPending=false});
    page.on('request',req=>{if(req.url().includes('features-payment-history.js')&&firstPending)parallel=true});
   }
   await page.goto(`http://127.0.0.1:${server.address().port}/${site}index.html`);
   await page.waitForFunction(()=>window.PaymentHistory&&document.body.dataset.v26Locked!=='true');
   if(site)assert.equal(parallel,true,'Modules downloaded concurrently');
   await page.locator('[data-view="loans"]').click();
   assert.equal(await page.locator('.ph-loan-open').count(),2);
   await page.locator('.loan-card').filter({has:page.locator('[data-loan="active"]')}).locator('.ph-loan-open').click();
   assert.equal(await page.locator('.ph-item').count(),1);assert.match(await page.locator('.ph-stats').innerText(),/40,00/);
   await page.locator('#phMethod').selectOption('pix');assert.equal(await page.locator('.ph-item').count(),1);
   const download=page.waitForEvent('download');await page.locator('#phCsv').click();
   const csv=fs.readFileSync(await (await download).path(),'utf8');assert.match(csv,/40,00/);assert.doesNotMatch(csv,/200,00/);
   await page.locator('#phBack').click();
   await page.locator('[data-loan-filter="closed"]').click();assert.equal(await page.locator('.ph-loan-open').count(),1);
   await page.locator('.ph-loan-open').click();assert.match(await page.locator('.ph-stats').innerText(),/200,00/);
   await page.locator('#phBack').click();await page.locator('[data-loan-filter="active"]').click();
   await page.locator('.loan-card').filter({has:page.locator('[data-loan="empty"]')}).locator('.ph-loan-open').click();
   assert.match(await page.locator('.ph-list').innerText(),/Nenhum pagamento/);
   await page.locator('#phBack').click();
   // Cancel leaves the payment intact; failed persistence rolls back in memory.
   await page.locator('.loan-card').filter({has:page.locator('[data-loan="active"]')}).locator('.ph-loan-open').click();
   page.once('dialog',d=>d.dismiss());await page.locator('.ph-delete').click();assert.equal(await page.locator('.ph-item').count(),1);
   await page.evaluate(()=>{window.savedSaveState=saveState;saveState=()=>{throw Error('storage full')}});
   const accept=d=>d.accept();page.on('dialog',accept);await page.locator('.ph-delete').click();
   assert.equal(await page.evaluate(()=>state.clients[0].contracts[0].payments.length),1);
   await page.evaluate(()=>{saveState=window.savedSaveState});await page.locator('.ph-delete').click();
   assert.equal(await page.locator('.ph-item').count(),0);
   assert.equal(await page.evaluate(()=>state.clients[0].contracts[1].payments.length),1);
   assert.equal(await page.evaluate(()=>chargeFor(state.clients[0],state.clients[0].contracts[0],2026,9).remaining),100);
   await page.reload();await page.waitForFunction(()=>window.PaymentHistory&&document.body.dataset.v26Locked!=='true');
   assert.equal(await page.evaluate(()=>state.clients[0].contracts[0].payments.length),0);
   // Undo an identifiable payoff restores the principal and reopens the loan.
   await page.evaluate(()=>{
    const k=state.clients[0].contracts[1];k.status='paid';k.loanStatus='paid';k.closed=true;k.paidOffAt='2026-10-08';
    k.payments=[{id:'payoff',amount:1100,principalAmount:1000,paidAt:'2026-10-08',payoff:true,type:'payoff'}];
    k.movements=[{id:'payoff-move',amount:1000,type:'amortization',date:'2026-10-08',payoff:true}];saveState();
    PaymentHistory.open('ana','closed',true);
   });
   await page.locator('.ph-delete').click();
   assert.deepEqual(await page.evaluate(()=>{const k=state.clients[0].contracts[1];return [k.active,k.payments.length,k.movements.length,contractBalance(k)]}),[true,0,0,1000]);
   page.off('dialog',accept);await page.locator('#phBack').click();
   if(site){
    await page.evaluate(()=>openClientDetail('ana'));await page.locator('.received-attach').first().click();
    assert.equal(await page.locator('#collectionText').count(),1);assert.equal(await page.locator('#collectionPixText,#sendCollectionPix,#copyCollectionPix').count(),0);
    assert.doesNotMatch(await page.locator('#modalContent').innerText(),/2ª mensagem/);
    await page.evaluate(()=>window.testAuth(null));await page.waitForFunction(()=>document.body.dataset.v26Locked==='true');
    assert.equal(await page.locator('#app').isVisible(),false);
   }
   assert.deepEqual(errors,[]);console.log(site||'root','PASS: isolated statements, filters, CSV, closed/empty loans, return navigation',site?'and authenticated parallel startup / main charge only':'');
   await context.close();
  }
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
