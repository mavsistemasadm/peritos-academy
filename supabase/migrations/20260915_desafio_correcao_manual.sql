-- Desafio sem perguntas: o aluno entrega laudo e planilha, e o professor corrige.
--
-- Até aqui a entrega guardava um arquivo só (`arquivo_path`) e a nota vinha da
-- correção por IA das perguntas, gravada pela sessão do próprio aluno. A policy
-- `entregas_update` libera a linha inteira para o dono, então sem o trigger
-- abaixo o aluno poderia escrever a própria nota num desafio de correção manual.

alter table public.desafio_entregas
  add column if not exists arquivos jsonb not null default '[]'::jsonb,
  add column if not exists parecer text,
  add column if not exists corrigido_em timestamptz,
  add column if not exists corrigido_por uuid references auth.users(id) on delete set null;

-- Quem não é a RPC de correção não escreve parecer, e em desafio sem perguntas
-- também não escreve nota. Depois de protocolada, a entrega fica congelada.
create or replace function public.desafio_entregas_proteger()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_manual boolean;
begin
  if coalesce(current_setting('app.correcao_desafio', true), '') = 'on' then
    return new;
  end if;

  select coalesce(jsonb_array_length(d.quesitos), 0) = 0 into v_manual
  from public.desafios d where d.id = new.desafio_id;
  -- desafio que a sessão não enxerga é tratado como manual: na dúvida, protege
  v_manual := coalesce(v_manual, true);

  if tg_op = 'INSERT' then
    new.parecer := null;
    new.corrigido_em := null;
    new.corrigido_por := null;
    if v_manual then
      new.nota := null;
      new.feedbacks := null;
    end if;
    return new;
  end if;

  new.parecer := old.parecer;
  new.corrigido_em := old.corrigido_em;
  new.corrigido_por := old.corrigido_por;
  if v_manual then
    new.nota := old.nota;
    new.feedbacks := old.feedbacks;
  end if;

  if old.entregue_em is not null then
    new.entregue_em := old.entregue_em;
    new.arquivos := old.arquivos;
    new.arquivo_path := old.arquivo_path;
    new.respostas := old.respostas;
    new.nota := old.nota;
    new.feedbacks := old.feedbacks;
    new.tempo_seg := old.tempo_seg;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_desafio_entregas_proteger on public.desafio_entregas;
create trigger trg_desafio_entregas_proteger
  before insert or update on public.desafio_entregas
  for each row execute function public.desafio_entregas_proteger();

create or replace function public.adm_corrigir_desafio_entrega(
  p_entrega_id uuid,
  p_nota numeric,
  p_parecer text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entrega public.desafio_entregas%rowtype;
  v_titulo text;
  v_slug text;
  v_minima numeric;
  v_nota numeric;
begin
  if not public.is_admin_papel(auth.uid(), array['super_admin', 'conteudo']) then
    return jsonb_build_object('ok', false, 'erro', 'Sem permissão.');
  end if;
  if p_nota is null or p_nota < 0 or p_nota > 10 then
    return jsonb_build_object('ok', false, 'erro', 'A nota vai de 0 a 10.');
  end if;
  if coalesce(trim(p_parecer), '') = '' then
    return jsonb_build_object('ok', false, 'erro', 'Escreva o parecer para o aluno.');
  end if;

  select * into v_entrega from public.desafio_entregas where id = p_entrega_id;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Entrega não encontrada.');
  end if;
  if v_entrega.entregue_em is null then
    return jsonb_build_object('ok', false, 'erro', 'O aluno ainda não protocolou.');
  end if;

  select titulo, slug, nota_minima into v_titulo, v_slug, v_minima
  from public.desafios where id = v_entrega.desafio_id;

  v_nota := round(p_nota, 1);

  perform set_config('app.correcao_desafio', 'on', true);
  update public.desafio_entregas
     set nota = v_nota,
         parecer = trim(p_parecer),
         corrigido_em = now(),
         corrigido_por = auth.uid()
   where id = p_entrega_id;
  perform set_config('app.correcao_desafio', 'off', true);

  perform public.notificar(
    v_entrega.usuario_id, 'desafio_corrigido',
    'Seu laudo do desafio ', coalesce(v_titulo, ''),
    case when v_nota >= coalesce(v_minima, 6) then ' foi aprovado' else ' foi corrigido' end,
    case when v_slug is not null then '/desafios/' || v_slug else null end,
    null,
    jsonb_build_object('desafio_id', v_entrega.desafio_id, 'desafio_entrega_id', p_entrega_id, 'nota', v_nota),
    false
  );

  return jsonb_build_object('ok', true, 'nota', v_nota);
end;
$$;

revoke execute on function public.adm_corrigir_desafio_entrega(uuid, numeric, text) from public, anon;
grant execute on function public.adm_corrigir_desafio_entrega(uuid, numeric, text) to authenticated;
