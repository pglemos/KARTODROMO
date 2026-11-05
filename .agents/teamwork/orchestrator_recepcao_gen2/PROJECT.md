# Project: Estabilização e Correção dos 36 Problemas da Recepção

## Architecture
- **Desktop WinForms (.NET 8 C#)**: `desktop/src/Kartodromo.Recepcao/` e `desktop/src/Kartodromo.Comum/` (executável nativo Windows x64).
- **Servidor de Operações (Node.js / TypeScript)**: `services/ops-server.ts` e biblioteca de domínio `lib/ops/` (API REST na porta 4060 do SRVKART).
- **Banco de Dados Relacional**: SQL Server `SQLEXPRESS` (`KartodromoOps`), migrations em `migrations/ops/`.
- **Periféricos e Rede**: Impressora térmica de bobina EPSON TM-T20X, impressora laser HP P1102w, rede local 192.168.20.0/24 e ponte Cloudflare.

## Code Layout
- `desktop/src/Kartodromo.Comum/`: Núcleo compartilhado desktop (Api.cs, Modelos.cs, Ui.cs, Relatorio.cs, Design.cs, ValidacaoCliente.cs, etc.)
- `desktop/src/Kartodromo.Recepcao/`: Aplicação WinForms de atendimento (FormPrincipal.cs, Caixa.cs, TelasCaixa.cs, Baterias.cs, FormCliente.cs, AgenteImpressao.cs, Acoes.cs, VisualPrincipal.cs, etc.)
- `services/ops-server.ts`: Roteador HTTP, servidor de endpoints da recepção, totens, cronometragem e gestão da fila de impressão.
- `lib/ops/`: Regras de negócio do backend (office.ts, db.ts, auth.ts, relatorios.ts, termo.ts, totem-baterias.ts, cadastro-obrigatorio.ts, instagram.ts, etc.)
- `migrations/ops/`: Scripts SQL versionados para o banco `KartodromoOps`.

---

## Feature Inventory (Todos os 36 Itens Mapeados)

| # | Item / Problema | Descrição Técnica | Requisito | Milestone | Origem |
|---|----------------|-------------------|-----------|-----------|--------|
| 1 | Fila de Impressão Persistida no Banco | Desacoplar `filaImpressao[]` da RAM para tabela `dbo.FilaImpressao` via migration 0011 com CTE atômica | R1 | M1 | Survey |
| 2 | Contingência de Impressão sem Descarte | Evitar purga silenciosa de termos após 3h e manter controle de status (`pendente`, `imprimindo`, `impressa`, `falhou`) | R1 | M2 | Survey |
| 3 | Bobina Térmica com Altura Dinâmica | Substituir `@page { size: 80mm 297mm; }` por `80mm auto` em `termo.ts` e ajustar `PrintSettings` para eliminar desperdício de papel | R1 | M2 | Survey |
| 4 | Polling Inteligente do Agente de Impressão | Não iniciar polling de impressão se impressora configurada não existir localmente | R1 | M3 | Survey |
| 5 | Timeout no WebView2 em Impressão Silenciosa | Adicionar timeout e CancellationToken no carregamento do WebView2 em `Relatorio.ImprimirSilencioso` | R1 | M3 | Survey |
| 6 | Renovação de Sessão do Agente de Impressão | Tratar expiração de token (HTTP 401) sem travar a thread de impressão com modal bloqueante | R1 | M3 | Survey |
| 7 | Guilhotinamento e Corte Parcial de Termos | Ajustar comando de corte e quebra de página dinâmica entre impressões em lote na TM-T20X | R1 | M3 | Survey |
| 8 | Monitoramento do Spooler de Impressão | Checagem de status de impressora offline ou sem papel no Spooler Win32 | R1 | M3 | Survey |
| 9 | Saneamento de Filas Fantasmas | Script/rotina para cancelamento de trabalhos órfãos presos no spooler | R1 | M3 | Survey |
| 10 | Vulnerabilidade no Cálculo de Troco | Impedir cálculo e autorização de troco em dinheiro para pagamentos em Cartão ou Pix | R2 | M4 | Survey |
| 11 | Trava de Idempotência no Checkout | Bloqueio contra duplo clique no botão "Concluir" e envio de idempotencyKey em `POST /vendas` | R2 | M4 | Survey |
| 12 | Validação de Saldo Físico em Sangria | Bloquear sangria caso o valor solicitado seja superior ao dinheiro físico existente na gaveta | R2 | M4 | Survey |
| 13 | Consistência no Fechamento de Caixa | Validar que o valor informado para o próximo turno não exceda o saldo em caixa | R2 | M4 | Survey |
| 14 | Desvinculação Limpa de Vouchers no PDV | Permitir desvincular voucher sem excluir a reserva do carrinho e alinhar recálculo de acréscimo | R2 | M4 | Survey |
| 15 | Isolamento Transacional de Abertura de Caixa | Índice único filtrado `UX_Movimento_TerminalAberto` e locks `UPDLOCK` para impedir múltiplos caixas no mesmo terminal | R2 | M1 | Survey |
| 16 | Correção no Estorno Parcial de Vouchers | Não estornar comissões e vouchers de outros itens da venda em estornos parciais | R2 | M2 | Survey |
| 17 | Bloqueio de Baterias Vencidas | Eliminar tolerância indevida de -30 minutos em novas reservas e bloquear baterias já iniciadas | R3 | M2 | Survey |
| 18 | Ocultação de Baterias Passadas no Totem | Filtrar baterias cujo horário de início já passou em `totem-baterias.ts` | R3 | M2 | Survey |
| 19 | Parametrização Segura de Consultas SQL | Substituir interpolação de strings `${lista}` por parâmetros SQL na rota de baterias do totem | R3 | M2 | Survey |
| 20 | Normalização de Data/Hora ISO | Adicionar segundos `:00` na formatação de `dataHora` de baterias, eliminando erro SQL 241 | R3 | M5 | Survey |
| 21 | Validação de Vagas e Horário ao Mover | Bloquear movimentação e inclusão de clientes para baterias iniciadas ou sem vagas | R3 | M5 | Survey |
| 22 | Tratamento de Concorrência na Grade | Evitar `Rows.Clear()` destrutivo durante interação do operador na grade de baterias | R3 | M5 | Survey |
| 23 | Correção de Cursor Jumping em Máscaras | Corrigir cálculo de `SelectionStart` em `Ui.Campos.Mascara` para preservar a posição do cursor | R4 | M3 | Survey |
| 24 | Preservação de Número e Complemento | Eliminar update que seta `Numero = NULL, Complemento = NULL` em `services/ops-server.ts:369` | R4 | M2 | Survey |
| 25 | Proteção de Dados Pessoais (PII) | Mascarar CPF, e-mail, telefone, endereço e dependentes menores em `POST /api/totem/identificar` | R4 | M2 | Survey |
| 26 | Flexibilização de Instagram | Tornar Instagram opcional em `ValidacaoCliente.cs` e `instagram.ts` para não bloquear clientes | R4 | M3 | Survey |
| 27 | Harmonização de Faixas de Peso | Unificar limites válidos de peso entre frontend e backend (15 kg a 250 kg) | R4 | M3 | Survey |
| 28 | Redução de Timeout HTTP Resiliente | Reduzir timeout padrão do `HttpClient` de 30s para 8-10s com tratamento de desconexão | R5 | M3 | Survey |
| 29 | Otimização de Busca de Karts | Eliminar full table scan em `/api/crono/uso-karts` substituindo expressão escalar por índice | R5 | M1 | Survey |
| 30 | Prevenção de Socket Exhaustion no Ping | Reutilizar instância compartilhada de `HttpClient` no timer de ping da Recepção | R5 | M5 | Survey |
| 31 | Redução de Tempestade de Consultas HTTP | Otimizar recarregamento periódico do `FormPrincipal`, evitando 6 requisições simultâneas | R5 | M5 | Survey |
| 32 | Inicialização Assíncrona do App | Evitar travamento da thread STA principal em `TratarInicioAsync` na abertura | R5 | M5 | Survey |
| 33 | Eliminação de Vazamento de Regiões GDI | Descartar a `Region` anterior (`using`/`Dispose`) em `Forma.Recortar` (`Design.cs`) | R6 | M3 | Survey |
| 34 | Proteção de Stream de Imagens GDI+ | Manter stream aberto ou clonar bitmap em `VisualPrincipal.Icone` para evitar `ExternalException` | R6 | M5 | Survey |
| 35 | Descarte Determinístico de ContextMenuStrip | Garantir `Dispose()` e blocos `using` em menus de contexto e formulários modais | R6 | M5 | Survey |
| 36 | Prevenção de Exceção em LinearGradientBrush | Validar largura e altura maiores que zero antes de instanciar `LinearGradientBrush` no Caixa | R6 | M4 | Survey |

---

## Milestones

| # | Nome | Escopo | Dependências | Status |
|---|------|--------|--------------|--------|
| M1 | Banco de Dados & Migração 0011 | Tabela `dbo.FilaImpressao`, índice único `UX_Movimento_TerminalAberto`, otimização de karts | none | DONE (100% testes, audit CLEAN) |
| M2 | Servidor Backend Operacional | Persistência da fila, proteção PII, remoção de -30 min, integridade de estorno/caixa | M1 | DONE (100% testes, audit CLEAN) |
| M3 | Desktop Comum & Periféricos | Agente de impressão, bobina dinâmica, cursor jumping, GDI leaks em Design.cs, timeout HTTP | M2 | DONE (100% testes, audit CLEAN) |
| M4 | Desktop Recepção — Caixa & PDV | Troco em pagamentos não-dinheiro, idempotência, validação de sangria/fechamento, brush crash | M3 | PLANNED |
| M5 | Desktop Recepção — Baterias, Clientes & UI | Validação de baterias vencidas, ISO segundos, concorrência de grade, sockets ping, menus | M3 | PLANNED |
| M6 | Validação Final E2E & Hardening | Execução dos testes automatizados E2E (Tiers 1-5), compilação Release, auditoria de integridade | M4, M5 | PLANNED |

---

## Interface Contracts

### M1 ↔ M2 (Banco de Dados ↔ Backend Node.js)
- Tabela `dbo.FilaImpressao`:
  - `Id INT IDENTITY(1,1) PRIMARY KEY`
  - `Url NVARCHAR(500) NOT NULL`
  - `Titulo NVARCHAR(200) NOT NULL`
  - `Origem NVARCHAR(100) NOT NULL`
  - `Status NVARCHAR(20) NOT NULL DEFAULT 'pendente'` ('pendente', 'imprimindo', 'impressa', 'falhou')
  - `Tentativas INT NOT NULL DEFAULT 0`
  - `CriadoEm DATETIME2 NOT NULL DEFAULT SYSDATETIME()`
  - `PegoEm DATETIME2 NULL`
  - `FeitaEm DATETIME2 NULL`
  - `FalhouEm DATETIME2 NULL`
  - `UltimoErro NVARCHAR(MAX) NULL`
- Consulta atômica de próximo item:
  ```sql
  WITH Proximo AS (
    SELECT TOP (1) * FROM dbo.FilaImpressao WITH (UPDLOCK, READPAST)
    WHERE Status = 'pendente' OR (Status = 'imprimindo' AND PegoEm < DATEADD(second, -90, SYSDATETIME()))
    ORDER BY CriadoEm ASC
  )
  UPDATE Proximo SET Status = 'imprimindo', PegoEm = SYSDATETIME(), Tentativas = Tentativas + 1
  OUTPUT inserted.Id, inserted.Url, inserted.Titulo, inserted.Origem;
  ```

### M2 ↔ M3, M4, M5 (Backend ↔ Desktop WinForms C#)
- Endpoint `GET /api/office/impressao/proxima`: Devolve `{ ok: true, job: { id, url, titulo, origem } }` ou `{ ok: true, job: null }`.
- Endpoint `POST /api/office/impressao/:id/feita`: Devolve `{ ok: true }`.
- Endpoint `POST /api/office/impressao/:id/falhou`: Devolve `{ ok: true }`.
- Endpoint `POST /api/totem/identificar`: Payload mascarado (ex: `documento: '123.***.***-00'`, dependentes protegidos).
- Endpoint `POST /api/office/vendas`: Aceita `idempotencyKey` opcional para proteção contra submissões concorrentes duplicadas.
- Rota `/termo`: HTML responsivo com `@page { size: 80mm auto; margin: 0; }` para corte dinâmico do papel.
