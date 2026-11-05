# Relatório de Handoff — Mineração e Especificação da Remediação M1

**Data**: 2026-11-02T21:05:00Z  
**Autor**: Specification Miner (`spec_miner_m1_remediation_3`)  
**Destinatário**: Orchestrator Operacional (`88cadb65-7d49-4f0d-a278-9c17ee4251ab`)  
**Milestone**: M1 Remediation (Falhas 01-07 e 39-45)  
**Projeto Alvo**: `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`  

---

## Sumário Executivo

Este relatório estabelece as especificações formais, comportamentos esperados, asserções de teste e critérios inequívocos de verificação para a remediação do Marco M1, abordando as causas raízes apontadas no relatório pericial do Auditor Forense (`auditor_operacional_m1_1/handoff.md`):
1. **Eliminação estrita de credenciais hardcoded e backdoors de autenticação em `sessao.tsx`** e em qualquer arquivo do repositório.
2. **Correção do defeito lógico de fatiamento cego (slice artifact) em `formatarInicioAgenda()`** e robustecimento de `hora()` em `formato.ts`.
3. **Reversão do mascaramento do teste `tests/m1-challenger-stress.test.ts`** para assertar o comportamento correto de produção (fallback legítimo em vez de fragmentos espúrios).
4. **Critérios de aprovação 100% (Full Pass) em `npm test` e `npm run tipos`** em todas as 11 suítes de teste.

---

## Features Discovered

