// app/email/cancelar/page.tsx
// Página pública (sem login) de cancelamento de inscrição de email — link
// que sai no rodapé de todo email enviado (ver lib/email/enviar.ts). Não
// passa por verificarAcessoConteudo nem por NavPlataforma de propósito:
// precisa funcionar mesmo com o site em manutenção ou a conta suspensa
// (middleware.ts trata /email/cancelar como rota neutra).
import type { Metadata } from "next";
import { verificarTokenCancelamento, verificarTokenEmail } from "@/lib/email/token";
import { criarClienteServico } from "@/lib/supabase/servico";
import { IconeCheck, IconeAlertTriangle } from "@/components/Icones";

export const metadata: Metadata = {
  title: "Cancelar inscrição · Peritos Academy",
};

export const dynamic = "force-dynamic";

export default async function PaginaCancelarEmail({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  // Dois tipos de link caem aqui, e o descadastro precisa funcionar nos dois.
  // O do aluno carrega o uuid e desliga a preferência do perfil. O do
  // convidado de uma live aberta carrega o próprio endereço — ele não tem
  // conta para ter preferência, então o desligamento é por email.
  // O prefixo do token distingue um do outro (ver lib/email/token.ts); a
  // ordem aqui checa o de email PRIMEIRO porque o de usuário aceita qualquer
  // payload assinado e engoliria o outro, gravando um uuid inexistente.
  const emailConvidado = token ? verificarTokenEmail(token) : null;
  const usuarioId = !emailConvidado && token ? verificarTokenCancelamento(token) : null;

  let sucesso = false;
  if (emailConvidado) {
    const supabase = criarClienteServico();
    const { error } = await supabase
      .from("email_optout_publico")
      .upsert({ email: emailConvidado.toLowerCase() }, { onConflict: "email" });
    sucesso = !error;
  } else if (usuarioId) {
    const supabase = criarClienteServico();
    const { error } = await supabase
      .from("email_preferencias")
      .upsert({ usuario_id: usuarioId, receber_emails: false }, { onConflict: "usuario_id" });
    sucesso = !error;
  }

  return (
    <div className="pagina-email-cancelar">
      <main className="ec-main">
        <div className="ec-card">
          {sucesso ? (
            <>
              <span className="ec-ico ec-ico-ok" aria-hidden="true">
                <IconeCheck size={28} strokeWidth={2} />
              </span>
              <h1>Inscrição cancelada</h1>
              {emailConvidado ? (
                <>
                  <p>Não vou mais escrever para <b>{emailConvidado}</b>. Se um dia quiser voltar a receber convites de encontros ao vivo, é só se inscrever de novo em qualquer um deles.</p>
                  <a className="btn btn-primario" href="/">Conhecer a Peritos Academy</a>
                </>
              ) : (
                <>
                  <p>Você não receberá mais emails da Peritos Academy. Se mudar de ideia, reative nas configurações do seu perfil.</p>
                  <a className="btn btn-primario" href="/perfil">Ir para meu perfil</a>
                </>
              )}
            </>
          ) : (
            <>
              <span className="ec-ico ec-ico-erro" aria-hidden="true">
                <IconeAlertTriangle size={28} strokeWidth={2} />
              </span>
              <h1>Link inválido</h1>
              <p>Não foi possível confirmar esse cancelamento. O link pode estar incompleto. Copie o link diretamente do email recebido, ou ajuste suas preferências no seu perfil.</p>
              <a className="btn btn-fantasma" href="/perfil">Ir para meu perfil</a>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
