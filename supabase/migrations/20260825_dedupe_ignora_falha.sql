-- ══════════════════════════════════════════════════════════════════
-- O ÍNDICE DE DEDUPE PRECISA IGNORAR O QUE FALHOU — 2026-08-25
--
-- Complemento de 20260825_email_entrega_confirmada.sql. Lá, as CONSULTAS de
-- dedupe passaram a ignorar linhas `falhou`, para um email recusado poder ser
-- tentado de novo. Faltava a outra metade: o índice único ainda contava essas
-- linhas, então a segunda tentativa era recusada pelo banco antes de chegar a
-- qualquer lugar.
--
-- Era meio conserto, e meio conserto aqui é nenhum: a consulta diria "pode
-- mandar", o Resend mandaria, e o INSERT do registro estouraria o índice —
-- deixando um email enviado sem registro nenhum, que é pior que o estado
-- anterior.
--
-- ⚠️ Os índices ficam parciais (`where estado <> 'falhou'`), e não são
-- removidos: a garantia de "no máximo um envio bem-sucedido por
-- (destinatário, tipo, referência)" continua valendo, que é a razão de eles
-- existirem. O que muda é que uma tentativa fracassada deixa de ocupar a vaga.
--
-- E a linha da falha é MANTIDA, não apagada. Ela é o registro de que se tentou
-- e não deu, com o id do Resend ao lado — é por ela que se descobre um apagão
-- como o de 06/08 a 25/08 antes de três semanas passarem.
-- ══════════════════════════════════════════════════════════════════

drop index if exists public.uq_email_enviados_dedupe;
create unique index uq_email_enviados_dedupe
  on public.email_enviados (usuario_id, tipo, coalesce(ref_id, '__geral__'))
  where estado <> 'falhou';

drop index if exists public.uq_email_convidados_enviados;
create unique index uq_email_convidados_enviados
  on public.email_convidados_enviados (lower(email), tipo, coalesce(ref_id, '__geral__'))
  where estado <> 'falhou';
