const CACHE='credigestor-v32-loan-statements';
const ASSETS=['./','./index.html','./styles.css','./enhancements.css','./app.js','./enhancements.js','./backup-csv.js','./features-v5.js','./features-v6.js','./features-v7.js','./features-v8.js','./features-v10.js','./features-v11.js','./features-v12.js','./features-v13.js','./features-v15.js','./features-v16.js','./features-v17.js','./features-v18.js','./features-v19.js','./features-v20.js','./features-v21.js','./features-v22.js','./features-v23.js','./features-v24.js','./features-v25.js','./features-v26.js','./features-v27.js','./charge-search.js','./features-payment-history.js','./payment-history.css','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([
  self.clients.claim(),
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
])));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
  e.respondWith(fetch(e.request).then(r=>{
    if(r.ok){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)))}
    return r;
  }).catch(()=>caches.open(CACHE).then(c=>c.match(e.request,{ignoreSearch:true}))));
});

self.addEventListener('message',event=>{
  const d=event.data||{};if(d.type!=='SHOW_CHARGE_NOTIFICATION')return;
  event.waitUntil(self.registration.showNotification(d.title||'CrediGestor',{
    body:d.body||'',
    icon:'./icon-192.png',
    badge:'./icon-192.png',
    tag:d.tag||`credigestor-${Date.now()}`,
    renotify:false,
    requireInteraction:!!d.requireInteraction,
    data:{whatsappUrl:d.whatsappUrl||'',appUrl:d.appUrl||'./#charges'},
    actions:[
      ...(d.whatsappUrl?[{action:'whatsapp',title:'Cobrar no WhatsApp'}]:[]),
      {action:'open',title:'Abrir cobranças'}
    ]
  }));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const d=event.notification.data||{};
  const target=(event.action==='open'||!d.whatsappUrl)?(d.appUrl||'./#charges'):d.whatsappUrl;
  event.waitUntil((async()=>{
    if(target&&/^https:\/\/wa\.me\//i.test(target)){
      try{await self.clients.openWindow(target);return}catch(_){ }
    }
    const appUrl=d.appUrl||new URL('./#charges',self.location.href).href;
    const wins=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const w of wins){
      try{await w.focus();if('navigate' in w)await w.navigate(appUrl);return}catch(_){ }
    }
    await self.clients.openWindow(appUrl);
  })());
});

