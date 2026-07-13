// components/DevIconesContent.tsx
// Conteúdo de /dev/icones — só leitura, sem server actions/queries. Lista os
// exports de Icones.tsx e Emblemas.tsx dinamicamente (Object.entries) pra
// nunca ficar desatualizado quando um ícone novo for adicionado.
import * as IconesNS from '@/components/Icones'
import * as EmblemasNS from '@/components/Emblemas'
import { Fragment, type ComponentType } from 'react'

type IconeComponente = ComponentType<{ size?: number; strokeWidth?: number }>
type EmblemaComponente = ComponentType<{ size?: number; variante?: 'cor' | 'mono' }>

const TAMANHOS = [16, 20, 24] as const

const CATEGORIAS_ICONES: { titulo: string; nomes: string[] }[] = [
  { titulo: 'Navegação', nomes: ['IconeChevronDown', 'IconeChevronLeft', 'IconeChevronRight', 'IconeClose', 'IconePlus', 'IconeArrowUp', 'IconeArrowDown'] },
  { titulo: 'Ações', nomes: ['IconeSearch', 'IconeEye', 'IconeLink', 'IconePencil', 'IconeCamera', 'IconeDownload', 'IconeUpload', 'IconeCheck', 'IconeSend', 'IconeSave', 'IconeStar', 'IconeTrash'] },
  { titulo: 'Mídia', nomes: ['IconePlay'] },
  { titulo: 'Conteúdo / metadados', nomes: ['IconeUsers', 'IconeClipboard', 'IconePaperclip', 'IconeBookOpen', 'IconeMap', 'IconeBarChart', 'IconeFileText', 'IconeScale', 'IconeMapPin', 'IconeMail', 'IconePhone', 'IconeCalendar', 'IconeCalendarPlus'] },
  { titulo: 'Suporte / estado', nomes: ['IconeHeadset', 'IconeAlertTriangle', 'IconeLock', 'IconeBot', 'IconeClock', 'IconeZap', 'IconeHourglass'] },
  { titulo: 'Notificações / menu do avatar', nomes: ['IconeBell', 'IconeUser', 'IconeGlobe', 'IconeShield', 'IconeLogOut'] },
  { titulo: 'Comunidade', nomes: ['IconeHeart', 'IconeThumbsUp', 'IconeMessageCircle', 'IconeBookmark', 'IconeSparkle', 'IconeMegaphone'] },
]

const NOMES_EMBLEMAS = ['FogoStreak', 'Moeda', 'XP', 'Certificado', 'InsigniaEtapa', 'SeloNivel', 'Trofeu', 'AoVivo']

// ---------- seção 3: levantamento manual via grep de "size=" em cada call site (ver auditoria) ----------

type LinhaTabela = { contexto: string; arquivo: string; icone: string; tamanho: string }
type GrupoTabela = { categoria: string; linhas: LinhaTabela[] }

