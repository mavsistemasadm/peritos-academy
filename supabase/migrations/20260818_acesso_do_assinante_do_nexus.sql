-- ══════════════════════════════════════════════════════
-- O ASSINANTE DO NEXUS PASSA A EXISTIR AQUI DENTRO
--
-- A página de vendas do Nexus promete, com ✓ nos dois planos, "Peritos Academy
-- completa (60+ cursos, 9 áreas)". Até 18/08/2026 nada era escrito neste banco
-- quando alguém assinava: o webhook de pagamento do Nexus provisiona as CINCO
-- instâncias do plano-sync de lá (Opera, Galácticos, Financeiro, MH Ponto, Ache
-- um Perito) e a Academy é a SEXTA, que ficou de fora daquele sync.
--
-- Medido em 18/08/2026, contra os dois bancos de produção: dos 119 assinantes
-- do Nexus, 45 não tinham conta nenhuma aqui. Os 74 que funcionavam eram, sem
-- exceção, gente que JÁ ERA ALUNA antes de assinar — a conta existia por conta
-- própria. Nunca funcionou para quem chegou só pelo Nexus, e o sintoma foi o de
-- sempre: nenhum erro, nenhum log, a pessoa clicando no cartão do painel e
-- caindo numa tela de login onde nunca criou senha.
--
-- ── POR QUE UMA `origem` NOVA, E NÃO 'admin' NEM 'assinatura' ──
--
-- A concessão do assinante do Nexus é a única que **se renova sozinha e some
-- sozinha**: o Nexus empurra a data todo dia enquanto a assinatura estiver de
-- pé, e para de empurrar quando ela cai. Para fazer isso, o lado de lá precisa
-- saber quais linhas são dele.
--
-- Sem a marca, a renovação teria de mexer em qualquer linha `total` vigente da
-- pessoa — e aí ela alcançaria o vitalício da Black Friday 2023 e as concessões
-- que o operador deu à mão no /admin/acessos. Uma rotina automática que
-- reescreve a data de um acesso VITALÍCIO comprado em 2023 é exatamente o tipo
-- de estrago que não dá erro: a pessoa entra normal por meses e some no dia em
-- que o Nexus dela vencer.
--
-- 'assinatura' é a assinatura DAQUI (o Plano Premium de R$79,90, cobrado no
-- Asaas por esta plataforma). Reusá-la faria as duas cobranças diferentes
-- virarem a mesma linha, e o relatório de quem paga o quê deixaria de fechar.
-- ══════════════════════════════════════════════════════

alter table public.acessos_conteudo
  drop constraint if exists acessos_conteudo_origem_check;

alter table public.acessos_conteudo
  add constraint acessos_conteudo_origem_check
  check (origem in ('migracao_ensinio', 'admin', 'assinatura', 'nexus'));

-- A renovação diária busca por (usuario_id, escopo, origem). Sem índice ela é
-- um seq scan por assinante por dia — hoje são 119 pessoas e 500 linhas, e é
-- justamente por ser barato agora que passaria despercebido quando não for.
create index if not exists idx_acessos_conteudo_origem_nexus
  on public.acessos_conteudo (usuario_id, escopo)
  where origem = 'nexus' and ativo;

comment on column public.acessos_conteudo.origem is
  'De onde veio o direito: migracao_ensinio (importação de 2026-08), admin '
  '(concedido à mão no /admin/acessos), assinatura (o Plano Premium cobrado '
  'por esta plataforma) ou nexus (assinatura do Nexus Pericial — renovada e '
  'revogada pelo Nexus, nunca editada à mão aqui).';
