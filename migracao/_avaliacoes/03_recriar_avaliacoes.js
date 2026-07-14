// Fase B — recriacao das avaliacoes no nosso banco a partir dos JSONs
// crus da Ensinio (migracao/quizzes_brutos/quiz_{id}.json) + mapa de
// curso/modulo (migracao/_avaliacoes/01_mapa_avaliacoes.json).
// So roda apos a Fase A ter extraido com sucesso.
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '../../.env.local'), 'utf8');
const supaUrl = env.match(/SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const HEADERS = {
  'Authorization': 'Bearer ' + key,
  'apikey': key,
  'Content-Type': 'application/json',
};

// ---------- HTML -> texto limpo, preservando paragrafos ----------
function htmlParaTexto(html) {
  if (!html) return '';
  let s = String(html);
  s = s.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/?p[^>]*>/gi, '');
  s = s.replace(/<[^>]+>/g, '');
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&atilde;/g, 'ã')
    .replace(/&otilde;/g, 'õ').replace(/&ccedil;/g, 'ç').replace(/&ecirc;/g, 'ê')
    .replace(/&acirc;/g, 'â').replace(/&Aacute;/g, 'Á').replace(/&Eacute;/g, 'É');
  s = s.split('\n').map(l => l.trim()).join('\n');
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

