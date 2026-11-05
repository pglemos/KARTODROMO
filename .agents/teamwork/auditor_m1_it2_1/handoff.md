# Relatório de Auditoria Forense — Milestone M1 Iteração 2

**Data**: 2026-11-02T21:16:00Z  
**Auditor**: Auditor Forense M1 Iteração 2 (`auditor_m1_it2_1`)  
**Destinatário**: Orchestrator Operacional (`88cadb65-7d49-4f0d-a278-9c17ee4251ab`)  
**Alvo da Auditoria**: `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`  
**Modo de Integridade**: `development` (definido em `ORIGINAL_REQUEST.md`)  
**Veredito**: **CLEAN**

---

## Forensic Audit Report

**Work Product**: `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`  
**Profile**: General Project  
**Verdict**: **CLEAN**

### Phase Results
- **Hardcoded output detection**: PASS — Credenciais hardcoded e bypass de login (`teste-codex`, `'gerencia'`) foram completamente removidos de `src/features/auth/sessao.tsx`. Nenhuma resposta fixa para testes identificada.
- **Facade detection**: PASS — `formatarInicioAgenda()` e `hora()` em `src/features/operacao/formato.ts` possuem lógica genuína e defensiva; componentes e utilitários não possuem stubs ou fachadas vazias.
- **Pre-populated artifact detection**: PASS — Não foram encontrados arquivos de log ou resultados pré-populados gerados antes da auditoria.
- **Behavioral verification (`npm test` & `npm run tipos`)**: PASS — 100% de sucesso (11 suítes, 199 testes aprovados, compilação TypeScript limpa).
- **TV files untouched check**: PASS — Nenhum arquivo de TV (`desktop/src/Kartodromo.Cronometragem/FormTV.cs` ou `--tv`) foi tocado na iteração.
- **Zero secret/credential leak check**: PASS — Nenhuma senha, segredo ou token exposto no código ou histórico da iteração.

---

## 1. Observation (Observações Diretas)

### 1.1 Remoção Estrita de Credenciais em `src/features/auth/sessao.tsx`
Foi inspecionado o arquivo `src/features/auth/sessao.tsx` na íntegra.
- As linhas 53-56 da Iteração 1 continham:
  ```typescript
  if (!(await cliente.tokenAtual()) && /^http:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(BASE)) {
    const deviceId = await obterOuCriarDeviceId();
    await cliente.entrar('gerencia', 'teste-codex', deviceId).catch(() => null);
  }
  ```
- No arquivo atual, esse trecho foi **integralmente removido**.
- A inicialização da sessão agora valida apenas a existência prévia de token seguro:
  ```typescript
  47:   useEffect(() => {
  48:     void (async () => {
  49:       try {
  50:         if (await cliente.tokenAtual()) setEu(await cliente.get<Eu>('/me'));
  51:       } catch {
  52:         /* sem rede ou sessão vencida: vai ao login */
  53:       } finally {
  54:         setCarregando(false);
  55:       }
  56:     })();
  57:   }, [cliente]);
  ```
- O método `entrar` agora recebe os parâmetros genuínos do formulário e usa o deviceId persistido:
  ```typescript
  75:     async entrar(u, s) {
  76:       const deviceId = await obterOuCriarDeviceId();
  77:       await cliente.entrar(u, s, deviceId);
  78:       setEu(await cliente.get<Eu>('/me'));
  79:     },
  ```
- O padrão canônico **Component Splitting** foi implementado com `ProvedorSessaoAtivo`, eliminando a violação de *Rules of Hooks*:
  ```typescript
  85: export function ProvedorSessao({ children }: PropsWithChildren) {
  86:   if (!BASE_VALIDA) {
  87:     return <ServidorNaoConfigurado />;
  88:   }
  89:   return <ProvedorSessaoAtivo>{children}</ProvedorSessaoAtivo>;
  90: }
  ```

### 1.2 Varredura Global de Credenciais e Vazamentos
- Execução de busca textual por `teste-codex` em `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`:
  - Encontrado unicamente em `tests/cliente.test.ts:123`, dentro do teste de regressão de integridade:
    `expect(conteudo).not.toContain('teste-codex');`
  - Zero ocorrências em arquivos de código-fonte (`src/`).
- Varredura por campos e termos de senha em `src/`:
  - Apenas campos de UI (`const [senha, setSenha] = useState('')`), labels e assinatura do cliente HTTP (`entrar(u, s, deviceId)`).

### 1.3 Inspeção de `src/features/operacao/formato.ts`
- `hora()` implementa validação estrita de data e fuso horário `America/Sao_Paulo`:
  ```typescript
  22: export const hora = (ms?: number | Date | string | null): string => {
  23:   if (ms == null || ms === '') return '--:--';
  24:   try {
  25:     const d = new Date(ms);
  26:     if (Number.isNaN(d.getTime())) return '--:--';
  27:     return d.toLocaleTimeString('pt-BR', { timeZone: FUSO_HORARIO });
  28:   } catch {
  29:     return '--:--';
  30:   }
  31: };
  ```
- `formatarInicioAgenda()` protege contra strings arbitrárias não-ISO, evitando fatiamento espúrio:
  ```typescript
  55: export const formatarInicioAgenda = (inicio?: string, fallback?: number | string): string => {
  56:   if (!inicio || typeof inicio !== 'string') return String(fallback ?? '');
  57:   const hm = horaMinutoLocal(inicio);
  58:   if (hm !== '--:--') return hm;
  59:   if (HORA_SIMPLES_REGEX.test(inicio)) return inicio;
  60:   if (ISO_HORA_REGEX.test(inicio)) {
  61:     const fatiado = inicio.slice(11, 16);
  62:     if (fatiado) return fatiado;
  63:   }
  64:   return String(fallback ?? '');
  65: };
  ```

