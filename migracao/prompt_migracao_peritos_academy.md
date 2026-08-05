# TAREFA: Migração de alunos da Ensinio para a Peritos Academy

## Contexto

Estamos migrando 718 alunos da plataforma Ensinio para a nova Peritos Academy. O arquivo de migração já está pronto (`migracao_peritos_academy_FINAL.xlsx`) e contém todos os dados necessários. Sua tarefa é criar o script/funcionalidade de importação dentro da plataforma.

## O que precisa ser feito

### 1. Entender a estrutura atual do banco de dados
Antes de qualquer coisa, analise o schema do banco de dados da plataforma. Identifique:
- Tabela de usuários (users/profiles)
- Tabela de assinaturas/planos (subscriptions/plans)
- Tabela de acessos a cursos (enrollments/course_access)
- Como a plataforma controla permissões (roles, planos, grupos)
- Como a plataforma controla vencimento de acesso

### 2. Criar tabela de registro de migração
Precisa existir uma tabela `migration_records` (ou nome equivalente no padrão do projeto) para manter o histórico de migração. Campos necessários:
- `id` (PK)
- `user_id` (FK para o usuário criado)
- `email`
- `nome_completo`
- `plano_origem` (o produto/plano que ele tinha na Ensinio)
- `grupo_origem` (Grupo 1 - Compra Ativa / Grupo 2 - Migrado/Promoção)
- `tipo_acesso_origem` (Vitalício, Assinatura, Produto Avulso etc.)
- `valor_pago_origem` (quanto pagou na Ensinio)
- `data_compra_origem` (quando comprou na Ensinio)
- `acesso_concedido` (o nível de acesso na plataforma nova)
- `regra_vencimento` (Vitalício ou Até o vencimento)
- `data_vencimento` (data de expiração do acesso, null se vitalício)
- `migrated_at` (timestamp da migração)
- `source_platform` (valor fixo: "Ensinio")

### 3. Criar o script de importação
O script deve ler o arquivo XLSX e para cada aluno:

**a) Criar o usuário** na plataforma (se não existir pelo email):
- email, primeiro_nome, sobrenome, telefone
- Gerar senha temporária aleatória (o aluno vai redefinir no primeiro acesso)
- Marcar como `migrated = true` ou flag equivalente

**b) Conceder os acessos** conforme a regra do plano:

| Plano de Origem | Acesso na Plataforma Nova | Vencimento |
|---|---|---|
| Membro Fundador Infinity (128) | Acesso total | Vitalício |
| Grupo Antigo Infinity (19) | Acesso total | Vitalício |
| Black Friday 2023 (112) | Tudo EXCETO: PJE Calc, Biblioteca de Planilhas, Revisão PREVI, Lei 14905/2024, Planilhas Jornada de Trabalho, Super Endividamento, MasterClass, Desapropriação, Precatórios | Vitalício |
| Assinatura Ultra (57) | Acesso total | Até a data na coluna "Validade" |
| Assinatura Pro (7) | Acesso total | Até a data na coluna "Validade" |
| Assinatura Premium (3) | Tudo EXCETO: Biblioteca de Planilhas | Até a data na coluna "Validade" |
| Peritos Academy Experience (1) | Tudo EXCETO: Biblioteca de Planilhas | Até a data na coluna "Validade" |
| Desafio Viver de Perícia (74) | Tudo EXCETO: Biblioteca de Planilhas | Até a data na coluna "Validade" |
| Revisão PASEP (264) | Apenas: Curso PASEP | Até a data na coluna "Validade" |
| PJE Calc e Liquidação de Sentença (42) | Apenas: Curso PJE Calc | Até a data na coluna "Validade" |
| Planilha Super Endividamento (33) | Apenas: Planilha Super Endividamento | Até a data na coluna "Validade" |
| Planilha RMC e RCC (4) | Apenas: Planilha RMC e RCC | Até a data na coluna "Validade" |
| Modelos E-mails que Vendem Milhões (22) | Apenas: Curso E-mails que Vendem Milhões | Até a data na coluna "Validade" |

**c) Registrar a migração** na tabela de histórico.

**d) Um aluno pode ter MÚLTIPLAS linhas** no arquivo (comprou mais de um produto). Nesse caso:
- O usuário é criado UMA vez
- Cada produto gera um registro de acesso separado
- Cada produto gera um registro na tabela de migração
- Os acessos se SOMAM (se tem Fundador Infinity + PASEP avulso, ele tem acesso total vitalício + o PASEP com vencimento, mas na prática o acesso total já cobre)

### 4. Controle de vencimento automático
A plataforma precisa ter (ou você precisa criar) um mecanismo que:
- Verifica a `data_vencimento` do acesso do aluno
- Quando a data passa, bloqueia automaticamente o acesso aos cursos/conteúdos daquele plano
- Alunos com vencimento "Vitalício" NUNCA são bloqueados

### 5. Fluxo de primeiro acesso do aluno migrado
O aluno migrado precisa de um fluxo diferente no primeiro login:
- Recebe email com link para definir senha (não mandar a senha temporária por email)
- Ao entrar pela primeira vez, já encontra seus acessos liberados
- Idealmente, uma mensagem de boas-vindas específica para migrados

## Formato do arquivo de importação

O arquivo `migracao_peritos_academy_FINAL.xlsx` tem estas colunas:

```
Grupo | Nome Completo | Primeiro Nome | Sobrenome | Email | Telefone |
Produto/Plano | Acesso na Plataforma Nova | Regra de Vencimento | Validade |
Tipo de Acesso | Valor Pago | Data da Compra | Origem |
Qtd Cursos Acessados | Cursos Acessados
```

- **Validade**: "Vitalício" para quem não vence, ou data no formato `YYYY-MM-DD` para quem tem vencimento
- **Acesso na Plataforma Nova**: texto descritivo do nível de acesso (usar para mapear para os IDs de cursos/planos da plataforma)
- Arquivo tem 766 linhas (718 emails únicos, alguns com mais de um produto)

## Observações importantes

1. **NÃO disparar emails automáticos de boas-vindas** durante a importação em lote. Os emails de migração serão enviados separadamente com comunicação específica.
2. **Fazer backup do banco** antes de rodar a importação.
3. **Rodar primeiro em modo dry-run** (sem escrever no banco) para validar que tudo está correto.
4. **Gerar log** de tudo que foi feito: usuários criados, acessos concedidos, erros encontrados.
5. **Tratar duplicatas**: se o email já existe na plataforma, não criar novo usuário, apenas adicionar os acessos e registrar a migração.
6. O arquivo está disponível neste projeto. Coloque-o na raiz ou em `/scripts/migration/` conforme a estrutura do projeto.
