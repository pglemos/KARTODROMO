# Recuperar piloto excluído

Cronometragem 1.0.64: botão Recuperar piloto à esquerda de Imprimir volta a volta do piloto. Só aparece se a bateria selecionada possui pilotos excluídos. Com um excluído, recupera diretamente; com vários, abre a seleção por kart e nome. Depois de recuperar todos, desaparece.

O servidor guarda a cópia completa do piloto excluído no JSON da bateria, incluindo passagens, bandeiras, penalidades e cadastro. A recuperação incorpora passagens novas de um kart sem piloto. Kart já ocupado por outro piloto bloqueia a recuperação e mantém o registro excluído disponível. Trocas de kart e simples salvamentos não geram falsas exclusões.

As exclusões anteriores à ativação deste recurso não possuem esse arquivo de recuperação. Excluir uma bateria inteira não é recuperado por este botão.

Validação: 100 testes do motor, recuperação e equalização passaram. API do simulador 4150 validou dois excluídos e recuperação individual. Janela real validada e capturada em C:\KARTODROMO\recuperar-qa-20261011\fotos (recuperar-piloto.png, selecionar-kart.png, ok.txt). Compilação/publicação win-x64 concluída. Simulador encerrado.

A instalação preserva appsettings.json e mantém os processos de operadores e telão abertos. A nova interface aparece na próxima abertura do programa. O servidor só pode ser reiniciado entre baterias, com runningId vazio.
`nAtivação: serviço 4050 reiniciado às 17:49, após runningId ficar vazio. Saúde OK, decoder conectado, 300 baterias carregadas. Bateria 17:25 encerrada: 35 pilotos e 561 passagens preservados. Executáveis 1.0.64 conferidos por SHA256 em ORBITS, CRONO1 e recepção 2; manifesto publicado no SRVKART. Processos de operador/telão preservados.
