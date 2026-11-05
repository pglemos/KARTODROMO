# Relatório de Investigação Técnica — Milestone M3: Validação de Dados e Cadastro no Totem (Itens 12 a 19)

**Data**: 2026-10-27  
**Subagente**: Explorer M3 (teamwork_preview_explorer)  
**Escopo**: Backend (Node.js/TypeScript) e Banco de Dados (SQL Server) para o Autoatendimento (Totem)  
**Arquivos Inspecionados**:
- `services/ops-server.ts`
- `lib/ops/cadastro-obrigatorio.ts`
- `lib/ops/instagram.ts`
- `lib/ops/totem-baterias.ts`
- `lib/ops/db.ts`
- `tests/ops/*`
- `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs` (para validação de contratos e paridade)
- `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs`

---

## 1. Observation (O que foi diretamente observado)

### 1.1 Item 12: Instagram Opcional no POST /api/totem/cadastro
- **Arquivo**: `lib/ops/instagram.ts` (linhas 10 a 16)
  ```typescript
  export function erroInstagramCliente(value: unknown): string | null {
    const usuario = String(value ?? '').trim();
    if (!usuario) return null;
    const perfil = normalizarInstagram(usuario);
    return /^@[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(perfil) && !perfil.includes('..')
      ? null : 'Instagram inválido. Informe o @usuário do piloto (ex.: @andre.silva).';
  }
  ```
  Observação: `erroInstagramCliente` já retorna `null` para strings vazias, nulas ou compostas apenas de espaços em branco.
- **Arquivo**: `lib/ops/cadastro-obrigatorio.ts` (linhas 11 a 16)
  ```typescript
  export function erroCadastroObrigatorio(dados: { email?: unknown; peso?: unknown; instagram?: unknown }): string | null {
    const email = String(dados.email ?? '').trim();
    if (!email) return 'O e-mail é obrigatório.';
    if (email.length > 200 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'E-mail inválido. Informe um e-mail válido.';
    return erroPesoCliente(dados.peso) ?? erroInstagramCliente(dados.instagram);
  }
  ```
  Observação: Não há menção ou tratamento explícito para o campo `semInstagram?: boolean`.
- **Arquivo**: `lib/ops/db.ts` (linhas 98 a 125 e 151 a 166)
  - `ClienteInput` não possui a propriedade `semInstagram?: boolean`.
  - Em `clienteColumns(input: ClienteInput, partial: boolean)` (linha 154):
    ```typescript
    const set = (col: string, value: unknown) => {
      if (partial && (value === null || value === undefined || value === '')) return;
      out[col] = value === '' ? null : value;
    };
    ```
    Quando `partial = true` (utilizado no update de cliente no Totem, `ops-server.ts:585`), se `input.instagram` for `''` ou `null`, a coluna `Instagram` é ignorada e **não é atualizada** no banco de dados! Consequentemente, um cliente pré-existente que possuía Instagram e optar por "Não possuo Instagram" no totem permanecerá com o Instagram antigo no banco de dados.

### 1.2 Item 13: Validação de Telefone Internacional no Backend
- **Arquivo**: `services/ops-server.ts` (linha 595)
  ```typescript
  if (!responsavelId) {
    if (!dados.telefone || onlyDigits(dados.telefone).length < 10) throw new HttpError(400, 'O número de telefone é obrigatório.');
    const dup = await one<{ id: number }>(`SELECT TOP 1 Id id FROM dbo.Cliente WHERE DocumentoNum = @d`, { d: onlyDigits(dados.documento) });
    if (dup) throw new HttpError(409, 'Já existe cadastro com esse documento. Volte e informe o documento para continuar.');
  }
  ```
  Observação:
  1. A validação exige estritamente `onlyDigits(dados.telefone).length >= 10`.
  2. Turistas estrangeiros identificados com passaporte (`tipoDocumento === 'PASSAPORTE'` ou telefone com prefixo `+`) de países cujo número de telefone tem menos de 10 dígitos (segundo o padrão ITU-T E.164, telefones internacionais podem ter de 7 a 15 dígitos) são incorretamente rejeitados com o erro `'O número de telefone é obrigatório.'`.
  3. No caso de atualização de cliente existente (`id` presente, linhas 558-589), `dados.telefone` não passa por nenhuma validação de formato se alterado (apenas a checagem de máscara `***` para não sobrescrever).
  4. Não há diferenciação entre telefone não preenchido e formato inválido (ex.: presença de caracteres alfabéticos não numéricos).

