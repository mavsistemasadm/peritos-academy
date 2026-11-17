-- 20261117_avaliacao_materiais.sql
--
-- A avaliação passa a ter arquivos próprios ("autos do caso").
--
-- Na Ensinio a avaliação era uma aula com anexos (o processo a ser lido, o
-- contrato, o cartão de ponto). Na migração as perguntas viraram `avaliacoes`
-- e os anexos ficaram sem lugar: 17 avaliações perderam 36 arquivos, e a prova
-- pedia processos que o curso nunca entregou (chegou pela aluna da
-- "Leitura e interpretação", 17/11/2026). Ver CLAUDE.md, "Arquivos da avaliação".
--
-- Mesmo desenho de aula_materiais: path no bucket privado `materiais-aulas`,
-- download só por URL assinada, leitura liberada a quem pode abrir o curso.

create table if not exists public.avaliacao_materiais (
  id uuid primary key default gen_random_uuid(),
  avaliacao_id uuid not null references public.avaliacoes(id) on delete cascade,
  nome text not null,
  tipo text not null default 'pdf' check (tipo in ('pdf','xlsx','docx','zip','outro','link')),
  arquivo_url text,          -- path dentro do bucket materiais-aulas
  link_url text,             -- alternativa a arquivo (https)
  tamanho_bytes bigint,
  ordem integer not null default 1,
  criado_em timestamptz not null default now(),
  constraint avaliacao_materiais_arquivo_ou_link check (arquivo_url is not null or link_url is not null)
);

create index if not exists idx_avaliacao_materiais_avaliacao on public.avaliacao_materiais (avaliacao_id, ordem);

alter table public.avaliacao_materiais enable row level security;

drop policy if exists avaliacao_materiais_leitura on public.avaliacao_materiais;
create policy avaliacao_materiais_leitura on public.avaliacao_materiais for select
  using (
    is_admin_papel(auth.uid(), array['super_admin','conteudo'])
    or exists (
      select 1 from public.avaliacoes av
      where av.id = avaliacao_materiais.avaliacao_id
        and tem_acesso_curso(auth.uid(), av.curso_id)
    )
  );

drop policy if exists avaliacao_materiais_admin_insert on public.avaliacao_materiais;
create policy avaliacao_materiais_admin_insert on public.avaliacao_materiais for insert
  with check (is_admin_papel(auth.uid(), array['super_admin','conteudo']));

drop policy if exists avaliacao_materiais_admin_update on public.avaliacao_materiais;
create policy avaliacao_materiais_admin_update on public.avaliacao_materiais for update
  using (is_admin_papel(auth.uid(), array['super_admin','conteudo']))
  with check (is_admin_papel(auth.uid(), array['super_admin','conteudo']));

drop policy if exists avaliacao_materiais_admin_delete on public.avaliacao_materiais;
create policy avaliacao_materiais_admin_delete on public.avaliacao_materiais for delete
  using (is_admin_papel(auth.uid(), array['super_admin','conteudo']));

-- Storage: o arquivo da avaliação é lido por quem pode abrir o curso dela.
-- A policy antiga só olhava aula_materiais, então o download daria 404.
drop policy if exists materiais_aulas_leitura on storage.objects;
create policy materiais_aulas_leitura on storage.objects for select
  using (
    bucket_id = 'materiais-aulas'
    and (
      is_admin_papel(auth.uid(), array['super_admin','conteudo'])
      or exists (
        select 1
        from public.aula_materiais am
        join public.aulas au on au.id = am.aula_id
        join public.modulos m on m.id = au.modulo_id
        where am.arquivo_url = objects.name
          and tem_acesso_curso(auth.uid(), m.curso_id)
      )
      or exists (
        select 1
        from public.avaliacao_materiais vm
        join public.avaliacoes av on av.id = vm.avaliacao_id
        where vm.arquivo_url = objects.name
          and tem_acesso_curso(auth.uid(), av.curso_id)
      )
    )
  );

-- O texto e o vídeo de instruções que a avaliação tinha na Ensinio.
-- Não são enfeite: nas provas de cálculo é o texto que traz os parâmetros
-- (data do cálculo, RMA, citação, prescrição). Sem ele a prova não tem como
-- ser feita. `briefing` continua sendo a chamada curta de "O Caso".
alter table public.avaliacoes add column if not exists instrucoes text;
alter table public.avaliacoes add column if not exists video_url text;
