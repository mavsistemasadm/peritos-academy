// Lista todos os vídeos da conta Panda Video (paginado) e salva um mapa
// video_external_id -> length (segundos, float) em migracao/_panda/_videos_panda.json
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '../../.env.local'), 'utf8');
const pandaKey = env.match(/PANDA_API_KEY=(.*)/)[1].trim();

async function main() {
  const todos = [];
  let page = 1;
  const limit = 200;
  while (true) {
    const res = await fetch(`https://api-v2.pandavideo.com.br/videos?page=${page}&limit=${limit}`, {
      headers: { 'Authorization': pandaKey, 'Accept': 'application/json' },
    });
    if (!res.ok) {
      console.error('ERRO pagina', page, res.status, await res.text());
      process.exit(1);
    }
    const body = await res.json();
    todos.push(...body.videos);
    console.log(`pagina ${page}/${body.pages} - ${body.videos.length} videos (acumulado: ${todos.length}/${body.total})`);
    if (page >= body.pages || body.videos.length === 0) break;
    page++;
  }

  const mapa = {};
  for (const v of todos) {
    mapa[v.video_external_id] = { length: v.length, title: v.title, status: v.status };
  }
  fs.writeFileSync(path.join(__dirname, '_videos_panda.json'), JSON.stringify(mapa, null, 2), 'utf8');
  console.log('total de videos salvos no mapa:', Object.keys(mapa).length);
}
main();