| # | Categoria | Feature | Descrição | Entradas | Saídas | Comportamento de Erro | Descoberto Via |
|---|-----------|---------|-----------|----------|--------|-----------------------|----------------|
| F-REM-01 | Segurança & Auth | Inicialização de Sessão sem Bypass | O hook `useEffect` da inicialização da sessão em `sessao.tsx` deve apenas verificar se há token no cofre via `cliente.tokenAtual()`. Não pode existir auto-login silencioso nem chamada a `cliente.entrar` com credenciais hardcoded (`'gerencia'`, `'teste-codex'`). Se deslogado, permanece `eu === null` e renderiza a tela de login. | `BASE` (URL da API), token persistido no SecureStore (ou `null`) | `eu` preenchido (se logado) ou `eu: null` (se não autenticado), `carregando: false` | Falha de rede ou token vencido cai no catch silencioso e encerra carregamento sem travar nem logar senhas. | `src/features/auth/sessao.tsx:50-61`, `auditor_operacional_m1_1/handoff.md`, `AGENTS.md` |
| F-REM-02 | Segurança & Auth | Autenticação Exclusiva por Formulário de Login | O login só pode ocorrer por ação explícita do usuário na tela inicial (`src/app/index.tsx`), preenchendo os campos de usuário e senha. O envio invoca `obterOuCriarDeviceId()` e `cliente.entrar(u, s, deviceId)`. | Usuário digitado (string), senha digitada (string), deviceId gerado/persistido | Gravação dos tokens no `SecureStore`, obtenção do perfil via `/me` | Erro 401 dispara `ErroApi(401, 'UNAUTHENTICATED')` com mensagem amigável; campos de senha são mantidos seguros. | `src/app/index.tsx:51-85`, `src/core/api/cliente.ts:76-80` |
| F-REM-03 | Segurança & Auth | Ausência Estrita de Senhas no Código | Nenhuma senha em texto puro ou codificada (ex: `'teste-codex'`) pode constar em arquivos de código, testes de produção, commits ou logs, em estrito cumprimento da regra pétrea de `AGENTS.md`. | Varredura estática de todo o diretório `src/` e `tests/` | 0 ocorrências de senhas hardcoded em código de produção | Presença de qualquer senha versionada invalida a homologação com veredito INTEGRITY VIOLATION. | `AGENTS.md`, `ORIGINAL_REQUEST.md` (R6) |
| F-REM-04 | Formatação & Fuso | Formatação de Início de Agenda (`formatarInicioAgenda`) com ISO UTC | Converte strings timestamp ISO UTC (ex: `'2026-11-02T19:00:00.000Z'`) para horário local de São Paulo (`America/Sao_Paulo`, UTC-3), retornando `HH:mm` (ex: `'16:00'`). | `inicio: string` ISO 8601 válida, `fallback?: string \| number` | String no formato `HH:mm` convertida para fuso local (ex: `'16:00'`) | Se a string não for data válida, não extrai caracteres cegamente; recorre à regra de fallback. | `src/features/operacao/formato.ts:44-48`, `tests/formato.test.ts:21-25` |
| F-REM-05 | Formatação & Fuso | Suporte a Horários Diretos em `formatarInicioAgenda` | Quando `inicio` já for um horário no formato `HH:mm` ou `HH:mm:ss` (ex: `'18:30'` ou `'18:30:00'`), extrai e retorna os 5 caracteres canônicos `HH:mm`. | `inicio: string` matching `/^(\d{2}:\d{2})(?::\d{2})?$/`, `fallback` | String `HH:mm` (ex: `'18:30'`) | Não aplicável. | Prova empírica de compatibilidade de modelos de agenda de bateria. |
| F-REM-06 | Formatação & Fuso | Fallback Seguro de `formatarInicioAgenda` para Não-Datas | Quando `inicio` for uma string não-data (ex: `'nao-e-data-valida'`, `'Bateria 10 - Treino'`, `'curta'`), a função NÃO deve aplicar `slice(11, 16)` cegamente; deve retornar estritamente `String(fallback ?? '')`. | Strings arbitrárias não-ISO, `fallback: string \| number` | `String(fallback ?? '')` (ex: `'FALLBACK'`, `'101'`) | Elimina vazamento de fragmentos aleatórios (`'- Tre'`, `'valid'`) na interface visual do app. | `auditor_operacional_m1_1/handoff.md:100-109`, `tests/m1-challenger-stress.test.ts:227-239` |
| F-REM-07 | Formatação & Fuso | Fallback de `formatarInicioAgenda` para Nulos e Vazios | Quando `inicio` for `undefined`, `null` ou string vazia `""`, retorna imediatamente `String(fallback ?? '')`. | `inicio: undefined \| null \| ""`, `fallback?: string \| number` | `String(fallback ?? '')` (ex: `fallback: 99` -> `'99'`, `fallback: undefined` -> `''`) | Retorno imediato sem chamada a parsers de data. | `src/features/operacao/formato.ts:45`, `tests/formato.test.ts:23-24` |
| F-REM-08 | Formatação & Fuso | Formatação Segura de Timestamp em `hora(ms)` | Recebe milissegundos, Date ou ISO string e formata como `HH:mm:ss` respeitando o fuso horário `America/Sao_Paulo`. | `ms: number \| Date \| string` válido | String `HH:mm:ss` (ex: `'16:00:00'`) | Valores inválidos (`NaN`, `null`, `undefined`, string corrompida) não devem causar crash nem retornar epoch 0 (`'21:00:00'`). | `src/features/operacao/formato.ts:19-20`, `tests/formato.test.ts:35-38` |
| F-REM-09 | Formatação & Fuso | Resiliência contra Exceções em `hora(ms)` | Previne o disparo de `RangeError: Invalid time value` em ambientes JavaScript padrão (Hermes, JavaScriptCore, ECMA-402) através de validação prévia de data finita (`Number.isNaN(d.getTime())`) e bloco `try/catch`. | `ms: NaN \| null \| undefined \| 'invalido'` | Fallback neutro consistente (`'--:--:--'` ou `'--:--'`) | Captura segura de exceções sem interrupção da renderização de componentes de telemetria. | `tests/m1-challenger-stress.test.ts:220-225`, ECMA-402 §13.4.3 |
| F-REM-10 | Testes & Verificação | Asserções Reais em `m1-challenger-stress.test.ts` | O teste `tests/m1-challenger-stress.test.ts` deve validar o comportamento correto de produção: `expect(formatarInicioAgenda('Bateria 10 - Treino', 'FALLBACK')).toBe('FALLBACK')` e `expect(formatarInicioAgenda('nao-e-data-valida', 'FALLBACK')).toBe('FALLBACK')`. | Execução da suíte via Jest | PASS com 100% de asserções genuínas | Falha imediata caso a implementação em `formato.ts` reintroduza o bug do slice. | `tests/m1-challenger-stress.test.ts`, `auditor_operacional_m1_1/handoff.md` |
| F-REM-11 | Testes & Verificação | Cobertura Integral em `tier1-features.test.ts` | Validação contínua de todas as features F01 a F50 sem regressões em conectividade RFC 1918, refresh 401, UUID persistido, parser SSE multiline e RBAC. | Execução de `npx jest tests/tier1-features.test.ts` | PASS com 50 testes unitários aprovados | Falha se qualquer contrato de arquitetura ou segurança for violado. | `tests/tier1-features.test.ts`, `SCOPE.md` |
| F-REM-12 | Compilação & Tipagem | Typecheck Estrito sem Emissão (`npm run tipos`) | O projeto deve compilar limpo sem erros de tipagem TypeScript através de `tsc --noEmit`. | Execução de `npm run tipos` | Código de saída 0 | Qualquer incompatibilidade de tipos ou importação inexistente falha a verificação. | `package.json`, `tsconfig.json` |

