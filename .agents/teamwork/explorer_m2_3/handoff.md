# Handoff Report — Explorer M2_3
**Milestone**: M2 (R2: Segurança, Privacidade e LGPD - Itens 8 e 11)  
**Assunto**: Consentimento Explícito para Tratamento de Dados de Menores (LGPD Art. 14), Contratos de API e Banco de Dados  
**Data**: 2026-10-26  
**Status**: Concluído / Pronto para Implementação  

---

## 1. Observation

### 1.1. Totem Desktop WinForms (`FormTotem.cs`)
1. **Ausência total de consentimento em `TelaCadastroMenor()`**:
   - Em `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs` (linhas 634-706), o formulário de cadastro de menor coleta nome, documento, e-mail, celular, nascimento, peso, endereço e Instagram.
   - Não há nenhum controle visual (`Marcador`, `CheckBox`, `LinkLabel`) para o responsável manifestar consentimento específico e em destaque, conforme exigido pelo Art. 14 da LGPD.
   - No botão "Salvar" (linhas 692-701), o aplicativo WinForms envia silenciosamente `["lgpd"] = true`:
     ```csharp
     var r = await _api.Post("/api/totem/cadastro", new JsonObject
     {
         ["dados"] = new JsonObject
         {
             ["nome"] = n, ["nascimento"] = iso, ["tipoDocumento"] = tipoDoc, ["documento"] = doc.Text.Trim(), ["peso"] = peso.Text.Trim(),
             ["email"] = email.Text.Trim(), ["telefone"] = fone.Text.Trim(), ["instagram"] = ValidacaoCliente.NormalizarInstagram(instagram.Text),
             ["cep"] = cep.Text.Trim(), ["endereco"] = end.Text.Trim(), ["bairro"] = bairro.Text.Trim(), ["cidade"] = cidade.Text.Trim(), ["estado"] = uf,
         },
         ["lgpd"] = true, ["responsavelId"] = _cliente.L("id"), ["responsavelToken"] = _token,
     });
     ```
   - O payload **não envia** `consentimentoMenor: true` e não valida se quem está operando é o responsável legal.

2. **Ausência de validação de faixa etária no cadastro do menor e no cadastro de titular**:
   - Em `TelaCadastroMenor()` (linha 687), a única validação de data é se a data de nascimento é válida e não futura:
     ```csharp
     if (string.IsNullOrEmpty(iso) || Fmt.ParseData(iso) is not { } dn || dn > DateTime.Today || dn.Year < 1900) { Alertar("Informe a data de nascimento (DD/MM/AAAA)."); nasc.Caixa.Focus(); return; }
     ```
     Não há verificação se o participante tem de fato menos de 18 anos, permitindo cadastrar adultos como dependentes sem validação de titular.
   - Em `TelaCadastro()` de adulto (linhas 504-505 e 528-529), se um menor de idade (ex.: 12 anos) digitar seu CPF na tela inicial e for para o cadastro novo de adulto, o sistema não bloqueia e permite que uma criança complete o cadastro como titular autônomo sem nenhum vínculo com responsável.

3. **Exposição de dados do menor na fila pública (Item 8)**:
   - Em `TelaMenores()` (linhas 611-612):
     ```csharp
     foreach (var d in _dependentes)
         lista.Adicionar(new OpcaoLinha(_k) { Height = P(72), Id = d.Id, Linha1 = d.Nome, Linha2 = d.Nascimento.Length >= 10 ? "Nascimento: " + Fmt.Dmy(d.Nascimento) : "", Direita = Fmt.Idade(d.Nascimento) is int i ? $"{i} anos" : "", Marcado = marcados.Contains(d.Id) });
     ```
     O totem exibe em tela cheia (1080p ou 768p) o nome completo e a data de nascimento exata da criança/adolescente, visível para qualquer pessoa na recepção/fila do totem.