const TABELA_RESUMO: GrupoTabela[] = [
  {
    categoria: 'Nav principal — NavPlataforma.tsx',
    linhas: [
      { contexto: 'Banner de manutenção (admin)', arquivo: 'NavPlataforma.tsx', icone: 'IconeAlertTriangle', tamanho: '14' },
      { contexto: 'Dropdown "Conteúdos" — seta do botão', arquivo: 'NavPlataforma.tsx', icone: 'IconeChevronDown', tamanho: '10' },
      { contexto: 'Dropdown "Conteúdos" — item Trilhas', arquivo: 'NavPlataforma.tsx', icone: 'IconeMap', tamanho: '18' },
      { contexto: 'Dropdown "Conteúdos" — item Biblioteca de cursos', arquivo: 'NavPlataforma.tsx', icone: 'IconeBookOpen', tamanho: '18' },
      { contexto: 'Dropdown "Conteúdos" — item Planilhas e modelos', arquivo: 'NavPlataforma.tsx', icone: 'IconeBarChart', tamanho: '18' },
      { contexto: 'Popup de nível — linha Sequência', arquivo: 'NavPlataforma.tsx', icone: 'FogoStreak', tamanho: '14' },
      { contexto: 'Popup de nível — linha Moedas', arquivo: 'NavPlataforma.tsx', icone: 'Moeda', tamanho: '14' },
      { contexto: 'Pílula de moeda (barra superior)', arquivo: 'NavPlataforma.tsx', icone: 'Moeda', tamanho: '14' },
      { contexto: 'Pílula de streak (barra superior)', arquivo: 'NavPlataforma.tsx', icone: 'FogoStreak', tamanho: '14' },
      { contexto: 'Menu do avatar — Meu perfil', arquivo: 'NavPlataforma.tsx', icone: 'IconeUser', tamanho: '16' },
      { contexto: 'Menu do avatar — Meus certificados', arquivo: 'NavPlataforma.tsx', icone: 'Certificado (mono)', tamanho: '16' },
      { contexto: 'Menu do avatar — Perfil público', arquivo: 'NavPlataforma.tsx', icone: 'IconeGlobe', tamanho: '16' },
      { contexto: 'Menu do avatar — Painel Admin', arquivo: 'NavPlataforma.tsx', icone: 'IconeShield', tamanho: '16' },
      { contexto: 'Menu do avatar — Sair', arquivo: 'NavPlataforma.tsx', icone: 'IconeLogOut', tamanho: '16' },
      { contexto: 'Pílula de nível numérico (np-insignia)', arquivo: 'NavPlataforma.tsx', icone: '— texto puro, sem ícone', tamanho: '—' },
    ],
  },
  {
    categoria: 'Admin — botões de ação em tabelas/listas',
    linhas: [
      { contexto: 'Voltar (breadcrumb) — 5 editores (evento/trilha/desafio/curso/avaliação)', arquivo: 'Admin*EditorContent.tsx', icone: 'IconeChevronLeft', tamanho: '14' },
      { contexto: 'Mover item ↑/↓ (etapa, missão, quesito, módulo, aula, material, questão, nível)', arquivo: 'vários Admin*Content.tsx', icone: 'IconeArrowUp / IconeArrowDown', tamanho: '13' },
      { contexto: 'Editar/renomear (etapa, módulo, material, categoria, nível de gamificação, plano)', arquivo: 'vários Admin*Content.tsx', icone: 'IconePencil', tamanho: '13' },
      { contexto: 'Excluir (etapa, missão, quesito, curso, aula, material, questão, aviso, categoria, nível, plano)', arquivo: 'vários Admin*Content.tsx', icone: 'IconeTrash', tamanho: '13 (consistente)' },
      { contexto: 'Buscar — Usuários / Financeiro', arquivo: 'AdminUsuariosContent.tsx / AdminFinanceiroContent.tsx', icone: 'IconeSearch', tamanho: '14' },
      { contexto: 'Paginação ← / → — Usuários', arquivo: 'AdminUsuariosContent.tsx', icone: 'IconeChevronLeft / IconeChevronRight', tamanho: '14' },
      { contexto: 'Enviar arquivos de material da aula', arquivo: 'AdminCursoEditorContent.tsx', icone: 'IconeUpload', tamanho: '13' },
      { contexto: 'Novo plano (financeiro)', arquivo: 'AdminFinanceiroContent.tsx', icone: 'IconePlus', tamanho: '14' },
    ],
  },
  {
    categoria: 'Admin — ficha do usuário',
    linhas: [
      { contexto: '"Ver como este aluno"', arquivo: 'AdminUsuarioFichaContent.tsx', icone: 'IconeEye', tamanho: '14' },
      { contexto: 'Dados: nome / e-mail / cidade / cadastro / último acesso', arquivo: 'AdminUsuarioFichaContent.tsx', icone: 'IconeUser, IconeMail, IconeMapPin, IconeCalendar, IconeClock', tamanho: '14' },
      { contexto: '"Resetar senha"', arquivo: 'AdminUsuarioFichaContent.tsx', icone: 'IconeLock', tamanho: '14' },
      { contexto: 'Botão "Emitir" certificado', arquivo: 'AdminUsuarioFichaContent.tsx', icone: 'Certificado (mono)', tamanho: '14' },
      { contexto: 'Stats: XP total / Moedas / Nível / Streak', arquivo: 'AdminUsuarioFichaContent.tsx', icone: 'XP, Moeda, SeloNivel, FogoStreak (mono)', tamanho: '16' },
    ],
  },
  {
    categoria: 'Admin — cabeçalhos, configurações, sidebar',
    linhas: [
      { contexto: 'Cabeçalho "Modo manutenção"', arquivo: 'AdminConfiguracoesContent.tsx', icone: 'IconeAlertTriangle', tamanho: '16' },
      { contexto: 'Card de integração — status Configurada/Ausente', arquivo: 'AdminConfiguracoesContent.tsx', icone: 'IconeCheck / IconeAlertTriangle', tamanho: '12' },
      { contexto: 'Card de integração — link', arquivo: 'AdminConfiguracoesContent.tsx', icone: 'IconeLink', tamanho: '13' },
      { contexto: 'Itens de navegação da sidebar', arquivo: 'AdminShell.tsx', icone: 'nenhum ícone — só texto', tamanho: '—' },
    ],
  },
  {
    categoria: 'Aula / curso — material, player, progresso',
    linhas: [
      { contexto: 'Tipo de material: pdf/docx / xlsx / fallback (zip)', arquivo: 'AulaContent.tsx', icone: 'IconeFileText / IconeBarChart / IconePaperclip', tamanho: '20' },
      { contexto: 'Botão "Baixar" material da aula', arquivo: 'AulaContent.tsx', icone: 'IconeDownload', tamanho: '13' },
      { contexto: 'Breadcrumb / navegação anterior-próxima aula', arquivo: 'AulaContent.tsx', icone: 'IconeChevronLeft / IconeChevronRight', tamanho: '14' },
      { contexto: 'Player — play central', arquivo: 'AulaContent.tsx', icone: 'IconePlay', tamanho: '26' },
      { contexto: 'Marcar aula concluída (nav)', arquivo: 'AulaContent.tsx', icone: 'IconeCheck', tamanho: '14' },
      { contexto: 'Enviar dúvida', arquivo: 'AulaContent.tsx', icone: 'IconeSend', tamanho: '15' },
      { contexto: 'Suporte — falar com suporte / reportar problema', arquivo: 'AulaContent.tsx', icone: 'IconeHeadset / IconeAlertTriangle', tamanho: '19' },
      { contexto: 'Trilho de tópicos — tópico concluído', arquivo: 'AulaContent.tsx', icone: 'IconeCheck', tamanho: '12' },
      { contexto: 'Toast de XP ganho', arquivo: 'AulaContent.tsx', icone: 'XP', tamanho: '14' },
      { contexto: 'Modal "Certificado emitido!"', arquivo: 'AulaContent.tsx', icone: 'Certificado', tamanho: '48' },
      { contexto: 'Voltar à biblioteca / CTAs "Começar curso"', arquivo: 'CursoContent.tsx', icone: 'IconeChevronLeft / IconePlay', tamanho: '13' },
      { contexto: 'Toggle abrir/fechar módulo', arquivo: 'CursoContent.tsx', icone: 'IconePlus', tamanho: '15' },
      { contexto: 'Objetivo concluído', arquivo: 'CursoContent.tsx', icone: 'IconeCheck', tamanho: '10' },
      { contexto: 'Selo "Certificado verificável"', arquivo: 'CursoContent.tsx', icone: 'Certificado', tamanho: '18' },
      { contexto: 'Conquista bloqueada', arquivo: 'CursoContent.tsx', icone: 'IconeLock', tamanho: '15' },
      { contexto: 'Etapa concluída / check de recompensa / marcos finais', arquivo: 'JornadaContent.tsx', icone: 'IconeCheck', tamanho: '13' },
      { contexto: 'Badge de insígnia da etapa', arquivo: 'JornadaContent.tsx', icone: 'InsigniaEtapa', tamanho: '14' },
      { contexto: 'Etapa bloqueada', arquivo: 'JornadaContent.tsx', icone: 'IconeLock', tamanho: '14' },
      { contexto: 'Selo de certificado final da trilha', arquivo: 'JornadaContent.tsx', icone: 'Certificado', tamanho: '22' },
      { contexto: 'Tipo planilha / laudo / petição', arquivo: 'BibliotecaContent.tsx', icone: 'IconeBarChart / IconeFileText / IconeScale', tamanho: '13' },
      { contexto: 'Busca', arquivo: 'BibliotecaContent.tsx', icone: 'IconeSearch', tamanho: '14' },
      { contexto: 'Favoritar / baixar item', arquivo: 'BibliotecaContent.tsx', icone: 'IconeStar / IconeDownload', tamanho: '13–14' },
      { contexto: 'Busca de cursos', arquivo: 'CursosBibliotecaContent.tsx', icone: 'IconeSearch', tamanho: '16' },
      { contexto: 'Duração / instrutor (card de curso)', arquivo: 'CursosBibliotecaContent.tsx', icone: 'IconeClock / IconeUser', tamanho: '12' },
    ],
  },
  {
    categoria: 'Comunidade',
    linhas: [
      { contexto: 'Ações do post: Útil / Comentar / Salvar', arquivo: 'ComunidadeContent.tsx', icone: 'IconeThumbsUp / IconeMessageCircle / IconeBookmark', tamanho: '15' },
      { contexto: 'Badge de insígnia de etapa (autor)', arquivo: 'ComunidadeContent.tsx', icone: 'InsigniaEtapa', tamanho: '22' },
      { contexto: 'Botão "Parabenizar"', arquivo: 'ComunidadeContent.tsx', icone: 'IconeSparkle', tamanho: '13' },
      { contexto: 'Moderação (admin)', arquivo: 'AdminComunidadeContent.tsx', icone: 'nenhum ícone', tamanho: '—' },
    ],
  },
  {
    categoria: 'Perfil / Perito público',
    linhas: [
      { contexto: 'Insígnia tipo check / doc / raio', arquivo: 'PerfilContent.tsx', icone: 'IconeCheck / IconeFileText / IconeZap', tamanho: '26' },
      { contexto: 'Insígnia bloqueada (cadeado)', arquivo: 'PerfilContent.tsx', icone: 'IconeLock', tamanho: '22' },
      { contexto: 'Atividade recente: comunidade / anotação / ranking', arquivo: 'PerfilContent.tsx', icone: 'IconeMessageCircle / IconePencil / IconeArrowUp', tamanho: '13' },
      { contexto: 'Ícone de certificado (helper IcoCert)', arquivo: 'PerfilContent.tsx', icone: 'Certificado', tamanho: '22' },
      { contexto: 'Trocar foto do perfil', arquivo: 'PerfilContent.tsx', icone: 'IconeCamera', tamanho: '18' },
      { contexto: 'Editar perfil / "ver como" público', arquivo: 'PerfilContent.tsx', icone: 'IconePencil / IconeEye', tamanho: '15' },
      { contexto: 'Copiar link do perfil', arquivo: 'PerfilContent.tsx', icone: 'IconeLink', tamanho: '14' },
      { contexto: 'Copiar link de um certificado específico', arquivo: 'PerfilContent.tsx', icone: 'IconeLink', tamanho: '12' },
      { contexto: 'Emblema de sequência (streak)', arquivo: 'PerfilContent.tsx', icone: 'FogoStreak', tamanho: '16' },
      { contexto: 'Cidade / XP total / nível / membro desde / e-mail / telefone', arquivo: 'PeritoPublicoContent.tsx', icone: 'IconeMapPin, XP, SeloNivel, IconeCalendar, IconeMail, IconePhone', tamanho: '13' },
      { contexto: 'Selo de certificado', arquivo: 'PeritoPublicoContent.tsx', icone: 'Certificado', tamanho: '24' },
    ],
  },
  {
    categoria: 'Avaliações / Desafios',
    linhas: [
      { contexto: 'Voltar (breadcrumb)', arquivo: 'AvaliacaoContent.tsx', icone: 'IconeChevronLeft', tamanho: '13' },
      { contexto: '"XP em jogo" (briefing)', arquivo: 'AvaliacaoContent.tsx', icone: 'XP', tamanho: '16' },
      { contexto: 'Resultado — XP creditado / troféu', arquivo: 'AvaliacaoContent.tsx', icone: 'XP / Trofeu', tamanho: '15' },
      { contexto: 'Desafio — recompensa XP/moedas/prazo/participantes (briefing)', arquivo: 'DesafioContent.tsx', icone: 'XP, Moeda, IconeClock, IconeUsers', tamanho: '16' },
      { contexto: 'Desafio — recompensa (barra de perguntas)', arquivo: 'DesafioContent.tsx', icone: 'XP, Moeda', tamanho: '13' },
      { contexto: 'Desafio — ganho de XP/moedas (veredito)', arquivo: 'DesafioContent.tsx', icone: 'XP, Moeda', tamanho: '14' },
      { contexto: 'Desafio — voltar (5 ocorrências no mesmo arquivo)', arquivo: 'DesafioContent.tsx', icone: 'IconeChevronLeft', tamanho: '12–14 (varia)' },
      { contexto: 'Lista de desafios — XP / moedas / quesitos / prazo', arquivo: 'DesafiosContent.tsx', icone: 'XP, Moeda, IconeClipboard, IconeClock', tamanho: '13' },
    ],
  },
  {
    categoria: 'Login / telas de bloqueio',
    linhas: [
      { contexto: 'Seta do botão "Entrar"', arquivo: 'LoginContent.tsx', icone: 'IconeChevronRight', tamanho: '13' },
      { contexto: 'Ícone central: manutenção / acesso negado / conta suspensa / assinatura necessária', arquivo: 'app/manutencao, acesso-negado, conta-suspensa, AssinaturaNecessaria.tsx', icone: 'IconeZap / IconeLock', tamanho: '32 (consistente nas 4 telas)' },
    ],
  },
  {
    categoria: 'Avisos globais (sino)',
    linhas: [
      { contexto: 'Notificação por tipo (comunidade/evento/jornada) + fallback', arquivo: 'AvisosGlobais.tsx', icone: 'IconeMessageCircle, IconeCalendar, IconeMap, IconeBell', tamanho: '14' },
      { contexto: 'Botão flutuante do sino', arquivo: 'AvisosGlobais.tsx', icone: 'IconeBell', tamanho: '18' },
      { contexto: 'Popup de novidades — título', arquivo: 'AvisosGlobais.tsx', icone: 'IconeMegaphone', tamanho: '16' },
    ],
  },
  {
    categoria: 'Agenda',
    linhas: [
      { contexto: 'Evento já reservado / selo "Ao vivo agora"', arquivo: 'AgendaContent.tsx', icone: 'IconeCheck / AoVivo', tamanho: '10–13' },
      { contexto: 'Fechar modal de evento', arquivo: 'AgendaContent.tsx', icone: 'IconeClose', tamanho: '15' },
      { contexto: '"Ver detalhes" do evento', arquivo: 'AgendaContent.tsx', icone: 'IconeEye', tamanho: '16' },
      { contexto: 'Adicionar ao calendário', arquivo: 'AgendaContent.tsx', icone: 'IconeCalendarPlus', tamanho: '14' },
      { contexto: 'Assistir gravação / entrar na sala', arquivo: 'AgendaContent.tsx', icone: 'IconePlay', tamanho: '17' },
      { contexto: 'Criar novo evento (CTA)', arquivo: 'AgendaContent.tsx', icone: 'IconePlus', tamanho: '15' },
    ],
  },
  {
    categoria: 'Home',
    linhas: [
      { contexto: 'CTA assistir (card destaque)', arquivo: 'HomeContent.tsx', icone: 'IconePlay', tamanho: '13' },
      { contexto: 'Etapa da jornada concluída / em destaque', arquivo: 'HomeContent.tsx', icone: 'IconeCheck / IconeStar', tamanho: '13' },
      { contexto: 'Selo "ao vivo" no painel de evento', arquivo: 'HomeContent.tsx', icone: 'AoVivo', tamanho: '10' },
    ],
  },
]