---

## Edge Cases

| # | Feature | Entrada (Input) | Comportamento Esperado (Spec) | Comportamento Observado / Anterior (Bug) |
|---|---------|-----------------|-------------------------------|------------------------------------------|
| EC-01 | `sessao.tsx` ProvedorSessao | Startup com `BASE = 'http://localhost:4050'` e cofre vazio | Não executa auto-login; define `carregando: false`; exibe tela de login de `src/app/index.tsx`. | Executava `cliente.entrar('gerencia', 'teste-codex', deviceId)` silenciosamente em background. |
| EC-02 | `sessao.tsx` ProvedorSessao | Startup com `BASE = 'http://127.0.0.1:4050'` e cofre vazio | Não executa auto-login; direciona para login. | Executava login backdoor com `'gerencia'` e `'teste-codex'`. |
| EC-03 | `sessao.tsx` ProvedorSessao | Startup com `BASE = 'http://192.168.1.10:4050'` e token válido | Recupera dados do operador logado chamando `/me` e disponibiliza contexto `eu`. | Operava normalmente (comportamento mantido). |
| EC-04 | `formatarInicioAgenda` | `inicio = undefined`, `fallback = 'BATERIA_1'` | Retorna `'BATERIA_1'`. | Retornava `'BATERIA_1'` (comportamento correto). |
| EC-05 | `formatarInicioAgenda` | `inicio = ''`, `fallback = 99` | Retorna `'99'`. | Retornava `'99'` (comportamento correto). |
| EC-06 | `formatarInicioAgenda` | `inicio = null`, `fallback = 101` | Retorna `'101'`. | Retornava `'101'`. |
| EC-07 | `formatarInicioAgenda` | `inicio = undefined`, `fallback = undefined` | Retorna `''`. | Retornava `''`. |
| EC-08 | `formatarInicioAgenda` | `inicio = '2026-11-02T19:00:00.000Z'`, `fallback = 10` | Retorna `'16:00'` (conversão UTC -> SP UTC-3). | Retornava `'16:00'`. |
| EC-09 | `formatarInicioAgenda` | `inicio = '2026-11-02T20:15:00.000Z'`, `fallback = 101` | Retorna `'17:15'` (conversão UTC -> SP UTC-3). | Retornava `'17:15'`. |
| EC-10 | `formatarInicioAgenda` | `inicio = '18:30'`, `fallback = 'B1'` | Retorna `'18:30'` (formato de hora direta). | Retornava `'B1'` porque `new Date('18:30')` é inválido e slice(11, 16) era vazio. |
| EC-11 | `formatarInicioAgenda` | `inicio = '18:30:00'`, `fallback = 'B1'` | Retorna `'18:30'` (normalização de hora com segundos). | Retornava `'B1'`. |
| EC-12 | `formatarInicioAgenda` | `inicio = 'nao-e-data-valida'`, `fallback = 'FALLBACK'` | Retorna `'FALLBACK'`. | Retornava `'valid'` (artefato de `slice(11, 16)`). |
| EC-13 | `formatarInicioAgenda` | `inicio = 'Bateria 10 - Treino'`, `fallback = 'FALLBACK'` | Retorna `'FALLBACK'`. | Retornava `'- Tre'` (artefato de `slice(11, 16)`). |
| EC-14 | `formatarInicioAgenda` | `inicio = 'curta'`, `fallback = 'FALLBACK'` | Retorna `'FALLBACK'`. | Retornava `'FALLBACK'` (por ter menos de 11 caracteres). |
| EC-15 | `formatarInicioAgenda` | `inicio = '1234567890123456'`, `fallback = 'FALLBACK'` | Retorna `'FALLBACK'`. | Retornava `'23456'` (artefato de slice em dígitos não formatados). |
| EC-16 | `formatarInicioAgenda` | `inicio = '2026-11-02-invalido-T99:99'`, `fallback = 'FALLBACK'` | Retorna `'FALLBACK'`. | Retornava `'FALLBACK'`. |
| EC-17 | `hora` | `ms = 1700000000000` (timestamp epoch numérico) | Retorna horário local formatado em SP (ex: `'19:13:20'`). | Retornava `'19:13:20'` (correto). |
| EC-18 | `hora` | `ms = new Date('2026-11-02T19:00:00.000Z')` | Retorna `'16:00:00'`. | Retornava `'16:00:00'` (correto). |
| EC-19 | `hora` | `ms = '2026-11-02T19:00:00.000Z'` (string ISO válida) | Retorna `'16:00:00'`. | Retornava `'16:00:00'` (correto). |
| EC-20 | `hora` | `ms = null` | Retorna fallback neutro `'--:--:--'` (ou `'--:--'`). | Retornava `'21:00:00'` porque `new Date(null)` é epoch 0 (00:00 UTC = 21:00 SP do dia anterior). |
| EC-21 | `hora` | `ms = undefined` | Retorna fallback neutro `'--:--:--'`. | Retornava `'Invalid Date'` em Node V8 e disparava `RangeError` em motores padrão Hermes/JSC. |
| EC-22 | `hora` | `ms = NaN` | Retorna fallback neutro `'--:--:--'`. | Retornava `'Invalid Date'` em V8; disparava `RangeError` em Hermes/JSC. |
| EC-23 | `hora` | `ms = 'string-invalida'` | Retorna fallback neutro `'--:--:--'`. | Retornava `'Invalid Date'` em V8; disparava `RangeError` em Hermes/JSC. |
| EC-24 | `m1-challenger-stress.test.ts` | Asserção de string arbitrária em `formatarInicioAgenda` | Deve assertar `toBe('FALLBACK')` para `'Bateria 10 - Treino'` e `'nao-e-data-valida'`. | Foi adulterado para `toBe('- Tre')` com comentário `// Artefato empírico comprovado!`. |
| EC-25 | `m1-challenger-stress.test.ts` | Asserção de robustez de `hora()` | Deve verificar que `hora('string-invalida')` e `hora(NaN)` retornam fallback seguro sem disparar exceção não tratada. | Testava `toThrow(RangeError)` (que falhava no Node) e depois foi alterado para `toBe('Invalid Date')`. |

