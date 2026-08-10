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

**A flag do piloto não existe mais, dos dois lados.** `NEXUS_SSO_EMAILS` aqui e
`ACADEMY_SSO_EMAILS` no Nexus estrearam a entrada automática com um email antes
dos 403 alunos migrados, e a saída prevista era esta: remover a chamada a
`emailLiberado`, não encher a lista. A entrada vale para toda a base desde
10/08/2026 — a fechadura continua sendo o token do Nexus, e entrar continua não
sendo ter acesso (ver o parágrafo acima).

⚠️ **O cartão do Nexus apontava para a Ensinio até esta mesma data.**
`membros.peritosacademy.com.br` é um CNAME de `dns.ensinio.com`, o LMS antigo, e
estava cravado à mão no painel. O aluno migrado clicava e caía num login que já
não era o dele, sem erro em lugar nenhum. O endereço desta plataforma vive hoje
em `ACADEMY_URL`, no `lib/acesso/academy.ts` do Nexus, e vale
`https://peritos-academy.vercel.app` enquanto não houver domínio próprio.
Quando houver, é aquela linha que muda — e só ela.

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
