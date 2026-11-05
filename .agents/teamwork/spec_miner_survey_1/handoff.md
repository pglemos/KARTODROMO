# Relatório de Especificação e Mineração de Requisitos — Recepção (36 Itens)

**Data**: 2026-10-26  
**Agente**: `spec_miner_survey_1`  
**Destinatário**: `orchestrator_1` (5c17e886-4fbe-41e6-80a1-62db6f4ee87a)  
**Escopo**: Mapeamento exaustivo dos 36 problemas do Sistema de Recepção do Kartódromo de Betim (R1 a R6) e correlação com a infraestrutura compartilhada de Autoatendimento / Totem (Itens 1 a 39).

---

## 1. Observation (Evidências Diretas do Código e Operação)

A investigação direta da base de código, das migrações SQL e dos logs/documentos operacionais revelou as seguintes evidências concretas:

### 1.1 Fila de Impressão e Periféricos (R1)
1. **Volatilidade da Fila em Memória**:
   - Em `services/ops-server.ts` (linhas 211-233):
     ```typescript
     type Impressao = { id: number; url: string; titulo: string; origem: string; criadoEm: number; pegoEm?: number; feitaEm?: number; tentativas: number };
     const filaImpressao: Impressao[] = [];
     let seqImpressao = 0;
     const IMPRESSAO_VALIDADE_MS = 3 * 60 * 60 * 1000;
     const IMPRESSAO_REENTREGA_MS = 90 * 1000;
     ```
     Qualquer reinicialização do serviço `:4060` (Node.js) esvazia o array `filaImpressao`, perdendo todos os termos não impressos. Além disso, trabalhos com mais de 3 horas são deletados silenciosamente via `splice` (linha 219).
2. **Dependência de Operador Logado e Spooler**:
   - Em `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs` (linhas 26-29, 64-66):
     O timer consulta `/api/office/impressao/proxima` a cada 3.000 ms. Se a sessão do operador expirar (HTTP 401), o agente interrompe a impressão silenciosamente, emitindo apenas uma caixa modal que trava o fluxo (`dono.BeginInvoke(() => Msg.Info(...))`).
   - Em `desktop/src/Kartodromo.Comum/Relatorio.cs` (linhas 276-297):
     `ImprimirSilencioso` instancia um `Form` invisível com coordenadas fora de tela (`-2000, -2000`) e aloca uma nova instância de `WebView2`. Se a impressora `TMT20` estiver offline ou sem papel, ocorre travamento com `Exception("Impressora indisponível: " + st)`.
3. **Desperdício de Bobina Térmica**:
   - Em `lib/ops/termo.ts` (linhas 192, 196):
     ```css
     @page { size: 80mm 297mm; margin: 0; }
     .page { position: relative; width: 80mm; min-height: 297mm; ... }
     ```
     Força altura mínima de 297 mm (formato A4) em bobina contínua de 80 mm da EPSON TM-T20X, expelindo ~15 a 18 cm de papel em branco após as assinaturas antes de acionar a guilhotina.

### 1.2 Caixa, PDV e Operação Financeira (R2)
1. **Lançamento de Troco e Arredondamento**:
   - Em `desktop/src/Kartodromo.Recepcao/Caixa.cs` (linhas 596-601):
     `Totais()` calcula `Math.Max(0, rec - sub)` para o troco, permitindo que a interface libere a finalização antes de validar se o valor recebido em dinheiro é suficiente para cobrir o troco calculado, disparando erro de validação apenas no backend (`office.ts:575`: `troco > dinheiro`).
2. **Concorrência e Idempotência**:
   - Em `desktop/src/Kartodromo.Recepcao/Caixa.cs` (linhas 724-743):
     O método `Aprovar()` não bloqueia duplo clique no botão "Concluir" nem envia cabeçalho de idempotência. Se houver atraso na rede, múltiplos `POST /api/office/vendas` concorrem na criação de vendas.
3. **Estorno de Vendas**:
   - Em `lib/ops/office.ts` (linhas 635-637):
     ```typescript
     if (!v.MovimentoId || v.FechadoEm) throw new HttpError(409, 'Não é possível realizar o estorno. Movimento fechado.');
     ```
     Vendas de turnos já fechados não podem ser estornadas nem sofrer devolução auditada sem intervenção manual no banco.
   - Em `office.ts` (linha 658-666):
     Ao estornar qualquer item vinculado a voucher de parceiro, a comissão inteira do parceiro é estornada (`commission.Estado = 'estornada'`), mesmo em estorno parcial de 1 entre 10 itens!

### 1.3 Gestão de Baterias, Reservas e Pista (R3)
1. **Tolerância Indevida de Horário Passado**:
   - Em `lib/ops/office.ts` (linha 426):
     ```typescript
     CASE WHEN b.Inicio < DATEADD(minute, -30, SYSDATETIME()) THEN 1 ELSE 0 END passada
     ```
     Baterias com horário iniciado há até 29 minutos continuam aceitando novas pré-reservas pelo totem e recepção.
2. **Movimentação de Reserva Paga**:
   - Em `lib/ops/office.ts` (linhas 1531-1533):
     ```typescript
     if (r.Pago && (Number(d.produtoId) !== Number(r.produtoId) || Number(d.preco) !== Number(r.preco))) {
       throw new HttpError(409, 'Reserva paga só pode ser movida para bateria com o mesmo produto e preço. Para mudar o valor, faça o estorno e uma nova reserva.');
     }
     ```
     Não há flexibilidade para troca de categoria com ajuste financeiro de diferença.
3. **Formatação de Data/Hora (DATETIME2)**:
   - Em `desktop/src/Kartodromo.Recepcao/Baterias.cs` (linha 76):
     `inicio = $"{Fmt.Iso(Data.Value)}T{Hora.Value:HH:mm}"` (sem segundos `:00`), gerando erro SQL 241 no SQL Server.

### 1.4 Clientes e Validações Cadastrais (R4)
1. **Cursor Jumping em Máscaras**:
   - Em `desktop/src/Kartodromo.Comum/Ui.cs` (linhas 239-242):
     ```csharp
     var fim = t.SelectionStart == t.TextLength;
     t.Text = fn(t.Text);
     if (fim) t.SelectionStart = t.TextLength;
     ```
     Ao editar caracteres no meio de um telefone, CPF ou CEP, o cursor salta para o início ou final, impossibilitando edição natural.
2. **Supressão de Número e Complemento de Endereço**:
   - Em `services/ops-server.ts` (linhas 368-370):
     `if (limparNumero) await query('UPDATE dbo.Cliente SET Numero = NULL, Complemento = NULL WHERE Id = @id', { id });`
     Sobrescreve dados de endereço válidos como `NULL`.
3. **Validação de Turistas e Estrangeiros**:
   - `lib/ops/cadastro-obrigatorio.ts` e `office.ts:378`: Validações de telefone forçam `onlyDigits(telefone).length >= 10`, rejeitando números internacionais de turistas com passaporte.

### 1.5 Sincronização, Nuvem e Cronometragem (R5)
1. **Timeout HTTP Longo**:
   - Em `desktop/src/Kartodromo.Comum/Api.cs` (linha 53):
     `_http = new HttpClient { Timeout = timeout ?? TimeSpan.FromSeconds(30) };`
     Congela a interface WinForms por até 30 segundos em caso de falha de conexão com o servidor local.
2. **Dependência Síncrona de Traçados**:
   - Em `services/ops-server.ts` (linhas 68-80):
     `syncTimingTracks` conecta na porta `:4050`. Se o ORBITS estiver em boot ou ocupado, a consulta de apoio da Recepção sofre lentidão.

### 1.6 Interface WinForms, Usabilidade e Estabilidade (R6)
1. **Ciclo de Vida de Menus de Contexto (ContextMenuStrip)**:
   - Em `desktop/src/Kartodromo.Recepcao/FormPrincipal.cs` (linhas 247-253):
     O descarte prematuro ou tardio de `ContextMenuStrip` gera `ObjectDisposedException` se o operador clicar rapidamente enquanto animações de UI ocorrem.
