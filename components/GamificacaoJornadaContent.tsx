// components/GamificacaoJornadaContent.tsx
// Página /gamificacao: documentação viva da jornada de XP/níveis/streak —
// todo número vem de dados ao vivo (lib/queries/gamificacao-jornada.ts),
// nunca hardcoded, pra nunca ficar defasada quando o admin recalibrar.
import NavPlataforma from '@/components/NavPlataforma'
import type { DadosNav } from '@/lib/queries/nav'
import type { DadosGamificacaoJornada, NivelJornada, GatilhoJornada } from '@/lib/queries/gamificacao-jornada'
import { IconeCalendar, IconeShield, IconeFileText } from '@/components/Icones'

const NOME_CATEGORIA: Record<string, string> = {
  comum: 'No dia a dia',
  marco: 'Marcos da sua jornada',
  quiz: 'Avaliações',
  especial: 'Momentos especiais',
}

function formatarRequisito(nivel: NivelJornada): string[] {
  const r = nivel.requisito
  const partes: string[] = []
  if (r.aulasConcluidas !== null) partes.push(`${r.aulasConcluidas} aula${r.aulasConcluidas === 1 ? '' : 's'} concluída${r.aulasConcluidas === 1 ? '' : 's'}`)
  if (r.cursosCompletos !== null) partes.push(r.cursosCompletos === -1 ? 'todos os cursos publicados concluídos' : `${r.cursosCompletos} curso${r.cursosCompletos === 1 ? '' : 's'} completo${r.cursosCompletos === 1 ? '' : 's'}`)
  if (r.avaliacoesAprovadas !== null) partes.push(r.avaliacoesAprovadas === -1 ? 'todas as avaliações publicadas aprovadas' : `${r.avaliacoesAprovadas} avaliaç${r.avaliacoesAprovadas === 1 ? 'ão aprovada' : 'ões aprovadas'}`)
  if (r.desafiosCompletos !== null) partes.push(r.desafiosCompletos === -1 ? 'todos os desafios existentes entregues e aprovados' : `${r.desafiosCompletos} desafio${r.desafiosCompletos === 1 ? '' : 's'} completo${r.desafiosCompletos === 1 ? '' : 's'}`)
  if (r.streakMarcoDias !== null) partes.push(`sequência de ${r.streakMarcoDias} dias em algum momento`)
  if (r.participacoesComunidade !== null) partes.push(`${r.participacoesComunidade} participaç${r.participacoesComunidade === 1 ? 'ão' : 'ões'} na comunidade`)
  return partes
}

