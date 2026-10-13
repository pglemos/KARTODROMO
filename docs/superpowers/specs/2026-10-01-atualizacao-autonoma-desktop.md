# Atualização autônoma dos aplicativos desktop

## Objetivo

Quando uma versão nova do sistema próprio for publicada, Recepção, Autoatendimento e Cronometragem devem atualizá-la automaticamente na próxima abertura. A atualização deve funcionar também para o modo de placar (`Cronometragem --tv`), sem exigir cópia manual em cada computador.

## Requisitos

- Cada aplicativo consulta o servidor da operação (`ServidorUrl`) por um manifesto específico do aplicativo.
- Uma máquina desligada não é considerada falha: ao voltar e abrir o programa, ele tenta novamente.
- Quando há versão nova, aparece uma janela sem interação obrigatória informando `Atualizando para a versão X...`.
- O pacote é verificado por SHA-256 antes de ser instalado.
- A atualização troca os arquivos do programa e preserva o `appsettings.json` local, incluindo impressora e endpoints personalizados.
- O programa reinicia com os mesmos argumentos; portanto o modo `--tv` continua sendo o placar.
- Falha de rede, manifesto inválido ou pacote indisponível não impede a abertura da versão já instalada.
- O servidor expõe somente os pacotes publicados em `/updates/<App>/` e rejeita caminhos fora da pasta de atualizações.
- A instalação concede permissão de atualização somente na pasta do aplicativo, não no restante do `Program Files`.
- A publicação futura deve gerar os pacotes e manifestos dos três aplicativos e enviá-los ao SRVKART.

## Fora do escopo

O placar TB50 que roda como cópia web independente no computador .250 não é o mesmo executável do modo `--tv`; sua atualização automática será uma frente separada. O mecanismo desta entrega cobre o placar nativo `Kartodromo.Cronometragem.exe --tv`.
