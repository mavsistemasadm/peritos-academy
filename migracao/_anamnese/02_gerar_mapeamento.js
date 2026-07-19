// Gera migracao/_anamnese/MAPEAMENTO.md a partir de anamnese_bruto.json +
// trilhas_ensinio_bruto.json. So leitura/documentacao, nao escreve no banco.
const fs = require('fs');
const path = require('path');

const anamnese = JSON.parse(fs.readFileSync(path.join(__dirname, 'anamnese_bruto.json'), 'utf8')).data;

// De-para trilha Ensinio -> trilha Peritos Academy (nomes reais da tabela
// `trilhas`, conferidos em 2026-07-19). Confianca alta em todas as 8:
// 1,2,3,5,7 tem descricao IDENTICA (herdada literalmente na migracao);
// 4,6,8 sao match de nome/tema sem concorrente plausivel entre as 13.
const DE_PARA = {
  1: { pa: 'Trilha de Formação Pericial de Alta Performance', confianca: 'alta — descrição idêntica à do Ensinio (trilha obrigatória / selo de Excelência)' },
  2: { pa: 'Especialista em Cálculos Prevideniciários', confianca: 'alta — descrição idêntica à do Ensinio (INSS / Fazenda Pública)' },
  3: { pa: 'Perito Bancário Profissional', confianca: 'alta — mesmo nome e descrição idêntica à do Ensinio' },
  4: { pa: 'Expert em Cálculos Trabalhistas', confianca: 'alta — único tema trabalhista entre as 13, nome equivalente ("Perito Trabalhista Expert")' },
  5: { pa: 'Plano de Automação Pericial', confianca: 'alta — descrição idêntica à do Ensinio ("Plano de Aceleração Pericial"), só o nome mudou na reconstrução' },
  6: { pa: 'Como se Tornar um Perito com Nomeações Judiciais', confianca: 'alta — tema idêntico (nomeações/perito judicial), sem concorrente' },
  7: { pa: 'Negócios e Empreendedorismo Pericial', confianca: 'alta — descrição idêntica à do Ensinio (construir escritório lucrativo)' },
  8: { pa: 'Teses lucrativas e de alto volume', confianca: 'alta — tema idêntico (ganhos rápidos, teses recorrentes, cálculos de massa); não confundir com "Planilhas de Cálculos Inteligentes e Automatizadas" (essa é sobre ferramenta, não sobre rota de carreira)' },
};

function nomesTrilhasPA(trailIds) {
  return trailIds.map((id) => DE_PARA[id]?.pa ?? `⚠ id ${id} sem de-para`).join(' + ');
}

function nomesTrilhasEnsinio(trailIds, trilhasEnsinio) {
  return trailIds.map((id) => `${id} (${trilhasEnsinio.find((t) => t.id === id)?.title ?? '?'})`).join(', ');
}

const trilhasEnsinio = JSON.parse(fs.readFileSync(path.join(__dirname, 'trilhas_ensinio_bruto.json'), 'utf8')).data;

let md = `# Anamnese "Rota Personalizada para Viver de Perícia" — mapeamento

Extraído do console Ensinio (\`GET /api/v1/console/anamnese/1\`) em 2026-07-19. Fonte crua em \`anamnese_bruto.json\` / \`trilhas_ensinio_bruto.json\`. Documento só de leitura — nenhuma escrita foi feita no banco da Peritos Academy a partir daqui. A decisão final do de-para é do Marlos.

## Anamnese

- **Título**: ${anamnese.title}
- **Tipo**: \`${anamnese.type}\` (associação questão→opção→trilhas; sem lógica condicional, pesos ou tela de resultado separada — o Ensinio resolve a "rota" contando quantos votos cada trilha recebe pelas opções escolhidas)
- **Botão de ação**: "${anamnese.action_button}"
- **Botão de recusa**: "${anamnese.decline_button}"
- **Descrição do modal**: ${anamnese.description.replace(/<[^>]+>/g, '')}
- **Total de questões**: ${anamnese.questions.length}

## De-para das trilhas (Ensinio → Peritos Academy)

Todas as 8 trilhas do Ensinio referenciadas na anamnese têm correspondência de **alta confiança** com uma das 13 trilhas atuais da Peritos Academy — nenhuma ⚠ nesta tabela-base (a ambiguidade, se houver, aparece nas questões abaixo quando uma opção referencia uma combinação pouco óbvia).

| ID Ensinio | Nome no Ensinio | Trilha equivalente na Peritos Academy | Confiança |
|---|---|---|---|
`;

for (const t of trilhasEnsinio) {
  const dp = DE_PARA[t.id];
  md += `| ${t.id} | ${t.title} | ${dp?.pa ?? '⚠ sem correspondência'} | ${dp?.confianca ?? '—'} |\n`;
}

md += `
As 5 trilhas da Peritos Academy sem trilha correspondente no Ensinio (criadas depois da migração, não existiam na anamnese original): **Cálculos Essenciais do Perito**, **Teses de Cálculos Tributários**, **Teses de Cálculos Atuariais**, **Planilhas de Cálculos Inteligentes e Automatizadas**, **MasterClass Exclusivas da Peritos Academy**.

## Questões

`;

for (const q of anamnese.questions) {
  md += `### Q${q.position + 1} — ${q.description}\n\n`;
  md += `_id Ensinio: ${q.id} · posição: ${q.position}_\n\n`;
  md += `| # | Opção | Trilhas Ensinio | Trilha equivalente na Peritos Academy |\n`;
  md += `|---|---|---|---|\n`;
  for (const o of q.options) {
    const trilhasPA = nomesTrilhasPA(o.trails);
    const ambiguo = o.trails.length > 2 ? ' ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual)' : '';
    md += `| ${o.position + 1} | ${o.title} | ${nomesTrilhasEnsinio(o.trails, trilhasEnsinio)} | ${trilhasPA}${ambiguo} |\n`;
  }
  md += `\n`;
}

fs.writeFileSync(path.join(__dirname, 'MAPEAMENTO.md'), md, 'utf8');
console.log('MAPEAMENTO.md gerado,', md.length, 'caracteres.');
