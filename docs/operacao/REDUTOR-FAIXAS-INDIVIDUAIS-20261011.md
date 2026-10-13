# Faixas individuais do redutor — 11/10/2026

A janela Regra do redutor da Cronometragem 1.0.62 permite editar o limite superior em segundos e o ajuste absoluto em milímetros de cada faixa. Abre com sete linhas para regras antigas; regras já personalizadas carregam todas as linhas. A última linha em branco acrescenta uma faixa; selecionando a linha inteira, Delete remove. Limite: 100 faixas.

A primeira faixa começa após a tolerância. Cada limite superior pertence à própria faixa. A faixa seguinte começa acima desse limite. Diferença positiva abre, negativa fecha. Acima da última faixa, o intervalo e passo do topo continuam o cálculo a partir do último ajuste.

As regras antigas de uma ou duas faixas mantêm seu cálculo até serem salvas. A conversão inicial de duas faixas conserva seus limites e ajustes; a continuação usa o intervalo e passo da segunda faixa. As equalizações guardam cópia da regra. Após salvar, o diálogo permite aplicar à equalização aberta; históricas não são alteradas automaticamente.

Validação: 96 testes do motor/equalização/faixas passaram. No simulador :4150, nove faixas foram salvas, copiadas para uma equalização TESTE CODEX, e a sétima foi editada e verificada no arquivo persistido. Limite inválido foi recusado com HTTP 400. A janela nativa foi aberta fora da tela e nove linhas editáveis foram conferidas e capturadas. O simulador foi encerrado.

Serviço :4050 reiniciado quando runningId estava vazio, sem tocar no aplicativo de telão. Aplicativo 1.0.62 instalado em ORBITS, CRONO1 e recepção 2; configurações preservadas. Manifesto Cronometragem 1.0.62 publicado no SRVKART. Processos de operadores/telão existentes foram preservados: a nova janela entra na próxima abertura do programa.

Artefatos locais: C:\KARTODROMO\redutor-qa-20261011\fotos\regra-redutor.png e C:\KARTODROMO\redutor-backup-20261011 (regras anteriores e tarefa).
