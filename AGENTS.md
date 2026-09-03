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

# A aula ao vivo semanal, e a porta de UMA aula (02/09/2026)

**A estratégia, em uma frase:** a aula aberta de toda quarta é a isca que
aquece a base inteira do Nexus e transforma quem não é aluno em aluno. Ela
acontece de qualquer jeito — tira-dúvidas de cálculo e de negócio pericial —, o
e-mail vai para toda a base, e quem não é da casa encontra a oferta na própria
página do encontro.

O ciclo:

1. e-mail para a base com o link de `/evento/<slug>`;
2. a pessoa **reserva** (nome, e-mail, WhatsApp) e passa a receber os lembretes;
3. o contato atravessa para a base de marketing do Nexus com a tag
   `live-inscrito`;
4. na página, quem não está logado vê `ConviteNexus` — os seis produtos e o
   botão para `/inicio`;
5. **a segunda inscrição de quem não é da casa encontra a oferta no lugar do
   formulário.**

## O que conta é a INSCRIÇÃO, nunca a presença

Decisão do dono: *"se ela se inscreveu e não veio, é problema dela, que perdeu a
oportunidade."*

E é a única régua que se sustenta: a transmissão é do YouTube e esta plataforma
não sabe quem entrou na sala. Contar presença criaria a brecha que se descobre
em uma semana — reservar, faltar, e reservar de novo alegando que não gastou
nada. Inscrição é fato que este banco tem e que a própria pessoa produziu.

## `lib/evento/porta.ts` responde, e ninguém mais

⚠️ **"Da casa" são os DOIS lados**: acesso vigente aqui **ou** assinatura do
Nexus, perguntada por `/api/acesso/status`. Só o lado de cá não bastaria — um
assinante do Nexus que nunca abriu a Academy não tem conta aqui, e levaria "você
já usou sua aula gratuita" pagando R$1.497,90 por ano.

⚠️ **Acesso VIGENTE, e não "tem conta".** Ex-aluno com acesso vencido não é da
casa, e isso é escolha: ele é exatamente quem queremos de volta, e a aula aberta
é a melhor conversa que existe com ele.

⚠️ **As consultas de "é da casa" falham dizendo QUE SIM.** O erro é
assimétrico: deixar entrar um visitante a mais custa uma cadeira numa sala que
já ia acontecer; barrar um aluno custa o cliente. Vale para a leitura de
`acessos_conteudo` e para o Nexus fora do ar.

⚠️ **`NEXUS_ACESSO_KEY` AUSENTE é a exceção, e falha para o outro lado.** Env
que ninguém criou não é indisponibilidade: é configuração, e ela não se
conserta sozinha. Abrindo, toda pessoa vira assinante e **a porta nunca fecha
para ninguém** — a regra existiria no papel e não no produto, que é o preço que
o batimento da Academy já cobrou uma vez neste ecossistema.

Fechar é seguro por causa de uma garantia do outro lado: o cron
`academy-acesso` do Nexus dá concessão em `acessos_conteudo` a todo assinante
válido, e ela é verificada ANTES da chamada HTTP, no mesmo banco — o assinante
em dia nunca chega lá. ⚠️ É um **acoplamento declarado**: com o batimento
desligado E a chave ausente ao mesmo tempo, um assinante sem concessão levaria
a recusa. Ele lê na própria tela que provavelmente usou outro e-mail e que
basta entrar pela conta.

⚠️ **E-mail desconhecido NÃO volta 404 do `/api/acesso/status`.** Ele responde
200 com `encontrado: false` e `estado: 'liberado'`, porque "quem não é do Nexus
não é bloqueado pelo Nexus". Lendo só o estado, todo visitante do mundo seria
assinante e a porta nunca fecharia para ninguém.

⚠️ **`neq('evento_id')` separa "voltou na semana seguinte" de "corrigiu o
telefone".** Sem ele, o segundo submit do MESMO encontro seria recusado e a
pessoa levaria porta na cara por ter acertado um dado.

⚠️ **`eq` e nunca `ilike` no e-mail.** `_` é comum em endereço e é CORINGA no
like do Postgres: com `ilike`, `joao_silva@x.com` casaria `joaoXsilva@x.com` e
barraria um estranho.

## As duas chaves, e o que elas de fato alcançam

E-mail é a primeira; telefone é a segunda, com a mesma régua de
`lib/sequencias/identidade.ts` do Nexus — copiada de propósito, porque são dois
repositórios que não compilam juntos e o mesmo número é comparado dos dois lados.

