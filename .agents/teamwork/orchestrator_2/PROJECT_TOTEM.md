# Projeto: Autoatendimento Totem (Kartódromo de Betim)

## Arquitetura
O sistema de autoatendimento é composto por:
1. **Desktop Kiosk (.NET 8 WinForms C#)**: `desktop/src/Kartodromo.Autoatendimento/` e `desktop/src/Kartodromo.Comum/`. Opera em modo tela cheia em totens sem teclado virtual na tela, com teclado físico USB, telas em resoluções 1366x768 e 1920x1080.
2. **Backend Operacional (Node.js / TypeScript)**: `services/ops-server.ts`, `lib/ops/`. Provê endpoints para identificação, cadastro, consulta de baterias, pré-reservas, gerenciamento de impressões e integração com banco de dados.
3. **Banco de Dados (SQL Server / KartodromoOps)**: Tabelas `dbo.Cliente`, `dbo.Bateria`, `dbo.Inscricao`, `dbo.FilaImpressao`, etc.
4. **Scripts de Infraestrutura e Automação**: `scripts/apps/habilitar-admin-remoto-totem1.ps1`, `scripts/apps/implantar-remoto.ps1`.

---

## Feature Inventory (Todos os 39 Itens de R1 a R6)

| # | Feature | Descrição | Milestone | Source |
|---|---------|-----------|-----------|--------|
| 1 | Fila de Impressão Persistida | Desacoplar a fila da RAM do Node.js, persistindo em `dbo.FilaImpressao` | M1 | Survey (Itens 1, 6) |
| 2 | Contingência Recepção Inativa | Não expurgar termos após 3h se a recepção (.53) estiver deslogada/fechada | M1 | Survey (Item 2) |
| 3 | Tratamento de Ausência de Impressora | Bloquear `ImprimirSilencioso` cego no totem; orientação clara em tela | M1 | Survey (Item 3) |
| 4 | Altura Dinâmica TM-T20 | Ajustar layout térmico de 297 mm fixos para altura automática na TM-T20 | M1 | Survey (Item 4) |
| 5 | Limpeza de Filas Fantasmas | Script/rotina para limpar spooler órfão nos totens (`EPSON TM-T20 Receipt`) | M1 | Survey (Item 5) |
| 6 | Rastreamento e Reentrega | Controle de status (`pendente`, `imprimindo`, `impressa`, `contingencia`) e retry 90s | M1 | Survey (Item 6) |
| 7 | Mascaramento de PII | Mascarar CPF, e-mail, telefone e endereço em `POST /api/totem/identificar` | M2 | Survey (Item 7) |
| 8 | Proteção de Dados de Menores | Proteger dados de dependentes menores de idade na tela pública | M2 | Survey (Item 8) |
| 9 | Token/ID Seguro de Totem | Substituir amarração por IP de socket (`identificadoNoTotem`) por token seguro | M2 | Survey (Item 9) |
| 10 | Bloqueio de Teclas Kiosk | Low-Level Keyboard Hook contra WinKey, Alt+Tab, Ctrl+Esc no teclado físico USB | M2 | Survey (Item 10) |
| 11 | Consentimento de Menores LGPD | Termo e consentimento explícito no cadastro de dependentes menores (LGPD Art. 14) | M2 | Survey (Item 11) |
| 12 | Instagram Opcional | Opção "Não possuo Instagram" no formulário e aceitação no backend | M3 | Survey (Item 12) |
| 13 | Telefone Internacional | Flexibilizar máscara e validação de telefone para turistas com passaporte | M3 | Survey (Item 13) |
| 14 | Harmonização de Faixas de Peso | Unificar limites de peso entre desktop (20–250 kg / 10–250 kg) e servidor | M3 | Survey (Item 14) |
| 15 | Preservação de Número e Complemento | Eliminar query que seta `Numero` e `Complemento` como NULL ao atualizar endereço | M3 | Survey (Item 15) |
| 16 | Edição Assistida de Cadastro | Permitir ajuste de nome e documento de cliente pré-existente com segurança | M3 | Survey (Item 16) |
| 17 | Tratamento Elegante de 409 | Tratar duplicidade de documento sem limpar campos já preenchidos | M3 | Survey (Item 17) |
| 18 | Correção do Cursor em Mascarar | Manter cursor na posição correta ao editar máscara sem saltar para o final | M3 | Survey (Item 18) |
| 19 | Parametrização SQL de Baterias | Eliminar interpolação de strings em consultas na rota `/api/totem/baterias` | M3 | Survey (Item 19) |
| 20 | Preservação de Seleção de Menores | Guardar seleção de participantes ao alternar para cadastro de novo menor | M4 | Survey (Item 20) |
| 21 | Bloqueio de Menor Desacompanhado | Impedir que menor corra sem responsável adulto validado | M4 | Survey (Item 21) |
| 22 | Bloqueio de Responsável Sem Piloto | Impedir avanço quando responsável desmarca a si mesmo e não marca dependente | M4 | Survey (Item 22) |
| 23 | Pausa do Temporizador em Modais | Pausar timer de inatividade de 90s durante exibição de modais e termos LGPD | M4 | Survey (Item 23) |
| 24 | Intercepção de Rolagem no Temporizador | Interceptar `WM_MOUSEWHEEL` (0x020A) e toque para resetar inatividade | M4 | Survey (Item 24) |
| 25 | Foco após Modal LGPD | Devolver foco para controle ativo após fechar diálogo LGPD | M4 | Survey (Item 25) |
| 26 | Totem Sem Teclado Virtual | Garantir foco automático contínuo para digitação no teclado físico USB | M4 | Survey (Item 26) |
| 27 | Detecção de Teclado USB | Emitir aviso caso o teclado físico USB não seja detectado | M4 | Survey (Item 27) |
| 28 | Bloqueio de Bateria Passada | Cortar estritamente baterias iniciadas (`Inicio > SYSDATETIME()`), sem tolerância | M5 | Survey (Item 28) |
| 29 | Mensagem de Vagas do Grupo | Informar quantidade de vagas restantes quando inferior ao tamanho do grupo | M5 | Survey (Item 29) |
| 30 | Detalhamento na Tela de Sucesso | Exibir horários e categorias de todas as baterias na tela final | M5 | Survey (Item 30) |
| 31 | Transparência de Preços na Grade | Exibir preço de cada categoria (Light vs Super) nos cards de baterias | M5 | Survey (Item 31) |
| 32 | Suporte a Pagamento Pix Dinâmico | Gerar payload e QR Code Pix autônomo na tela do totem | M5 | Survey (Item 32) |
| 33 | Concorrência na Última Vaga | Tratar race condition reatualizando a grade amigavelmente | M5 | Survey (Item 33) |
| 34 | Correção de Sintaxe PowerShell | Corrigir bloco órfão de firewall no script `habilitar-admin-remoto-totem1.ps1` | M6 | Survey (Item 34) |
| 35 | Sincronização NTP no Totem 1 | Configurar serviço W32Time para sincronismo com NTP.br e servidor local | M6 | Survey (Item 35) |
| 36 | Timeout Reduzido de HTTP | Reduzir timeout padrão do cliente HTTP de 30s para 8–10s | M6 | Survey (Item 36) |
| 37 | Verificação Assíncrona de Update | Tornar assíncrona a checagem de atualizações para eliminar tela preta | M6 | Survey (Item 37) |
| 38 | Eliminação de Vazamento GDI | `ContextMenuStrip.Dispose()` e reaproveitamento de bitmaps do logo | M6 | Survey (Item 38) |
| 39 | Pool ViaCep e Atalho StartUp | Pool e cancelamento de requisições no ViaCep; reter atalho no deploy | M6 | Survey (Item 39) |

---

## Milestones

| # | Nome | Escopo | Dependências | Status |
|---|------|--------|-------------|--------|
| M1 | R1 — Impressão e Gestão de Termos | Itens 1 a 6: Tabela SQL `dbo.FilaImpressao`, contingência, corte dinâmico TM-T20 e spooler | none | IN_PROGRESS |
| M2 | R2 — Segurança, Privacidade e LGPD | Itens 7 a 11: Mascaramento PII, token de sessão, Low-Level Hook Kiosk e consentimento | M1 | PLANNED |
| M3 | R3 — Validação de Dados e Cadastro | Itens 12 a 19: Instagram opcional, internacional, peso, preservação de endereço, 409 e SQL | M2 | PLANNED |
| M4 | R4 — Usabilidade, Hardware e Fluxo | Itens 20 a 27: Preservação de participantes, regras de menor, timer 90s, foco USB | M3 | PLANNED |
| M5 | R5 — Baterias, Agendamento e Concorrência | Itens 28 a 33: Bloqueio horário passado, vagas grupo, preços, Pix e transação atômica | M4 | PLANNED |
| M6 | R6 — Infraestrutura, Deploy e Ciclo de Vida | Itens 34 a 39: Scripts PowerShell, NTP, timeout HTTP, TratarInicioAsync e GDI | M5 | PLANNED |
| M7 | M7 — Homologação Integrada e Suíte E2E | Validação global: vitest 100%, tsc sem erro, build Release .NET 8, autoteste visual | M1..M6 | PLANNED |

---

## Interface Contracts

### Backend (Node.js) ↔ Desktop (WinForms)
- **POST `/api/totem/identificar`**:
  - Request: `{ documento: string }`
  - Response (200): `{ cliente: { id, nome, tipoDocumento, documentoMascarado, emailMascarado, telefoneMascarado, cep, enderecoMascarado, bairro, cidade, estado, lgpdAceiteEm, ... }, dependentes: [...], token: string, totemToken: string }`
- **POST `/api/totem/cadastro`**:
  - Request: `{ id?: number, nome, documento, tipoDocumento, email, telefone, nascimento, peso, instagram, semInstagram?: boolean, cep, endereco, lgpd: boolean, dependenteDe?: number, consentimentoMenor?: boolean }`
  - Headers: `X-Totem-Id: string`, `X-Totem-Session: string`
  - Response (200): `{ id, token, termoUrl, termoNaRecepcao: boolean }`
  - Response (409): `{ error: "documento_cadastrado", id, token }`
- **GET `/api/totem/baterias`**:
  - Response (200): `Array<{ id, inicio, vagas, livres, categoria, precoCentavos, valorFormatado, iniciada: boolean }>`
- **POST `/api/totem/inscrever`**:
  - Request: `{ baterias: number[], grupo: number[] }`
  - Headers: `X-Totem-Session: string`
  - Response (200): `{ inscricoes: number[], totalCentavos: number, pix?: { qrcode, copiaCola }, termoNaRecepcao: boolean }`
  - Response (409): `{ error: "vagas_insuficientes", bateriaId: number, livres: number, solicitadas: number }`
- **Fila de Impressão (`dbo.FilaImpressao`)**:
  - Campos: `Id, Url, Titulo, Origem, Status ('pendente'|'imprimindo'|'impressa'|'contingencia'), Tentativas, CriadoEm, PegoEm, FeitaEm`

---

## Code Layout

- Backend Ops:
  - `services/ops-server.ts`
  - `lib/ops/db.ts`
  - `lib/ops/termo.ts`
  - `lib/ops/totem-baterias.ts`
  - `lib/ops/cadastro-obrigatorio.ts`
  - `lib/ops/instagram.ts`
  - `lib/ops/office.ts`
  - `migrations/ops/0011_fila_impressao.sql`
- Desktop WinForms:
  - `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`
  - `desktop/src/Kartodromo.Autoatendimento/Controles.cs`
  - `desktop/src/Kartodromo.Autoatendimento/Program.cs`
  - `desktop/src/Kartodromo.Comum/Api.cs`
  - `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs`
  - `desktop/src/Kartodromo.Comum/Fmt.cs`
  - `desktop/src/Kartodromo.Comum/Relatorio.cs`
- Scripts:
  - `scripts/apps/habilitar-admin-remoto-totem1.ps1`
  - `scripts/apps/implantar-remoto.ps1`
  - `scripts/apps/limpar-spooler-totem.ps1`
- Testes:
  - `tests/ops/termo.test.ts`
  - `tests/ops/totem-baterias.test.ts`
  - `tests/ops/cadastro-obrigatorio.test.ts`
  - `tests/design-tokens/totem-congelado.test.ts`
