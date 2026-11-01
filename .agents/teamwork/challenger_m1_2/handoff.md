# Handoff Report — Challenger M1_2 (Layout Dinâmico TM-T20 & Formatação)

**Data**: 2026-10-26T22:06:00Z  
**Autor**: Empirical Challenger M1_2 (`challenger_m1_2`)  
**Destinatário**: Orquestrador (`42a5e4fc-3e76-480a-9095-8d141e42fba1`)  
**Milestone**: M1 — R1: Impressão e Gestão de Termos de Responsabilidade (Itens 1 a 6)  
**Veredito Empírico**: **APPROVE**  

---

## 1. Observation

### 1.1 Remoção Estrita de Altura Fixa (297mm) e Configuração @page
- **Arquivo inspecionado**: `lib/ops/termo.ts`
  - Linha 192: `@page{size:80mm auto;margin:0}`
  - Linhas 194-197:
    ```css
    html,body{margin:0;padding:0;width:80mm;background:#fff;color:#000}
    body{font:8pt/1.22 Arial,Helvetica,sans-serif}
    .page{position:relative;width:80mm;padding:0 5.7mm 0;display:flex;flex-direction:column;margin:0 auto;background:#fff;break-after:page;page-break-after:always}
    .page:last-child{break-after:auto;page-break-after:auto}
    ```
- **Busca global no repositório**: A busca com `grep_search` por `297mm` revelou que a constante foi 100% eliminada dos arquivos de produção de termos (`lib/ops/termo.ts` e `services/ops-server.ts`). As únicas ocorrências no repositório referem-se à documentação e a asserções negativas de teste (`expect(html).not.toContain('297mm')`), além da impressão do relatório A4 de cronometragem (`services/timing-ui/resultado.html`).

### 1.2 Regras de Quebra de Página e Prevenção de Papel em Branco
- A classe `.page` aplica `break-after: page; page-break-after: always;` para separar participantes quando múltiplos termos são gerados em lote.
- A pseudo-classe `.page:last-child` anula a quebra com `break-after: auto; page-break-after: auto;`, garantindo que a última folha não cause avanço desnecessário da bobina e nem acione guilhotina em espaço em branco.
- O bloco `.assinatura` utiliza `margin: 16mm auto 0; width: 50mm; text-align: center; flex: none; break-inside: avoid; page-break-inside: avoid;`, prevenindo que a linha de assinatura e o texto do responsável legal sejam cindidos ou fragmentados em uma dobra térmica.

### 1.3 Proteção contra Estouro de Linha e Injeção
- A classe `.row` conta com `min-height: 3.81mm; display: block; overflow-wrap: anywhere;`. Mesmo com strings contínuas sem espaçamento (e-mails com mais de 100 caracteres, nomes extensos sem espaço), a quebra ocorre sem estourar a largura útil da bobina de 80mm (~68.6mm de área imprimível).
- As rotinas `esc()`, `value()` e `renderLegal()` neutralizam caracteres maliciosos (`&`, `<`, `>`, `"`, `'`), convertendo tags HTML para entidades de texto seguras (`&lt;script&gt;`, `&quot;&gt;&lt;img ...`).

### 1.4 Resultados da Execução de Testes
1. **Suíte Existente** (`tests/ops/termo.test.ts`):
   ```
   ✓ tests/ops/termo.test.ts (6 tests) 318ms
   Test Files 1 passed (1), Tests 6 passed (6)
   ```
2. **Suíte Adversarial Criada** (`tests/ops/termo-challenger.test.ts`):
   - Desenvolvida especificamente para estressar 15 cenários adversariais:
     - Eliminação de `297mm` em múltiplos cenários (padrão, em branco, múltiplos participantes, texto customizado, lista vazia).
     - Validação da sintaxe CSS `@page { size: 80mm auto; margin: 0; }`.
     - Isolamento de quebra de página por participante e anulação em `:last-child`.
     - Injeção XSS em campos de cliente, empresa e regulamento personalizado.
     - Strings contínuas de 250 caracteres sem espaçamento (`overflow-wrap: anywhere`).
     - Cálculo exato de idade no horário de Brasília (`America/Sao_Paulo`) para datas limítrofes às 21:00 UTC (20:00/21:00 local).
     - Oráculo de estimativa de papel: comprovação de que o termo padrão mede ~186mm, representando economia de 37% a 50% de bobina térmica por impressão.
   ```
   ✓ tests/ops/termo-challenger.test.ts (15 tests) 160ms
   Test Files 1 passed (1), Tests 15 passed (15)
   ```
