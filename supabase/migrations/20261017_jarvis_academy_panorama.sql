-- ══════════════════════════════════════════════════════
-- O PANORAMA DA ACADEMY PARA O JARVIS — 17/10/2026
--
-- O Jarvis (assistente de voz do dono, repositório jarvis-nexus) responde
-- "como está a Academy?" e "o que está esperando eu responder?" lendo esta
-- função, e não montando consultas próprias: as definições (o que é aluno
-- ativo, o que é dúvida sem resposta) moram aqui, num lugar só.
--
-- Fechada para anon e authenticated: o Jarvis chama com a chave de serviço.
-- Devolve nomes de alunos nas pendências (é o que ele precisa para responder),
-- então nunca pode ser chamável do navegador.
-- ══════════════════════════════════════════════════════

create or replace function public.jarvis_academy_panorama()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ativ as (
    -- Atividade = qualquer lançamento no extrato de gamificação (login diário,
    -- aula, avaliação, comunidade). É o mesmo sinal que o perfil usa.
    select usuario_id, max(criado_em) as ultima from gamificacao_extrato group by usuario_id
  ),
  duvidas_abertas as (
    -- Pergunta de aluno (sem parent) que nenhum especialista respondeu.
    select d.id, d.texto, d.criada_em, d.autor_nome, a.titulo as aula
    from aula_duvidas d
    left join aulas a on a.id = d.aula_id
    where d.parent_id is null and not coalesce(d.e_especialista, false)
      and not exists (select 1 from aula_duvidas r where r.parent_id = d.id and coalesce(r.e_especialista, false))
  ),
  desafios_corrigir as (
    -- Desafio de correção manual (sem quesitos) protocolado e ainda sem nota.
    select e.id, e.entregue_em, ds.titulo, p.nome
    from desafio_entregas e
    join desafios ds on ds.id = e.desafio_id
    left join perfis p on p.id = e.usuario_id
    where e.entregue_em is not null and e.corrigido_em is null
      and jsonb_array_length(coalesce(ds.quesitos, '[]'::jsonb)) = 0
  )
  select jsonb_build_object(
    'alunos', jsonb_build_object(
      'perfis', (select count(*) from perfis where coalesce(status, 'ativo') = 'ativo'),
      'ativos_7d', (select count(*) from ativ where ultima >= now() - interval '7 days'),
      'ativos_30d', (select count(*) from ativ where ultima >= now() - interval '30 days'),
      'novos_7d', (select count(*) from perfis where criado_em >= now() - interval '7 days'),
      'novos_30d', (select count(*) from perfis where criado_em >= now() - interval '30 days'),
      'pararam', (select count(*) from ativ where ultima < now() - interval '14 days' and ultima >= now() - interval '60 days'),
      'nota_pararam', 'estudavam nos últimos 60 dias e estão há 14 ou mais sem nenhuma atividade'
    ),
    'aprendizado_7d', jsonb_build_object(
      'aulas_concluidas', (select count(*) from aula_progresso where concluida and concluida_em >= now() - interval '7 days'),
      'certificados', (select count(*) from certificados where emitido_em >= now() - interval '7 days'),
      'avaliacoes_aprovadas', (select count(*) from gamificacao_extrato where criado_em >= now() - interval '7 days' and referencia_tipo = 'avaliacao_quiz')
    ),
    'pendencias', jsonb_build_object(
      'duvidas_sem_resposta', (select count(*) from duvidas_abertas),
      'duvidas', coalesce((select jsonb_agg(jsonb_build_object('aluno', autor_nome, 'aula', aula, 'texto', left(texto, 220), 'quando', criada_em) order by criada_em)
                           from (select * from duvidas_abertas order by criada_em limit 8) x), '[]'::jsonb),
      'desafios_para_corrigir', (select count(*) from desafios_corrigir),
      'desafios', coalesce((select jsonb_agg(jsonb_build_object('aluno', nome, 'desafio', titulo, 'entregue_em', entregue_em) order by entregue_em)
                            from (select * from desafios_corrigir order by entregue_em limit 8) y), '[]'::jsonb)
    ),
    'lives', coalesce((
      select jsonb_agg(jsonb_build_object(
        'titulo', ev.titulo, 'inicia_em', ev.inicia_em, 'slug', ev.slug,
        'aberta_ao_publico', ev.aberto_ao_publico,
        'reservas_alunos', (select count(*) from evento_reservas r where r.evento_id = ev.id),
        'inscritos_convidados', (select count(*) from evento_inscricoes i where i.evento_id = ev.id and i.cancelado_em is null)
      ) order by ev.inicia_em)
      from (select * from eventos where publicado and inicia_em >= now() - interval '3 hours' order by inicia_em limit 5) ev
    ), '[]'::jsonb)
  )
$$;

revoke execute on function public.jarvis_academy_panorama() from public, anon, authenticated;
