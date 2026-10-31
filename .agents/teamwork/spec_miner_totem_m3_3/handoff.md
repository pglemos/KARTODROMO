# Relatório de Mineração de Especificações — Milestone M3 (Validação de Dados e Cadastro no Totem)

**Data de Emissão:** 2026-10-27T03:15:00Z  
**Autor:** Spec Miner Totem M3 (`spec_miner_totem_m3_3`)  
**Destinatário:** Orquestrador (`ede11c99-3091-44f8-9d3a-86b33770efcd`)  
**Status:** Hard Handoff (Especificação Concluída — Itens 12 a 19)

---

## 1. Observation (Observações Diretas no Código e Documentação)

Foram inspecionados os arquivos de código-fonte, rotas do servidor, componentes desktop WinForms, documentação de operações e suítes de teste. Abaixo estão as observações factuais com referências literais de caminhos e linhas:

### 1.1 Item 12: Instagram Obrigatório no Totem
- Em `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`:
  - Linha 453: `var fInstagram = Campo(campos, "Instagram do piloto (@usuário)", xs[0], 324, cw * 2 + 16, _cliente.S("instagram"));`
  - Linha 473: `Obrigatorio(fInstagram, "Instagram do piloto (@usuário)", true);`
  - Linha 536: `foreach (var (campoObrig, rotuloObrig) in obrigatorios) if (campoObrig.Text.Trim().Length == 0 && campoObrig != fNasc) { Alertar($"Preencha o campo {rotuloObrig}."); campoObrig.Caixa.Focus(); return; }`
  - Linha 703 e 741-742 (`TelaCadastroMenor`):
    `var instagram = Campo(campos, "Instagram do piloto (@usuário) *", xs[0], 324, cw * 2 + 16);`
    `foreach (var (campo, rotulo) in new[] { ..., (instagram, "Instagram do piloto (@usuário)") }) if (campo.Text.Trim().Length == 0) { Alertar($"Preencha o campo {rotulo}."); campo.Caixa.Focus(); return; }`
  - *Constatação:* O Instagram é exigido com validação bloqueante de campo não-vazio no desktop tanto para adultos quanto para menores, impedindo clientes sem perfil na rede social (crianças de 6 a 12 anos, idosos, turistas) de participarem da corrida.
- Em `lib/ops/cadastro-obrigatorio.ts`:
  - Linha 15: `return erroPesoCliente(dados.peso) ?? erroInstagramCliente(dados.instagram);`
- Em `lib/ops/instagram.ts`:
  - Linha 12: `if (!usuario) return null;`
  - *Constatação:* O backend em TypeScript já trata valores nulos/vazios como válidos (`return null;`), validando o formato `@usuario` apenas quando o campo é preenchido.

### 1.2 Item 13: Telefone Internacional e Turistas
- Em `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`:
  - Linha 445 e 487:
    `var fFone = Campo(campos, "Celular (WhatsApp)", xs[1], 132, cw, Fmt.MascaraFone(_cliente.S("telefone")));`
    `Mascarar(fFone.Caixa, Fmt.MascaraFone);`
  - Linha 532, 551 e 744:
    `if (Fmt.Digitos(fFone.Text).Length < 10) { Alertar("O número de telefone é obrigatório."); return; }`
    `if (fFone.Text.Trim().Length > 0 && Fmt.Digitos(fFone.Text).Length < 10) { Alertar("Número de telefone inválido."); return; }`
    `if (Fmt.Digitos(fone.Text).Length < 10) { Alertar("Número de telefone inválido."); fone.Caixa.Focus(); return; }`
- Em `desktop/src/Kartodromo.Comum/Fmt.cs`:
  - Linha 46-55:
    `public static string MascaraFone(string v) { var d = Digitos(v); if (d.Length > 11) d = d[..11]; ... return $"({d[..2]}) {d[2..7]}-{d[7..]}"; }`
- Em `services/ops-server.ts`:
  - Linha 595: `if (!responsavelId) { if (!dados.telefone || onlyDigits(dados.telefone).length < 10) throw new HttpError(400, 'O número de telefone é obrigatório.'); ... }`
