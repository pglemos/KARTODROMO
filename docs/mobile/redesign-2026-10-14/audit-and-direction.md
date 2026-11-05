# Redesenho do aplicativo — 14/10/2026

Estado: direção “Interface nativa essencial” aprovada pelo responsável na página de propostas (opção `canon`). Implementação aplicada ao cliente Expo; verificação em `verification.md`. Propostas de layout não constituem app implementado ou publicado.

## Objetivo confirmado

Refazer integralmente o visual do cliente Expo/React Native, com equilíbrio entre reservas e experiência do piloto. Preservar a identidade do Kartódromo Internacional de Betim e os fluxos aprovados: agenda, reservas, cupons, pagamento, resultados oficiais, histórico e treino GPS pessoal.

## Evidências

- Código de todas as rotas, componentes compartilhados, navegação, ícone e splash revisado.
- APK v4 existente disponível no emulador Android API36; início capturado para comparação.
- Logo original: `public/brand/kib-logo.png`. Foto: `public/posters/home-karting.jpg`; foto adicional da chegada: `public/gallery/kart-grid.png`.
- Brandbook existente: `docs/brandbook-kartodromo.md`; sua paleta institucional e a integridade da logo orientam esta proposta do app. A documentação visual web da raiz contém referências operacionais antigas e não governa o aplicativo móvel.
- Referências de princípios: [Airbnb — reservas e experiências](https://news.airbnb.com/product-releases/airbnb-2025-summer-release), [Strava — organização de atividade e histórico](https://support.strava.com/en-us/articles/15402014-viewing-your-activity-history-on-strava), [F1 — navegação, personalização e dados de corrida](https://www.formula1.com/en/latest/article/formula-1-launches-new-website-and-personalised-mobile-app.1knZbPSCZ2tS2z6ADRn2Gs). Estas referências não representam um ranking mundial nem autorização para copiar marcas ou interfaces.

## Problemas materiais encontrados

| Prioridade | Área | Evidência e impacto | Correção proposta |
| --- | --- | --- | --- |
| P1 | Identidade | Home, autenticação e ícone usam um “K” inventado; a logo institucional está ausente | Aplicar os arquivos oficiais com contraste, proporção e respiro corretos |
| P1 | Sistema visual | Três paletas duplicadas; verde-lima `#c9f36a` e fundos esverdeados espalhados nas telas | Tokens semânticos únicos, identidade institucional, esquemas claro e escuro |
| P1 | Navegação | Barra com cinco textos e ícones explicitamente ocultos | Ícones consistentes por plataforma, rótulos legíveis e destinos estáveis |
| P1 | Tipografia | Rótulos de 9–10 e diversos estilos definidos por tela | Escala nativa de títulos, corpo e legendas, com suporte à escala do aparelho |
| P1 | Hierarquia | Cartões contêm títulos grandes, parágrafos introdutórios e botões repetidos | Cabeçalhos compactos, ações no contexto e agrupamentos funcionais |
| P1 | GPS | `disabled` também depende de `!tracking && !paused`, impedindo o primeiro início mesmo com permissão e pista configurada | Corrigir a condição e cobrir o estado inicial com regressão; manter a geometria real desabilitada |
| P1 | Reserva e login | Agenda envia visitante para login sem conservar `bateriaId`; login volta ao início | Conservar somente o identificador válido do horário escolhido e voltar à reserva |
| P2 | Formulários | Formulário longo, visual genérico, sem organização por tarefa; teclado exige revisão nativa | Agrupar participantes, cupom, pagamento e confirmação; garantir controles visíveis com teclado |
| P2 | Resultados | Um cartão alto por piloto, dentro de ScrollView sem reciclagem | Sessões e linhas compactas, números tabulares e lista apropriada para muitos resultados |
| P2 | Estados | Falta de dados, configuração pendente e falha operacional recebem apresentação semelhante | Distinguir vazio, indisponível, erro, carregamento e confirmação com próxima ação clara |
| P2 | Plataforma | Tema sempre escuro, status bar fixa e predictive Back desativado em configuração | Aparência coerente com o sistema, insets e navegação nativa; validar gesto Voltar |

Conclusão: a implementação tem controles rotulados e validações aproveitáveis, mas a identidade, a hierarquia e a linguagem dos componentes precisam ser substituídas. Desempenho real, teclado, VoiceOver/TalkBack e aparelhos físicos ainda exigem validação; a inspeção de fonte não comprova esses comportamentos.

## Cobertura obrigatória

| Superfície | Novo tratamento |
| --- | --- |
| Início | Marca original, fotografia real, reservar e acompanhar pilotagem com igual clareza |
| Agenda | Datas e horários fáceis de comparar; vagas e preço exclusivamente da API |
| Minhas reservas | Lista compacta com status financeiro/operacional distinguível; saída da conta acessível |
| Nova reserva | Dados do responsável e participantes, cupom, forma de pagamento e total do servidor |
| Detalhe / Pix / cartão | Resumo do pedido, status, QR real com contraste, copiar Pix e pagamento seguro |
| Resultados | Sessão, posição, kart, voltas e melhor volta organizados para leitura rápida |
| Meu histórico | Identidade validada, estado pendente e estado sem resultados claramente diferentes |
| GPS e treinos salvos | Cronômetro pessoal, precisão, consentimento e histórico; sem inventar mapa ou linha da pista |
| Login | Identidade da marca, e-mail/CPF, senha, recuperação e continuidade da reserva |
| Cadastro | Formulário legível, política acessível e mensagens claras |
| Recuperação, redefinição e verificação | Estados de processamento, confirmação, erro e retorno à conta |
| Ícone e splash | Identidade extraída da marca oficial, sem novo símbolo inventado |

## Propostas avaliadas antes da escolha

1. **Paddock Betim:** composição clara inspirada em passes pessoais, sem ticket ou QR fictício.
2. **Betim, seu lugar na pista:** fotografia real e reserva rápida, ao lado do histórico e treino; recomendação para o equilíbrio escolhido.
3. **Central de corrida:** grafite esportivo, informação compacta e forte leitura de programação/resultados.

Os arquivos de prévia usam a logo e a fotografia originais, sem gerar rostos, redesenhar a marca ou alterar os arquivos de origem. São comps vetoriais determinísticos de tela, não screenshots de um novo app. A ferramenta de geração de imagem falhou; não foi utilizada a alternativa paga por API.

## Limites de escopo

O redesenho alcança o aplicativo cliente. Não altera o site institucional, os programas Windows, o telão ou as integrações de produção. Seguem válidos o isolamento de contas, o total calculado pelo servidor, a distinção entre resultado oficial e GPS pessoal e as restrições atuais de homologação. Não serão inventados preços, disponibilidade, resultados, métricas, mapas, depoimentos ou contas.

## Verificação após implementação

Rodar regressões da sessão e dos fluxos alterados, lint, tipos, exportação e build Android. Capturar telas nativas em duas larguras de telefone, temas claro/escuro e fonte ampliada; conferir formulários com teclado, rolagem, Voltar e estados disponíveis. Agrupar os achados em uma correção e uma conferência final. A execução iOS depende de Xcode/runtime compatível; um browser de preview não comprova aparência no iPhone.

## Direção escolhida e execução

Referência aprovada: `.impeccable/mocks/decision/native.svg`. Superfícies claras e escuras conforme o sistema, verde institucional com contraste, marca e fotos originais, navegação de cinco destinos com símbolos nativos, listas compactas e formulários legíveis. Aplicar a todas as rotas existentes, corrigir a continuidade agenda/login/reserva e o início do GPS com regressões. Depois executar tipos, lint, exportação e QA Android em duas larguras e escala de fonte ampliada.
