-- 20261117_certificado_publico.sql
--
-- O certificado ganha endereço: /certificado/{numero} (verificação pública) e
-- /certificado/{numero}/pdf (o arquivo). Até aqui o botão "PDF" do perfil não
-- tinha ação nenhuma e o link de verificação dava 404, para os 328
-- certificados emitidos.

-- 1. A leitura pública de UM certificado, com o nome de quem o recebeu.
--    `perfis` só é legível por anon quando perfil_publico = true, e a
--    verificação de um certificado não pode depender disso: quem recebe o link
--    (um juiz, um cliente) precisa ver de quem é. Por isso a função devolve só
--    o nome, e nada mais do perfil.
--    Carga horária: a do certificado, senão a do curso AGORA. Hoje nenhum
--    curso tem carga preenchida; quando o admin preencher, os certificados já
--    emitidos passam a mostrá-la sem precisar regravar nada.
create or replace function public.certificado_publico(p_numero text)
returns table (
  numero text,
  nome text,
  curso_titulo text,
  curso_slug text,
  nota numeric,
  carga_horas integer,
  emitido_em timestamptz,
  perito_slug text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.numero,
         p.nome,
         coalesce(cu.titulo, c.curso_titulo),
         coalesce(cu.slug, c.curso_slug),
         c.nota,
         coalesce(c.carga_horas, round(cu.carga_horas)::int),
         c.emitido_em,
         case when p.perfil_publico then p.slug end
  from public.certificados c
  join public.perfis p on p.id = c.usuario_id
  left join public.cursos cu on cu.id = c.curso_id
  where c.numero = upper(trim(p_numero))
    and c.emitido_em is not null
  limit 1
$$;

revoke all on function public.certificado_publico(text) from public;
grant execute on function public.certificado_publico(text) to anon, authenticated;

-- 2. O aluno deixa de escrever na própria linha de certificado.
--    Com o link de verificação funcionando, as policies abaixo viravam uma
--    fábrica de certificado: qualquer aluno logado podia inserir, pelo console,
--    um certificado de curso que nunca fez (ou trocar a nota do seu), e a
--    página pública o declararia válido. Quem emite é o banco
--    (emitir_certificado_interno, security definer, não passa por RLS).
drop policy if exists certificados_proprio_insert on public.certificados;
drop policy if exists certificados_proprio_update on public.certificados;

-- 3. A porta do aluno para a emissão, usada pela tela da aula como reserva
--    caso a emissão do banco não tenha acontecido. Mesma função, mesma
--    checagem de curso completo; o aluno só escolhe o curso, nunca o conteúdo.
create or replace function public.emitir_meu_certificado(p_curso_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.emitir_certificado_interno(auth.uid(), p_curso_id)
$$;

revoke all on function public.emitir_meu_certificado(uuid) from public, anon;
grant execute on function public.emitir_meu_certificado(uuid) to authenticated;