### 1.3 Item 14: Harmonização de Peso no Backend (`erroPesoCliente`)
- **Arquivo**: `lib/ops/cadastro-obrigatorio.ts` (linhas 3 a 9)
  ```typescript
  export function erroPesoCliente(peso: unknown): string | null {
    const texto = String(peso ?? '').trim();
    if (!texto) return 'O peso é obrigatório. Informe o peso em kg.';
    const valor = Number(texto.replace(',', '.'));
    return Number.isFinite(valor) && valor >= 10 && valor <= 250
      ? null : 'Peso inválido. Informe um valor entre 10 e 250 kg.';
  }
  ```
- **Arquivo**: `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`
  - Linha 539 (cadastro titular / adulto):
    ```csharp
    var pesoTxt = fPeso.Text.Trim().Replace(',', '.');
    if (pesoTxt.Length > 0 && (!double.TryParse(pesoTxt, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var kg) || kg < 20 || kg > 250))
    { Alertar("Peso inválido. Suba na balança ao lado e digite o peso em kg (ex.: 78,5)."); fPeso.Caixa.Focus(); return; }
    ```
  - Linha 750 (cadastro dependente / menor):
    ```csharp
    if (!double.TryParse(pesoTxt, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var kg) || kg < 10 || kg > 250)
    { Alertar("Peso inválido. Digite o peso em kg (ex.: 38,5)."); peso.Caixa.Focus(); return; }
    ```
- **Arquivo**: `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs` (linhas 34 a 41)
  ```csharp
  public static string ErroPeso(string peso)
  {
      peso = peso?.Trim() ?? "";
      if (peso.Length == 0) return "O peso é obrigatório. Informe o peso em kg.";
      return double.TryParse(peso.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out var kg)
          && double.IsFinite(kg) && kg >= 10 && kg <= 250
          ? null : "Peso inválido. Informe um valor entre 10 e 250 kg.";
  }
  ```
  Observação: O backend aceita 10 a 250 kg indistintamente. Já o app desktop implementou uma verificação inline rígida de 20 a 250 kg para titulares adultos (rejeitando adultos com menos de 20 kg no frontend) e 10 a 250 kg para menores.

### 1.4 Item 15: Preservação de `Numero` e `Complemento` em POST `/api/totem/cadastro`
- **Arquivo**: `services/ops-server.ts` (linhas 572 a 589)
  ```typescript
  if (dados.endereco !== undefined) {
    const atual = await one<{ endereco: string | null; numero: string | null; complemento: string | null }>(
      `SELECT Endereco endereco, Numero numero, Complemento complemento FROM dbo.Cliente WHERE Id = @id`,
      { id },
    );
    const digitado = String(dados.endereco ?? '').trim();
    if (digitado.includes('***') || !digitado || (atual && digitado === enderecoDoTotem(atual.endereco, atual.numero, atual.complemento))) {
      delete dados.endereco;
    }
  }

  // Preservação de dados de endereço: NUNCA zera Numero e Complemento como NULL
  await updateCliente(id, { ...dados, lgpd: true }, true);
  ```
- **Histórico Git**: Commit `e380f16c` introduziu a rotina que limpava os campos (`limparNumero = Boolean(atual?.numero || atual?.complemento); ... UPDATE dbo.Cliente SET Numero = NULL, Complemento = NULL WHERE Id = @id`). Essa query destrutiva foi eliminada no Milestone M2.
- **Arquivo**: `lib/ops/db.ts` (linhas 153 a 156)
  `updateCliente(id, input, partial = true)` não atualiza colunas ausentes em `input`. Como o totem envia apenas o campo `endereco` consolidado, `Numero` e `Complemento` não são enviados e, portanto, são mantidos intactos no banco de dados.

### 1.5 Item 17: Resposta HTTP 409 em `/api/totem/cadastro`
- **Arquivo**: `services/ops-server.ts` (linhas 596 a 598 e 1004)
  ```typescript
  const dup = await one<{ id: number }>(`SELECT TOP 1 Id id FROM dbo.Cliente WHERE DocumentoNum = @d`, { d: onlyDigits(dados.documento) });
  if (dup) throw new HttpError(409, 'Já existe cadastro com esse documento. Volte e informe o documento para continuar.');
  ...
  // Handler geral de erro (linha 1004)
  if (err instanceof HttpError) return send(res, err.status, { error: err.message });
  ```