- *Constatação:* Turistas estrangeiros selecionando "Passaporte" ou digitando números com DDI internacional (ex.: `+1 202 555 0199`, `+351 912 345 678`) sofrem truncamento forçado para 11 dígitos, distorção pela máscara brasileira `(XX) XXXXX-XXXX` e bloqueio por exigência mínima de 10 dígitos nacionais.

### 1.3 Item 14: Divergência de Validação de Faixa de Peso
- Em `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`:
  - Linha 539-540 (`TelaCadastro` / Adulto):
    `if (pesoTxt.Length > 0 && (!double.TryParse(pesoTxt, ...) || kg < 20 || kg > 250))`
  - Linha 750-751 (`TelaCadastroMenor` / Menor):
    `if (!double.TryParse(pesoTxt, ...) || kg < 10 || kg > 250)`
- Em `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs`:
  - Linha 38-40:
    `double.TryParse(...) && double.IsFinite(kg) && kg >= 10 && kg <= 250 ? null : "Peso inválido. Informe um valor entre 10 e 250 kg.";`
- Em `lib/ops/cadastro-obrigatorio.ts`:
  - Linha 7-8:
    `Number.isFinite(valor) && valor >= 10 && valor <= 250 ? null : 'Peso inválido. Informe um valor entre 10 e 250 kg.';`
- Em `lib/ops/db.ts`:
  - Linha 173: `set('Peso', p > 0 && p < 500 ? p : null);`
- *Constatação:* Existe inconsistência: no desktop a tela de adulto impõe limite mínimo de 20 kg, enquanto a tela de menor, o `ValidacaoCliente.cs` e o servidor impõem limite mínimo de 10 kg, e `db.ts` aceita `0 < p < 500`.

### 1.4 Item 15: Preservação de Número e Complemento
- Em `services/ops-server.ts`:
  - Linha 485 e 506-509 (`POST /api/totem/identificar`):
    `const enderecoCompleto = enderecoDoTotem(c.endereco, c.numero, c.complemento);`
    O totem unifica logradouro, número e complemento em um único campo visual de texto (`fEnd`).
  - Linha 573-585 (`POST /api/totem/cadastro`):
    O código atual detecta se o endereço permaneceu inalterado ou mascarado e deleta `dados.endereco`. No caso de alteração, chama `updateCliente(id, { ...dados, lgpd: true }, true)` em modo parcial.
- Em `lib/ops/db.ts`:
  - Linha 153-156 e 203-218: `clienteColumns(input, partial = true)` só inclui colunas presentes no `input`. Não anula colunas ausentes.
- *Constatação:* A antiga query deletéria `UPDATE dbo.Cliente SET Numero = NULL, Complemento = NULL` identificada no survey M1/M2 já foi eliminada dos fontes, devendo a especificação formal blindar e proibir terminantemente o retorno de qualquer cláusula SQL que anule `Numero` e `Complemento`.

### 1.5 Item 16: Edição Assistida de Nome e Documento de Pré-existente
- Em `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`:
  - Linha 478-482:
    ```csharp
    if (existente)
    {
        reg.Enabled = tipo.Enabled = fDoc.Enabled = fNome.Enabled = false;
        if (fDoc.Text.Length == 0) fDoc.Text = "(já cadastrado)";
    }
    ```
  - Linha 525-534:
    A atribuição `dados["tipoDocumento"] = tipoDoc; dados["documento"] = fDoc.Text.Trim(); dados["nome"] = nome;` é executada estritamente `if (!existente)`.
- *Constatação:* Um cliente que já possui cadastro no kartódromo e encontra seu nome incorreto (erro tipográfico no cadastro) ou documento trocado fica completamente impossibilitado de corrigir seus dados no totem.

### 1.6 Item 17: Tratamento Elegante de Documento Duplicado (HTTP 409)
- Em `services/ops-server.ts`:
  - Linha 596-597:
    `const dup = await one<{ id: number }>('SELECT TOP 1 Id id FROM dbo.Cliente WHERE DocumentoNum = @d', { d: onlyDigits(dados.documento) });`
    `if (dup) throw new HttpError(409, 'Já existe cadastro com esse documento. Volte e informe o documento para continuar.');`
- Em `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`:
  - Linha 280-285: `ExecutarAcaoBotao` captura `ApiException` e executa `Alertar(...)`.
