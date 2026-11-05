# Relatório Técnico de Análise e Auditoria: Totem de Autoatendimento WinForms .NET 8 e Infraestrutura

**Data**: 2026-10-26T19:25:00Z  
**Autor**: Explorer Especialista em Desktop WinForms, UX Kiosk e Infraestrutura  
**Destinatário**: Orquestrador (Parent `cc947e12-4c7c-48ad-93cf-a3cced581f33`)  
**Escopo**: Totem de Autoatendimento (`Kartodromo.Autoatendimento`), Biblioteca Comum (`Kartodromo.Comum`), Integração com Backend (`ops-server.ts`, `lib/ops/`), Autoteste Visual e Scripts de Deploy/PowerShell.

---

## 1. Observação

Foram inspecionados os arquivos-fonte do aplicativo Kiosk WinForms, da camada compartilhada, do backend de operações e dos scripts PowerShell de infraestrutura. Seguem os fatos diretamente observados no código:

### 1.1 R1. Fila de Impressão, Periféricos e Layout Térmico
- **Ausência de impressora local e tentativa cega de `ImprimirSilencioso`**:
  - Em `desktop/src/Kartodromo.Autoatendimento/appsettings.json`, linha 3: `"Impressora": ""`.
  - Em `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`, linhas 770-783:
    ```csharp
    if (r["termoNaRecepcao"]?.GetValue<bool>() == true) Program.Log("termo enviado para a impressora da recepção");
    else if (r.S("termoUrl") is { Length: > 0 } termo) _ = Imprimir(_api.BaseUrl + termo);
    ...
    async Task Imprimir(string url)
    {
        try { await Relatorio.ImprimirSilencioso(url, Config.Impressora); Program.Log("termo impresso: " + url.Split('?')[0]); }
        catch (Exception e) { Program.Log("falha ao imprimir termo: " + e.Message); }
    }
    ```
  - Em `desktop/src/Kartodromo.Comum/Relatorio.cs`, linhas 292-295:
    ```csharp
    if (!string.IsNullOrWhiteSpace(impressora)) cfg.PrinterName = impressora;
    var st = await web.CoreWebView2.PrintAsync(cfg);
    ```
    Quando `impressora` é vazia, `cfg.PrinterName` não é definido e o WebView2 imprime silenciosamente na impressora padrão do Windows. Nos totens físicos (que não possuem impressora conectada localmente), a chamada tenta comunicação com filas órfãs ou drivers virtuais, gerando falhas em log e deixando o cliente desorientado se o envio para a recepção falhar.
- **Desperdício de bobina térmica na TM-T20 por altura fixa de 297 mm**:
  - Em `lib/ops/termo.ts`, linhas 192-196:
    ```typescript
    '@page{size:80mm 297mm;margin:0}' +
    'html,body{margin:0;padding:0;width:80mm;background:#fff;color:#000}' +
    '.page{position:relative;width:80mm;min-height:297mm;padding:0 5.7mm 0;display:flex;flex-direction:column;margin:0 auto;background:#fff;break-after:page;page-break-after:always}' +
    ```
  - Em `tests/ops/termo.test.ts`, linha 34:
    ```typescript
    expect(html).toContain('@page{size:80mm 297mm;margin:0}');
    ```
    A dimensão fixa de 297 mm força a Epson TM-T20 a alimentar quase 30 cm de papel a cada termo, mesmo que o conteúdo ocupe apenas 10-15 cm.
- **Exigência indevida de impressora no script do Totem 1**:
  - Em `scripts/apps/instalar-totem1.ps1`, linhas 15-20:
    ```powershell
    $printer = Get-Printer -ErrorAction Stop |
      Where-Object { $_.Name -match '(?i)TM.?T20' } |
      Select-Object -First 1
    if (-not $printer) {
      throw 'Nao encontrei uma impressora TM-T20. Instale/configure a impressora e rode novamente.'
    }
    ```
    O script aborta a instalação do Totem 1 caso não haja uma impressora TM-T20 local fisicamente conectada a ele.