- **Arquivo**: `PROJECT_TOTEM.md` (Interface Contracts, linha 82)
  ```
  - Response (409): { error: "documento_cadastrado", id, token }
  ```
  Observação: O backend atualmente devolve `{ error: "Já existe cadastro com esse documento..." }` com HTTP 409, **sem retornar `id` e `token`**. O totem desktop fica sem o identificador e a assinatura da sessão para reaproveitar os dados preenchidos, obrigando o cliente a reiniciar a digitação.

### 1.6 Item 19: Parametrização SQL de Baterias em `/api/totem/baterias`
- **Arquivo**: `services/ops-server.ts` (linhas 622 a 649)
  ```typescript
  if (grupo.length && rows.length) {
    const bParams: Record<string, unknown> = {};
    const bMarks: string[] = [];
    rows.forEach((r, idx) => {
      const key = `bat_${idx}`;
      bParams[key] = Number(r.id);
      bMarks.push(`@${key}`);
    });

    const gParams: Record<string, unknown> = {};
    const gMarks: string[] = [];
    grupo.forEach((id, idx) => {
      const key = `grp_${idx}`;
      gParams[key] = Number(id);
      gMarks.push(`@${key}`);
    });

    const sqlText = `
      SELECT i.BateriaId b, COUNT(*) n FROM dbo.Inscricao i
      WHERE i.BateriaId IN (${bMarks.join(',')}) AND i.Status <> 'cancelada'
        AND (i.ClienteId IN (${gMarks.join(',')})
             OR (i.Origem = 'site' AND i.Pago = 1 AND i.ClienteId IN (SELECT ResponsavelId FROM dbo.Cliente WHERE Id IN (${gMarks.join(',')}) AND ResponsavelId IS NOT NULL)))
      GROUP BY i.BateriaId`;

    for (const g of await query<{ b: number; n: number }>(sqlText, { ...bParams, ...gParams })) {
      doGrupo.set(g.b, g.n);
    }
  }
  ```
- **Arquivo**: `lib/ops/totem-baterias.ts` (linhas 16 a 26)
  `TOTEM_BATERIAS_SQL` é uma consulta constante sem concatenação de variáveis de usuário.
  Observação: A parametrização rigorosa já foi implementada nas queries de grupo de baterias, utilizando `@bat_N` e `@grp_N`.

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio)

1. **Item 12 (Instagram Opcional)**:
   - A função `erroInstagramCliente(value)` já aceita string vazia.
   - Porém, quando o cliente opta explicitamente por "Não possuo Instagram" (`semInstagram: true`), o backend precisa saber que o campo deve ser limpo caso seja uma atualização.
   - Se `partial = true`, `clienteColumns` descarta `''` ou `null`. Logo, para atender ao requisito, `ClienteInput` deve aceitar `semInstagram?: boolean`. Se `input.semInstagram === true`, a coluna `out.Instagram = null` deve ser explicitamente adicionada aos sets de update em `updateCliente` e `insertCliente`.

2. **Item 13 (Telefone Internacional)**:
   - A verificação `onlyDigits(dados.telefone).length < 10` em `ops-server.ts:595` pressupõe formato nacional brasileiro (DDD de 2 dígitos + telefone de 8 ou 9 dígitos).
   - Para turistas estrangeiros (`tipoDocumento === 'PASSAPORTE'` ou número com `+` ou país diferente de BR/Brasil), o formato internacional padrão ITU-T E.164 possui de 7 a 15 dígitos.
   - Portanto, a lógica de validação deve distinguir número nacional de internacional:
     - Se internacional: dígitos entre 7 e 15 (`digits.length >= 7 && digits.length <= 15`).
     - Se nacional: dígitos entre 10 e 13 (`digits.length >= 10 && digits.length <= 13`, permitindo DDI 55).
     - Caracteres válidos: apenas dígitos, `+`, `(`, `)`, `-`, `.`, espaços. Qualquer outro caractere deve ser rejeitado com "Número de telefone inválido.".
     - A mesma validação deve ser aplicada tanto na criação quanto na atualização de clientes com telefone preenchido e desmascarado.