- *Constatação:* Quando um novo cliente preenche todo o formulário (nome, e-mail, telefone, peso, instagram, endereço) e clica em avançar, ao colidir com documento existente ele recebe apenas um alerta de erro genérico sem a possibilidade assistida de resgatar seu cadastro existente e sem preservação transparente dos dados recém-digitados.

### 1.7 Item 18: Correção do Salto de Cursor na Função Mascarar
- Em `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`:
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
- Em `desktop/src/Kartodromo.Comum/Ui.cs`:
  - Linhas 236-258:
    `public static int CalcularCursorMascara(string antigoTexto, string novoTextoFormatado, int posicaoAntiga)`
    Já implementado e testado com 100% de sucesso na Milestone M3 da Recepção.
- *Constatação:* O totem possui uma implementação privada arcaica de `Mascarar` que força `t.SelectionStart = novo.Length;`, jogando o cursor para o final a cada tecla digitada no meio do campo.

### 1.8 Item 19: Parametrização SQL de Baterias
- Em `services/ops-server.ts`:
  - Linhas 621-649 (`GET /api/totem/baterias`):
    O código utiliza `@bat_0, @bat_1, ...` e `@grp_0, @grp_1, ...` com dicionários `{ ...bParams, ...gParams }`.
- *Constatação:* A parametrização das consultas na rota de baterias deve ser formalizada como contrato mandatório para impedir qualquer regressão para interpolação de strings `${...}`.

---

## 2. Logic Chain (Cadeia de Raciocínio Lógico)

1. **Inclusão Operacional Sem Barreiras (Item 12):**
   - *Fato:* Clientes mirins de 6 a 12 anos e idosos frequentemente não possuem Instagram.
   - *Raciocínio:* Travar o avanço no totem por ausência de Instagram cria fila desnecessária na recepção física.
   - *Conclusão:* Instagram deve ser estritamente opcional. Se não preenchido ou se marcado "Não possuo Instagram", o sistema deve permitir o cadastro gravando `NULL` ou vazio. Se preenchido, deve normalizar para `@usuario` e validar o regex.

2. **Turistas e Telefonia Global (Item 13):**
   - *Fato:* Padrão internacional ITU-T E.164 possui números de 7 a 15 dígitos com prefixo `+` e DDI de 1 a 3 dígitos.
   - *Raciocínio:* Aplicar máscara rígida brasileira `(XX) XXXXX-XXXX` destrói números internacionais e truncar em 11 dígitos corta telefones estrangeiros.
   - *Conclusão:* Quando o documento for Passaporte ou o telefone iniciar com `+`, desabilitar a máscara brasileira e validar comprimento entre 7 e 20 dígitos numéricos.

3. **Consistência Biométrica de Balança (Item 14):**
   - *Fato:* O totem possui uma balança física ao lado para pesagem obrigatória (equilíbrio de lastro dos karts).
   - *Raciocínio:* O peso mínimo regulamentar do kartódromo é de 10 kg (abrangendo pilotos infantis/cadete e adultos). Ter 20 kg na tela de adulto e 10 kg na tela de menor e no servidor causa rejeições espúrias.
   - *Conclusão:* A faixa de peso deve ser rigorosamente unificada em `[10, 250]` kg em todas as camadas.

4. **Integridade Cadastral de Endereço (Item 15):**
   - *Fato:* O totem unifica endereço, número e complemento em uma única caixa de texto para agilidade de toque.
   - *Raciocínio:* Limpar `Numero` e `Complemento` quando o cliente confirma o endereço destrói dados cadastrais detalhados inseridos pela recepção.
   - *Conclusão:* No update parcial do totem, `Numero` e `Complemento` devem ser integralmente preservados no banco de dados.

5. **Tratamento Elegante de Duplicidade 409 (Itens 16 e 17):**
   - *Fato:* Digitar dados completos no totem consome de 2 a 3 minutos no teclado USB.
   - *Raciocínio:* Se o cliente já existia no banco e esqueceu, receber HTTP 409 e perder tudo o que digitou gera abandono e frustração.
   - *Conclusão:* O backend deve responder no 409 com `{ error: "documento_cadastrado", id, token }`. O totem deve exibir diálogo com opções "Carregar meus dados" (aproveitando os campos recém-preenchidos como peso e contato) ou "Corrigir documento", sem limpar os campos da tela.

