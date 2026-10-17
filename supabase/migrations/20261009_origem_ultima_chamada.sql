-- 20261009_origem_ultima_chamada.sql
--
-- A concessão de quem compra em A Última Chamada (nov/2026), escrita pelo
-- Nexus (lib/black/academy-vitalicia.ts). Origem própria para que o batimento
-- do Nexxus, que só mexe na linha 'nexus', nunca desligue a Academy vitalícia
-- desta compra.

alter table acessos_conteudo drop constraint if exists acessos_conteudo_origem_check;
alter table acessos_conteudo add constraint acessos_conteudo_origem_check
  check (origem = any (array['migracao_ensinio', 'admin', 'assinatura', 'nexus', 'ultima_chamada']));

-- Verificação
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'acessos_conteudo_origem_check';