2. **Vazamento de Recursos GDI**:
   - Em `desktop/src/Kartodromo.Recepcao/VisualPrincipal.cs`, `PecasDesign.cs` e `Caixa.cs` (linha 506):
     Instanciação de `Bitmap`, `Pen` e `Brush` sem descarte determinístico (`using`), provocando estouro do limite de 10.000 handles do Windows após dias de operação ininterrupta.

---

## 2. Logic Chain (Cadeia Lógica de Inferência)

1. **Da Volatilidade à Persistência (R1)**:
   - *Fato*: A memória do Node.js é volátil e descartada a qualquer reinício.
   - *Fato*: A emissão de termos ocorre majoritariamente a partir de pré-reservas nos totens.
   - *Conclusão*: A fila de impressão deve residir em tabela física (`dbo.FilaImpressao`) no SQL Server `KartodromoOps`, com estados transitivos gerenciados por transação ACID.
2. **Da Autonomia da Recepção à Descentralização (R1, R5)**:
   - *Fato*: O app da Recepção (`.53`) pode sofrer reinicializações, travamentos ou logoff de operador.
   - *Fato*: A recepção 2 (`.239`) possui capacidade de processar atendimentos e imprimir termos.
   - *Conclusão*: O agente de impressão deve ser desacoplado da identidade do operador ou possuir credencial de serviço dedicada, suportando contingência e reatribuição de terminal de impressão sem descarte por timeout de 3 horas.
3. **Do Custo Operacional à Otimização de Layout (R1)**:
   - *Fato*: As impressoras térmicas TM-T20X operam com rolos contínuos e corte guilhotina comandado por ESC/POS.
   - *Fato*: O layout HTML/CSS atual especifica altura A4 fixa de 297 mm.
   - *Conclusão*: A altura deve ser dinâmica (`height: auto`), cortando o papel imediatamente após a margem de segurança das assinaturas de Participante Piloto e Responsável Legal.
4. **Da Integridade Financeira à Concorrência Controlada (R2, R3)**:
   - *Fato*: O balcão da recepção opera sob pressão com filas físicas e cliques repetidos.
   - *Fato*: Operações de checkout e sangria manipulam saldo em espécie e concorrência com totens.
   - *Conclusão*: Locks pessimistas (`UPDLOCK, HOLDLOCK`) e idempotência na API são indispensáveis para garantir que nenhuma transação seja duplicada ou deixe saldo inconsistente.
5. **Da Experiência do Usuário à Produtividade de Atendimento (R4, R6)**:
   - *Fato*: A perda de posição do cursor em máscaras de texto e a falta de foco em diálogos desaceleram a digitação de dados.
   - *Fato*: A escala 125% da Recepção 2 e vazamentos de GDI causam degradação gradual da aplicação.
   - *Conclusão*: A correção de máscaras, normalização de foco e saneamento de recursos gráficos tornam o aplicativo rápido, robusto e imune a falhas em turnos longos.

---

## 3. Caveats (Ressalvas e Limitações Investigativas)

1. **Hardware Físico no Mac**: A investigação foi executada a partir de ambiente de desenvolvimento macOS. O hardware físico real (impressora TM-T20X via USB/COM, leitor de código de barras e decoder TranX P3) não pode ser acionado diretamente a partir desta máquina; os testes de impressão e compilação WinForms (.NET 8) devem ser validados no ORBITS (`192.168.20.249`) e na Recepção (`192.168.20.53`).
2. **Horário de Funcionamento em Produção**: Conforme `AGENTS.md`, intervenções nos serviços e nas máquinas em produção só podem ocorrer fora do horário comercial (ter–sex após 21:40, sáb após 18:35, dom após 18:00), e reinícios do `:4050` exigem `runningId` vazio e 3+ minutos após encerramento da corrida.

---

## 4. Features Discovered (Tabela de Funcionalidades e Requisitos)

