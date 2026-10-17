-- ══════════════════════════════════════════════════════
-- O SINO TAMBÉM TOCA NO CELULAR, PELO NEXUS — 17/10/2026
--
-- Cada linha nova em `notificacoes` avisa /api/internal/push, que decide se
-- aquele tipo vai ao celular (lib/push/avisos.ts) e pede a entrega à central
-- de notificações do Nexus. A Academy não guarda aparelho nenhum: o aluno
-- instala só o Nexus no celular.
--
-- Gatilho no banco, e não nos call sites: os avisos nascem em quinze funções
-- SQL diferentes, e um tipo novo amanhã tocaria no celular sem ninguém lembrar
-- de ligar nada.
--
-- Sem filtro de tipo aqui, de propósito: a lista mora só no TS. Duas cópias
-- divergem no dia em que uma ganhar um tipo que a outra não tem.
--
-- ⚠️ O endereço vai cravado no SQL, como nos outros gatilhos com net.http_post
-- (ver "O endereço da plataforma" no CLAUDE.md). Trocar de domínio = trocar
-- aqui também.
--
-- ⚠️ Aplicar DEPOIS do deploy que cria /api/internal/push. Antes disso cada
-- aviso bateria num 404, sem estrago, mas sem push.
-- ══════════════════════════════════════════════════════

create or replace function public.push_ao_notificar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Nunca derruba o INSERT do aviso: push é conveniência, o sino é o registro.
  begin
    perform net.http_post(
      url := 'https://evolua.peritosacademy.com.br/api/internal/push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || public.email_internal_secret()
      ),
      body := jsonb_build_object('id', new.id)
    );
  exception when others then
    raise warning 'push_ao_notificar: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke execute on function public.push_ao_notificar() from public, anon, authenticated;

drop trigger if exists trg_push_ao_notificar on public.notificacoes;
create trigger trg_push_ao_notificar
  after insert on public.notificacoes
  for each row execute function public.push_ao_notificar();
