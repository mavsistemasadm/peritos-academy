-- Lista de convidados passa a dizer se o convite por email já saiu.
--
-- É o que o botão "Enviar convite por email" usa para mandar só a quem ainda não
-- recebeu. Email que o Resend marcou como `falhou` não conta como enviado: a
-- mesma regra do dedupe de enviarEmail(), e é o que permite reenviar.

drop function if exists public.adm_listar_convidados_desafio(uuid);

create function public.adm_listar_convidados_desafio(p_desafio_id uuid)
returns table (
  usuario_id uuid,
  nome text,
  email text,
  convidado_em timestamptz,
  aceitou boolean,
  entregou boolean,
  convite_enviado_em timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_papel(auth.uid(), array['super_admin', 'conteudo']) then
    raise exception 'Sem permissão.';
  end if;

  return query
  select c.usuario_id, p.nome, u.email::text, c.convidado_em,
         (e.aceito_em is not null), (e.entregue_em is not null),
         env.enviado_em
  from public.desafio_convidados c
  join auth.users u on u.id = c.usuario_id
  left join public.perfis p on p.id = c.usuario_id
  left join public.desafio_entregas e on e.desafio_id = c.desafio_id and e.usuario_id = c.usuario_id
  left join lateral (
    select max(ee.criado_em) as enviado_em
    from public.email_enviados ee
    where ee.usuario_id = c.usuario_id
      and ee.tipo = 'desafio_convite'
      and ee.ref_id = c.desafio_id::text
      and ee.estado <> 'falhou'
  ) env on true
  where c.desafio_id = p_desafio_id
  order by p.nome nulls last, u.email;
end;
$$;

revoke execute on function public.adm_listar_convidados_desafio(uuid) from public, anon;
grant execute on function public.adm_listar_convidados_desafio(uuid) to authenticated;
