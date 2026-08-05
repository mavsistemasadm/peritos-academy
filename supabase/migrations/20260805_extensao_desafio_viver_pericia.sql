-- ============================================================
-- Extensão de acesso: Desafio Viver de Perícia -> 2026-12-31
--
-- Decisão comercial: os 74 alunos migrados desse produto vinham da Ensinio
-- com validade entre 2026-08-10 e 2026-08-25 — 73 deles perdiam acesso em
-- menos de 15 dias contados da importação (2026-08-05), o que faria a
-- comunicação de migração chegar junto com o bloqueio. Acesso estendido até
-- 31/12/2026 para todos.
--
-- A REGRA de acesso não muda: continua escopo 'total' sem concessão de
-- biblioteca ("Tudo EXCETO: Biblioteca de Planilhas"). Só a data de vigência
-- é alterada.
--
-- `greatest()` em vez de atribuição direta: se algum dia esta migração for
-- reaplicada depois de uma extensão maior, ela não encurta ninguém.
--
-- `migracao_alunos.data_vencimento` NÃO é alterada de propósito — aquela
-- tabela é o registro histórico do que veio da Ensinio, e a validade original
-- precisa continuar auditável. A vigência real de acesso mora em
-- acessos_conteudo.
-- ============================================================

update public.acessos_conteudo a
set expira_em = greatest(a.expira_em, date '2026-12-31'),
    observacao = coalesce(a.observacao, '')
      || ' | acesso estendido até 2026-12-31 (decisão comercial 2026-08-05; validade original da Ensinio: '
      || to_char(a.expira_em, 'YYYY-MM-DD') || ')'
where a.origem = 'migracao_ensinio'
  and a.ativo
  and not a.vitalicio
  and exists (
    select 1 from public.migracao_alunos m
    where m.acesso_id = a.id
      and m.plano_origem = 'Desafio Viver de Perícia'
      and m.importado
  );