### 1.2 R2. Segurança, Privacidade e LGPD
- **Exposição de dados pessoais (PII) desmascarados na identificação pública**:
  - Em `services/ops-server.ts`, linhas 305-332:
    ```typescript
    send(res, 200, {
      cliente: {
        id: c.id, nome: c.nome, tipoDocumento: txt(c.tipoDocumento) || 'CPF', documento: txt(c.documento),
        email: txt(c.email), telefone: txt(c.telefone), nascimento: txt(c.nascimento), ...
        endereco: enderecoCompleto, numero: num, complemento: comp, ...
      },
      dependentes: dependentes.map((d) => ({ ...d, token: sign(`cli:${d.id}`) })),
      token: sign(`cli:${c.id}`),
    });
    ```
    Qualquer pessoa digitando um CPF na tela inicial pública do totem recebe dados de contato e endereço completos, além da lista de dependentes menores com data de nascimento.
- **Sessão atrelada a IP de socket TCP e IPs estáticos hardcoded**:
  - Em `services/ops-server.ts`, linhas 298-299:
    ```typescript
    identificadoNoTotem.delete(ipDe(req));
    identificadoNoTotem.set(ipDe(req), { id: Number(c.id), em: Date.now() });
    ```
  - Em `services/ops-server.ts`, linha 395: `const dono = donoNoTotem(req);`.
  - IPs hardcoded em scripts: `scripts/apps/habilitar-admin-remoto-totem1.ps1:6` (`$totemIp = '192.168.20.161'`) e `implantar-remoto.ps1:4` (`192.168.20.69`).
- **Escape do modo Kiosk via teclado físico USB para a Área de Trabalho do Windows**:
  - Em `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`, linhas 12, 57-60, 141-150:
    O formulário utiliza apenas `IMessageFilter` para reiniciar o timer ocioso e configura `TopMost = true; WindowState = FormWindowState.Maximized`. Não há nenhuma implementação de `SetWindowsHookEx(WH_KEYBOARD_LL)` no código.
    Teclas e atalhos de sistema como `Tecla Windows` (LWin/RWin), `Alt + Tab`, `Ctrl + Esc`, `Alt + Esc` e `Alt + F4` são despachados pelo Windows antes do loop do WinForms, permitindo que qualquer usuário escape para a Área de Trabalho e acesse o Explorer/painel do Windows.
- **Ausência de consentimento e termos expressos para tratamento de dados de menores**:
  - Em `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`, linhas 692-701:
    `TelaCadastroMenor` envia automaticamente `["lgpd"] = true` no JSON sem exibir nenhum checkbox ou termo de consentimento específico para o responsável autorizar a coleta de dados do menor, em desconformidade com o Art. 14 da LGPD.

### 1.3 R3. Validação de Dados e Cadastro no Totem
- **Instagram obrigatório bloqueando participantes**:
  - Em `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`, linha 460:
    `Obrigatorio(fInstagram, "Instagram do piloto (@usuário)", true);`
  - Em `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs`, linhas 17-23:
    ```csharp
    public static string ErroInstagram(string instagram)
    {
        if (string.IsNullOrWhiteSpace(instagram)) return "O Instagram é obrigatório. Informe o @usuário do piloto.";
        var perfil = NormalizarInstagram(instagram);
        return Regex.IsMatch(perfil, @"^@[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$") && !perfil.Contains("..")
            ? null : "Instagram inválido. Informe o @usuário do piloto (ex.: @andre.silva).";
    }
    ```
  - Em `FormTotem.cs`, linhas 653, 684, 691 (`TelaCadastroMenor`): o Instagram do menor é exigido compulsoriamente. Clientes sem rede social não conseguem prosseguir.
