# Manual da Peritos Academy — tudo o que ela faz, e por quê

A plataforma de formação do perito judicial: **cursos, trilhas, biblioteca,
desafios, comunidade e certificação** — com uma jornada que faz o aluno voltar.

Escrito a partir do código em **20/08/2026**.

---

# PARTE 1 — A DOR

## 1.1 Ninguém ensina a ser perito

Não existe faculdade de perícia judicial. O contador, o engenheiro, o médico
aprendem a profissão deles — e a perícia se aprende **errando em processo real**,
com a nomeação na mão e o prazo correndo.

O que falta não é teoria. É **método, prática e a sequência certa**: por onde
começar, o que vem depois, o que fazer quando o juiz pede uma coisa que ninguém
te ensinou a responder.

## 1.2 E o curso que existe, ninguém termina

Este é o segundo problema, e ele é mais silencioso: quem compra curso online
assiste às duas primeiras aulas. Não por falta de vontade — por falta de
**motivo para voltar amanhã**.

Plataforma de curso comum é um repositório de vídeos. O aluno entra, olha a
lista de 40 aulas, sente o peso e fecha.

## 1.3 O que a Academy faz diferente

Ela transforma o estudo em **jornada com progresso visível**: XP, dez níveis,
sequência de dias, insígnias, desafios e certificado. Não é enfeite — é a
resposta ao problema real de qualquer curso online, que é **a segunda semana**.

---

# PARTE 2 — O QUE O ALUNO ENCONTRA

## 2.1 A anamnese

**Na tela:** `/anamnese`

Antes de recomendar qualquer coisa, a plataforma pergunta **quem é você**: de
onde vem, o que já sabe, onde quer chegar. É o que separa "aqui estão 40 aulas"
de "comece por aqui".

## 2.2 Cursos, trilhas e jornada

- **`/cursos`** — o catálogo.
- **`/curso/[slug]`** — o curso, com aulas e avaliações.
- **`/jornada`** — o caminho recomendado, na ordem que faz sentido para você.
- **`/biblioteca`** — o acervo de material de apoio.

**A dor que a trilha fecha:** catálogo é lista; trilha é caminho. Um aluno diante
de uma lista escolhe pelo título mais atraente e se perde; diante de uma trilha,
ele avança.

## 2.3 A gamificação — e ela é documentada dentro do produto

**Na tela:** `/gamificacao` — *"Como funciona sua jornada"*

Esta tela é a **documentação viva** da mecânica: os dez níveis, como cada um
credita XP, a regra de conclusão de aula e o sistema de sequência.

**Os dez níveis.** Subir exige **duas coisas ao mesmo tempo**: o XP mínimo **e**
o requisito daquele nível. Ter XP sobrando não basta — é o que impede a jornada
de virar corrida de pontos e mantém a formação como formação.

**A sequência (streak).** Acessar todo dia constrói uma sequência, com marcos
(7 dias, 30 dias) que creditam XP. O registro é **idempotente por dia**: entrar
cinco vezes conta uma.

⚠️ E uma decisão de engenharia que diz muito sobre o cuidado: **a gamificação
nunca derruba a página**. Se algo falha no registro do acesso, o aluno continua
estudando — o placar é acessório, o conteúdo é o produto.

**A dor:** aprender sozinho não tem retorno visível. Você estuda três semanas e
não vê nada mudar. O XP, o nível e a sequência **devolvem em dias o que a
carreira devolve em anos**.

## 2.4 Desafios

**Na tela:** `/desafios`

Prática com prazo e correção — o oposto de assistir aula. É onde o aluno
descobre se aprendeu de verdade, num ambiente onde errar não custa processo.

## 2.5 Comunidade

**Na tela:** `/comunidade`

Onde o aluno pergunta o que não perguntaria ao juiz e nem ao colega concorrente.
Perícia é profissão solitária; a comunidade é o corredor de faculdade que a
profissão nunca teve.

## 2.6 Agenda e avisos

- **`/agenda`** — encontros, aulas ao vivo, prazos.
- **Avisos** — o que a coordenação precisa comunicar.

## 2.7 Certificados

Conclusão gera **certificado**, gerado pela plataforma.

## 2.8 Perfil público do perito

**Na tela:** `/perito/[slug]`

A formação vira **vitrine**: o que você estudou aparece para quem procura um
perito.

⚠️ Isso costura com o **Ache um Perito** — o mesmo aluno, a mesma credencial, do
lado de quem contrata.