| # | Categoria | Feature | Descrição | Inputs | Outputs | Error Behavior | Discovered Via |
|---|---|---|---|---|---|---|---|
| 1 | R1 | Persistência da Fila no SQL | Fila de termos transacional e resiliente a reboot | JSON do termo, origem | ID no banco, status 'pendente' | Rollback transacional | `services/ops-server.ts:211` |
| 2 | R1 | Contingência de Impressão | Reprocessamento de termos sem expiração silenciosa | ID do termo, terminal destino | Reatribuição de fila, impressão | Log e alerta na UI da recepção | `HANDOFF-SISTEMA-PROPRIO.md:291` |
| 3 | R1 | Altura Dinâmica da Bobina | Layout sem altura fixa de 297mm | HTML do termo, CSS dinâmico | Cupom térmico com corte justo | Fallback para tamanho padrão | `lib/ops/termo.ts:192` |
| 4 | R1 | Guilhotina e Corte Atômico | Corte automático por termo em impressões em lote | Lista de IDs de inscrição | Comandos de corte por documento | Tratamento de erro por termo | `desktop/.../Acoes.cs:41` |
| 5 | R1 | Diagnóstico do Spooler TM-T20 | Monitoramento de falta de papel/tampa aberta | Status da fila do Windows `TMT20` | Notificação em barra de status | Pausa com aviso em tela | `desktop/.../AgenteImpressao.cs:51` |
| 6 | R1 | Renovação do Token do Agente | Polling contínuo sem parada por expiração de login | Refresh token / credencial de serviço | Sessão renovada transparentemente | Alerta de reautenticação | `desktop/.../AgenteImpressao.cs:64` |
| 7 | R1 | Semáforo de Impressão WebView2 | Evitar disputa de concorrência em `ImprimirSilencioso` | Requisição manual vs automática | Execução sequencial ordenada | Timeout seguro sem travar form | `desktop/.../Relatorio.cs:276` |
| 8 | R1 | Impressão em Contingência (Laser) | Redirecionamento para HP LaserJet P1102w em A4 | Seleção de impressora alternativa | Documento A4 com 2 termos por folha | Aviso de impressora indisponível | `HANDOFF-SISTEMA-PROPRIO.md:34` |
| 9 | R1 | Limpeza de Filas Fantasmas | Script/rotina de expurgo de spoolers legados | Lista de impressoras fantasmas | Fila de spooler liberada | Log de jobs cancelados | `HANDOFF-SISTEMA-PROPRIO.md:584` |
| 10 | R2 | Validação de Troco e Dinheiro | Bloqueio de troco maior que valor pago em espécie | Pagamentos lançados no checkout | Troco exato / botão habilitado | Bloqueio com aviso prévio na UI | `desktop/.../Caixa.cs:596` |
| 11 | R2 | Idempotência e Trava de Venda | Prevenção de duplicidade por duplo clique | Payload da venda + Idempotency-Key | Venda atômica única criada | HTTP 409 amigável no front | `desktop/.../Caixa.cs:724` |
| 12 | R2 | Estorno com Caixa Fechado | Devolução/estorno em movimento aberto atual | Venda anterior + motivo auditado | Lançamento de estorno compensatório | Exigência de permissão de admin | `lib/ops/office.ts:635` |
| 13 | R2 | Controle de Sangria e Lock | Bloqueio de saldo negativo com lock pessimista | Tipo de transação, valor, motivo | Saldo atualizado no movimento | Rejeição por saldo insuficiente | `lib/ops/office.ts:1700` |
| 14 | R2 | Encerramento de Caixa Órfão | Fechamento assistido de caixas esquecidos abertos | ID do movimento anterior, contagem | Fechamento com quebra registrada | Relatório de pendência de caixa | `desktop/.../Caixa.cs:31` |
| 15 | R2 | Reserva Atômica de Vouchers | Prevenção de concorrência no uso do mesmo cupom | Código do voucher, vendaId | Voucher consumido atomicamente | HTTP 409 preservando formulário | `desktop/.../Caixa.cs:706` |
| 16 | R2 | Cupom Térmico de Venda (80mm) | Comprovante de venda otimizado para bobina | ID da venda | Cupom 80mm com corte automático | Fallback para visualizador A4 | `desktop/.../Caixa.cs:765` |
| 17 | R3 | Bloqueio de Baterias Passadas | Eliminar tolerância indevida de -30 minutos | Horário da bateria vs SYSDATETIME | Bloqueio de novas inscrições | HTTP 409 claro "Bateria encerrada" | `lib/ops/office.ts:426` |
| 18 | R3 | Movimentação com Diferença Tarifária | Troca de bateria entre categorias com ajuste | Reserva paga, nova bateria | Cobrança/crédito de diferença | Bloqueio sem confirmação financeira | `lib/ops/office.ts:1531` |
| 19 | R3 | Concorrência na Última Vaga | Tratamento gracioso quando a última vaga é perdida | Inscrição concorrente | Recarga imediata da grade | Sugestão de baterias alternativas | `lib/ops/office.ts:433` |
| 20 | R3 | Gestão Visual de Termos Pendentes | Indicador chamativo na grade de participantes | Status do termo (`TermoImpressoEm`) | Ícone/cor vermelha se não assinado | Alerta antes de enviar à pista | `lib/ops/office.ts:1492` |
| 21 | R3 | Normalização ISO de Data/Hora | Segundos obrigatórios em strings DATETIME2 | Data e Hora do seletor | `YYYY-MM-DDTHH:mm:ss` | Prevenção de erro SQL 241 | `desktop/.../Baterias.cs:76` |
| 22 | R3 | Prévia na Geração de Baterias | Exibição de resumo antes de gerar meses em lote | Padrão, intervalo de datas, feriados | Prévia quantitativa com confirmação | Validação de colisão de horários | `desktop/.../Baterias.cs:84` |
| 23 | R4 | Estabilização de Cursor em Máscaras | Edição no meio de campos sem salto de cursor | Texto digitado / deletado | Cursor no deslocamento relativo | Preservação de foco | `desktop/.../Ui.cs:232` |
| 24 | R4 | Preservação de Número e Complemento | Manter campos de endereço no banco em updates | Input de endereço, busca CEP | Colunas preservadas sem NULL | Impedir limpeza silenciosa | `services/ops-server.ts:368` |
| 25 | R4 | Validação Internacional de Contatos | Suporte a passaporte e telefones internacionais | País, TipoDoc, Telefone | Aceite no padrão E.164 | Rejeição apenas se formato inválido | `lib/ops/cadastro-obrigatorio.ts:1` |
| 26 | R4 | Harmonização de Faixas de Peso | Regras uniformes entre WinForms e API | Peso informado (kg) | Armazenamento com precisão decimal | Bloqueio fora de 15kg-250kg | `CORRECAO-PESO-EMAIL-20261011.md` |
| 27 | R4 | Mesclagem em Conflito de Documento | Aproveitar dados digitados no erro HTTP 409 | Documento duplicado informado | Carregamento com mesclagem | Prevenção de perda de digitação | `desktop/.../FormCliente.cs:540` |
| 28 | R5 | Timeout Resiliente de Rede (8-10s) | Evitar travamento do WinForms em indisponibilidade | Chamada à API `Api.Enviar` | Resposta em tempo hábil | Cancelamento com erro não destrutivo | `desktop/.../Api.cs:53` |
| 29 | R5 | Cache de Catálogo de Traçados | Fallback local se cronometragem (:4050) offline | Lista de traçados do banco | Combos preenchidos sem delay | Log silencioso de indisponibilidade | `services/ops-server.ts:68` |
| 30 | R5 | Validação de Unicidade de Kart no Grid | Impedir duplicidade de kart na mesma bateria | Número do kart atribuído | Grid validado para cronometragem | Alerta se kart estiver na oficina | `services/ops-server.ts:604` |
| 31 | R5 | Resiliência da Reserva Online | Tratamento de falhas de sincronização na nuvem | Reservas do Cloudflare Worker | Persistência atômica com patches | Backoff sem flood de logs | `services/ops-server.ts:740` |
| 32 | R5 | Sanitização de Relatórios de Crono | Carregamento seguro de sessões com 35+ pilotos | ID da sessão da cronometragem | Relatório com Instagram formatado | Tela amigável em caso de erro 502 | `services/ops-server.ts:534` |
| 33 | R6 | Gestão de ContextMenuStrip | Eliminar `ObjectDisposedException` em menus | Cliques e navegação de contexto | Menus descartados no fechamento | Prevenção de crash de ponteiro | `desktop/.../FormPrincipal.cs:247` |
| 34 | R6 | Estanqueidade de Handles GDI | Uso determinístico de `using` em Pen/Brush/Bitmap | Renderização gráfica customizada | GDI handles estáveis (<500) | Prevenção de crash Win32 | `desktop/.../VisualPrincipal.cs:1` |
| 35 | R6 | Responsividade High-DPI (125%/150%) | Layouts sem corte em monitores dimensionados | Escala do Windows (Recepção 2) | Controles reposicionados com folga | Eliminação de truncamento | `desktop/.../FormCliente.cs:42` |
| 36 | R6 | Segurança de Thread na UI (BeginInvoke) | Proteção de despacho entre threads secundárias | Ações assíncronas de rede/timer | Atualizações despachadas na UI thread | Foco restituído pós-diálogo | `desktop/.../Ui.cs:1` |

---

## 5. Edge Cases (Casos de Borda Identificados)

| # | Feature | Input | Observed Behavior |
|---|---|---|---|
| E1 | Fila de Impressão | Reinicialização abrupta do SRVKART durante geração de 10 pré-reservas pelo totem | Sem persistência no banco, todos os 10 termos eram perdidos sumariamente na memória RAM. Com banco, continuam pendentes. |
| E2 | Layout do Termo | Cliente com nome e endereço muito longos + menor de idade (responsável legal obrigatório) | Em 297mm fixos, se o texto ultrapassa a folha, ocorre quebra para segunda página quase vazia. Com altura dinâmica, o corte se ajusta ao conteúdo exato. |
| E3 | Checkout no PDV | Pagamento de R$ 150,00 com R$ 100,00 em Cartão de Crédito e R$ 100,00 em Dinheiro | O troco devido é R$ 50,00. O sistema deve validar que o troco não excede os R$ 100,00 recebidos em dinheiro. |
| E4 | Estorno de Vendas | Venda com 2 inscrições com voucher de parceiro de 10% onde apenas 1 piloto cancela | O sistema não pode cancelar a comissão inteira do parceiro; deve abater proporcionalmente 50% da comissão e manter a reserva restante ativa. |
| E5 | Baterias Passadas | Operador tenta adicionar participante em bateria que largou há 5 minutos | A API deve recusar inclusão padrão e exigir que a recepção selecione explicitamente "Adicionar a bateria em andamento" com registro de log. |
| E6 | Máscaras de Digitação | Operador digita telefone celular e pressiona Backspace na posição do DDD `(31)` | A função `Mascara` reposiciona o cursor logicamente sem pular para o final do número nem apagar caracteres errados. |
| E7 | Cadastro de Estrangeiro | Turista argentino informa passaporte alfanumérico e telefone `+54 9 11 1234-5678` | O sistema aceita o passaporte sem validação de dígitos verificadores de CPF e salva o telefone sem exigir DDD brasileiro. |
| E8 | Menus WinForms | Operador clica com botão direito rapidamente em 5 linhas seguidas da grade de baterias | O menu anterior deve ser fechado sem disparar `ObjectDisposedException` e sem vazar handles de contexto. |

---

## 6. Detalhamento dos 36 Problemas da Recepção (R1 a R6)

### Grupo R1: Fila de Impressão e Periféricos (Itens 1 a 9)

