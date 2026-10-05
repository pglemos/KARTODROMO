# Verificação do redesign — 05/10/2026

## Resultado e ambiente

Site publicado na Cloudflare no Worker `kartodromo-site-2026`, com ligação ao serviço `kartodromo`. As duas rotas institucionais foram ativadas após a validação da prévia. O Worker original mantém o backend e pode receber novamente as rotas para reversão.

Browser/IAB não está disponível nesta sessão. A verificação usa Playwright com Chromium instalado no ambiente, com o proxy da sessão para o domínio público e verificação TLS ativa. Referência principal em 1505 × 1045; rotas em 1440 × 1000, 390 × 844 e 320 × 844. Movimento reduzido ativado nas capturas para comparação consistente.

## Verificações

- Build: 24 documentos HTML próprios, metadados, sitemap, fonts locais e assets otimizados.
- ESLint: sem erros nem avisos.
- 10 testes de regras e Worker: abertura/fechamento em Brasília, CPF, idade/altura/peso, duplicação de pilotos, contrato da API, rotas, cache, preservação de autorização e cookies, delegação de admin/telão.
- 72 verificações de rotas e larguras: conteúdo, título principal, ausência de sobreposição horizontal e erros de runtime.
- Nove auditorias WCAG A/AA automatizadas, com zero violações, em home, campeonatos, pista, locação, eventos, dúvidas, clube-painel, clube-regulamento e inscrição das 100 Milhas. O link da pista recebeu sublinhado para distinguir o destino além da cor.
- Filtros de campeonato e pista; 10 mapas por configuração e 30 no catálogo completo; lightbox com Escape.
- FAQ: busca por texto, expansão, resultado vazio e retorno às 12 respostas.
- Orçamento de evento: mensagem pronta por WhatsApp; revisão preserva os campos.
- Inscrição: protocolo somente após confirmação válida da API; estado de falha explícito, envio manual alternativo e preservação dos campos. Requisições de gravação simuladas no navegador, sem inscrições reais ou mensagens enviadas.
- Navegação mobile: abrir menu, Escape e foco restaurado; abas do clube com rolagem horizontal própria.
- Imagens verificadas nas 24 páginas do domínio público: zero arquivos quebrados. HTML da pista conferido também sem JavaScript.
- Serviço de inscrição real: payload vazio recebeu HTTP 400 com validação do backend original, sem gravação.

## Comparação visual

Os conceitos foram inspecionados diretamente com `view_image`, junto com capturas atuais do navegador. Cinco pontos principais conferidos: composição e hierarquia, texto e CTAs, tipografia, paleta e contraste, imagens e enquadramento. Também foram conferidos espaçamento, divisórias, ícones, continuidade entre seções e adaptação mobile.

| Ponto             | Referência / resultado                                                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primeiro viewport | Título editorial em duas linhas no desktop, ação principal verde, ação secundária contornada, fotografia à direita e dados abaixo. No mobile, título em três linhas mantém legibilidade. |
| Marca             | Logo original preservada, em lugar das marcas ilustrativas geradas nos conceitos. Área e altura do cabeçalho ajustadas para a proporção original.                                        |
| Tipografia        | Barlow Condensed 800 italic para impacto; Inter para corpo, controles, datas e formulários. Fontes hospedadas localmente.                                                                |
| Cor               | Asfalto #0b0d0b, superfícies #141714, branco #f4f5ef e acento #b7ee38, definidos por tokens únicos.                                                                                      |
| Fotografia        | Fotos reais do kartódromo substituem os cenários ilustrativos gerados. A borda esquerda da foto do hero foi suavizada para eliminar uma emenda visível.                                  |
| Experiências      | Três caminhos claros, imagens abertas e links; mobile empilha com espaçamento consistente.                                                                                               |
| Calendário        | Linhas editoriais, datas legíveis e filtros; mobile reorganiza categoria e ação abaixo do título.                                                                                        |
| Clube             | Navegação lateral no desktop; abas no mobile; estados específicos por página, sem dados de conta fictícios.                                                                              |
| CTA e rodapé      | Faixa verde, botão escuro e navegação/contato/horários no mesmo sistema.                                                                                                                 |
| Responsividade    | Corrigidos overflow da busca/FAQ, cabeçalho em 320px e dados da prova. Atendimento fica no menu/rodapé no mobile para não cobrir conteúdo com botão flutuante.                           |

## Ajustes deliberados à referência

A logo e as fotos originais prevalecem sobre elementos ilustrativos dos conceitos. Foram mantidas as chamadas das 100 Milhas, a apresentação do clube, o evento Desafio 2 Horas já realizado e os dados de contato/horários do site existente. Breadcrumbs ajudam a navegar pelas 24 rotas. O vídeo real pode ser ativado pelo visitante, com pausa disponível; a fotografia é o estado inicial.

A conferência do texto do primeiro viewport preservou título, descrição, rótulos de navegação e CTA do conceito. O título seguinte usa a referência específica de experiências (“Escolha como acelerar”). Não há preços, classificações, testemunhos, pontos ou confirmações de disponibilidade inventados.

## Limites práticos

Cadastro, saldos e resgates do Clube de Vantagens continuam em implantação, conforme o sistema original. As telas estão redesenhadas e comunicam esse estado. A reserva individual usa a plataforma oficial existente. Não foram efetuados pagamentos, enviadas mensagens ou criadas inscrições reais para teste. A auditoria automática de acessibilidade complementa, mas não substitui, uma auditoria humana completa com leitores de tela.