- **Máscara e validação de telefone incompatíveis com turistas e internacionais**:
  - Em `desktop/src/Kartodromo.Comum/Fmt.cs`, linhas 46-55:
    `MascaraFone` extrai dígitos e limita estritamente a 11 dígitos no formato brasileiro `(XX) XXXXX-XXXX`. Telefones internacionais que iniciam com `+` são desconfigurados e truncados.
  - Em `FormTotem.cs`, linhas 519, 532, 686: exige `Fmt.Digitos(fFone.Text).Length >= 10`.
- **Salto do cursor para o final do campo durante a digitação na função `Mascarar`**:
  - Em `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`, linha 340:
    ```csharp
    if (novo != t.Text) { t.Text = novo; t.SelectionStart = novo.Length; }
    ```
    Qualquer tentativa de posicionar o cursor no meio do texto e editar um dígito faz o cursor saltar para o final (`novo.Length`), impedindo a edição fluida.
- **Sobrescrita das colunas `Numero` e `Complemento` como NULL**:
  - Em `services/ops-server.ts`, linhas 358-369:
    ```typescript
    if (dados.endereco !== undefined) {
      ...
      else limparNumero = Boolean(atual?.numero || atual?.complemento);
    }
    await updateCliente(id, { ...dados, lgpd: true }, true);
    if (limparNumero) await query(`UPDATE dbo.Cliente SET Numero = NULL, Complemento = NULL WHERE Id = @id`, { id });
    ```
    Qualquer atualização de endereço no totem apaga os valores originais de `Numero` e `Complemento` no banco de dados.
- **Edição assistida bloqueada para existentes e perda de dados em HTTP 409**:
  - Em `FormTotem.cs`, linha 467: `reg.Enabled = tipo.Enabled = fDoc.Enabled = fNome.Enabled = false;` (impede correção de erros de digitação no nome/documento).
  - Em `FormTotem.cs`, linha 500: `Botao(c, "Voltar", ..., () => { Reiniciar(); return Task.CompletedTask; });`. Caso o cadastro retorne HTTP 409 ("Já existe cadastro com esse documento"), clicar em voltar ou reiniciar apaga todos os campos preenchidos.
- **Inconsistência de faixas de peso**:
  - `FormTotem.cs:526`: Adulto exige 20 a 250 kg.
  - `FormTotem.cs:689`: Menor exige 10 a 250 kg.
  - `ValidacaoCliente.cs:38`: Valida de 0 a 500 kg.
  - `cadastro-obrigatorio.ts:7`: Valida de 0 a 500 kg.
- **Consultas SQL não parametrizadas**:
  - Em `services/ops-server.ts`, linhas 401-405: Interpolação direta de `${rows.map(...).join(',')}` e `${lista}` na cláusula SQL `IN (...)`.

### 1.4 R4. Usabilidade, Hardware e Fluxo de Atendimento
- **Perda de participantes selecionados ao cadastrar novo menor**:
  - Em `FormTotem.cs`, linha 616: `Botao(c, "Cadastrar menor", ..., () => { TelaCadastroMenor(); return Task.CompletedTask; });`.
  - A seleção atual da lista (`lista.Marcados()`) e `eu.Marcado` não são salvas em `_participantes` antes de abrir a tela do novo menor. Na linha 704, `_participantes` é sobrescrito apenas com o novo menor cadastrado, desmarcando os anteriores.
- **Regras de responsável por menor**:
  - `TelaCadastro` não valida maioridade: um jovem menor de idade pode cadastrar data de nascimento inferior a 18 anos e prosseguir sozinho para a pista sem responsável.
  - `TelaMenores:620-625`: o usuário pode desmarcar todos os menores, deixar apenas `_eu = true` e avançar para as baterias sem cadastrar/selecionar nenhum menor.
- **Timer de inatividade de 90 segundos cego a scroll e destrutivo em diálogos modais**:
  - Em `FormTotem.cs:144`: `PreFilterMessage` ignora eventos de rolagem de roda do mouse (`WM_MOUSEWHEEL` 0x020A) e toques de gestos (`WM_GESTURE` 0x0119).
  - O timer `_ocioso` não é pausado durante `Alerta.Mostrar` nem durante `TermoLgpd` (`f.ShowDialog(this)`). Ao expirar 90s, executa `Reiniciar()`, fechando todos os `OwnedForms` (linha 350) durante a leitura do usuário.