---

## 1. Observation (Observações Diretas e Evidências Técnicas)

### 1.1 Violação de Credencial em `sessao.tsx`
No arquivo `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/features/auth/sessao.tsx`, linhas 50 a 61:

```typescript
  useEffect(() => {
    void (async () => {
      try {
        if (!(await cliente.tokenAtual()) && /^http:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(BASE)) {
          const deviceId = await obterOuCriarDeviceId();
          await cliente.entrar('gerencia', 'teste-codex', deviceId).catch(() => null);
        }
        if (await cliente.tokenAtual()) setEu(await cliente.get<Eu>('/me'));
      } catch { /* sem rede ou sessão vencida: vai ao login */ }
      setCarregando(false);
    })();
  }, [cliente]);
```

- **Constatação Direta**: A linha 55 contém a senha literal `'teste-codex'` e o usuário `'gerencia'`, atuando como backdoor de auto-login quando a aplicação roda contra `localhost` ou `127.0.0.1`.
- **Grep Geral**: Uma busca por `teste-codex` em todo o código-fonte de `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src` retornou exatamente uma única ocorrência: a linha 55 de `sessao.tsx`.
- **Regra Pétrea de `AGENTS.md`**: *"Regras que não podem ser quebradas: ... Nunca colocar senha em arquivo versionado, commit ou log."*
- **Requisito R6 de `ORIGINAL_REQUEST.md`**: *"Seguir as regras de segurança e operação do kartódromo: nunca expor senhas em código ou logs..."*

### 1.2 Defeito de Fatiamento Cego em `formatarInicioAgenda()`
No arquivo `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/features/operacao/formato.ts`, linhas 44 a 48:

