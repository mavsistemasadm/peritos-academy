-- ══════════════════════════════════════════════════════════════════
-- O EVENTO GANHA ENDEREÇO PRÓPRIO — 2026-08-25
--
-- Até aqui um evento não tinha para onde apontar. Existia `/agenda`, a lista
-- inteira, e nada mais: não havia link que levasse a UM evento. Quem quisesse
-- convidar a base por WhatsApp mandava o endereço da agenda e pedia para a
-- pessoa procurar qual dos eventos era o da mensagem.
--
-- Este arquivo cria a única coisa que faltava no banco para isso: o `slug`.
--
-- ── POR QUE SLUG, E NÃO O UUID QUE JÁ EXISTE ──
--
-- O id serviria tecnicamente (`/evento/1107edae-be14-…`), e é exatamente o
-- tipo de link que ninguém clica: colado no WhatsApp ele não diz o que é, e
-- num grupo de peritos concorre com mensagem de gente. O slug carrega o
-- título — `/evento/aula-inaugural-de-boas-vindas` — e é a própria chamada.
--
-- ── O SLUG NASCE COM O EVENTO E NÃO MUDA DEPOIS ──
--
-- ⚠️ O trigger só gera slug no INSERT, e ao editar o título ele NÃO regenera.
-- Isso é a decisão central deste arquivo, não um esquecimento: o link já foi
-- colado em grupo de WhatsApp: corrigir uma vírgula no título dias depois
-- transformaria toda mensagem já enviada num 404, e ninguém seria avisado —
-- o aluno clica na véspera do evento, não abre, e some. Endereço divulgado é
-- compromisso público; título é texto de tela.
--
-- Para forçar um endereço novo, basta gravar `slug = null`: o trigger
-- recalcula na próxima escrita. É deliberado, explícito, e não acontece por
-- acidente.
--
-- ── UNICIDADE NÃO É EXTRA ──
--
-- `carregarEventoPublico` busca com `.single()`, que ERRA com mais de uma
-- linha — dois eventos com o mesmo slug derrubariam a página pública dos
-- dois, e o sintoma apareceria só no dia do evento. É o mesmo defeito que
-- `uq_perfis_slug` fechou em 11/08 para homônimos. E aqui a colisão é mais
-- provável que lá: "Plantão de dúvidas" é título que se repete todo mês, de
-- propósito. Daí o desempate `-2`, `-3`… e o índice único por trás.
-- ══════════════════════════════════════════════════════════════════

alter table public.eventos add column if not exists slug text;

-- Mesma transliteração de slugificar_nome(), com um padrão que faz sentido
-- aqui: um título que vire string vazia (só emoji, só pontuação) precisa de
-- endereço mesmo assim, e 'evento' é honesto onde 'perito' seria confuso.
create or replace function public.slugificar_evento(p_texto text)
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
                coalesce(p_texto, ''),
                'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
                'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
              )),
              '[^a-z0-9[:space:]-]', '', 'g'),
            '[[:space:]]+', '-', 'g'),
          '-+', '-', 'g')
      ),
    ''),
  'evento');
$$;

-- Desempate por sufixo numérico. Espelha slug_livre() de perfis; são funções
-- separadas porque olham tabelas diferentes, e juntá-las numa só com nome de
-- tabela dinâmico trocaria clareza por SQL montado em string.
create or replace function public.evento_slug_livre(p_titulo text, p_id uuid default null)
returns text
language plpgsql
stable
as $$
declare
  v_base text := public.slugificar_evento(p_titulo);
  v_slug text := v_base;
  v_n int := 2;
begin
  while exists (
    select 1 from public.eventos
    where slug = v_slug and (p_id is null or id <> p_id)
  ) loop
    v_slug := v_base || '-' || v_n;
    v_n := v_n + 1;
    -- Teto: 200 repetições do mesmo título é sinal de outra coisa (importação
    -- em laço). Melhor um endereço feio e único do que segurar a criação.
    if v_n > 200 then
      return v_base || '-' || left(md5(random()::text), 6);
    end if;
  end loop;
  return v_slug;
end;
$$;

create or replace function public.eventos_gerar_slug()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Só preenche o que está vazio. Editar o título de um evento já divulgado
  -- não mexe no endereço — ver o cabeçalho deste arquivo.
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := public.evento_slug_livre(new.titulo, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_eventos_gerar_slug on public.eventos;
create trigger trg_eventos_gerar_slug
  before insert or update on public.eventos
  for each row execute function public.eventos_gerar_slug();

-- Backfill: os eventos que já existem também precisam de endereço. Feito em
-- laço, e não num update de uma tacada, porque evento_slug_livre() consulta a
-- própria tabela — num update em massa todas as linhas leriam o estado
-- anterior e duas homônimas receberiam o mesmo slug, que é exatamente o que o
-- índice único abaixo recusaria.
do $$
declare
  r record;
begin
  for r in select id, titulo from public.eventos where slug is null or btrim(slug) = '' order by criado_em loop
    update public.eventos set slug = public.evento_slug_livre(r.titulo, r.id) where id = r.id;
  end loop;
end;
$$;

create unique index if not exists uq_eventos_slug on public.eventos (slug) where slug is not null;
