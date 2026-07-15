// app/email/cancelar/page.tsx
// Página pública (sem login) de cancelamento de inscrição de email — link
// que sai no rodapé de todo email enviado (ver lib/email/enviar.ts). Não
// passa por verificarAcessoConteudo nem por NavPlataforma de propósito:
// precisa funcionar mesmo com o site em manutenção ou a conta suspensa
// (middleware.ts trata /email/cancelar como rota neutra).
import type { Metadata } from "next";
import { verificarTokenCancelamento } from "@/lib/email/token";
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
  const usuarioId = token ? verificarTokenCancelamento(token) : null;

  let sucesso = false;
  if (usuarioId) {
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
              <p>Você não receberá mais emails da Peritos Academy. Se mudar de ideia, reative nas configurações do seu perfil.</p>
              <a className="btn btn-primario" href="/perfil">Ir para meu perfil</a>
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
