# Relatório de Handoff — Exploração Técnica Totem WinForms M3 (R3: Itens 12 a 19)

## 1. Observation

### Item 12: Instagram Opcional / Opção Explícita
- **`desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`**:
  - Linha 453-454: Campo de Instagram criado em `TelaCadastro`:
    ```csharp
    var fInstagram = Campo(campos, "Instagram do piloto (@usuário)", xs[0], 324, cw * 2 + 16, _cliente.S("instagram"));
    fInstagram.Caixa.PlaceholderText = "@andre.silva";
    ```
  - Linha 473: Campo adicionado forçadamente à lista de obrigatórios:
    ```csharp
    Obrigatorio(fInstagram, "Instagram do piloto (@usuário)", true);
    ```
  - Linha 477: Rodapé informa:
    ```csharp
    c.Controls.Add(Rot("* Campos obrigatórios · Instagram será usado no resultado e no pódio", 90, 624, F(14), Estilo.MuitoSuave));
    ```
  - Linhas 535-536: Validação do botão Próximo rejeita campo vazio:
    ```csharp
    foreach (var (campoObrig, rotuloObrig) in obrigatorios)
        if (campoObrig.Text.Trim().Length == 0 && campoObrig != fNasc) { Alertar($"Preencha o campo {rotuloObrig}."); campoObrig.Caixa.Focus(); return; }
    ```
  - Linha 703 (`TelaNovoMenor`): Rótulo com asterisco fixo:
    ```csharp
    var instagram = Campo(campos, "Instagram do piloto (@usuário) *", xs[0], 324, cw * 2 + 16);
    ```
  - Linha 741-742 (`TelaNovoMenor`): Loop de obrigatoriedade contém o Instagram:
    ```csharp
    foreach (var (campo, rotulo) in new[] { (email, "E-mail"), (fone, "Celular (WhatsApp)"), (nasc, "Data de nascimento"), (peso, "Peso (kg)"), (end, "Endereço"), (bairro, "Bairro"), (cidade, "Cidade"), (instagram, "Instagram do piloto (@usuário)") })
        if (campo.Text.Trim().Length == 0) { Alertar($"Preencha o campo {rotulo}."); campo.Caixa.Focus(); return; }
    ```
- **`desktop/src/Kartodromo.Comum/ValidacaoCliente.cs`**:
  - Linha 19: `if (string.IsNullOrWhiteSpace(instagram)) return null; // Instagram é opcional` já implementa Instagram opcional.
- **`lib/ops/instagram.ts`**:
  - Linha 12: `if (!usuario) return null;` já aceita ausência de Instagram no backend.

---

### Item 13: Telefone Internacional / Turistas com Passaporte
- **`desktop/src/Kartodromo.Comum/Fmt.cs`**:
  - Linhas 46-55:
    ```csharp
    public static string MascaraFone(string v)
    {
        var d = Digitos(v);
        if (d.Length > 11) d = d[..11];
        if (d.Length == 0) return "";
        if (d.Length <= 2) return $"({d}";
        if (d.Length <= 6) return $"({d[..2]}) {d[2..]}";
        if (d.Length <= 10) return $"({d[..2]}) {d[2..6]}-{d[6..]}";
        return $"({d[..2]}) {d[2..7]}-{d[7..]}";
    }
    ```
    - `Digitos(v)` remove o prefixo `+`.
    - Trunca em 11 caracteres (`if (d.Length > 11) d = d[..11]`), destruindo números internacionais E.164 (até 15 dígitos).
    - Força a máscara brasileira de DDD `(XX) XXXXX-XXXX`.
- **`desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`**:
  - Linhas 487 e 717: `Mascarar(fFone.Caixa, Fmt.MascaraFone);` e `Mascarar(fone.Caixa, Fmt.MascaraFone);` ativam a máscara brasileira cegamente.
  - Linhas 532, 551, 744:
    ```csharp
    if (Fmt.Digitos(fFone.Text).Length < 10) { Alertar("O número de telefone é obrigatório."); return; }
    if (fFone.Text.Trim().Length > 0 && Fmt.Digitos(fFone.Text).Length < 10) { Alertar("Número de telefone inválido."); return; }
    if (Fmt.Digitos(fone.Text).Length < 10) { Alertar("Número de telefone inválido."); fone.Caixa.Focus(); return; }
    ```
    - Exige estritamente no mínimo 10 dígitos, sem suporte a números internacionais de países com 7 a 9 dígitos ou flexibilização para passaporte.