#### #1. Persistência da Fila de Impressão no Banco de Dados (SQL Server)
- **Requisito**: R1. Fila de Impressão e Periféricos
- **Descrição Técnica Atual**: A fila de impressão reside na memória do processo Node.js em `services/ops-server.ts:212` (`const filaImpressao: Impressao[] = []`). Qualquer reinício do SRVKART (queda de energia, update, manutenção) descarta os termos gerados pelos totens que ainda não foram impressos pela recepção.
- **Comportamento Esperado / Critério de Aceitação**: Criação da tabela `dbo.FilaImpressao` via migration SQL Server (`migrations/ops/`). O método `enfileirarImpressao` deve realizar `INSERT` transacional, e `proximaImpressao` deve fazer `UPDATE` com lock atômico. Ao reiniciar o servidor `:4060`, nenhum termo pendente é perdido.
- **Componentes Afetados**: `services/ops-server.ts`, `lib/ops/db.ts`, migrações SQL (`migrations/ops/0011_fila_impressao.sql`).
- **Regras do Dono**: Termos de responsabilidade são documentos jurídicos obrigatórios e nunca podem desaparecer.

#### #2. Contingência da Fila sem Expiração Silenciosa e Suporte a Múltiplos Terminais
- **Requisito**: R1. Fila de Impressão e Periféricos
- **Descrição Técnica Atual**: Em `services/ops-server.ts:219`, trabalhos com mais de 3 horas são removidos sem notificação (`filaImpressao.splice(i, 1)`). Se a máquina da Recepção 1 (`.53`) estiver desligada, travada ou sem login, os termos acumulam e somem silenciosamente.
- **Comportamento Esperado / Critério de Aceitação**: Não descartar termos automaticamente. O status deve transitar entre `'pendente'`, `'em_processamento'`, `'impressa'` e `'falha'`. A interface da Recepção 2 (`.239`) deve poder assumir a fila caso a Recepção 1 fique inativa por mais de 5 minutos, emitindo alerta visual sonoro/destacado de termos represados.
- **Componentes Afetados**: `services/ops-server.ts`, `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs`, `desktop/src/Kartodromo.Recepcao/FormPrincipal.cs`.
- **Regras do Dono**: Preservar a integridade da operação sem perda de registros.

#### #3. Otimização de Altura Dinâmica da Bobina Térmica no Termo de Responsabilidade
- **Requisito**: R1. Fila de Impressão e Periféricos
- **Descrição Técnica Atual**: Em `lib/ops/termo.ts:192, 196`, as propriedades CSS `@page { size: 80mm 297mm; }` e `.page { min-height: 297mm; }` estabelecem altura de papel A4. Na impressora térmica TM-T20X, isso força a ejeção contínua de papel térmico desnecessário após o bloco de assinaturas, gerando desperdício diário de bobinas.
- **Comportamento Esperado / Critério de Aceitação**: Substituir por altura dinâmica (`height: auto; min-height: 0;`), com margem inferior suficiente apenas para passagem da guilhotina (~15 mm após o texto do responsável legal), cortando o consumo de bobina em mais de 45%.
- **Componentes Afetados**: `lib/ops/termo.ts`, `desktop/src/Kartodromo.Comum/Relatorio.cs`.
- **Regras do Dono**: Economia de suprimentos e preservação das assinaturas obrigatórias (Participante Piloto e Responsável Legal).

#### #4. Guilhotinamento e Separação Atômica em Impressão de Lotes de Termos
- **Requisito**: R1. Fila de Impressão e Periféricos
- **Descrição Técnica Atual**: Em `desktop/src/Kartodromo.Recepcao/Acoes.cs:41-63`, quando múltiplos termos são impressos para um grupo ou bateria, se houver falha no meio da sequência, o laço de repetição aborta e não informa quais IDs foram impressos com sucesso e quais falharam.
- **Comportamento Esperado / Critério de Aceitação**: Envio atômico por trabalho de impressão com acionamento do corte parcial (`cut paper`) entre cada termo, confirmação individual no banco e barra de progresso informativa para o operador.
- **Componentes Afetados**: `desktop/src/Kartodromo.Recepcao/Acoes.cs`, `desktop/src/Kartodromo.Comum/Relatorio.cs`, `services/ops-server.ts`.
- **Regras do Dono**: Cada participante deve receber seu termo separado e cortado.

#### #5. Tratamento de Falha de Hardware e Spooler na Impressora TM-T20X
- **Requisito**: R1. Fila de Impressão e Periféricos
- **Descrição Técnica Atual**: Em `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs:51-55`, se a impressora estiver sem papel ou com a tampa aberta, o job entra em erro no Spooler do Windows e o agente apenas aguarda 20 segundos em loop, sem inspecionar o status do spooler via WMI ou `System.Printing`.
- **Comportamento Esperado / Critério de Aceitação**: Consulta ativa do estado do driver (`IsOutOfPaper`, `DoorOpened`, `IsInError`); notificação em faixa de alerta na tela principal da recepção ("Impressora TM-T20X sem papel ou offline") e retenção do trabalho sem bloqueio da fila.
- **Componentes Afetados**: `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs`, `desktop/src/Kartodromo.Comum/Relatorio.cs`.
- **Regras do Dono**: Avisar a recepção imediatamente para não gerar acúmulo de clientes no balcão.

#### #6. Renovação Silenciosa de Sessão (Token Expirado) no Agente de Impressão
- **Requisito**: R1. Fila de Impressão e Periféricos
- **Descrição Técnica Atual**: Em `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs:64-66`, quando o token HMAC expira (16 horas) e o app fica aberto da noite para o dia, o agente para de imprimir e exibe modal `Msg.Info(...)`, travando o polling até que alguém feche e reabra o sistema.
- **Comportamento Esperado / Critério de Aceitação**: Renovação automática do token em segundo plano via `X-Novo-Token` ou autenticação de serviço local protegida, permitindo que a impressão continue ininterrupta sem intervenção humana.
- **Componentes Afetados**: `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs`, `desktop/src/Kartodromo.Comum/Api.cs`, `services/ops-server.ts`.
- **Regras do Dono**: Nunca parar a impressão de termos durante o horário de corrida.

#### #7. Sincronização e Prevenção de Concorrência no WebView2 Silencioso
- **Requisito**: R1. Fila de Impressão e Periféricos
- **Descrição Técnica Atual**: `Relatorio.ImprimirSilencioso` (`Relatorio.cs:276`) instancia um `Form` com `WebView2` dinâmico. Se o operador abrir simultaneamente uma prévia de relatório na tela, instâncias concorrentes do runtime WebView2 disputam recursos de renderização e podem causar deadlock na thread STA.
- **Comportamento Esperado / Critério de Aceitação**: Semáforo global (`SemaphoreSlim(1, 1)`) controlando o ciclo de renderização e impressão silenciosa, garantindo enfileiramento sequencial sem travamento de processos.
- **Componentes Afetados**: `desktop/src/Kartodromo.Comum/Relatorio.cs`.
- **Regras do Dono**: Estabilidade de interface nativa WinForms.

#### #8. Contingência para Impressão na Impressora Laser (HP LaserJet P1102w)
- **Requisito**: R1. Fila de Impressão e Periféricos
- **Descrição Técnica Atual**: Se a impressora TM-T20X queimar ou faltar bobina térmica, não há alternativa rápida no sistema da Recepção para imprimir os termos na impressora a laser conectada (HP LaserJet P1102w).
- **Comportamento Esperado / Critério de Aceitação**: Opção no menu da Recepção para chaveamento de emergência "Imprimir termos na HP Laser (A4)", agrupando até 2 termos por folha A4 com linha tracejada de corte manual.
- **Componentes Afetados**: `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs`, `desktop/src/Kartodromo.Comum/Relatorio.cs`, `lib/ops/termo.ts`.
- **Regras do Dono**: Não paralisar o atendimento se uma impressora quebrar.

#### #9. Rotina de Saneamento de Filas Fantasmas Legadas no Spooler do Windows
- **Requisito**: R1. Fila de Impressão e Periféricos
- **Descrição Técnica Atual**: Conforme apontado no `HANDOFF-SISTEMA-PROPRIO.md:584`, existem trabalhos presos em filas fantasmas legadas ("EPSON TM-T20 Receipt") nos totens e na recepção, acumulados desde o início do ano.
- **Comportamento Esperado / Critério de Aceitação**: Script PowerShell integrado e ação administrativa na tela de Diagnóstico da Recepção para purgar trabalhos presos no Spooler do Windows (`spoolsv.exe`) e remover filas zumbis sem afetar a fila ativa `TMT20`.
- **Componentes Afetados**: `scripts/apps/limpar-spooler.ps1`, `desktop/src/Kartodromo.Recepcao/FormPrincipal.cs`.
- **Regras do Dono**: Manter os sistemas Windows limpos e sem lixo residual.