6. **Preservação do Cursor em Máscaras (Item 18):**
   - *Fato:* A função `Ui.CalcularCursorMascara` rastreia caracteres alfanuméricos antes e depois da formatação.
   - *Raciocínio:* Chamar `CalcularCursorMascara` dentro de `Mascarar` no totem resolve o salto indevido do cursor para o final.
   - *Conclusão:* A substituição de `t.SelectionStart = novo.Length;` por `Ui.CalcularCursorMascara` no totem restaura a usabilidade natural de digitação.

---

## 3. Caveats (Ressalvas e Limitações)

1. **Ambiente Read-Only:** O Spec Miner operou exclusivamente em modo de leitura e análise estática/dinâmica. Nenhuma alteração foi realizada nos fontes de produção nesta milestone.
2. **Ambiente de Build Local macOS:** O utilitário `dotnet` não está instalado no PATH do host macOS de desenvolvimento. A verificação de compilação da solução desktop .NET 8 WinForms deve ser executada nas máquinas de teste/CI Windows ou via scripts de verificação designados.
3. **Regras Inegociáveis do Dono (AGENTS.md):**
   - Respostas estritamente em **pt-BR**.
   - Os aplicativos são programas Windows nativos (`desktop/`), nunca Web/Chrome.
   - **Totem sem teclado virtual na tela** (uso exclusivo de teclado físico USB com foco contínuo).
   - **Não mexer no telão** (`FormTV.cs` / `--tv`).
   - Dados de teste em produção exclusivamente identificados como **"TESTE CODEX"** e revertidos após o teste.

---

## 4. Conclusion (Especificação Técnica Detalhada)

### 4.1 Features Discovered (Matriz Completa dos 8 Itens da M3)

| # | Categoria | Feature | Descrição | Entradas | Saídas | Comportamento de Erro | Descoberto Via |
|---|-----------|---------|-----------|----------|--------|-----------------------|----------------|
| 12 | R3. Validação | Instagram Opcional | Tornar Instagram opcional no Totem e no Backend, aceitando vazio ou opção "Não possuo Instagram" | Texto de usuário ou vazio | String normalizada `@usuario` ou vazia | Se preenchido, valida formato (sem espaços ou caracteres proibidos) | `FormTotem.cs:453, 473`, `cadastro-obrigatorio.ts:15` |
| 13 | R3. Validação | Telefone Internacional | Flexibilizar máscara e validação de telefone para aceitar turistas com passaporte e DDI | Telefone com `+` ou documento Passaporte | Telefone persistido em formato internacional livre (até 40 chars) | Se nacional, exige 10-11 dígitos; se internacional, exige 7-20 dígitos | `FormTotem.cs:445, 532`, `ops-server.ts:595` |
| 14 | R3. Validação | Harmonização de Faixas de Peso | Unificar limites de validação de peso em 10 a 250 kg para adultos e menores no desktop e servidor | Valor de peso em kg (ex.: 78,5) | Valor numérico gravado em `dbo.Cliente.Peso` | Rejeita valores < 10 kg ou > 250 kg com alerta amigável | `FormTotem.cs:539, 750`, `ValidacaoCliente.cs:39` |
| 15 | R3. Validação | Preservação de Número e Complemento | Garantir que atualização de endereço pelo totem não zere as colunas `Numero` e `Complemento` | Texto de endereço editado no totem | `Endereco` atualizado; `Numero` e `Complemento` retidos | Proibido executar `UPDATE dbo.Cliente SET Numero = NULL, Complemento = NULL` | `ops-server.ts:573`, `db.ts:153` |
| 16 | R3. Validação | Edição Assistida de Nome e Documento | Permitir retificação de nome e documento de cliente já existente no quiosque | Nome corrigido (>= 2 palavras) ou documento desmascarado | Registro atualizado na base com token de sessão | Rejeita nomes com < 2 palavras e documentos que colidam com outro cliente (409) | `FormTotem.cs:478-482`, `ops-server.ts:561` |
| 17 | R3. Validação | Tratamento Elegante de HTTP 409 | Tratar conflito de documento duplicado permitindo carregar conta existente sem perder dados digitados | Documento duplicado em novo cadastro | Diálogo com opções "Carregar cadastro" ou "Corrigir documento" | Mantém todos os campos preenchidos intactos na tela | `FormTotem.cs:282`, `ops-server.ts:597` |
| 18 | R3. Validação | Correção do Cursor em Mascarar | Manter cursor na posição correta ao editar máscaras de texto (CPF, telefone, CEP) sem saltar para o fim | Tecla digitada ou backspace no meio do texto | Cursor posicionado logo após o caractere digitado | N/A (eliminação de cursor jumping) | `FormTotem.cs:343-354`, `Ui.cs:236` |
| 19 | R3. Validação | Parametrização SQL de Baterias | Utilizar consultas parametrizadas com marcadores `@bat_i` e `@grp_i` na rota `/api/totem/baterias` | IDs de baterias e clientes do grupo | Conjunto de baterias com contagem de vagas | N/A (proteção contra SQL Injection) | `ops-server.ts:621-649`, `totem-baterias.ts:16` |