const INCONSISTENCIAS = [
  '"Excluir" (IconeTrash) é size=13 em TODO o admin — bom padrão, sem inconsistência.',
  '"Buscar" (IconeSearch) é 14 na maioria das telas, mas 16 em CursosBibliotecaContent — mesmo papel, tamanho diferente.',
  '"Concluído" (IconeCheck) aparece em pelo menos 6 tamanhos (10, 12, 13, 14, 15, 16, 26) — alguns são hierarquia proposital (26 = insígnia grande), outros parecem arbitrários (13 vs 14 vs 15 pro mesmo "check inline" em Aula/Curso/Jornada).',
  '"Voltar" (IconeChevronLeft) varia entre 12, 13 e 14 dentro do mesmo arquivo (DesafioContent.tsx) pra mesma ação.',
  'XP/Moeda no fluxo de Desafios: 16 no briefing → 13 na barra de perguntas → 14 no veredito — três tamanhos pro mesmo par de emblemas no mesmo fluxo.',
  'Certificado tem 6+ tamanhos distintos (14 a 48) conforme contexto — provavelmente hierarquia intencional (hero vs. inline), mas sem uma escala nomeada (ex.: sm/md/lg/hero).',
  '"Copiar link" (IconeLink) é 12, 13 ou 14 conforme a tela — PerfilContent usa 14 pro link do perfil e 12 pro link de um certificado, na mesma tela.',
  'Sidebar do admin (AdminShell.tsx) não tem nenhum ícone — só texto. Decidir se é intencional ou lacuna.',
  '"Novo/adicionar" (IconePlus) é 14 no Financeiro vs. 15 em Curso/Agenda — mesma ação, tamanhos diferentes.',
]

