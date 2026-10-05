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

## Segunda revisão — 05/10/2026

Versão Cloudflare: `3413292f-ad46-4770-ae59-466cbea3c851`.

- 96 verificações das 24 rotas em 1440, 768, 390 e 320px: título, conteúdo, responsividade e ausência de overflow horizontal.
- Dez auditorias automatizadas WCAG A/AA, agora incluindo a nova página de reservas: zero violações.
- 14 testes aprovados. Quatro testes adicionais cobrem o formato ICS: dias inteiros, término exclusivo, virada de ano, caracteres escapados, UTF-8 e limite de 75 bytes por linha.
- Onze fluxos de navegador aprovados: filtros de calendário, mapas, FAQ, orçamento, inscrições, menu, seletor de experiências, estimativas, galerias, navegação dos mapas e download do calendário.
- Reserva: três pilotos resultam em R$435; dois em R$290. Trocar entre bateria aberta e exclusiva preserva a quantidade. A estimativa é indicada como tal, com valores, pagamento e vagas confirmados na plataforma oficial.
- Seletor de experiências: setas/Home/End, foco e conteúdo correspondente à aba selecionada.
- Galeria: ampliação, anterior/próxima, Escape e retorno ao controle de origem.
- Inscrições de teste continuam simuladas somente no navegador. Nenhuma mensagem, inscrição ou pagamento real foi enviado.
- A prévia local agora serve o HTML correto de cada rota, evitando os avisos de hidratação provocados pelo fallback da prévia SPA do Vite. Na execução completa com os HTML corretos, não houve erros de runtime.

A revisão visual comparou capturas desktop e mobile com a primeira versão, conferindo ritmo entre seções, hierarquia tipográfica, cores, imagens, espaçamento, conteúdo e controles. Os ajustes finais priorizaram o planejador antes da foto no celular e alinharam o menu à altura do cabeçalho. A logo original e a identidade editorial foram preservadas; a home passou a alternar composições de seletor, circuito, prova, agenda, clube e visita.
