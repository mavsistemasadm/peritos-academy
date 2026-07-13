-- ============================================================
-- CONFIGURAÇÕES: registro único config_plataforma (identidade, contato,
-- textos institucionais, comportamento, SEO). Sem RPCs — leitura pública
-- (todo o app lê, inclusive anon: middleware de manutenção e páginas
-- /termos e /privacidade não exigem login) e escrita só super_admin via RLS.
-- Rodado via Supabase MCP (ver CLAUDE.md — fluxo de trabalho).
-- ============================================================

create table if not exists public.config_plataforma (
  id int primary key default 1 check (id = 1),
  nome_plataforma text not null default 'Peritos Academy',
  slogan text,
  logo_url text,
  favicon_url text,
  email_suporte text,
  whatsapp_suporte text,
  instagram_url text,
  youtube_url text,
  linkedin_url text,
  termos_uso text,
  politica_privacidade text,
  texto_rodape text,
  pagina_inicial_pos_login text not null default '/',
  modo_manutencao boolean not null default false,
  mensagem_manutencao text,
  comunidade_ativa boolean not null default true,
  desafios_ativos boolean not null default true,
  agenda_ativa boolean not null default true,
  meta_titulo text,
  meta_descricao text,
  og_image_url text
);

alter table public.config_plataforma enable row level security;

-- Leitura pública de verdade (anon + authenticated): o middleware precisa
-- checar modo_manutencao pra visitantes deslogados, e /termos e /privacidade
-- são páginas públicas.
drop policy if exists config_plataforma_leitura_publica on public.config_plataforma;
create policy config_plataforma_leitura_publica on public.config_plataforma for select using (true);

drop policy if exists config_plataforma_admin_update on public.config_plataforma;
create policy config_plataforma_admin_update on public.config_plataforma for update
  using (public.is_admin_papel(auth.uid(), array['super_admin']))
  with check (public.is_admin_papel(auth.uid(), array['super_admin']));

insert into public.config_plataforma (
  id, nome_plataforma, slogan, pagina_inicial_pos_login,
  termos_uso, politica_privacidade, texto_rodape,
  meta_titulo, meta_descricao
) values (
  1, 'Peritos Academy', 'Do conhecimento à autoridade.', '/',
  '[rascunho — substituir antes do lançamento] Termos de uso da Peritos Academy.',
  '[rascunho — substituir antes do lançamento] Política de privacidade da Peritos Academy.',
  '© Peritos Academy. Todos os direitos reservados.',
  'Peritos Academy', 'Conhecimento aplicado. Autoridade construída.'
)
on conflict (id) do nothing;
