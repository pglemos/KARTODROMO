# Handoff Report — Milestone M2 (Adversarial Challenge & Stress Verification)

**Veredito Explícito**: **APPROVE**

---

## 1. Observation

Foi realizada auditoria de segurança, teste de estresse e desafio adversarial independente sobre todas as frentes técnicas da Milestone M2 no servidor operacional Node.js / TypeScript (`services/ops-server.ts`, `lib/ops/termo.ts`, `lib/ops/totem-baterias.ts`, `lib/ops/cadastro-obrigatorio.ts`, `lib/ops/instagram.ts`, `lib/ops/office.ts`, `lib/ops/db.ts`).

Para isso, foi criada e executada a suíte independente de testes adversariais `tests/ops/m2-adversarial-challenger.test.ts` com 47 testes focados em injeção de código, extração de PII, limites numéricos e quebras de layout.

### Observações Empíricas Coletadas:

1. **Injeção SQL em `/api/totem/baterias` (`services/ops-server.ts:478-506`)**:
   - O endpoint consome o parâmetro `grupo` via:
     ```ts
     const grupo = String(new URL(req.url ?? '/', 'http://totem').searchParams.get('grupo') ?? '').split(',').map((x) => x.split('.')).filter(([id, tk]) => Number(id) > 0 && tk === sign(`cli:${Number(id)}`)).map(([id]) => Number(id));
     ```
   - Payloads testados: `"1' OR '1'='1"`, `"1; DROP TABLE dbo.Inscricao;--"`, `"1 UNION SELECT null..."`, `"-1"`, `"0"`, `"NaN"`, `"Infinity"`, `"<script>"`, `"!@#$%^&*()"`, `"1.token_invalido"`, `""`, `",,,"`.
   - Resultado empírico: 100% dos payloads maliciosos e tokens adulterados foram descartados (`parsed = []`). Em ataques mistos (`42.validToken,1' OR 1=1--`), apenas o ID íntegro com HMAC assinado foi admitido.
   - A query SQL dinâmica de contagem de vagas utiliza estritamente placeholders nomeados (`@bat_0, @bat_1, ...` e `@grp_0, @grp_1, ...`) com mapeamento direto para números inteiros no dicionário de parâmetros. Nenhuma concatenação de dados de entrada do usuário ocorre na string SQL.

2. **Proteção de PII e LGPD em `POST /api/totem/identificar` (`services/ops-server.ts:269-310, 378-410`)**:
   - CPF formatado (`123.456.789-00`) e CPF bruto (`12345678900`) são mascarados como `123.***.***-00`. Documentos de outros tipos (RG, Passaporte, CNH) retornam `XX***YY` ou `***` (se <= 4 chars). Nenhum dígito entre o índice 3 e 8 é jamais exposto.
   - E-mail (`pedro.guilherme@kartodromo.com.br`) retorna `p***@***.br`. Entradas anômalas retornam `u***@***.com`. O miolo do usuário e o nome do provedor de e-mail nunca são vazados.
   - Telefone (`(31) 98765-4321` ou `+1 (555) 123-4567`) retorna `(**) *****-4321` e `(**) *****-4567`. DDD e os 5 primeiros dígitos são sempre ofuscados.
   - Endereço (`Av. Afonso Pena, 1500 - Sala 302`) retorna `Av. ***, ***`. Os campos `numero: ''` e `complemento: ''` são estritamente forçados a strings vazias na resposta pública.
   - Dependentes Menores (`services/ops-server.ts:378`):
     ```sql
     SELECT c.Id id, c.Nome nome, CONVERT(varchar(10), c.Nascimento, 126) nascimento FROM dbo.Cliente c WHERE c.ResponsavelId = @id AND c.Bloqueado = 0 ORDER BY c.Nome
     ```
     Não seleciona documento, e-mail, telefone, endereço ou notas do menor. Retorna apenas token assinado para a sessão.
   - Proteção de Sobrescrita (`services/ops-server.ts:435-450`): Se o cliente confirma cadastro no totem com campos contendo máscara `***`, os dados mascarados são deletados antes de chamar `updateCliente`, preservando os dados reais no banco de dados sem sobrescrita por NULL.