3. **Execução Conjunta das Suítes de Termo**:
   ```
   ✓ tests/ops/termo.test.ts (6 tests) 80ms
   ✓ tests/ops/termo-challenger.test.ts (15 tests) 96ms
   Test Files 2 passed (2), Tests 21 passed (21)
   ```
4. **Regressão Global de Operações** (`tests/ops/`):
   ```
   Test Files 17 passed (17), Tests 225 passed (225)
   ```
5. **Checagem de Tipagem TypeScript** (`npx tsc --noEmit`):
   - Zero erros em `lib/ops/termo.ts`, `tests/ops/termo.test.ts` e `tests/ops/termo-challenger.test.ts`.

---

## 2. Logic Chain

1. **Premissa de Desperdício na Bobina TM-T20**: A definição herdada de A4 (`297mm`) forçava o spooler do Windows e o motor de renderização a alimentar ~30 cm de papel por piloto, quando o conteúdo textual do termo de responsabilidade do kartódromo necessita de apenas 14 a 19 cm.
2. **Eficácia de `@page { size: 80mm auto; margin: 0; }`**: Ao aplicar `size: 80mm auto` e remover o `min-height: 297mm;` da classe `.page`, o corte é disparado exatamente ao final do bloco de assinaturas, economizando em média ~11 cm de papel por piloto (~5,5 metros a cada 50 pilotos).
3. **Prevenção de Falso Corte na Última Folha**: Em impressões agrupadas, cada participante é encapsulado em uma `<section class="page">`. Com `.page:last-child { break-after: auto; page-break-after: auto; }`, apenas os participantes intermediários sofrem quebra de página. A última seção termina sem quebra, prevenindo a expulsão de um tíquete em branco após o término da impressão.
4. **Imunidade a Nomes Longos e Quebra Horizontal**: O estilo `.row { overflow-wrap: anywhere; }` impede o clipping ou quebra do layout responsivo de 80mm mesmo com entradas anômalas ou e-mails gigantescos gerados no totem.
5. **Conclusão de Integridade**: Diante da comprovação empírica de 21 testes aprovados sem falhas e sem regressão nas 17 suítes de operações, a implementação atende com excelência a todos os requisitos do Item 4 da Milestone M1.

---

## 3. Caveats

- **Driver Físico TM-T20 vs Simulação em WebView2**: Em ambiente de desenvolvimento (macOS), os testes foram executados via runtime Node.js/Vitest validando o DOM gerado e o modelo de caixa CSS. O corte físico real depende da configuração do driver Epson Advanced Printer Driver (APD) estar ajustada para "Page [Feed, Cut]" ou "Document [Feed, Cut]". O HTML gerado fornece os marcadores canônicos `@page` e `page-break` que o WebView2 repassa ao driver.
- **Erros Pré-existentes de Tipagem**: `npx tsc --noEmit` reporta 4 erros em arquivos legados fora do escopo (`lib/ops/endurance.ts` e `tests/timing-33-fixes.test.ts`). Nenhuma violação provém do código de impressão ou do termo.

---

## 4. Conclusion

**Veredito**: **APPROVE**

A eliminação da altura fixa de 297mm e a adoção do layout dinâmico para a bobina térmica Epson TM-T20 (80mm) foram verificadas e validadas empiricamente com total rigor. O código em `lib/ops/termo.ts` é robusto, seguro contra XSS, imune a quebras em nomes anômalos e impede a emissão de páginas em branco no corte de fechamento.

---

## 5. Verification Method

Para reproduzir e verificar independentemente os testes adversariais:

1. **Executar a suíte de termo e a suíte adversarial**:
   ```bash
   npx vitest run tests/ops/termo.test.ts tests/ops/termo-challenger.test.ts
   ```
   *Resultado esperado*: 21 testes aprovados (100%).

2. **Verificar ausência de 297mm em `lib/ops/termo.ts`**:
   ```bash
   grep -n "297mm" lib/ops/termo.ts
   ```
   *Resultado esperado*: Nenhuma ocorrência encontrada.

3. **Executar todas as suítes de testes de operações**:
   ```bash
   npx vitest run tests/ops/
   ```
   *Resultado esperado*: 17 arquivos de teste passando (225 testes no total).