async function main() {
  const mapa = JSON.parse(fs.readFileSync(path.join(__dirname, '01_mapa_avaliacoes.json'), 'utf8'));

  // avaliacoes ja existentes (idempotencia por curso_id+titulo)
  const resExist = await fetch(`${supaUrl}/rest/v1/avaliacoes?select=id,curso_id,titulo`, { headers: HEADERS });
  const existentes = await resExist.json();
  const existeChave = new Set(existentes.map(a => `${a.curso_id}::${a.titulo}`));

  const relatorio = {
    criadas: [], puladas_ja_existentes: [], puladas_sem_json: [], puladas_vazias: [],
    questoes_puladas: [], explanations: [], desafios_como_avaliacao: [],
    multiple_importadas_como_single: [],
    total_questoes: 0, total_alternativas: 0,
  };

  for (const item of mapa) {
    const chave = `${item.curso_id}::${item.titulo}`;
    if (existeChave.has(chave)) {
      relatorio.puladas_ja_existentes.push({ quiz_id: item.quiz_id, curso: item.curso, titulo: item.titulo });
      console.log(`PULADA (ja existe): ${item.curso} — ${item.titulo}`);
      continue;
    }

    const jsonPath = path.join(__dirname, '../quizzes_brutos', `quiz_${item.quiz_id}.json`);
    if (!fs.existsSync(jsonPath)) {
      relatorio.puladas_sem_json.push({ quiz_id: item.quiz_id, curso: item.curso, titulo: item.titulo });
      console.log(`PULADA (sem JSON extraido): quiz ${item.quiz_id}`);
      continue;
    }
    const bruto = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const questoesRaw = bruto?.data ?? [];
    if (questoesRaw.length === 0) {
      relatorio.puladas_vazias.push({ quiz_id: item.quiz_id, curso: item.curso, titulo: item.titulo });
      console.log(`PULADA (quiz vazio): quiz ${item.quiz_id}`);
      continue;
    }

    if (item.titulo.toLowerCase().includes('desafio')) {
      relatorio.desafios_como_avaliacao.push({ quiz_id: item.quiz_id, curso: item.curso, titulo: item.titulo });
    }

    // 1) cria a avaliacao (tipo sempre 'avaliacao' — schema nao distingue desafio;
    //    'prova' exigiria modulo_id NULL, o que perderia o posicionamento por modulo)
    const resAv = await fetch(`${supaUrl}/rest/v1/avaliacoes`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'return=representation' },
      body: JSON.stringify({
        curso_id: item.curso_id,
        modulo_id: item.modulo_id,
        titulo: item.titulo,
        tipo: 'avaliacao',
        peso: 1,
        publicado: false, // mesmo default de criarAvaliacao() no admin
      }),
    });
    if (!resAv.ok) {
      console.error('ERRO ao criar avaliacao', item.titulo, await resAv.text());
      process.exit(1);
    }
    const [avaliacao] = await resAv.json();

    // 2) questoes + opcoes
    // (a Ensinio nao manda "position" no nivel da questao — so nas opcoes;
    // a ordem de insercao vira a ordem final, na sequencia em que a API devolveu)
    let questoesInseridas = 0;
    let alternativasInseridas = 0;

    for (let i = 0; i < questoesRaw.length; i++) {
      const q = questoesRaw[i];

      if (q.type !== 'single' && q.type !== 'multiple') {
        relatorio.questoes_puladas.push({
          quiz_id: item.quiz_id, curso: item.curso, titulo: item.titulo,
          questao_id_ensinio: q.id, tipo_ensinio: q.type,
          motivo: `tipo '${q.type}' nao reconhecido`,
        });
        continue;
      }

      const opcoesOrdenadas = [...(q.options ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      const corretas = opcoesOrdenadas.filter(o => !!o.isCorrect);
      if (opcoesOrdenadas.length === 0 || corretas.length !== 1) {
        // tipo 'multiple' de verdade (>1 correta) nao tem equivalente no nosso
        // schema (multipla_escolha e sempre resposta unica) — pula e registra,
        // nunca inventa qual seria "a" correta.
        relatorio.questoes_puladas.push({
          quiz_id: item.quiz_id, curso: item.curso, titulo: item.titulo,
          questao_id_ensinio: q.id, tipo_ensinio: q.type,
          motivo: `numero de alternativas corretas = ${corretas.length} (esperado exatamente 1), opcoes = ${opcoesOrdenadas.length}`,
        });
        continue;
      }
      if (q.type === 'multiple') {
        // tipo 'multiple' na Ensinio mas com exatamente 1 correta = equivalente
        // fiel a multipla_escolha (resposta unica). Importa normalmente, so registra.
        relatorio.multiple_importadas_como_single.push({ quiz_id: item.quiz_id, curso: item.curso, titulo: item.titulo, questao_id_ensinio: q.id });
      }

      const enunciado = htmlParaTexto(q.description);
      const parecer = q.explanation ? (htmlParaTexto(q.explanation) || null) : null;
      if (parecer) {
        relatorio.explanations.push({ quiz_id: item.quiz_id, curso: item.curso, titulo: item.titulo, questao_id_ensinio: q.id, parecer });
      }

      const resQ = await fetch(`${supaUrl}/rest/v1/avaliacao_questoes`, {
        method: 'POST',
        headers: { ...HEADERS, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          avaliacao_id: avaliacao.id,
          ordem: i + 1,
          tipo: 'multipla_escolha',
          enunciado,
          parecer,
        }),
      });
      if (!resQ.ok) {
        console.error('ERRO ao criar questao', item.titulo, q.id, await resQ.text());
        process.exit(1);
      }
      const [questao] = await resQ.json();
      questoesInseridas++;
      relatorio.total_questoes++;

      const opcoesPayload = opcoesOrdenadas.map((o, idx) => ({
        questao_id: questao.id,
        ordem: idx + 1,
        texto: String(o.content ?? '').trim(),
        correta: !!o.isCorrect,
      }));
      const resO = await fetch(`${supaUrl}/rest/v1/avaliacao_opcoes`, {
        method: 'POST',
        headers: { ...HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify(opcoesPayload),
      });
      if (!resO.ok) {
        console.error('ERRO ao criar opcoes', item.titulo, q.id, await resO.text());
        process.exit(1);
      }
      alternativasInseridas += opcoesPayload.length;
      relatorio.total_alternativas += opcoesPayload.length;
    }

    relatorio.criadas.push({
      quiz_id: item.quiz_id, curso: item.curso, titulo: item.titulo,
      avaliacao_id: avaliacao.id, modulo_id: item.modulo_id, modulo_titulo: item.modulo_titulo,
      posicao_ensinio: item.posicao,
      questoes_ensinio: questoesRaw.length, questoes_inseridas: questoesInseridas,
      alternativas_inseridas: alternativasInseridas,
    });
    console.log(`CRIADA: ${item.curso} — ${item.titulo} (${questoesInseridas}/${questoesRaw.length} questoes)`);
  }

  fs.writeFileSync(path.join(__dirname, '_relatorio_recriacao.json'), JSON.stringify(relatorio, null, 2), 'utf8');
  console.log('\nResumo:');
  console.log('  criadas:', relatorio.criadas.length);
  console.log('  puladas (ja existentes):', relatorio.puladas_ja_existentes.length);
  console.log('  puladas (sem json):', relatorio.puladas_sem_json.length);
  console.log('  puladas (vazias):', relatorio.puladas_vazias.length);
  console.log('  questoes puladas:', relatorio.questoes_puladas.length);
  console.log('  total questoes inseridas:', relatorio.total_questoes);
  console.log('  total alternativas inseridas:', relatorio.total_alternativas);
  console.log('  explanations preservadas (viraram parecer):', relatorio.explanations.length);
  console.log('  titulos com "desafio" (importados como avaliacao):', relatorio.desafios_como_avaliacao.length);
}
main();