- **`desktop/src/Kartodromo.Comum/ValidacaoCliente.cs`**:
  - Não possui método unificado `ErroTelefone`.

---

### Item 14: Faixa de Peso no Totem (10–250 kg)
- **`desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`**:
  - Linhas 539-540 (`TelaCadastro`):
    ```csharp
    var pesoTxt = fPeso.Text.Trim().Replace(',', '.');
    if (pesoTxt.Length > 0 && (!double.TryParse(pesoTxt, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var kg) || kg < 20 || kg > 250))
    { Alertar("Peso inválido. Suba na balança ao lado e digite o peso em kg (ex.: 78,5)."); fPeso.Caixa.Focus(); return; }
    ```
    - **Divergência Crítica**: valida `kg < 20`, bloqueando pesos entre 10 e 19.9 kg!
  - Linhas 750-751 (`TelaNovoMenor`):
    ```csharp
    var pesoTxt = peso.Text.Trim().Replace(',', '.');
    if (!double.TryParse(pesoTxt, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var kg) || kg < 10 || kg > 250)
    { Alertar("Peso inválido. Digite o peso em kg (ex.: 38,5)."); peso.Caixa.Focus(); return; }
    ```
    - Na tela do menor valida `kg < 10`.
- **`desktop/src/Kartodromo.Comum/ValidacaoCliente.cs`**:
  - Linha 39: `double.IsFinite(kg) && kg >= 10 && kg <= 250` (10–250 kg).
- **`lib/ops/cadastro-obrigatorio.ts`**:
  - Linha 7: `Number.isFinite(valor) && valor >= 10 && valor <= 250` (10–250 kg).

---

### Item 16: Edição Assistida de Cadastro (Nome e Documento de Cliente Existente)
- **`desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`**:
  - Linhas 478-482 (`TelaCadastro` quando `existente == true`):
    ```csharp
    if (existente)
    {
        reg.Enabled = tipo.Enabled = fDoc.Enabled = fNome.Enabled = false;
        if (fDoc.Text.Length == 0) fDoc.Text = "(já cadastrado)";
    }
    ```
    - Bloqueia permanentemente os campos `tipo`, `fDoc` e `fNome`.
  - Linhas 525-534 (`TelaCadastro` submit):
    ```csharp
    if (!existente)
    {
        var tipoDoc = tipo.SelectedIndex switch { 0 => "CPF", 1 => "RG", _ => "PASSAPORTE" };
        var nome = string.Join(' ', fNome.Text.Split(' ', StringSplitOptions.RemoveEmptyEntries));
        if (fDoc.Text.Trim().Length == 0) { Alertar("O documento é obrigatório."); return; }
        if (tipoDoc == "CPF" && !Fmt.CpfValido(fDoc.Text)) { Alertar("CPF inválido."); return; }
        if (nome.Split(' ').Length < 2) { Alertar("Informe o nome completo."); return; }
        if (Fmt.Digitos(fFone.Text).Length < 10) { Alertar("O número de telefone é obrigatório."); return; }
        dados["tipoDocumento"] = tipoDoc; dados["documento"] = fDoc.Text.Trim(); dados["nome"] = nome;
    }
    ```
    - Quando `existente == true`, `dados["nome"]`, `dados["documento"]` e `dados["tipoDocumento"]` nunca são populados nem enviados para a API!
- **`services/ops-server.ts`**:
  - Linhas 561-570 e 585: o backend já aceita alteração de `Nome` e `Documento` na atualização de cliente se não contiverem máscara `*`.

---

### Item 17: Tratamento Elegante de HTTP 409
- **`services/ops-server.ts`**:
  - Linhas 596-597:
    ```ts
    const dup = await one<{ id: number }>(`SELECT TOP 1 Id id FROM dbo.Cliente WHERE DocumentoNum = @d`, { d: onlyDigits(dados.documento) });
    if (dup) throw new HttpError(409, 'Já existe cadastro com esse documento. Volte e informe o documento para continuar.');
    ```