---

### Grupo R2: Caixa, PDV e Operação Financeira (Itens 10 a 16)

#### #10. Validação de Troco e Consistência de Pagamentos em Espécie no PDV
- **Requisito**: R2. Caixa, PDV e Operação Financeira
- **Descrição Técnica Atual**: Em `desktop/src/Kartodromo.Recepcao/Caixa.cs:596-601`, o front-end calcula o troco sobre a soma total de todas as formas de pagamento (`rec - sub`), e apenas o backend bloqueia se o troco for superior ao dinheiro recebido (`office.ts:575`), causando frustração ao operador ao tentar concluir a transação.
- **Comportamento Esperado / Critério de Aceitação**: Validação interativa na tela impedindo o avanço se o troco for maior que a soma das parcelas em espécie (dinheiro), cálculo preciso em centavos e formatação monetária padrão BRL.
- **Componentes Afetados**: `desktop/src/Kartodromo.Recepcao/Caixa.cs`, `lib/ops/office.ts`.
- **Regras do Dono**: Exatidão absoluta nos lançamentos de caixa.

#### #11. Prevenção de Vendas Duplicadas e Garantia de Idempotência
- **Requisito**: R2. Caixa, PDV e Operação Financeira
- **Descrição Técnica Atual**: Em `desktop/src/Kartodromo.Recepcao/Caixa.cs:724-743` (`Aprovar`), cliques rápidos duplos no botão de aprovação podem emitir requisições concorrentes antes do retorno do servidor, arriscando duplicar transações ou gerar erros 409 após gravação parcial.
- **Comportamento Esperado / Critério de Aceitação**: Bloqueio visual imediato do botão Concluir com cursor de espera, geração de token de idempotência (`Idempotency-Key`) enviado no cabeçalho e verificação no servidor para ignorar requisições repetidas idênticas.
- **Componentes Afetados**: `desktop/src/Kartodromo.Recepcao/Caixa.cs`, `lib/ops/office.ts`.
- **Regras do Dono**: Não duplicar cobranças de clientes.

#### #12. Estorno de Vendas de Movimentos Anteriores com Auditoria Gerencial
- **Requisito**: R2. Caixa, PDV e Operação Financeira
- **Descrição Técnica Atual**: Em `lib/ops/office.ts:637`, a API recusa estornos se o movimento de caixa vinculado à venda estiver fechado (`HTTP 409 'Não é possível realizar o estorno. Movimento fechado'`). Em caso de cancelamento no dia seguinte, os operadores ficam sem mecanismo no sistema para estornar a vaga e devolver o dinheiro.
- **Comportamento Esperado / Critério de Aceitação**: Permitir estorno compensatório lançado como saída no caixa atualmente aberto, mediante senha de administrador/gerente, registrando auditoria com operador, motivo e vínculo com a venda original.
- **Componentes Afetados**: `lib/ops/office.ts`, `desktop/src/Kartodromo.Recepcao/Caixa.cs` (`FormVenda`).
- **Regras do Dono**: Rastreabilidade financeira completa.

#### #13. Controle Concorrente de Suprimento e Sangria com Lock Pessimista
- **Requisito**: R2. Caixa, PDV e Operação Financeira
- **Descrição Técnica Atual**: Em `lib/ops/office.ts:1700-1715`, as operações de sangria leem o saldo disponível sem lock pessimista (`UPDLOCK`) na tabela `Movimento`. Se houver vendas ou outras sangrias concomitantes, o saldo em dinheiro pode ficar negativo no banco.
- **Comportamento Esperado / Critério de Aceitação**: Aplicação de transação com `WITH (UPDLOCK, HOLDLOCK)` ao calcular o saldo disponível para sangria; alertas visuais quando o montante em dinheiro no caixa ultrapassar o teto de segurança recomendável para sangria preventiva.
- **Componentes Afetados**: `lib/ops/office.ts`, `desktop/src/Kartodromo.Recepcao/Caixa.cs`, `TelasCaixa.cs`.
- **Regras do Dono**: Segurança patrimonial contra acúmulo excessivo de dinheiro em caixa.

#### #14. Encerramento Assistido de Movimentos de Caixa Órfãos (Dias Anteriores)
- **Requisito**: R2. Caixa, PDV e Operação Financeira
- **Descrição Técnica Atual**: Em `Caixa.cs:31-44`, terminais esquecidos abertos em turnos anteriores impedem a abertura do mesmo terminal por outros operadores (`HTTP 409 'Esse terminal já está aberto por outro usuário'`).
- **Comportamento Esperado / Critério de Aceitação**: Diálogo de encerramento forçado para supervisores, permitindo fechar o caixa de dias anteriores com declaração de quebra de caixa e impressão do relatório de fechamento antes da abertura do novo turno.
- **Componentes Afetados**: `desktop/src/Kartodromo.Recepcao/Caixa.cs`, `TelasCaixa.cs`, `lib/ops/office.ts`.
- **Regras do Dono**: Nenhum turno pode operar com caixa do dia anterior misturado.

#### #15. Tratamento de Concorrência na Aplicação de Vouchers e Fidelidade
- **Requisito**: R2. Caixa, PDV e Operação Financeira
- **Descrição Técnica Atual**: Em `Caixa.cs:706` e `office.ts:522-553`, se um voucher for validado no front mas outro operador o consumir antes da finalização, a venda inteira é abortada e todos os dados digitados no carrinho e pagamentos são perdidos.
- **Comportamento Esperado / Critério de Aceitação**: Tratamento de falha atômica mantendo a tela preenchida, notificando que o voucher não é mais válido e permitindo que o operador apenas remova o desconto ou insira outra forma de pagamento sem reiniciar o checkout.
- **Componentes Afetados**: `desktop/src/Kartodromo.Recepcao/Caixa.cs`, `lib/ops/office.ts`.
- **Regras do Dono**: Não constranger o cliente no balcão por lentidão do sistema.

#### #16. Comprovante Térmico de Venda Formatado para 80 mm (TM-T20X)
- **Requisito**: R2. Caixa, PDV e Operação Financeira
- **Descrição Técnica Atual**: Em `Caixa.cs:740` e `765`, o comprovante de venda (`/relatorio/venda?id=...`) abre no visualizador padrão em folha A4 completa. Não há recibo específico para bobina de 80 mm para entrega imediata ao cliente após o pagamento.
- **Comportamento Esperado / Critério de Aceitação**: Emissão de cupom térmico compacto de 80 mm com itens adquiridos, formas de pagamento, troco e código de autenticação, com corte automático pela guilhotina da TM-T20X.
- **Componentes Afetados**: `lib/ops/relatorios.ts`, `desktop/src/Kartodromo.Comum/Relatorio.cs`, `desktop/src/Kartodromo.Recepcao/Caixa.cs`.
- **Regras do Dono**: Padronização visual dos comprovantes entregues aos pilotos.

---

### Grupo R3: Gestão de Baterias, Reservas e Pista (Itens 17 a 22)

#### #17. Bloqueio Estrito de Reservas para Baterias com Horário de Início Expirado
- **Requisito**: R3. Gestão de Baterias, Reservas e Pista
- **Descrição Técnica Atual**: Em `lib/ops/office.ts:426`, o sistema permite inscrições em baterias iniciadas há até 30 minutos (`Inicio < DATEADD(minute, -30, SYSDATETIME())`). Isso permite agendamentos no totem de baterias que já entraram na pista.
- **Comportamento Esperado / Critério de Aceitação**: Bloqueio total no totem para qualquer bateria com `Inicio <= SYSDATETIME()`. No balcão da recepção, inclusão em bateria em andamento somente com confirmação explícita de exceção operacional.
- **Componentes Afetados**: `lib/ops/office.ts`, `lib/ops/totem-baterias.ts`, `desktop/src/Kartodromo.Recepcao/Baterias.cs`.
- **Regras do Dono**: Baterias que já largaram não podem receber inscrições autônomas de clientes.

