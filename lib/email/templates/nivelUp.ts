// lib/email/templates/nivelUp.ts
// Emails de subida de nível (ordens 2-10). Texto aprovado nos 9 templates de
// docs/email-templates/email_nivel_0N_*.html, só com os placeholders
// ({PRIMEIRO_NOME}, {XP_TOTAL} etc) trocados por dado real; o envelope é o de
// lib/email/marca.ts desde 19/10/2026. As cores próprias de cada nível
// (degradê, botão, borda) saíram com o envelope: todos os níveis usam a mesma
// casca, e o que os distingue é o texto e a insígnia.
import { SITE_URL } from "@/lib/site";
import { abertura, assinatura, botao, casca, destaque, insignia, p } from "@/lib/email/marca";

export type DadosNivelUp = {
  primeiroNome: string;
  xpTotal: number;
  diasDeJornada: number;
  aulasConcluidas: number;
  avaliacoesAprovadas?: number; // só usado no nível 10
  desafiosEntregues?: number; // só usado no nível 10
  proximoNivelNome?: string; // dado real de gamificacao_niveis, ausente no nível 10 (não há próximo)
  proximoNivelFaltamXp?: number; // gamificacao_niveis.pontos_minimos do próximo - xp_total; nunca hardcoded
  cursoConcluidoJunto?: string; // título do curso, quando a subida de nível veio junto de uma conclusão de curso no mesmo dia
};

const ASSUNTOS: Record<number, string> = {
  2: "Novo nível: Conhecedor de Lógicas",
  3: "Novo nível: Aspirante a Perito",
  4: "Novo nível: Decifrador de Cálculos",
  5: "Novo nível: Profissão Perito",
  6: "Novo nível: Autoridade Pericial",
  7: "Novo nível: Desenvolvedor de Teses",
  8: "Novo nível: Estrategista Expert",
  9: "Novo nível: Mestre Supremo",
  10: "Você é a Lenda!",
};

function fmtNum(n: number): string {
  return n.toLocaleString("pt-BR");
}

type Nivel = {
  sobretitulo: string;
  titulo: string;
  img: string;
  rotulo: string;
  nome: string;
  /** As linhas sob o nome da insígnia: "Anterior → Novo" e o XP. */
  linhas: string[];
  /** Parágrafos na ordem; os que começam com "> " são a frase de destaque. */
  corpo: string[];
  botao: string;
  /** A linha acima do nome na assinatura. */
  antes: string;
};