- **`desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`**:
  - Linhas 272-293 (`ExecutarAcaoBotao`): captura a exceção genérica e exibe o alerta:
    ```csharp
    catch (Exception e)
    {
        Alertar(e is ApiException ? e.Message : "Ocorreu um erro. Por favor, procure a recepção.");
        Program.Log("erro: " + e);
        return false;
    }
    ```
  - Linha 513: botão Voltar reinicia todo o totem chamando `Reiniciar()`, descartando tudo:
    ```csharp
    Botao(c, "Voltar", 958, 644, 140, false, () => { Reiniciar(); return Task.CompletedTask; });
    ```
  - Não há foco em `fDoc.Caixa` após 409 e não há opção de transição assistida para identificação sem perda dos campos digitados (peso, telefone, endereço, etc.).

---

### Item 18: Correção do Cursor em Máscaras
- **`desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`**:
  - Linhas 343-354:
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
    - **DEFEITO CRÍTICO**: Linha 351 força `t.SelectionStart = novo.Length;`. A cada tecla pressionada no meio do campo, o cursor salta para o fim do texto!
- **`desktop/src/Kartodromo.Comum/Ui.cs`**:
  - Linhas 236-284: `Campos.CalcularCursorMascara` e `Campos.Mascara` já implementam o algoritmo canônico que preserva a posição do cursor contando caracteres alfanuméricos anteriores.

---

## 2. Logic Chain

1. **Item 12 (Instagram Opcional)**:
   - *Observação*: `ValidacaoCliente.ErroInstagram` (linha 19) e `instagram.ts` (linha 12) consideram Instagram opcional. Mas `FormTotem.cs` linhas 473 e 741 forçam obrigatoriedade.
   - *Dedução*: A restrição é puramente artificial na UI do Totem.
   - *Ação necessária*: Remover `Obrigatorio(fInstagram, ...)` na linha 473 e retirar de `TelaNovoMenor` (linha 741). Adicionar opção gráfica "Não possuo Instagram" (`Marcador`) na coluna `xs[2]`, y=340 de `TelaCadastro` e em `TelaNovoMenor`.

2. **Item 13 (Telefone Internacional / Turistas)**:
   - *Observação*: `Fmt.MascaraFone` (linha 48) trunca em 11 caracteres e limpa o `+`. `FormTotem.cs` (linhas 532, 551, 744) exige `>= 10` dígitos.
   - *Dedução*: Turistas com passaporte e números internacionais (+1, +351, etc.) não conseguem digitar seu telefone e são barrados.
   - *Ação necessária*: Ajustar `Fmt.MascaraFone` para aceitar `+` e até 15 dígitos sem máscara DDD. Criar `ValidacaoCliente.ErroTelefone(telefone, tipoDoc)` que aceita 7–15 dígitos se internacional/passaporte. Ajustar `FormTotem.cs` para chamar `ErroTelefone` e mudar placeholder para passaporte.

3. **Item 14 (Faixa de Peso 10–250 kg)**:
   - *Observação*: Linha 539 de `FormTotem.cs` exige `kg >= 20` para adultos, enquanto `ValidacaoCliente.ErroPeso` e o backend (`cadastro-obrigatorio.ts`) exigem `kg >= 10`.
   - *Dedução*: Há inconsistência entre telas e camadas do sistema; pilotos entre 10 e 19.9 kg são indevidamente rejeitados em `TelaCadastro`.
   - *Ação necessária*: Substituir as validações inline de peso em `FormTotem.cs` (linhas 539 e 750) por chamadas a `ValidacaoCliente.ErroPeso(fPeso.Text)`.

4. **Item 16 (Edição Assistida)**:
   - *Observação*: Linha 480 de `FormTotem.cs` desabilita `fNome` e `fDoc`. Linhas 525-534 sequer enviam `nome` ou `documento` quando `existente == true`.
   - *Dedução*: O cliente pré-existente fica impossibilitado de corrigir erros de digitação no nome ou documento pelo totem.
   - *Ação necessária*: Permitir edição de `fNome` (com validação de nome completo). Disponibilizar botão/link de ajuste seguro para `fDoc` e `tipo`. No submit, enviar `nome`, `documento` e `tipoDocumento` para `POST /api/totem/cadastro` se alterados.