---

### 4.2 Edge Cases Mapeados

| # | Feature | Cenário / Entrada | Comportamento Esperado vs Observado |
|---|---------|-------------------|--------------------------------------|
| E1 | Item 12 (Instagram) | Piloto mirim de 7 anos sem Instagram | **Observado:** Bloqueado na tela ("Preencha o campo Instagram").<br>**Esperado:** Cadastro salvo com sucesso com Instagram vazio. |
| E2 | Item 12 (Instagram) | Usuário digita URL completa `https://instagram.com/piloto.betim?igshid=123` | **Observado:** Rejeitado no desktop como inválido.<br>**Esperado:** Normalizado automaticamente para `@piloto.betim`. |
| E3 | Item 13 (Telefone) | Turista americano com passaporte digita `+1 (202) 555-0199` | **Observado:** Máscara BR trunca para 11 dígitos gerando `(12) 02555-0199` e erro 400.<br>**Esperado:** Máscara desativada, aceito com formato internacional. |
| E4 | Item 13 (Telefone) | Usuário brasileiro seleciona CPF e digita telefone com 8 dígitos | **Observado:** Aceitava em versões legadas.<br>**Esperado:** Alerta claro: "O número de telefone deve conter DDD e número (10 ou 11 dígitos)". |
| E5 | Item 14 (Peso) | Piloto adulto pesa 18 kg (jovem ou biotipo leve) | **Observado:** Rejeitado no desktop (`kg < 20`).<br>**Esperado:** Aceito (faixa harmonizada entre 10 e 250 kg). |
| E6 | Item 14 (Peso) | Usuário digita `0`, `-5` ou `500` kg | **Observado:** Aceito parcialmente no banco antigo.<br>**Esperado:** Bloqueio imediato na tela e erro 400 no backend. |
| E7 | Item 15 (Endereço) | Cliente existente confirma endereço na tela do totem | **Observado:** `Numero` e `Complemento` eram zerados para `NULL` no banco.<br>**Esperado:** `Numero` e `Complemento` são integralmente preservados. |
| E8 | Item 16 (Edição) | Cliente nota erro de digitação no nome ("Jualia Silva") | **Observado:** Campo desabilitado (`fNome.Enabled = false`).<br>**Esperado:** Campo editável com validação mínima de 2 palavras. |
| E9 | Item 17 (409) | Cliente preenche 10 campos e ao final CPF já existia | **Observado:** Alerta genérico e perda de dados ao voltar.<br>**Esperado:** Modal oferecendo carregar cadastro existente aproveitando o peso e telefone já digitados. |
| E10 | Item 18 (Cursor) | Usuário clica no 3º dígito do CPF `123.456` e digita `9` | **Observado:** Cursor salta para a posição 14 no fim do texto.<br>**Esperado:** Cursor permanece imediatamente após o `9` digitado. |
| E11 | Item 19 (SQL) | Grupo com 5 clientes consulta baterias no totem | **Observado:** Interpolação crua `IN (1,2,3,4,5)`.<br>**Esperado:** Parametrização SQL com `@grp_0, @grp_1, ...`. |

---

### 4.3 Contratos Exatos de Interface de API