⚠️ **`whatsapp_norm` NULO nunca entra na comparação.** Com o telefone vazio, um
`whatsapp_norm.is.null` casaria esta pessoa com todo mundo que também não deu
telefone, e a porta fecharia para a base inteira na segunda semana. O índice é
parcial para deixar isso explícito.

⚠️ **A coluna é escrita pela APLICAÇÃO, nunca por trigger.** Normalizar telefone
é regra, e ela já existe em duas cópias declaradas; uma terceira em plpgsql
seria a que diverge primeiro, porque ninguém a lê ao mudar a regra.

⚠️ **NOME NUNCA ENTRA.** Homônimo é comum, e a consequência de casar errado aqui
é dizer "você já usou sua aula" a quem nunca assistiu nenhuma — uma acusação, na
porta, para um lead que acabou de chegar.

⚠️ **O telefone é OPCIONAL no formulário e nem é pedido durante a transmissão.**
Então a porta fecha para quem se cadastrou direito e continua contornável por
quem digitar um endereço novo. Isso é **aceito**: exigir telefone para assistir
uma aula gratuita custa inscrições de verdade, e quem cria e-mail novo toda
semana também não estava perto de comprar.

## A recusa é a melhor tela de venda deste funil

`PortaFechada`, em `components/EventoPublicoContent.tsx`. Quem chega nela já
assistiu um encontro inteiro e voltou para pedir o próximo.

⚠️ **Não é erro de formulário, e por isso não é vermelho.** A borda é a mesma do
`.ev-forma` — pintá-la de erro leria como "seu cadastro falhou" e produziria um
chamado de suporte no lugar de uma venda. O texto não acusa: a pessoa fez
exatamente o que foi convidada a fazer.

Ela também diz o que fazer quando o motivo é outro e-mail — "entre pela sua
conta e o lugar já estará reservado" —, que é o caso que a régua do Nexus já
mediu três vezes: assinante que é aluno sob outro endereço.

## As duas coisas que precisam ser LIGADAS

1. ⚠️ **`aberto_ao_publico = true` no evento.** Sem ela a inscrição é recusada e
   o `ConviteNexus` **nem renderiza**. Medido em 02/09/2026: os cinco eventos
   existentes estão todos com a flag desligada, e `evento_inscricoes` tem zero
   linhas em toda a história — este caminho nunca rodou.
2. ⚠️ **`NEXUS_ACESSO_KEY` e `NEXUS_CONTATO_KEY` na Vercel desta plataforma**,
   com o mesmo valor de `ACESSO_STATUS_KEY` e `INTEGRACAO_CONTATO_KEY` do Nexus.
   Sem a primeira, ninguém é barrado (falha aberta). Sem a segunda, **o lead da
   live não chega à base de marketing** — a live acontece e não capta nada.

## Não existe evento recorrente, e não pode existir

⚠️ **Um registro servindo várias quartas quebraria tudo que pendura nele:**
`evento_inscricoes` é por `evento_id`, os três lembretes são por evento, e a
porta da aula única conta ENCONTROS DISTINTOS. Com um registro só, a pessoa se
inscreveria uma vez e viria para sempre — o oposto exato da regra.

Então cada quarta é um registro, e o que se automatiza é a **cópia**:
`repetirEvento(id, semanas)` em `app/admin/agenda/actions.ts`, com o botão
"Repetir +7 dias" na lista da agenda. A cópia nasce **rascunho** e a tela leva
direto ao editor dela — quem repetiu ainda precisa colar o link da transmissão,
e devolver a pessoa para a lista deixaria um rascunho invisível que ela
descobriria na quarta-feira.

⚠️ **A cópia NÃO leva o `link_transmissao` nem o `gravacao_url`.** Campo
preenchido não pede para ser revisto: os inscritos da semana que vem cairiam
numa transmissão encerrada, e a gravação de outro encontro seria anunciada como
a desta semana.

⚠️ **Mas `gravacao_thumb_url` FICA, apesar do nome.** Ela não é a miniatura da
gravação: é a CAPA do encontro — `evento-publico.ts` a expõe como `imagemUrl`, e
é ela que vira a imagem do cartão do WhatsApp, que o `generateMetadata` do
`/evento/[slug]` chama de "a metade do recurso". A arte da série é a mesma toda
semana; perdê-la seria perder metade do convite sete dias por vez.

⚠️ **`somarSemanasEmBrasilia` e nunca `+ 7 * 24 * 60 * 60 * 1000`.** Somar
milissegundos preserva o instante em UTC, não o relógio de parede. O Brasil não
tem horário de verão desde 2019 — mas isso é lei, não física, e no dia em que
voltar a aula das 11h nasceria às 10h uma vez só, sem nada acusando. É a mesma
razão pela qual `lib/evento/relogio.ts` existe.

