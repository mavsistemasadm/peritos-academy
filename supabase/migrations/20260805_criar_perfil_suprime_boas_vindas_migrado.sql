-- ============================================================
-- criar_perfil: não disparar boas-vindas para aluno importado em lote
--
-- O trigger `ao_criar_usuario` em auth.users chama
-- /api/internal/email-evento para TODO usuário novo. Numa importação em lote
-- (migração Ensinio, ~400 contas) isso envia a comunicação padrão de
-- boas-vindas para gente real — exatamente o que a spec da migração proíbe,
-- já que o texto da migração é outro e é enviado à parte.
--
-- Descoberto na prática: um ensaio de 3 alunos disparou 3 e-mails reais. O
-- corte existia no route handler, mas o handler que roda é o de PRODUÇÃO
-- (a URL abaixo é fixa) — código local e não deployado não protege nada.
--
-- Por isso o corte definitivo é aqui, no banco: se o usuário nasce com
-- `migrado_de` no metadata, nem se faz a chamada HTTP. Não depende de deploy,
-- não gasta requisição pra receber um "não envie" de volta, e funciona mesmo
-- se a Vercel estiver fora. O guard equivalente no route handler continua
-- existindo como segunda linha de defesa.
--
-- Único ponto alterado em relação à versão anterior: o `if` em volta do
-- net.http_post. O insert em perfis é idêntico.
-- ============================================================

create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

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
