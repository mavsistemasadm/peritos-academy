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

**`NEXUS_SSO_EMAILS` é a flag, e ela falha FECHADA.** Vazia ou ausente = ninguém
entra por aqui. É o oposto do padrão do resto do ecossistema, de propósito: um
SSO que libere por engano abre sessão em nome de outra pessoa, enquanto um que
recuse por engano manda a pessoa para a tela de login desta mesma plataforma.

⚠️ **Ela foi removida em 10/08/2026 e voltou no mesmo dia, e o motivo não é
acesso — é email.** `garantirConta` cria a conta com `origem: 'nexus_sso'` e
**sem** `migrado_de`, e o trigger `criar_perfil`
(`20260805_criar_perfil_suprime_boas_vindas_migrado`) só segura as boas-vindas
de quem tem `migrado_de`. Aberto para toda a base do Nexus, o assinante que
nunca foi aluno recebia "Dar meu primeiro passo" no primeiro clique, o
"primeira semana" sete dias depois e a régua de inatividade em seguida, sobre
uma plataforma cujo conteúdo ele não tem.

A ordem para abrir a todos é: primeiro o trigger aprender a suprimir
`origem = 'nexus_sso'`, depois remover a chamada a `emailLiberado`. Encher a
lista continua não sendo o caminho.

O Nexus tem a env espelho, `ACADEMY_SSO_EMAILS`, que decide se o painel
**oferece** a entrada automática. Ela não é a fechadura: a URL do SSO é
adivinhável e um link colado à mão não passa pelo painel. Quem recusa é a env
daqui.

⚠️ **O cartão do Nexus apontava para a Ensinio até esta mesma data.**
`membros.peritosacademy.com.br` é um CNAME de `dns.ensinio.com`, o LMS antigo, e
estava cravado à mão no painel. O aluno migrado clicava e caía num login que já
não era o dele, sem erro em lugar nenhum.

O endereço desta plataforma é `https://evolua.peritosacademy.com.br` desde
14/08/2026, e vive em **duas** linhas, uma de cada lado: `SITE_URL` em
`lib/site.ts` aqui, e `ACADEMY_URL` em `lib/acesso/academy.ts` no Nexus. São dois
repositórios que não compilam juntos, então mudança de endereço é deploy nos
dois — e as duas linhas precisam concordar, porque quem manda o aluno para cá é
o Nexus e quem escreve os links dos emails é este repositório.

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