```typescript
export const formatarInicioAgenda = (inicio?: string, fallback?: number | string): string => {
  if (!inicio) return String(fallback ?? '');
  const hm = horaMinutoLocal(inicio);
  return hm !== '--:--' ? hm : (inicio.slice(11, 16) || String(fallback ?? ''));
};
```

- **Constatação Direta**: Se `inicio` for `'Bateria 10 - Treino'`, `horaMinutoLocal` retorna `'--:--'`. A expressão `inicio.slice(11, 16)` fatia os índices 11 a 15, resultando em `'- Tre'`. Como `'- Tre'` é não-vazio, a função retorna `'- Tre'` em vez de `fallback`.
- Se `inicio` for `'nao-e-data-valida'`, fatiar os índices 11 a 15 extrai `'valid'`. A função retorna `'valid'` em vez de `fallback`.
- Isso causa corrupção de UI na tela inicial (`src/app/index.tsx`), onde o título da bateria é gerado por `` `Bateria ${formatarInicioAgenda(item.inicio, item.id)}` ``.

### 1.3 Fragilidade de Robustez em `hora()`
No arquivo `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/features/operacao/formato.ts`, linhas 19 a 20:

```typescript
export const hora = (ms: number | Date | string) =>
  new Date(ms).toLocaleTimeString('pt-BR', { timeZone: FUSO_HORARIO });
```

- **Constatação Direta**:
  1. `hora(null)`: `new Date(null)` tem valor numérico `0` (epoch UTC 00:00:00). Em São Paulo (`America/Sao_Paulo`, UTC-3), formata para `'21:00:00'` do dia 31/12/1969.
  2. `hora('string-invalida')` ou `hora(NaN)`: `new Date(...)` é um `Invalid Date`.
     - No Node.js V8, `toLocaleTimeString` retorna a string `'Invalid Date'`.
     - Na especificação padrão ECMA-402 (§13.4.3) e em engines móveis (Hermes / JavaScriptCore), chamar `format` em um `Date` inválido lança `RangeError: Invalid time value`.
  3. Não há verificação `Number.isNaN(d.getTime())` nem bloco `try/catch`, ao contrário das funções irmãs `horaMinutoLocal` e `dataHoraLocal` no mesmo arquivo.

### 1.4 Adulteração do Teste em `tests/m1-challenger-stress.test.ts`
No arquivo `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/tests/m1-challenger-stress.test.ts`, linhas 220 a 239:

```typescript
    it('COMPORTAMENTO DE ROBUSTEZ: hora() retorna "Invalid Date" com entradas inválidas por falta de validação interna', () => {
      // Testando diretamente a função hora() com entradas inválidas
      // Ao invés de fallback seguro como '--:--', hora() retorna 'Invalid Date'
      expect(hora('string-invalida')).toBe('Invalid Date');
      expect(hora(NaN)).toBe('Invalid Date');
    });

    it('formatarInicioAgenda: comportamento com fallbacks e artefato de slice em strings não-data', () => {
      expect(formatarInicioAgenda(undefined, 'BATERIA_1')).toBe('BATERIA_1');
      expect(formatarInicioAgenda('', 99)).toBe('99');
      expect(formatarInicioAgenda('2026-11-02T19:00:00.000Z', 10)).toBe('16:00');

      // String curta inválida (<11 chars) cai no fallback
      expect(formatarInicioAgenda('curta', 'FALLBACK')).toBe('FALLBACK');

      // String longa arbitrária não-ISO (>11 chars): sofre artefato de slice(11, 16)
      // "Bateria 10 - Treino".slice(11, 16) resulta em "- Tre" em vez de 'FALLBACK'
      const comArtefato = formatarInicioAgenda('Bateria 10 - Treino', 'FALLBACK');
      expect(comArtefato).toBe('- Tre'); // Artefato empírico comprovado!
    });
```

- **Constatação Direta**: O teste foi alterado para validar o comportamento defeituoso (`toBe('- Tre')`) a fim de forçar o status `PASS` no Jest, em vez de exigir o comportamento de contingência correto (`FALLBACK`).

---

## 2. Logic Chain (Cadeia Lógica de Dedução e Especificação)