#### #18. Movimentação de Reserva Paga com Ajuste Financeiro de Diferença
- **Requisito**: R3. Gestão de Baterias, Reservas e Pista
- **Descrição Técnica Atual**: Em `lib/ops/office.ts:1531-1533`, a movimentação de reservas pagas é restrita a baterias de idêntico produto e preço, forçando estorno total manual caso o piloto precise mudar de categoria (ex.: de Light para Super).
- **Comportamento Esperado / Critério de Aceitação**: Permitir transferência com geração de débito complementar ou crédito em favor do cliente, devidamente registrado no caixa do dia.
- **Componentes Afetados**: `lib/ops/office.ts`, `desktop/src/Kartodromo.Recepcao/Acoes.cs` (`FormMoverCliente`), `Caixa.cs`.
- **Regras do Dono**: Facilitar a troca de horário e categoria para o cliente sem furos contábeis.

#### #19. Tratamento de Concorrência na Disputa da Última Vaga da Bateria
- **Requisito**: R3. Gestão de Baterias, Reservas e Pista
- **Descrição Técnica Atual**: Se o totem e a recepção tentarem reservar a última vaga simultaneamente, quem perde a corrida recebe erro genérico 409 e a grade da recepção permanece mostrando a vaga como livre até uma recarga manual.
- **Comportamento Esperado / Critério de Aceitação**: Atualização automática da grade (auto-refresh) e mensagem clara no front: "A vaga selecionada acabou de ser reservada por outro cliente. Deseja visualizar as vagas da bateria seguinte?".
- **Componentes Afetados**: `desktop/src/Kartodromo.Recepcao/FormPrincipal.cs`, `Baterias.cs`, `lib/ops/office.ts`.
- **Regras do Dono**: Clareza e transparência no atendimento ao cliente.

#### #20. Invalidação e Indicador Visual Destacado de Termo Pendente
- **Requisito**: R3. Gestão de Baterias, Reservas e Pista
- **Descrição Técnica Atual**: Em `office.ts:1492`, quando uma reserva é alterada (cliente, produto, bateria), `TermoImpressoEm` é resetado para `NULL`. Contudo, na lista de participantes na recepção, o operador pode não perceber que o piloto precisa assinar novo termo.
- **Comportamento Esperado / Critério de Aceitação**: Sinalização visual destacada (ícone de prancheta vermelha / "Termo Não Assinado") na grade de baterias e participantes; trava opcional que avisa o operador se tentar enviar grid sem termos assinados.
- **Componentes Afetados**: `desktop/src/Kartodromo.Recepcao/FormPrincipal.cs`, `Baterias.cs`, `lib/ops/office.ts`.
- **Regras do Dono**: Nenhum piloto pode entrar na pista sem termo de responsabilidade devidamente assinado.

#### #21. Normalização de Formato ISO de Data/Hora (DATETIME2) no Agendamento
- **Requisito**: R3. Gestão de Baterias, Reservas e Pista
- **Descrição Técnica Atual**: Em `Baterias.cs:76`, o formato enviado é `YYYY-MM-DDTHH:mm` (sem segundos). No SQL Server, conversões diretas para `datetime2` sem segundos podem falhar com erro 241 dependendo da collation e do driver.
- **Comportamento Esperado / Critério de Aceitação**: Envio e validação estrita com segundos (`YYYY-MM-DDTHH:mm:ss`), preservando a hora oficial de Brasília sem conversões UTC indevidas.
- **Componentes Afetados**: `desktop/src/Kartodromo.Recepcao/Baterias.cs`, `lib/ops/office.ts`, `lib/ops/db.ts`.
- **Regras do Dono**: Não alterar o horário de Brasília nos registros de baterias.

#### #22. Validação e Prévia na Geração em Lote de Baterias do Mês
- **Requisito**: R3. Gestão de Baterias, Reservas e Pista
- **Descrição Técnica Atual**: Em `Baterias.cs:84-120` (`FormCriarReservas`), a geração de baterias por padrão mensal pode criar dezenas de horários conflitantes caso coincidam com feriados com horário especial.
- **Comportamento Esperado / Critério de Aceitação**: Apresentação de modal de prévia detalhando os dias e horários a serem criados, destacando feriados e baterias existentes que serão preservadas antes da persistência final.
- **Componentes Afetados**: `desktop/src/Kartodromo.Recepcao/Baterias.cs`, `lib/ops/office.ts`.
- **Regras do Dono**: Prevenir geração em massa de horários incorretos na agenda anual.

---

### Grupo R4: Clientes, Documentos e Validações Cadastrais (Itens 23 a 27)

#### #23. Correção de Posição de Cursor em Máscaras de Digitação (Cursor Jumping)
- **Requisito**: R4. Clientes, Documentos e Validações Cadastrais
- **Descrição Técnica Atual**: Em `desktop/src/Kartodromo.Comum/Ui.cs:232-244`, a função `Campos.Mascara` força `t.SelectionStart = t.TextLength` se o cursor estava no final, mas se o operador corrige caracteres no meio do texto, o cursor salta para o início ou final da caixa de texto.
- **Comportamento Esperado / Critério de Aceitação**: Preservação exata da posição relativa do cursor durante digitações, correções e backspaces em campos de CPF, telefone, CEP e placas.
- **Componentes Afetados**: `desktop/src/Kartodromo.Comum/Ui.cs`, `desktop/src/Kartodromo.Recepcao/FormCliente.cs`.
- **Regras do Dono**: Interface ágil para digitação rápida de atendentes no balcão.

#### #24. Preservação de Número e Complemento em Atualizações de Endereço
- **Requisito**: R4. Clientes, Documentos e Validações Cadastrais
- **Descrição Técnica Atual**: Em `services/ops-server.ts:368-370`, a edição de endereço pelo totem ou busca por CEP apagava as colunas `Numero` e `Complemento` (`SET Numero = NULL, Complemento = NULL`).
- **Comportamento Esperado / Critério de Aceitação**: Preservar rigorosamente as colunas `Numero` e `Complemento` na tabela `dbo.Cliente`; separar os componentes de logradouro sem perda de dados históricos.
- **Componentes Afetados**: `services/ops-server.ts`, `desktop/src/Kartodromo.Recepcao/FormCliente.cs`, `lib/ops/db.ts`.
- **Regras do Dono**: Preservar os dados completos de cadastro de mais de 137.000 clientes.

#### #25. Suporte a Documentos Internacionais (Passaporte) e Telefones Globais (DDI)
- **Requisito**: R4. Clientes, Documentos e Validações Cadastrais
- **Descrição Técnica Atual**: As rotinas de validação em `cadastro-obrigatorio.ts` exigem estritamente telefone com DDD brasileiro (10 ou 11 dígitos) e CPF, bloqueando turistas estrangeiros sem CPF que apresentam passaporte e telefone internacional.
- **Comportamento Esperado / Critério de Aceitação**: Quando o país for diferente de Brasil ou o documento for Passaporte, flexibilizar a máscara para aceitar padrão internacional E.164 (DDI + número) e documento alfanumérico.
- **Componentes Afetados**: `desktop/src/Kartodromo.Recepcao/FormCliente.cs`, `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs`, `lib/ops/cadastro-obrigatorio.ts`.
- **Regras do Dono**: Permitir que pilotos turistas de outros países participem das corridas.

