# Sistema próprio do Kartódromo — passagem de trabalho (handoff)

> Estado em **26/09/2026 09:30**. Escrito para continuar o trabalho no **Codex, pelo MacBook** na
> mesma rede local (192.168.20.0/24).
>
> **Este arquivo NÃO tem senhas** porque fica no repositório, que vai para o GitHub. Cada acesso
> diz **onde a senha está guardada**. A seção 3 explica como levar esses arquivos para o Mac sem
> colocá-los no git.

---

## 0. Resumo em 1 minuto

- O **LapTime foi desativado em 23–25/09/2026**. A operação agora roda no **sistema próprio**:
  - **Servidor da operação** (Node/TypeScript + SQL Server): no **SRVKART `192.168.20.13:4060`**.
  - **Cronometragem** (Node/TypeScript, lê o decoder MYLAPS TranX): no **ORBITS `192.168.20.249:4050`**.
  - **3 programas Windows nativos** (C# .NET 8 WinForms), instalados em cada PC:
    - **Recepção**: a réplica do LapTime Office.
    - **Autoatendimento**: os totens.
    - **Cronometragem**: o operador e o telão.
- **Regra do dono:** os apps são **programas instalados** (como o LapTime), **nunca app web/Chrome**.
- O código está em `C:\repos\KARTODROMO` no ORBITS, branch `main`, **14 commits à frente do
  `origin/main`** (push pendente: o token do remoto no ORBITS só lê). A seção 3 explica como puxar para o Mac.
- Há **alterações não commitadas na cronometragem feitas por outra sessão do Claude**. São 6 arquivos,
  listados na seção 11. Não descartar.

---

## 1. Máquinas da rede

| Máquina | IP | Nome Windows | Usuário logado | Papel |
|---|---|---|---|---|
| **ORBITS** | 192.168.20.249 | CRONOMETRAGEM | Administrador | Repo + builds + deploy. Servidor da cronometragem `:4050`. Orbits 4 (MYLAPS). Painel de LED antigo na **COM3**. Ponte do site `:4010`. |
| **SRVKART** | 192.168.20.13 | SRVKART | — (servidor) | Servidor da operação `:4060`. SQL Server `SQLEXPRESS` (porta 1433). Banco `KartodromoOps`. |
| **Recepção** | 192.168.20.53 | DESKTOP-O7IMJLN | `usuario` | App **Recepção**. **Impressora TM-T20X** (fila `TMT20`, compartilhada) + HP LaserJet P1102w. |
| **Totem 1** | 192.168.20.161 | TOTEN1 (Win10 LTSC) | `KART` | App **Autoatendimento**, tela cheia. **Sem impressora.** |
| **Totem 2** | 192.168.20.69 | DESKTOP-4OR2GFI | `Toten2` | App **Autoatendimento**, tela cheia. **Sem impressora.** |
| **CRONO1** | 192.168.20.254 | CRONO1 | "Connect Fix" | App Cronometragem (reserva). Era o servidor do LapTime (SQL desinstalado em 23/09). |
| Decoder | 192.168.20.171 | MYLAPS TranX | — | Porta **5403 = P3 binário** (usada; a mesma do Orbits 4). Porta **5100 = texto TRX** (modo antigo). |

Relógios de .249/.13/.53/.69/.254 sincronizados com NTP.br. O Totem 1 não foi configurado.

---

## 2. Acessos (onde está cada credencial)

| Acesso | Usuário | Onde está a senha |
|---|---|---|
| WinRM / admin em **todas** as máquinas | `KARTODROMO` (local, admin) | Credencial **SEC-008** em `C:\KARTODROMO\00_INVENTARIO_SEGREDOS.md` (ORBITS). Cópia cifrada (só abre no ORBITS, com o Administrador) em `C:\KARTODROMO\.winrm-cred.xml`, que os scripts usam com `Import-Clixml`. |
| Login do programa **Recepção** | `admin`, `ludmila`, `suenia`, `gustavo` | `C:\KARTODROMO\SENHAS_SISTEMA_PROPRIO.txt` (ORBITS). A senha é a **2ª coluna** da linha do usuário. |
| SQL `KartodromoOps` | `KartOpsSql` | `C:\kartodromo-servidor\.env.local` no **SRVKART** (`OPS_SQL_PASSWORD`). |
| Chave da cronometragem → servidor (`x-ops-key`) | — | `OPS_RECEPCAO_KEY` no mesmo `.env.local` do SRVKART. |
| SQL `LapTimeMirror` (retrato final do LapTime) / `CALXPRO` | ver inventário | `00_INVENTARIO_SEGREDOS.md` (SEC-005 e o espelho). |
| Instaladores dos totens (`INSTALAR-TOTEM.cmd`, `LIBERAR-ACESSO-TOTEM.cmd`) | — | `C:\KartodromoApps\instaladores\` no ORBITS. **Contêm a senha SEC-008. Nunca versionar.** |
| AnyDesk do Totem 1 | ID 548795701 | Acessível pelo AnyDesk do ORBITS. |

**Regras de segurança combinadas com o dono (seguir sempre):**

1. Nunca copiar senha para arquivo versionado, log, commit, mensagem ou print.
2. `00_INVENTARIO_SEGREDOS.md`, `SENHAS_SISTEMA_PROPRIO.txt` e os `.cmd` dos totens ficam **fora do repo**.
3. Nunca digitar senha em tela/campo por automação. O autoteste recebe a senha por argumento, lida
   do arquivo, e nunca a imprime.

---

## 3. Como trabalhar a partir do MacBook

### 3.1 Pegar o código (os 14 commits ainda só existem no ORBITS)

**Opção A (recomendada): publicar no GitHub pelo ORBITS.** Alguém no ORBITS roda o comando abaixo
e faz login do GitHub no navegador. O token gravado na URL do remoto só tem leitura.

```powershell
cd C:\repos\KARTODROMO
git push origin main
```

Depois, no Mac: `git clone https://github.com/pglemos/KARTODROMO.git`, ou `git pull` se já tiver o clone.

**Opção B: puxar direto do disco do ORBITS pela rede (SMB).** No Finder, use `Cmd+K` para abrir
`smb://192.168.20.249/C$` e entre com o usuário `KARTODROMO` (SEC-008). Depois, no Mac:

```bash
cd ~/PROJETOS/KARTODROMO   # clone existente
git fetch "/Volumes/C\$/repos/KARTODROMO" main:orbits-main
git merge --ff-only orbits-main
```

### 3.2 Levar os arquivos de senha (fora do git)

Pelo mesmo SMB, copie `C:\KARTODROMO\00_INVENTARIO_SEGREDOS.md` e
`C:\KARTODROMO\SENHAS_SISTEMA_PROPRIO.txt` para uma pasta **fora do repo** no Mac, por exemplo
`~/KARTODROMO-SEGREDOS/`.

### 3.3 Rodar comandos nas máquinas Windows

O acesso remoto às máquinas é pelo **WinRM**, a partir do ORBITS. O WinRM a partir do macOS não é
confiável. O ORBITS **não tem SSH** hoje (o OpenSSH Server está como `NotPresent`).

**Recomendado:** o dono liga o OpenSSH no ORBITS **uma vez**, num PowerShell **como administrador**.
É uma mudança de segurança; decida antes de rodar.

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Set-Service sshd -StartupType Automatic; Start-Service sshd
New-NetFirewallRule -Name sshd-lan -DisplayName "OpenSSH (rede local)" -Protocol TCP -LocalPort 22 -RemoteAddress LocalSubnet -Action Allow
```

Depois, no Mac: `ssh Administrador@192.168.20.249`. Para a sessão abrir no PowerShell, dá para
trocar o shell padrão do sshd. De lá, os scripts de deploy da seção 8 rodam como hoje.

**Fluxo sugerido para o Codex no Mac:**

1. Editar e commitar no Mac, depois `git push`.
2. `ssh` no ORBITS e rodar `cd C:\repos\KARTODROMO; git pull`.
3. Rodar lá mesmo os comandos de build, teste e deploy (seções 7 e 8).

Os apps **.NET WinForms** também compilam no Mac com `-p:EnableWindowsTargeting=true`, mas o
deploy e os testes com janela precisam do Windows.

### 3.4 O que o Mac acessa direto pela rede (sem ssh)

- `http://192.168.20.13:4060/healthz`: servidor da operação.
- `http://192.168.20.249:4050/healthz` e `/api/state`: cronometragem.
- `http://192.168.20.249:4050/operador` e `/tv`: telas web antigas da cronometragem, só para
  diagnóstico. A operação usa os apps nativos.
- SQL Server `192.168.20.13,1433`, banco `KartodromoOps`, usuário `KartOpsSql`, com Azure Data
  Studio ou `sqlcmd`. **Cuidado: é produção.**

---

## 4. Servidor da operação (SRVKART `:4060`)

- **Código:** `services/ops-server.ts` (roteador, totem, termo, fila de impressão, rotas da crono),
  `lib/ops/office.ts` (API da recepção), `lib/ops/db.ts` (SQL), `lib/ops/auth.ts` (login/token),
  `lib/ops/relatorios.ts`, `lib/ops/termo.ts`.
- **Instalado em** `C:\kartodromo-servidor\` no SRVKART. É uma **cópia enxuta**, sem git: só
  `services/`, `lib/ops/`, `migrations/`, `package.json` e o `node_modules` reaproveitado.
  Os arquivos batem com o repo (conferido por SHA-256 em 26/09).
- **Serviço:** tarefa agendada **"Kartodromo Servidor"** (roda como SYSTEM). O log fica em
  `C:\kartodromo-servidor\.runtime\ops-server.log`.
- **Configuração** (`.env.local`): `OPS_PORT=4060`, `OPS_SQL_SERVER=localhost`,
  `OPS_SQL_INSTANCE=SQLEXPRESS`, `OPS_SQL_DATABASE=KartodromoOps`, `OPS_SQL_USER=KartOpsSql`,
  `OPS_SQL_PASSWORD=***`, `OPS_RECEPCAO_KEY=***`.
- **Banco `KartodromoOps`:** 137.539 clientes (LapTime + CalXPro), baterias, reservas
  (`Inscricao`), vendas, caixa, produtos, fidelidade, parceiros e vouchers.
  - Migrations em `migrations/ops/0001..0004`. A 0004 criou `TipoSanguineo`, `Ibge` e `Pais` em `Cliente`.
  - **Toda migration nova tem de ser aplicada no SQL ANTES de publicar o código que a usa.** Em
    26/09 inverter essa ordem derrubou a consulta de clientes por cerca de 1 minuto.
- **Datas:** hora local de Brasília, como texto (`CONVERT(varchar, x, 126)`). "Agora" vem de
  `SYSDATETIME()` do SQL.
- **Texto do termo:** vem de `lib/ops/termo.ts`. Para trocar o texto sem mexer no código, crie
  `C:\kartodromo-servidor\data\ops\termo.txt` (parágrafos separados por linha em branco).
  Hoje esse arquivo não existe.

### 4.1 Rotas

**Páginas:**
- `/` ou `/recepcao`: office.html (web antiga).
- `/totem`: totem.html (web antiga).
- `/ui/*`: arquivos estáticos.
- `/healthz`: `{ ok, sqlAgora }`.
- `/termo?ids=1,2&s=<assinatura>`: termo 80 mm assinado por HMAC, gerado por `termoLink(ids)`.
  - `/termo?branco=1&t=<token>`: termo em branco (exige sessão).
- `/relatorio/<tipo>?t=<token>&...`: relatórios da recepção. O tipo é tratado em `lib/ops/relatorios.ts`.

**Totem (público):**
- `GET /api/totem/config`
- `POST /api/totem/identificar`
- `POST /api/totem/cadastro`
- `GET /api/totem/baterias`
- `POST /api/totem/inscrever`: cria uma pré-reserva (`Aprovada=0`), que aparece em
  Reservas › Aprovar. **Coloca o termo na fila da impressora da recepção** (ver 4.2). A resposta
  traz `termoNaRecepcao: true`.

**Login:** `POST /api/login` com `{ login, senha, termos }` devolve `{ token, usuario }`. O token
é HMAC e vale **16 h** (`lib/ops/auth.ts`).

**Recepção** (`/api/office/*`, cabeçalho `Authorization: Bearer <token>` ou `?t=`):
- **Serviços:**
  - `GET /servicos-online`
  - `GET /apoio`: listas de apoio (formas, terminais, parâmetros…).
  - `GET|PUT /empresa`
  - `GET|PUT /parametros`
  - `POST /senha`
- **Cadastros genéricos:** `GET|POST|PUT|DELETE /cad/<ent>[/<id>]`. O `<ent>` pode ser `produtos`,
  `provas`, `tracados`, `feriados`, `turnos`, `terminais`, `formas`, `padroes`, `itensManutencao`,
  `usuarios` (este só para admin).
- **Clientes:**
  - `GET /clientes?q=`
  - `GET /clientes/nav`
  - `POST /clientes`
  - `GET|PUT|DELETE /clientes/:id`
- **Reservas:**
  - `GET /reservas?status=&filtro=&data=`
  - `PUT|DELETE /reservas/:id`
  - `POST /reservas/:id/aprovar`
  - `POST /reservas/:id/alterar-cliente`
  - `POST /reservas/:id/mover`
- **Baterias:**
  - `GET /baterias?status=&filtro=&data=`
  - `POST /baterias`
  - `POST /baterias/gerar`
  - `PUT|DELETE /baterias/:id`
  - `POST /baterias/:id/status`
  - `POST /baterias/:id/incluir`
  - `GET /baterias/:id/programa`
- **Agenda:** `GET /agenda`
- **Caixa:**
  - `GET /caixa`
  - `GET /movimentos`
  - `POST /caixa/abrir`
  - `POST /caixa/fechar`
  - `POST /caixa/transacao` (suprimento e sangria)
- **Vendas:**
  - `GET /vendas`
  - `POST /vendas` (checkout)
  - `GET /vendas/:id`
  - `POST /vendas/:id/estorno`
- **Oficina:**
  - `GET /manutencoes`
  - `POST /manutencoes/marcar`
- **Vouchers:**
  - `GET|POST /vouchers`
  - `GET /vouchers/uso`
  - `GET /vouchers/validar`
  - `GET|PUT|DELETE /vouchers/:id`
- **Fidelidade:**
  - `GET|POST /fidelidade/contas`
  - `GET|PUT /fidelidade/contas/:id`
  - `GET /fidelidade/contas/:id/transacoes`
  - `POST /fidelidade/contas/:id/ajustes`
  - `GET /fidelidade/transacoes`
- **Parceiros:**
  - `GET|POST /parceiros`
  - `GET|PUT|DELETE /parceiros/:id`
  - `GET /parceiros/comissoes`
  - `GET /parceiros/comissoes/:id/transacoes`
  - `POST /parceiros/comissoes/:id/(pagar|estornar)`
- **Termo:** `GET /termo-link?ids=`, que devolve `{ url }`.
- **Fila de impressão** (ver 4.2):
  - `GET /impressao/proxima`
  - `POST /impressao/:id/feita`
  - `POST /impressao/:id/falhou`
  - `POST /impressao/teste`
  - `GET /impressao/fila`

**Cronometragem** (cabeçalho `x-ops-key: <OPS_RECEPCAO_KEY>`):
- `GET /api/crono/baterias?data=AAAA-MM-DD`
- `GET /api/crono/baterias/:id/grid`
- `GET /api/crono/baterias/:id/programa`
- `GET /api/baterias?data=` (compatibilidade)

### 4.2 Impressão do termo (importante)

- **Os totens não têm impressora.** O Windows deles não vê uma TM-T20 desde jan/fev de 2025, e a
  COM1 está vazia. O LapTime imprimia pelo servidor, na impressora da recepção.
- **Como funciona hoje:**
  - `/api/totem/inscrever` coloca o termo numa **fila em memória** do servidor.
  - O app **Recepção da .53** (com `"ImpressoraTermos": "TMT20"` no `appsettings.json`) consulta
    `/api/office/impressao/proxima` a cada 3 s e imprime sem diálogo na TM-T20.
  - A fila só é atendida **com alguém logado** na Recepção.
- **Parâmetro `totem.termoNaRecepcao`:** com `false`, o totem volta a tentar imprimir localmente.
- **Fila em memória:**
  - Reiniciar o servidor apaga o que estiver pendente. Veja antes em `GET /api/office/impressao/fila`.
  - Um termo vale 3 h.
  - Um termo pego e não confirmado volta para a fila em 90 s.
  - Depois de uma falha, o agente espera 20 s antes de tentar de novo.
- **Log do agente:** `C:\Users\usuario\AppData\Local\Kartodromo\recepcao-impressao.log` (na .53).
- **Janela de termo na Recepção** (`Relatorio`): com `ImpressoraTermos` configurado, o termo vai
  **direto** para a TMT20, sem o diálogo do Chrome, e o resultado aparece na barra da janela.
  Os outros relatórios abrem o diálogo normal.
- **Layout do termo:** igual ao LapTime. Tem os dados do participante, o texto, a data e as
  assinaturas **PARTICIPANTE PILOTO** e **RESPONSÁVEL LEGAL**, sem o bloco Nome/Tel./Doc./E-mail
  no rodapé. Tudo em fluxo normal, sem posição fixa.

---

## 5. Cronometragem (ORBITS `:4050`)

- **Código:** `services/timing-server.ts`, `lib/timing/decoder-client.ts`, `lib/timing/p3-parser.ts`,
  `lib/timing/trx-parser.ts`, `lib/timing/race-engine.ts`, `lib/timing/catalog.ts`.
  Telas web de diagnóstico em `services/timing-ui/`. Testes em `tests/timing-engine.test.ts` (vitest).
- **Serviço:** tarefa **KartodromoCronometragem** (SYSTEM, ao iniciar, reinicia sozinha). Roda de
  `C:\repos\KARTODROMO`.
  - Log: `data/timing/timing.log`
  - Sessões: `data/timing/sessions/*.json`
  - Diário bruto de passagens: `data/timing/passagens/AAAA-MM-DD.jsonl`
  - A pasta `data/` **não é versionada**.
- **Só reinicie o serviço quando `GET /api/state` não tiver `runningId`**, ou seja, sem bateria rodando.
- **Decoder:**
  - Usa a **P3 na porta 5403**, a mesma do Orbits 4. Os tempos batem com o Orbits no milissegundo
    (8 de 8 voltas).
  - Frame: `0x8E ver u8, len u16, crc u16, flags u16, TOR u16 @7, TLV desde 9, 0x8F`. O escape é
    `0x8D`, seguido do byte + 0x20.
  - TOR 1 = passagem (`0x03` transponder u32, `0x04` RTC µs u64). TOR 2 = status.
  - Modo antigo: `TIMING_DECODER_PROTOCOL=trx`, porta 5100. Esse modo precisa mandar `@RESET` e
    `\x01?;;;11;` ao conectar, e tem erro de ±1 ms.
- **Transponder → kart:** `data/timing/transponders.json`, com 118 itens da tabela do dono
  (`Desktop\Traduções.txt`).
- **Volta mínima padrão:** 5 s, igual ao LapTime. As leituras ignoradas ficam guardadas (amarelo no
  app) e podem voltar a contar.
- **Variáveis de ambiente:**
  - Ligação: `TIMING_PORT`, `TIMING_DATA_DIR`, `TIMING_TRACK_NAME`.
  - Decoder: `TIMING_DECODER_HOST`, `TIMING_DECODER_PORT`, `TIMING_DECODER_PROTOCOL` (`p3`|`trx`).
  - Simulador: `TIMING_SIMULATE=1`, `TIMING_SIM_PORT`, `TIMING_SIM_KARTS`, `TIMING_SIM_LAP_SEC`.
- **Rotas:**
  - Estado e estáticos:
    - `/healthz`
    - `/api/state`
    - `/api/events` (SSE)
    - `/api/livetime-snapshot`
    - `/`, `/operador`, `/tv`
  - Agenda: `GET /api/agenda`, `/api/agenda/:id`
  - Sessões:
    - `GET|POST /api/sessions`
    - `GET /api/sessions/:id`
    - `POST /api/sessions/:id/(start|flag|checkered|close|cancel|observations)`
    - `GET /api/sessions/:id/laps`
    - `POST /api/sessions/:id/laps/invalidate`
  - Passagens:
    - `GET /api/sessions/:id/passings`
    - `POST /api/sessions/:id/passings/(manual|actions|clear)`
    - `POST /api/sessions/:id/passings/:pid/(delete|restore|invalidate|validate|assign|unassign)`
  - Configuração:
    - `GET|PATCH /api/settings`
    - `GET|PUT /api/transponders`
    - `POST /api/backup`
  - Catálogo:
    - `GET /api/catalog`
    - `/api/catalog/(events|groups|provas|categories|tracks)`
    - `GET /api/catalog/export`
    - `POST /api/catalog/import`
  - Só nas alterações não commitadas da outra sessão:
    - `PATCH /api/settings/decoder`
    - `POST /api/settings/decoder/test`
    - `/api/catalog/backups[/:id]`
    - `/api/catalog/competitors`
- **Painel de LED antigo** (posições 1–10; **não é a TB50**):
  - Ligado na **COM3 do ORBITS**. Quem envia é o **app Cronometragem do ORBITS** (`PainelLed.cs`).
  - Configuração em `C:\ProgramData\Kartodromo\painel-led.json` (`{"porta":"COM3","baud":9600,"linhas":10}`).
  - Protocolo do LapTime: `$I`, `$SP/$J/$H` (treino), `$SR/$J/$G` (corrida), `$F`, com CRLF, RTS ligado e DTR desligado.
  - A saída "Alimentador do painel" (RMonitor) do Orbits 4 foi **desligada**, com autorização do
    dono, para liberar a COM3.
- **Simulador (nunca crie sessão de teste no :4050 real):**

```bash
TIMING_PORT=4150 TIMING_SIMULATE=1 TIMING_SIM_PORT=5199 TIMING_DATA_DIR=<pasta-temp> npx tsx services/timing-server.ts
```

---

## 6. Programas Windows (desktop/)

- **Solução:** `desktop/Kartodromo.Desktop.sln` (.NET 8 WinForms). O WebView2 é usado só no
  relatório e no termo.

| Projeto | O que é | Onde está instalado |
|---|---|---|
| `Kartodromo.Comum` | `Api`/`Config` (appsettings), `Fmt`, `Ui` (Grade, Janela, Msg, Icone), `Relatorio` (visualizador, `ImprimirSilencioso`) | — |
| `Kartodromo.Recepcao` | Réplica do LapTime Office (design aprovado) | .53 e ORBITS |
| `Kartodromo.Autoatendimento` | Totem em tela cheia, travado. **Sem teclado na tela** (o totem tem teclado USB). A equipe sai com **Ctrl+Shift+Alt+S**. Reinicia após 90 s parado. | .161 e .69 |
| `Kartodromo.Cronometragem` | Operador + telão `--tv` + painel LED | ORBITS e CRONO1 |

- **Instalação:** `C:\Program Files\Kartodromo\<App>\Kartodromo.<App>.exe` + `appsettings.json`.
- **Chaves do `appsettings.json`:**
  - `ServidorUrl` (padrão `http://192.168.20.13:4060`)
  - `CronometragemUrl` (padrão `http://192.168.20.249:4050`)
  - `ChaveCronometragem`
  - `Impressora` (totem; hoje vazio)
  - `ImpressoraTermos` (Recepção .53 = `TMT20`)
  - `TvModo` (`placar`|`classificacao`)
- **O instalador preserva o `ImpressoraTermos`** entre atualizações.
- **Design aprovado:** canvas https://claude.ai/artifact/B4EGnWA7PjSzpi9swEYhSc. Está tudo
  aprovado **menos o telão**. **Não mexer em `FormTV` / `--tv` / placar.**
- **Visual da Recepção:**
  - O `KitVisual` aplica o estilo em toda janela `Janela`.
  - Janelas que desenham o próprio layout implementam `ISemKit` (`CartaoModal`, `FormCliente`,
    `FormCheckout`, etc.).
  - O `Relatorio` é pulado pelo kit, porque mover o WebView2 depois de aberto quebra a página.
  - Ícones em `Kartodromo.Recepcao/Icones/*.png` (recurso embutido).
- **Armadilhas do WinForms já encontradas:**
  - Com Dock, o controle `Fill` precisa de `BringToFront()`.
  - `DrawToBitmap` ignora z-order e `Region`. Para ver de verdade, capture a tela ou use `PrintWindow`.
  - `ContextMenuStrip`: não faça `Dispose` no `Closed`, porque isso quebra o clique no item
    ("disposed object").
  - Um `Form` modal não deve fazer `Dispose` em `FormClosing`.

---

## 7. Build e testes

```powershell
# publicar (no ORBITS), para cada App: Recepcao | Autoatendimento | Cronometragem
cd C:\repos\KARTODROMO\desktop
dotnet publish src/Kartodromo.<App> -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -p:DebugType=none -o publish/<App>
Remove-Item publish/<App>/*.xml
```

- **Autoteste da Recepção** (abre as 65+ telas, clica no menu de contexto de verdade, não grava nada):
  `Kartodromo.Recepcao.exe --autoteste <pasta> admin <senha>`
  - A senha vem de `SENHAS_SISTEMA_PROPRIO.txt`, lida por script e nunca impressa.
  - O resultado sai em `<pasta>\log.txt` (linhas `OK`, `ERRO` e `pendente`) + PNGs.
  - **As janelas aparecem na tela do ORBITS.** Não rode enquanto alguém estiver usando o Orbits.
- **Teste só do visualizador de relatório/termo:** `Kartodromo.Recepcao.exe --teste-relatorio <pasta> admin <senha>`.
  Abre fora da tela, não rouba o foco e tira a foto por `PrintWindow`. Rode com as variáveis
  `LOCALAPPDATA=<pasta-temp>` e
  `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--disable-features=CalculateNativeWinOcclusion`.
- **Autoteste da Cronometragem:** `--autoteste <pasta>`. Para escolher o tamanho, use
  `KARTODROMO_AUTOTESTE_TAMANHO=1920x1040`.
- **Testes TS:** `npx vitest run` (timing em `tests/timing-engine.test.ts`, termo em `tests/ops/termo.test.ts`).
- **Checagem de tipos do servidor:**
  `npx tsc --noEmit --skipLibCheck --target es2022 --module esnext --moduleResolution bundler --esModuleInterop --types node services/ops-server.ts`

---

## 8. Deploy

### 8.1 Apps nas máquinas (do ORBITS, via WinRM)

```powershell
cd C:\repos\KARTODROMO
.\scripts\apps\implantar-remoto.ps1 -Computador 192.168.20.53  -App Recepcao        -Print "$env:TEMP\rec.png"
.\scripts\apps\implantar-remoto.ps1 -Computador 192.168.20.161 -App Autoatendimento  -Print "$env:TEMP\t1.png"
.\scripts\apps\implantar-remoto.ps1 -Computador 192.168.20.69  -App Autoatendimento  -Print "$env:TEMP\t2.png"
.\scripts\apps\implantar-remoto.ps1 -Computador 192.168.20.254 -App Cronometragem
# no próprio ORBITS:
.\scripts\apps\instalar-desktop.ps1 -App Recepcao -Origem C:\repos\KARTODROMO\desktop\publish\Recepcao
```

- **O que o `implantar-remoto.ps1` faz:**
  - copia os arquivos via WinRM e confere o SHA-256;
  - instala;
  - **fecha e reabre o app** na sessão do usuário;
  - tira um print com `conhost --headless`, sem janela preta.
- **Atualizar a Recepção desloga quem estiver usando.** Avise a recepção, porque os termos do
  totem só imprimem depois de alguém logar de novo. Pelo mesmo motivo, não atualize os totens
  com cliente usando.

### 8.2 Servidor (SRVKART)

1. Copie o `.ts` alterado para `C:\kartodromo-servidor\...` via `Copy-Item -ToSession`. Guarde
   antes uma cópia `.antes-<motivo>.ts`.
2. Pare a tarefa "Kartodromo Servidor", mate o `node.exe` que roda `ops-server` e inicie a tarefa
   de novo.
3. Confira `/healthz`.
4. **Antes de reiniciar,** veja se a fila de impressão está vazia (`/api/office/impressao/fila`).
5. **Migrations primeiro:** grave o `.sql` em `C:\kartodromo-servidor\migrations\ops\` e rode com
   `sqlcmd -S localhost\SQLEXPRESS -d KartodromoOps -E -i <arquivo>`. Só depois publique o código.

---

## 9. Regras de trabalho do dono (obrigatórias)

- Falar sempre em **pt-BR**, direto.
- Tudo tem de funcionar de verdade e **testado na máquina real** (o dono pede "verifique tudo
  diretamente no computador").
- **Apps nativos, nunca app web/Chrome.**
- **Totem sem teclado virtual.**
- **Não mexer no telão** (FormTV/`--tv`/placar).
- **Testes em produção** só com dados **"TESTE CODEX"** e **desfeitos** depois.
- **Nunca** criar sessão de teste na cronometragem real `:4050`; use o simulador `:4150`.
- **Não clonar nem fazer proxy do MyLapTime.** Já gerou denúncia de abuso da Sisecom e bloqueio
  do site. Não copiar termos, ícones ou marcas da Sisecom.
- **Mais de uma sessão mexe no repo** (Claude no ORBITS, Codex, Mac). Antes de editar, rode
  `git status` e `git fetch`, e confira as alterações de outros.
- Não fazer push à força e não reescrever o histórico do `main`.

---

## 10. O que foi feito em 26/09 (commits locais ainda não publicados)

| Commit | O que |
|---|---|
| `ca5a483` | Clientes enriquecidos com o CalXPro (contatos, CalxproId) |
| `470f6c2` | Redesenho premium dos apps nativos + fidelidade/parceiros |
| `50fd911` | Decoder: inicialização TranX como o LapTime (`@RESET` + `?;;;11;`) |
| `3f7b184` | Parser do formato decimal `@` do TranX |
| `7dab640` | Cronometragem mostra toda leitura; layout 1920x1080 |
| `79d56e7` | Volta mínima 5 s; leitura ignorada pode voltar a contar |
| `c03703f` | **Decoder pela P3 :5403 (igual ao Orbits 4)** |
| `9d2ebf3` | **Painel de LED antigo na COM3** (protocolo do LapTime) |
| `04efbbf` | Telas da Recepção iguais ao design (Login, Principal, Cliente, Produto, Checkout, Abrir/Fechar terminal); campos Tipo sanguíneo/País/IBGE |
| `5f40cb3` | **Menu do botão direito quebrava em todo clique** (disposed ContextMenuStrip); olho da senha; termo LGPD do totem |
| `a32fb5b` | **Termo do totem sai na TM-T20 da recepção** (fila no servidor + agente na Recepção) |
| `21baa04` | Janela de impressão do termo espremida (kit × WebView2); termo direto na TMT20 |
| `c3ab852` / `3e77789` | Termo com as assinaturas **PARTICIPANTE PILOTO** e **RESPONSÁVEL LEGAL**, sem o rodapé de dados |

Tudo isso **já está instalado e rodando** nas máquinas. Falta só o `git push`.

---

## 11. Pendências e alertas

1. **Push para o GitHub** dos 14 commits (seção 3.1).
2. **Alterações não commitadas de outra sessão do Claude na cronometragem** (não descartar, não
   sobrescrever; confirme com o dono quem vai concluir):
   - `lib/timing/catalog.ts`
   - `lib/timing/race-engine.ts`
   - `lib/timing/trx-parser.ts`
   - `services/timing-server.ts`
   - `services/timing-ui/operador.html` + `services/timing-ui/admin.html` (novo)
   - `tests/timing-engine.test.ts`

   Revise a cronometragem quando ela terminar.
3. **Teste completo do caixa na Recepção** ainda não foi feito. É preciso abrir o terminal, fazer
   uma venda, estornar e fechar, com dados "TESTE CODEX", desfazendo tudo depois.
4. **Termo em bobina:** a página tem 297 mm fixos, então sobra papel em branco depois das
   assinaturas. Dá para encurtar se o dono quiser.
5. **Primeira reserva real pelo totem depois da fila de impressão:** confira em
   `/api/office/impressao/fila` (ou no log do agente na .53) que o termo saiu.
6. **Filas locais antigas nos totens:** há 9 termos presos na fila "EPSON TM-T20 Receipt" de .161/.69.
   São inofensivos, porque o totem não imprime mais localmente. Dá para limpar se o dono autorizar.
7. **Totem 1:** o relógio não está no NTP.
8. **Recepção .53:** tem um item de inicialização suspeito `syswinclean.out8c05e0620452.lnk`. O
   dono já foi avisado e ele não foi mexido.
9. **Ponte do site (ORBITS :4010 + túnel):** é outra frente, a do site no Cloudflare. Os detalhes
   estão nas memórias do projeto. Não interfere na operação.

---

## 12. Diagnóstico rápido

```bash
curl -s http://192.168.20.13:4060/healthz          # servidor da operação + SQL
curl -s http://192.168.20.249:4050/healthz         # cronometragem
curl -s http://192.168.20.249:4050/api/state | head -c 400
```

- **Termo do totem não saiu:**
  1. Veja se alguém está logado na Recepção .53.
  2. Veja o log `recepcao-impressao.log`.
  3. Veja se a fila `TMT20` está vazia e com status Normal (`Get-Printer TMT20`, `Get-PrintJob -PrinterName TMT20`).
  4. Consulte `GET /api/office/impressao/fila` com um token de login.
- **Cronometragem não lê:**
  1. Veja se o decoder responde (`Test-NetConnection 192.168.20.171 -Port 5403`).
  2. Procure as linhas "decoder" no `data/timing/timing.log`.
  3. Compare com o Orbits 4, que lê a mesma P3.
- **Painel de LED apagado:** o app Cronometragem do ORBITS precisa estar aberto e com a COM3 livre.
  Se o Orbits voltar a mandar a saída do painel, desligue de novo.