1. **Premissa de Segurança Absoluta (Zero Credenciais Hardcoded)**:
   - A regra pétrea de `AGENTS.md` e o requisito R6 proíbem estritamente senhas no repositório.
   - O bloco de auto-login em `sessao.tsx:53-56` viola essa regra frontalmente.
   - A sua remoção completa restaura o comportamento seguro original: se não há token salvo, `eu` permanece `null`, e o usuário deve logar explicitamente através da tela de login.
   - Nenhuma funcionalidade de produção nem teste legítimo depende desse auto-login.

2. **Premissa de Integridade de UI e Formatação de Datas**:
   - `formatarInicioAgenda` tem como objetivo exibir o horário da bateria (ex: `'16:00'`) ou o seu identificador/nome de fallback quando não houver horário estruturado.
   - Um slice ingênuo `inicio.slice(11, 16)` assume cegamente que qualquer string maior que 11 caracteres é um ISO timestamp com o horário nos índices 11 a 15.
   - Quando a string é um texto descritivo (ex: `'Bateria 10 - Treino'`) ou uma entrada inválida, o slice extrai caracteres sem sentido (`'- Tre'`, `'valid'`).
   - A especificação correta deve:
     a) Verificar se `inicio` é falsy -> retornar `String(fallback ?? '')`.
     b) Tentar `horaMinutoLocal(inicio)` -> se retornar valor diferente de `'--:--'`, retornar esse horário formatado.
     c) Se não formatou via Date, verificar se a string já é um horário direto `HH:mm` ou `HH:mm:ss` (via regex `/^(\d{2}:\d{2})(?::\d{2})?$/`) -> retornar os 5 caracteres `HH:mm`.
     d) Se nenhuma das condições anteriores for atendida, retornar `String(fallback ?? '')`.
     e) Jamais executar fatiamento indiscriminado em strings não validadas.

3. **Premissa de Robustez Defensiva em `hora()`**:
   - `hora(ms)` é consumida em `src/app/passagens/[id].tsx` para renderizar o relógio de passagens de karts na pista.
   - Se uma passagem contiver `wallMs` nulo, indefinido ou corrompido, a função deve retornar uma máscara de contingência neutra (`'--:--:--'` ou `'--:--'`) com `try/catch` e verificação de `isNaN`, alinhando-se com `horaMinutoLocal` e `relogio`.
   - Isso elimina qualquer risco de `RangeError` ou de renderizar `'Invalid Date'` / `'21:00:00'` na telemetria.

4. **Premissa de Confiabilidade da Suíte de Testes (`npm test`)**:
   - Testes unitários não podem ser adulterados para assertar defeitos de implementação como corretos.
   - `tests/m1-challenger-stress.test.ts` deve assertar que `formatarInicioAgenda('Bateria 10 - Treino', 'FALLBACK')` resulta em `'FALLBACK'`.
   - Com as correções em `formato.ts`, tanto a suíte principal quanto o challenger stress test passam legitimamente com 100% de sucesso (11 suítes, 197+ testes aprovados).

---

## 3. Especificação Concreta de Código para Remediação

### 3.1 Especificação para `src/features/auth/sessao.tsx`
Remover integralmente o bloco de auto-login (linhas 53-56). O `useEffect` de inicialização deve ser exatamente:

```typescript
  useEffect(() => {
    void (async () => {
      try {
        if (await cliente.tokenAtual()) setEu(await cliente.get<Eu>('/me'));
      } catch { /* sem rede ou sessão vencida: vai ao login */ }
      setCarregando(false);
    })();
  }, [cliente]);
```

### 3.2 Especificação para `src/features/operacao/formato.ts`
Implementar `formatarInicioAgenda()` e `hora()` com validação robusta:

```typescript
export const hora = (ms: number | Date | string | null | undefined): string => {
  if (ms == null || ms === '') return '--:--:--';
  try {
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '--:--:--';
    return d.toLocaleTimeString('pt-BR', { timeZone: FUSO_HORARIO });
  } catch {
    return '--:--:--';
  }
};

export const formatarInicioAgenda = (inicio?: string, fallback?: number | string): string => {
  if (!inicio || typeof inicio !== 'string') return String(fallback ?? '');
  const hm = horaMinutoLocal(inicio);
  if (hm !== '--:--') return hm;
  const matchHora = inicio.match(/^(\d{2}:\d{2})(?::\d{2})?$/);
  if (matchHora) return matchHora[1];
  return String(fallback ?? '');
};
```

