const STORAGE_KEY = 'granazap_lancamentos_v1';
const RULES_KEY = 'granazap_regras_v1';

const defaultRules = [
  { matchType: 'cnpj', match: '48379018000172', category: 'Comércio', label: 'RJOTA COMERCIO E SERVICOS' },
  { matchType: 'name', match: 'RJOTA COMERCIO E SERVICOS', category: 'Comércio', label: 'RJOTA COMERCIO E SERVICOS' }
];

let lancamentos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let regras = JSON.parse(localStorage.getItem(RULES_KEY) || 'null') || defaultRules;
localStorage.setItem(RULES_KEY, JSON.stringify(regras));

const $ = (id) => document.getElementById(id);
const brl = (n) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n||0));
const normalizeDoc = (v='') => v.replace(/\D/g,'');
const parseMoney = (v='') => Number(v.replace(/\./g,'').replace(',','.')) || 0;

function autoCategory(descricao, documento){
  const doc = normalizeDoc(documento);
  const name = descricao.trim().toUpperCase();
  const byDoc = regras.find(r => r.matchType === 'cnpj' && normalizeDoc(r.match) === doc && doc);
  if (byDoc) return byDoc.category;
  const byName = regras.find(r => r.matchType === 'name' && name.includes(r.match.toUpperCase()));
  return byName?.category || '';
}

function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(lancamentos)); render(); }
function render(){
  const q = $('busca').value.trim().toLowerCase();
  const rows = lancamentos.filter(x => `${x.descricao} ${x.categoria} ${x.forma}`.toLowerCase().includes(q));
  $('tbody').innerHTML = rows.map(x => `<tr>
    <td>${x.data.split('-').reverse().join('/')}</td><td>${escapeHtml(x.descricao)}</td>
    <td><span class="pill">${escapeHtml(x.categoria || 'Sem categoria')}</span></td>
    <td>${x.tipo === 'entrada' ? 'Entrada' : 'Saída'}</td><td>${escapeHtml(x.forma)}</td>
    <td class="${x.tipo==='entrada'?'money-in':'money-out'}">${x.tipo==='entrada'?'+':'-'} ${brl(x.valor)}</td>
    <td><button class="icon-btn" data-del="${x.id}">Excluir</button></td></tr>`).join('') || '<tr><td colspan="7">Nenhum lançamento.</td></tr>';

  const entradas = lancamentos.filter(x=>x.tipo==='entrada').reduce((s,x)=>s+x.valor,0);
  const saidas = lancamentos.filter(x=>x.tipo==='saida').reduce((s,x)=>s+x.valor,0);
  $('entradas').textContent = brl(entradas); $('saidas').textContent = brl(saidas); $('saldo').textContent = brl(entradas-saidas); $('qtd').textContent = lancamentos.length;

  $('regras').innerHTML = regras.map(r=>`<div class="rule"><div><strong>${escapeHtml(r.label || r.match)}</strong><br><small>${r.matchType.toUpperCase()}: ${escapeHtml(r.match)}</small></div><span class="pill">${escapeHtml(r.category)}</span></div>`).join('');
  document.querySelectorAll('[data-del]').forEach(btn=>btn.onclick=()=>{lancamentos=lancamentos.filter(x=>x.id!==btn.dataset.del);save()});
}

function escapeHtml(s=''){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

$('formLancamento').addEventListener('submit', e=>{
  e.preventDefault();
  const descricao=$('descricao').value.trim(); const documento=$('documento').value.trim();
  let categoria=$('categoria').value.trim() || autoCategory(descricao,documento) || 'A categorizar';
  lancamentos.unshift({id:crypto.randomUUID(),data:$('data').value,descricao,valor:parseMoney($('valor').value),tipo:$('tipo').value,categoria,forma:$('forma').value,documento});
  save(); e.target.reset(); $('data').valueAsDate=new Date();
});

$('demoBtn').onclick=()=>{
  $('data').value='2026-09-09'; $('descricao').value='RJOTA COMERCIO E SERVICOS'; $('valor').value='500,00'; $('tipo').value='saida'; $('forma').value='Pix'; $('documento').value='48.379.018/0001-72'; $('categoria').value=autoCategory($('descricao').value,$('documento').value);
};
$('busca').addEventListener('input',render);
$('themeBtn').onclick=()=>document.body.classList.toggle('dark');
$('data').valueAsDate=new Date(); render();