// Todo export de Icones.tsx começa com "Icone" — captura automaticamente
// qualquer ícone novo, mesmo que ninguém tenha lembrado de listar aqui em cima.
const todosIconesExportados = Object.keys(IconesNS).filter(n => n.startsWith('Icone'))
const naoCategorizados = todosIconesExportados.filter(n => !CATEGORIAS_ICONES.some(c => c.nomes.includes(n)))

function CardIcone({ nome, Componente }: { nome: string; Componente: IconeComponente }) {
  return (
    <div className="di-card">
      <span className="di-card-nome">{nome}</span>
      <div className="di-card-linha">
        {TAMANHOS.map(tam => (
          <div className="di-swatch" key={tam}>
            <Componente size={tam} />
            <small>{tam}px</small>
          </div>
        ))}
      </div>
    </div>
  )
}

function CardEmblema({ nome, Componente }: { nome: string; Componente: EmblemaComponente }) {
  return (
    <div className="di-card di-card-emblema">
      <span className="di-card-nome">{nome}</span>
      {(['cor', 'mono'] as const).map(variante => (
        <div className="di-card-linha" key={variante}>
          <span className="di-variante-tag">{variante}</span>
          {TAMANHOS.map(tam => (
            <div className="di-swatch" key={tam}>
              <Componente size={tam} variante={variante} />
              <small>{tam}px</small>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ---------- seção 2: usos reais, tamanhos exatos copiados do código de produção ----------

function CtxMenuAvatar() {
  const IconeUser = (IconesNS as Record<string, IconeComponente>).IconeUser
  const IconeGlobe = (IconesNS as Record<string, IconeComponente>).IconeGlobe
  const IconeShield = (IconesNS as Record<string, IconeComponente>).IconeShield
  const IconeLogOut = (IconesNS as Record<string, IconeComponente>).IconeLogOut
  const Certificado = (EmblemasNS as Record<string, EmblemaComponente>).Certificado
  return (
    <div className="di-mock di-mock-avatarmenu">
      <div className="di-am-item"><IconeUser size={16} strokeWidth={1.8} /> Meu perfil</div>
      <div className="di-am-item"><Certificado size={16} variante="mono" /> Meus certificados</div>
      <div className="di-am-item"><IconeGlobe size={16} strokeWidth={1.8} /> Perfil público</div>
      <div className="di-am-item"><IconeShield size={16} strokeWidth={1.8} /> Painel Admin</div>
      <div className="di-am-item di-am-sair"><IconeLogOut size={16} strokeWidth={1.8} /> Sair</div>
    </div>
  )
}

function CtxAcoesPost() {
  const IconeThumbsUp = (IconesNS as Record<string, IconeComponente>).IconeThumbsUp
  const IconeMessageCircle = (IconesNS as Record<string, IconeComponente>).IconeMessageCircle
  const IconeBookmark = (IconesNS as Record<string, IconeComponente>).IconeBookmark
  return (
    <div className="di-mock di-mock-acoespost">
      <button className="di-acao"><IconeThumbsUp size={15} strokeWidth={2} /> Útil · <span className="num">12</span></button>
      <button className="di-acao"><IconeMessageCircle size={15} strokeWidth={2} /> <span className="num">4</span> comentários</button>
      <button className="di-acao"><IconeBookmark size={15} strokeWidth={2} /> Salvar</button>
    </div>
  )
}

function CtxPilulasNav() {
  const FogoStreak = (EmblemasNS as Record<string, EmblemaComponente>).FogoStreak
  const Moeda = (EmblemasNS as Record<string, EmblemaComponente>).Moeda
  return (
    <div className="di-mock di-mock-pilulas">
      <div className="di-nivel-fake">
        <span className="di-insignia num">7</span>
        <span className="di-nivel-info">
          <span className="num"><b>1.240</b><small>/2.000 XP</small></span>
          <span className="di-barra"><i style={{ width: '62%' }}></i></span>
        </span>
      </div>
      <button className="di-pilula"><Moeda size={14} /> <b className="num">340</b></button>
      <button className="di-pilula di-pilula-fogo"><FogoStreak size={14} /> <b className="num">5 dias</b></button>
    </div>
  )
}

function CtxSidebarAdmin() {
  return (
    <div className="di-mock di-mock-sidebar">
      <div className="di-ad-item">Início</div>
      <div className="di-ad-item">Cursos</div>
      <div className="di-ad-item">Financeiro</div>
      <div className="di-ad-item">Usuários</div>
    </div>
  )
}

export default function DevIconesContent() {
  return (
    <div className="pagina-dev-icones">
      <header className="di-header">
        <span className="di-eyebrow">/dev/icones — instrumento interno, super_admin</span>
        <h1>Revisão do sistema de ícones</h1>
        <p>
          Referência de auditoria visual do Nível 1 (<code>components/Icones.tsx</code>) e Nível 2
          (<code>components/Emblemas.tsx</code>). Esta página não altera nenhum tamanho em produção —
          é só pra marcar o que está pequeno/inconsistente antes de fazer os ajustes numa passada única.
        </p>
      </header>

      <section className="di-secao">
        <h2 className="di-titulo-secao">1. Todos os ícones e emblemas, em 16 / 20 / 24px</h2>

        {CATEGORIAS_ICONES.map(cat => (
          <div className="di-categoria" key={cat.titulo}>
            <h3>{cat.titulo}</h3>
            <div className="di-grid">
              {cat.nomes.map(nome => {
                const Componente = (IconesNS as Record<string, IconeComponente>)[nome]
                if (!Componente) return null
                return <CardIcone key={nome} nome={nome} Componente={Componente} />
              })}
            </div>
          </div>
        ))}

        {naoCategorizados.length > 0 && (
          <div className="di-categoria">
            <h3>Não categorizados aqui (adicionados após esta página — revisar agrupamento)</h3>
            <div className="di-grid">
              {naoCategorizados.map(nome => {
                const Componente = (IconesNS as Record<string, IconeComponente>)[nome]
                return <CardIcone key={nome} nome={nome} Componente={Componente} />
              })}
            </div>
          </div>
        )}

        <div className="di-categoria">
          <h3>Emblemas (Nível 2 — variantes cor e mono)</h3>
          <div className="di-grid di-grid-emblemas">
            {NOMES_EMBLEMAS.map(nome => {
              const Componente = (EmblemasNS as Record<string, EmblemaComponente>)[nome]
              if (!Componente) return null
              return <CardEmblema key={nome} nome={nome} Componente={Componente} />
            })}
          </div>
        </div>
      </section>

      <section className="di-secao">
        <h2 className="di-titulo-secao">2. Em contexto real (tamanhos exatos de produção)</h2>
        <div className="di-ctx-grid">
          <div className="di-ctx-card">
            <h4>Menu do avatar <span className="di-tam-badge">size=16 · strokeWidth 1.8</span></h4>
            <p className="di-ctx-fonte">NavPlataforma.tsx — .np-am-item</p>
            <CtxMenuAvatar />
          </div>
          <div className="di-ctx-card">
            <h4>Ações de post da comunidade <span className="di-tam-badge">size=15 · strokeWidth 2</span></h4>
            <p className="di-ctx-fonte">ComunidadeContent.tsx — .acao (Útil / Comentar / Salvar)</p>
            <CtxAcoesPost />
          </div>
          <div className="di-ctx-card">
            <h4>Pílulas do nav <span className="di-tam-badge">FogoStreak/Moeda size=14</span></h4>
            <p className="di-ctx-fonte">
              NavPlataforma.tsx — .np-pilula. <b>Nota:</b> a pílula de nível/XP (.np-nivel) não usa o
              emblema <code>XP</code> — é texto puro (&quot;XP&quot;), diferente do que a legenda &quot;foguinho +
              moeda + XP&quot; sugeria. O emblema <code>XP</code> só aparece em outras telas (Desafios,
              Avaliações, Perfil), nunca no nav.
            </p>
            <CtxPilulasNav />
          </div>
          <div className="di-ctx-card">
            <h4>Item da sidebar do admin <span className="di-tam-badge">sem ícone</span></h4>
            <p className="di-ctx-fonte">
              AdminShell.tsx — .ad-nav-item. <b>Nota:</b> a sidebar do admin não usa nenhum ícone hoje,
              só texto — não há tamanho pra auditar aqui, é uma lacuna do sistema de ícones que talvez
              valha entrar na passada de ajustes.
            </p>
            <CtxSidebarAdmin />
          </div>
        </div>
      </section>

      <section className="di-secao">
        <h2 className="di-titulo-secao">3. Tabela-resumo — tamanho por contexto de uso</h2>
        <p className="di-ctx-fonte">
          Levantado direto do código (grep por <code>size=</code> em cada call site de <code>Icone*</code>/emblema).
          Quando a mesma linha lógica cobre várias ocorrências idênticas (ex.: os 5 breadcrumbs &quot;voltar&quot;
          dos editores do admin), elas foram agrupadas numa linha só.
        </p>
        <div className="di-tabela-wrap">
          <table className="di-tabela">
            <thead>
              <tr>
                <th>Contexto</th>
                <th>Arquivo</th>
                <th>Ícone / emblema</th>
                <th>Tamanho</th>
              </tr>
            </thead>
            <tbody>
              {TABELA_RESUMO.map(grupo => (
                <Fragment key={grupo.categoria}>
                  <tr className="di-cat-sep">
                    <td colSpan={4}>{grupo.categoria}</td>
                  </tr>
                  {grupo.linhas.map((linha, i) => (
                    <tr key={`${grupo.categoria}-${i}`}>
                      <td>{linha.contexto}</td>
                      <td><code>{linha.arquivo}</code></td>
                      <td>{linha.icone}</td>
                      <td className="di-td-tam">{linha.tamanho}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="di-secao">
        <h2 className="di-titulo-secao">Inconsistências observadas (não corrigidas — só anotadas)</h2>
        <ul className="di-lista-inconsistencias">
          {INCONSISTENCIAS.map((texto, i) => <li key={i}>{texto}</li>)}
        </ul>
      </section>
    </div>
  )
}