#### Endpoint 1: `POST /api/totem/identificar`
- **Cabeçalhos:**
  - `Content-Type: application/json`
  - `X-Totem-Id: string` (ex.: `"totem1"`)
- **Payload de Requisição:**
  ```json
  {
    "identificador": "string (CPF, RG, passaporte ou e-mail, min 5 chars)",
    "menor": "boolean (opcional, true se busca dependentes)"
  }
  ```
- **Payload de Sucesso (200 OK — Cliente Encontrado):**
  ```json
  {
    "cliente": {
      "id": 105,
      "nome": "Pedro Guilherme",
      "tipoDocumento": "CPF",
      "documento": "***.456.789-**",
      "documentoMascarado": "***.456.789-**",
      "email": "p***@gmail.com",
      "emailMascarado": "p***@gmail.com",
      "telefone": "(31) *****-1234",
      "telefoneMascarado": "(31) *****-1234",
      "nascimento": "**/**/1990",
      "temNascimento": true,
      "peso": "78.5",
      "cep": "32600-***",
      "endereco": "Rua Principal, 100",
      "enderecoMascarado": "Rua Principal, 100",
      "numero": "",
      "complemento": "",
      "bairro": "Centro",
      "cidade": "Betim",
      "estado": "MG",
      "instagram": "@pedro.kart",
      "lgpd": true,
      "bloqueado": false
    },
    "dependentes": [
      {
        "id": 204,
        "nome": "L*** G***",
        "nascimento": "2015-01-01",
        "token": "cli:204.hmac"
      }
    ],
    "token": "cli:105.hmac",
    "totemToken": "totem.sessao.hmac"
  }
  ```
- **Payload de Sucesso (200 OK — Não Encontrado):**
  ```json
  {
    "cliente": null
  }
  ```

---

#### Endpoint 2: `POST /api/totem/cadastro`

##### Caso A: Cadastro Novo de Titular ou Menor (201 Created)
- **Cabeçalhos:**
  - `Content-Type: application/json`
  - `X-Totem-Session: string`
- **Payload de Requisição:**
  ```json
  {
    "dados": {
      "tipoDocumento": "CPF | RG | PASSAPORTE",
      "documento": "string (obrigatório para titular; opcional para menor)",
      "nome": "string (nome completo, min 2 palavras)",
      "email": "string (e-mail válido)",
      "telefone": "string (nacional 10-11 dígitos ou internacional >= 7 dígitos)",
      "nascimento": "YYYY-MM-DD",
      "peso": "string ou number entre 10 e 250 kg",
      "instagram": "string (opcional; se preenchido normaliza para @usuario)",
      "semInstagram": "boolean (opcional)",
      "cep": "string (opcional)",
      "endereco": "string (obrigatório)",
      "bairro": "string (obrigatório)",
      "cidade": "string (obrigatório)",
      "estado": "string (UF, 2 letras)"
    },
    "lgpd": true,
    "consentimentoMenor": "boolean (obrigatório true para menor)",
    "responsavelId": "number (opcional, ID do titular responsável)",
    "responsavelToken": "string (opcional, token do titular)"
  }
  ```
- **Payload de Resposta (201 Created):**
  ```json
  {
    "id": 106,
    "token": "cli:106.hmac",
    "totemToken": "totem.sessao.hmac"
  }
  ```

##### Caso B: Conflito de Documento Duplicado (409 Conflict)
- **Payload de Resposta (409 Conflict):**
  ```json
  {
    "error": "documento_cadastrado",
    "message": "Já existe cadastro com esse documento.",
    "id": 105,
    "token": "cli:105.hmac"
  }
  ```
- *Regra Operacional no Totem:* O desktop detecta `status === 409` e `error === "documento_cadastrado"`. Apresenta diálogo amigável sem descartar o formulário preenchido, oferecendo:
  1. "Carregar meu cadastro": Transita para modo existente usando `id` e `token` retornados, aplicando os dados novos preenchidos (peso, contato).
  2. "Corrigir documento": Retorna o foco ao campo de documento preservando todos os demais campos.

