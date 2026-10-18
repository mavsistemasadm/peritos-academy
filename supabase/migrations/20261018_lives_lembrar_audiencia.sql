-- ══════════════════════════════════════════════════════════════════
-- Lives: lembrete da véspera e do dia para quem AINDA NÃO reservou (18/10/2026)
--
-- Pedido do dono: o convite sai quando ele pede, e depois, sozinhos, um
-- lembrete na manhã da véspera e outro na manhã do dia para a mesma base do
-- convite, não só para quem reservou.
--
-- eventos.lembrar_audiencia: ligado quando o anúncio sai (pelo Jarvis). O
-- cron de lembretes passa a somar a audiência do evento (evento_audiencia)
-- nas janelas 'vespera' e 'hoje'; as de 1 hora antes e 'ao vivo' continuam
-- só para quem reservou.
--
-- evento_emails_confirmados: os emails de quem já reservou ou se inscreveu,
-- para o Nexus tirar essas pessoas dos lembretes que ele manda à base dele.
-- Interna: só a chave de serviço chama.
-- ══════════════════════════════════════════════════════════════════

alter table public.eventos add column if not exists lembrar_audiencia boolean not null default false;

create or replace function public.evento_emails_confirmados(p_evento uuid)
returns setof text
language sql
security definer
set search_path = public
as $$
  select lower(i.email) from evento_inscricoes i
   where i.evento_id = p_evento and i.cancelado_em is null and i.email is not null
  union
  select lower(u.email::text) from evento_reservas r
    join auth.users u on u.id = r.usuario_id
   where r.evento_id = p_evento and u.email is not null
$$;

revoke execute on function public.evento_emails_confirmados(uuid) from public, anon, authenticated;