3. **Item 14 (Harmonização de Peso)**:
   - No backend, `erroPesoCliente` valida `10 <= valor <= 250`.
   - No desktop `FormTotem.cs`, a linha 539 valida `20 <= kg <= 250` para adultos e a linha 750 valida `10 <= kg <= 250` para menores.
   - Para harmonização completa: `erroPesoCliente(peso: unknown, isMenor?: boolean)` deve permitir passar a flag `isMenor`.
     - Se `isMenor === true`: faixa válida de 10 a 250 kg.
     - Se `isMenor === false`: faixa válida de 20 a 250 kg.
     - Se `isMenor === undefined`: padrão 10 a 250 kg (para garantir retrocompatibilidade com testes existentes em `m2-adversarial-challenger.test.ts` e `m2-backend.test.ts` que testam valores como 10 e 15 sem especificar idade).
     - Em `services/ops-server.ts`, calcular `isMenor = Boolean(responsavelId || (idade !== null && idade < 18))` e repassar para `erroCadastroObrigatorio(dados, isMenor)`.

4. **Item 15 (Preservação de Número e Complemento)**:
   - Como `partial = true` é passado para `updateCliente`, as colunas não fornecidas em `dados` não entram na cláusula `SET`.
   - Se o usuário não editou o endereço (ou manteve a máscara), o campo `dados.endereco` é removido e nada é alterado.
   - Se o usuário editou o endereço consolidado, apenas `Endereco` é atualizado, preservando o valor preexistente de `Numero` e `Complemento`.
   - O Worker deve assegurar testes de regressão que garantam que nenhuma alteração reintroduza limpeza destrutiva.

5. **Item 17 (Resposta HTTP 409 em /api/totem/cadastro)**:
   - O contrato em `PROJECT_TOTEM.md` estipula que, ao encontrar cliente duplicado por documento, o backend deve responder 409 com `{ error: "documento_cadastrado", id, token }`.
   - Na linha 597 de `ops-server.ts`, a ocorrência de `dup` deve invocar:
     ```typescript
     return send(res, 409, {
       error: 'documento_cadastrado',
       message: 'Já existe cadastro com esse documento. Volte e informe o documento para continuar.',
       id: dup.id,
       token: sign(`cli:${dup.id}`),
     }), true;
     ```
   - Isso permite que o totem desktop capture o 409 e ofereça ao cliente a opção de confirmar e atualizar o cadastro sem descartar os dados preenchidos.
   - Adicionalmente, na edição de cliente existente (`id` presente), se `dados.documento` desmascarado for alterado para um documento já pertencente a OUTRO cliente (`WHERE DocumentoNum = @d AND Id <> @id`), o mesmo 409 deve ser retornado para evitar colisão.

6. **Item 19 (Parametrização SQL de Baterias)**:
   - A rota `/api/totem/baterias` já está devidamente parametrizada usando `@bat_N` e `@grp_N` no bloco de consulta de contagem de vagas do grupo.
   - O Worker deve manter essa estrutura intocada e assegurar que novos testes continuem validando essa blindagem contra injeção SQL.

---

## 3. Caveats (Ressalvas e Limitações)

1. **Campos no Desktop WinForms**: As alterações de interface do totem (.NET 8 WinForms) para adicionar a checkbox "Não possuo Instagram" e o seletor/máscara de telefone internacional são de competência dos arquivos C# (`FormTotem.cs`, `ValidacaoCliente.cs`, `Fmt.cs`). O backend deve suportar os novos payloads tanto da versão desktop legada quanto da atualizada.
2. **Retrocompatibilidade de Testes M2**: Os testes já existentes de M2 (`m2-adversarial-challenger.test.ts`, `m2-forensic-challenger.test.ts`, `m2-backend.test.ts`) contêm asserções estritas sobre `erroPesoCliente(10)` e `erroPesoCliente(15)` retornando `null` quando chamados sem argumentos. A assinatura de `erroPesoCliente` deve manter `isMenor` como opcional.
3. **Validação de Documento Estrangeiro**: Passaportes não possuem algoritmo de dígitos verificadores fixo como o CPF; a validação de formato para passaporte no backend deve exigir que o campo seja não vazio e não exceda 60 caracteres (limite da coluna `dbo.Cliente.Documento`).

