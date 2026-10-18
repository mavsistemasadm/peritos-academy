-- ══════════════════════════════════════════════════════════════════
-- O aviso de quem conduz a live, uma hora antes (18/10/2026)
--
-- Pedido do dono: "uns minutos antes da live, me manda o link para eu não
-- precisar procurar". Na mesma passada do cron que manda aos alunos o
-- "começa em uma hora", quem conduz recebe no sino (e no celular, pelo Nexus)
-- o link da página da live. Na live de tira-dúvidas, o link desce direto ao
-- painel das dúvidas (#duvida) e o aviso diz quantas esperam resposta.
--
-- Quem conduz: quem criou o evento; sem criador (live criada pelo Jarvis), os
-- super admins ativos. Uma vez por pessoa e por live (o cron passa de hora em
-- hora e a janela é maior que o intervalo).
-- ══════════════════════════════════════════════════════════════════

create or replace function public.notificar_conducao_evento(p_evento uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ev record;
  v_hora text;
  v_abertas integer := 0;
  v_sufixo text;
  v_link text;
  v_usuario uuid;
  v_n integer := 0;
begin
  select id, titulo, slug, inicia_em, criado_por, recebe_duvidas into v_ev from public.eventos where id = p_evento;
  if v_ev is null then return 0; end if;

  v_hora := to_char(v_ev.inicia_em at time zone 'America/Sao_Paulo', 'HH24"h"MI');
  v_link := '/evento/' || coalesce(v_ev.slug, '') || case when v_ev.recebe_duvidas then '#duvida' else '' end;

  if v_ev.recebe_duvidas then
    select count(*) into v_abertas from public.evento_duvidas where evento_id = p_evento and status = 'aberta';
    v_sufixo := '. Às ' || v_hora || '. ' || case
      when v_abertas = 0 then 'Nenhuma dúvida enviada ainda.'
      when v_abertas = 1 then '1 dúvida esperando resposta.'
      else v_abertas || ' dúvidas esperando resposta.'
    end;
  else
    v_sufixo := '. Às ' || v_hora || '. Toque para abrir a página da live.';
  end if;

  for v_usuario in
    select v_ev.criado_por where v_ev.criado_por is not null
    union
    select au.usuario_id from public.admin_usuarios au
     where v_ev.criado_por is null and au.papel = 'super_admin' and coalesce(au.ativo, true)
  loop
    if exists (
      select 1 from public.notificacoes
       where usuario_id = v_usuario and tipo = 'evento_conduzir' and dados->>'evento_id' = p_evento::text
    ) then
      continue;
    end if;
    perform public.notificar(
      v_usuario, 'evento_conduzir', 'Sua live começa em uma hora: ', v_ev.titulo, v_sufixo,
      v_link, 'ao_vivo', jsonb_build_object('evento_id', p_evento), false
    );
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke execute on function public.notificar_conducao_evento(uuid) from public, anon, authenticated;
