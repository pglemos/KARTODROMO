# Relatório de Investigação e Levantamento do Módulo Desktop (Recepção e Comum)

## 1. Observações (Observations)

A investigação técnica do código-fonte em `desktop/src/Kartodromo.Recepcao/` e `desktop/src/Kartodromo.Comum/` (.NET 8 WinForms C#) identificou 36 pontos críticos divididos nos 6 requisitos operacionais (R1 a R6).

---

### R1: Fila de Impressão e Periféricos (Itens 1 a 6)

#### #1. Loop de polling mesmo com impressora de termos inexistente
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs` (linhas 21-30)
- **Código**:
  ```csharp
  21: _impressora = Config.Get("ImpressoraTermos", "");
  22: if (string.IsNullOrWhiteSpace(_impressora)) return;
  23: var existe = PrinterSettings.InstalledPrinters.Cast<string>().Any(p => string.Equals(p, _impressora, StringComparison.OrdinalIgnoreCase));
  24: Log(existe ? $"agente ligado, impressora {_impressora}" : $"ATENÇÃO: impressora '{_impressora}' não existe neste computador");
  25: Situacao = existe ? "Termos do totem: " + _impressora : "Impressora dos termos não encontrada";
  26: var t = new System.Windows.Forms.Timer { Interval = 3000 };
  27: t.Tick += async (_, _) => await Rodada(dono);
  28: dono.FormClosed += (_, _) => { t.Stop(); t.Dispose(); };
  29: t.Start();
  ```
- **Fato**: Mesmo quando `existe == false`, o código **não aborta**. Ele cria o timer e dispara `Rodada(dono)` a cada 3 segundos, consumindo jobs da fila `/api/office/impressao/proxima` e falhando continuamente.

#### #2. Falta de timeout no carregamento do WebView2 em impressão silenciosa
- **Arquivo**: `desktop/src/Kartodromo.Comum/Relatorio.cs` (linhas 284-287)
- **Código**:
  ```csharp
  284: var carregou = new TaskCompletionSource<bool>();
  285: web.CoreWebView2.NavigationCompleted += (_, e) => carregou.TrySetResult(e.IsSuccess);
  286: web.CoreWebView2.Navigate(url);
  287: if (!await carregou.Task) throw new Exception("Falha ao carregar o termo para impressão.");
  ```
- **Fato**: `await carregou.Task` não possui timeout (`Task.WhenAny` ou `CancellationToken`). Se a navegação travar ou o servidor HTTP não responder, o método fica congelado indefinidamente, travando `_ocupado = true` em `AgenteImpressao.cs` (linha 34), paralisando o agente de impressão permanentemente sem log de exceção.

#### #3. Desperdício de bobina térmica na TM-T20X (altura fixa de página)
- **Arquivo**: `desktop/src/Kartodromo.Comum/Relatorio.cs` (linhas 289-294)
- **Código**:
  ```csharp
  289: var cfg = web.CoreWebView2.Environment.CreatePrintSettings();
  290: cfg.ShouldPrintBackgrounds = true;
  291: cfg.ShouldPrintHeaderAndFooter = false;
  292: cfg.MarginTop = cfg.MarginBottom = cfg.MarginLeft = cfg.MarginRight = 0;
  293: if (!string.IsNullOrWhiteSpace(impressora)) cfg.PrinterName = impressora;
  294: var st = await web.CoreWebView2.PrintAsync(cfg);
  ```
- **Fato**: `cfg.PageHeight` e `cfg.PageWidth` não são definidos. Quando a impressora térmica recebe o trabalho, ela assume o tamanho de folha padrão do driver (297 mm / A4), desenrolando papel em branco após as assinaturas.

#### #4. Parada silenciosa e modal de bloqueio na expiração de login (401)
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs` (linhas 64-66)
- **Código**:
  ```csharp
  64: if (e is ApiException { Status: 401 })
  65:     dono.BeginInvoke(() => Msg.Info(dono, "O login venceu e os termos do totem pararam de imprimir.\nFeche e abra a Recepção e entre de novo.", "Termos do totem parados"));
  ```
- **Fato**: Quando o token de 16 horas expira, uma caixa de diálogo modal é aberta na thread da UI. O agente para de imprimir os termos do totem até que a atendente feche e reabra o programa manualmente (causando até 1h40 de fila represada, conforme log operacional de 30/09).

#### #5. Inconsistência de fluxo: impressão silenciosa vs janela de prévia
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/Acoes.cs` (linhas 47-63)
- **Código**:
  ```csharp
  47: if (lista.Count > 1 && Config.Get("ImpressoraTermos", "") is { Length: > 0 } impressora)
  ...
  60: var r = await Api.Get("/api/office/termo-link?ids=" + string.Join(",", lista));
  61: Relatorio.Abrir(dono, Api.BaseUrl + r.S("url"), "Termo de Responsabilidade");
  ```
- **Fato**: Se `lista.Count == 1`, a impressão não é silenciosa: abre a tela `Relatorio` com WebView2. Se `lista.Count > 1`, imprime silenciosamente sem abrir janela. Além disso, para `N` termos selecionados, instancia `N` formulários invisíveis e WebView2 sucessivamente em loop.

#### #6. Ausência de limpeza de filas fantasmas legadas no spooler
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs`
- **Fato**: Não há rotina no desktop para checar o status de erro da impressora no Spooler Win32 (`PrintQueueStatus.Offline`, `OutOfPaper`) ou purgar jobs órfãos/presos na fila `TMT20`.

---

### R2: Caixa, PDV e Operação Financeira (Itens 7 a 13)

#### #7. Vulnerabilidade no cálculo de troco para formas de pagamento não-dinheiro
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/Caixa.cs` (linhas 596-601)
- **Código**:
  ```csharp
  596: (long tot, long des, long acr, long sub, long rec, long troco, long falta) Totais()
  597: {
  598:     var tot = _car.Sum(i => i.Unit * i.Qtd); var des = _car.Sum(i => i.Desc); var acr = _car.Sum(i => i.Acr);
  599:     var sub = tot - des + acr; var rec = _pags.Sum(p => p.valor);
  600:     return (tot, des, acr, sub, rec, Math.Max(0, rec - sub), Math.Max(0, sub - rec));
  601: }
  ```
- **Fato**: `troco` é calculado exclusivamente pela diferença `rec - sub`. Se um pagamento com Cartão de Crédito ou Pix for lançado com valor superior ao subtotal, o sistema calcula e autoriza troco em dinheiro físico da gaveta, o que é uma grave vulnerabilidade financeira.

#### #8. Aprovação automática e tolerância a subpagamento no Checkout
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/Caixa.cs` (linhas 640, 729-730)
- **Código**:
  ```csharp
  640: _btnConcluir.Enabled = pagamentoLiberado && (!Sessao.ParamSim("office.validarTotalPago", true) || t.falta <= 0);
  ...
  729: if (_pags.Count == 0 && t.sub > 0 && _forma.SelectedItem is Campos.Item f) { _pags.Add((f.Id, f.Texto, Fmt.Centavos(_valor.Text) is long vv && vv > 0 ? vv : t.sub)); Atualizar(); t = Totais(); }
  730: if (t.falta > 0 && Sessao.ParamSim("office.validarTotalPago", true)) { Msg.Aviso(this, $"Ainda faltam ser pagos {Fmt.Brl(t.falta)} para poder concluir a compra."); return; }
  ```
- **Fato**: Se `_pags` estiver vazio, assume cegamente o subtotal para a primeira forma do combo. Se o parâmetro `office.validarTotalPago` for desativado no apoio, permite aprovar a venda mesmo faltando lançar valores.

#### #9. Incompatibilidade entre Acréscimo e Voucher no Carrinho
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/Caixa.cs` (linhas 695-703, 732)
- **Código**:
  ```csharp
  697: if (desconto && i.Voucher) { Msg.Aviso(this, "Este item já possui desconto aplicado pelo voucher e não pode receber outro desconto."); continue; }
  ...
  732: foreach (var c in _car) itens.Add(new JsonObject { ... ["descontoCentavos"] = c.Voucher ? 0 : c.Desc, ["acrescimoCentavos"] = c.Acr });
  ```
- **Fato**: Quando `c.Voucher == true`, o desconto enviado na API é forçado a 0 para que o backend aplique o código do voucher. Porém, se um acréscimo for aplicado sobre um item com voucher, o recálculo pode divergir entre o desktop e o backend. Além disso, não há opção no carrinho para "Remover Voucher" sem excluir a reserva do carrinho.

#### #10. Falta de validação do valor do próximo turno no fechamento de caixa
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/TelasCaixa.cs` (linhas 192-195)
- **Código**:
  ```csharp
  192: if (Fmt.Centavos(string.IsNullOrWhiteSpace(_proximo.Text) ? "0" : _proximo.Text) is not long valor) { Msg.Aviso(this, "Valor para o próximo turno inválido."); return; }
  193: if (!Msg.Pergunta(this, "Deseja fechar o terminal?")) return;
  194: var r = await Sessao.Api.Post("/api/office/caixa/fechar", new { proximoTurnoCentavos = valor });
  ```
- **Fato**: Não há validação se `valor <= V("dinheiroEmCaixa")` nem se `valor >= 0`. O operador pode informar um suprimento para o próximo turno maior do que o dinheiro que de fato existe na gaveta, gerando inconsistência contábil física.

#### #11. Ausência de limite para Sangria contra dinheiro em caixa
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/TelasCaixa.cs` (linhas 233-238)
- **Código**:
  ```csharp
  235: if (Fmt.Centavos(_valor.Text) is not long valor || valor <= 0) { Msg.Aviso(this, "Informe um valor maior que zero."); _valor.Focus(); return; }
  236: if (string.IsNullOrWhiteSpace(_obs.Text)) { Msg.Aviso(this, "Informe a justificativa desta transação."); _obs.Focus(); return; }
  237: var r = await Sessao.Api.Post("/api/office/caixa/transacao", new { tipo = _tipo, valorCentavos = valor, observacao = _obs.Text.Trim() });
  ```
- **Fato**: O formulário permite registrar sangria superior ao total de dinheiro em caixa (`dinheiroEmCaixa`), deixando a gaveta com saldo negativo sem aviso ou confirmação de override.

#### #12. Vazamento de janela e rateio no estorno parcial de vendas
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/FormPrincipal.cs` (linha 1347) e `Caixa.cs` (linhas 781-815)
- **Código**:
  ```csharp
  Item("Estornar pagamento", () => { if (new FormEstorno(sel[0].L("id") ?? 0).ShowDialog(this) == DialogResult.OK) Recarregar(); }, umaSo && !sel[0].B("cancelada")),
  ```
- **Fato**: `new FormEstorno(...)` não utiliza `using` ou `Dispose()`. Além disso, no estorno parcial, o estorno devolve o valor de `liquido` de cada item selecionado, sem reverter proporcionalmente descontos de cupom/voucher aplicados globalmente à venda.

#### #13. Resiliência de idempotência em pagamentos de comissão
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/FormPrincipal.cs` (linhas 911-915)
- **Código**:
  ```csharp
  911: var chave = acao + "-" + Guid.NewGuid().ToString("N");
  ...
  915: await Sessao.Api.Post($"/api/office/parceiros/comissoes/{c.S("id")}/{acao}", new { idempotencyKey = chave, formaPagamentoId = Campos.IdDe(forma), motivo = motivo.Text.Trim() });
  ```
- **Fato**: Se a chamada falhar por timeout de rede e o usuário clicar em "Tentar novamente" via `Seguro.Rodar`, a mesma requisição é reenviada com a mesma chave; porém, se a janela for fechada e reaberta, nova chave é gerada sem persistência de estado transitório.

---

### R3: Gestão de Baterias, Reservas e Pista (Itens 14 a 19)

#### #14. Movimentação de cliente para baterias cujo horário já passou
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/Acoes.cs` (linhas 434-437)
- **Código**:
  ```csharp
  434: var lista = await Sessao.Api.Lista($"/api/office/baterias?status=abertas&filtro=apartir&data={Fmt.Iso(DateTime.Today)}");
  435: _baterias = lista.Where(b => b.S("id") != r.S("bateriaId") && b.I("disponiveis") > 0
  436:         && (!paga || (b.L("produtoId") == r.L("produtoId") && b.L("preco") == r.L("preco"))))
  437:     .OrderBy(b => b.S("dataHora")).ToList();
  ```
- **Fato**: Consulta baterias com `filtro=apartir` a partir do início do dia de hoje (`00:00`). Não verifica se o horário de início já ocorreu (`b.D("dataHora") < DateTime.Now`), permitindo mover participantes para baterias que já foram iniciadas ou encerradas.

#### #15. Inclusão de participantes em baterias sem validação de vagas e horário
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/Baterias.cs` (linhas 400-405)
- **Código**:
  ```csharp
  403: if (!int.TryParse(n.Text, out var qtd) || qtd < 1) { Msg.Aviso(this, "Informe quantos participantes."); return; }
  404: var r = await Sessao.Api.Post($"/api/office/baterias/{b.S("id")}/incluir", new { clienteId = _cli.L("id"), participantes = qtd, observacao = obs.Text.Trim(), produtoId = Campos.IdDe(prod), pagoAntecipado = pago.Checked });
  ```
- **Fato**: Não há validação no cliente de `qtd <= b.I("disponiveis")` nem verificação se a bateria está com horário vencido (`b.D("dataHora") < DateTime.Now`).

#### #16. Falta de bloqueio de ações em baterias em andamento ou encerradas
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/FormPrincipal.cs` (linhas 1300-1340)
- **Fato**: Os menus de contexto `MenuReservas` e `MenuBaterias` mantêm opções como "Aprovar (cobrar)", "Alterar cliente", "Mover cliente" e "Incluir cliente" ativas mesmo se a bateria estiver em andamento ou com status `encerrada` na Cronometragem.

#### #17. Formatação de data/hora sem segundos em criação/edição de baterias
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/Baterias.cs` (linha 76)
- **Código**:
  ```csharp
  76: inicio = $"{Fmt.Iso(Data.Value)}T{Hora.Value:HH:mm}"
  ```
- **Fato**: A string sem os segundos (`:00`) provocou no passado erro SQL 241 de conversão de data no SQL Server (`TRY_CONVERT(datetime2, ...)`). Deve sempre incluir os segundos: `${Hora.Value:HH:mm:00}`.

#### #18. Tempestade de requisições HTTP a cada 10 segundos no Recarregar
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/FormPrincipal.cs` (linhas 105-112, 1133-1170)
- **Código**:
  ```csharp
  var all = await Sessao.Api.Lista("/api/office/reservas?status=todas&" + queryData);
  ...
  var all = await Sessao.Api.Lista("/api/office/baterias?status=todas&" + queryData);
  ...
  var atencao = await Sessao.Api.Lista("/api/office/reservas-online?status=atencao");
  ...
  var online = await Sessao.Api.Lista("/api/office/reservas-online?status=todas&" + queryData);
  ...
  var man = await Sessao.Api.Lista("/api/office/manutencoes?status=todas");
  ...
  var all = await Sessao.Api.Lista("/api/office/vendas?status=todas&" + queryData);
  ```
- **Fato**: A cada 10 segundos, `FormPrincipal` dispara **6 requisições HTTP completas** ao backend apenas para atualizar os números dos crachás na árvore de navegação, saturando as conexões do Node.js e do SQL Server.

#### #19. Reset de linhas e concorrência na Grade durante interação do usuário
- **Arquivo**: `desktop/src/Kartodromo.Comum/Ui.cs` (linhas 615-630)
- **Código**:
  ```csharp
  Rows.Clear();
  ...
  Rows.AddRange(novas.ToArray());
  ```
- **Fato**: Ao detectar alterações de dados na sincronização automática em segundo plano, a grade executa `Rows.Clear()` e `Rows.AddRange()`. Se o operador estiver clicando com o botão direito para abrir o menu ou arrastando uma seleção, a limpeza destrói os elementos sob o cursor, disparando `NullReferenceException` ou `ArgumentOutOfRangeException`.

---

### R4: Clientes, Documentos e Validações Cadastrais (Itens 20 a 24)

#### #20. Bug crítico de cursor jumping na edição de campos com máscara
- **Arquivo**: `desktop/src/Kartodromo.Comum/Ui.cs` (linhas 232-244)
- **Código**:
  ```csharp
  232: public static void Mascara(TextBox t, Func<string, string> fn)
  233: {
  234:     var ocupado = false;
  235:     t.TextChanged += (_, _) =>
  236:     {
  237:         if (ocupado) return;
  238:         ocupado = true;
  239:         var fim = t.SelectionStart == t.TextLength;
  240:         t.Text = fn(t.Text);
  241:         if (fim) t.SelectionStart = t.TextLength;
  242:         ocupado = false;
  243:     };
  244: }
  ```
- **Fato**: Ao atribuir `t.Text = fn(t.Text)`, o WinForms define `t.SelectionStart = 0`. Se o cursor não estiver no fim (`fim == false`), `t.SelectionStart` permanece em `0`! Ou seja, editar qualquer número no meio do telefone, CPF ou CEP joga o cursor imediatamente para o começo do campo.

#### #21. Instagram estritamente obrigatório bloqueando cadastro de clientes
- **Arquivo**: `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs` (linhas 17-23) e `FormCliente.cs` (linha 539)
- **Código**:
  ```csharp
  17: public static string ErroInstagram(string instagram)
  18: {
  19:     if (string.IsNullOrWhiteSpace(instagram)) return "O Instagram é obrigatório. Informe o @usuário do piloto.";
  ...
  ```
- **Fato**: O método exige Instagram obrigatoriamente. Na Recepção, idosos, crianças, turistas estrangeiros e pessoas sem rede social não conseguem ser cadastradas a menos que a atendente invente um usuário falso.

#### #22. Falta de validação de CPF no método Salvar de FormCliente
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/FormCliente.cs` (linhas 534-540)
- **Código**:
  ```csharp
  536: if (string.IsNullOrWhiteSpace(_nome.Text)) { Msg.Aviso(this, "Informe o nome."); return; }
  537: if (ValidacaoCliente.ErroEmail(_email.Text) is string erroEmail) { Msg.Aviso(this, erroEmail); _email.Focus(); return; }
  538: if (ValidacaoCliente.ErroPeso(_peso.Text) is string erroPeso) { Msg.Aviso(this, erroPeso); _peso.Focus(); return; }
  539: if (ValidacaoCliente.ErroInstagram(_instagram.Text) is string erroInstagram) { Msg.Aviso(this, erroInstagram); _instagram.Focus(); return; }
  540: var body = Corpo();
  ```
- **Fato**: Se `_tipoDoc.Text == "CPF"`, o formulário **não valida o dígito verificador do CPF** antes de submeter a requisição, dependendo apenas do botão "Consultar".

#### #23. Socket exhaustion e concorrência na busca de CEP via ViaCEP
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/FormCliente.cs` (linhas 586-599) e `Cadastros.cs` (linhas 240-249)
- **Código**:
  ```csharp
  586: async void BuscarCep()
  ...
  592: using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(8) };
  593: var r = JsonNode.Parse(await http.GetStringAsync($"https://viacep.com.br/ws/{cep}/json/"));
  ```
- **Fato**: Uso de `async void`, instância local de `new HttpClient` sem reutilização de handler e sem cancelamento de requisições anteriores sobrepostas caso o operador digite múltiplos CEPs seguidos.

#### #24. Mapeamento de endereço: preservação de Número e Complemento
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/FormCliente.cs` (linhas 457-458, 528)
- **Fato**: O formulário desktop possui os campos `_num` e `_compl`, mas rotas e atualizações de clientes precisam garantir a integridade dessas colunas no banco de dados contra sobreescritas com valores nulos.

---

### R5: Sincronização, Nuvem e Integração com Cronometragem (Itens 25 a 29)

#### #25. Timeout excessivo de 30 segundos no cliente HTTP
- **Arquivo**: `desktop/src/Kartodromo.Comum/Api.cs` (linha 53)
- **Código**:
  ```csharp
  53: _http = new HttpClient { Timeout = timeout ?? TimeSpan.FromSeconds(30) };
  ```
- **Fato**: Um timeout de 30 segundos em rede local (192.168.20.0/24) faz a interface do WinForms aguardar meio minuto em caso de perda de conexão com o SRVKART antes de reportar erro, congelando o atendimento no balcão.

#### #26. Tratamento genérico de falhas e ausência de retry inteligente
- **Arquivo**: `desktop/src/Kartodromo.Comum/Api.cs` (linhas 74-79) e `Ui.cs` (linhas 104-127)
- **Código**:
  ```csharp
  catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
  {
      throw new ApiException("Não foi possível falar com o servidor. Verifique a rede e se o servidor está ligado.", 0);
  }
  ```
- **Fato**: Não há discriminação entre falha transitória de socket e timeout. O mecanismo `Seguro.Rodar` apenas exibe uma janela modal de retry sem backoff e sem validação prévia de conectividade.

#### #27. Falta de diálogo de reautenticação in-app para token vencido
- **Arquivo**: `desktop/src/Kartodromo.Comum/Api.cs` e `desktop/src/Kartodromo.Recepcao/Program.cs`
- **Fato**: Quando o token de 16 horas expira (HTTP 401), o sistema não abre um diálogo para o operador re-digitar a senha e continuar trabalhando. Ele força o fechamento e a reabertura completa da aplicação.

#### #28. Esgotamento de portas por instanciação de HttpClient no Ping a cada 30s
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/FormPrincipal.cs` (linhas 562-587)
- **Código**:
  ```csharp
  566: using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
  ...
  579: using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(4) };
  ```
- **Fato**: Duas instâncias de `HttpClient` são criadas e descartadas a cada 30 segundos, deixando dezenas de conexões em estado `TIME_WAIT` continuamente no Windows.

#### #29. Bloqueio síncrono da thread principal na inicialização por verificação de atualização
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/Program.cs` (linha 13)
- **Código**:
  ```csharp
  13: if (Atualizacao.TratarInicioAsync("Recepcao", args).GetAwaiter().GetResult()) return;
  ```
- **Fato**: Executar `.GetAwaiter().GetResult()` na thread STA principal antes de exibir a tela de login causa atraso de até 4 segundos (tempo do timeout do manifesto) com a tela preta caso o servidor SRVKART esteja indisponível.

---

### R6: Interface WinForms, Usabilidade e Estabilidade (Itens 30 a 36)

#### #30. Vazamento massivo de regiões GDI (HRGN Handle Leak) em Forma.Recortar
- **Arquivo**: `desktop/src/Kartodromo.Comum/Design.cs` (linhas 45-50)
- **Código**:
  ```csharp
  45: static void Recortar(Control c, int raio)
  46: {
  47:     if (c.Width < 2 || c.Height < 2) return;
  48:     using var path = Redondo(new Rectangle(0, 0, c.Width, c.Height), Math.Min(raio, Math.Min(c.Width, c.Height) / 2));
  49:     c.Region = new Region(path);
  50: }
  ```
- **Fato**: Atribuir `c.Region = new Region(path)` **não descarta a região anterior**. A cada evento `SizeChanged` de qualquer controle arredondado, um handle nativo HRGN do Windows é vazado no processo. Com dezenas de controles e redimensionamentos, atinge o limite do Windows (10.000 handles GDI) e causa crash irrecuperável.

#### #31. Fechamento prematuro de Stream em Image.FromStream
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/VisualPrincipal.cs` (linhas 23-26)
- **Código**:
  ```csharp
  23: using var s = typeof(VisualPrincipal).Assembly.GetManifestResourceStream($"Kartodromo.Recepcao.Icones.{nome}.png");
  24: img = s == null ? new Bitmap(1, 1) : Image.FromStream(s);
  25: _cache[nome] = img;
  ```
- **Fato**: O stream `s` é descartado ao sair do bloco `using`. A documentação do .NET especifica que no GDI+ o stream deve permanecer aberto enquanto a `Image` existir. O descarte do stream causa falhas aleatórias de renderização (`ExternalException: A generic error occurred in GDI+`).

#### #32. Alocação sem cache e sem dispose de Bitmaps em PecasDesign.Tile
- **Arquivo**: `desktop/src/Kartodromo.Comum/PecasDesign.cs` (linhas 24-36)
- **Código**:
  ```csharp
  24: public static Image Tile(Color cima, Color baixo, string caminho)
  25: {
  26:     var bmp = new Bitmap(72, 72);
  ...
  35:     return bmp;
  36: }
  ```
- **Fato**: `FormMoverCliente`, `FormIncluirCliente` e `FormEditarReserva` chamam `PecasDesign.Tile(...)` criando novos bitmaps de 72×72 que nunca são cacheados nem descartados ao fechar os diálogos.

#### #33. Vazamento de ContextMenuStrip e diálogos modais sem Using
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/Baterias.cs` (linhas 300, 497, 555) e `FormPrincipal.cs` (linhas 1334, 1347, 1348)
- **Código**:
  ```csharp
  new FormListaParticipantes(b).ShowDialog(this);
  new FormVenda(sel[0].L("id") ?? 0).ShowDialog(this);
  new FormEstorno(sel[0].L("id") ?? 0).ShowDialog(this);
  ```
- **Fato**: Menus de contexto instanciados via `new ContextMenuStrip` no clique do botão direito e formulários modais chamados diretamente sem bloco `using var` retêm handles de janela do Windows (HWND e GDI) indefinidamente até a coleta do garbage collector.

#### #34. Crash em LinearGradientBrush com dimensões nulas
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/Caixa.cs` (linhas 233, 252)
- **Código**:
  ```csharp
  using var b = new LinearGradientBrush(resumo.ClientRectangle, Tokens.Claro.CorSuperficieInversa, Color.FromArgb(11, 11, 12), 90f);
  ```
- **Fato**: Se `ClientRectangle.Width <= 0` ou `Height <= 0` (durante inicialização, colapso ou minimização da janela), o construtor `LinearGradientBrush` lança `ArgumentException` não tratada, quebrando o evento `Paint`.

#### #35. Vazamento de fonte GDI em LupaBmp
- **Arquivo**: `desktop/src/Kartodromo.Recepcao/Caixa.cs` (linhas 495-501)
- **Código**:
  ```csharp
  TextRenderer.DrawText(g, "\uE721", new Font("Segoe MDL2 Assets", 9F), new Rectangle(0, 0, 16, 16), ...);
  ```
- **Fato**: Instancia `new Font(...)` sem bloco `using`, vazando um handle HFONT a cada abertura do checkout.

#### #36. Perda de foco inicial por teclado em DialogoDesign
- **Arquivo**: `desktop/src/Kartodromo.Comum/DialogoDesign.cs` (linhas 96-98)
- **Código**:
  ```csharp
  if (ActiveControl is ButtonBase)
      ActiveControl = PrimeiroCampo(_secoes);
  ```
- **Fato**: Em diálogos informativos ou de listagem onde `PrimeiroCampo` retorna `null` (como `FormListaParticipantes`), `ActiveControl` é anulado. A janela abre sem foco em nenhum controle, ignorando comandos de teclado (Tab, Enter, Espaço) até o usuário clicar na tela com o mouse.

---

## 2. Cadeia Lógica (Logic Chain)

1. **Da fila de impressão TM-T20X à estabilidade da recepção**:
   - Observou-se em #1 que `AgenteImpressao.cs:23-29` não aborta quando a impressora de termos configurada não existe.
   - Observou-se em #2 que `Relatorio.cs:284-287` aguarda `carregou.Task` sem timeout.
   - Observou-se em #4 que o erro 401 dispara um modal na UI thread e não renova o token.
   - *Dedução*: Uma oscilação de rede ou queda de login bloqueia silenciosamente o agente na máquina da recepção (.53). Enquanto isso, o servidor acumula termos em memória, que são perdidos se o serviço Node for reiniciado. A TM-T20X ainda desperdiça papel (#3) devido à falta de dimensões de página no WebView2.

2. **Das operações financeiras de caixa à integridade dos lançamentos**:
   - Observou-se em #7 que `Caixa.cs:600` calcula `troco = Math.Max(0, rec - sub)` para qualquer forma de pagamento.
   - Observou-se em #10 e #11 que suprimento e sangria não validam saldo contra `dinheiroEmCaixa`.
   - *Dedução*: A ausência de validação de forma de pagamento no troco e de saldos na gaveta abre brechas operacionais graves e inconsistências na conciliação diária de fechamento de caixa.

3. **Da concorrência de pista e atualização de baterias**:
   - Observou-se em #14 e #15 que `FormMoverCliente` e `FormIncluirCliente` não verificam se a bateria já expirou ou se tem vagas suficientes.
   - Observou-se em #18 e #19 que a cada 10 segundos 6 requisições HTTP ocorrem sequencialmente, e a redefinição de linhas da Grade causa instabilidade durante o clique do operador.
   - *Dedução*: Operadores podem incluir pilotos em baterias que já largaram, gerando atritos na pista, enquanto o polling agressivo sobrecarrega o servidor da operação.

4. **Da usabilidade cadastral à proteção de PII**:
   - Observou-se em #20 que `Campos.Mascara` reposiciona o cursor no início quando a edição é no meio do texto (`SelectionStart = 0`).
   - Observou-se em #21 que `ValidacaoCliente.cs:19` torna o Instagram estritamente obrigatório.
   - Observou-se em #22 que `FormCliente.Salvar` não valida o CPF antes de enviar.
   - *Dedução*: A recepção sofre com erros frequentes de digitação de telefone e CPF devido ao salto do cursor, e é forçada a cadastrar contas fictícias de Instagram para clientes que não possuem a rede social.

5. **Da estabilidade da arquitetura WinForms e ciclo de vida GDI**:
   - Observou-se em #30 que `c.Region = new Region(path)` em `Design.cs:49` não descarta a região anterior.
   - Observou-se em #31 que o Stream da imagem embutida é fechado imediatamente.
   - Observou-se em #33, #34 e #35 o vazamento contínuo de `ContextMenuStrip`, `Font`, `Bitmap` e erros em `LinearGradientBrush(0, 0)`.
   - *Dedução*: O aplicativo desktop acumula handles GDI e de janela a cada tela aberta ou redimensionada, culminando em lentidão progressiva e falhas de memória após algumas horas contínuas de uso.

---

## 3. Ressalvas e Limitações (Caveats)

- A análise foi 100% read-only, inspecionando diretamente o código-fonte C# .NET 8 e comparando com as regras operacionais estabelecidas no projeto.
- Não foram executados testes com hardware físico de impressora Epson TM-T20X nesta sessão.
- Não foram alterados arquivos de produção nem foi executado deploy durante esta fase investigativa.

---

## 4. Conclusão (Conclusion)

O aplicativo Desktop da Recepção (`Kartodromo.Recepcao`) e a biblioteca comum (`Kartodromo.Comum`) possuem arquitetura visual moderna e alinhada ao design aprovado, porém apresentam vulnerabilidades operacionais críticas nas áreas de:
1. **Fila de Impressão**: Bloqueio silencioso sem timeout, falta de contingência e desperdício de bobina térmica.
2. **Caixa e PDV**: Cálculo de troco para métodos não-dinheiro, sangrias/suprimentos sem validação de saldo e falta de opção para desvincular vouchers.
3. **Pista e Baterias**: Falta de trava de horário de início de baterias e concorrência na grade.
4. **Cadastros**: Bug de cursor jumping nas máscaras, obrigatoriedade indevida de Instagram e falta de validação de CPF no formulário de cliente.
5. **Comunicação e Rede**: Timeout excessivo de 30s, polling agressivo a cada 10s e ausência de renovação in-app de token expirado.
6. **Estabilidade GDI**: Vazamento contínuo de regiões em `Forma.Recortar` e formulários/menus sem `Dispose()`.

---

## 5. Método de Verificação Independente (Verification Method)

Para validar e confirmar de forma independente os 36 pontos identificados:

1. **Compilação da Solução**:
   ```bash
   dotnet build desktop/Kartodromo.Desktop.sln -c Release
   ```
2. **Inspeção Estática dos Trechos Mapeados**:
   - `desktop/src/Kartodromo.Comum/Design.cs:45-50` (Confirmar a atribuição de `c.Region` sem descarte da região anterior).
   - `desktop/src/Kartodromo.Comum/Ui.cs:232-244` (Confirmar a lógica de `SelectionStart` em `Campos.Mascara`).
   - `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs:17-23` (Confirmar o erro retornado quando Instagram é vazio).
   - `desktop/src/Kartodromo.Recepcao/Caixa.cs:596-601` (Confirmar cálculo de troco genérico `rec - sub`).
   - `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs:23-29` (Confirmar início do timer mesmo quando impressora não existe).
   - `desktop/src/Kartodromo.Recepcao/Acoes.cs:434-437` (Confirmar ausência de filtro de horário em `FormMoverCliente`).
   - `desktop/src/Kartodromo.Comum/Relatorio.cs:284-287` (Confirmar falta de timeout em `carregou.Task`).
3. **Condições de Invalidação**:
   - Se `Control.Region` do WinForms internamente liberasse a região GDI anterior (o que a documentação oficial da Microsoft nega explicitamente).
   - Se o backend já rejeitasse com regras de negócio todos os casos de troco e baterias com horário expirado (o que deve ser garantido em ambas as pontas).
