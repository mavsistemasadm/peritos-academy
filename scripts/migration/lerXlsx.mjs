// scripts/migration/lerXlsx.mjs
// Leitor mínimo de XLSX (zero dependência) — o arquivo da Ensinio usa
// inlineStr em todas as células e uma única planilha, então não há
// sharedStrings.xml pra resolver. Descompacta via `unzip` (presente no
// macOS/Linux) num diretório temporário e faz o parse do XML na mão.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function desescapar(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : m
    }
    return ENTIDADES[e] ?? m
  })
}

// "AB12" -> 27 (índice 0-based da coluna)
function indiceColuna(ref) {
  const letras = ref.match(/^[A-Z]+/)[0]
  let n = 0
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

/** Lê a primeira planilha e devolve uma matriz de strings (linha × coluna). */
export function lerXlsx(caminho) {
  const dir = mkdtempSync(join(tmpdir(), 'xlsx-'))
  try {
    execFileSync('unzip', ['-o', '-q', caminho, '-d', dir], { stdio: 'pipe' })
    const xml = readFileSync(join(dir, 'xl/worksheets/sheet1.xml'), 'utf8')
    const linhas = []
    for (const m of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      const idx = Number(m[1]) - 1
      const celulas = []
      for (const c of m[2].matchAll(/<c\s+r="([A-Z]+\d+)"([^>]*)>([\s\S]*?)<\/c>/g)) {
        const col = indiceColuna(c[1])
        const corpo = c[3]
        // inlineStr: <is><t>…</t></is> (pode ter vários <t> em runs de formatação)
        let valor
        if (/t="inlineStr"/.test(c[2])) {
          valor = [...corpo.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')
        } else {
          valor = (corpo.match(/<v>([\s\S]*?)<\/v>/) ?? [, ''])[1]
        }
        celulas[col] = desescapar(valor).trim()
      }
      linhas[idx] = celulas
    }
    // normaliza buracos
    const largura = Math.max(...linhas.filter(Boolean).map((l) => l.length))
    return linhas.map((l) => Array.from({ length: largura }, (_, i) => (l?.[i] ?? '')))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
