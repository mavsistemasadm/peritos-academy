-- ══════════════════════════════════════════════════════════════════
-- O ALUNO QUE RESERVA NÃO ERA AVISADO DE NADA — 2026-08-25
--
-- `reservarLugar` gravava a linha em `evento_reservas` e acabava ali. O botão
-- virava "Reservado" e o assunto morria: nada no sino, nada depois. Quem
-- reservou uma sala de análise com duas semanas de antecedência não tinha
-- nenhuma pista de que aquilo continuava de pé, e a única lembrança possível
-- era voltar à agenda por conta própria.
--
-- ── POR QUE TRIGGER, E NÃO UMA CHAMADA NA SERVER ACTION ──
--
-- A reserva entra por dois caminhos hoje (a agenda e a página pública do
-- evento) e pode entrar por mais amanhã. Trigger avisa em todos de uma vez, e
-- não fica devendo no que for escrito depois.
--
-- É também o único caminho possível: `notificar()` tem EXECUTE revogado de
-- `authenticated` e `anon`, então só é chamável de dentro de outra função
-- SECURITY DEFINER — que é exatamente o que um trigger é.
-- ══════════════════════════════════════════════════════════════════

create or replace function public.trg_notificar_reserva_evento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento record;
begin
  select titulo, slug, inicia_em into v_evento
  from public.eventos where id = new.evento_id;

  if v_evento is null then
    return new;
  end if;

  perform public.notificar(
    new.usuario_id,
    'evento_reservado',
    'Seu lugar está reservado em ',
    v_evento.titulo,
    '. Você recebe os lembretes por email e aqui.',
    '/evento/' || coalesce(v_evento.slug, ''),
    'ao_vivo',
    jsonb_build_object('evento_id', new.evento_id, 'inicia_em', v_evento.inicia_em),
    false   -- não é celebração: não vira toast na tela, só entra no sino
  );

  return new;
end;
$$;

drop trigger if exists trg_evento_reserva_notifica on public.evento_reservas;
create trigger trg_evento_reserva_notifica
  after insert on public.evento_reservas
  for each row execute function public.trg_notificar_reserva_evento();

-- ── LEMBRETE NO SINO, PARA O CRON ────────────────────────────────
--
-- Os mesmos quatro momentos do email, também no sino: é amanhã, é hoje,
-- começa em uma hora, estamos no ar. Quem está dentro da plataforma naquele
-- momento não deveria depender de abrir o email para saber.
--
-- O cron roda com a service role, que não tem `auth.uid()` e por isso não pode
-- chamar `notificar()` direto (EXECUTE revogado). Esta é a porta estreita:
-- recebe o momento, monta a frase e delega.
--
-- ⚠️ Nenhum deles é celebração. `p_celebracao = false` mantém tudo no sino e
-- fora do toast de tela cheia, que é reservado a conquista (subida de nível,
-- certificado, curso concluído). Um lembrete de agenda interrompendo a aula
-- que a pessoa está assistindo seria o oposto do favor pretendido.
create or replace function public.notificar_lembrete_evento(
  p_usuario uuid,
  p_evento uuid,
  p_momento text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento record;
  v_hora text;
  v_prefixo text;
  v_sufixo text;
begin
  if p_momento not in ('vespera', 'hoje', 'comecando', 'ao_vivo') then
    return null;
  end if;

  select titulo, slug, inicia_em into v_evento from public.eventos where id = p_evento;
  if v_evento is null then
    return null;
  end if;

  -- Sempre no relógio de Brasília, como todo horário desta plataforma. Sem o
  -- `at time zone`, uma live das 20h viraria 23h para quem lê.
  v_hora := to_char(v_evento.inicia_em at time zone 'America/Sao_Paulo', 'HH24"h"MI');

  select
    case p_momento
      when 'vespera'   then 'É amanhã: '
      when 'hoje'      then 'É hoje: '
      when 'comecando' then 'Começa em uma hora: '
      when 'ao_vivo'   then 'Começou agora: '
    end,
    case p_momento
      -- Só a hora no sufixo: o prefixo já disse o dia, e "É amanhã: X.
      -- Amanhã às 20h00" repete a palavra em duas frases seguidas.
      when 'vespera'   then '. Às ' || v_hora || '.'
      when 'hoje'      then '. Às ' || v_hora || '.'
      when 'comecando' then '. Deixe a aba aberta.'
      when 'ao_vivo'   then '. A transmissão já está no ar.'
    end
  into v_prefixo, v_sufixo;

  -- Não repete: o cron passa de hora em hora e as janelas são
  -- propositalmente maiores que o intervalo entre duas passagens.
  if exists (
    select 1 from public.notificacoes
    where usuario_id = p_usuario
      and tipo = 'evento_' || p_momento
      and dados->>'evento_id' = p_evento::text
  ) then
    return null;
  end if;

  return public.notificar(
    p_usuario,
    'evento_' || p_momento,
    v_prefixo,
    v_evento.titulo,
    v_sufixo,
    '/evento/' || coalesce(v_evento.slug, ''),
    'ao_vivo',
    jsonb_build_object('evento_id', p_evento),
    false
  );
end;
$$;

revoke execute on function public.notificar_lembrete_evento(uuid, uuid, text) from public, authenticated, anon;
