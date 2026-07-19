// lib/email/templates/cursoConcluido.ts
// Sem mockup aprovado em docs/email-templates (só boas-vindas e certificado
// foram desenhados) — segue a mesma identidade visual dos dois: fundo
// claro, header com gradiente linear teal→navy, prosa em storytelling sem
// bullets nem travessão, bloco de destaque com borda gradiente, CTA teal,
// assinatura pessoal, footer com preferências/cancelar.
// É o "renascimento" da recomendação de curso — decisão de produto: sugestão
// vive na conclusão, não durante o estudo (por isso não há link nenhum pra
// próximo curso em nenhuma outra tela do app).
export type DadosCursoConcluido = {
  primeiroNome: string;
  cursoNome: string;
  proximoCurso: { titulo: string; slug: string; mesmaTrilha: boolean } | null;
};

export function emailCursoConcluido(d: DadosCursoConcluido): { assunto: string; html: string } {
  const blocoProximo = d.proximoCurso
    ? `<p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">${
        d.proximoCurso.mesmaTrilha
          ? `E a sua trilha continua. O próximo passo já está esperando por você: <strong>${d.proximoCurso.titulo}</strong>.`
          : `E aqui termina essa trilha, mas a jornada não para. Uma nova te espera, começando por <strong>${d.proximoCurso.titulo}</strong>.`
      }</p>

      <div style="margin:8px 0 36px;text-align:center;">
        <a href="https://peritos-academy.vercel.app/curso/${d.proximoCurso.slug}" style="display:inline-block;padding:16px 32px;background:#1DC8A0;border-radius:10px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:.01em;">Começar ${d.proximoCurso.titulo}</a>
      </div>`
    : `<p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Você chegou numa fronteira: os cursos que já mapeamos aqui acabaram. Estamos preparando o que vem a seguir, e você vai ser avisado assim que sair do forno.</p>

      <div style="margin:8px 0 36px;text-align:center;">
        <a href="https://peritos-academy.vercel.app/cursos" style="display:inline-block;padding:16px 32px;background:#1DC8A0;border-radius:10px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:.01em;">Explorar outros cursos</a>
      </div>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Curso concluído</title>
</head>
<body style="margin:0;padding:0;">
<div style="background:#eef0f4;padding:32px 16px;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 2px 14px rgba(6,30,53,0.10);">

    <div style="background:linear-gradient(150deg,#1DC8A0 0%,#0e9e82 20%,#0a6e6a 45%,#083d5a 70%,#061e35 100%);padding:38px 40px 34px;">
      <p style="margin:0 0 26px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.45);">CURSO CONCLUÍDO, ${d.primeiroNome}</p>
      <p style="margin:0 0 22px;font-size:26px;font-weight:800;line-height:36px;color:#ffffff;letter-spacing:-0.5px;">Mais um capítulo<br>fechado com chave de ouro.</p>
      <div style="width:52px;height:3px;background:linear-gradient(90deg,#1DC8A0,rgba(29,200,160,0));border-radius:2px;"></div>
    </div>

    <div style="padding:34px 40px 16px;">

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">${d.primeiroNome}, você concluiu <strong>${d.cursoNome}</strong>. Do começo ao fim, sem pular etapa.</p>

      <div style="margin:30px 0;background:#edf9f6;border-left:4px solid #1DC8A0;border-radius:0 12px 12px 0;padding:20px 24px;">
        <p style="margin:0;font-size:17px;line-height:30px;color:#083952;font-style:italic;font-weight:700;">Curso concluído não é o fim de uma aula. É mais uma ferramenta que você carrega pro resto da carreira.</p>
      </div>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Seu certificado já está disponível no seu perfil, pronto pra comprovar essa capacitação em qualquer processo, proposta ou nomeação. E o XP dessa conquista já está somado na sua jornada rumo ao próximo nível.</p>

      ${blocoProximo}

      <div style="margin-bottom:36px;border-left:3px solid #1DC8A0;padding-left:16px;">
        <p style="margin:0 0 2px;font-size:15px;line-height:22px;color:#888880;">Na torcida pelo próximo capítulo,</p>
        <p style="margin:0;font-size:19px;font-weight:800;color:#083952;letter-spacing:-0.3px;">Marlos Henrique</p>
      </div>

    </div>
  </div>

  <div style="max-width:600px;margin:0 auto;text-align:center;padding:22px 16px 6px;">
    <p style="font-size:12px;color:#9aa1b0;margin:0 0 6px;">Peritos Academy · A jornada completa da perícia judicial</p>
    <p style="font-size:11px;color:#b4bac6;margin:0;">Você recebeu este email porque faz parte da Peritos Academy.<br/>Preferências de email · Cancelar inscrição</p>
  </div>
</div>
</body>
</html>`;

  return { assunto: `Curso concluído: ${d.cursoNome}`.slice(0, 60), html };
}
