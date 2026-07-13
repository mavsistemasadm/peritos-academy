// Busca aulas com video_url do Panda via PostgREST, extrai o video_id da URL
// e salva em migracao/_panda/_aulas_panda.json
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '../../.env.local'), 'utf8');
const supaUrl = env.match(/SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

async function main() {
  const res = await fetch(`${supaUrl}/rest/v1/aulas?select=id,titulo,tipo,video_url,duracao_seg&video_url=like.*pandavideo.com.br*`, {
    headers: { 'Authorization': 'Bearer ' + key, 'apikey': key },
  });
  const aulas = await res.json();
  console.log('aulas com panda video_url:', aulas.length);

  const comId = aulas.map(a => {
    const m = a.video_url.match(/v=([a-f0-9-]+)/);
    return { ...a, video_id: m ? m[1] : null };
  });
  const semId = comId.filter(a => !a.video_id);
  console.log('sem video_id extraido (inesperado):', semId.length);

  fs.writeFileSync(path.join(__dirname, '_aulas_panda.json'), JSON.stringify(comId, null, 2), 'utf8');
  console.log('salvo em migracao/_panda/_aulas_panda.json');
}
main();