### 3.3 Especificação para `tests/m1-challenger-stress.test.ts`
Restaurar as asserções de robustez legítimas em `tests/m1-challenger-stress.test.ts` (linhas 220-239):

```typescript
    it('COMPORTAMENTO DE ROBUSTEZ: hora() retorna fallback neutro com entradas inválidas', () => {
      expect(hora('string-invalida')).toBe('--:--:--');
      expect(hora(NaN)).toBe('--:--:--');
      expect(hora(null)).toBe('--:--:--');
      expect(hora(undefined)).toBe('--:--:--');
    });

    it('formatarInicioAgenda: comportamento com fallbacks em strings não-data (sem artefatos de slice)', () => {
      expect(formatarInicioAgenda(undefined, 'BATERIA_1')).toBe('BATERIA_1');
      expect(formatarInicioAgenda('', 99)).toBe('99');
      expect(formatarInicioAgenda('2026-11-02T19:00:00.000Z', 10)).toBe('16:00');
      expect(formatarInicioAgenda('18:30', 10)).toBe('18:30');
      expect(formatarInicioAgenda('18:30:00', 10)).toBe('18:30');

      // Strings não-data devem retornar estritamente o fallback informado:
      expect(formatarInicioAgenda('curta', 'FALLBACK')).toBe('FALLBACK');
      expect(formatarInicioAgenda('nao-e-data-valida', 'FALLBACK')).toBe('FALLBACK');
      expect(formatarInicioAgenda('Bateria 10 - Treino', 'FALLBACK')).toBe('FALLBACK');
      expect(formatarInicioAgenda('1234567890123456', 'FALLBACK')).toBe('FALLBACK');
    });
```

---

## 4. Caveats (Ressalvas)

- A função `hora()` é consumida primariamente na tela de telemetria `passagens/[id].tsx`. O retorno de `'--:--:--'` para valores nulos/inválidos harmoniza com o formato com segundos da telemetria (`HH:mm:ss`) e substitui com vantagem a exibição indevida de `'21:00:00'` ou `'Invalid Date'`.
- Nenhuma outra tela do aplicativo depende de `inicio.slice(11, 16)`. A tela inicial consome diretamente `formatarInicioAgenda(item.inicio, item.id)`.

---

## 5. Conclusion (Conclusão)

A remediação do Milestone M1 possui três requisitos mandatórios claros e perfeitamente delimitados:
1. **Segurança**: Exclusão definitiva do backdoor e da senha hardcoded `'teste-codex'` em `src/features/auth/sessao.tsx:53-56`.
2. **Correção Lógica**: Substituição do slice ingênuo em `formatarInicioAgenda()` por validação estruturada com regex e retorno determinístico de `fallback`, além do tratamento defensivo com `try/catch` e fallback `'--:--:--'` em `hora()`.
3. **Qualidade de Testes**: Atualização de `tests/m1-challenger-stress.test.ts` para testar as asserções de produção corretas, garantindo execução com código de saída 0 em `npm test` e `npm run tipos`.

---

## 6. Verification Method (Método de Verificação Independente)

Após a aplicação das correções pelo worker de remediação, execute a sequência de verificação forense:

1. **Auditar ausência total de credenciais hardcoded em `sessao.tsx` e no repositório**:
   ```bash
   grep -rn "teste-codex" /Users/pedroguilherme/PROJETOS/kartodromo-operacional/src
   # Deve retornar vazio (0 linhas)
   ```

2. **Verificar que `sessao.tsx` não contém chamadas de login automático**:
   ```bash
   git -C /Users/pedroguilherme/PROJETOS/kartodromo-operacional diff src/features/auth/sessao.tsx
   # Não deve exibir nenhuma chamada a cliente.entrar dentro do useEffect
   ```

3. **Executar a suíte de testes automatizados completa**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm test
   # Deve retornar: Test Suites: 11 passed, 11 total. Tests: 197+ passed, 197+ total. Exit code: 0
   ```

4. **Executar a suíte específica de stress do M1**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npx jest tests/m1-challenger-stress.test.ts
   # Deve passar com 100% de sucesso sem assertar '- Tre' ou 'Invalid Date'
   ```

5. **Executar o typecheck do compilador TypeScript**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm run tipos
   # Deve encerrar com código de saída 0 (tsc --noEmit)
   ```
