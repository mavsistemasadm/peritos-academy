-- 20260821_avaliacao_na_sequencia.sql
--
-- A avaliação passa a ser um ITEM da sequência do curso, na posição dela, e não
-- mais um pedágio que só existia entre um módulo e o seguinte.
--
-- O que estava errado: a avaliação só travava a passagem PARA O MÓDULO SEGUINTE.
-- Dentro do módulo ela não travava nada — e como a aula de correção ("Resolução
-- Avaliação I", "Prova corrigida", "Desafio corrigido") é quase sempre a última
-- aula do próprio módulo, o vídeo com a resposta abria antes da pergunta. O aluno
-- assistia a correção, achava que tinha feito a avaliação, e só descobria o
-- contrário ao ser barrado no módulo seguinte por uma prova que ele nunca viu.
--
-- Modelo novo: `avaliacoes.posicao` = quantas aulas do módulo vêm ANTES dela.
-- posicao = 3 → a avaliação entra depois das 3 primeiras aulas e antes da 4ª.
-- posicao = null → fim do módulo (o comportamento antigo, que continua sendo o
-- default para avaliação nova).
--
-- É a contagem de aulas, e não o valor de `aulas.ordem`, de propósito: reordenar
-- as aulas de um módulo no admin não desloca a avaliação para o meio do conteúdo.

alter table public.avaliacoes
  add column if not exists posicao integer;

comment on column public.avaliacoes.posicao is
  'Quantas aulas do módulo vêm antes desta avaliação na sequência. null = fim do módulo.';

-- ---------------------------------------------------------------- backfill
-- Regra: a aula de correção vem sempre DEPOIS da sua avaliação. Onde o módulo
-- tem tantas aulas de correção quanto avaliações, o casamento é 1-a-1 na ordem
-- (a 1ª avaliação antes da 1ª correção, e assim por diante) — cobre 27 das 37.
with aulas_idx as (
  select a.id, a.modulo_id, a.titulo,
         (row_number() over (partition by a.modulo_id order by a.ordem, a.id) - 1)::int as idx
  from public.aulas a
),
correcoes as (
  select ai.*, row_number() over (partition by ai.modulo_id order by ai.idx) as k
  from aulas_idx ai
  where ai.titulo ~* '(resolu|corrigid|resolvid|gabarito)'
),
n_correcoes as (
  select modulo_id, count(*)::int as n from correcoes group by modulo_id
),
avals as (
  select av.id, av.modulo_id,
         row_number() over (partition by av.modulo_id order by av.ordem, av.id) as k,
         count(*) over (partition by av.modulo_id)::int as n
  from public.avaliacoes av
  where av.modulo_id is not null
)
update public.avaliacoes t
   set posicao = c.idx
  from avals a
  join n_correcoes nc on nc.modulo_id = a.modulo_id and nc.n = a.n
  join correcoes  c  on c.modulo_id  = a.modulo_id and c.k = a.k
 where t.id = a.id;

-- Os dois módulos que fogem do padrão (3 avaliações, 1 única aula de correção).
-- Posição decidida com o dono do produto: nenhuma avaliação é enfiada no meio do
-- conteúdo — elas se acumulam imediatamente antes da correção/encerramento, e a
-- prova final fica sempre depois da aula que a apresenta e antes da que a resolve.

-- "Aprenda a construir qualquer tabela de atualização monetária" (módulo único,
-- 9 aulas): aulas 0-6 conteúdo, 7 = "Resolução da Avaliação II", 8 = "Encerramento".
update public.avaliacoes av set posicao = 7
  from public.modulos m, public.cursos c
 where m.id = av.modulo_id and c.id = m.curso_id
   and c.titulo = 'Aprenda a construir qualquer tabela de atualização monetária'
   and av.titulo in ('Avaliação de conhecimento I', 'Avaliação de conhecimento II');

update public.avaliacoes av set posicao = 8
  from public.modulos m, public.cursos c
 where m.id = av.modulo_id and c.id = m.curso_id
   and c.titulo = 'Aprenda a construir qualquer tabela de atualização monetária'
   and av.titulo = 'Prova final';

-- "Cálculos revisionais de Cheque Especial" (módulo único, 10 aulas): aulas 0-7
-- conteúdo, 8 = "Sobre a Prova Final", 9 = "Resolução da prova final".
update public.avaliacoes av set posicao = 8
  from public.modulos m, public.cursos c
 where m.id = av.modulo_id and c.id = m.curso_id
   and c.titulo = 'Cálculos revisionais de Cheque Especial'
   and av.titulo in ('Avaliaçao de conhecimento I', 'Avaliação de conhecimento II');

update public.avaliacoes av set posicao = 9
  from public.modulos m, public.cursos c
 where m.id = av.modulo_id and c.id = m.curso_id
   and c.titulo = 'Cálculos revisionais de Cheque Especial'
   and av.titulo = 'Prova Final';

-- As 4 restantes (Desvendando mód. 2 e 4, Leitura mód. 3) não têm aula de
-- correção nenhuma: ficam no fim do módulo, que é exatamente o lugar certo —
-- posicao segue null, sem update.

-- ------------------------------------------------- sequência única do curso
-- Fonte da verdade da ordem: módulos → (aulas + avaliações intercaladas).
-- Todo gate — página do curso, página da aula, RPC de conclusão, RPC de
-- submissão — lê daqui. A divergência entre três cópias do mesmo algoritmo foi
-- justamente o que deixou a trava furada por meses.
create or replace function public.curso_sequencia(p_curso_id uuid)
returns table (
  seq int,
  tipo text,
  item_id uuid,
  titulo text,
  modulo_id uuid,
  modulo_ordem int,
  modulo_titulo text
)
language sql
stable
security definer
set search_path = public
as $$
  with mods as (
    select m.id, m.ordem, m.titulo,
           row_number() over (order by m.ordem, m.id) as m_idx
    from public.modulos m
    where m.curso_id = p_curso_id
  ),
  aulas_idx as (
    select a.id, a.titulo, a.modulo_id,
           (row_number() over (partition by a.modulo_id order by a.ordem, a.id) - 1)::int as idx
    from public.aulas a
    join mods m on m.id = a.modulo_id
  ),
  n_aulas as (
    select modulo_id, count(*)::int as n from aulas_idx group by modulo_id
  ),
  itens as (
    -- aula: entra na posição do próprio índice, com sub=1 (depois de uma
    -- avaliação que aponte para esse mesmo índice)
    select m.m_idx, ai.idx as pos, 1 as sub, 0 as ordem_av,
           'aula'::text as tipo, ai.id as item_id, ai.titulo,
           m.id as modulo_id, m.ordem as modulo_ordem, m.titulo as modulo_titulo
    from aulas_idx ai
    join mods m on m.id = ai.modulo_id

    union all

    -- avaliação de módulo: sub=0, então vem ANTES da aula de mesmo índice
    select m.m_idx, coalesce(av.posicao, coalesce(na.n, 0)) as pos, 0 as sub,
           coalesce(av.ordem, 0) as ordem_av,
           'avaliacao'::text, av.id, av.titulo,
           m.id, m.ordem, m.titulo
    from public.avaliacoes av
    join mods m on m.id = av.modulo_id
    left join n_aulas na on na.modulo_id = av.modulo_id
    where av.publicado = true

    union all

    -- prova de curso (modulo_id null): fecha o curso, depois de todo módulo
    select (select coalesce(max(m_idx), 0) + 1 from mods)::bigint, 0, 0,
           coalesce(av.ordem, 0),
           'avaliacao'::text, av.id, av.titulo,
           null::uuid, null::int, null::text
    from public.avaliacoes av
    where av.curso_id = p_curso_id and av.modulo_id is null and av.publicado = true
  )
  select (row_number() over (order by m_idx, pos, sub, ordem_av, titulo))::int as seq,
         tipo, item_id, titulo, modulo_id, modulo_ordem, modulo_titulo
  from itens
  order by m_idx, pos, sub, ordem_av, titulo;
$$;

revoke execute on function public.curso_sequencia(uuid) from anon;

-- ------------------------------------------------------------- a pendência
-- Devolve o PRIMEIRO item anterior ainda não cumprido — é o que trava, e é o
-- que a tela precisa nomear. Sem exceção para item já concluído: por decisão do
-- dono do produto (21/08/2026), a aula de correção que alguém concluiu antes da
-- prova volta a ficar trancada até a prova ser aprovada. O progresso gravado não
-- é apagado — quando a avaliação passa, a aula reaparece concluída e ninguém
-- precisa reassistir nada.
create or replace function public.progresso_pendencia(
  p_usuario uuid,
  p_curso_id uuid,
  p_item_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_seq int;
  v jsonb;
begin
  select s.seq into v_seq from public.curso_sequencia(p_curso_id) s where s.item_id = p_item_id;
  if v_seq is null then
    return jsonb_build_object('bloqueado', false);
  end if;

  select jsonb_build_object(
           'bloqueado', true,
           'tipo', s.tipo,
           'id', s.item_id,
           'titulo', s.titulo
         )
    into v
    from public.curso_sequencia(p_curso_id) s
   where s.seq < v_seq
     and not (case s.tipo
                when 'aula' then exists (
                  select 1 from public.aula_progresso ap
                  where ap.usuario_id = p_usuario and ap.aula_id = s.item_id and ap.concluida
                )
                else exists (
                  select 1 from public.avaliacao_tentativas t
                  where t.usuario_id = p_usuario and t.avaliacao_id = s.item_id and t.aprovado
                )
              end)
   order by s.seq
   limit 1;

  return coalesce(v, jsonb_build_object('bloqueado', false));
end;
$$;

revoke execute on function public.progresso_pendencia(uuid, uuid, uuid) from anon;
