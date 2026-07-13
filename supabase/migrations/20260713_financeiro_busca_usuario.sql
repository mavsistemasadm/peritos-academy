-- admin_buscar_usuario_por_email: resolve email -> perfil.id pro admin
-- financeiro conceder cortesia sem precisar de cliente service-role.
-- security definer enxerga auth.users (owner da função), mas só devolve
-- o mínimo (id, nome, se já tem assinatura) e só pra quem já é admin
-- financeiro/super_admin.
create or replace function public.admin_buscar_usuario_por_email(p_email text)
returns table(id uuid, nome text, ja_tem_assinatura boolean)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin_papel(auth.uid(), array['super_admin','financeiro']) then
    raise exception 'Sem permissão.';
  end if;

  return query
    select u.id, coalesce(p.nome, u.email) as nome,
      exists(select 1 from public.assinaturas a where a.usuario_id = u.id and a.status <> 'cancelada') as ja_tem_assinatura
    from auth.users u
    left join public.perfis p on p.id = u.id
    where lower(u.email) = lower(p_email)
    limit 1;
end;
$$;
grant execute on function public.admin_buscar_usuario_por_email(text) to authenticated;