### 1.2. Backend Operacional (`services/ops-server.ts`)
1. **Bypass da checagem LGPD na rota `POST /api/totem/cadastro`**:
   - Em `services/ops-server.ts` (linhas 380-385):
     ```typescript
     let responsavelId: number | null = null;
     if (body.responsavelId) {
       responsavelId = int(body.responsavelId, 'Responsável');
       if (String(body.responsavelToken ?? '') !== sign(`cli:${responsavelId}`)) throw new HttpError(403, 'Sessão expirada, identifique-se de novo.');
     }
     if (!responsavelId && !body.lgpd) throw new HttpError(400, 'É necessário aceitar o Termo de Consentimento para Tratamento de Dados Pessoais.');
     ```
     Se `responsavelId` estiver presente, a condição `if (!responsavelId && !body.lgpd)` é **falsa**. O backend não exige nem `body.lgpd` e nem qualquer campo `body.consentimentoMenor`!
   - Em linha 422:
     ```typescript
     const newId = await insertCliente({ ...dados, responsavelId, lgpd: true }, 'totem');
     ```
     O backend assume incondicionalmente `lgpd: true` ao inserir o dependente, gravando `LgpdAceiteEm = SYSDATETIME()` sem comprovação de consentimento do responsável.

2. **Falta de verificação de menor de idade no backend**:
   - A rota `/api/totem/cadastro` não calcula a idade a partir de `dados.nascimento`.
   - Um menor de 18 anos pode cadastrar-se sem `responsavelId` e o backend não impede.
   - Um maior de 18 anos pode ser cadastrado como dependente de outrem sem consentimento próprio.

### 1.3. Esquema do Banco de Dados SQL Server (`migrations/ops/0001_inicial.sql` e `lib/ops/db.ts`)
1. **Colunas existentes em `dbo.Cliente`**:
   - Possui `ResponsavelId INT NULL REFERENCES dbo.Cliente(Id)` e `LgpdAceiteEm DATETIME2 NULL`.
2. **Deficiências constatadas**:
   - Não há distinção entre consentimento de titular e consentimento específico de menor (LGPD Art. 14, § 1º).
   - Faltam colunas para registrar:
     - Quem foi o responsável legal que prestou o consentimento (`LgpdMenorResponsavelId`);
     - O momento exato do consentimento do menor (`LgpdMenorAceitoEm`);
     - A versão do termo legal aceito (`LgpdMenorTermoVersao`).
   - Não existe tabela de trilha de auditoria para registros de aceites de termos (`dbo.TermoAceite`).

---

## 2. Logic Chain

1. **Premissa Legal (LGPD Lei nº 13.709/2018, Art. 14)**:
   - O Artigo 14 impõe que o tratamento de dados pessoais de crianças e adolescentes deve ser realizado no seu melhor interesse.
   - O § 1º estabelece que o consentimento deve ser **específico e em destaque**, fornecido por pelo menos um dos pais ou pelo responsável legal.
   - O § 5º determina que o controlador deve realizar todos os esforços razoáveis para verificar que o consentimento foi dado pelo responsável legal.
2. **Constatação de Desconformidade**:
   - Pela Observação 1.1, o formulário de cadastro de menor (`TelaCadastroMenor`) não apresenta nenhum termo ou checkbox de consentimento do responsável; gera `lgpd: true` de forma oculta e automática.
   - Pela Observação 1.2, o backend `/api/totem/cadastro` possui um bypass explícito que desconsidera a verificação de consentimento quando há `responsavelId`.
   - Pela Observação 1.3, o banco de dados não rastreia quem autorizou o tratamento de dados do menor, inviabilizando a prestação de contas (Art. 6º, X da LGPD).
3. **Riscos Operacionais e de Privacidade (Item 8 e Item 11)**:
   - Exposição desnecessária de PII de crianças na tela pública do totem (`TelaMenores()`).
   - Possibilidade de crianças se cadastrarem sozinhas no quiosque sem nenhum responsável legal vinculado.
   - Ausência de evidência legal em caso de fiscalização da ANPD ou questionamento de pais/responsáveis.
4. **Conclusão Lógica**:
   - É indispensável implementar o consentimento explícito em destaque na interface WinForms do Totem com novo diálogo modal para o Termo do Art. 14.
   - É indispensável incluir no payload `/api/totem/cadastro` os campos `consentimentoMenor: boolean` e `responsavelCpf?: string`.
   - É indispensável aplicar validação e bloqueio estrito no backend caso `consentimentoMenor` não seja `true` ou se a idade for incompatível.
   - É indispensável criar migration no banco de dados para persistir os campos de auditoria em `dbo.Cliente` e instituir a tabela de histórico `dbo.TermoAceite`.

