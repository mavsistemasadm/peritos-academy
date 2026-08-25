-- ══════════════════════════════════════════════════════════════════
-- "ASSINANTES" DEIXA DE SER TEXTO LIVRE — 2026-08-26
--
-- `evento_audiencia` recusava `visibilidade = 'assinatura'` porque não havia
-- do que derivar o público: `alvo_rotulo` é um campo de texto onde alguém
-- digita "Premium" à mão, sem vínculo nenhum com o banco.
--
-- O conserto não é adivinhar o texto. É parar de aceitar texto: o rótulo passa
-- a guardar uma CHAVE de segmento, escolhida numa lista no admin, e cada chave
-- é uma pergunta que o banco sabe responder.
--
-- ── O QUE É "ASSINANTE" NESTA PLATAFORMA, MEDIDO EM 26/08/2026 ──
--
-- ⚠️ Não é `assinaturas`. Aquela tabela tem UMA linha, e é cortesia: a
-- integração com o Asaas nunca foi ligada, e o módulo Financeiro é estrutura
-- esperando chave. Quem procurar assinante ali não acha ninguém.
--
-- Quem tem acesso de assinante são as concessões de escopo `total` vigentes em
-- `acessos_conteudo` — a MESMA regra que `carregarResumoAcesso` usa para abrir
-- Comunidade, Agenda, Jornada e Desafios. Uma regra só, agora em dois lugares:
--
--   completo    499  · tudo que abre a plataforma inteira (o padrão)
--   vitalicio   328  · migração e concessões de admin, sem data de fim
--   com_prazo   189  · precisa renovar. É a lista de retenção.
--   nexus        94  · veio pela assinatura do Nexus Pericial
--
-- ── UMA DIVERGÊNCIA QUE VALE SABER ──
--
-- `perfis.nexus_status = 'active'` marca 44 pessoas; concessões com
-- `origem = 'nexus'` vigentes são 94. A flag do perfil é MANUAL (documentada
-- assim desde 05/08) e ficou para trás. Por isso o segmento `nexus` lê a
-- concessão, e não a flag: a concessão é escrita pelo SSO, a flag é escrita
-- por alguém que lembrou de marcar.
-- ══════════════════════════════════════════════════════════════════

create or replace function public.evento_audiencia(p_evento uuid)
returns table (usuario_id uuid, nome text, email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ev record;
begin
  select e.visibilidade, e.curso_id, e.alvo_rotulo into v_ev
  from public.eventos e where e.id = p_evento;

  if v_ev is null then
    return;
  end if;

  if v_ev.visibilidade = 'todos' then
    return query
      select p.id, p.nome, u.email::text
      from public.perfis p
      join auth.users u on u.id = p.id
      where p.status = 'ativo' and u.email is not null;

  elsif v_ev.visibilidade = 'curso' and v_ev.curso_id is not null then
    return query
      select p.id, p.nome, u.email::text
      from public.perfis p
      join auth.users u on u.id = p.id
      where p.status = 'ativo'
        and u.email is not null
        and public.tem_acesso_curso(p.id, v_ev.curso_id);

  elsif v_ev.visibilidade = 'assinatura' then
    -- Sem chave escolhida, o padrão é o público inteiro de assinante. É o
    -- que "Assinantes" quer dizer quando ninguém especificou mais nada, e é
    -- mais seguro que recusar: o operador marcou o evento como de assinante,
    -- então o erro possível aqui é alcançar assinante demais, nunca alcançar
    -- quem não é assinante.
    return query
      select distinct p.id, p.nome, u.email::text
      from public.perfis p
      join auth.users u on u.id = p.id
      left join public.acessos_conteudo ac
        on ac.usuario_id = p.id
       and ac.ativo = true
       and ac.escopo = 'total'
       and (ac.vitalicio or ac.expira_em >= current_date)
      where p.status = 'ativo'
        and u.email is not null
        and (
          ac.id is not null and case coalesce(nullif(btrim(v_ev.alvo_rotulo), ''), 'completo')
            when 'nexus'     then ac.origem = 'nexus'
            when 'vitalicio' then ac.vitalicio
            when 'com_prazo' then not ac.vitalicio
            else true                      -- 'completo'
          end
          -- A assinatura paga pelo Asaas entra no segmento geral. Hoje é uma
          -- pessoa; quando o checkout for ligado, passa a ser o grosso dele
          -- sem ninguém precisar lembrar de mexer aqui.
          or (coalesce(nullif(btrim(v_ev.alvo_rotulo), ''), 'completo') = 'completo'
              and public.tem_acesso_ativo(p.id))
        );
  end if;

  -- turma: não é um conceito deste schema, é uma palavra num campo de texto.
  -- Continua recusando, e a tela do admin explica o porquê.
  return;
end;
$$;

revoke execute on function public.evento_audiencia(uuid) from public, authenticated, anon;

-- ── A MESMA REGRA PARA UMA PESSOA SÓ ─────────────────────────────
-- Agora que `assinatura` sabe quem é o público, a agenda pode deixar de
-- mostrar evento de assinante para quem não é. `turma` continua no
-- "mostra e não manda" documentado na migração anterior.
create or replace function public.evento_visivel_para(p_evento uuid, p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when e.visibilidade is null or e.visibilidade = 'todos' then true
    when p_usuario is null then false
    when e.visibilidade = 'curso' and e.curso_id is not null
      then public.tem_acesso_curso(p_usuario, e.curso_id)
    when e.visibilidade = 'assinatura'
      then public.tem_acesso_ativo(p_usuario) or exists (
        select 1 from public.acessos_conteudo ac
        where ac.usuario_id = p_usuario and ac.ativo = true and ac.escopo = 'total'
          and (ac.vitalicio or ac.expira_em >= current_date)
      )
    else true   -- turma: mostra, e o email não sai
  end
  from public.eventos e where e.id = p_evento;
$$;

grant execute on function public.evento_visivel_para(uuid, uuid) to authenticated, anon;
