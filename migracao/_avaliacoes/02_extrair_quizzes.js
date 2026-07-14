// Fase A — extracao read-only da API da Ensinio.
// Le migracao/_avaliacoes/01_mapa_avaliacoes.json (37 quiz_ids), busca cada
// quiz em GET /console/quiz/{id}/questions, salva o JSON cru em
// migracao/quizzes_brutos/quiz_{id}.json. Nenhuma escrita no nosso banco.
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.ENSINIO_TOKEN;
if (!TOKEN) {
  console.error('Defina ENSINIO_TOKEN no ambiente antes de rodar.');
  process.exit(1);
}

const BASE = 'https://peritosacademy.ensinio.cloud/api/v1/console/quiz';
const HEADERS = {
  'Authorization': `Bearer ${TOKEN}`,
  'App-Name': 'web-client-desktop',
  'Client-Type': 'web',
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/json, text/plain, */*',
  'Origin': 'https://peritosacademy.ensinio.com',
  'Referer': 'https://peritosacademy.ensinio.com/',
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function buscarQuiz(quizId) {
  const res = await fetch(`${BASE}/${quizId}/questions`, { headers: HEADERS });
  const ct = res.headers.get('content-type') || '';
  if (res.status === 401 || res.status === 403) {
    return { auth_falhou: true, status: res.status };
  }
  if (!ct.includes('application/json')) {
    const text = await res.text();
    return { formato_inesperado: true, status: res.status, amostra: text.slice(0, 300) };
  }
  const body = await res.json();
  return { ok: true, status: res.status, body };
}

async function main() {
  const mapa = JSON.parse(fs.readFileSync(path.join(__dirname, '01_mapa_avaliacoes.json'), 'utf8'));
  const outDir = path.join(__dirname, '../quizzes_brutos');
  fs.mkdirSync(outDir, { recursive: true });

  const relatorio = [];
  for (const item of mapa) {
    const quizId = item.quiz_id;
    process.stdout.write(`quiz ${quizId} (${item.titulo} — ${item.curso})... `);

    let resultado = await buscarQuiz(quizId);
    if (!resultado.ok && !resultado.auth_falhou) {
      console.log('falhou, retry em 500ms...');
      await sleep(500);
      resultado = await buscarQuiz(quizId);
    }

    if (resultado.auth_falhou) {
      console.log(`AUTENTICACAO FALHOU (status ${resultado.status}) — parando extracao.`);
      relatorio.push({ quiz_id: quizId, ...item, status: 'auth_falhou' });
      fs.writeFileSync(path.join(__dirname, '_relatorio_extracao.json'), JSON.stringify(relatorio, null, 2), 'utf8');
      console.error('\nToken invalido/expirado. Progresso salvo. Interrompendo Fase A.');
      process.exit(2);
    }

    if (!resultado.ok) {
      console.log(`FALHA (formato inesperado, status ${resultado.status})`);
      relatorio.push({ quiz_id: quizId, ...item, status: 'falha', detalhe: resultado.amostra });
      await sleep(400);
      continue;
    }

    const questoes = resultado.body?.data ?? [];
    fs.writeFileSync(path.join(outDir, `quiz_${quizId}.json`), JSON.stringify(resultado.body, null, 2), 'utf8');

    const tipos = [...new Set(questoes.map(q => q.type))];
    const comExplanation = questoes.filter(q => q.explanation && String(q.explanation).trim() !== '').length;
    console.log(`ok (${questoes.length} questoes, tipos: ${tipos.join(',')}, com explanation: ${comExplanation})`);

    relatorio.push({
      quiz_id: quizId, ...item, status: 'ok',
      total_questoes: questoes.length, tipos, com_explanation: comExplanation,
    });

    await sleep(400);
  }

  fs.writeFileSync(path.join(__dirname, '_relatorio_extracao.json'), JSON.stringify(relatorio, null, 2), 'utf8');
  console.log('\nExtracao concluida. Relatorio em migracao/_avaliacoes/_relatorio_extracao.json');
}
main();
