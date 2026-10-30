const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.join(root, new URL(req.url, 'http://localhost').pathname === '/' ? 'index.html' : new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => { if (err) res.writeHead(404).end(); else { res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'); res.end(data); } });
});
const loan = (id, startDate, baseDueDay, payments = [], extra = {}) => ({id, title:id, startDate, baseDueDay, initialPrincipal:1000, billingType:'fixed', fixedAmount:100, interestRate:10, active:true, payments, movements:[], ...extra});
const paid = reference => ({reference, amount:100, paidAt:reference+'-08'});
const clients = [
  {id:'old', name:'Atraso antigo', contracts:[loan('old-loan','2025-12-02',2,Array.from({length:8},(_,i)=>paid(`2026-${String(i+3).padStart(2,'0')}`)))]},
  {id:'today', name:'Hoje parcial', contracts:[loan('today-loan','2026-09-08',8,[{reference:'2026-10',amount:40,paidAt:'2026-10-08'}])]},
  {id:'current', name:'Cliente em dia', contracts:[loan('current-loan','2026-09-01',1,[paid('2026-10')])]},
  {id:'future', name:'Futuro distante', contracts:[loan('future-loan','2027-03-01',1)]},
  {id:'closed', name:'Cliente quitado', contracts:[loan('closed-loan','2026-01-01',1,[],{active:false,status:'paid',loanStatus:'paid',closed:true,initialPrincipal:0})]}
].map(c=>({...c, phone:'', cpf:'', level:'Bronze', creditLimit:10000, guarantees:[], crm:[]}));
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser = await chromium.launch({headless:true});
  const context = await browser.newContext({viewport:{width:390,height:844}, timezoneId:'America/Sao_Paulo', serviceWorkers:'block'});
  await context.route(/https:\/\//, r=>process.env.BASE_URL&&r.request().url().startsWith(process.env.BASE_URL)?r.continue():r.abort());
  const page = await context.newPage(); const errors=[]; const results=[];
  page.setDefaultTimeout(5000);
  if(process.env.BASELINE_FILE)await page.route('**/features-v26.js*',r=>r.fulfill({path:process.env.BASELINE_FILE,contentType:'application/javascript'}));
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  await page.clock.install({time:new Date('2026-10-08T15:00:00Z')});
  await page.addInitScript(data=>{if(!localStorage.getItem('credigestor_v1'))localStorage.setItem('credigestor_v1',JSON.stringify({clients:data}));},clients);
  async function check(name, fn) { try { await fn(); results.push({name,passed:true}); } catch(e) {results.push({name,passed:false,error:e.message});} finally {await page.evaluate(()=>document.getElementById('modal')?.close());} }
  try {
    await page.goto(process.env.BASE_URL||`http://127.0.0.1:${server.address().port}`);
    await page.locator('[data-view="charges"]').click();
    await check('Hoje mostra saldo parcial de R$ 60',async()=>{assert.equal(await page.locator('.v26-charge-card').count(),1);assert.match(await page.locator('.v26-charge-card').innerText(),/60,00/);});
    await check('Registrar pagamento abre parcela na referência correta e remove cobrança liquidada',async()=>{
      await page.locator('.v26-pay').click();await page.locator('#v21Parcel').click();
      assert.equal(await page.locator('#v21Ref').inputValue(),'2026-10');
      assert.equal(await page.locator('#v21Amount').inputValue(),'60.00');await page.locator('#v21ConfirmParcel').click();
      assert.equal(await page.locator('.v26-charge-card').count(),0);
      assert.equal(await page.evaluate(()=>paymentTotalForMonth(state.clients.find(c=>c.id==='today').contracts[0],'2026-10')),100);
    });
    await page.locator('[data-v26-tab="late"]').click();
    await check('Atrasados inclui janeiro e fevereiro anteriores à janela de dois meses',async()=>{assert.equal(await page.locator('.v26-charge-card').count(),2);assert.match(await page.locator('.v26-charge-card').first().innerText(),/2026-01/);});
    await page.locator('[data-v26-tab="next"]').click();
    await check('Próximos inclui primeiro vencimento de contrato futuro',async()=>assert.equal(await page.locator('.v26-charge-card').filter({hasText:'Futuro distante'}).count(),1));
    await check('Assistente de cobrança existente continua acessível',async()=>{await page.locator('.v26-assistant').first().click();assert.equal(await page.locator('#v22Message').count(),1);await page.locator('.modal-close').click();});
    await page.locator('[data-view="loans"]').click();
    await check('Dívida antiga impede selo Em dia',async()=>assert.equal(await page.locator('.loan-card').filter({hasText:'Atraso antigo'}).locator('.v26-current-badge').count(),0));
    await check('Pagamento integral permite selo Em dia',async()=>assert.equal(await page.locator('.loan-card').filter({hasText:'Cliente em dia'}).locator('.v26-current-badge').count(),1));
    await check('Cliente clicável abre cadastro',async()=>{await page.locator('.v26-client-link').filter({hasText:'Cliente em dia'}).click();assert.match(await page.locator('#modalContent').innerText(),/Cliente em dia/);await page.locator('.modal-close').click();});
    await check('Novo empréstimo usa cadastro existente e persiste após recarregar',async()=>{
      await page.locator('.v26-new-loan').click(); await page.locator('[data-person-v5="current"]').click();
      await page.locator('#kTitle').fill('Novo teste'); await page.locator('#kPrincipal').fill('500'); await page.locator('#saveContractBtn').click();
      assert.equal(await page.evaluate(()=>state.clients.find(c=>c.id==='current').contracts.length),2);
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('credigestor_v1')).clients.find(c=>c.id==='current').contracts.length),2);
      await page.locator('.modal-close').click();
      await page.reload();
      assert.equal(await page.evaluate(()=>state.clients.find(c=>c.id==='current').contracts.length),2);
      await page.locator('[data-view="loans"]').click();
    });
    await check('Quitação mostra Em dia em Encerrados e não gera cobranças',async()=>{
      await page.locator('[data-loan-filter="closed"]').click();assert.equal(await page.locator('.loan-card').filter({hasText:'Cliente quitado'}).locator('.v26-current-badge').count(),1);
      await page.locator('[data-view="charges"]').click();
      for(const tab of ['today','late','next']){await page.locator(`[data-v26-tab="${tab}"]`).click();assert.equal(await page.locator('.v26-charge-card').filter({hasText:'Cliente quitado'}).count(),0);}
    });
    await check('Virada do dia atualiza categoria automaticamente',async()=>{
      await page.locator('[data-v26-tab="today"]').click();
      await page.clock.fastForward(24*60*60*1000);
      await page.clock.runFor(60001);
      assert.match(await page.locator('.v26-charge-summary').innerText(),/09\/10\/2026/);
    });
    await check('Sem erros JavaScript',async()=>assert.deepEqual(errors,[]));
    await check('PWA instala cache atual e reabre offline com arquivos versionados',async()=>{
      const offlineContext=await browser.newContext();
      try{
        await offlineContext.route('https://accounts.google.com/**',r=>r.abort());
        const offlinePage=await offlineContext.newPage();
        await offlinePage.goto(process.env.BASE_URL||`http://127.0.0.1:${server.address().port}`);
        await offlinePage.evaluate(()=>navigator.serviceWorker.ready);
        await offlinePage.waitForFunction(()=>navigator.serviceWorker.controller);
        assert.ok(await offlinePage.evaluate(async()=>(await caches.keys()).includes('credigestor-v32-loan-statements')));
        await offlineContext.setOffline(true);await offlinePage.reload();
        assert.equal(await offlinePage.evaluate(()=>window.__credigestorV26.version),'27.0');
        await offlinePage.locator('[data-view="charges"]').click();assert.equal(await offlinePage.locator('[data-v26-tab]').count(),3);
      } finally {await offlineContext.close();}
    });
    console.log(JSON.stringify({results,errors},null,2));
    if(results.some(r=>!r.passed))process.exitCode=1;
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
