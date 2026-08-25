// Teste de mesa das janelas de lembrete de evento.
//
// Roda sem banco e sem rede: as funções de janela são puras, e o que se testa
// aqui é só a conta de tempo. Ela merece teste porque erra por uma hora sem
// dar erro nenhum: o cron roda em UTC, o evento é marcado em Brasília, e o
// sintoma de um engano seria a live acontecer sem ninguém aparecer.
//
//   node --experimental-strip-types scripts/testarJanelasEvento.mts
//
// ⚠️ `scripts/**` está fora do `tsconfig.json` de propósito, e os dois lados
// exigem o oposto um do outro: o Node com strip-types SÓ resolve import com a
// extensão `.ts` escrita, e o `moduleResolution: bundler` do app recusa
// exatamente essa forma. Não dá para os dois obedecerem à mesma regra, então
// o script fica fora da checagem do build em vez de o build ser afrouxado.
import { JANELAS } from '../lib/evento/janelas.ts'

const HORA = 3_600_000
const MIN = 60_000
let falhas = 0

function checar(descricao: string, condicao: boolean) {
  console.log(`${condicao ? '  ok  ' : ' FALHA'} · ${descricao}`)
  if (!condicao) falhas++
}

/** Um instante dado no relógio de Brasília, convertido para tempo real. */
function brasilia(ano: number, mes: number, dia: number, hora: number, min = 0) {
  return Date.UTC(ano, mes - 1, dia, hora, min) + 3 * HORA
}

const janela = (momento: string) => JANELAS.find(j => j.momento === momento)!

/** O evento cai na janela quando sua distância até agora está dentro da faixa. */
function pega(momento: string, agora: number, evento: number) {
  const f = janela(momento).faixa(agora)
  if (!f) return false
  const d = evento - agora
  return d >= f.de && d <= f.ate
}

console.log('\n── "é hoje": só de manhã, e só com folga ──')
{
  const manha8 = brasilia(2026, 9, 5, 8)
  checar('live das 20h entra na janela das 8h', pega('hoje', manha8, brasilia(2026, 9, 5, 20)))
  checar('live das 12h entra na janela das 8h', pega('hoje', manha8, brasilia(2026, 9, 5, 12)))
  checar('live das 9h30 NÃO entra (menos de 3h de folga)', !pega('hoje', manha8, brasilia(2026, 9, 5, 9, 30)))
  checar('live de amanhã NÃO entra hoje', !pega('hoje', manha8, brasilia(2026, 9, 6, 20)))
  checar('live de ontem NÃO entra', !pega('hoje', manha8, brasilia(2026, 9, 4, 20)))

  checar('às 7h a janela está aberta', janela('hoje').faixa(brasilia(2026, 9, 5, 7)) !== null)
  checar('às 9h a janela está aberta', janela('hoje').faixa(brasilia(2026, 9, 5, 9)) !== null)
  checar('às 6h a janela está fechada', janela('hoje').faixa(brasilia(2026, 9, 5, 6)) === null)
  checar('às 10h a janela está fechada', janela('hoje').faixa(brasilia(2026, 9, 5, 10)) === null)
  checar('às 20h a janela está fechada', janela('hoje').faixa(brasilia(2026, 9, 5, 20)) === null)

  // A vira-noite é o caso que o fuso quebra: 8h de Brasília é 11h UTC, então
  // um cálculo feito em UTC acharia que ainda é "ontem" ou já é "amanhã".
  const manha8UltimoDia = brasilia(2026, 12, 31, 8)
  checar('vira do ano: live das 23h de 31/12 entra',
    pega('hoje', manha8UltimoDia, brasilia(2026, 12, 31, 23)))
  checar('vira do ano: live das 00h30 de 01/01 NÃO entra',
    !pega('hoje', manha8UltimoDia, brasilia(2027, 1, 1, 0, 30)))
}

console.log('\n── "daqui a uma hora" ──')
{
  const agora = brasilia(2026, 9, 5, 19)
  checar('live daqui a 1h entra', pega('comecando', agora, agora + HORA))
  checar('live daqui a 40min entra', pega('comecando', agora, agora + 40 * MIN))
  checar('live daqui a 15min NÃO entra (o de ao vivo cobre)', !pega('comecando', agora, agora + 15 * MIN))
  checar('live daqui a 3h NÃO entra', !pega('comecando', agora, agora + 3 * HORA))
}

console.log('\n── "estamos no ar" ──')
{
  const agora = brasilia(2026, 9, 5, 20, 10)
  checar('live que começou há 10min entra', pega('ao_vivo', agora, agora - 10 * MIN))
  checar('live que começa em 5min NÃO entra (ainda não começou)', !pega('ao_vivo', agora, agora + 5 * MIN))
  checar('live que começou há 40min NÃO entra', !pega('ao_vivo', agora, agora - 40 * MIN))
}

console.log('\n── nenhum evento pega duas janelas ao mesmo tempo ──')
{
  const agora = brasilia(2026, 9, 5, 8)
  for (const h of [8.5, 9, 11, 14, 20, 23]) {
    const evento = brasilia(2026, 9, 5, Math.floor(h), (h % 1) * 60)
    const pegou = JANELAS.filter(j => pega(j.momento, agora, evento)).map(j => j.momento)
    checar(`live das ${h}h pega no máximo uma janela às 8h (pegou: ${pegou.join(', ') || 'nenhuma'})`,
      pegou.length <= 1)
  }
}

console.log(falhas === 0 ? '\nTODAS AS ASSERÇÕES PASSARAM\n' : `\n${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
