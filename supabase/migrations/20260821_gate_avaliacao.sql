-- 20260821_gate_avaliacao.sql
--
-- Quem pode ler o quê da sequência nova.
--
-- `curso_sequencia` é só a ORDEM do conteúdo (títulos de aula e de avaliação, que
-- já são legíveis por RLS) — liberada, porque é ela que as telas usam pra montar
-- o trilho. Manter a ordem numa fonte só é o ponto: três cópias do mesmo
-- algoritmo em TS foi o que deixou a trava furada por meses.
grant execute on function public.curso_sequencia(uuid) to authenticated, anon;

-- `progresso_pendencia` recebe o usuário como argumento, então segue interna:
-- só é chamada de dentro de outra função SECURITY DEFINER, que herda o
-- privilégio do dono. Mesmo padrão de notificar() — e revogar de PUBLIC não
-- basta, o Supabase concede EXECUTE direto pra authenticated/anon.
revoke execute on function public.progresso_pendencia(uuid, uuid, uuid) from authenticated, anon, public;

-- A porta que a tela usa: pergunta pelo usuário da sessão, nunca por um id
-- arbitrário. Devolve o que falta ANTES desta avaliação, pra página poder
-- barrar e dizer o nome do que falta.
create or replace function public.avaliacao_pendencia(p_avaliacao uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_curso uuid;
begin
  if v_uid is null then
    return jsonb_build_object('bloqueado', true, 'tipo', 'login');
  end if;
  if public.is_admin_papel(v_uid) then
    return jsonb_build_object('bloqueado', false);
  end if;

  select curso_id into v_curso from public.avaliacoes where id = p_avaliacao and publicado;
  if v_curso is null then
    return jsonb_build_object('bloqueado', false);
  end if;

  return public.progresso_pendencia(v_uid, v_curso, p_avaliacao);
end;
$$;

revoke execute on function public.avaliacao_pendencia(uuid) from anon, public;
grant execute on function public.avaliacao_pendencia(uuid) to authenticated;