3. **Bobina Térmica Dinâmica (`lib/ops/termo.ts:192, 196` e `services/ops-server.ts:627-635`)**:
   - Ausência absoluta de `297mm` no HTML gerado em múltiplos cenários (participante único, 3 participantes, termo em branco, lista vazia, textos personalizados de 10.000 caracteres e caracteres especiais com escape HTML).
   - Estilo CSS declara `@page { size: 80mm auto; margin: 0; }` e `.page { width: 80mm; min-height: auto; }`.
   - Prevenção de desperdício de papel: `.page:last-child { break-after: auto; page-break-after: auto; }` desativa a ejeção de folha em branco após a última página.
   - Assinaturas protegidas com `.assinatura { break-inside: avoid; page-break-inside: avoid; }`.

4. **Validação de Peso e Instagram (`lib/ops/cadastro-obrigatorio.ts:3-16` e `lib/ops/instagram.ts:10-15`)**:
   - Peso:
     - Limites inferiores: 9 kg e 9.99 kg rejeitados (`Peso inválido. Informe um valor entre 10 e 250 kg.`). 10 kg, '10' e '10,0' aceitos perfeitamente (`null`).
     - Limites superiores: 250 kg, '250' e '250,0' aceitos perfeitamente (`null`). 250.01 kg e 251 kg rejeitados (`Peso inválido`).
     - Vazio, nulo ou indefinido rejeitado com `'O peso é obrigatório. Informe o peso em kg.'`.
   - Instagram:
     - Vazio (`""`, `"   "`, `null`, `undefined`): Aceito perfeitamente como opcional (`null`).
     - Válidos: `@andre.silva`, `andre.silva`, `https://www.instagram.com/piloto.oficial/` (normalizados para `@andre.silva` e `@piloto.oficial`).
     - Inválidos: `@`, espaços, scripts, ponto duplo (`@piloto..duplo`), ponto final (`@piloto.`), e handles com mais de 30 caracteres rejeitados com `'Instagram inválido'`.

5. **Bloqueio de Baterias Vencidas (`TOTEM_BATERIAS_SQL` e `lib/ops/office.ts:426`)**:
   - `TOTEM_BATERIAS_SQL` possui cláusula `b.Inicio >= SYSDATETIME()`.
   - Em `lib/ops/office.ts:426`, foi eliminada a tolerância de -30 minutos (`CASE WHEN b.Inicio < SYSDATETIME() THEN 1 ELSE 0 END passada`).
   - `bateriaDisponivelNoTotem` rejeita baterias com início ultrapassado.

6. **Resultados de Execução dos Testes**:
   - `npx vitest run tests/ops/m2-adversarial-challenger.test.ts`: **47 testes passando (100%)**.
   - `npx vitest run tests/ops/ tests/e2e-recepcao/`: **24 arquivos de teste, 421 testes passando (100%)**.
   - `npx tsc --noEmit`: **0 erros de tipo**.

---

## 2. Logic Chain

1. A tentativa de forjar ou injetar SQL via parâmetro `grupo` em `/api/totem/baterias` falha em duas camadas independentes de defesa:
   - Primeira camada (parser): Qualquer string não-numérica resulta em `NaN`, sendo expurgada por `Number(id) > 0`. Adicionalmente, tokens forjados falham na verificação criptográfica HMAC (`tk === sign('cli:' + Number(id))`).
   - Segunda camada (driver SQL): A query dinâmica não concatena valores literais, gerando parâmetros nomeados `@bat_N` e `@grp_N` e passando um dicionário de inteiros primitivos para o método `req.input()` do driver `mssql`. Logo, é matematicamente impossível alterar a semântica da consulta SQL.