### 1.4 Verificação dos Arquivos de TV (`FormTV.cs` / `--tv`)
- Executado:
  ```bash
  find /Users/pedroguilherme/PROJETOS/KARTODROMO -maxdepth 4 -type f -newermt "2026-11-02 20:00:00" ! -path "*/.agents/*" ! -path "*/.git/*"
  ```
  *Resultado*: 0 arquivos modificados no repositório `KARTODROMO` durante todo o Milestone M1.
- O arquivo `desktop/src/Kartodromo.Cronometragem/FormTV.cs` possui timestamp de última modificação `2026-10-25 23:41:21`, confirmando que **NÃO foi alterado** pelo trabalho do Milestone M1.

### 1.5 Execução Independente de Testes e Tipos
Comando executado:
```bash
cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm test && npm run tipos
```
Saída verbatim:
```
> kartodromo-operacional@0.1.0 test
> jest

PASS tests/m1-challenger-stress.test.ts
PASS tests/stress-challenger.test.ts
PASS tests/tier1-features.test.ts
PASS tests/tier2-boundary-corner-cases.test.ts
PASS tests/cliente.test.ts
PASS tests/sorteio.test.ts
PASS tests/tempo-real.test.ts
PASS tests/tier3-cross-feature.test.ts
PASS tests/tier4-lifecycle-e2e.test.ts
PASS tests/baterias.test.ts
PASS tests/formato.test.ts

Test Suites: 11 passed, 11 total
Tests:       199 passed, 199 total
Snapshots:   0 total
Time:        1.531 s
Ran all test suites.

> kartodromo-operacional@0.1.0 tipos
> tsc --noEmit
```
Status de saída: 0. 100% dos testes e asserções aprovados sem advertências ou erros.

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio)

1. **Premissa de Eliminação de Violações Críticas**:
   - O veto emitido na Iteração 1 decorreu da presença de credenciais hardcoded (`'gerencia'`, `'teste-codex'`) em `sessao.tsx` e da quebra de 2 testes em `m1-challenger-stress.test.ts`.
   - A inspeção direta do código fonte e a busca global via grep comprovaram que tais linhas foram eliminadas e substituídas por fluxo seguro de autenticação.
2. **Robustez dos Utilitários e Arquitetura de Componentes**:
   - `formatarInicioAgenda()` valida expressões regulares de ISO e hora simples antes de extrair trechos da string, eliminando o defeito onde `'nao-e-data-valida'` produzia `'valid'`.
   - `hora()` trata de forma defensiva entradas nulas, vazias, `NaN` ou não parseáveis, retornando `'--:--'`.
   - `ProvedorSessao` adota divisão de componentes (`ProvedorSessaoAtivo`), garantindo aderência irrestrita às *Rules of Hooks* do React.
3. **Imutabilidade dos Componentes Protegidos**:
   - Nenhuma modificação foi introduzida no subsistema de TV (`FormTV.cs` / `--tv`).
4. **Validação Comportamental**:
   - Todos os 199 testes nas 11 suítes automatizadas foram executados independentemente pelo auditor e passaram sem erros.
   - A checagem de tipos estáticos do TypeScript (`tsc --noEmit`) foi concluída sem falhas.

---

## 3. Caveats (Ressalvas)

- Os testes unitários e de integração mockam as respostas de rede (`fetch` e SSE) com base nos contratos da API definidos no backend. Os testes end-to-end com hardware real ou simulador conectado (:4150) estão alocados para o Milestone M5 conforme o cronograma do `SCOPE.md`.
- No arquivo `tests/cliente.test.ts`, a string `teste-codex` aparece unicamente em uma asserção de teste estático que confirma sua ausência no arquivo `sessao.tsx`.

---

## 4. Conclusion (Conclusão e Veredito)

Todas as não-conformidades de integridade apontadas na Iteração 1 foram **completamente remediadas e validadas empiricamente**.
- O código-fonte está limpo, sem backdoors, sem credenciais expostas e sem facades.
- A suíte de testes e tipagem estática obteve 100% de sucesso.
- O subsistema de TV permaneceu intocado.

Veredito Final: **CLEAN**.  
O Milestone M1 está **APROVADO** pela auditoria forense.

---

## 5. Verification Method (Método de Verificação Independente)

Para reproduzir e auditar as checagens realizadas:

1. **Verificar ausência de credenciais em `sessao.tsx`**:
   ```bash
   grep -E "(teste-codex|'gerencia')" /Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/features/auth/sessao.tsx
   ```
   *Critério*: Código de saída 1 (nenhuma correspondência).

2. **Executar a suíte completa de testes**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm test
   ```
   *Critério*: 11 test suites passed, 199 tests passed.

3. **Executar verificação de tipos estáticos**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm run tipos
   ```
   *Critério*: Código de saída 0 (`tsc --noEmit`).

4. **Verificar isolamento de arquivos de TV**:
   ```bash
   git -C /Users/pedroguilherme/PROJETOS/KARTODROMO status --short desktop/src/Kartodromo.Cronometragem/FormTV.cs
   ```
   *Critério*: Nenhuma alteração realizada na iteração.
