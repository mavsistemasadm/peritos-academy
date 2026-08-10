<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Entrar pelo Nexus (`/api/nexus-sso`)

O aluno clica no cartão "Peritos Academy" no painel do Nexus e cai em
`/api/nexus-sso` com o access_token dele na query. A rota valida esse token em
`https://www.nexuspericial.com.br/api/auth/token`, garante a conta daqui e
devolve a pessoa logada, sem senha. É o mesmo contrato dos outros cinco
produtos do ecossistema — a Academy era a única sem.

**A rota não libera conteúdo.** Quem decide o que abre continua sendo
`tem_acesso_plataforma`, `tem_acesso_curso` e `tem_acesso_biblioteca`,
alimentados por `assinaturas` e `acessos_conteudo`. Entrar pelo Nexus é uma
porta, não uma chave: quem chegar sem direito vê a plataforma pedindo
assinatura, igual ao login normal. Confundir as duas coisas daria o acervo
inteiro a qualquer conta do Nexus, e o sintoma só apareceria em quem abrisse
um curso.

**`NEXUS_SSO_EMAILS` é a flag, e ela falha FECHADA.** Vazia ou ausente =
ninguém entra por aqui. É o oposto do padrão do resto do ecossistema, de
propósito: um SSO que libere por engano abre sessão em nome de outra pessoa,
enquanto um que recuse por engano manda o aluno para a tela de login que ele já
usava ontem. A entrada está estreando com um email antes de valer para os 403
alunos migrados. Para abrir a todos, o caminho é remover a chamada a
`emailLiberado` — não encher a lista.

O Nexus tem a env espelho, `ACADEMY_SSO_EMAILS`, que decide se o painel
**oferece** a entrada automática. Ela não é a fechadura: a URL do SSO é
adivinhável e um link colado à mão não passa pelo painel. Quem recusa é a env
daqui.

**A sessão é fechada no servidor, e a ordem importa.** O caminho óbvio seria
redirecionar para o magic link, como faz o Ache um Perito. Aqui não funcionaria:
o link do Supabase devolve os tokens no fragmento da URL, e quem consome
fragmento é o cliente de browser — que nesta plataforma só é instanciado dentro
do submit do formulário (ver `components/LoginContent`). O aluno cairia numa
tela de login já autenticado, olhando dois campos vazios. Então o `verifyOtp`
roda no servidor, e a resposta de redirect é criada **antes** dele: cookie
gravado em outro objeto não viaja no `NextResponse.redirect`, e o sintoma seria
um SSO que "funciona" e devolve a tela de login, sem erro em lugar nenhum.

`perfis.nexus_status` é escrito aqui quando o Nexus diz que a pessoa é
assinante — é a integração que `20260805_nexus_status_admin` antecipava. Só
sobe, nunca desce: um SSO vê quem apareceu, não quem cancelou, e escrever
'cancelled' daqui apagaria a marcação feita à mão pelo admin.
