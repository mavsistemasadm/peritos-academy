// Cruza aulas x mapa de videos do Panda, atualiza aulas.duracao_seg
// (arredondado pro segundo mais proximo) via PostgREST, e gera relatorio.
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '../../.env.local'), 'utf8');
const supaUrl = env.match(/SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const aulas = JSON.parse(fs.readFileSync(path.join(__dirname, '_aulas_panda.json'), 'utf8'));
const videos = JSON.parse(fs.readFileSync(path.join(__dirname, '_videos_panda.json'), 'utf8'));

const encontradas = [];
const naoEncontradas = [];

for (const a of aulas) {
  const v = videos[a.video_id];
  if (v && typeof v.length === 'number') {
    encontradas.push({ ...a, duracao_seg_nova: Math.round(v.length), panda_status: v.status, panda_title: v.title });
  } else {
    naoEncontradas.push(a);
  }
}

console.log('encontradas:', encontradas.length, '| nao encontradas:', naoEncontradas.length);

async function main() {
  let atualizadas = 0;
  for (const a of encontradas) {
    const res = await fetch(`${supaUrl}/rest/v1/aulas?id=eq.${a.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + key,
        'apikey': key,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ duracao_seg: a.duracao_seg_nova }),
    });
    if (!res.ok) {
      console.error('ERRO ao atualizar', a.id, res.status, await res.text());
      process.exit(1);
    }
    atualizadas++;
  }
  console.log('aulas.duracao_seg atualizadas:', atualizadas);

  fs.writeFileSync(path.join(__dirname, '_resultado_duracoes.json'), JSON.stringify({ encontradas, naoEncontradas }, null, 2), 'utf8');
  console.log('salvo em migracao/_panda/_resultado_duracoes.json');
}
main();