const NIVEIS: Record<number, (d: DadosNivelUp) => Nivel> = {
  2: (d) => ({
    sobretitulo: `VOCÊ SUBIU DE NÍVEL, ${d.primeiroNome}!`,
    titulo: `As peças começaram<br>a se encaixar.`,
    img: `${SITE_URL}/niveis/nivel-02-conhecedor-de-logicas.png`,
    rotulo: `NÍVEL 2 DE 10 · SUA PRIMEIRA SUBIDA`,
    nome: `Conhecedor de Lógicas`,
    linhas: [`Explorador Novato → <strong>Conhecedor de Lógicas</strong>`, `${fmtNum(d.xpTotal)} XP conquistados`],
    corpo: [
      `${d.primeiroNome}, para um momento e olha o que você acabou de fazer.`,
      `Há ${d.diasDeJornada} dias você entrou na Peritos Academy como Explorador Novato, olhando esse mundo da perícia de fora, com o binóculo na mão. Desde então, foram <strong>${d.aulasConcluidas} aulas concluídas</strong> e <strong>${fmtNum(d.xpTotal)} XP conquistados</strong>. Nenhum ponto desses caiu do céu: cada um foi uma escolha sua de continuar.`,
      `O quebra-cabeça da sua nova insígnia conta o que aconteceu nesse caminho: contratos, cálculos, laudos... o que parecia um emaranhado começou a revelar padrão pra você. Você começou a enxergar a <strong>lógica</strong>. E quem aprende a enxergar a lógica nunca mais desaprende.`,
      `> Você começou a enxergar o que a maioria não vê: a lógica por trás dos números.`,
      `Essa foi sua <strong>primeira subida de nível</strong>, e ela prova algo importante: o método funciona. Aula por aula, caso por caso, você está virando outro profissional. A insígnia rosa já está brilhando no seu perfil, visível pra toda a comunidade. Gente do Brasil inteiro que está na mesma estrada e sabe exatamente o que essa conquista custou.`,
      `E o melhor? O que vem pela frente é ainda maior. O próximo nível já tem nome: <strong>Aspirante a Perito</strong>. E tem um posto esperando por você nele.`,
    ],
    botao: `Ver minha insígnia no perfil`,
    antes: `Comemorando com você,`,
  }),
  3: (d) => ({
    sobretitulo: `VOCÊ SUBIU DE NÍVEL, ${d.primeiroNome}!`,
    titulo: `Aspirar já não basta.<br>Você está se preparando.`,
    img: `${SITE_URL}/niveis/nivel-03-aspirante-a-perito.png`,
    rotulo: `NÍVEL 3 DE 10`,
    nome: `Aspirante a Perito`,
    linhas: [`Conhecedor de Lógicas → <strong>Aspirante a Perito</strong>`, `${fmtNum(d.xpTotal)} XP conquistados`],
    corpo: [
      `${d.primeiroNome}, olha que bonito o caminho que você está construindo.`,
      `Há ${d.diasDeJornada} dias você era um Explorador Novato. Depois virou Conhecedor de Lógicas. E agora, com <strong>${d.aulasConcluidas} aulas concluídas</strong> e <strong>${fmtNum(d.xpTotal)} XP</strong> nas costas, você ganhou um título que poucos conquistam: <strong>Aspirante a Perito</strong>.`,
      `Repara no soldado da sua insígnia. Ele está em posição de sentido, pronto. É exatamente aí que você está: você já aprendeu o bastante pra saber que perícia é sério, já dominou o bastante pra querer mais, e agora está se preparando pra assumir o posto de verdade.`,
      `> Aspirar já não basta pra você. Você está se preparando pra assumir o posto.`,
      `Sabe o que separa um aspirante de um perito de verdade? Continuar. Os que param aqui ficam com o conhecimento incompleto. Os que seguem, viram os profissionais que os tribunais chamam pelo nome.`,
      `Sua insígnia azul já está no perfil pra toda a comunidade ver. E o próximo nível, <strong>Decifrador de Cálculos</strong>, é onde os números que ainda assustam viram sua ferramenta favorita.`,
      `Cada passo que você deu até aqui valeu. E cada passo que você der a partir daqui vale ainda mais.`,
    ],
    botao: `Ver minha insígnia no perfil`,
    antes: `De olho na sua jornada,`,
  }),
  4: (d) => ({
    sobretitulo: `VOCÊ SUBIU DE NÍVEL, ${d.primeiroNome}!`,
    titulo: `Os números que assustavam<br>agora obedecem você.`,
    img: `${SITE_URL}/niveis/nivel-04-decifrador-de-calculos.png`,
    rotulo: `NÍVEL 4 DE 10`,
    nome: `Decifrador de Cálculos`,
    linhas: [`Aspirante a Perito → <strong>Decifrador de Cálculos</strong>`, `${fmtNum(d.xpTotal)} XP conquistados`],
    corpo: [
      `${d.primeiroNome}, sabe aquele cadeado na sua nova insígnia? Ele está aberto. E foi você quem abriu.`,
      `Há ${d.diasDeJornada} dias, cálculos periciais pareciam um cofre trancado. PJe-Calc, taxas de juros, atualização monetária, anatocismo... termos que faziam a maioria dos profissionais recuar. Você não recuou. Foram <strong>${d.aulasConcluidas} aulas concluídas</strong> e <strong>${fmtNum(d.xpTotal)} XP</strong> de pura insistência até chegar aqui.`,
      `E o resultado tem nome: <strong>Decifrador de Cálculos</strong>. Isso não é só um nível. É a prova de que você dominou a parte técnica que separa o perito competente do perito amador.`,
      `> Os cálculos que intimidavam viraram ferramenta na sua mão.`,
      `Olha pra trás um segundo: Explorador, Conhecedor, Aspirante, e agora Decifrador. Quatro níveis. Quatro versões de você, cada uma mais preparada que a anterior. A comunidade inteira vê essa evolução no seu perfil, e quem está começando a jornada te olha e pensa: "eu quero chegar lá".`,
      `E o que vem agora? O nível 5: <strong>Profissão Perito</strong>. É onde perícia deixa de ser estudo e vira profissão. O foguete da insígnia não é à toa. Você está prestes a decolar.`,
    ],
    botao: `Ver minha insígnia no perfil`,
    antes: `Cada nível mais orgulhoso,`,
  }),
  5: (d) => ({
    sobretitulo: `VOCÊ SUBIU DE NÍVEL, ${d.primeiroNome}!`,
    titulo: `Perícia deixou de ser estudo.<br>Agora é profissão.`,
    img: `${SITE_URL}/niveis/nivel-05-profissao-perito.png`,
    rotulo: `NÍVEL 5 DE 10 · METADE DA JORNADA`,
    nome: `Profissão Perito`,
    linhas: [`Decifrador de Cálculos → <strong>Profissão Perito</strong>`, `${fmtNum(d.xpTotal)} XP conquistados`],
    corpo: [
      `${d.primeiroNome}, você chegou no meio exato da jornada. E o foguete da sua nova insígnia não está ali por acaso.`,
      `Olha o que ficou pra trás: Explorador Novato, Conhecedor de Lógicas, Aspirante a Perito, Decifrador de Cálculos. Quatro níveis inteiros. <strong>${d.aulasConcluidas} aulas</strong>, <strong>${fmtNum(d.xpTotal)} XP</strong>, <strong>${d.diasDeJornada} dias</strong> de caminhada. Tudo isso pra chegar num título que muda o jogo: <strong>Profissão Perito</strong>.`,
      `A partir daqui, perícia não é mais algo que você estuda. É algo que você <strong>faz</strong>. O conhecimento que você acumulou já te coloca à frente da maioria. Os fundamentos estão sólidos. Os cálculos estão dominados. E agora começa a segunda metade: construir <strong>autoridade</strong>.`,
      `> A partir daqui, perícia deixou de ser estudo. Virou profissão.`,
      `Sabe o que é mais bonito? Muita gente começa essa jornada. Mas chegar até aqui, no nível 5, exige algo que não se ensina: constância. Você teve. E a comunidade inteira vê isso no seu perfil.`,
      `Os próximos 5 níveis são onde nascem os peritos que os tribunais chamam pelo nome. O próximo deles é <strong>Autoridade Pericial</strong>. Quando você falar, vai ter peso. E isso se constrói a partir de agora.`,
    ],
    botao: `Ver minha insígnia no perfil`,
    antes: `Na torcida pela segunda metade,`,
  }),
  6: (d) => ({
    sobretitulo: `VOCÊ SUBIU DE NÍVEL, ${d.primeiroNome}!`,
    titulo: `Quando você fala agora,<br>tem peso de autoridade.`,
    img: `${SITE_URL}/niveis/nivel-06-autoridade-pericial.png`,
    rotulo: `NÍVEL 6 DE 10`,
    nome: `Autoridade Pericial`,
    linhas: [`Profissão Perito → <strong>Autoridade Pericial</strong>`, `${fmtNum(d.xpTotal)} XP conquistados`],
    corpo: [
      `${d.primeiroNome}, repara nas estrelas da sua nova insígnia. Elas não são decoração. São patente.`,
      `Autoridade não se compra, não se pede e não se finge. Autoridade se constrói. E você construiu a sua em <strong>${d.diasDeJornada} dias</strong>, com <strong>${d.aulasConcluidas} aulas concluídas</strong> e <strong>${fmtNum(d.xpTotal)} XP</strong> de dedicação real. Cada aula, cada caso resolvido, cada avaliação vencida depositou um tijolo nessa fundação.`,
      `A prata da insígnia não é acaso. Prata é o tom da maturidade, da sobriedade, do profissional que não precisa gritar pra ser ouvido. É exatamente onde você chegou.`,
      `> Quando você fala, agora tem peso de autoridade. Isso não se compra. Se constrói.`,
      `Seis níveis. Mais da metade da jornada. Você já passou do ponto onde a maioria para. Quem chega até aqui não está "estudando perícia". Está vivendo ela.`,
      `E o que vem agora é onde poucos chegam: <strong>Desenvolvedor de Teses</strong>. É o nível onde você para de seguir teses e começa a criar as suas. As engrenagens da próxima insígnia dizem tudo.`,
    ],
    botao: `Ver minha insígnia no perfil`,
    antes: `Com respeito pela sua jornada,`,
  }),
  7: (d) => ({
    sobretitulo: `VOCÊ SUBIU DE NÍVEL, ${d.primeiroNome}!`,
    titulo: `Você não segue mais teses.<br>Agora você as cria.`,
    img: `${SITE_URL}/niveis/nivel-07-desenvolvedor-de-teses.png`,
    rotulo: `NÍVEL 7 DE 10`,
    nome: `Desenvolvedor de Teses`,
    linhas: [`Autoridade Pericial → <strong>Desenvolvedor de Teses</strong>`, `${fmtNum(d.xpTotal)} XP conquistados`],
    corpo: [
      `${d.primeiroNome}, olha pras engrenagens da sua nova insígnia. Elas giram juntas, encaixadas. Assim como o que aconteceu na sua cabeça.`,
      `Até o nível anterior, você absorvia conhecimento. Dominava cálculos, entendia lógicas, construía autoridade. Tudo isso continua valendo. Mas algo mudou: com <strong>${d.aulasConcluidas} aulas concluídas</strong> e <strong>${fmtNum(d.xpTotal)} XP</strong>, você cruzou a linha que separa quem consome teses de quem <strong>desenvolve</strong> as próprias.`,
      `Isso é raro. A maioria dos profissionais passa a carreira inteira repetindo o que aprendeu com outros. Você chegou no ponto em que consegue olhar pra um contrato, identificar o problema, montar a lógica e defender uma tese original. Com fundamento. Com segurança.`,
      `> Você não segue mais teses. Você as desenvolve.`,
      `São 7 níveis. ${d.diasDeJornada} dias de jornada. E cada dia desses está gravado no seu extrato de XP, visível pra toda a comunidade. Os alunos que estão começando olham pro seu perfil e veem a prova viva de que o caminho funciona.`,
      `Faltam três níveis. E o próximo é pra poucos: <strong>Estrategista Expert</strong>. É onde o perito para de resolver casos e começa a enxergar o jogo inteiro. O cérebro colorido da insígnia não é exagero. É o que acontece quando estratégia e experiência se encontram.`,
    ],
    botao: `Ver minha insígnia no perfil`,
    antes: `Admirado pela sua evolução,`,
  }),
  8: (d) => ({
    sobretitulo: `VOCÊ SUBIU DE NÍVEL, ${d.primeiroNome}!`,
    titulo: `Você não resolve casos.<br>Você enxerga o jogo inteiro.`,
    img: `${SITE_URL}/niveis/nivel-08-estrategista-expert.png`,
    rotulo: `NÍVEL 8 DE 10`,
    nome: `Estrategista Expert`,
    linhas: [`Desenvolvedor de Teses → <strong>Estrategista Expert</strong>`, `${fmtNum(d.xpTotal)} XP conquistados`],
    corpo: [
      `${d.primeiroNome}, olha pro cérebro colorido da sua nova insígnia. Cada cor ali representa uma área do conhecimento pericial que agora funciona junto na sua cabeça.`,
      `Cálculos, lógica contratual, teses defensivas, construção de laudos, análise de mérito. Tudo isso você já domina em separado. Mas o que faz um <strong>Estrategista Expert</strong> é diferente: é ver todas essas peças ao mesmo tempo e saber exatamente qual jogar em cada situação.`,
      `Com <strong>${d.aulasConcluidas} aulas</strong>, <strong>${fmtNum(d.xpTotal)} XP</strong> e <strong>${d.diasDeJornada} dias</strong> de jornada, você chegou num nível que a maioria dos peritos do Brasil nem sabe que existe. Não é exagero. Olha pra trás: oito níveis. Oito versões de você, cada uma mais completa que a anterior.`,
      `> Estratégia é ver o jogo inteiro antes dos outros. Bem-vindo a esse nível.`,
      `A comunidade inteira vê essa insígnia vermelha no seu perfil. E quem entende o sistema de níveis sabe: vermelho é raro. É o sinal de alguém que não brincou com a própria evolução.`,
      `Faltam dois níveis. Dois. O próximo é <strong>Mestre Supremo</strong>. O astronauta da insígnia laranja não está ali por acaso: é o nível de quem já saiu da órbita comum. E você está a um passo dele.`,
    ],
    botao: `Ver minha insígnia no perfil`,
    antes: `De pé aplaudindo daqui,`,
  }),
  9: (d) => ({
    sobretitulo: `VOCÊ SUBIU DE NÍVEL, ${d.primeiroNome}!`,
    titulo: `Quase ninguém chega<br>até aqui. Você chegou.`,
    img: `${SITE_URL}/niveis/nivel-09-mestre-supremo.png`,
    rotulo: `NÍVEL 9 DE 10 · PENÚLTIMO NÍVEL`,
    nome: `Mestre Supremo`,
    linhas: [`Estrategista Expert → <strong>Mestre Supremo</strong>`, `${fmtNum(d.xpTotal)} XP conquistados`],
    corpo: [
      `${d.primeiroNome}, o astronauta da sua nova insígnia saiu da órbita. E você também.`,
      `Nível 9 de 10. Pensa nisso por um segundo. <strong>${d.aulasConcluidas} aulas concluídas</strong>. <strong>${fmtNum(d.xpTotal)} XP conquistados</strong>. <strong>${d.diasDeJornada} dias</strong> desde que tudo começou com um Explorador Novato segurando um binóculo. Aquele profissional e você hoje são duas pessoas completamente diferentes.`,
      `Você dominou os cálculos. Desenvolveu teses próprias. Construiu autoridade. Enxergou o jogo inteiro como estrategista. E agora carrega um título que pouquíssimos profissionais da perícia no Brasil inteiro podem dizer que têm: <strong>Mestre Supremo</strong>.`,
      `> Quase ninguém chega até aqui. Você chegou.`,
      `A insígnia laranja no seu perfil é um farol pra toda a comunidade. Quando alguém no nível 1 ou 2 olha pra ela, vê a prova de que essa jornada leva a algum lugar de verdade. Você é essa prova.`,
      `E falta um. Só um. O nível <strong>Eu Sou a Lenda</strong>. A árvore dourada da última insígnia representa algo que você já sabe: raízes profundas, tronco firme, frutos que outros colhem. Só chega lá quem completa tudo. Cada aula. Cada avaliação. Cada desafio. Sem atalho.`,
      `Você está a um passo de se tornar Lenda.`,
    ],
    botao: `Ver minha insígnia no perfil`,
    antes: `Honrado por acompanhar essa jornada,`,
  }),
  10: (d) => ({
    sobretitulo: `NÍVEL 10 DE 10`,
    titulo: `Eu Sou a Lenda.<br>E agora, ${d.primeiroNome}, essa frase é sua.`,
    img: `${SITE_URL}/niveis/nivel-10-eu-sou-a-lenda.png`,
    rotulo: `JORNADA COMPLETA`,
    nome: `Eu Sou a Lenda`,
    linhas: [`Mestre Supremo → <strong>Eu Sou a Lenda</strong>`, `${fmtNum(d.xpTotal)} XP · Tudo concluído`],
    corpo: [
      `${d.primeiroNome}, lembra do primeiro email que você recebeu da Peritos Academy?`,
      `Ele dizia: <em>"Todo Explorador Novato de hoje carrega uma Lenda esperando o próximo passo."</em>`,
      `Hoje essa frase se cumpriu.`,
      `> Você concluiu tudo. Cada aula. Cada avaliação. Cada desafio. Sem atalho, sem exceção. Você é a Lenda.`,
      `Olha o caminho que você percorreu: Explorador Novato, Conhecedor de Lógicas, Aspirante a Perito, Decifrador de Cálculos, Profissão Perito, Autoridade Pericial, Desenvolvedor de Teses, Estrategista Expert, Mestre Supremo. Nove versões de você, uma atrás da outra, cada uma mais completa que a anterior. Até chegar aqui.`,
      `Foram <strong>${d.aulasConcluidas} aulas concluídas</strong>. <strong>${d.avaliacoesAprovadas ?? 0} avaliações aprovadas</strong>. <strong>${d.desafiosEntregues ?? 0} desafios entregues</strong>. <strong>${fmtNum(d.xpTotal)} XP conquistados</strong> em <strong>${d.diasDeJornada} dias</strong>. Cada um desses números tem uma história por trás. Uma noite que você estudou em vez de descansar. Um fim de semana que você escolheu evoluir. Um dia difícil em que você abriu a plataforma mesmo assim.`,
      `A árvore dourada da sua insígnia final não é qualquer árvore. Ela tem raízes. Raízes que você plantou aula por aula. O tronco é o conhecimento que ninguém tira de você. E os frutos? Os frutos são os laudos que você vai assinar, os processos que vai conduzir, os clientes que vão te escolher, a carreira que você construiu do zero até o topo.`,
      `> Uma única regra levava até este nível: concluir tudo. Você concluiu. Você é a Lenda.`,
      `A partir de agora, todo aluno que entrar na Peritos Academy e olhar pro ranking vai ver o seu nome lá em cima. Vai ver a insígnia dourada. E vai pensar: "eu quero chegar lá". Você é a prova viva de que essa jornada leva a algum lugar. Não por talento. Não por sorte. Por constância.`,
      `Esse email é diferente dos outros nove que você recebeu. Porque ele não termina com "o próximo nível te espera". Não existe próximo nível. Você chegou ao topo. O que existe agora é o profissional completo que saiu do outro lado dessa jornada.`,
      `E esse profissional é você, ${d.primeiroNome}.`,
    ],
    botao: `Ver minha insígnia dourada`,
    antes: `Com todo o respeito que essa conquista merece,`,
  }),
};