2. Na tela de autoatendimento público (`POST /api/totem/identificar`), o visitante digita um identificador público (CPF ou e-mail). Se a API retornasse os dados completos, o totem funcionaria como um extrator de dados de terceiros. As funções `mascararDocumento`, `mascararEmail`, `mascararTelefone` e `mascararEndereco` ofuscam irreversivelmente as informações identificáveis, e o backend força `numero: ''` e `complemento: ''`. Menores dependentes têm apenas nome e nascimento expostos, blindando a privacidade nos termos da LGPD.
3. No fluxo de confirmação cadastral no totem (`POST /api/totem/cadastro`), quando o cliente clica em "Confirmar" sem editar os campos, o totem enviava strings com asteriscos (`***`), que antes provocavam `UPDATE` gravando `Numero = NULL, Complemento = NULL`. O descarte explícito de campos contendo `***` antes de chamar `updateCliente` com `partial = true` garante que o histórico de endereço permaneça intacto.
4. Na impressão térmica, a substituição de `@page { size: 80mm 297mm; }` por `@page { size: 80mm auto; margin: 0; }` somada ao ajuste de `.page:last-child { break-after: auto; }` faz com que o renderizador Chromium/WebView2 calcule a altura exata do conteúdo HTML e envie o comando de corte logo após as assinaturas, eliminando o desperdício de mais de 100mm de bobina por termo e evitando o salto de página em branco no final.
5. A harmonização das validações de peso (10 a 250 kg) e a flexibilização do Instagram (opcional quando vazio e normalizado quando fornecido) removem os bloqueios que impediam crianças, idosos e estrangeiros sem redes sociais de participarem das baterias, mantendo a consistência cadastral.

---

## 3. Caveats

- Em `lib/ops/totem-baterias.ts:42`, a função auxiliar em memória `bateriaDisponivelNoTotem` opera sobre `String(row.inicio).slice(0, 16)`, possuindo granularidade de minuto inteiro. Isso não constitui vulnerabilidade operacional porque a filtragem principal é feita diretamente na consulta SQL Server (`b.Inicio >= SYSDATETIME()`), que opera com precisão de microssegundos via `DATETIME2`.
- O executável desktop WinForms (.NET 8) é direcionado para Windows x64; no ambiente macOS host, a compilação do `Kartodromo.Desktop.sln` é delegada aos testes de regressão automatizados e pipelines de build Windows.

---

## 4. Conclusion

**Veredito: APPROVE**

A Milestone M2 foi submetida a teste de estresse adversarial abrangente e demonstrou robustez exemplar:
- Nenhuma vulnerabilidade de injeção SQL foi encontrada nas rotas do totem.
- A proteção de PII e conformidade com a LGPD é consistente e estrita.
- A bobina térmica opera com layout dinâmico responsivo `80mm auto` sem resíduos de 297mm.
- As regras de validação de peso e Instagram respeitam os limites operacionais estipulados.
- 100% dos testes da suíte (421 testes no total) passam com sucesso e o typecheck do TypeScript está limpo (zero erros).

Recomenda-se avançar imediatamente para a Milestone M3 (Desktop Comum & Periféricos).

---

## 5. Verification Method

Para reproduzir e verificar de forma independente todas as asserções deste relatório:

1. **Executar a nova suíte de testes adversariais da Milestone M2**:
   ```bash
   npx vitest run tests/ops/m2-adversarial-challenger.test.ts
   ```
   *Resultado esperado*: 47 testes passando com 100% de sucesso.

2. **Executar as suítes de testes de operações e E2E**:
   ```bash
   npx vitest run tests/ops/ tests/e2e-recepcao/
   ```
   *Resultado esperado*: 24 arquivos de teste, 421 testes passando com 100% de sucesso.

3. **Verificar ausência de erros de tipos TypeScript**:
   ```bash
   npx tsc --noEmit
   ```
   *Resultado esperado*: Código de saída 0, sem erros.
