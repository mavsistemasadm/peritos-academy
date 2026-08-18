-- ============================================================
-- Materiais de aula: quem pode LER o objeto no bucket privado deixa de ser
-- decidido pelo FORMATO DO CAMINHO e passa a ser decidido pelo VÍNCULO real
-- (a linha em aula_materiais que aponta pro arquivo).
--
-- Como estava (20260805, migração dos alunos da Ensinio): a policy resolvia
-- aula → módulo → curso por `split_part(objects.name,'/',1) = aulas.id`,
-- porque o upload do admin grava o caminho como `{aula_id}/{uuid}-{nome}`.
--
-- Só que os 408 materiais importados da Ensinio foram gravados com caminho
-- `{curso-slug}/{aula-slug}/{arquivo}`. O primeiro segmento desses nunca é
-- um uuid de aula, então a policy não casava com NENHUM deles: 408 arquivos
-- em 218 aulas, ou seja, todo material que existe hoje na plataforma.
--
-- O sintoma não era "acesso negado", era "Não foi possível gerar o link.
-- Tente de novo." — createSignedUrl falha quando a RLS esconde o objeto — e
-- o efeito colateral era pior que o download: baixar todos os materiais é
-- critério de conclusão da aula, então essas 218 aulas ficaram impossíveis
-- de concluir, travando a sequência do curso inteiro para o aluno.
--
-- Ninguém percebeu porque admin passa por `is_admin_papel` antes de chegar
-- na regra do caminho, e o teste de ponta a ponta da feature foi feito com
-- um arquivo enviado pelo admin — o único formato de caminho que casava.
--
-- A regra nova não olha o caminho: exige uma linha em aula_materiais cujo
-- arquivo_url seja exatamente o nome do objeto, e acesso ao curso dessa
-- aula. Vale para os dois formatos e para qualquer formato futuro. Arquivo
-- órfão (sem linha) fica invisível para aluno, que é o correto.
-- ============================================================

drop policy if exists materiais_aulas_leitura on storage.objects;

create policy materiais_aulas_leitura on storage.objects
for select
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
        and public.tem_acesso_curso(auth.uid(), m.curso_id)
    )
  )
);
