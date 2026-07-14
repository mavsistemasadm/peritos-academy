// lib/email/templates/nivelUp.ts
// Emails de subida de nível (ordens 2-10) — HTML copiado literalmente dos
// 9 templates aprovados em docs/email-templates/email_nivel_0N_*.html, só
// com os placeholders dinâmicos ({PRIMEIRO_NOME}, {XP_TOTAL} etc)
// substituídos por interpolação real. Nenhuma reconstrução por fórmula de
// cor: cada nível guarda literalmente as cores do arquivo aprovado
// correspondente, porque a cor do botão CTA não segue um padrão único
// entre níveis (varia entre "Destaque" e "Escura" da tabela da missão
// dependendo do nível — conferido campo a campo contra o HTML aprovado).

export type DadosNivelUp = {
  primeiroNome: string;
  xpTotal: number;
  diasDeJornada: number;
  aulasConcluidas: number;
  avaliacoesAprovadas?: number; // só usado no nível 10
  desafiosEntregues?: number; // só usado no nível 10
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

function shell(headerBg: string, corpo: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Você subiu de nível!</title>
</head>
<body style="margin:0;padding:0;">
<div style="background:#eef0f4;padding:32px 16px;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 2px 14px rgba(6,30,53,0.10);">

    <!-- HEADER -->
    <div style="${headerBg}">
${corpo}
  </div>

  <div style="max-width:600px;margin:0 auto;text-align:center;padding:22px 16px 6px;">
    <p style="font-size:12px;color:#9aa1b0;margin:0 0 6px;">Peritos Academy · A jornada completa da perícia judicial</p>
    <p style="font-size:11px;color:#b4bac6;margin:0;">Você recebeu este email porque faz parte da Peritos Academy.<br/>Preferências de email · Cancelar inscrição</p>
  </div>
</div>
</body>
</html>`;
}

function nivel2(d: DadosNivelUp): string {
  return shell(
    "background:linear-gradient(150deg,#FF2D87 0%,#D91A6E 25%,#B0125C 50%,#0b2a47 78%,#061e35 100%);padding:38px 40px 34px;",
    `      <p style="margin:0 0 26px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.5);">VOCÊ SUBIU DE NÍVEL, ${d.primeiroNome}!</p>
      <p style="margin:0 0 22px;font-size:26px;font-weight:800;line-height:36px;color:#ffffff;letter-spacing:-0.5px;">As peças começaram<br>a se encaixar.</p>
      <div style="width:52px;height:3px;background:linear-gradient(90deg,#FF2D87,rgba(255,45,135,0));border-radius:2px;"></div>
    </div>

    <div style="padding:40px 40px 0;text-align:center;">
      <div style="width:132px;height:132px;margin:0 auto 18px;border-radius:50%;background:#fdeef5;border:2px solid #FF2D87;text-align:center;line-height:128px;overflow:hidden;">
        <img src="https://peritos-academy.vercel.app/niveis/nivel-02-conhecedor-de-logicas.png" alt="" width="92" style="vertical-align:middle;" />
      </div>
      <p style="font-size:11px;letter-spacing:3px;color:#D91A6E;font-weight:700;margin:0 0 8px;">NÍVEL 2 DE 10 · SUA PRIMEIRA SUBIDA</p>
      <p style="font-size:22px;font-weight:800;color:#083952;margin:0 0 12px;letter-spacing:-0.3px;">Conhecedor de Lógicas</p>
      <p style="font-size:13px;color:#888880;margin:0 0 4px;">Explorador Novato → <strong style="color:#B0125C;">Conhecedor de Lógicas</strong></p>
      <p style="font-size:13px;color:#888880;margin:0;">${fmtNum(d.xpTotal)} XP conquistados</p>
    </div>

    <div style="padding:34px 40px 16px;">

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">${d.primeiroNome}, para um momento e olha o que você acabou de fazer.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Há ${d.diasDeJornada} dias você entrou na Peritos Academy como Explorador Novato, olhando esse mundo da perícia de fora, com o binóculo na mão. Desde então, foram <strong>${d.aulasConcluidas} aulas concluídas</strong> e <strong>${fmtNum(d.xpTotal)} XP conquistados</strong>. Nenhum ponto desses caiu do céu: cada um foi uma escolha sua de continuar.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">O quebra-cabeça da sua nova insígnia conta o que aconteceu nesse caminho: contratos, cálculos, laudos... o que parecia um emaranhado começou a revelar padrão pra você. Você começou a enxergar a <strong>lógica</strong>. E quem aprende a enxergar a lógica nunca mais desaprende.</p>

      <div style="margin:30px 0;background:#fdeef5;border-left:4px solid #FF2D87;border-radius:0 12px 12px 0;padding:20px 24px;">
        <p style="margin:0;font-size:17px;line-height:30px;color:#083952;font-style:italic;font-weight:700;">Você começou a enxergar o que a maioria não vê: a lógica por trás dos números.</p>
      </div>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Essa foi sua <strong>primeira subida de nível</strong>, e ela prova algo importante: o método funciona. Aula por aula, caso por caso, você está virando outro profissional. A insígnia rosa já está brilhando no seu perfil, visível pra toda a comunidade. Gente do Brasil inteiro que está na mesma estrada e sabe exatamente o que essa conquista custou.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">E o melhor? O que vem pela frente é ainda maior. O próximo nível já tem nome: <strong>Aspirante a Perito</strong>. E tem um posto esperando por você nele.</p>

      <div style="margin:8px 0 36px;text-align:center;">
        <a href="https://peritos-academy.vercel.app/perfil" style="display:inline-block;padding:16px 32px;background:#FF2D87;border-radius:10px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:.01em;">Ver minha insígnia no perfil</a>
      </div>

      <div style="margin-bottom:36px;border-left:3px solid #FF2D87;padding-left:16px;">
        <p style="margin:0 0 2px;font-size:15px;line-height:22px;color:#888880;">Comemorando com você,</p>
        <p style="margin:0;font-size:19px;font-weight:800;color:#083952;letter-spacing:-0.3px;">Marlos Henrique</p>
      </div>

    </div>`
  );
}

function nivel3(d: DadosNivelUp): string {
  return shell(
    "background:linear-gradient(150deg,#5B4BE0 0%,#4257CE 25%,#3138A8 50%,#0b2a47 78%,#061e35 100%);padding:38px 40px 34px;",
    `      <p style="margin:0 0 26px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.5);">VOCÊ SUBIU DE NÍVEL, ${d.primeiroNome}!</p>
      <p style="margin:0 0 22px;font-size:26px;font-weight:800;line-height:36px;color:#ffffff;letter-spacing:-0.5px;">Aspirar já não basta.<br>Você está se preparando.</p>
      <div style="width:52px;height:3px;background:linear-gradient(90deg,#5B4BE0,rgba(91,75,224,0));border-radius:2px;"></div>
    </div>

    <div style="padding:40px 40px 0;text-align:center;">
      <div style="width:132px;height:132px;margin:0 auto 18px;border-radius:50%;background:#efedfc;border:2px solid #5B4BE0;text-align:center;line-height:128px;overflow:hidden;">
        <img src="https://peritos-academy.vercel.app/niveis/nivel-03-aspirante-a-perito.png" alt="" width="92" style="vertical-align:middle;" />
      </div>
      <p style="font-size:11px;letter-spacing:3px;color:#4257CE;font-weight:700;margin:0 0 8px;">NÍVEL 3 DE 10</p>
      <p style="font-size:22px;font-weight:800;color:#083952;margin:0 0 12px;letter-spacing:-0.3px;">Aspirante a Perito</p>
      <p style="font-size:13px;color:#888880;margin:0 0 4px;">Conhecedor de Lógicas → <strong style="color:#3138A8;">Aspirante a Perito</strong></p>
      <p style="font-size:13px;color:#888880;margin:0;">${fmtNum(d.xpTotal)} XP conquistados</p>
    </div>

    <div style="padding:34px 40px 16px;">

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">${d.primeiroNome}, olha que bonito o caminho que você está construindo.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Há ${d.diasDeJornada} dias você era um Explorador Novato. Depois virou Conhecedor de Lógicas. E agora, com <strong>${d.aulasConcluidas} aulas concluídas</strong> e <strong>${fmtNum(d.xpTotal)} XP</strong> nas costas, você ganhou um título que poucos conquistam: <strong>Aspirante a Perito</strong>.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Repara no soldado da sua insígnia. Ele está em posição de sentido, pronto. É exatamente aí que você está: você já aprendeu o bastante pra saber que perícia é sério, já dominou o bastante pra querer mais, e agora está se preparando pra assumir o posto de verdade.</p>

      <div style="margin:30px 0;background:#efedfc;border-left:4px solid #5B4BE0;border-radius:0 12px 12px 0;padding:20px 24px;">
        <p style="margin:0;font-size:17px;line-height:30px;color:#083952;font-style:italic;font-weight:700;">Aspirar já não basta pra você. Você está se preparando pra assumir o posto.</p>
      </div>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Sabe o que separa um aspirante de um perito de verdade? Continuar. Os que param aqui ficam com o conhecimento incompleto. Os que seguem, viram os profissionais que os tribunais chamam pelo nome.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Sua insígnia azul já está no perfil pra toda a comunidade ver. E o próximo nível, <strong>Decifrador de Cálculos</strong>, é onde os números que ainda assustam viram sua ferramenta favorita.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Cada passo que você deu até aqui valeu. E cada passo que você der a partir daqui vale ainda mais.</p>

      <div style="margin:8px 0 36px;text-align:center;">
        <a href="https://peritos-academy.vercel.app/perfil" style="display:inline-block;padding:16px 32px;background:#5B4BE0;border-radius:10px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:.01em;">Ver minha insígnia no perfil</a>
      </div>

      <div style="margin-bottom:36px;border-left:3px solid #5B4BE0;padding-left:16px;">
        <p style="margin:0 0 2px;font-size:15px;line-height:22px;color:#888880;">De olho na sua jornada,</p>
        <p style="margin:0;font-size:19px;font-weight:800;color:#083952;letter-spacing:-0.3px;">Marlos Henrique</p>
      </div>

    </div>`
  );
}

function nivel4(d: DadosNivelUp): string {
  return shell(
    "background:linear-gradient(150deg,#A8D22B 0%,#4F9E5E 25%,#1B5FB8 50%,#0b2a47 78%,#061e35 100%);padding:38px 40px 34px;",
    `      <p style="margin:0 0 26px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.5);">VOCÊ SUBIU DE NÍVEL, ${d.primeiroNome}!</p>
      <p style="margin:0 0 22px;font-size:26px;font-weight:800;line-height:36px;color:#ffffff;letter-spacing:-0.5px;">Os números que assustavam<br>agora obedecem você.</p>
      <div style="width:52px;height:3px;background:linear-gradient(90deg,#A8D22B,rgba(168,210,43,0));border-radius:2px;"></div>
    </div>

    <div style="padding:40px 40px 0;text-align:center;">
      <div style="width:132px;height:132px;margin:0 auto 18px;border-radius:50%;background:#f3f9e9;border:2px solid #7CB92C;text-align:center;line-height:128px;overflow:hidden;">
        <img src="https://peritos-academy.vercel.app/niveis/nivel-04-decifrador-de-calculos.png" alt="" width="92" style="vertical-align:middle;" />
      </div>
      <p style="font-size:11px;letter-spacing:3px;color:#4F9E5E;font-weight:700;margin:0 0 8px;">NÍVEL 4 DE 10</p>
      <p style="font-size:22px;font-weight:800;color:#083952;margin:0 0 12px;letter-spacing:-0.3px;">Decifrador de Cálculos</p>
      <p style="font-size:13px;color:#888880;margin:0 0 4px;">Aspirante a Perito → <strong style="color:#1B5FB8;">Decifrador de Cálculos</strong></p>
      <p style="font-size:13px;color:#888880;margin:0;">${fmtNum(d.xpTotal)} XP conquistados</p>
    </div>

    <div style="padding:34px 40px 16px;">

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">${d.primeiroNome}, sabe aquele cadeado na sua nova insígnia? Ele está aberto. E foi você quem abriu.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Há ${d.diasDeJornada} dias, cálculos periciais pareciam um cofre trancado. PJe-Calc, taxas de juros, atualização monetária, anatocismo... termos que faziam a maioria dos profissionais recuar. Você não recuou. Foram <strong>${d.aulasConcluidas} aulas concluídas</strong> e <strong>${fmtNum(d.xpTotal)} XP</strong> de pura insistência até chegar aqui.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">E o resultado tem nome: <strong>Decifrador de Cálculos</strong>. Isso não é só um nível. É a prova de que você dominou a parte técnica que separa o perito competente do perito amador.</p>

      <div style="margin:30px 0;background:#f3f9e9;border-left:4px solid #7CB92C;border-radius:0 12px 12px 0;padding:20px 24px;">
        <p style="margin:0;font-size:17px;line-height:30px;color:#083952;font-style:italic;font-weight:700;">Os cálculos que intimidavam viraram ferramenta na sua mão.</p>
      </div>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Olha pra trás um segundo: Explorador, Conhecedor, Aspirante, e agora Decifrador. Quatro níveis. Quatro versões de você, cada uma mais preparada que a anterior. A comunidade inteira vê essa evolução no seu perfil, e quem está começando a jornada te olha e pensa: "eu quero chegar lá".</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">E o que vem agora? O nível 5: <strong>Profissão Perito</strong>. É onde perícia deixa de ser estudo e vira profissão. O foguete da insígnia não é à toa. Você está prestes a decolar.</p>

      <div style="margin:8px 0 36px;text-align:center;">
        <a href="https://peritos-academy.vercel.app/perfil" style="display:inline-block;padding:16px 32px;background:#1B5FB8;border-radius:10px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:.01em;">Ver minha insígnia no perfil</a>
      </div>

      <div style="margin-bottom:36px;border-left:3px solid #7CB92C;padding-left:16px;">
        <p style="margin:0 0 2px;font-size:15px;line-height:22px;color:#888880;">Cada nível mais orgulhoso,</p>
        <p style="margin:0;font-size:19px;font-weight:800;color:#083952;letter-spacing:-0.3px;">Marlos Henrique</p>
      </div>

    </div>`
  );
}

function nivel5(d: DadosNivelUp): string {
  return shell(
    "background:linear-gradient(150deg,#9B4DE0 0%,#7A38C4 25%,#5C2C9E 50%,#0b2a47 78%,#061e35 100%);padding:38px 40px 34px;",
    `      <p style="margin:0 0 26px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.5);">VOCÊ SUBIU DE NÍVEL, ${d.primeiroNome}!</p>
      <p style="margin:0 0 22px;font-size:26px;font-weight:800;line-height:36px;color:#ffffff;letter-spacing:-0.5px;">Perícia deixou de ser estudo.<br>Agora é profissão.</p>
      <div style="width:52px;height:3px;background:linear-gradient(90deg,#9B4DE0,rgba(155,77,224,0));border-radius:2px;"></div>
    </div>

    <div style="padding:40px 40px 0;text-align:center;">
      <div style="width:132px;height:132px;margin:0 auto 18px;border-radius:50%;background:#f5eefc;border:2px solid #9B4DE0;text-align:center;line-height:128px;overflow:hidden;">
        <img src="https://peritos-academy.vercel.app/niveis/nivel-05-profissao-perito.png" alt="" width="92" style="vertical-align:middle;" />
      </div>
      <p style="font-size:11px;letter-spacing:3px;color:#7A38C4;font-weight:700;margin:0 0 8px;">NÍVEL 5 DE 10 · METADE DA JORNADA</p>
      <p style="font-size:22px;font-weight:800;color:#083952;margin:0 0 12px;letter-spacing:-0.3px;">Profissão Perito</p>
      <p style="font-size:13px;color:#888880;margin:0 0 4px;">Decifrador de Cálculos → <strong style="color:#5C2C9E;">Profissão Perito</strong></p>
      <p style="font-size:13px;color:#888880;margin:0;">${fmtNum(d.xpTotal)} XP conquistados</p>
    </div>

    <div style="padding:34px 40px 16px;">

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">${d.primeiroNome}, você chegou no meio exato da jornada. E o foguete da sua nova insígnia não está ali por acaso.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Olha o que ficou pra trás: Explorador Novato, Conhecedor de Lógicas, Aspirante a Perito, Decifrador de Cálculos. Quatro níveis inteiros. <strong>${d.aulasConcluidas} aulas</strong>, <strong>${fmtNum(d.xpTotal)} XP</strong>, <strong>${d.diasDeJornada} dias</strong> de caminhada. Tudo isso pra chegar num título que muda o jogo: <strong>Profissão Perito</strong>.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">A partir daqui, perícia não é mais algo que você estuda. É algo que você <strong>faz</strong>. O conhecimento que você acumulou já te coloca à frente da maioria. Os fundamentos estão sólidos. Os cálculos estão dominados. E agora começa a segunda metade: construir <strong>autoridade</strong>.</p>

      <div style="margin:30px 0;background:#f5eefc;border-left:4px solid #9B4DE0;border-radius:0 12px 12px 0;padding:20px 24px;">
        <p style="margin:0;font-size:17px;line-height:30px;color:#083952;font-style:italic;font-weight:700;">A partir daqui, perícia deixou de ser estudo. Virou profissão.</p>
      </div>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Sabe o que é mais bonito? Muita gente começa essa jornada. Mas chegar até aqui, no nível 5, exige algo que não se ensina: constância. Você teve. E a comunidade inteira vê isso no seu perfil.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Os próximos 5 níveis são onde nascem os peritos que os tribunais chamam pelo nome. O próximo deles é <strong>Autoridade Pericial</strong>. Quando você falar, vai ter peso. E isso se constrói a partir de agora.</p>

      <div style="margin:8px 0 36px;text-align:center;">
        <a href="https://peritos-academy.vercel.app/perfil" style="display:inline-block;padding:16px 32px;background:#9B4DE0;border-radius:10px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:.01em;">Ver minha insígnia no perfil</a>
      </div>

      <div style="margin-bottom:36px;border-left:3px solid #9B4DE0;padding-left:16px;">
        <p style="margin:0 0 2px;font-size:15px;line-height:22px;color:#888880;">Na torcida pela segunda metade,</p>
        <p style="margin:0;font-size:19px;font-weight:800;color:#083952;letter-spacing:-0.3px;">Marlos Henrique</p>
      </div>

    </div>`
  );
}

function nivel6(d: DadosNivelUp): string {
  return shell(
    "background:linear-gradient(150deg,#C0C4CC 0%,#8B909B 25%,#5A5F6A 50%,#0b2a47 78%,#061e35 100%);padding:38px 40px 34px;",
    `      <p style="margin:0 0 26px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.5);">VOCÊ SUBIU DE NÍVEL, ${d.primeiroNome}!</p>
      <p style="margin:0 0 22px;font-size:26px;font-weight:800;line-height:36px;color:#ffffff;letter-spacing:-0.5px;">Quando você fala agora,<br>tem peso de autoridade.</p>
      <div style="width:52px;height:3px;background:linear-gradient(90deg,#C0C4CC,rgba(192,196,204,0));border-radius:2px;"></div>
    </div>

    <div style="padding:40px 40px 0;text-align:center;">
      <div style="width:132px;height:132px;margin:0 auto 18px;border-radius:50%;background:#f2f3f5;border:2px solid #8B909B;text-align:center;line-height:128px;overflow:hidden;">
        <img src="https://peritos-academy.vercel.app/niveis/nivel-06-autoridade-pericial.png" alt="" width="92" style="vertical-align:middle;" />
      </div>
      <p style="font-size:11px;letter-spacing:3px;color:#5A5F6A;font-weight:700;margin:0 0 8px;">NÍVEL 6 DE 10</p>
      <p style="font-size:22px;font-weight:800;color:#083952;margin:0 0 12px;letter-spacing:-0.3px;">Autoridade Pericial</p>
      <p style="font-size:13px;color:#888880;margin:0 0 4px;">Profissão Perito → <strong style="color:#5A5F6A;">Autoridade Pericial</strong></p>
      <p style="font-size:13px;color:#888880;margin:0;">${fmtNum(d.xpTotal)} XP conquistados</p>
    </div>

    <div style="padding:34px 40px 16px;">

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">${d.primeiroNome}, repara nas estrelas da sua nova insígnia. Elas não são decoração. São patente.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Autoridade não se compra, não se pede e não se finge. Autoridade se constrói. E você construiu a sua em <strong>${d.diasDeJornada} dias</strong>, com <strong>${d.aulasConcluidas} aulas concluídas</strong> e <strong>${fmtNum(d.xpTotal)} XP</strong> de dedicação real. Cada aula, cada caso resolvido, cada avaliação vencida depositou um tijolo nessa fundação.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">A prata da insígnia não é acaso. Prata é o tom da maturidade, da sobriedade, do profissional que não precisa gritar pra ser ouvido. É exatamente onde você chegou.</p>

      <div style="margin:30px 0;background:#f2f3f5;border-left:4px solid #8B909B;border-radius:0 12px 12px 0;padding:20px 24px;">
        <p style="margin:0;font-size:17px;line-height:30px;color:#083952;font-style:italic;font-weight:700;">Quando você fala, agora tem peso de autoridade. Isso não se compra. Se constrói.</p>
      </div>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Seis níveis. Mais da metade da jornada. Você já passou do ponto onde a maioria para. Quem chega até aqui não está "estudando perícia". Está vivendo ela.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">E o que vem agora é onde poucos chegam: <strong>Desenvolvedor de Teses</strong>. É o nível onde você para de seguir teses e começa a criar as suas. As engrenagens da próxima insígnia dizem tudo.</p>

      <div style="margin:8px 0 36px;text-align:center;">
        <a href="https://peritos-academy.vercel.app/perfil" style="display:inline-block;padding:16px 32px;background:#083952;border:2px solid #8B909B;border-radius:10px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:.01em;">Ver minha insígnia no perfil</a>
      </div>

      <div style="margin-bottom:36px;border-left:3px solid #8B909B;padding-left:16px;">
        <p style="margin:0 0 2px;font-size:15px;line-height:22px;color:#888880;">Com respeito pela sua jornada,</p>
        <p style="margin:0;font-size:19px;font-weight:800;color:#083952;letter-spacing:-0.3px;">Marlos Henrique</p>
      </div>

    </div>`
  );
}

function nivel7(d: DadosNivelUp): string {
  return shell(
    "background:linear-gradient(150deg,#2ECC40 0%,#1FA332 25%,#117A2E 50%,#0b2a47 78%,#061e35 100%);padding:38px 40px 34px;",
    `      <p style="margin:0 0 26px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.5);">VOCÊ SUBIU DE NÍVEL, ${d.primeiroNome}!</p>
      <p style="margin:0 0 22px;font-size:26px;font-weight:800;line-height:36px;color:#ffffff;letter-spacing:-0.5px;">Você não segue mais teses.<br>Agora você as cria.</p>
      <div style="width:52px;height:3px;background:linear-gradient(90deg,#2ECC40,rgba(46,204,64,0));border-radius:2px;"></div>
    </div>

    <div style="padding:40px 40px 0;text-align:center;">
      <div style="width:132px;height:132px;margin:0 auto 18px;border-radius:50%;background:#ebf9ee;border:2px solid #2ECC40;text-align:center;line-height:128px;overflow:hidden;">
        <img src="https://peritos-academy.vercel.app/niveis/nivel-07-desenvolvedor-de-teses.png" alt="" width="92" style="vertical-align:middle;" />
      </div>
      <p style="font-size:11px;letter-spacing:3px;color:#1FA332;font-weight:700;margin:0 0 8px;">NÍVEL 7 DE 10</p>
      <p style="font-size:22px;font-weight:800;color:#083952;margin:0 0 12px;letter-spacing:-0.3px;">Desenvolvedor de Teses</p>
      <p style="font-size:13px;color:#888880;margin:0 0 4px;">Autoridade Pericial → <strong style="color:#117A2E;">Desenvolvedor de Teses</strong></p>
      <p style="font-size:13px;color:#888880;margin:0;">${fmtNum(d.xpTotal)} XP conquistados</p>
    </div>

    <div style="padding:34px 40px 16px;">

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">${d.primeiroNome}, olha pras engrenagens da sua nova insígnia. Elas giram juntas, encaixadas. Assim como o que aconteceu na sua cabeça.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Até o nível anterior, você absorvia conhecimento. Dominava cálculos, entendia lógicas, construía autoridade. Tudo isso continua valendo. Mas algo mudou: com <strong>${d.aulasConcluidas} aulas concluídas</strong> e <strong>${fmtNum(d.xpTotal)} XP</strong>, você cruzou a linha que separa quem consome teses de quem <strong>desenvolve</strong> as próprias.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Isso é raro. A maioria dos profissionais passa a carreira inteira repetindo o que aprendeu com outros. Você chegou no ponto em que consegue olhar pra um contrato, identificar o problema, montar a lógica e defender uma tese original. Com fundamento. Com segurança.</p>

      <div style="margin:30px 0;background:#ebf9ee;border-left:4px solid #2ECC40;border-radius:0 12px 12px 0;padding:20px 24px;">
        <p style="margin:0;font-size:17px;line-height:30px;color:#083952;font-style:italic;font-weight:700;">Você não segue mais teses. Você as desenvolve.</p>
      </div>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">São 7 níveis. ${d.diasDeJornada} dias de jornada. E cada dia desses está gravado no seu extrato de XP, visível pra toda a comunidade. Os alunos que estão começando olham pro seu perfil e veem a prova viva de que o caminho funciona.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Faltam três níveis. E o próximo é pra poucos: <strong>Estrategista Expert</strong>. É onde o perito para de resolver casos e começa a enxergar o jogo inteiro. O cérebro colorido da insígnia não é exagero. É o que acontece quando estratégia e experiência se encontram.</p>

      <div style="margin:8px 0 36px;text-align:center;">
        <a href="https://peritos-academy.vercel.app/perfil" style="display:inline-block;padding:16px 32px;background:#117A2E;border-radius:10px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:.01em;">Ver minha insígnia no perfil</a>
      </div>

      <div style="margin-bottom:36px;border-left:3px solid #2ECC40;padding-left:16px;">
        <p style="margin:0 0 2px;font-size:15px;line-height:22px;color:#888880;">Admirado pela sua evolução,</p>
        <p style="margin:0;font-size:19px;font-weight:800;color:#083952;letter-spacing:-0.3px;">Marlos Henrique</p>
      </div>

    </div>`
  );
}

function nivel8(d: DadosNivelUp): string {
  return shell(
    "background:linear-gradient(150deg,#F03434 0%,#C71F2B 25%,#A31220 50%,#0b2a47 78%,#061e35 100%);padding:38px 40px 34px;",
    `      <p style="margin:0 0 26px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.5);">VOCÊ SUBIU DE NÍVEL, ${d.primeiroNome}!</p>
      <p style="margin:0 0 22px;font-size:26px;font-weight:800;line-height:36px;color:#ffffff;letter-spacing:-0.5px;">Você não resolve casos.<br>Você enxerga o jogo inteiro.</p>
      <div style="width:52px;height:3px;background:linear-gradient(90deg,#F03434,rgba(240,52,52,0));border-radius:2px;"></div>
    </div>

    <div style="padding:40px 40px 0;text-align:center;">
      <div style="width:132px;height:132px;margin:0 auto 18px;border-radius:50%;background:#fdeeee;border:2px solid #E03131;text-align:center;line-height:128px;overflow:hidden;">
        <img src="https://peritos-academy.vercel.app/niveis/nivel-08-estrategista-expert.png" alt="" width="92" style="vertical-align:middle;" />
      </div>
      <p style="font-size:11px;letter-spacing:3px;color:#C71F2B;font-weight:700;margin:0 0 8px;">NÍVEL 8 DE 10</p>
      <p style="font-size:22px;font-weight:800;color:#083952;margin:0 0 12px;letter-spacing:-0.3px;">Estrategista Expert</p>
      <p style="font-size:13px;color:#888880;margin:0 0 4px;">Desenvolvedor de Teses → <strong style="color:#A31220;">Estrategista Expert</strong></p>
      <p style="font-size:13px;color:#888880;margin:0;">${fmtNum(d.xpTotal)} XP conquistados</p>
    </div>

    <div style="padding:34px 40px 16px;">

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">${d.primeiroNome}, olha pro cérebro colorido da sua nova insígnia. Cada cor ali representa uma área do conhecimento pericial que agora funciona junto na sua cabeça.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Cálculos, lógica contratual, teses defensivas, construção de laudos, análise de mérito. Tudo isso você já domina em separado. Mas o que faz um <strong>Estrategista Expert</strong> é diferente: é ver todas essas peças ao mesmo tempo e saber exatamente qual jogar em cada situação.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Com <strong>${d.aulasConcluidas} aulas</strong>, <strong>${fmtNum(d.xpTotal)} XP</strong> e <strong>${d.diasDeJornada} dias</strong> de jornada, você chegou num nível que a maioria dos peritos do Brasil nem sabe que existe. Não é exagero. Olha pra trás: oito níveis. Oito versões de você, cada uma mais completa que a anterior.</p>

      <div style="margin:30px 0;background:#fdeeee;border-left:4px solid #E03131;border-radius:0 12px 12px 0;padding:20px 24px;">
        <p style="margin:0;font-size:17px;line-height:30px;color:#083952;font-style:italic;font-weight:700;">Estratégia é ver o jogo inteiro antes dos outros. Bem-vindo a esse nível.</p>
      </div>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">A comunidade inteira vê essa insígnia vermelha no seu perfil. E quem entende o sistema de níveis sabe: vermelho é raro. É o sinal de alguém que não brincou com a própria evolução.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Faltam dois níveis. Dois. O próximo é <strong>Mestre Supremo</strong>. O astronauta da insígnia laranja não está ali por acaso: é o nível de quem já saiu da órbita comum. E você está a um passo dele.</p>

      <div style="margin:8px 0 36px;text-align:center;">
        <a href="https://peritos-academy.vercel.app/perfil" style="display:inline-block;padding:16px 32px;background:#A31220;border-radius:10px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:.01em;">Ver minha insígnia no perfil</a>
      </div>

      <div style="margin-bottom:36px;border-left:3px solid #E03131;padding-left:16px;">
        <p style="margin:0 0 2px;font-size:15px;line-height:22px;color:#888880;">De pé aplaudindo daqui,</p>
        <p style="margin:0;font-size:19px;font-weight:800;color:#083952;letter-spacing:-0.3px;">Marlos Henrique</p>
      </div>

    </div>`
  );
}

function nivel9(d: DadosNivelUp): string {
  return shell(
    "background:linear-gradient(150deg,#F5A623 0%,#E8851A 25%,#D96A0B 50%,#0b2a47 78%,#061e35 100%);padding:38px 40px 34px;",
    `      <p style="margin:0 0 26px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.5);">VOCÊ SUBIU DE NÍVEL, ${d.primeiroNome}!</p>
      <p style="margin:0 0 22px;font-size:26px;font-weight:800;line-height:36px;color:#ffffff;letter-spacing:-0.5px;">Quase ninguém chega<br>até aqui. Você chegou.</p>
      <div style="width:52px;height:3px;background:linear-gradient(90deg,#F5A623,rgba(245,166,35,0));border-radius:2px;"></div>
    </div>

    <div style="padding:40px 40px 0;text-align:center;">
      <div style="width:132px;height:132px;margin:0 auto 18px;border-radius:50%;background:#fef4e8;border:2px solid #F08C1B;text-align:center;line-height:128px;overflow:hidden;">
        <img src="https://peritos-academy.vercel.app/niveis/nivel-09-mestre-supremo.png" alt="" width="92" style="vertical-align:middle;" />
      </div>
      <p style="font-size:11px;letter-spacing:3px;color:#D96A0B;font-weight:700;margin:0 0 8px;">NÍVEL 9 DE 10 · PENÚLTIMO NÍVEL</p>
      <p style="font-size:22px;font-weight:800;color:#083952;margin:0 0 12px;letter-spacing:-0.3px;">Mestre Supremo</p>
      <p style="font-size:13px;color:#888880;margin:0 0 4px;">Estrategista Expert → <strong style="color:#D96A0B;">Mestre Supremo</strong></p>
      <p style="font-size:13px;color:#888880;margin:0;">${fmtNum(d.xpTotal)} XP conquistados</p>
    </div>

    <div style="padding:34px 40px 16px;">

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">${d.primeiroNome}, o astronauta da sua nova insígnia saiu da órbita. E você também.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Nível 9 de 10. Pensa nisso por um segundo. <strong>${d.aulasConcluidas} aulas concluídas</strong>. <strong>${fmtNum(d.xpTotal)} XP conquistados</strong>. <strong>${d.diasDeJornada} dias</strong> desde que tudo começou com um Explorador Novato segurando um binóculo. Aquele profissional e você hoje são duas pessoas completamente diferentes.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Você dominou os cálculos. Desenvolveu teses próprias. Construiu autoridade. Enxergou o jogo inteiro como estrategista. E agora carrega um título que pouquíssimos profissionais da perícia no Brasil inteiro podem dizer que têm: <strong>Mestre Supremo</strong>.</p>

      <div style="margin:30px 0;background:#fef4e8;border-left:4px solid #F08C1B;border-radius:0 12px 12px 0;padding:20px 24px;">
        <p style="margin:0;font-size:17px;line-height:30px;color:#083952;font-style:italic;font-weight:700;">Quase ninguém chega até aqui. Você chegou.</p>
      </div>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">A insígnia laranja no seu perfil é um farol pra toda a comunidade. Quando alguém no nível 1 ou 2 olha pra ela, vê a prova de que essa jornada leva a algum lugar de verdade. Você é essa prova.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">E falta um. Só um. O nível <strong>Eu Sou a Lenda</strong>. A árvore dourada da última insígnia representa algo que você já sabe: raízes profundas, tronco firme, frutos que outros colhem. Só chega lá quem completa tudo. Cada aula. Cada avaliação. Cada desafio. Sem atalho.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Você está a um passo de se tornar Lenda.</p>

      <div style="margin:8px 0 36px;text-align:center;">
        <a href="https://peritos-academy.vercel.app/perfil" style="display:inline-block;padding:16px 32px;background:#D96A0B;border-radius:10px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:.01em;">Ver minha insígnia no perfil</a>
      </div>

      <div style="margin-bottom:36px;border-left:3px solid #F08C1B;padding-left:16px;">
        <p style="margin:0 0 2px;font-size:15px;line-height:22px;color:#888880;">Honrado por acompanhar essa jornada,</p>
        <p style="margin:0;font-size:19px;font-weight:800;color:#083952;letter-spacing:-0.3px;">Marlos Henrique</p>
      </div>

    </div>`
  );
}

function nivel10(d: DadosNivelUp): string {
  const avaliacoes = d.avaliacoesAprovadas ?? 0;
  const desafios = d.desafiosEntregues ?? 0;
  return shell(
    "background:linear-gradient(150deg,#F2C21D 0%,#D9A812 20%,#B8860B 42%,#0b2a47 72%,#061e35 100%);padding:44px 40px 38px;",
    `      <p style="margin:0 0 28px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.5);">NÍVEL 10 DE 10</p>
      <p style="margin:0 0 10px;font-size:32px;font-weight:800;line-height:40px;color:#F2C21D;letter-spacing:-0.5px;">Eu Sou a Lenda.</p>
      <p style="margin:0 0 22px;font-size:20px;font-weight:600;line-height:30px;color:#ffffff;letter-spacing:-0.3px;">E agora, ${d.primeiroNome}, essa frase é sua.</p>
      <div style="width:52px;height:3px;background:linear-gradient(90deg,#F2C21D,rgba(242,194,29,0));border-radius:2px;"></div>
    </div>

    <div style="padding:44px 40px 0;text-align:center;">
      <div style="width:148px;height:148px;margin:0 auto 20px;border-radius:50%;background:#fdf7e3;border:3px solid #F2C21D;text-align:center;line-height:144px;overflow:hidden;">
        <img src="https://peritos-academy.vercel.app/niveis/nivel-10-eu-sou-a-lenda.png" alt="" width="104" style="vertical-align:middle;" />
      </div>
      <p style="font-size:11px;letter-spacing:3px;color:#B8860B;font-weight:700;margin:0 0 8px;">JORNADA COMPLETA</p>
      <p style="font-size:26px;font-weight:800;color:#083952;margin:0 0 12px;letter-spacing:-0.3px;">Eu Sou a Lenda</p>
      <p style="font-size:13px;color:#888880;margin:0 0 4px;">Mestre Supremo → <strong style="color:#B8860B;">Eu Sou a Lenda</strong></p>
      <p style="font-size:13px;color:#888880;margin:0;">${fmtNum(d.xpTotal)} XP · Tudo concluído</p>
    </div>

    <div style="padding:38px 40px 16px;">

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">${d.primeiroNome}, lembra do primeiro email que você recebeu da Peritos Academy?</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Ele dizia: <em>"Todo Explorador Novato de hoje carrega uma Lenda esperando o próximo passo."</em></p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Hoje essa frase se cumpriu.</p>

      <div style="margin:30px 0;background:#fdf7e3;border-left:4px solid #F2C21D;border-radius:0 12px 12px 0;padding:24px 24px;">
        <p style="margin:0;font-size:18px;line-height:30px;color:#083952;font-style:italic;font-weight:700;">Você concluiu tudo. Cada aula. Cada avaliação. Cada desafio. Sem atalho, sem exceção. Você é a Lenda.</p>
      </div>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Olha o caminho que você percorreu: Explorador Novato, Conhecedor de Lógicas, Aspirante a Perito, Decifrador de Cálculos, Profissão Perito, Autoridade Pericial, Desenvolvedor de Teses, Estrategista Expert, Mestre Supremo. Nove versões de você, uma atrás da outra, cada uma mais completa que a anterior. Até chegar aqui.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Foram <strong>${d.aulasConcluidas} aulas concluídas</strong>. <strong>${avaliacoes} avaliações aprovadas</strong>. <strong>${desafios} desafios entregues</strong>. <strong>${fmtNum(d.xpTotal)} XP conquistados</strong> em <strong>${d.diasDeJornada} dias</strong>. Cada um desses números tem uma história por trás. Uma noite que você estudou em vez de descansar. Um fim de semana que você escolheu evoluir. Um dia difícil em que você abriu a plataforma mesmo assim.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">A árvore dourada da sua insígnia final não é qualquer árvore. Ela tem raízes. Raízes que você plantou aula por aula. O tronco é o conhecimento que ninguém tira de você. E os frutos? Os frutos são os laudos que você vai assinar, os processos que vai conduzir, os clientes que vão te escolher, a carreira que você construiu do zero até o topo.</p>

      <div style="margin:30px 0;background:#fdf7e3;border-left:4px solid #F2C21D;border-radius:0 12px 12px 0;padding:24px 24px;">
        <p style="margin:0;font-size:18px;line-height:30px;color:#083952;font-style:italic;font-weight:700;">Uma única regra levava até este nível: concluir tudo. Você concluiu. Você é a Lenda.</p>
      </div>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">A partir de agora, todo aluno que entrar na Peritos Academy e olhar pro ranking vai ver o seu nome lá em cima. Vai ver a insígnia dourada. E vai pensar: "eu quero chegar lá". Você é a prova viva de que essa jornada leva a algum lugar. Não por talento. Não por sorte. Por constância.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Esse email é diferente dos outros nove que você recebeu. Porque ele não termina com "o próximo nível te espera". Não existe próximo nível. Você chegou ao topo. O que existe agora é o profissional completo que saiu do outro lado dessa jornada.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">E esse profissional é você, ${d.primeiroNome}.</p>

      <div style="margin:8px 0 36px;text-align:center;">
        <a href="https://peritos-academy.vercel.app/perfil" style="display:inline-block;padding:18px 36px;background:linear-gradient(135deg,#F2C21D 0%,#B8860B 100%);border-radius:10px;font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:.01em;">Ver minha insígnia dourada</a>
      </div>

      <div style="margin-bottom:36px;border-left:3px solid #F2C21D;padding-left:16px;">
        <p style="margin:0 0 2px;font-size:15px;line-height:22px;color:#888880;">Com todo o respeito que essa conquista merece,</p>
        <p style="margin:0;font-size:19px;font-weight:800;color:#083952;letter-spacing:-0.3px;">Marlos Henrique</p>
      </div>

    </div>`
  );
}

const GERADORES: Record<number, (d: DadosNivelUp) => string> = {
  2: nivel2,
  3: nivel3,
  4: nivel4,
  5: nivel5,
  6: nivel6,
  7: nivel7,
  8: nivel8,
  9: nivel9,
  10: nivel10,
};

export function emailNivelUp(ordem: number, dados: DadosNivelUp): { assunto: string; html: string } | null {
  const gerar = GERADORES[ordem];
  if (!gerar) return null;
  return { assunto: ASSUNTOS[ordem], html: gerar(dados) };
}
