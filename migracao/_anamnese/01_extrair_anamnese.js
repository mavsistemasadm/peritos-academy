// Fase A — extracao read-only da API do console Ensinio (mesmo padrao de
// migracao/_avaliacoes/02_extrair_quizzes.js). Busca a anamnese ativa
// (GET /console/anamnese/1, que ja retorna questoes+opcoes+trilhas num so
// payload) e a lista de trilhas do Ensinio (GET /console/trail, para
// resolver os ids de trilha em nome). Nenhuma escrita no nosso banco.
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

async function buscar(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (res.status === 401 || res.status === 403) {
    return { auth_falhou: true, status: res.status };
  }
  const body = await res.json();
  return { ok: true, status: res.status, body };
}

async function main() {
  const outDir = __dirname;

  console.log('Buscando anamnese ativa (GET /anamnese)...');
  const lista = await buscar(`${BASE}/anamnese`);
  if (lista.auth_falhou) {
    console.error(`Token invalido/expirado (status ${lista.status}). Peça um novo token do console.`);
    process.exit(2);
  }
  const anamneseId = lista.body?.data?.[0]?.id;
  if (!anamneseId) {
    console.error('Nenhuma anamnese encontrada em /anamnese.');
    process.exit(1);
  }
  console.log(`Anamnese ativa: id ${anamneseId} — "${lista.body.data[0].title}" (${lista.body.data[0].questions_count} questões)`);

  console.log(`Buscando detalhe completo (GET /anamnese/${anamneseId})...`);
  const detalhe = await buscar(`${BASE}/anamnese/${anamneseId}`);
  if (detalhe.auth_falhou) {
    console.error(`Token invalido/expirado (status ${detalhe.status}).`);
    process.exit(2);
  }
  fs.writeFileSync(path.join(outDir, 'anamnese_bruto.json'), JSON.stringify(detalhe.body, null, 2), 'utf8');
  console.log(`Salvo anamnese_bruto.json (${detalhe.body.data.questions.length} questões).`);

  console.log('Buscando lista de trilhas do Ensinio (GET /trail)...');
  const trilhas = await buscar(`${BASE}/trail?per_page=100`);
  if (trilhas.auth_falhou) {
    console.error(`Token invalido/expirado (status ${trilhas.status}).`);
    process.exit(2);
  }
  fs.writeFileSync(path.join(outDir, 'trilhas_ensinio_bruto.json'), JSON.stringify(trilhas.body, null, 2), 'utf8');
  console.log(`Salvo trilhas_ensinio_bruto.json (${trilhas.body.data.length} trilhas).`);

  console.log('\nExtração concluída. Rode 02_gerar_mapeamento.js em seguida.');
}
main();