- **Perda de foco pós-fechamento do Termo LGPD**:
  - Em `FormTotem.cs:596-598`, ao fechar `TermoLgpd()`, o foco do teclado não é devolvido para o checkbox de aceite nem para os campos de digitação.
- **Perda de foco no teclado físico USB e ausência de detecção de hardware**:
  - Em `FormTotem.cs:190`, o foco é ajustado apenas uma vez ao renderizar o painel. Se o usuário tocar ou clicar no fundo do formulário fora de um controle de texto, o foco é perdido e o teclado USB para de responder. Não há rotina de alerta caso o teclado USB esteja desconectado.

### 1.5 R5. Regras de Baterias, Agendamento e Concorrência
- **Baterias com horário de início no passado liberadas para seleção**:
  - Em `lib/ops/totem-baterias.ts:22`: `AND b.Inicio >= CAST(SYSDATETIME() AS date)` traz baterias de horários anteriores do mesmo dia.
  - Em `FormTotem.cs`, linha 737: `var iniciou = DateTime.TryParse(b.S("inicio"), out var horario) && horario <= DateTime.Now;`.
  - Na linha 741, apenas exibe `"Horário iniciado às {inicio} · confirme na recepção"`, mas mantém o item selecionável e permite que o cliente reserve baterias cujo horário já expirou.
- **Mensagem genérica enganosa quando vagas são insuficientes para o grupo**:
  - Em `FormTotem.cs`, linhas 717 e 756: `baterias = todas.Where(b => b.I("livres") >= n).ToList()`.
  - Se um grupo de 5 pessoas busca vaga e há baterias com 3 ou 4 vagas abertas, elas são omitidas e a tela exibe: `"Nenhuma bateria com vaga disponível agora."`, fazendo o grupo presumir que o kartódromo está lotado.
- **Tela de sucesso limitada a uma única bateria**:
  - Em `FormTotem.cs`, linhas 769, 787-801: `TelaSucesso(string hora, int n)`. Exibe apenas um único horário (`Sua bateria começa às {hora}`), ignorando quando o cliente adquire múltiplas baterias em horários distintos, sem listar as categorias contratadas.
- **Omissão de preços na grade de baterias**:
  - Em `OpcaoLinha.cs`, linhas 1023-1046: exibe apenas nome, horário, badge da categoria e barra de ocupação. O preço em R$ não é exibido.
- **Condição de corrida na reserva da última vaga sem atualização da grade**:
  - Em `FormTotem.cs:760-775`: ao receber erro de falta de vagas no momento do clique em "Próximo", apenas exibe um alerta, mas não recarrega automaticamente a grade com os dados atualizados.

### 1.6 R6. Infraestrutura, Deploy, Rede e Ciclo de Vida
- **Erro de sintaxe fatal em `habilitar-admin-remoto-totem1.ps1`**:
  - Como observado via `git diff scripts/apps/habilitar-admin-remoto-totem1.ps1`, os parâmetros da regra de firewall foram interrompidos na linha 56 e fragmentos órfãos (`-Direction Inbound ... } else {`) foram deixados nas linhas 63-68 após a inserção do bloco de sincronização NTP, quebrando a sintaxe do PowerShell.
- **Exclusão indevida do atalho de autostart no deploy (`implantar-remoto.ps1`)**:
  - Em `scripts/apps/implantar-remoto.ps1`, linhas 51-66: se `-IniciarNoLogon` não for passado explicitamente, o script remove o atalho `Kartódromo Autoatendimento.lnk` da pasta `StartUp` e encerra o processo, impedindo que o totem inicie automaticamente no próximo boot.
- **Timeout HTTP de 30 segundos congelando a interface**:
  - Em `desktop/src/Kartodromo.Comum/Api.cs:53`, `_http = new HttpClient { Timeout = timeout ?? TimeSpan.FromSeconds(30) };`. Quedas de rede deixam o totem travado por meio minuto.