export function emailNivelUp(ordem: number, dados: DadosNivelUp): { assunto: string; html: string } | null {
  const montar = NIVEIS[ordem];
  if (!montar) return null;
  const n = montar(dados);
  const d = dados;

  // "Faltam X XP pro próximo nível": dado real de gamificacao_niveis (via
  // gam_status_proximo_nivel), nunca hardcoded. O nível 10 não tem próximo.
  const linhas = [...n.linhas];
  if (ordem < 10 && d.proximoNivelNome && d.proximoNivelFaltamXp !== undefined && d.proximoNivelFaltamXp > 0) {
    linhas.push(`Faltam <strong>${fmtNum(d.proximoNivelFaltamXp)} XP</strong> para ${d.proximoNivelNome}`);
  }

  const corpo = [
    abertura(n.sobretitulo, n.titulo),
    insignia({ img: n.img, rotulo: n.rotulo, nome: n.nome, linha: linhas.join("<br>") }),
    ...n.corpo.map((t) => (t.startsWith("> ") ? destaque(t.slice(2)) : p(t))),
    botao(n.botao, `${SITE_URL}/perfil`),
    // A subida veio junto de uma conclusão de curso no mesmo evento: menciona
    // o curso no corpo (regra de "mencionar o outro"), logo antes da assinatura.
    d.cursoConcluidoJunto
      ? p(`E de quebra, nesse mesmo embalo você concluiu o curso <strong>${d.cursoConcluidoJunto}</strong>. Dia duplo de conquista.`)
      : "",
    assinatura("Marlos Henrique", n.antes),
  ]
    .filter(Boolean)
    .join("\n");

  const html = casca({
    titulo: "Você subiu de nível!",
    preheader: n.titulo.replace(/<br>/g, " "),
    corpo,
    motivo: "Você recebeu este email porque faz parte da Peritos Academy.",
  });

  return { assunto: ASSUNTOS[ordem], html };
}
