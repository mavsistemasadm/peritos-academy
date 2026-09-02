-- ══════════════════════════════════════════════════════════════════
-- 20260902_uma_aula_gratuita.sql
--
-- A aula ao vivo semanal é aberta, e quem não é da casa assiste UMA. A régua
-- inteira está em lib/evento/porta.ts; aqui fica só o que o banco precisa ter
-- para ela ser respondida sem varrer a tabela.
--
-- ⚠️ A COLUNA É ESCRITA SÓ PELA APLICAÇÃO, e isso é deliberado.
--
-- Normalizar telefone é regra ("tira o DDI só quando sobra número", "tira o
-- nono dígito"), e ela já existe em duas cópias declaradas — aqui e no Nexus,
-- que compara o mesmo número quando o contato atravessa a ponte. Uma terceira
-- cópia em plpgsql seria a que diverge primeiro, porque ninguém a lê ao mudar
-- a regra. Por isso não há trigger: quem grava `whatsapp` grava
-- `whatsapp_norm` junto, no mesmo insert.
-- ══════════════════════════════════════════════════════════════════

alter table evento_inscricoes
  add column if not exists whatsapp_norm text;

comment on column evento_inscricoes.whatsapp_norm is
  'Telefone canônico (só dígitos, sem DDI, sem o nono) para casar a pessoa entre encontros. Escrito por lib/evento/porta.ts:normalizarTelefone — nunca por trigger.';

-- ⚠️ O índice é PARCIAL, e o `where` não é economia de espaço.
--
-- O WhatsApp é opcional no formulário, e durante a transmissão nem é pedido:
-- a maioria das linhas vai ter a coluna nula. Uma consulta que casasse nulo
-- com nulo diria que todo mundo sem telefone já é a mesma pessoa — a trava que
-- lib/sequencias/identidade.ts do Nexus registra como o teste mais importante
-- daquele arquivo. O parcial deixa isso explícito no próprio índice.
create index if not exists evento_inscricoes_whatsapp_norm_idx
  on evento_inscricoes (whatsapp_norm)
  where whatsapp_norm is not null;

-- Casar por e-mail entre encontros: hoje só existe o unique (evento_id, email).
create index if not exists evento_inscricoes_email_idx
  on evento_inscricoes (lower(email));

-- ─────────────────────────────────────────────────────────────
-- Verificação
-- ─────────────────────────────────────────────────────────────
-- select column_name from information_schema.columns
--   where table_name = 'evento_inscricoes' and column_name = 'whatsapp_norm';
-- select indexname from pg_indexes where tablename = 'evento_inscricoes';