## 2.9 Meu plano

**Na tela:** `/meu-plano` — o que a sua assinatura abre, e o que falta.

---

# PARTE 3 — COMO O ACESSO FUNCIONA (e por que é rigoroso)

## 3.1 Três chaves, não uma

Quem decide o que abre são **três permissões distintas**:

| chave | abre |
|---|---|
| `tem_acesso_plataforma` | a plataforma |
| `tem_acesso_curso` | um curso específico (compra avulsa) |
| `tem_acesso_biblioteca` | o acervo |

**A dor que isso resolve:** quem comprou **um curso avulso** não comprou a
formação inteira. Sem essa separação, ou ele veria tudo (e ninguém assinaria),
ou não veria nada do que pagou.

⚠️ **A gamificação é fechada para o comprador avulso**, e por um motivo
específico: ela é a régua da formação inteira — níveis e ranking sobre um
catálogo que ele não abre. Mostrá-la seria exibir uma pontuação que ele **não
tem como subir**.

## 3.2 Entrar pelo Nexus, sem senha

O aluno clica no cartão da Academy no painel do Nexus e entra logado.

⚠️ **A porta não é a chave.** Entrar pelo SSO **não libera conteúdo**: quem
chega sem direito vê a plataforma pedindo assinatura, igual ao login normal.
Confundir as duas coisas daria o acervo inteiro a qualquer conta do Nexus — e o
sintoma só apareceria quando alguém abrisse um curso.

⚠️ **A trava do SSO falha FECHADA**, ao contrário do padrão do resto do
ecossistema, e de propósito: um SSO que libera por engano abre sessão **em nome
de outra pessoa**; um que recusa por engano manda a pessoa para a tela de login.
Os dois erros não têm o mesmo tamanho.

## 3.3 O episódio que vale contar

A abertura do SSO para toda a base do Nexus foi **removida e devolvida no mesmo
dia** — e o motivo não era acesso, era **e-mail**: o assinante que nunca foi
aluno passava a receber "Dar meu primeiro passo", depois o "primeira semana" e
depois a régua de inatividade, **sobre uma plataforma cujo conteúdo ele não
tem**.

A ordem correta ficou registrada: primeiro o sistema aprende a suprimir as
boas-vindas de quem entra por SSO, **depois** a porta se abre.

⚠️ E o detalhe que enganou por meses: o cartão do Nexus apontava para o LMS
**antigo**. O aluno migrado clicava e caía num login que já não era o dele, sem
erro em lugar nenhum. O endereço de hoje é `evolua.peritosacademy.com.br`, e ele
vive em **duas linhas, uma de cada lado** — mudança de endereço é deploy nos
dois repositórios.

---

# PARTE 4 — O LADO DA COORDENAÇÃO

**Na tela:** `/admin`

| área | o que gerencia |
|---|---|
| **Cursos e aulas** | catálogo, conteúdo, publicação |
| **Trilhas** | o caminho recomendado |
| **Avaliações** | provas e correção |
| **Desafios** | prática com prazo |
| **Certificados** | emissão |
| **Gamificação** | níveis, gatilhos de XP, insígnias |
| **Comunidade** | moderação |
| **Agenda** e **Avisos** | encontros e comunicados |
| **Usuários e acessos** | quem entra no quê |
| **Financeiro** | assinaturas |
| **Administradores** | permissões da equipe |

---

# PARTE 5 — O QUE A ACADEMY SE RECUSA A FAZER

- **Não libera conteúdo por porta de entrada.** SSO é acesso à sessão, não ao
  acervo.
- **Não mostra pontuação que o aluno não pode subir.**
- **Não deixa a gamificação derrubar o estudo** — falha no placar não trava a
  aula.
- **Não manda boas-vindas para quem não é aluno.**
- **Não conta cinco acessos no mesmo dia como cinco.**

---

# APÊNDICE — O caminho do aluno, do zero ao certificado

1. **`/anamnese`** — diga de onde você vem e onde quer chegar.
2. **`/jornada`** — comece pelo caminho recomendado, não pela lista.
3. **Aula por aula** — cada conclusão credita XP.
4. **Volte amanhã** — a sequência começa a contar.
5. **`/desafios`** — pratique onde errar não custa processo.
6. **`/comunidade`** — pergunte.
7. **Avaliação** — prove o que aprendeu.
8. **Certificado** — e o **perfil público** que mostra ao mercado o que você
   estudou.