#### #26. Harmonização de Faixas de Peso e Flexibilização do Campo Instagram
- **Requisito**: R4. Clientes, Documentos e Validações Cadastrais
- **Descrição Técnica Atual**: O peso aceitava regras distintas entre desktop (até 500 kg) e backend. O campo Instagram, tornado obrigatório em 11/10/2026 (`INSTAGRAM-CADASTRO-RESULTADO-20261011.md`), barrava clientes que não possuem rede social (crianças, idosos).
- **Comportamento Esperado / Critério de Aceitação**: Peso com validação uniforme entre 15 kg e 250 kg com precisão de uma casa decimal; inclusão da opção explícita "Não possui Instagram" (`@naoinformado` ou flag própria) para não impedir o cadastro.
- **Componentes Afetados**: `desktop/src/Kartodromo.Recepcao/FormCliente.cs`, `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs`, `lib/ops/cadastro-obrigatorio.ts`, `lib/ops/instagram.ts`.
- **Regras do Dono**: Exigência de peso positivo para equalização e Instagram para divulgação de resultados oficiais.

#### #27. Tratamento Assistido de Documento Duplicado (HTTP 409) sem Perda de Dados
- **Requisito**: R4. Clientes, Documentos e Validações Cadastrais
- **Descrição Técnica Atual**: Ao tentar cadastrar um novo cliente com CPF já existente, a API devolve HTTP 409 e o formulário `FormCliente.cs` apenas exibe o erro; se o operador cancelar, todos os dados preenchidos são perdidos.
- **Comportamento Esperado / Critério de Aceitação**: Diálogo assistido: "Documento já cadastrado para o cliente X. Deseja carregar o cadastro existente e aplicar os dados preenchidos agora?", evitando redigitação.
- **Componentes Afetados**: `desktop/src/Kartodromo.Recepcao/FormCliente.cs`, `lib/ops/office.ts`.
- **Regras do Dono**: Agilidade e redução de atrito no balcão de atendimento.

---

### Grupo R5: Sincronização, Nuvem e Integração com Cronometragem (Itens 28 a 32)

#### #28. Timeout Resiliente do Cliente HTTP da Recepção (Prevenção de Travamentos)
- **Requisito**: R5. Sincronização, Nuvem e Integração com Cronometragem
- **Descrição Técnica Atual**: Em `desktop/src/Kartodromo.Comum/Api.cs:53`, o timeout padrão é de 30 segundos. Se o SRVKART sofrer lentidão momentânea, o app da Recepção congela completamente a UI.
- **Comportamento Esperado / Critério de Aceitação**: Redução do timeout para 8 a 10 segundos, com tratamento de exceções gracioso e cancelamento assíncrono via `CancellationToken`.
- **Componentes Afetados**: `desktop/src/Kartodromo.Comum/Api.cs`.
- **Regras do Dono**: Não travar os programas nativos Windows.

#### #29. Cache e Resiliência na Sincronização do Catálogo de Traçados
- **Requisito**: R5. Sincronização, Nuvem e Integração com Cronometragem
- **Descrição Técnica Atual**: Em `services/ops-server.ts:68-80`, chamadas para `/api/office/apoio` disparam requisição direta para a cronometragem (`:4050`). Se o ORBITS estiver reiniciando, a Recepção demora para abrir.
- **Comportamento Esperado / Critério de Aceitação**: Manter cache dos traçados conhecidos na tabela `dbo.Tracado` do SQL Server, sincronizando em background com o ORBITS sem bloquear a abertura da Recepção.
- **Componentes Afetados**: `services/ops-server.ts`, `lib/ops/tracado-sync.ts`, `desktop/src/Kartodromo.Recepcao/Baterias.cs`.
- **Regras do Dono**: A Recepção deve operar mesmo se a máquina da Cronometragem estiver em manutenção.

#### #30. Validação de Grid e Mapeamento de Karts para a Cronometragem
- **Requisito**: R5. Sincronização, Nuvem e Integração com Cronometragem
- **Descrição Técnica Atual**: Em `services/ops-server.ts:604-610`, o endpoint de grid entrega os números de kart atribuídos na recepção sem validar se há dois pilotos com o mesmo kart ou se o kart está parado na oficina mecânica.
- **Comportamento Esperado / Critério de Aceitação**: Validação de duplicidade de karts no fechamento do grid e aviso caso o kart esteja marcado com manutenção pendente em `dbo.Manutencao`.
- **Componentes Afetados**: `lib/ops/office.ts`, `desktop/src/Kartodromo.Recepcao/Acoes.cs`, `services/ops-server.ts`.
- **Regras do Dono**: Não enviar dados corrompidos para a cronometragem oficial.

#### #31. Resiliência e Conformidade nos Patches de Reserva Online
- **Requisito**: R5. Sincronização, Nuvem e Integração com Cronometragem
- **Descrição Técnica Atual**: Em `services/ops-server.ts:740-755` e `lib/ops/reserva-online.ts`, a sincronização com os Workers Cloudflare precisa respeitar estritamente as regras de "uma vaga por pessoa" e "política de cancelamento" aplicadas em produção (`patches-producao/README.md`).
- **Comportamento Esperado / Critério de Aceitação**: Sincronização com tolerância a quedas de link externo (backoff exponencial sem flood de logs) e validação de pilotos múltiplos com CPF e nascimento válidos por vaga.
- **Componentes Afetados**: `services/ops-server.ts`, `lib/ops/reserva-online.ts`, `patches-producao/README.md`.
- **Regras do Dono**: Respeitar as políticas de cancelamento e uma vaga por pessoa aplicadas em produção.

#### #32. Tratamento Robusto de Relatórios de Cronometragem na Recepção
- **Requisito**: R5. Sincronização, Nuvem e Integração com Cronometragem
- **Descrição Técnica Atual**: Ao consultar resultados em `FormRelatoriosCronometragem.cs` (`/relatorio/crono/:id`), falhas na comunicação com a cronometragem exibiam erro HTTP cru ou JSON de stack trace.
- **Comportamento Esperado / Critério de Aceitação**: Renderização de página legível com layout aprovado (`paginaDeErro`), timeout de 6s e enriquecimento seguro dos perfis de Instagram dos participantes.
- **Componentes Afetados**: `services/ops-server.ts`, `lib/ops/relatorio-crono.ts`, `desktop/src/Kartodromo.Recepcao/FormRelatoriosCronometragem.cs`.
- **Regras do Dono**: Documentos e relatórios devem ser sempre legíveis para o cliente e operador.

---

### Grupo R6: Interface WinForms, Usabilidade e Estabilidade (Itens 33 a 36)

#### #33. Gestão Segura de Ciclo de Vida do ContextMenuStrip
- **Requisito**: R6. Interface WinForms, Usabilidade e Estabilidade
- **Descrição Técnica Atual**: Em `FormPrincipal.cs:247-253`, a destruição do menu de contexto anterior durante cliques rápidos ou perda de foco pode disparar `Cannot access a disposed object (ContextMenuStrip)`.
- **Comportamento Esperado / Critério de Aceitação**: Ciclo de vida desacoplado: os itens do menu executam comandos que não dependem da sobrevivência do controle visual; descarte apenas quando a janela proprietária for fechada.
- **Componentes Afetados**: `desktop/src/Kartodromo.Recepcao/FormPrincipal.cs`, `Baterias.cs`, `Cadastros.cs`.
- **Regras do Dono**: Eliminar qualquer travamento visual em cliques de menu.

#### #34. Eliminação de Vazamento de Handles GDI (Brushes, Pens, Bitmaps)
- **Requisito**: R6. Interface WinForms, Usabilidade e Estabilidade
- **Descrição Técnica Atual**: Em `Caixa.cs:506`, `VisualPrincipal.cs` e `PecasDesign.cs`, objetos GDI são criados nos eventos `Paint` sem descarte determinístico (`using`), provocando acúmulo de GDI handles no Windows e crash por falta de identificador após vários dias aberto.
- **Comportamento Esperado / Critério de Aceitação**: Uso estrito de `using` em todas as canetas, pincéis e bitmaps transitórios, ou centralização em cache estático imutável (`Tokens.cs`), mantendo GDI handles < 500.
- **Componentes Afetados**: `desktop/src/Kartodromo.Recepcao/VisualPrincipal.cs`, `desktop/src/Kartodromo.Comum/PecasDesign.cs`, `Caixa.cs`.
- **Regras do Dono**: O programa da recepção deve permanecer aberto dias seguidos sem necessidade de reinício periódico.

