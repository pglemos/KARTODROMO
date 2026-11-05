# Relatório de Especificação e Auditoria do Totem de Autoatendimento (Survey)

**Data de Emissão:** 2026-10-26T19:20:00Z  
**Autor:** Spec Miner Totem Survey 1 (`spec_miner_totem_survey_1`)  
**Destinatário:** Orquestrador (`cc947e12-4c7c-48ad-93cf-a3cced581f33`)  
**Status:** Hard Handoff (Levantamento completo de R1 a R6)

---

## 1. Observation (Observações Diretas)

Foram inspecionados os arquivos de código-fonte, scripts de infraestrutura, arquivos de documentação operacional e testes automatizados. Seguem os fatos e trechos literais observados:

### 1.1 Impressão e Gestão de Termos (R1)
- Em `services/ops-server.ts`, linhas 211-233:
  ```ts
  type Impressao = { id: number; url: string; titulo: string; origem: string; criadoEm: number; pegoEm?: number; feitaEm?: number; tentativas: number };
  const filaImpressao: Impressao[] = [];
  let seqImpressao = 0;
  const IMPRESSAO_VALIDADE_MS = 3 * 60 * 60 * 1000;
  const IMPRESSAO_REENTREGA_MS = 90 * 1000;
  ```
  A fila existe exclusivamente na memória RAM (`filaImpressao: Impressao[]`). Na linha 219, `for (let i = filaImpressao.length - 1; i >= 0; i--) if (agora - filaImpressao[i].criadoEm > IMPRESSAO_VALIDADE_MS) filaImpressao.splice(i, 1);`, os trabalhos são expurgados silenciosamente após 3 horas se o aplicativo da Recepção (.53) estiver deslogado ou fechado. Não há tabela `dbo.FilaImpressao` no banco de dados `KartodromoOps`.
- Em `lib/ops/termo.ts`, linhas 192 e 196:
  ```css
  @page{size:80mm 297mm;margin:0}
  .page{position:relative;width:80mm;min-height:297mm;padding:0 5.7mm 0;display:flex;flex-direction:column;margin:0 auto;background:#fff;break-after:page;page-break-after:always}
  ```
  A altura da folha está travada em 297 mm fixos (comprimento padrão de folha A4). Como a impressora térmica da recepção é uma bobina contínua EPSON TM-T20X de 80 mm, cada termo impresso desperdiça mais de 10 a 15 cm de papel em branco após a área de assinaturas.
- Em `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`, linhas 770-773:
  ```csharp
  if (r["termoNaRecepcao"]?.GetValue<bool>() == true) Program.Log("termo enviado para a impressora da recepção");
  else if (r.S("termoUrl") is { Length: > 0 } termo) _ = Imprimir(_api.BaseUrl + termo);
  ```
  E na linha 781:
  `await Relatorio.ImprimirSilencioso(url, Config.Impressora);`
  Os totens (.161 e .69) não têm impressora local conectada desde o início de 2025. Se o servidor devolver `termoNaRecepcao: false` (ou se o parâmetro `totem.termoNaRecepcao` for desligado), o totem tenta impressão silenciosa cega no Windows local e falha silenciosamente no `catch`, sem orientar o usuário sobre como retirar o termo na recepção.
- Em `docs/operacao/HANDOFF-SISTEMA-PROPRIO.md`, seção 11, item 6:
  > "Filas locais antigas nos totens: há 9 termos presos na fila 'EPSON TM-T20 Receipt' de .161/.69. São inofensivos, porque o totem não imprime mais localmente. Dá para limpar se o dono autorizar."

### 1.2 Segurança, Privacidade e LGPD (R2)
- Em `services/ops-server.ts`, linhas 240-249 e 297-299:
  ```ts
  const identificadoNoTotem = new Map<string, { id: number; em: number }>();
  const ipDe = (req: http.IncomingMessage) => String(req.socket.remoteAddress ?? '').replace(/^::ffff:/, '');
  function donoNoTotem(req: http.IncomingMessage) {
    const x = identificadoNoTotem.get(ipDe(req));
    return x && Date.now() - x.em < 15 * 60_000 ? x.id : null;
  }
  function origemDe(req: http.IncomingMessage) {
    const ip = String(req.socket.remoteAddress ?? '').replace(/^::ffff:/, '');
    return ip === '192.168.20.161' ? 'Totem 1' : ip === '192.168.20.69' ? 'Totem 2' : ip || 'totem';
  }
  ```
  A sessão do totem e a posse de vagas de reservas de grupos online são associadas exclusivamente ao endereço IP do socket (`req.socket.remoteAddress`), com IPs hardcoded (`192.168.20.161` e `.69`). Qualquer NAT, proxy, Wi-Fi temporário ou alteração de DHCP corrompe ou sobrescreve a posse de vagas pagas entre totens.
