-- ============================================================
-- O PERFIL NASCE COM ENDEREÇO PÚBLICO
--
-- `perfis.slug` só era preenchido dentro de `salvarPerfil` (app/perfil/
-- actions.ts) — ou seja, quando a pessoa abria o perfil e clicava em salvar.
-- Ninguém migrado fez isso: em 11/08/2026, 432 dos 433 perfis estavam sem slug.
--
-- O sintoma aparecia no menu do avatar: "Perfil público" apontava para
-- `/perito/${slug ?? ''}`, que vira `/perito/` — rota que não casa com
-- `/perito/[slug]` e devolve 404. Praticamente toda a base clicava e via erro.
--
-- O backfill (scripts/backfill-slugs-perfis.mjs) resolveu quem já existia. Esta
-- migração resolve quem vem depois: a conta criada pelo SSO do Nexus nasce pelo
-- trigger `criar_perfil`, que gravava só `id` e `nome`.
--
-- ── POR QUE A UNICIDADE É PARTE DO CONSERTO, E NÃO UM EXTRA ──
--
-- `carregarPeritoPublico` busca com `.single()`, que ERRA quando mais de uma
-- linha casa. Dois perfis com o mesmo slug não deixam um "ganhar": derrubam a
-- página pública DOS DOIS, e nenhum dos dois descobre por quê. Gerar slug pelo
-- nome sem desempate criaria exatamente isso — só nesta base já são 3 homônimos.
--
-- Por isso vêm juntos: a função que acha um slug livre e o índice único que
-- garante que ele continue livre. O índice é parcial (`where slug is not null`)
-- para não brigar com perfis antigos que porventura fiquem sem slug.
--
-- Rodar no SQL Editor do Supabase (ver CLAUDE.md — migração é ação manual).
-- ============================================================

-- ============================================================
-- 1. SLUGIFICAR
-- ============================================================
-- Mesma regra do JS em app/perfil/actions.ts. As duas precisam concordar: se
-- divergirem, a primeira pessoa a salvar o perfil muda de endereço sozinha e
-- quebra o link que ela já tinha divulgado.
--
-- `translate` em vez de `unaccent`: a extensão pode não estar instalada, e uma
-- migração que depende de extensão falha no primeiro ambiente que não a tem.
create or replace function public.slugificar_nome(p_nome text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      trim(both '-' from
        regexp_replace(
          regexp_replace(
            regexp_replace(
              lower(translate(
                coalesce(p_nome, ''),
                'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
                'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
              )),
              '[^a-z0-9[:space:]-]', '', 'g'),
            '[[:space:]]+', '-', 'g'),
          '-+', '-', 'g')
      ),
    ''),
  'perito');
$$;

-- ============================================================
-- 2. ACHAR UM SLUG LIVRE
-- ============================================================
-- Desempate numérico e estável: quem chegou primeiro mantém o endereço limpo, o
-- seguinte vira `-2`. Trocar o endereço de quem já tem quebraria link divulgado.
create or replace function public.slug_livre(p_nome text, p_id uuid default null)
returns text
language plpgsql
stable
as $$
declare
  v_base text := public.slugificar_nome(p_nome);
  v_slug text := v_base;
  v_n int := 2;
begin
  while exists (
    select 1 from public.perfis
    where slug = v_slug and (p_id is null or id <> p_id)
  ) loop
    v_slug := v_base || '-' || v_n;
    v_n := v_n + 1;
    -- Teto: 200 homônimos é sinal de outra coisa acontecendo (importação em
    -- loop, nome vazio virando 'perito'). Melhor um endereço feio e único do
    -- que um laço que segura o cadastro.
    if v_n > 200 then
      return v_base || '-' || left(md5(random()::text), 6);
    end if;
  end loop;
  return v_slug;
end;
$$;

-- ============================================================
-- 3. O ÍNDICE ÚNICO
-- ============================================================
-- Conferido antes de criar: 433 perfis, 0 slugs duplicados. Parcial porque slug
-- pode ser nulo em linha antiga, e vários nulos não colidem entre si.
create unique index if not exists uq_perfis_slug
  on public.perfis (slug)
  where slug is not null;

-- ============================================================
-- 4. O TRIGGER
-- ============================================================
-- Único ponto alterado em relação à versão anterior
-- (20260805_criar_perfil_suprime_boas_vindas_migrado): o insert passa a gravar
-- o slug. O corte das boas-vindas por `migrado_de` continua idêntico — é o que
-- segura o e-mail do aluno importado em lote, e um ensaio de 3 alunos já
-- disparou 3 e-mails reais quando ele não existia.
create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_nome text := coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1));
  v_slug text := public.slug_livre(v_nome);
begin
  -- ⚠️ O insert é protegido contra corrida. Duas contas criadas no mesmo
  -- instante podem calcular o mesmo slug antes de qualquer uma gravar, e aí o
  -- índice único derrubaria a SEGUNDA — ou seja, o cadastro falharia por causa
  -- de um endereço público. Sufixo aleatório e segue: entrar na plataforma vale
  -- mais que um slug bonito.
  begin
    insert into public.perfis (id, nome, slug)
    values (new.id, v_nome, v_slug)
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.perfis (id, nome, slug)
    values (new.id, v_nome, public.slugificar_nome(v_nome) || '-' || left(md5(random()::text), 6))
    on conflict (id) do nothing;
  end;

  -- Importação em lote: a comunicação é feita à parte, com texto próprio.
  -- NÃO REMOVER sem antes conferir scripts/migration/README.md — é o que
  -- segura o e-mail de boas-vindas dos alunos migrados.
  if new.raw_user_meta_data ? 'migrado_de' then
    return new;
  end if;

  perform net.http_post(
    url := 'https://peritos-academy.vercel.app/api/internal/email-evento',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.email_internal_secret()
    ),
    body := jsonb_build_object('tipo', 'boas_vindas', 'usuario_id', new.id)
  );

  return new;
end;
$function$;