## `/aula` — o endereço que não muda

Cada semana tem slug próprio, e um e-mail, um anúncio ou a bio do Instagram não
podem depender de alguém trocar a URL sete dias por vez.
`evolua.peritosacademy.com.br/aula` leva sempre ao **próximo encontro aberto**.

⚠️ **A live EM ANDAMENTO vence a próxima.** Quem clica às 11h05 precisa cair na
sala que está no ar, não na da semana que vem — por isso a busca do que está
acontecendo agora é uma consulta separada e vem primeiro.

⚠️ **Sem próxima marcada, ele NÃO cai no encontro passado.** A página de um
evento encerrado não mostra o formulário de reserva: quem veio pelo e-mail de
hoje encontraria um convite de duas semanas atrás, sem nada para clicar, e
concluiria que a live acabou para sempre. A tela diz a verdade e oferece um
caminho.

⚠️ **`robots: noindex`.** O conteúdo da URL muda toda semana; indexada, o Google
guardaria o resumo de agosto e o mostraria em outubro. Quem entra no índice é
`/evento/<slug>`, que descreve um encontro e não muda mais.

# A sala de venda: o que a página do encontro faz enquanto a live acontece (02/09/2026)

A live é onde o pitch é feito em voz alta. Estas cinco decisões existem para que
a tela acompanhe a fala — e nenhuma delas é cosmética.

## O apresentador LIBERA a oferta; ela não fica ligada

`eventos.oferta_liberada`, alternada por `alternarOfertaDoEvento` num botão que
mora **na própria página do encontro**, visível só para `ehDaCasa` e só
enquanto está no ar.

A faixa ficava visível a live inteira. Quem entra às 11h e encontra a oferta já
na tela lê a aula como um infomercial de uma hora — e a promessa desta live é o
contrário: uma hora resolvendo o problema da pessoa, sem pauta fechada. A
oferta vale mais dita uma vez, na hora certa, do que exposta sessenta minutos
até virar paisagem.

⚠️ **O botão não fica no `/admin`.** Durante a transmissão a tela aberta é esta;
mandar o apresentador abrir outra aba no meio do pitch é o mesmo que não ter o
botão.

⚠️ **O REALTIME É A METADE QUE FAZ O RECURSO EXISTIR.** Sem ele a faixa só
apareceria para quem desse F5 — e ninguém recarrega a página no meio de uma
transmissão. O apresentador clicaria, veria a oferta na PRÓPRIA tela e
concluiria que funcionou, com a sala inteira sem ver nada: a "falha que
funciona". `eventos` entrou na publicação `supabase_realtime` e ganhou
`replica identity full`, senão o payload do UPDATE chega sem as colunas que não
mudaram e o cliente não sabe de qual evento é a linha.

⚠️ **A cópia da semana seguinte NÃO herda o interruptor** (`repetirEvento`).
Herdado, a live nova abriria com a faixa na tela às 11h — exatamente o que ele
existe para evitar.

⚠️ **Mesma permissão da moderação do chat**, e não uma nova: quem pode esconder
a mensagem de alguém na frente da sala é quem conduz. Segunda régua para o mesmo
poder é a que fica desatualizada.

## Quem cala a oferta é "JÁ ASSINA", nunca "está logado"

`EventoPublico.ehAssinanteNexus`. A regra era `!logado`, com o argumento de que
aluno não precisa que expliquem a casa. O argumento caiu junto com o fato: a
Academy tem **425 alunos logados que não têm o ecossistema** — têm um sexto
dele — e são o melhor público de venda da base, o mesmo que o e-mail B do plano
mensal já trata como "a peça que deve vender". A regra antiga silenciava a
oferta exatamente para eles, dentro da sala em que a venda é feita.

⚠️ **Duas chaves, porque uma só erra.** `perfis.nexus_status` marca 54 pessoas
quando existem 117 assinantes: ele só é escrito quando alguém entra por SSO. A
segunda é `acessos_conteudo` com `origem = 'nexus'`, a concessão que o batimento
diário do Nexxus escreve aqui — 93 linhas. Na dúvida o portão falha **calando**:
mostrar demais custa um cliente irritado; esconder custa uma venda que volta.

Vale para as duas peças — a faixa da live e o `ConviteNexus` do rodapé.

## A faixa só aparece para quem já está DENTRO

`jaEstaDentro` = reservado (com conta) ou inscrito (sem conta). Quem ainda não
entrou está vendo o botão ou o formulário, e duas perguntas na mesma tela não
somam: dividem, e a pessoa responde sempre a que pede menos dela — perdendo a
inscrição, que é o único dado que sobrevive ao fim da live.

