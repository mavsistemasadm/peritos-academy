-- ══════════════════════════════════════════════════════════════════
-- QUEM É O PÚBLICO DE UM EVENTO — 2026-08-26
--
-- `eventos.visibilidade` existe desde o Bloco 2 e até hoje **não filtrava
-- nada**. `carregarAgenda` lista todo evento publicado para todo mundo, e o
-- rótulo "Exclusivo · Turma X" que aparece no card é só texto: a mentoria
-- fechada de uma turma estava visível para a base inteira.
--
-- Ninguém ganhava acesso indevido com isso (a sala é outro portão), mas a
-- promessa da tela era falsa, e agora que o evento vai gerar EMAIL a mentira
-- deixa de ser cosmética: anunciar por email para 544 pessoas um encontro que
-- é de 30 é um erro que não tem como ser desfeito depois de enviado.
--
-- ── O QUE ESTA FUNÇÃO RESOLVE, E O QUE ELA RECUSA ──
--
--   todos       → toda conta ativa. É o caso real de 100% dos eventos hoje.
--   curso       → quem tem acesso ao `curso_id`, pela mesma `tem_acesso_curso`
--                 que gateia a página do curso. Uma regra só, dois lugares.
--   assinatura  → RECUSA (devolve vazio)
--   turma       → RECUSA (devolve vazio)
--
-- ⚠️ As duas últimas recusam porque **não existe do que derivar a resposta**.
-- `alvo_rotulo` é texto livre digitado à mão ("Premium", "Turma Kit Bancário
-- 2026") e não tem vínculo com `planos_assinatura`; turma não é um conceito
-- deste schema, é uma palavra num campo de texto.
--
-- Recusar é a única saída honesta. As alternativas são piores: mandar para
-- todo mundo entrega ao público geral o que foi marcado como exclusivo, e
-- adivinhar por semelhança de texto acerta até o dia em que alguém digitar
-- "premium" em minúsculo. Quem chama trata o vazio como "não sei quem é o
-- público deste evento" e avisa o operador, em vez de enviar.
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
  select e.visibilidade, e.curso_id into v_ev
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
  end if;

  -- assinatura, turma, e 'curso' sem curso escolhido: nada. Ver o cabeçalho.
  return;
end;
$$;

revoke execute on function public.evento_audiencia(uuid) from public, authenticated, anon;

-- ── A MESMA REGRA, PARA UMA PESSOA SÓ ────────────────────────────
--
-- Usada pela agenda para decidir o que cada aluno vê. Precisa ser chamável por
-- quem tem sessão (ao contrário da de cima, que devolveria a base inteira e
-- por isso é só da service role).
--
-- ⚠️ `assinatura` e `turma` devolvem TRUE aqui, e falso na função de
-- audiência. Não é contradição: são perguntas diferentes. "Mostrar na agenda"
-- errando para mais deixa alguém ver um card que não é dele, e ele bate na
-- porta da sala; "mandar email" errando para mais é irreversível. Quando não
-- se sabe, a tela mostra e o email não sai.
create or replace function public.evento_visivel_para(p_evento uuid, p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when e.visibilidade is null or e.visibilidade = 'todos' then true
    when e.visibilidade = 'curso' and e.curso_id is not null
      then p_usuario is not null and public.tem_acesso_curso(p_usuario, e.curso_id)
    else p_usuario is not null
  end
  from public.eventos e where e.id = p_evento;
$$;

-- ── O ANÚNCIO NO SINO ────────────────────────────────────────────
--
-- Mesma porta estreita dos lembretes: o admin chama pela service role, que não
-- tem `auth.uid()` e por isso não alcança `notificar()` direto.
create or replace function public.notificar_anuncio_evento(p_usuario uuid, p_evento uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_ev record; v_quando text;
begin
  select titulo, slug, inicia_em into v_ev from public.eventos where id = p_evento;
  if v_ev is null then return null; end if;

  -- Não repete: anunciar duas vezes é um clique a mais no admin, e o aluno não
  -- deve pagar por isso com duas linhas iguais no sino.
  if exists (
    select 1 from public.notificacoes
    where usuario_id = p_usuario and tipo = 'evento_anuncio'
      and dados->>'evento_id' = p_evento::text
  ) then return null; end if;

  v_quando := to_char(v_ev.inicia_em at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24"h"MI');

  return public.notificar(
    p_usuario, 'evento_anuncio',
    'Novo na agenda: ', v_ev.titulo, '. ' || v_quando || '. Reserve seu lugar.',
    '/evento/' || coalesce(v_ev.slug, ''), 'ao_vivo',
    jsonb_build_object('evento_id', p_evento), false
  );
end $$;

revoke execute on function public.notificar_anuncio_evento(uuid, uuid) from public, authenticated, anon;