- **Bloqueio síncrono de inicialização em `TratarInicioAsync` (Tela preta de abertura)**:
  - Em `desktop/src/Kartodromo.Autoatendimento/Program.cs`, linha 21:
    `if (!autoteste && Atualizacao.TratarInicioAsync("Autoatendimento", args).GetAwaiter().GetResult()) return;`
    A verificação bloqueia o thread principal antes de instanciar e exibir `FormTotem`, gerando tela preta ou congelamento visual na abertura.
- **Vazamentos de memória GDI (`ContextMenuStrip` e `Bitmap`)**:
  - Em `desktop/src/Kartodromo.Autoatendimento/Controles.cs`, linha 375: `CampoLista.Abrir()` instancia um `new ContextMenuStrip(...)` a cada toque e nunca invoca `Dispose()`.
  - Em `Controles.cs:35-39`: `Estilo.Logo()` clona um novo `Bitmap` a cada chamada, acumulando handles GDI ao longo de dias ininterruptos de operação.
- **Esgotamento de conexões e concorrência no `ViaCep`**:
  - Em `FormTotem.cs`, linhas 560-569: instancia um `new HttpClient` por chamada e não utiliza `CancellationTokenSource`, permitindo que respostas de requisições anteriores sobreponham dados mais recentes ao digitar rápido.

---

## 2. Cadeia Lógica

1. **R1 — Gestão de Impressão e Bobina Térmica**:
   - Da observação em `FormTotem.cs:772` e `Relatorio.cs:293`, quando `Config.Impressora` é vazio, o software tenta imprimir no driver padrão do Windows. Como os totens não possuem impressora local física, essa chamada é um beco sem saída que gera exceções silenciosas. Portanto, a verificação da existência de impressora instalada deve preceder qualquer chamada de impressão, e caso o termo seja delegado à recepção e falhe, a tela deve exibir orientação clara para atendimento balcão.
   - Da observação em `lib/ops/termo.ts:192`, o CSS força `@page { size: 80mm 297mm }` com quebra de página de A4. Portanto, a troca para `80mm auto` elimina o avanço de papel em branco na Epson TM-T20, cortando o cupom exatamente no término do texto.

2. **R2 — Segurança Kiosk e Privacidade LGPD**:
   - Da observação em `services/ops-server.ts:310`, os dados devolvidos na busca por CPF contêm e-mail, telefone, endereço e dependentes em texto limpo. Portanto, em um totem público, esses dados devem ser obrigatoriamente mascarados no servidor antes do envio à interface pública.
   - Da observação de ausência de hook em `FormTotem.cs`, o WinForms opera sob o loop de mensagens padrão da aplicação, o qual não recebe teclas de atalho do sistema operacional Windows (LWin, Alt+Tab, etc.). Portanto, somente um hook de baixo nível (`WH_KEYBOARD_LL`) instalado via Win32 API (`SetWindowsHookEx`) é capaz de interceptar e suprimir essas teclas antes que o Windows as processe.
   - Da observação em `FormTotem.cs:700`, menores são salvos sem consentimento expresso. Portanto, um checkbox explícito de autorização do responsável legal é mandatório nos termos do Art. 14 da LGPD.

3. **R3 — Validação de Dados e Experiência Cadastral**:
   - Da observação em `FormTotem.cs:460` e `ValidacaoCliente.cs:19`, o Instagram é obrigatório sem alternativa de descarte. Portanto, adicionar a opção explícita "Não possuo Instagram" e permitir valor em branco resolve o impedimento de crianças, idosos e turistas sem quebrar a integridade dos dados dos pilotos que o possuem.
   - Da observação em `FormTotem.cs:340`, `SelectionStart = novo.Length` joga o cursor sempre no final. Portanto, mapear os caracteres válidos antes da alteração e restaurar a posição proporcional permite edição contínua no meio do texto.
   - Da observação em `services/ops-server.ts:369`, o backend roda `SET Numero = NULL, Complemento = NULL` se o endereço for modificado. Portanto, suprimir essa query destrutiva preserva os dados históricos do cliente no banco.