## Dá para reservar DEPOIS que a live começa

O bloco de ação inteiro vivia dentro de `estado === 'agendado'`, e o efeito só
aparecia na hora: às 11h05 o botão sumia da tela. O convidado ainda tinha o
formulário (ele fica fora daquela fila), mas o **aluno logado que não reservou
antes ficava sem caminho nenhum** — enquanto o rodapé do chat continuava dizendo
"Reserve seu lugar acima para falar no chat", apontando para um botão que já não
existia. É a hora em que mais gente chega, e falar no chat É o produto desta
live.

Só o "Adicionar ao calendário" continua preso a `agendado`.

## "Entrar agora" da agenda vai para a PÁGINA, nunca para o YouTube

Mandar direto para o link da transmissão parece o caminho curto e é o que
esvazia a sala: no YouTube não existe o chat da casa, não existe a oferta ao
vivo e não existe a inscrição — a pessoa sai da plataforma e a live vira um
vídeo assistido por um anônimo. A página tem o player embutido: quem clica vê a
transmissão do mesmo jeito, com o resto em volta.

O link cru continua sendo o fallback do encontro sem slug e do Zoom/Meet.

## O WhatsApp é obrigatório ANTES da live, e não durante

Ele era opcional pelo argumento de que cada campo a mais é gente a menos —
verdade que continua valendo, e o custo está escrito no fonte. O que ele compra
é maior: o telefone é a **segunda chave** da porta da aula única, e sem ele
sobra só o e-mail, que é grátis de criar. É também o que vira
`contatos.telefone` na base do Nexxus, onde a operação fala por WhatsApp.

⚠️ **Durante a transmissão ele continua fora da tela**: ali a pessoa quer
perguntar agora, e o terceiro campo é o que a faz desistir. Quem entra no meio
da live já está dentro.

⚠️ A exigência roda no **servidor** também, e quem responde "estamos no ar?" é o
relógio contra `inicia_em` — nunca uma flag mandada pela tela, que é justamente
o que um chamador omitiria para pular a regra.

## A capa: 1200×630, com o conteúdo nos 240 px centrais

`gravacao_thumb_url` serve dois recortes muito diferentes, e é por isso que uma
arte "grande o bastante" ainda sai cortada:

| onde | proporção | o que aparece |
|---|---|---|
| cartão do WhatsApp (`og:image`) | 1,91:1 | quase tudo |
| `.ev-capa` na página | **1048 × 210**, ~5:1 | só os **240 px centrais** |

Medido no DOM em produção. Logo e texto fora dessa faixa são cortados sem nada
avisar — foi o que aconteceu com a primeira arte, que tinha o play em cima e o
horário embaixo.

## O chat tem emoji, e a paleta é curta de propósito

24 fixos, sem dependência: um seletor de verdade são centenas de KB carregados
por todo mundo que abre a página, inclusive quem só veio assistir. Num chat de
uma hora o que se usa é reação.

⚠️ Insere no **cursor**, não no fim — quem quer um emoji no meio da frase teria
de reescrever a mensagem, e é isso que faz ninguém usar a paleta uma segunda
vez. ⚠️ O `maxLength` do input **não vale para escrita por código** (emoji custa
2 unidades UTF-16), então a guarda dos 500 é explícita. ⚠️ E os 25 botões são
`type="button"`: botão dentro de `<form>` é submit por padrão, e escolher um
emoji mandaria a mensagem pela metade.

⚠️ As regras de CSS da paleta existem para **vencer `.ev-chat-forma button`**,
que pinta todo botão do formulário como o círculo creme do enviar — sem elas, a
paleta vira 25 botões de enviar lado a lado. É a mesma família de "classe de CSS
inventada não dá erro em lugar nenhum": aqui a classe existe e a especificidade
é que estava errada.

# ⚠️ Push que não vira deploy não avisa ninguém (02/09/2026)

Aconteceu nesta data: o push de um commit para `main` **não gerou build na
Vercel**. Sem erro, sem e-mail, sem nada — o código no GitHub e a produção
seguindo com o comportamento antigo. O sintoma foi eu procurar na página um
recurso que "já tinha subido" e não achar.

O sinal é `vercel ls` não mostrar um deployment novo depois do push. O
desempate é um commit vazio, que reenfileira na hora.

⚠️ **E cuidado com a verificação por `curl`**: quase tudo que se acrescenta
nesta página é gateado por sessão (`ehDaCasa`, `logado`, `inscrito`). Procurar o
texto novo no HTML de fora dá "não subiu" para código que subiu — foi o que me
custou três esperas nesta sessão. Confira pelo id do deployment, ou logado no
navegador.