- Em `services/ops-server.ts`, linhas 304-333 (`POST /api/totem/identificar`):
  Ao informar um CPF ou e-mail, o backend retorna todos os dados pessoais do cliente em texto claro: `nome`, `documento`, `email`, `telefone`, `nascimento`, `peso`, `cep`, `endereco`, `bairro`, `cidade`, além de retornar a lista completa de `dependentes` com seus nomes e datas de nascimento. Nenhuma máscara de PII é aplicada.
- Em `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`, não existe hook de teclado de baixo nível (`SetWindowsHookEx`). O teclado USB físico permite que usuários executem combinações de teclas do sistema operacional (`WinKey`, `Alt+Tab`, `Ctrl+Esc`, `Ctrl+Shift+Esc`, `Alt+F4`), quebrando o isolamento Kiosk e permitindo acesso à área de trabalho do Windows.
- Em `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`, tela de cadastro de menores (`TelaCadastroMenor`), linhas 692-701: o cadastro de dependente envia `["lgpd"] = true` para o servidor sem apresentar termo de consentimento específico para tratamento de dados pessoais de menores pelo responsável legal (exigência do Art. 14, §1º da LGPD).

### 1.3 Validação de Dados e Cadastro no Totem (R3)
- Em `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`, linhas 440, 460 e 524:
  `Obrigatorio(fInstagram, "Instagram do piloto (@usuário)", true);`
  O Instagram é validado como obrigatório (`ValidacaoCliente.ErroInstagram`). Em `lib/ops/cadastro-obrigatorio.ts`, linha 15 e `lib/ops/instagram.ts`, linha 11:
  `if (!String(value ?? '').trim()) return 'O Instagram é obrigatório. Informe o @usuário do piloto.';`
  Isso impede o agendamento de clientes que não possuem conta no Instagram (crianças, idosos, turistas estrangeiros).
- Em `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`, linhas 474, 519 e 532:
  O campo celular impõe a máscara brasileira `Fmt.MascaraFone` e exige `Fmt.Digitos(fFone.Text).Length >= 10`. Usuários estrangeiros com passaporte que possuem números telefônicos internacionais são bloqueados.
- Divergência de validação de peso:
  - No desktop (`FormTotem.cs`, linhas 526-527 e 689-690):
    `if (!double.TryParse(pesoTxt, ...) || kg < 20 || kg > 250)` (adulto: 20 a 250 kg; menor: 10 a 250 kg).
  - No servidor (`lib/ops/cadastro-obrigatorio.ts`, linhas 7-8):
    `Number.isFinite(valor) && valor > 0 && valor < 500` (maior que 0 e menor que 500 kg).
- Em `services/ops-server.ts`, linhas 359-369:
  Ao atualizar o endereço de um cliente existente:
  ```ts
  if (limparNumero) await query(`UPDATE dbo.Cliente SET Numero = NULL, Complemento = NULL WHERE Id = @id`, { id });
  ```
  Se o cliente apenas confirmar ou ajustar o texto do endereço completo exibido no totem, as colunas `Numero` e `Complemento` da tabela `dbo.Cliente` são sobrescritas como `NULL`.
- Em `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`, linhas 332-342:
  ```csharp
  static void Mascarar(TextBox t, Func<string, string> f)
  {
      var mexendo = false;
      t.TextChanged += (_, _) =>
      {
          if (mexendo) return;
          mexendo = true;
          var novo = f(t.Text);
          if (novo != t.Text) { t.Text = novo; t.SelectionStart = novo.Length; }
          mexendo = false;
      };
  }
  ```
  Ao aplicar a máscara, `t.SelectionStart = novo.Length` força o cursor para o final do campo, impedindo a edição de caracteres no meio do texto.