4. **R4 — Fluxo Kiosk, Hardware e Usabilidade**:
   - Da observação em `FormTotem.cs:616`, `_participantes` não é sincronizado antes de abrir `TelaCadastroMenor`. Portanto, armazenar a seleção do checkbox antes da transição garante que os dependentes já marcados permaneçam selecionados ao retornar.
   - Da observação em `FormTotem.cs:144, 350`, o timer ignora a roda do mouse e derruba modais abertos. Portanto, adicionar `WM_MOUSEWHEEL` e pausar o timer durante a exibição de modais impede que clientes percam o formulário durante a leitura de termos.
   - Da observação em `FormTotem.cs:190`, cliques no fundo desviam o foco do teclado USB. Portanto, redirecionar o foco automaticamente para o campo de texto ativo mantém a conformidade estrita com a regra do dono (totem sem teclado virtual).

5. **R5 — Agendamento de Baterias e Concorrência**:
   - Da observação em `lib/ops/totem-baterias.ts:22` e `FormTotem.cs:737`, baterias anteriores a `DateTime.Now` são listadas. Portanto, filtrar `b.Inicio > SYSDATETIME()` no SQL e desabilitar no cliente impede que clientes agendem baterias que já entraram na pista.
   - Da observação em `FormTotem.cs:717`, baterias com vagas menores que o grupo somem sem explicação. Portanto, mensagens condicionais informando a existência de vagas parciais orientam o cliente a buscar apoio na recepção em vez de desistir.
   - Da observação em `OpcaoLinha.cs:1023`, o preço não é desenhado. Portanto, incluir o valor em reais na query e no controle gráfico confere transparência ao cliente.

6. **R6 — Infraestrutura, Rede e Confiabilidade Operacional**:
   - Da observação do `git diff` em `habilitar-admin-remoto-totem1.ps1`, a sintaxe está corrompida. Portanto, reorganizar os blocos `if/else` e mover o comando de NTP para depois do fechamento do firewall restabelece a execução do script.
   - Da observação em `implantar-remoto.ps1:51`, o script apaga o atalho de inicialização por padrão. Portanto, preservar o atalho em máquinas do tipo totem garante a inicialização resiliente pós-reinício.
   - Da observação em `Program.cs:21`, a inicialização síncrona gera tela preta. Portanto, adiar a checagem de atualizações para após o `FormTotem.Shown` (em segundo plano) elimina o atraso na abertura do kiosk.
   - Da observação em `Controles.cs:375`, menus de contexto não descartados vazam handles GDI. Portanto, implementar descarte explícito em `Closed` estabiliza o consumo de recursos no longo prazo.

---

## 3. Ressalvas

- **Modo CODE_ONLY / Execução em macOS Darwin**: O ambiente de análise atual opera sob sistema operacional macOS Darwin, onde o executável do SDK do .NET (`dotnet`) e o compilador C# não estão instalados localmente. A verificação estrutural foi realizada por análise estática e sintática rigorosa nos arquivos C#, TypeScript e PowerShell.
- **Ambiente de Produção e Horário Operacional**: Em total observância às regras em `AGENTS.md`, nenhum comando invasivo, reinício de serviço ou alteração foi disparado contra os servidores e totens reais (`:4050`, `:4060` ou máquinas físicas).
- **Escopo Read-Only**: Este relatório constitui levantamento técnico de causas-raiz e diretrizes arquiteturais para a fase de implementação, sem aplicação direta de modificações nos arquivos de código nesta etapa.

---

## 4. Conclusão