5. **Item 17 (Tratamento Elegante de 409)**:
   - *Observação*: Ao tentar cadastrar documento já existente, o servidor retorna HTTP 409. O totem exibe alerta genérico e não foca o campo; clicar em Voltar reinicia e apaga tudo.
   - *Dedução*: O usuário perde tempo e digitação se errar um dígito ou já tiver cadastro.
   - *Ação necessária*: Tratar `ApiException` com status 409 no submit de `TelaCadastro` e `TelaNovoMenor`: manter todos os campos preenchidos, focar `fDoc.Caixa` (ou `doc.Caixa`), orientar o cliente e oferecer carregamento do cadastro existente mantendo dados recém-preenchidos (como peso).

6. **Item 18 (Correção do Cursor)**:
   - *Observação*: Linha 351 de `FormTotem.cs` faz `t.SelectionStart = novo.Length;`, ignorando a posição original de digitação.
   - *Dedução*: Isso causa o salto indevido do cursor para o final do texto ao editar caracteres no meio do campo.
   - *Ação necessária*: Redefinir `Mascarar` em `FormTotem.cs` para utilizar `Campos.CalcularCursorMascara` de `Ui.cs` ou chamar diretamente `Campos.Mascara(t, f)`.

---

## 3. Caveats

- **Autoteste do Totem**:
  - `FormTotem.cs` possui o método `RenderizarTelas` nas resoluções 1366x768 e 1920x1080 (linhas 988-991). Quaisquer controles adicionados (como o checkbox de Instagram opcional ou link de edição assistida) devem respeitar as coordenadas da grade e o fator de escala `_k` (`P(...)`, `F(...)`), evitando colisões de layout.
- **Design Tokens**:
  - Conforme `tests/design-tokens/totem-congelado.test.ts` e `lint-hardcode.test.ts`, nenhuma cor literal (ex.: `Color.FromArgb(r,g,b)`) pode ser introduzida em `Controles.cs` ou `FormTotem.cs`. Deve-se utilizar `Estilo.*` ou `Tokens.Escuro.*`.
- **Regras do Dono (AGENTS.md)**:
  - O Totem opera sem teclado virtual na tela (`Focus()` sempre garantido para digitação no teclado físico USB).
  - Nunca alterar `FormTV.cs`.

---

## 4. Conclusion

As falhas dos Itens 12, 13, 14, 16, 17 e 18 no Totem WinForms decorrem de divergências locais em `FormTotem.cs` e `Fmt.cs`:
1. **Item 12**: Apenas remover o `Obrigatorio(fInstagram)` no Totem, adicionar `Marcador` para "Não possuo Instagram" e atualizar textos.
2. **Item 13**: Ajustar `Fmt.MascaraFone` para suportar E.164 (`+` com até 15 dígitos) e adicionar `ValidacaoCliente.ErroTelefone`.
3. **Item 14**: Unificar a validação de peso de `FormTotem.cs` delegando a `ValidacaoCliente.ErroPeso` (10–250 kg).
4. **Item 16**: Habilitar a edição de nome e ajuste assistido de documento para clientes existentes, garantindo o envio dos campos na payload.
5. **Item 17**: Capturar HTTP 409 especificamente, preservando os campos preenchidos e direcionando o foco para o documento.
6. **Item 18**: Substituir o reposicionamento cego do cursor na linha 351 de `FormTotem.cs` pelo algoritmo `Campos.CalcularCursorMascara`.

O Worker pode aplicar essas correções de forma cirúrgica e segura sem quebrar o design system congelado nem o autoteste visual.

---

## 5. Verification Method

Para o Worker validar de forma independente:

1. **Checagem de Tipos TypeScript**:
   ```bash
   npx tsc --noEmit
   ```
2. **Execução dos Testes Automatizados**:
   ```bash
   npx vitest run
   ```
3. **Auditoria de Integridade dos Arquivos Modificados**:
   - `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`
   - `desktop/src/Kartodromo.Comum/Fmt.cs`
   - `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs`
   - Inspecionar visualmente se `Campos.CalcularCursorMascara` é chamado em `FormTotem.cs`.
   - Garantir que não há cores literais soltas (`Color.FromArgb`) adicionadas.
4. **Condições de Invalidação**:
   - Se `FormTotem.cs` ainda contiver `kg < 20`, o item 14 falha.
   - Se `Mascarar` em `FormTotem.cs` ainda contiver `t.SelectionStart = novo.Length`, o item 18 falha.
   - Se digitar número com `+` e o `+` for removido, o item 13 falha.
   - Se deixar Instagram em branco no Totem e o cadastro for bloqueado, o item 12 falha.