export default function GamificacaoJornadaContent({ dados, nav }: { dados: DadosGamificacaoJornada; nav: DadosNav }) {
  const gatilhosPorCategoria = ['comum', 'marco', 'quiz', 'especial']
    .map(cat => ({ cat, itens: dados.gatilhos.filter(g => g.categoria === cat) }))
    .filter(g => g.itens.length > 0)

  const streak7 = dados.gatilhos.find(g => g.codigo === 'streak_7')
  const streak30 = dados.gatilhos.find(g => g.codigo === 'streak_30')

  return (
    <div className="pagina-gamificacao">
      <NavPlataforma dados={nav} />

      <header className="gam-hero">
        <div className="wrap">
          <span className="eyebrow">Como funciona sua jornada</span>
          <h1>Cada aula, cada acerto, cada dia de constância conta.</h1>
          <p className="sub">
            Aqui embaixo está o mapa completo: os 10 níveis que você pode alcançar, como cada um deles credita {dados.xpAbreviacao},
            o que precisa ser verdade pra você subir de nível, e como sua sequência de dias funciona. Nada aqui é enfeite — são as
            regras reais que valem na plataforma hoje.
          </p>
        </div>
      </header>

      <section className="gam-secao wrap">
        <h2>Os 10 níveis</h2>
        <p className="gam-secao-intro">
          Subir de nível exige duas coisas ao mesmo tempo: o {dados.xpAbreviacao} mínimo <b>e</b> o requisito daquele nível. Ter XP de
          sobra não substitui um requisito que ainda falta — é assim que garantimos que cada selo realmente representa o que você
          construiu, não só quanto tempo você acumulou pontos.
        </p>
        <div className="gam-niveis-grid">
          {dados.niveis.map(nivel => {
            const requisitos = formatarRequisito(nivel)
            return (
              <article className="gam-nivel-card" key={nivel.ordem}>
                <img src={nivel.imgUrl} alt="" width={56} height={56} />
                <div className="gam-nivel-info">
                  <span className="gam-nivel-num">Nível {nivel.ordem}</span>
                  <h3>{nivel.nome}</h3>
                  <p className="gam-nivel-xp">{nivel.pontosMinimos.toLocaleString('pt-BR')} {dados.xpAbreviacao} mínimo</p>
                  {requisitos.length > 0 ? (
                    <ul className="gam-nivel-requisitos">
                      {requisitos.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  ) : (
                    <p className="gam-nivel-requisitos-vazio">Sem requisito além do XP — é o seu ponto de partida.</p>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="gam-secao wrap">
        <h2>Como você ganha {dados.xpPlural}</h2>
        <p className="gam-secao-intro">
          Toda ação de verdade dentro da plataforma credita {dados.xpAbreviacao} — nunca clique vazio. Ações de estudo (aulas, avaliações,
          cursos, desafios) não têm teto diário. Ações de engajamento (posts, comentários, reações, login) têm um teto combinado de{' '}
          <b>{dados.tetoEngajamentoDiario} {dados.xpAbreviacao} por dia</b> — o resto do dia sua constância continua valendo, só o crédito
          extra que para ali.
        </p>
        {gatilhosPorCategoria.map(({ cat, itens }) => (
          <div className="gam-tabela-bloco" key={cat}>
            <h3>{NOME_CATEGORIA[cat] ?? cat}</h3>
            <div className="gam-tabela-scroll">
              <table className="gam-tabela">
                <thead>
                  <tr><th>Ação</th><th>{dados.xpAbreviacao}</th><th>{dados.moedaPlural}</th><th>Limite</th></tr>
                </thead>
                <tbody>
                  {itens.map(g => <LinhaGatilho key={g.codigo} gatilho={g} xpAbreviacao={dados.xpAbreviacao} />)}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <p className="gam-nota">
          Concluir uma aula credita o XP daquela aula específica (varia por conteúdo). Concluir um curso inteiro soma um bônus de{' '}
          {dados.bonusCursoConcluido} {dados.xpAbreviacao}. Ser aprovado numa avaliação credita {dados.avaliacaoXpBase} {dados.xpAbreviacao} ×
          o peso da avaliação × seu percentual de acerto — só na primeira vez que você é aprovado nela.
        </p>
      </section>

      <section className="gam-secao wrap">
        <h2><IconeFileText size={18} strokeWidth={1.8} /> Quando uma aula conta como concluída</h2>
        <p className="gam-secao-intro">
          Marcar uma aula como concluída não é um clique livre — a plataforma checa de verdade:
        </p>
        <ul className="gam-lista-regras">
          <li>Se a aula tem vídeo, você precisa ter assistido pelo menos <b>70% da duração</b>.</li>
          <li>Se a aula tem materiais complementares, você precisa ter baixado <b>todos eles</b>.</li>
          <li>Aula sem vídeo e sem material libera direto — só a ordem das aulas do módulo continua valendo.</li>
        </ul>
        <p className="gam-secao-intro">
          E a ordem importa: a aula seguinte só libera depois que você conclui a atual, e passar pra um módulo novo exige que qualquer
          avaliação publicada do módulo anterior já esteja aprovada.
        </p>
      </section>

      <section className="gam-secao wrap">
        <h2><IconeCalendar size={18} strokeWidth={1.8} /> Sua sequência (streak)</h2>
        <p className="gam-secao-intro">
          Cada dia que você acessa a plataforma pela primeira vez conta um dia de sequência. Ela não reseta no primeiro deslize:
          você tem <b>2 proteções por mês</b> — se passar um dia inteiro sem acessar, mas voltar no dia seguinte, uma proteção cobre
          a falha automaticamente e sua sequência continua contando como se não tivesse parado. Depois de usar as 2 proteções do mês,
          um dia sem acesso reinicia a contagem.
        </p>
        <div className="gam-streak-marcos">
          {streak7 && (
            <div className="gam-streak-marco">
              <IconeShield size={16} strokeWidth={1.8} />
              <span><b>7 dias seguidos</b> credita {streak7.pontos} {dados.xpAbreviacao} de bônus.</span>
            </div>
          )}
          {streak30 && (
            <div className="gam-streak-marco">
              <IconeShield size={16} strokeWidth={1.8} />
              <span><b>30 dias seguidos</b> credita {streak30.pontos} {dados.xpAbreviacao} de bônus.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function LinhaGatilho({ gatilho, xpAbreviacao }: { gatilho: GatilhoJornada; xpAbreviacao: string }) {
  return (
    <tr>
      <td>
        <b>{gatilho.nome}</b>
        {gatilho.descricao && <><br /><span className="gam-tabela-desc">{gatilho.descricao}</span></>}
      </td>
      <td>{gatilho.pontos > 0 ? `${gatilho.pontos} ${xpAbreviacao}` : '—'}</td>
      <td>{gatilho.moedas > 0 ? gatilho.moedas : '—'}</td>
      <td>{gatilho.limiteDiario ? `${gatilho.limiteDiario}/dia` : 'sem limite'}</td>
    </tr>
  )
}
