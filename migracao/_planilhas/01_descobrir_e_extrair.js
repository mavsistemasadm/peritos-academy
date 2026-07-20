// Fase 1 — descoberta do endpoint + extração read-only da biblioteca de
// modelos de planilhas do console Ensinio (mesmo padrão de auth de
// migracao/_anamnese/01_extrair_anamnese.js e migracao/_avaliacoes/02_extrair_quizzes.js).
// NADA é escrito no banco novo aqui — só grava migracao/_planilhas/planilhas_bruto.json.
//
// Uso: ENSINIO_TOKEN=xxxx node migracao/_planilhas/01_descobrir_e_extrair.js
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.ENSINIO_TOKEN;
if (!TOKEN) {
  console.error('Defina ENSINIO_TOKEN no ambiente antes de rodar.');
  process.exit(1);
}

const BASE = 'https://peritosacademy.ensinio.cloud/api/v1/console';
const HEADERS = {
  'Authorization': `Bearer ${TOKEN}`,
  'App-Name': 'web-client-desktop',
  'Client-Type': 'web',
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/json, text/plain, */*',
  'Origin': 'https://peritosacademy.ensinio.com',
  'Referer': 'https://peritosacademy.ensinio.com/',
};

// Candidatos a endpoint da biblioteca de modelos de planilhas. Baseado nos
// nomes já vistos no console (anamnese, trail, quiz) + variações comuns de
// vocabulário do Ensinio pra "biblioteca de arquivos baixáveis".
const CANDIDATOS = [
  'spreadsheet', 'spreadsheets',
  'library', 'library-item', 'library-items',
  'file', 'files',
  'material', 'materials',
  'model', 'models',
  'template', 'templates',
  'download', 'downloads',
  'resource', 'resources',
  'document', 'documents',
];

async function buscar(url) {
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (res.status === 401 || res.status === 403) return { status: res.status, auth_falhou: true };
    if (res.status === 404) return { status: 404 };
    let body = null;
    try { body = await res.json(); } catch { /* corpo não é JSON */ }
    return { status: res.status, ok: res.ok, body };
  } catch (e) {
    return { erro: String(e) };
  }
}

async function main() {
  const outDir = __dirname;

  console.log(`Testando ${CANDIDATOS.length} candidatos de endpoint em ${BASE}/...\n`);
  const achados = [];

  for (const cand of CANDIDATOS) {
    const url = `${BASE}/${cand}?per_page=2`;
    const r = await buscar(url);
    if (r.auth_falhou) {
      console.error(`\nToken inválido/expirado (status ${r.status}) ao testar /${cand}. Peça um novo token do console e rode de novo.`);
      process.exit(2);
    }
    if (r.erro) {
      console.log(`  /${cand} -> erro de rede: ${r.erro}`);
      continue;
    }
    if (r.status === 404) {
      console.log(`  /${cand} -> 404`);
      continue;
    }
    const temLista = Array.isArray(r.body?.data) || Array.isArray(r.body);
    const qtd = Array.isArray(r.body?.data) ? r.body.data.length : Array.isArray(r.body) ? r.body.length : null;
    console.log(`  /${cand} -> status ${r.status}${temLista ? `, lista com ${qtd} item(ns) nesta página` : ', resposta sem lista reconhecível'}`);
    if (r.ok && temLista) achados.push({ cand, body: r.body });
  }

  if (achados.length === 0) {
    console.log('\nNenhum candidato retornou uma lista reconhecível. Rode com mais variações ou confirme o endpoint manualmente (inspecionar Network no console do navegador na tela de modelos de planilhas).');
    return;
  }

  console.log(`\n${achados.length} candidato(s) com resposta de lista:`);
  for (const a of achados) {
    console.log(`\n=== /${a.cand} — amostra da primeira página ===`);
    console.log(JSON.stringify(a.body, null, 2).slice(0, 2000));
  }

  console.log('\nSe algum desses é claramente a biblioteca de modelos de planilhas, edite ENDPOINT_CONFIRMADO abaixo neste arquivo e rode de novo para extrair tudo paginado.');
}

// Depois de confirmar visualmente qual candidato acima é o certo, preencha
// aqui (ex.: 'spreadsheet') e rode o script de novo — ele pula a descoberta
// e faz a extração completa paginada.
const ENDPOINT_CONFIRMADO = process.env.ENSINIO_ENDPOINT_PLANILHAS || null;

async function extrairTudo(endpoint) {
  console.log(`Extraindo tudo de /${endpoint} (paginado)...`);
  let pagina = 1;
  let todos = [];
  let meta = null;
  while (true) {
    const url = `${BASE}/${endpoint}?per_page=100&page=${pagina}`;
    const r = await buscar(url);
    if (r.auth_falhou) {
      console.error(`Token inválido/expirado (status ${r.status}) na página ${pagina}.`);
      process.exit(2);
    }
    const lista = Array.isArray(r.body?.data) ? r.body.data : Array.isArray(r.body) ? r.body : [];
    if (pagina === 1) meta = r.body?.meta ?? null;
    if (lista.length === 0) break;
    todos = todos.concat(lista);
    console.log(`  página ${pagina}: +${lista.length} (total ${todos.length})`);
    if (lista.length < 100) break; // última página
    pagina++;
    if (pagina > 50) { console.warn('Limite de 50 páginas atingido — parando por segurança.'); break; }
  }

  const bruto = { endpoint, extraido_em: new Date().toISOString(), total: todos.length, meta, itens: todos };
  fs.writeFileSync(path.join(__dirname, 'planilhas_bruto.json'), JSON.stringify(bruto, null, 2), 'utf8');
  console.log(`\nSalvo planilhas_bruto.json com ${todos.length} itens.`);
}

(async () => {
  if (ENDPOINT_CONFIRMADO) {
    await extrairTudo(ENDPOINT_CONFIRMADO);
  } else {
    await main();
  }
})();
