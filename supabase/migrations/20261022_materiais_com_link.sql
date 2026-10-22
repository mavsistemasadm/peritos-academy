-- Material de aula pode ser um LINK (22/10/2026, pedido do dono): um vídeo de
-- outra aula, uma página externa. Abre em aba nova e NÃO entra na exigência de
-- download para concluir a aula: `concluir_aula` só cobra materiais com
-- `arquivo_url`, e o link nunca tem arquivo.
alter table public.aula_materiais add column if not exists link_url text;

alter table public.aula_materiais drop constraint if exists aula_materiais_tipo_check;
alter table public.aula_materiais add constraint aula_materiais_tipo_check
  check (tipo = any (array['pdf','xlsx','docx','zip','outro','link']));

-- Link tem endereço https e nenhum arquivo; arquivo nunca tem endereço de link.
alter table public.aula_materiais drop constraint if exists aula_materiais_link_coerente;
alter table public.aula_materiais add constraint aula_materiais_link_coerente
  check (
    (tipo = 'link' and link_url ~ '^https://' and arquivo_url is null)
    or (tipo <> 'link' and link_url is null)
  );