---

## 4. Conclusion (Conclusão e Recomendações para o Worker M3)

### Mudanças Recomendadas no Backend:

1. **`lib/ops/db.ts`**:
   - Adicionar `semInstagram?: boolean` na interface `ClienteInput`.
   - Em `clienteColumns(input, partial)`:
     ```typescript
     if (input.semInstagram === true) {
       out.Instagram = null;
     } else if ('instagram' in input && typeof input.instagram === 'string') {
       const norm = normalizarInstagram(input.instagram);
       set('Instagram', norm || null);
     }
     ```
2. **`lib/ops/cadastro-obrigatorio.ts`**:
   - Atualizar `erroPesoCliente(peso: unknown, isMenor?: boolean): string | null`:
     - Se `isMenor === true`, limite `[10, 250]`.
     - Se `isMenor === false`, limite `[20, 250]`.
     - Se `isMenor === undefined`, limite `[10, 250]`.
   - Atualizar `erroCadastroObrigatorio(dados, isMenor?: boolean)`:
     - Se `dados.semInstagram === true`, ignora `erroInstagramCliente`.
     - Passa `isMenor` para `erroPesoCliente(dados.peso, isMenor)`.
3. **`services/ops-server.ts`**:
   - Criar helper de validação de telefone: `function erroTelefoneCliente(telefone: unknown, tipoDoc?: string): string | null`
     - Checa obrigatoriedade se titular.
     - Valida caracteres permitidos `/^[+\d\s().-]+$/`.
     - Se internacional (`String(telefone).trim().startsWith('+') || tipoDoc === 'PASSAPORTE'`): `7 <= digits.length <= 15`.
     - Se nacional: `10 <= digits.length <= 13`.
   - Na rota `POST /api/totem/cadastro`:
     - Repassar `semInstagram: Boolean(body.semInstagram || dados.semInstagram)` para `dados`.
     - Passar `isMenor` para `erroCadastroObrigatorio(dados, isMenor)`.
     - No tratamento de duplicidade de documento (`dup`), retornar:
       ```typescript
       return send(res, 409, {
         error: 'documento_cadastrado',
         message: 'Já existe cadastro com esse documento. Volte e informe o documento para continuar.',
         id: dup.id,
         token: sign(`cli:${dup.id}`),
       }), true;
       ```
     - Validar duplicidade também em atualizações (`id` presente) caso o documento desmascarado seja modificado.
4. **Criação de Testes (`tests/ops/m3-totem-validacao.test.ts`)**:
   - O Worker deve criar uma nova suíte de testes em Vitest cobrindo:
     - Instagram opcional / `semInstagram: true`.
     - Validação de telefone internacional (E.164: 7 a 15 dígitos) vs nacional (10 a 11 dígitos).
     - Harmonização de faixas de peso (adulto 20–250 kg vs menor 10–250 kg).
     - Preservação estrita de `Numero` e `Complemento` em updates parciais de endereço.
     - Resposta 409 com `{ error: "documento_cadastrado", id, token }`.
     - Parametrização SQL em `/api/totem/baterias` e proteção contra SQL Injection.

---

## 5. Verification Method (Método de Verificação Independente)

O Worker e o Reviewer poderão verificar as alterações de M3 através dos seguintes passos:

1. **Execução de Testes Unitários de Backend**:
   ```bash
   npx vitest run tests/ops/cadastro-obrigatorio.test.ts tests/ops/instagram.test.ts tests/ops/totem-baterias.test.ts tests/ops/m3-totem-validacao.test.ts
   ```
2. **Checagem Estrita de Tipagem TypeScript**:
   ```bash
   npx tsc --noEmit
   ```
3. **Verificação de Regressão Global**:
   ```bash
   npx vitest run tests/ops/
   ```
4. **Critérios de Invalidação**:
   - Falha em qualquer teste existente em `tests/ops/m2-*.test.ts`.
   - Qualquer erro de compilação TypeScript em `services/ops-server.ts`, `lib/ops/db.ts` ou `lib/ops/cadastro-obrigatorio.ts`.
   - Retorno de 409 em `/api/totem/cadastro` sem as propriedades `id` e `token`.
   - Rejeição de número internacional válido com passaporte ou prefixo `+`.
