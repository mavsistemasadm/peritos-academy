// lib/guia/conteudo.ts
// Texto dos 9 capítulos do /guia. Estático de propósito — a única parte
// dinâmica (lista real dos 10 níveis) é montada à parte em GuiaContent a
// partir de lib/queries/guia.ts.
export type SecaoGuia = { titulo: string; paragrafos: string[] }
export type CapituloGuia = { id: string; numero: number; titulo: string; secoes: SecaoGuia[] }

export const CAPITULOS: CapituloGuia[] = [
  {
    id: 'primeiros-passos',
    numero: 1,
    titulo: 'Primeiros passos',
    secoes: [
      {
        titulo: 'O que é a Peritos Academy',
        paragrafos: [
          'A Peritos Academy é a sua central de evolução na perícia judicial: cursos, trilhas, comunidade e prática, tudo em um só lugar, desenhado para transformar conhecimento em autoridade profissional.',
        ],
      },
      {
        titulo: 'Como começar',
        paragrafos: [
          'Seu ponto de partida é a Formação Pericial de Alta Performance, a trilha obrigatória para todos os alunos. Clique em Começar agora na página inicial e a plataforma te leva direto para a primeira aula.',
        ],
      },
      {
        titulo: 'Navegação básica',
        paragrafos: [
          'Início: sua central de comando, com a próxima aula, progresso e recomendações.',
          'Conteúdos: dropdown com Trilhas (sua jornada), Biblioteca de cursos e Planilhas e modelos.',
          'Comunidade: dúvidas, casos e vitórias compartilhados com outros peritos.',
          'Agenda: encontros ao vivo e gravações disponíveis.',
          'Desafios: casos periciais reais para praticar e receber feedback.',
        ],
      },
    ],
  },
  {
    id: 'jornada-e-trilhas',
    numero: 2,
    titulo: 'Sua jornada e trilhas',
    secoes: [
      {
        titulo: 'A Formação',
        paragrafos: [
          'A Formação Pericial de Alta Performance é o caminho obrigatório, seja você iniciante ou perito experiente. Ao concluir todas as etapas, você conquista o Selo de Excelência Peritos Academy, uma insígnia permanente no seu perfil.',
        ],
      },
      {
        titulo: 'Os territórios',
        paragrafos: [
          'Depois (ou em paralelo), você escolhe onde se especializar: Perito Trabalhista, Bancário, Previdenciário, Perito do Juízo, Cíveis e Tributários, Teses Atuariais, Aceleração e Automação e Escritório Pericial. Todos os territórios estão abertos, você define o seu caminho.',
        ],
      },
      {
        titulo: 'Como a página /jornada funciona',
        paragrafos: [
          'O card principal mostra sua trilha ativa; ao concluir a Formação, ele vira o selo dourado da conquista. A trilha em que você estiver mais ativo assume o destaque da página.',
        ],
      },
      {
        titulo: 'Concluir um território',
        paragrafos: [
          'Cada território concluído mostra a insígnia daquela especialização como marco final da sua jornada, visível no seu perfil.',
        ],
      },
    ],
  },
  {
    id: 'aulas-e-materiais',
    numero: 3,
    titulo: 'Aulas e materiais',
    secoes: [
      {
        titulo: 'Como concluir uma aula',
        paragrafos: [
          'Cada aula tem o botão Concluir aula. Ele acende quando você cumpre os critérios: assistir a pelo menos 70% do vídeo e baixar todos os materiais complementares. Um checklist ao lado do player mostra em tempo real o que já foi cumprido.',
        ],
      },
      {
        titulo: 'Por que os materiais são obrigatórios',
        paragrafos: [
          'Porque perícia se faz com a planilha na mão. Cada arquivo foi preparado para a prática: modelos, gabaritos e planilhas que você vai usar nos seus próprios laudos.',
        ],
      },
      {
        titulo: 'Progressão sequencial',
        paragrafos: [
          'As aulas seguem uma ordem pensada para a sua evolução: a próxima é liberada quando você conclui a anterior. Rever aulas concluídas é sempre livre.',
        ],
      },
      {
        titulo: 'Avaliações',
        paragrafos: [
          'Alguns cursos têm avaliações para consolidar o aprendizado. A aprovação libera a sequência. Se não passar de primeira, você pode refazer.',
        ],
      },
      {
        titulo: 'Dica',
        paragrafos: [
          'Seus downloads ficam salvos no histórico. Se trocar de computador, a plataforma lembra do seu progresso.',
        ],
      },
    ],
  },
  {
    id: 'xp-niveis-insignias',
    numero: 4,
    titulo: 'XP, níveis e insígnias',
    secoes: [
      {
        titulo: 'Como ganhar XP',
        paragrafos: [
          'Várias ações reais dentro da plataforma creditam XP (e moedas): concluir uma aula, concluir um módulo, concluir um curso inteiro, ser aprovado em uma avaliação (quanto maior o seu aproveitamento, mais XP, e provas valem mais que quizzes de módulo), fazer login todo dia (mantém sua sequência viva), participar da comunidade postando, comentando ou reagindo, e entregar um desafio pericial.',
          'Os valores exatos de cada ação ainda estão em calibragem e podem mudar conforme a plataforma evolui.',
        ],
      },
      {
        titulo: 'Os 10 níveis',
        paragrafos: [],
      },
      {
        titulo: 'Insígnias de etapa e território',
        paragrafos: [
          'Sua aba Conquistas, no perfil, reúne as insígnias da sua jornada. Cada etapa da Formação e cada território indicam a insígnia que marca a conclusão daquele trecho do caminho.',
        ],
      },
      {
        titulo: 'Sequência (streak)',
        paragrafos: [
          'Sua sequência de dias conta cada dia com atividade de estudo. Constância vale pontos.',
        ],
      },
    ],
  },
  {
    id: 'comunidade',
    numero: 5,
    titulo: 'Comunidade',
    secoes: [
      {
        titulo: 'O que é',
        paragrafos: [
          'Um espaço para trocar experiência com outros peritos: compartilhar um caso, tirar uma dúvida ou celebrar uma vitória.',
        ],
      },
      {
        titulo: 'Como postar',
        paragrafos: [
          'No campo de publicação, escolha o tipo (Caso, Dúvida ou Vitória), escreva e publique. Posts de Vitória ganham um cartão de conquista especial, com direito a parabéns de quem estiver por perto.',
          'Reaja com Útil nos posts que te ajudaram, ou guarde um post para depois com Salvar.',
        ],
      },
      {
        titulo: 'Boas práticas',
        paragrafos: [
          'Trate cada colega como trataria num tribunal: com respeito, mesmo na discordância.',
          'Compartilhe o que puder sem violar sigilo processual ou dados de terceiros.',
          'Perícia é técnica, não é disputa pessoal. O objetivo é todo mundo evoluir.',
        ],
      },
    ],
  },
  {
    id: 'desafios',
    numero: 6,
    titulo: 'Desafios',
    secoes: [
      {
        titulo: 'Como funcionam',
        paragrafos: [
          'Cada desafio é um caso pericial real, com prazo para entrega. Você aceita o desafio, lê a intimação e os documentos anexados, responde aos quesitos (as respostas ficam salvas automaticamente enquanto você trabalha) e, quando estiver pronto, protocola o laudo final. Depois de protocolado, não dá mais para editar.',
        ],
      },
      {
        titulo: 'Correção e recompensas',
        paragrafos: [
          'A correção usa inteligência artificial para comparar sua resposta com o gabarito e dar uma nota de 0 a 10 por quesito, com feedback escrito. Passar da nota mínima libera XP, moedas e o gabarito completo para download. Se não passar, o aprendizado fica registrado no seu histórico e você pode seguir praticando nos próximos desafios.',
        ],
      },
    ],
  },
  {
    id: 'agenda',
    numero: 7,
    titulo: 'Agenda e encontros',
    secoes: [
      {
        titulo: 'Encontros ao vivo',
        paragrafos: [
          'Veja os próximos encontros ao vivo com especialistas e reserve seu lugar com um clique. Durante a transmissão, o evento aparece marcado como Ao vivo.',
        ],
      },
      {
        titulo: 'Gravações',
        paragrafos: [
          'Encontros que foram gravados ficam disponíveis para assistir depois, na mesma página da Agenda.',
        ],
      },
    ],
  },
  {
    id: 'certificados',
    numero: 8,
    titulo: 'Certificados',
    secoes: [
      {
        titulo: 'Quais cursos emitem certificado',
        paragrafos: [
          'Cursos marcados com Emite certificado geram um certificado digital automaticamente assim que você conclui 100% das aulas e é aprovado em todas as avaliações do curso.',
        ],
      },
      {
        titulo: 'Como emitir e onde encontrar',
        paragrafos: [
          'A emissão é automática, não precisa pedir nada. Seus certificados ficam na aba Certificados do seu perfil, com número, nota final e carga horária, e um botão para copiar o link de verificação.',
        ],
      },
    ],
  },
  {
    id: 'conta-e-preferencias',
    numero: 9,
    titulo: 'Conta e preferências',
    secoes: [
      {
        titulo: 'Editar perfil, foto e dados',
        paragrafos: [
          'Em Perfil, clique em Editar perfil para atualizar nome, bio, cidade, estado, telefone e email público. A foto é trocada direto no avatar, clicando no ícone de câmera.',
        ],
      },
      {
        titulo: 'Preferências de email',
        paragrafos: [
          'Você controla quais emails recebe direto em Perfil, no toggle Receber emails. O link para gerenciar essa preferência também vai no rodapé de todo email que a plataforma envia.',
        ],
      },
      {
        titulo: 'Sons de conquista',
        paragrafos: [
          'O toggle Sons de conquista, no mesmo formulário de Editar perfil, liga ou desliga os sons dos toasts de conquista: nível, avaliação aprovada, curso concluído, sequência e primeira aula.',
        ],
      },
      {
        titulo: 'Suporte',
        paragrafos: [
          'Use os botões Falar com o suporte na aba Suporte de qualquer aula, ou escreva diretamente para a nossa equipe pelo email de suporte.',
        ],
      },
    ],
  },
]
