# Atualização autônoma dos aplicativos desktop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer Recepção, Autoatendimento e Cronometragem/placar nativo atualizarem-se automaticamente na próxima abertura, inclusive após uma máquina ficar desligada.

**Architecture:** O SRVKART servirá manifestos e ZIPs versionados em `/updates/<App>/`. Um cliente compartilhado no assembly `Kartodromo.Comum` consulta o manifesto, baixa e valida o pacote, inicia uma cópia temporária do próprio executável para substituir os arquivos sem conflito e relança o programa. O instalador preservará `appsettings.json` e a pasta do aplicativo terá permissão de escrita limitada para permitir a atualização sem intervenção administrativa.

**Tech Stack:** C#/.NET 8 WinForms self-contained single-file, TypeScript/Node HTTP server, PowerShell, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-01-atualizacao-autonoma-desktop.md`

## Global Constraints

- Apps nativos Windows; não substituir os programas por navegador.
- Falha de rede não pode impedir a abertura do app instalado.
- Nunca sobrescrever `appsettings.json` durante atualização.
- Verificar SHA-256 antes de copiar qualquer pacote.
- Não reiniciar cronometragem em bateria ativa durante a publicação operacional.
- Pacotes e manifestos ficam no servidor da operação, não em credenciais ou arquivos versionados com segredos.
- O modo `--tv` continua pertencendo ao pacote Cronometragem.

## Review Focus

- Computador desligado durante a publicação: próxima abertura consulta a versão nova.
- Servidor indisponível: app abre na versão instalada sem pop-up de erro.
- `appsettings.json` com impressora/endpoints locais: valores permanecem após atualização.
- ZIP/hash incorreto: pacote não é instalado e a versão antiga é relançada.
- `--tv`: o placar volta com o mesmo argumento depois da atualização.

### Task 1: Contratos testáveis do cliente e servidor

**Files:**
- Create: `desktop/tests/Kartodromo.Atualizacao.Testes/Kartodromo.Atualizacao.Testes.csproj`
- Create: `desktop/tests/Kartodromo.Atualizacao.Testes/Program.cs`
- Create: `tests/desktop-updates.test.ts`
- Create: `lib/desktop-updates.ts`

**Interfaces:**
- `Atualizacao.DeveAtualizar(string atual, string app, ManifestoDesktop remoto)` retorna se o manifesto é válido e mais novo.
- `Atualizacao.PodeSubstituirArquivo(string relativo)` preserva `appsettings.json`.
- `caminhoArquivoAtualizacao(root, app, nome)` retorna caminho seguro ou `null`.

- [x] Escrever os testes que falham para versão nova, versão igual/antiga, app inválido, path traversal e preservação de configuração.
- [x] Rodar os testes e registrar as falhas esperadas (API ainda inexistente).
- [x] Implementar os contratos mínimos em C# e TypeScript.
- [x] Rodar os testes novamente e confirmar verde.

### Task 2: Cliente de atualização compartilhado e inicialização dos apps

**Files:**
- Create: `desktop/src/Kartodromo.Comum/Atualizacao.cs`
- Create: `desktop/src/Kartodromo.Comum/FormAtualizacao.cs`
- Modify: `desktop/src/Kartodromo.Recepcao/Program.cs`
- Modify: `desktop/src/Kartodromo.Autoatendimento/Program.cs`
- Modify: `desktop/src/Kartodromo.Cronometragem/Program.cs`
- Modify: `desktop/Directory.Build.props` (versão de entrega)

**Interfaces:**
- `Atualizacao.TratarInicioAsync(app, args)` intercepta o modo instalador e verifica manifestos em inicialização normal.
- O modo instalador recebe PID, URL do manifesto, diretório alvo, executável original e argumentos codificados.

- [x] Adicionar cobertura do harness para as decisões puras.
- [x] Implementar consulta com timeout curto e fallback silencioso.
- [x] Implementar cópia temporária do executável, espera do processo, download em arquivo, SHA-256, extração segura, cópia com retry e relançamento.
- [x] Exibir janela “Atualizando para a versão X...” durante a operação.
- [x] Integrar os três `Program.Main`, ignorando os modos de autoteste e preservando `--tv`.
- [x] Rodar harness, build e teste manual offline/online em diretório temporário.

### Task 3: Publicação HTTP e distribuição de pacotes

**Files:**
- Modify: `services/ops-server.ts`
- Create: `scripts/apps/publicar-desktop.ps1`
- Modify: `scripts/apps/instalar-desktop.ps1`
- Modify: `docs/operacao/HANDOFF-SISTEMA-PROPRIO.md`

**Interfaces:**
- `GET /updates/<App>/manifest.json` e `GET /updates/<App>/<pacote>.zip`.
- `publicar-desktop.ps1` publica versão, ZIP, SHA-256 e manifesto para o SRVKART.

- [x] Adicionar teste de path seguro e tipos de conteúdo.
- [x] Implementar a rota somente leitura com proteção contra traversal e `no-store`.
- [x] Implementar script de build/ZIP/manifesto e cópia remota sem expor credenciais.
- [x] Preservar configurações locais e conceder Modify somente à pasta de cada app no instalador.
- [x] Documentar o fluxo obrigatório: toda mudança desktop termina publicando manifestos/pacotes.

### Task 4: Entrega inicial e verificação real

**Files:**
- Generated: `desktop/publish/*` e pacotes fora do Git no SRVKART.

- [x] Bump da versão para `1.0.2` e gerar os três pacotes.
- [x] Publicar no .13 antes de atualizar clientes.
- [x] Atualizar máquinas acessíveis e confirmar hash/processo.
- [ ] Testar o cenário offline no .12 quando ele voltar à rede (máquina sem resposta em 2026-10-01).
- [x] Rodar build desktop, testes C# e suíte Vitest; registrar falhas preexistentes separadamente.