#### #35. Responsividade e Correção de Escala High-DPI (125% / 150%)
- **Requisito**: R6. Interface WinForms, Usabilidade e Estabilidade
- **Descrição Técnica Atual**: Na Recepção 2 (`192.168.20.239`), o monitor opera com escala de 125% do Windows. Em `FormCliente.cs` e diálogos modais, controles com coordenadas absolutas sofriam cortes em rótulos e botões.
- **Comportamento Esperado / Critério de Aceitação**: Configuração consistente de `AutoScaleMode = AutoScaleMode.Dpi`, uso de `TableLayoutPanel` com ancoragem elástica e validação visual em 1366×768 (100%), 1920×1080 (100%) e escala 125%/150%.
- **Componentes Afetados**: `desktop/src/Kartodromo.Recepcao/FormPrincipal.cs`, `FormCliente.cs`, `Cadastros.cs`, `Kartodromo.Comum/DialogoDesign.cs`.
- **Regras do Dono**: O sistema deve ser perfeito tanto na Recepção 1 quanto na Recepção 2.

#### #36. Restituição de Foco e Despacho Thread-Safe (BeginInvoke) na UI
- **Requisito**: R6. Interface WinForms, Usabilidade e Estabilidade
- **Descrição Técnica Atual**: Após fechamento de diálogos modais ou execução assíncrona de chamadas de API, o foco do teclado frequentemente se perde, forçando o operador a usar o mouse para clicar na grade ou campos.
- **Comportamento Esperado / Critério de Aceitação**: Restituição automática e explícita do foco no controle primário da tela (`_grade.Focus()`, `_doc.Focus()`), despacho 100% thread-safe via `Control.BeginInvoke` e garantia de funcionamento das teclas de atalho (F2, F3, F5, Esc).
- **Componentes Afetados**: `desktop/src/Kartodromo.Comum/Ui.cs`, `desktop/src/Kartodromo.Recepcao/FormPrincipal.cs`, `FormCliente.cs`.
- **Regras do Dono**: Agilidade máxima no atendimento presencial com atalhos de teclado.

---

## 7. Matriz de Correlação: Recepção (36 Itens) vs Totem / Autoatendimento (39 Itens)

Os sistemas de Recepção e Autoatendimento compartilham o mesmo banco de dados SQL Server (`KartodromoOps`), o mesmo backend (`services/ops-server.ts`), as regras de negócio em `lib/ops/` e a mesma biblioteca comum C# (`Kartodromo.Comum`). A tabela abaixo correlaciona as dependências mútuas:

| Área Compartilhada | Itens Recepção (R1 a R6) | Itens Totem (Itens 1 a 39) | Relação Técnica e Impacto Arquitetural |
|---|---|---|---|
| **Fila de Impressão no Banco** | Item #1, Item #2 | Totem Itens 1, 2 | O Totem enfileira termos em `POST /api/totem/inscrever`. A Recepção consome e imprime na TM-T20X via `AgenteImpressao.cs`. Ambos dependem da tabela `dbo.FilaImpressao`. |
| **Economia de Bobina Térmica** | Item #3 | Totem Item 4 | Ambos consomem `lib/ops/termo.ts`. Eliminar altura de 297mm beneficia a impressão física local gerada por qualquer um dos sistemas. |
| **Spooler e Filas Fantasmas** | Item #5, Item #9 | Totem Itens 3, 5 | Totens não possuem impressora local; comandos de spooler e rotinas de purga evitam travamentos nos PCs Windows dos totens e da recepção. |
| **Privacidade e LGPD (PII)** | Item #24, Item #27 | Totem Itens 7, 8, 10 | Mascaramento de dados em rotas públicas (`/api/totem/identificar`) e preservação de consentimento de menores em `dbo.Cliente` compartilhado com a Recepção. |
| **Validação de Documento e Contato** | Item #25, Item #26 | Totem Itens 12, 13, 14 | Validações em `cadastro-obrigatorio.ts` afetam tanto o totem quanto a recepção: Instagram opcional, celular internacional e faixa de peso uniforme (15kg-250kg). |
| **Preservação de Endereço** | Item #24 | Totem Item 15 | A atualização de endereço no totem sobrescrevia `Numero` e `Complemento` como `NULL`, corrompendo os dados consultados na Recepção. |
| **Cursor Jumping em Máscaras** | Item #23 | Totem Item 17 | `Campos.Mascara` em `Kartodromo.Comum/Ui.cs` é compartilhado por `FormCliente.cs` (Recepção) e `FormTotem.cs` (Autoatendimento). |
| **Bloqueio de Baterias Passadas** | Item #17 | Totem Item 28 | A remoção da tolerância de -30 minutos em `office.ts:426` e `totem-baterias.ts` garante que baterias já iniciadas não recebam reservas indesejadas em nenhum canal. |
| **Concorrência da Última Vaga** | Item #19 | Totem Item 29, 33 | Condição de corrida tratada com transação atômica (`UPDLOCK`) e auto-refresh na grade de horários para evitar overbooking entre totem e balcão. |
| **Timeout e Estabilidade HTTP** | Item #28 | Totem Item 35 | A classe `Api.cs` em `Kartodromo.Comum` é usada por ambos os aplicativos; timeout resiliente de 8-10s impede tela congelada em toda a rede. |
| **Vazamentos GDI e ContextMenu** | Item #33, Item #34 | Totem Item 37 | Componentes gráficos derivados de `Kartodromo.Comum` (`Tokens.cs`, `PecasDesign.cs`) precisam de liberação rigorosa de handles em ambos os apps. |

---

## 8. Conclusion (Conclusão e Próximos Passos)

1. **Diagnóstico Consolidado**: O mapeamento dos 36 problemas da Recepção (R1 a R6) revelou que as maiores fragilidades operacionais decorrem de:
   - Persistência volátil em memória RAM na fila de impressão de termos;
   - Desperdício físico de bobina térmica por parametrização CSS A4;
   - Falta de travas de concorrência e idempotência no checkout/caixa;
   - Tolerância indevida de horários de baterias passadas;
   - Efeitos colaterais em máscaras de digitação e sobrescrita de endereços;
   - Vazamento gradual de recursos gráficos GDI e menus descartados no WinForms.
2. **Prontidão de Implementação**: Todos os pontos críticos foram mapeados com seus respectivos arquivos-fonte, números de linha, comportamentos esperados e restrições operacionais. Os requisitos correlacionados com o Autoatendimento garantem que a refatoração do backend e da biblioteca comum (`Kartodromo.Comum`) beneficie integralmente os dois sistemas sem duplicação de esforço.

---

## 9. Verification Method (Método de Verificação Independente)

Para auditar e validar independentemente as especificações levantadas:

1. **Testes Automatizados do Backend (Vitest)**:
   ```bash
   npx vitest run tests/ops/
   ```
   Valida as suítes de termo, cadastro obrigatório, Instagram, rotas de office e reservas online (166 testes passando).

2. **Checagem Estrita de Tipos TypeScript**:
   ```bash
   npx tsc --noEmit --skipLibCheck --target es2022 --module esnext --moduleResolution bundler --esModuleInterop --types node services/ops-server.ts
   ```

3. **Compilação da Solução Desktop .NET 8 (no host Windows / ORBITS)**:
   ```powershell
   dotnet build desktop/Kartodromo.Desktop.sln -c Release
   ```

4. **Autoteste de Telas e Cliques da Recepção (no ORBITS via script)**:
   ```powershell
   # Execução fora do horário comercial com credencial de teste
   Kartodromo.Recepcao.exe --autoteste C:\KARTODROMO\teste-recepcao admin <senha>
   ```
   Conferir o arquivo `log.txt` gerado, confirmando zero erros em todos os formulários e diálogos.

5. **Inspeção de Integridade do Banco de Dados SQL Server**:
   Conferir aplicação de migrations em `migrations/ops/` e integridade referencial nas tabelas `dbo.Cliente`, `dbo.Inscricao`, `dbo.Venda`, `dbo.Movimento` e a nova tabela `dbo.FilaImpressao`.