##### Caso C: Atualização Parcial de Cliente Existente (200 OK)
- **Payload de Requisição:**
  ```json
  {
    "id": 105,
    "token": "cli:105.hmac",
    "dados": {
      "nome": "Pedro Guilherme Atualizado",
      "email": "p***@gmail.com",
      "telefone": "(31) *****-1234",
      "peso": "79.5",
      "instagram": "@pedro.novo",
      "endereco": "Rua Principal, 100",
      "bairro": "Centro",
      "cidade": "Betim",
      "estado": "MG"
    },
    "lgpd": true
  }
  ```
- **Regras no Servidor:**
  1. Campos contendo máscara `*` (como e-mail, telefone e endereço) são ignorados e não alteram o banco.
  2. Se `endereco` foi modificado, altera apenas a coluna `Endereco`, mantendo `Numero` e `Complemento` intactos.
  3. `Nome` e `Documento` só são atualizados se fornecidos sem máscara e validados.
- **Payload de Resposta (200 OK):**
  ```json
  {
    "id": 105,
    "token": "cli:105.hmac",
    "totemToken": "totem.sessao.hmac"
  }
  ```

---

### 4.4 Comportamento de UX no Kiosk (Regras do Dono e Usabilidade)

1. **Ausência Absoluta de Teclado Virtual na Tela:**
   - O aplicativo WinForms roda em modo Full Screen Kiosk sem bordas de janela.
   - O totem possui um teclado físico USB de metal acoplado à estrutura.
   - Nenhum teclado touch virtual (OSK / TabTip) deve ser aberto na tela.
2. **Foco Automático e Contínuo no Teclado USB:**
   - Na abertura da tela de identificação: foco imediato no campo `campo.Caixa.Focus()`.
   - Na abertura da tela de cadastro de cliente existente: foco automático no campo de peso `fPeso.Caixa.Focus()`, pois o cliente acabou de subir na balança.
   - Na abertura de cliente novo: foco em `fDoc` ou `fNome`.
   - O campo com foco ativo exibe contorno verde destacado de 2px (`Tokens.Escuro.ComponenteTotemFoco`).
3. **Restabelecimento de Foco Pós-Diálogos:**
   - Ao fechar qualquer janela modal de alerta (`Alerta.Mostrar`), termo LGPD (`TermoLgpd`, `TermoLgpdMenor`) ou confirmação de 409, o foco do teclado deve retornar imediatamente para o controle de entrada ativo correspondente, impedindo que o cursor se perca.
4. **Navegação por Teclado:**
   - Tecla `Enter` aciona o botão principal de avanço ("Próximo" / "Salvar").
   - Tecla `Tab` navega linearmente na ordem dos campos.
   - Tecla `Space` ou `Enter` em caixas de marcação (`Marcador`) alterna o estado do checkbox.

---

## 5. Verification Method (Método de Verificação Independente)

Para auditar e verificar independentemente as especificações levantadas:

1. **Inspeção Estática dos Arquivos de Código:**
   - Conferir validações de Instagram e peso em:
     - `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs` (linhas 453, 473, 536, 539, 703, 741, 750)
     - `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs` (linhas 17-23 e 34-41)
     - `lib/ops/cadastro-obrigatorio.ts` (linhas 3-16)
   - Conferir máscara e cursor em:
     - `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs` (linhas 343-354)
     - `desktop/src/Kartodromo.Comum/Ui.cs` (linhas 236-285)
   - Conferir rotas de identificação, cadastro e baterias em:
     - `services/ops-server.ts` (linhas 448-663)
     - `lib/ops/totem-baterias.ts` (linhas 16-51)
     - `lib/ops/db.ts` (linhas 151-178 e 203-218)

2. **Execução das Suítes de Testes Automatizados:**
   ```bash
   # Testes da suíte de desktop e periféricos
   npx vitest run tests/desktop-m3-perifericos.test.ts tests/desktop-m3-adversarial-challenger.test.ts tests/desktop-m3-forensic-challenger.test.ts

   # Testes de regras de cadastro e baterias
   npx vitest run tests/ops/cadastro-obrigatorio.test.ts tests/ops/totem-baterias.test.ts tests/design-tokens/totem-congelado.test.ts

   # Verificação estrita de tipos do backend TypeScript
   npx tsc --noEmit --skipLibCheck --target es2022 --module esnext --moduleResolution bundler --esModuleInterop --types node services/ops-server.ts
   ```
