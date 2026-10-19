-- 20261019_selo_excelencia_comemoracao.sql
-- O Selo de Excelência vira a maior comemoração da plataforma (aprovado pelo
-- dono em 19/10/2026). Ver "O Selo de Excelência — 2026-10-19" no CLAUDE.md.
--
-- 1. perfis.selo_comemorado_em: quando a pessoa VIU a comemoração de tela
--    cheia. O toast de conquista só enxerga notificações criadas depois de a
--    página abrir, e o selo pode ser concedido com a pessoa fora (concessão à
--    mão, dias depois). Selo concedido e comemoração nunca vista = a tela cheia
--    abre na próxima visita, uma vez só, não importa quanto tempo passou.
-- 2. selo_excelencia_em fica protegido por trigger: a policy de update de
--    perfis é por linha, e o selo aparece no perfil público. Sem a trava,
--    qualquer conta logada se daria o selo pelo console.
-- 3. formacao_numeros(): cursos, aulas e horas da trilha principal, uma conta
--    só para a tela e para o email.
-- 4. conceder_selo_excelencia_interno passa a mandar o email (pg_net, mesmo
--    padrão de gam_trg_certificados) e a gravar sob a flag do trigger.

alter table public.perfis add column if not exists selo_comemorado_em timestamptz;

-- ---------------------------------------------------------------- trava
create or replace function public.proteger_selo_excelencia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('app.selo_write', true), '') <> 'on' then
    new.selo_excelencia_em := old.selo_excelencia_em;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_selo_excelencia on public.perfis;
create trigger trg_proteger_selo_excelencia
  before update of selo_excelencia_em on public.perfis
  for each row execute function public.proteger_selo_excelencia();

-- ---------------------------------------------------------------- números
create or replace function public.formacao_numeros()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with c as (
    select distinct em.curso_id
    from public.etapa_missoes em
    join public.etapas e on e.id = em.etapa_id
    join public.trilhas t on t.id = e.trilha_id
    where t.principal
  )
  select jsonb_build_object(
    'cursos', (select count(*) from c),
    'aulas', count(a.id),
    'horas', round(coalesce(sum(a.duracao_seg), 0) / 3600.0)
  )
  from c
  join public.modulos m on m.curso_id = c.curso_id
  join public.aulas a on a.modulo_id = m.id;
$$;
grant execute on function public.formacao_numeros() to authenticated, anon;

-- ---------------------------------------------------------------- concessão
create or replace function public.conceder_selo_excelencia_interno(p_usuario uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_ja timestamptz;
  v_trilha_nome text;
begin
  if p_usuario is null then
    return;
  end if;

  select selo_excelencia_em into v_ja from public.perfis where id = p_usuario;
  if v_ja is not null then
    return;
  end if;

  select nome into v_trilha_nome from public.trilhas where principal = true limit 1;

  perform set_config('app.selo_write', 'on', true);
  update public.perfis set selo_excelencia_em = now(), selo_comemorado_em = null where id = p_usuario;
  perform set_config('app.selo_write', 'off', true);

  insert into public.perfil_insignias (usuario_id, nome, descricao, icone, conquistada_em, quando_rotulo, ordem)
  values (
    p_usuario, 'Selo de Excelência',
    coalesce(v_trilha_nome, 'Formação Pericial de Alta Performance') || ' concluída',
    'selo_excelencia', current_date,
    'Conquistado em ' || to_char(now(), 'DD/MM/YYYY'), 0
  );

  perform public.notificar(
    p_usuario, 'selo_excelencia',
    'Você conquistou o ', 'Selo de Excelência', '! Formação Pericial concluída.',
    '/perfil', 'selo_excelencia',
    jsonb_build_object('trilha_nome', v_trilha_nome), true
  );

  -- Email do selo. Uma vez só: o dedupe de enviarEmail (tipo + usuário) e o
  -- próprio retorno antecipado acima. Preferência de email respeitada lá.
  perform net.http_post(
    url := 'https://evolua.peritosacademy.com.br/api/internal/email-evento',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.email_internal_secret()
    ),
    body := jsonb_build_object('tipo', 'selo_excelencia', 'usuario_id', p_usuario)
  );
end;
$function$;

revoke execute on function public.conceder_selo_excelencia_interno(uuid) from public, authenticated, anon;