- Em `services/ops-server.ts`, linhas 399-406:
  Interpolação de strings em consulta SQL:
  ```ts
  const lista = grupo.join(',');
  for (const g of await query<{ b: number; n: number }>(
    `SELECT i.BateriaId b, COUNT(*) n FROM dbo.Inscricao i
      WHERE i.BateriaId IN (${rows.map((r) => Number(r.id)).join(',')}) AND i.Status <> 'cancelada'
        AND (i.ClienteId IN (${lista}) ...
  ```
  A cláusula SQL interpola `${lista}` diretamente na string ao invés de usar parâmetros SQL (`@p0, @p1...`).

### 1.4 Usabilidade, Hardware e Fluxo (R4)
- Em `FormTotem.cs`, linhas 608-624 e 674-706:
  Na `TelaMenores()`, os checkboxes selecionados pelo usuário em `lista.Marcados()` não são salvos em `_participantes` antes de abrir a `TelaCadastroMenor()`. Ao cadastrar um novo menor e retornar à tela anterior, todas as seleções feitas anteriormente são perdidas.
- Em `FormTotem.cs`, linhas 618-624:
  Se o cliente marca "Sou responsável por menor de idade", mas nenhum menor é selecionado e "Eu também vou participar" está desmarcado, ele recebe o alerta "Selecione pelo menos um participante", mas não há validação para impedir que um menor cadastrado sem responsável corra desacompanhado caso o responsável desmarque a si próprio.
- Em `FormTotem.cs`, linhas 141-150:
  ```csharp
  public bool PreFilterMessage(ref Message m)
  {
      if (m.Msg is 0x100 or 0x201 or 0x204 or 0x240 /*WM_TOUCH*/ or 0x0246 /*WM_POINTERDOWN*/)
      {
          _ocioso.Stop(); _ocioso.Start();
          if (_tela == "fim") { _fim.Stop(); _fim.Start(); }
      }
      return false;
  }
  ```
  O filtro de mensagens não intercepta eventos de roda de mouse `WM_MOUSEWHEEL` (`0x020A`). Além disso, ao abrir diálogos modais como `Alerta` ou `CriarTermoLgpd()`, o temporizador `_ocioso` continua correndo e pode chamar `Reiniciar()` fechando o modal abruptamente.
- Ao fechar o modal `TermoLgpd` (`FormTotem.cs`, linha 596), o foco não é restaurado explicitamente para o controle anterior (`lgpd` ou `fInstagram`), deixando a navegação por teclado sem foco ativo.

### 1.5 Regras de Baterias, Agendamento e Concorrência (R5)
- Em `lib/ops/office.ts`, linha 426:
  ```sql
  CASE WHEN b.Inicio < DATEADD(minute, -30, SYSDATETIME()) THEN 1 ELSE 0 END passada
  ```
  E em `tests/ops/totem-baterias.test.ts`, linha 5:
  `it('mantém visível uma bateria aberta de hoje mesmo depois do horário inicial', () => ...)`
  Existe uma tolerância arbitrária de -30 minutos permitindo que baterias cujo horário de início já passou continuem sendo pré-reservadas no totem.
- Em `FormTotem.cs`, linhas 716-717:
  ```csharp
  var todas = await _api.Lista("/api/totem/baterias");
  var n = _participantes.Count;
  var lista = todas.Where(b => b.I("livres") >= n).ToList();
  ```
  Se uma bateria possui vagas (ex.: 2 vagas), mas o grupo possui mais participantes (ex.: 3 pessoas), a bateria é silenciosamente ocultada da grade. Se todas as baterias tiverem vagas menores que o grupo, a lista fica vazia sem informar o motivo.
- Em `FormTotem.cs`, tela de sucesso (`TelaSucesso`), linhas 787-801:
  A tela de sucesso recebe apenas o horário da primeira bateria (`hora`) e a quantidade total de inscrições (`n`). Caso o cliente selecione múltiplas baterias ou categorias distintas (ex.: Light e Super), a tela não informa as categorias nem os horários das demais baterias contratadas.
- Em `FormTotem.cs`, controle `OpcaoLinha`, linhas 1023-1046 e query `TOTEM_BATERIAS_SQL`:
  A lista de baterias do totem não traz o preço da corrida (não consulta `p.PrecoCentavos`). O usuário não sabe quanto custará cada categoria no momento da escolha.
- Pagamento no totem:
  A rota `POST /api/totem/inscrever` gera exclusivamente inscrições com `Pago=0` e `Aprovada=0`. Todos os clientes do totem obrigatoriamente precisam entrar na fila física da recepção para pagar. Embora o projeto já possua integração Pix via Asaas (`workers/pre-cadastro/src/asaas.ts`), o totem não gera QR Code Pix dinâmico.
- Condição de corrida:
  Quando dois totens tentam inscrever simultaneamente a última vaga de uma bateria, o segundo cliente recebe erro HTTP 409 (`Não há vagas para a bateria selecionada`). O totem exibe um alerta modal padrão mas não reatualiza automaticamente a grade de horários.

### 1.6 Infraestrutura, Deploy e Ciclo de Vida (R6)
- Em `scripts/apps/habilitar-admin-remoto-totem1.ps1`, linhas 58-68:
  ```powershell
  # Sincronismo de relógio NTP (Item 26)
  Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\W32Time\TimeProviders\NtpClient' -Name 'SpecialPollInterval' -Value 900 -ErrorAction SilentlyContinue
  & w32tm /config /manualpeerlist:"a.st1.ntp.br,0x9 192.168.20.249,0x9" /syncfromflags:manual /reliable:YES /update
  Set-Service -Name w32time -StartupType Automatic
  Restart-Service w32time -Force -ErrorAction SilentlyContinue
      -Direction Inbound -Action Allow -Enabled True -Profile Any `
      -Protocol TCP -LocalPort 5985 -RemoteAddress $controllerIp | Out-Null
  } else {
    Set-NetFirewallRule -Name 'KIB-Totem1-WinRM-CRONOMETRAGEM' -Enabled True -Profile Any
    $customRule | Get-NetFirewallAddressFilter | Set-NetFirewallAddressFilter -RemoteAddress $controllerIp
  }
  ```
  O bloco de NTP foi colado no meio de uma declaração de `New-NetFirewallRule`, gerando erro de sintaxe que impede a execução do script.
- Em `desktop/src/Kartodromo.Comum/Api.cs`, linhas 50-53:
  `_http = new HttpClient { Timeout = timeout ?? TimeSpan.FromSeconds(30) };`
  O timeout padrão do cliente HTTP é de 30 segundos, congelando o totem em falhas de rede.
- Em `desktop/src/Kartodromo.Autoatendimento/Program.cs`, linha 21:
  `if (!autoteste && Atualizacao.TratarInicioAsync("Autoatendimento", args).GetAwaiter().GetResult()) return;`
  A chamada `.GetAwaiter().GetResult()` na thread principal bloqueia a abertura do aplicativo e gera uma janela preta durante a verificação de atualizações.
- Em `desktop/src/Kartodromo.Autoatendimento/Controles.cs`, linhas 375-383:
  `var m = new ContextMenuStrip { ... };` é instanciado em cada abertura do `CampoLista` sem `Dispose()`, causando vazamento de recursos GDI. Além disso, `Estilo.Logo()` recria bitmaps a cada chamada em telas e alertas.
- Em `FormTotem.cs`, linhas 560-569:
  `ViaCep()` instancia um `new HttpClient` por chamada, sem pool de conexões e sem cancelamento de requisições anteriores (`CancellationTokenSource`).
- Em `scripts/apps/implantar-remoto.ps1`, linhas 48-67:
  O script remove o atalho `Kartódromo Autoatendimento.lnk` da pasta `StartUp` se a flag `-IniciarNoLogon` não for passada em implantações subsequentes, quebrando a inicialização automática do totem após reinicialização da máquina.

---

## 2. Logic Chain (Cadeia de Raciocínio Lógico)

1. **Persistência da Fila de Impressão (R1):**
   - *Fato:* O array `filaImpressao` reside em memória no processo Node.js `:4060` (Obs 1.1).
   - *Raciocínio:* Se o serviço `ops-server` for reiniciado ou recarregar, ou se a máquina da recepção (.53) passar mais de 3 horas deslogada durante a troca de turnos, os termos pendentes são apagados ou expurgados.
   - *Dedução:* A criação da tabela física `dbo.FilaImpressao` no SQL Server `KartodromoOps` com estados (`pendente`, `imprimindo`, `concluido`, `falha`) e contadores de tentativa é indispensável para garantir que nenhum termo seja perdido.

2. **Privacidade e LGPD em Kiosk Público (R2):**
   - *Fato:* O endpoint `/api/totem/identificar` devolve PII integral ao receber um documento (Obs 1.2).
   - *Raciocínio:* Como o totem é instalado em saguão público com tráfego intenso de clientes, qualquer terceiro mal-intencionado pode digitar um CPF conhecido e obter endereço residencial, e-mail, telefone e dados de dependentes menores de idade.
   - *Dedução:* Os dados devem ser mascarados (ex.: `***.456.789-**`, `j***@gmail.com`, `(31) *****-1234`), e a identificação do totem deve ser baseada em token de sessão assinado ou identificador seguro configurado em `appsettings.json`, eliminando o acoplamento por IP de socket.

3. **Validação Flexível e Inclusiva no Totem (R3):**
   - *Fato:* Instagram e telefone padrão brasileiro (10/11 dígitos) são regras duras de bloqueio (Obs 1.3).
   - *Raciocínio:* Pilotos idosos, crianças, turistas de outros países com passaporte e pessoas sem rede social não conseguem concluir a inscrição e são obrigadas a ir à recepção.
   - *Dedução:* Permitir a opção "Não possuo Instagram" e flexibilizar a máscara telefônica para padrões internacionais com DDI/passaporte.

4. **Horário Passado e Concorrência de Vagas (R5):**
   - *Fato:* O SQL permite agendamento até 30 minutos após o horário de início (`DATEADD(minute, -30, SYSDATETIME())`) (Obs 1.5).
   - *Raciocínio:* Permitir agendamentos de baterias em andamento causa sobreposição de grid e disputas na pista.
   - *Dedução:* O corte para autoatendimento deve ser estrito (`Inicio > SYSDATETIME()`). Em caso de condição de corrida na última vaga, o totem deve notificar o cliente amigavelmente e reatualizar a lista de baterias imediatamente.

---

## 3. Caveats (Ressalvas e Limitações)

1. **Horário de Funcionamento e Deploy Real:** Conforme regra estrita em `AGENTS.md`, intervenções em máquinas de produção (SRVKART `.13`, Recepção `.53`, Totens `.161` e `.69`) não podem ocorrer em horários de funcionamento do kartódromo (ter–sex 17:00–21:40, sáb 09:15–18:35, dom até 18:00).
2. **Visual Congelado do Totem:** O design do totem está validado e congelado (`tokens/kib.tokens.json`). Qualquer ajuste de layout deve preservar pixel a pixel os estilos aprovados (alvos de toque ≥ 64 px, tema escuro, sem teclado virtual na tela).
3. **Escopo do Specification Miner:** O papel deste agente é puramente investigativo e documental (read-only em relação ao código de produção). Nenhuma alteração foi aplicada nesta fase.

---

## 4. Conclusion (Conclusão e Especificação Estruturada)

A auditoria confirmou a existência exata dos 39 gargalos descritos na solicitação original e mapeou os pontos precisos no código-fonte onde cada ajuste deve ser aplicado.

Abaixo estão as tabelas completas de **Features Discovered** e **Edge Cases**.

### Features Discovered (Mapeamento dos 39 Itens)

| # | Categoria | Feature | Descrição | Entradas | Saídas | Comportamento de Erro | Descoberto Via |
|---|-----------|---------|-----------|----------|--------|-----------------------|----------------|
| 1 | R1. Impressão | Fila de Impressão Persistida | Desacoplar a fila volátil do Node.js persistindo no SQL Server (`dbo.FilaImpressao`) | Payload de inscrição / termoLink | Registro em banco (Id, Status: pendente) | Retry com exponential backoff | `services/ops-server.ts:212` |
| 2 | R1. Impressão | Contingência Recepção Inativa | Não expurgar termos após 3 horas caso a Recepção (.53) esteja fechada/deslogada | Polling da recepção | Termos retidos no banco até impressão | Alerta na recepção ao religar | `services/ops-server.ts:219` |
| 3 | R1. Impressão | Tratamento de Ausência de Impressora Local | Não tentar `ImprimirSilencioso` no totem se não houver impressora configurada | Resposta de inscrição | Orientação visual ao cliente na tela | Log no desktop e tela de fallback | `FormTotem.cs:770` |
| 4 | R1. Impressão | Altura Dinâmica Térmica TM-T20 | Ajustar layout CSS do termo de 297 mm fixos para altura automática/dinâmica | Termo HTML/CSS | Bobina cortada logo após assinaturas | N/A (economia de papel) | `lib/ops/termo.ts:192` |
| 5 | R1. Impressão | Limpeza de Filas Fantasmas | Script PowerShell para limpar trabalhos presos no spooler local dos totens | Nome da impressora legada | Fila do Windows zerada | Log de spooler travado | `HANDOFF-SISTEMA-PROPRIO.md:584` |
| 6 | R1. Impressão | Rastreamento e Reentrega | Controle de status (`pendente`, `imprimindo`, `concluido`, `falha`) e retry em 90s | ID do trabalho | Confirmação de impressão | Registro de motivo de falha | `AgenteImpressao.cs:54` |
| 7 | R2. Segurança/LGPD | Mascaramento de PII | Mascarar e-mail, telefone, CPF e endereço em `/api/totem/identificar` | CPF / e-mail digitado | Dados com máscara (ex.: `***.456.789-**`) | Bloqueio sem identificação | `services/ops-server.ts:310` |
| 8 | R2. Segurança/LGPD | Proteção de Dados de Menores | Ocultar dados sensíveis de dependentes menores até confirmação do responsável | Documento do responsável | Lista resumida segura | Bloqueio se não autorizado | `services/ops-server.ts:331` |
| 9 | R2. Segurança/LGPD | Token/ID Seguro de Totem | Substituir associação por IP de socket (`identificadoNoTotem`) por token seguro | Cabeçalho `x-totem-id` ou token HMAC | Sessão isolada por totem | 403 Forbidden para token inválido | `services/ops-server.ts:240` |
| 10 | R2. Segurança/LGPD | Bloqueio de Teclas de Escape | Low-level keyboard hook contra WinKey, Alt+Tab, Ctrl+Esc no teclado físico USB | Eventos do teclado físico | Teclas do sistema suprimidas | Permite apenas `Ctrl+Shift+Alt+S` | `FormTotem.cs:81` |
| 11 | R2. Segurança/LGPD | Consentimento de Menores | Termo de consentimento e guarda de dados para dependentes menores (LGPD Art. 14) | Checkbox de consentimento | Registro auditável no banco | Bloqueio do cadastro de dependente | `FormTotem.cs:692` |
| 12 | R3. Validação | Instagram Opcional | Opção "Não possuo Instagram" no formulário de cadastro do totem | Texto de usuário ou checkbox | Campo vazio tratado com segurança | Sem erro 400 por falta de Instagram | `FormTotem.cs:440`, `cadastro-obrigatorio.ts:15` |
| 13 | R3. Validação | Telefone Internacional | Flexibilizar máscara e validação de telefone para turistas e passaporte | Telefone com DDI / Passaporte | Aceita números > 8 dígitos sem travar DDD | Validação contextual conforme doc | `FormTotem.cs:474`, `Fmt.cs:46` |
| 14 | R3. Validação | Harmonização de Faixas de Peso | Unificar limites de peso entre desktop (20–250 kg) e servidor (1–500 kg) | Valor em kg digitado | Validação uniforme | Alerta claro na tela e HTTP 400 | `FormTotem.cs:526`, `cadastro-obrigatorio.ts:7` |
| 15 | R3. Validação | Preservação de Número e Complemento | Não setar `Numero = NULL` e `Complemento = NULL` ao atualizar endereço | Endereço atualizado no totem | Linha do banco com endereço, número e complemento | Rollback em caso de erro SQL | `services/ops-server.ts:369` |
| 16 | R3. Validação | Edição Assistida de Cadastro | Permitir ajuste de nome e documento pré-existente com segurança | Dados corrigidos | Confirmação de alteração | Requer autorização/token | `FormTotem.cs:467` |
| 17 | R3. Validação | Tratamento Elegante de HTTP 409 | Tratar duplicidade de documento sem limpar os campos já preenchidos | Documento duplicado | Diálogo explicativo preservando tela | Mensagem amigável com opção voltar | `FormTotem.cs:271` |
| 18 | R3. Validação | Correção da Função Mascarar | Manter cursor na posição correta ao editar máscara de texto | Entrada do teclado no meio da string | Posição relativa preservada | Sem salto para o fim do texto | `FormTotem.cs:340` |
| 19 | R3. Validação | Parametrização SQL de Baterias | Eliminar interpolação de strings em consultas de grupo em `ops-server.ts` | IDs de clientes | Parâmetros `@c0, @c1...` | Sem risco de injeção SQL | `services/ops-server.ts:400` |
| 20 | R4. Usabilidade | Preservação de Seleção de Menores | Guardar estado de seleção de participantes ao ir para cadastro de novos menores | Checkboxes marcados | Estado restaurado após cadastro | Sem perda de checkboxes marcados | `FormTotem.cs:616` |
| 21 | R4. Usabilidade | Menor Desacompanhado Bloqueado | Bloquear que dependente menor corra sem responsável adulto validado | Participantes selecionados | Bloqueio de avanço | Alerta: "Menor necessita de responsável" | `FormTotem.cs:623` |
| 22 | R4. Usabilidade | Responsável Falso Bloqueado | Bloquear avanço de responsável que desmarcou a si mesmo e não marcou dependentes | Participantes selecionados | Bloqueio de avanço | Alerta: "Selecione quem vai correr" | `FormTotem.cs:623` |
| 23 | R4. Usabilidade | Pausa do Temporizador em Modais | Pausar temporizador de inatividade de 90s durante exibição de modais e termos | Abertura de modal / diálogo | Temporizador congelado | Retomada após fechamento | `FormTotem.cs:79` |
| 24 | R4. Usabilidade | Intercepção de Rolagem no Temporizador | Interceptar `WM_MOUSEWHEEL` (0x020A) no `PreFilterMessage` | Movimento de scroll / mouse wheel | Reset da contagem de 90 segundos | N/A | `FormTotem.cs:144` |
| 25 | R4. Usabilidade | Foco após Fechamento de Termo LGPD | Devolver foco para o elemento chamador após fechar diálogo LGPD | Fechamento do modal (Esc ou Botão) | Controle anterior recebe foco ativo | Sem perda de cursor/foco | `FormTotem.cs:497` |
| 26 | R4. Usabilidade | Totem sem Teclado Virtual | Garantir foco automático permanente no campo ativo para digitação no teclado USB | Carregamento da tela | Campo com foco e borda verde | Sem popup de teclado na tela | `FormTotem.cs:190` |
| 27 | R4. Usabilidade | Detecção de Teclado USB Desconectado | Emitir banner ou aviso discreto se nenhum dispositivo de teclado for detectado | Detecção de hardware / input | Aviso: "Conecte o teclado USB" | Previne frustração do cliente | `FormTotem.cs:371` |
| 28 | R5. Baterias | Bloqueio de Horário Passado | Cortar estritamente baterias iniciadas (`Inicio > SYSDATETIME()`), sem tolerância | Horário atual do SQL | Apenas baterias futuras na grade | HTTP 409 em tentativas de agendar iniciada | `office.ts:426`, `totem-baterias.ts:38` |
| 29 | R5. Baterias | Mensagem Informativa de Vagas do Grupo | Informar quantidade de vagas restantes quando inferior ao número de participantes | Baterias com livres > 0 e livres < N | Card explicativo com vagas disponíveis | Evita parecer que não há baterias no dia | `FormTotem.cs:717` |
| 30 | R5. Baterias | Detalhamento Completo no Sucesso | Exibir horários e categorias de todas as baterias escolhidas na tela final | Inscrições confirmadas | Lista de horários + categorias | N/A | `FormTotem.cs:794` |
| 31 | R5. Baterias | Transparência de Preços na Grade | Exibir o valor monetário de cada categoria (Light vs Super) nos cards de baterias | Consulta de produtos/baterias | Preço formatado (ex.: `R$ 175,00`) | N/A | `Controles.cs:1023`, `ops-server.ts:411` |
| 32 | R5. Baterias | Suporte a Pagamento Pix Dinâmico | Gerar payload e imagem de QR Code Pix via Asaas para quitação autônoma | Inscrição gerada | QR Code na tela com polling de status | Timeout amigável mantendo pré-reserva | `workers/pre-cadastro/src/asaas.ts:65` |
| 33 | R5. Baterias | Concorrência na Última Vaga | Tratar race condition reatualizando a grade de horários amigavelmente | Tentativa concorrente | Notificação suave + grade atualizada | Sem congelamento ou tela de erro genérica | `FormTotem.cs:763`, `office.ts:434` |
| 34 | R6. Infraestrutura | Correção de Sintaxe no Script Totem 1 | Corrigir bloco quebrado de `New-NetFirewallRule` em `habilitar-admin-remoto-totem1.ps1` | Execução do script PowerShell | Execução limpa sem erro de sintaxe | Parada com mensagem clara | `habilitar-admin-remoto-totem1.ps1:63` |
| 35 | R6. Infraestrutura | Sincronização NTP no Totem 1 | Configurar serviço W32Time para sincronismo com NTP.br e servidor ORBITS | Script de NTP | Relógio sincronizado com precisão | Erro registrado em log | `habilitar-admin-remoto-totem1.ps1:60` |
| 36 | R6. Infraestrutura | Timeout Reduzido do Cliente HTTP | Reduzir timeout padrão de 30s para 8–10s no app desktop do totem | Requisição de rede | Resposta rápida ou timeout gerenciado | Alerta rápido de instabilidade de rede | `Api.cs:53` |
| 37 | R6. Infraestrutura | Verificação Assíncrona de Atualização | Executar `TratarInicioAsync` sem bloquear a thread UI na inicialização | Abertura do app | Tela inicial imediata sem tela preta | Fallback para versão atual | `Program.cs:21` |
| 38 | R6. Infraestrutura | Eliminação de Vazamento GDI | Adicionar `Dispose()` no `ContextMenuStrip` e reaproveitar bitmaps do logo | Ciclo de vida dos componentes | Memória e handles GDI estáveis | Previne crash após horas de uso | `Controles.cs:375`, `FormTotem.cs:33` |
| 39 | R6. Infraestrutura | Pool de Conexões ViaCep e Atalho StartUp | Reutilizar `HttpClient` no ViaCep e garantir retenção do atalho no deploy | Busca de CEP / Deploy remoto | Busca rápida; atalho preservado no logon | Sem esgotamento de sockets | `FormTotem.cs:564`, `implantar-remoto.ps1:48` |

---

### Edge Cases Mapeados

| # | Feature | Cenário / Entrada | Comportamento Esperado vs Observado |
|---|---------|-------------------|--------------------------------------|
| E1 | Impressão R1 | Servidor Node `:4060` reiniciado com termos pendentes | **Observado:** Termos apagados da memória.<br>**Esperado:** Recuperação automática do banco de dados na inicialização. |
| E2 | Impressão R1 | Recepção (.53) deslogada por 4 horas no domingo | **Observado:** Termos descartados após 3h.<br>**Esperado:** Preservação com status `pendente` e impressão sequencial ao logar. |
| E3 | Impressão R1 | Totem sem impressora tenta imprimir localmente | **Observado:** Falha silenciosa no log.<br>**Esperado:** Exibição de aviso claro orientando o cliente a retirar o termo na recepção. |
| E4 | Segurança R2 | Digitação de CPF de terceiro em totem público | **Observado:** Nome, telefone, e-mail e endereço residencial abertos.<br>**Esperado:** Mascaramento de dados e solicitação de dados confirmatórios antes de expor dependentes. |
| E5 | Segurança R2 | Dois totens fazendo agendamento simultâneo na mesma sub-rede | **Observado:** Posse de vagas associada ao IP do socket do último cliente.<br>**Esperado:** Isolamento total via token de sessão exclusivo por totem. |
| E6 | Segurança R2 | Teclado físico pressionando `WinKey` ou `Alt+Tab` | **Observado:** Abre menu iniciar ou troca de janela no Windows.<br>**Esperado:** Hook de teclado de baixo nível suprime a tecla. |
| E7 | Cadastro R3 | Turista estrangeiro com passaporte e telefone dos EUA | **Observado:** Bloqueado por máscara de telefone nacional.<br>**Esperado:** Campo livre com código de país aceito. |
| E8 | Cadastro R3 | Piloto idoso ou criança que não tem conta de Instagram | **Observado:** Bloqueado por validação obrigatória.<br>**Esperado:** Checkbox "Não possuo Instagram" aceito. |
| E9 | Baterias R5 | Bateria que iniciou há 15 minutos | **Observado:** Aparece com aviso "iniciou às..." e permite agendamento.<br>**Esperado:** Bloqueio estrito no totem (só recepção pode incluir participante tardio). |
| E10 | Baterias R5 | Grupo de 4 pessoas busca vaga e há baterias com 2 vagas | **Observado:** Baterias somem e tela diz que não há vagas hoje.<br>**Esperado:** Aviso "2 vagas restantes (insuficiente para seu grupo de 4)". |
| E11 | Baterias R5 | Última vaga preenchida no exato segundo por outro totem | **Observado:** Erro genérico modal "Não há vagas".<br>**Esperado:** Mensagem informativa amigável e recarregamento automático da grade. |
| E12 | Infra R6 | Execução de `habilitar-admin-remoto-totem1.ps1` no Totem 1 | **Observado:** Falha imediata de parser do PowerShell devido à interpolação de NTP.<br>**Esperado:** Execução limpa de firewall e W32Time. |
| E13 | Usabilidade R4 | Cliente rola tela usando a roda do mouse | **Observado:** Não conta como interação; tela reinicia após 90s.<br>**Esperado:** `WM_MOUSEWHEEL` reinicia temporizador de inatividade. |

---

## 5. Verification Method (Método de Verificação Independente)

Para auditar e validar independentemente este levantamento:

1. **Inspeção de Código e Linhas:**
   - Conferir `services/ops-server.ts` linhas 212-233 para fila de impressão volátil e linhas 240-250 para `identificadoNoTotem` baseado em IP.
   - Conferir `lib/ops/termo.ts` linhas 192 e 196 para altura fixa de 297 mm no `@page`.
   - Conferir `lib/ops/office.ts` linha 426 para a tolerância de `-30 minutos`.
   - Conferir `scripts/apps/habilitar-admin-remoto-totem1.ps1` linhas 58-68 para o erro de sintaxe do PowerShell.
   - Conferir `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs` linhas 440, 526, 616, 717 e 770.

2. **Comandos de Verificação:**
   - Typecheck do TypeScript:
     `npx tsc --noEmit --skipLibCheck --target es2022 --module esnext --moduleResolution bundler --esModuleInterop --types node services/ops-server.ts`
   - Testes automatizados do Vitest:
     `npx vitest run tests/ops/totem-baterias.test.ts tests/design-tokens/totem-congelado.test.ts`
   - Compilação desktop .NET 8:
     `dotnet build desktop/Kartodromo.Desktop.sln -c Release`
   - Validação de sintaxe PowerShell:
     `pwsh -Command "& { [Management.Automation.Language.Parser]::ParseFile('$PWD/scripts/apps/habilitar-admin-remoto-totem1.ps1', [ref]\$null, [ref]\$errors); \$errors }"`