---

## 3. Caveats

1. **Horário de Funcionamento em Produção**: Conforme as regras operacionais do kartódromo (`AGENTS.md`), novas migrations ou deploys no SRVKART só podem ser aplicados fora do horário de funcionamento ou via atualização automática quando o totem estiver ocioso.
2. **Ambiente Mac (Build Desktop)**: O host local não possui o runtime `dotnet` instalado, de modo que a compilação do `Kartodromo.Desktop.sln` (.NET 8 WinForms) e os autotestes gráficos devem ser homologados no ambiente Windows/CI.
3. **Idade Mínima Desportiva**: Adotou-se o piso regulamentar de 6 anos completos para pilotagem de karts indoor/infantil (conforme normas da CBA/FMA e regulamento interno da pista). Menores com menos de 6 anos não podem ser inscritos para correr.

---

## 4. Conclusion & Actionable Design

Recomenda-se a implementação coordenada das seguintes 4 frentes:

### A. Interface WinForms Totem (`FormTotem.cs`)
1. **Em `TelaCadastroMenor()`**:
   - Incluir controle `Marcador`:
     `var lgpdMenor = Marca(c, "Sou pai/mãe ou responsável legal e autorizo o tratamento de dados do menor (LGPD Art. 14) *", 90, 626, false, 32);`
   - Adicionar `LinkLabel` para exibição modal: `"Ver Termo de Consentimento de Menores"`.
   - Criar método `CriarTermoLgpdMenor()` / `TermoLgpdMenor()` com modal explicativo destacando o Art. 14 da LGPD e finalidades legítimas (segurança, cronometragem, seguro, regulamento CBA).
   - Validar idade no clique de "Salvar":
     - `idade >= 18`: bloquear informando que maiores devem fazer cadastro individual.
     - `idade < 6`: bloquear informando a idade mínima regulamentar.
     - `!lgpdMenor.Marcado`: bloquear e alertar que o consentimento do responsável é obrigatório.
   - Enviar no POST:
     ```json
     {
       "dados": { ... },
       "lgpd": true,
       "consentimentoMenor": true,
       "responsavelId": _cliente.L("id"),
       "responsavelToken": _token,
       "responsavelCpf": _cliente.S("documento")
     }
     ```
2. **Em `TelaCadastro()` de Titular**:
   - Se a data de nascimento informada resultar em idade < 18 anos, bloquear com alerta:
     `"Menores de 18 anos devem ser cadastrados por um pai ou responsável legal. Marque a opção 'Sou responsável por menor' na tela inicial."`
3. **Em `TelaMenores()` (Proteção PII - Item 8)**:
   - Substituir a exibição da data de nascimento exata por apenas `"Idade: {i} anos"`, resguardando o nascimento completo de terceiros na fila.

### B. Contrato e Validações no Backend (`services/ops-server.ts`)
1. **Atualização da rota `POST /api/totem/cadastro`**:
   - Calcular idade: `const idade = idadeNaData(dados.nascimento, new Date());`
   - Se `responsavelId` estiver presente:
     - Validar que `body.consentimentoMenor === true`. Se falso/nulo: `throw new HttpError(400, 'É obrigatório o consentimento expresso do responsável legal para o tratamento de dados do menor de idade (LGPD Art. 14).');`
     - Validar que `idade !== null && idade < 18`. Se >= 18: `throw new HttpError(400, 'Participantes com 18 anos ou mais devem realizar cadastro individual próprio.');`
     - Validar que `idade >= 6`. Se < 6: `throw new HttpError(400, 'A idade mínima regulamentar para pilotagem é de 6 anos completos.');`
   - Se `responsavelId` for nulo:
     - Validar que `body.lgpd === true`.
     - Validar que `idade !== null && idade >= 18`. Se < 18: `throw new HttpError(400, 'Menores de 18 anos devem ser cadastrados por um responsável legal (LGPD Art. 14).');`