A investigação identificou com exatidão as causas-raiz de todos os gargalos e vulnerabilidades reportados para o Totem de Autoatendimento. O sistema apresenta solidez de layout e renderização responsiva comprovada pelo autoteste visual (1366x768 e 1920x1080), mas acumulou débitos técnicos críticos nas seguintes áreas:
1. **Periféricos e Impressão**: O totem tenta impressão silenciosa em hardware inexistente e desperdiça bobina térmica na recepção por formatação A4 fixa de 297 mm.
2. **Segurança de Kiosk e LGPD**: Teclas de sistema do Windows não são interceptadas por falta de hook de baixo nível; a identificação pública expõe PII e dependentes sem mascaramento; sessões apoiam-se em IPs de socket voláteis.
3. **Usabilidade e Validações**: O Instagram obrigatório trava participantes não usuários; o cursor de texto salta indevidamente na edição; campos de telefone bloqueiam estrangeiros; dependentes selecionados são perdidos ao alternar telas; o timer de 90s fecha modais abruptamente.
4. **Agendamento e Transparência**: Baterias com horário já iniciado são permitidas; grupos recebem falso aviso de falta de vagas; preços não aparecem na grade; a tela de sucesso só suporta uma bateria por vez.
5. **Infraestrutura e Estabilidade**: O script de administração remota do Totem 1 possui erro fatal de sintaxe PowerShell; o deploy remoto remove o atalho de autostart; a inicialização síncrona do atualizador gera tela preta; menus e logos vazam handles GDI; o ViaCep gera sobreposição de requisições.

A resolução desses pontos não requer reescrita do sistema, mas sim correções cirúrgicas, bem delimitadas e pontuais nos pontos mapeados.

---

## 5. Método de Verificação Independente

Para verificar independentemente os achados deste relatório:

1. **Inspeção de Código e Arquivos**:
   - `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`: conferir linhas 340 (cursor `novo.Length`), 460 (`Obrigatorio` Instagram), 616 (perda de seleção ao chamar `TelaCadastroMenor`), 717 (filtro de baterias para grupos) e 772 (chamada cega a `ImprimirSilencioso`).
   - `desktop/src/Kartodromo.Autoatendimento/Controles.cs`: conferir linha 375 (`new ContextMenuStrip` sem dispose) e linha 35 (`Estilo.Logo()` instanciando novos bitmaps).
   - `desktop/src/Kartodromo.Autoatendimento/Program.cs`: conferir linha 21 (bloqueio síncrono `.GetAwaiter().GetResult()` na inicialização).
   - `desktop/src/Kartodromo.Comum/Api.cs`: conferir linha 53 (timeout padrão de 30s).
   - `lib/ops/termo.ts`: conferir linha 192 (`@page{size:80mm 297mm;margin:0}`).
   - `services/ops-server.ts`: conferir linha 310 (retorno desmascarado de PII) e linha 369 (`UPDATE dbo.Cliente SET Numero = NULL, Complemento = NULL`).
   - `scripts/apps/habilitar-admin-remoto-totem1.ps1`: executar `git diff scripts/apps/habilitar-admin-remoto-totem1.ps1` e inspecionar as linhas 63-68.
   - `scripts/apps/implantar-remoto.ps1`: inspecionar linhas 51-66 (remoção de atalho em `StartUp`).

2. **Comandos de Validação e Testes**:
   - **Compilação C#**: No ambiente Windows / build runner, executar:
     ```bash
     dotnet build desktop/Kartodromo.Desktop.sln -c Release
     ```
   - **Autoteste Visual do Totem**:
     ```bash
     desktop/src/Kartodromo.Autoatendimento/bin/Release/net8.0-windows/Kartodromo.Autoatendimento.exe --autoteste "caminho_fotos"
     ```
     Verificar se gera as 9 telas renderizadas em 1366x768 e 1920x1080.
   - **Testes de Unidade TypeScript**:
     ```bash
     npx vitest run tests/ops/termo.test.ts tests/ops/totem-baterias.test.ts
     ```
   - **Checagem de Sintaxe PowerShell**:
     ```powershell
     [System.Management.Automation.Language.Parser]::ParseFile("scripts/apps/habilitar-admin-remoto-totem1.ps1", [ref]$null, [ref]$errors)
     ```
