// Fase 2 — baixa os arquivos reais do CDN do Ensinio, sobe pro bucket
// 'planilhas' (via service role, mesmo padrão de scripts anteriores desta
// migração) e grava as 110 linhas em `planilhas` (109 modelos distribuídos
// nas 7 áreas + 1 "Termos de Uso" com area_id null, fora da grade).
// Idempotente: upsert por id fixo (derivado do id da aula no Ensinio), e
// upload de storage com upsert:true — pode rodar de novo sem duplicar.
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync(path.join(__dirname, '../../.env.local'), 'utf8');
const supaUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const serviceKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const supabase = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

const bruto = JSON.parse(fs.readFileSync(path.join(__dirname, 'planilhas_bruto.json'), 'utf8'));

// módulo Ensinio -> área do site novo (decisão editorial já aprovada).
// 226 (Instruções Gerais) fica de fora do mapa: vira o link de Termos de
// Uso, sem area_id, fora da grade de áreas.
const AREA_POR_TOPICO = {
  227: { id: 'dada0001-0000-4000-8000-000000000004', slug: 'trabalhista' },
  229: { id: 'dada0001-0000-4000-8000-000000000002', slug: 'previdenciaria' },
  228: { id: 'dada0001-0000-4000-8000-000000000001', slug: 'bancaria' },
  236: { id: 'dada0001-0000-4000-8000-000000000003', slug: 'tributaria' },
  230: { id: 'dada0001-0000-4000-8000-000000000005', slug: 'diversos' },
  235: { id: 'dada0001-0000-4000-8000-000000000006', slug: 'peticoes-e-manifestacoes' },
  237: { id: 'dada0001-0000-4000-8000-000000000007', slug: 'laudos-periciais' },
};
const TIPO_POR_TOPICO = { 235: 'peticao', 237: 'laudo' }; // default: 'planilha'

function slugify(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}
function tamanhoKb(s) {
  if (!s) return null;
  const m = s.match(/([\d.]+)\s*(kB|MB)/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Math.round(m[2].toLowerCase() === 'mb' ? n * 1024 : n);
}
function uuidFixo(ensinioId) {
  return `dbdb0002-0000-4000-8000-${String(ensinioId).padStart(12, '0')}`;
}

async function baixar(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download falhou (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function processarAula(aula, areaInfo, tipo, ordem, pastaTermos) {
  const rowId = uuidFixo(aula.id);
  const material = (aula.materiais || [])[0] || null;

  let arquivoPath = null, formato = 'pdf', tamanho = null;
  if (material) {
    const ext = (material.arquivo.split('.').pop() || 'pdf').toLowerCase();
    formato = ext;
    tamanho = tamanhoKb(material.tamanho);
    const slug = slugify(aula.titulo);
    const pasta = pastaTermos || (areaInfo ? areaInfo.slug : 'geral');
    arquivoPath = `${pasta}/${slug}.${ext}`;

    const bytes = await baixar(bruto.cdn_prefixo + material.arquivo);
    const { error: upErr } = await supabase.storage.from('planilhas').upload(arquivoPath, bytes, {
      contentType: ext === 'pdf' ? 'application/pdf' : 'application/zip',
      upsert: true,
    });
    if (upErr) throw new Error(`upload: ${upErr.message}`);
  }

  const publicado = !!material; // o único sem arquivo (id 830) fica despublicado até alguém anexar algo
  const { error: dbErr } = await supabase.from('planilhas').upsert({
    id: rowId,
    area_id: areaInfo ? areaInfo.id : null,
    nome: aula.titulo,
    descricao: aula.descricao ?? null,
    arquivo_path: arquivoPath,
    formato,
    tamanho_kb: tamanho,
    tipo,
    ordem,
    publicado,
  });
  if (dbErr) throw new Error(`db: ${dbErr.message}`);
  return { rowId, publicado, arquivoPath };
}

async function main() {
  let ok = 0, semArquivo = 0;
  const falhas = [];
  const LIMITE = process.env.LIMITE ? parseInt(process.env.LIMITE, 10) : Infinity;

  for (const topico of bruto.topicos) {
    if (ok >= LIMITE) break;
    const areaInfo = AREA_POR_TOPICO[topico.id] || null;
    const ehTermos = topico.id === 226;
    const tipo = TIPO_POR_TOPICO[topico.id] || 'planilha';
    let ordem = 0;
    for (const aula of topico.aulas) {
      if (ok >= LIMITE) break;
      try {
        const r = await processarAula(aula, areaInfo, tipo, ordem, ehTermos ? 'geral' : null);
        if (!r.publicado) semArquivo++;
        ok++;
        console.log(`  ok (${ok}) ${ehTermos ? '[TERMOS]' : `[${areaInfo.slug}]`} ${aula.titulo}${r.publicado ? '' : ' — SEM ARQUIVO, despublicado'}`);
      } catch (e) {
        falhas.push({ id: aula.id, titulo: aula.titulo, erro: String(e.message || e) });
        console.error(`  FALHA ${aula.id} ${aula.titulo}: ${e.message || e}`);
      }
      ordem++;
    }
  }

  console.log(`\nConcluído: ${ok} linhas gravadas (${semArquivo} despublicada por falta de arquivo), ${falhas.length} falhas.`);
  if (falhas.length) {
    fs.writeFileSync(path.join(__dirname, 'falhas.json'), JSON.stringify(falhas, null, 2), 'utf8');
    console.log('Detalhes em falhas.json');
  }
}

main().catch(e => { console.error('ERRO FATAL:', e); process.exit(1); });