2. **Persistência**:
   - Chamar `insertCliente` / `updateCliente` repassando `consentimentoMenor: true`, `lgpdMenorResponsavelId: responsavelId`.

### C. Camada de Dados e Migração SQL Server
1. **Criar `migrations/ops/0012_lgpd_menor.sql`**:
   ```sql
   -- Colunas de auditoria LGPD menor em dbo.Cliente
   IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Cliente') AND name = 'LgpdMenorAceitoEm')
       ALTER TABLE dbo.Cliente ADD LgpdMenorAceitoEm DATETIME2 NULL;
   GO
   IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Cliente') AND name = 'LgpdMenorResponsavelId')
       ALTER TABLE dbo.Cliente ADD LgpdMenorResponsavelId INT NULL REFERENCES dbo.Cliente(Id);
   GO
   IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Cliente') AND name = 'LgpdMenorTermoVersao')
       ALTER TABLE dbo.Cliente ADD LgpdMenorTermoVersao VARCHAR(20) NULL;
   GO

   -- Tabela de histórico e auditoria de consentimentos
   IF OBJECT_ID('dbo.TermoAceite') IS NULL
   BEGIN
       CREATE TABLE dbo.TermoAceite (
           Id               INT IDENTITY(1,1) PRIMARY KEY,
           ClienteId        INT           NOT NULL REFERENCES dbo.Cliente(Id),
           TipoTermo        VARCHAR(30)   NOT NULL, -- 'LGPD_TITULAR' | 'LGPD_MENOR_ART14' | 'RESPONSABILIDADE_PISTA'
           ResponsavelId    INT           NULL REFERENCES dbo.Cliente(Id),
           VersaoTermo      VARCHAR(20)   NOT NULL DEFAULT '2026.1',
           IpOrigem         VARCHAR(45)   NULL,
           TotemOrigem      VARCHAR(30)   NULL,
           AceitoEm         DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
           DispositivoInfo  NVARCHAR(200) NULL
       );
       CREATE INDEX IX_TermoAceite_Cliente ON dbo.TermoAceite(ClienteId);
       CREATE INDEX IX_TermoAceite_Responsavel ON dbo.TermoAceite(ResponsavelId);
   END
   GO
   ```
2. **Em `lib/ops/db.ts`**:
   - Mapear `LgpdMenorAceitoEm`, `LgpdMenorResponsavelId` e `LgpdMenorTermoVersao` em `CLIENTE_COLS` e `ClienteInput`.
   - Gravar linha em `dbo.TermoAceite` na função `insertCliente`.

---

## 5. Verification Method

Para verificar de forma independente e testar a eficácia da solução:

1. **Testes de Integração Automatizados (Vitest)**:
   - Criar `tests/ops/lgpd-menor.test.ts` cobrindo:
     - Tentativa de cadastro de menor com `consentimentoMenor: false` -> Retorna HTTP 400 com mensagem do Art. 14.
     - Tentativa de cadastro de titular com data de nascimento < 18 anos -> Retorna HTTP 400 exigindo responsável.
     - Tentativa de cadastro de dependente com idade >= 18 anos -> Retorna HTTP 400 exigindo cadastro individual.
     - Cadastro válido com `consentimentoMenor: true` -> Retorna HTTP 201 e verifica que `LgpdMenorAceitoEm` e `LgpdMenorResponsavelId` foram persistidos no banco.
   - Executar: `npx vitest run tests/ops/lgpd-menor.test.ts`.

2. **Inspeção de Contratos e Tipos**:
   - Executar `npx tsc --noEmit` para validar conformidade de tipos em `ops-server.ts` e `lib/ops/db.ts`.

3. **Verificação Visual e Autoteste Desktop**:
   - Rodar o autoteste visual do totem no Windows (`--autoteste`):
     - Conferir que as imagens geradas `4-menores.png`, `5-cadastro-menor.png` e a nova `8b-termo-lgpd-menor.png` exibem o checkbox de consentimento e o modal renderizado sem estourar limites nem violar tokens (`tests/design-tokens/totem-congelado.test.ts`).
