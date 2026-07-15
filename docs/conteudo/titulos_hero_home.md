# Títulos rotativos do hero da home · Peritos Academy

Lista final auditada: 100 títulos, todos nota 9+. Tom da marca: curto, bold, afirmativo, com ponto final. Mistura de boas-vindas, constância, identidade de perito, marca e produto. Rotação diária.

## Lista final (100)

1. Continue subindo.
2. Bom te ver de novo.
3. De volta ao jogo.
4. Você voltou. Isso importa.
5. Voltar já é vencer.
6. Hoje conta.
7. Faça o dia valer.
8. Hoje constrói amanhã.
9. Amanhã agradece o hoje.
10. A elite estuda hoje.
11. Bora pra aula.
12. A prática te espera.
13. Mostra a que veio.
14. A constância vence.
15. Sem pressa, sem pausa.
16. É sobre não parar.
17. Coragem é continuar.
18. O hábito te carrega.
19. Isso está virando hábito.
20. Respira e continua.
21. O jogo é longo.
22. Quem estuda, assina laudo.
23. O laudo começa aqui.
24. Preparo gera nomeação.
25. Um perito se faz assim.
26. Perito se forja no estudo.
27. Grandes peritos estudam.
28. Ninguém nasce perito.
29. Todo expert começou assim.
30. Hoje treina, amanhã assina.
31. Seu nome nos autos.
32. O fórum nota quem domina.
33. Quem domina, é chamado.
34. Técnica vira reputação.
35. De aluno a autoridade.
36. Confiança se calcula.
37. Seu futuro se calcula.
38. Domine o processo.
39. Sua planilha, sua arma.
40. Você prova com números.
41. Teoria hoje, laudo amanhã.
42. Impossível de ignorar.
43. Rumo à autoridade.
44. Construa sua autoridade.
45. Autoridade se conquista.
46. Isso é alta performance.
47. Excelência é repetição.
48. Sua vaga na elite.
49. O Selo te espera.
50. Cada aula soma.
51. De aula em aula.
52. Sua trilha te espera.
53. Siga o mapa.
54. O mapa está na sua mão.
55. Sua sequência importa.
56. Você está mais perto.
57. Você tem direção.
58. Sua história em curso.
59. Território em conquista.
60. Um degrau por dia.
61. Sobe que a vista melhora.
62. Disciplina é liberdade.
63. Aprender é o atalho.
64. Sem atalho, com método.
65. Método vence talento.
66. Repetição cria mestres.
67. O básico bem feito vence.
68. O esforço aparece.
69. Confiança vem da prática.
70. A técnica se constrói assim.
71. Estude como quem constrói.
72. Passo firme, olhar longe.
73. Progresso, não perfeição.
74. A rotina dos campeões.
75. Mais forte que ontem.
76. O ritmo é seu.
77. Isso te diferencia.
78. Isso é compromisso.
79. Você escolheu evoluir.
80. Seu futuro em construção.
81. Estude. O resto segue.
82. Clareza convence.
83. Precisão é assinatura.
84. Rigor é respeito.
85. Detalhe é diferencial.
86. Simples é sofisticado.
87. Prazo cumprido, nome feito.
88. Entrega constrói confiança.
89. Do estudo ao honorário.
90. Pronto para o próximo caso.
91. Faça por você.
92. Você é o investimento.
93. Aposta certa: você.
94. Quem entende, explica.
95. Reputação se estuda.
96. Presença constrói futuro.
97. Cada processo, uma chance.
98. O contraditório não te assusta.
99. Colhe quem estuda.
100. Que dia bom pra evoluir.

---

# PROMPT para o Claude Code

Implementar títulos rotativos no hero da home:

1. Criar `lib/titulosHero.ts` exportando o array com os 100 títulos EXATAMENTE como listados acima (copiar literalmente, sem reescrever nenhum).
2. Na home (server component), selecionar o título do dia de forma DETERMINÍSTICA: índice = hash simples de (data atual YYYY-MM-DD + user id) % 100. O título muda todo dia, é diferente entre usuários, mas é estável durante o dia (sem trocar a cada reload e sem hydration mismatch).
3. O título substitui o atual "Continue subindo." no hero, mantendo exatamente a mesma tipografia, quebra de linha natural e layout. O CSS deve aguentar títulos de 1 ou 2 linhas sem quebrar o layout (o maior tem ~30 caracteres).
4. O subtítulo dinâmico existente ("Você está em {curso}...") permanece como está.
5. Nada de client-side randomness. Nada de biblioteca. Build limpo, commit, push.
