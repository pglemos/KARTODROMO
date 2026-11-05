# Relatório de Handoff — Remediação de Integridade e Arquitetura de Sessão (M1)

**Data**: 2026-11-02T21:01:00Z  
**Autor**: Explorer 1 — Remediação M1 (`explorer_m1_remediation_1`)  
**Destinatário**: Orchestrator Operacional (`88cadb65-7d49-4f0d-a278-9c17ee4251ab`)  
**Milestone**: M1 Remediation (Falhas 01-07 e 39-45)  
**Arquivo Alvo**: `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/features/auth/sessao.tsx`  

---

## 1. Observation (Observações Diretas)

### 1.1 Credenciais Hardcoded e Backdoor de Auto-Login em `sessao.tsx`
No arquivo `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/features/auth/sessao.tsx`, linhas 50 a 61:

```typescript
50:   useEffect(() => {
51:     void (async () => {
52:       try {
53:         if (!(await cliente.tokenAtual()) && /^http:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(BASE)) {
54:           const deviceId = await obterOuCriarDeviceId();
55:           await cliente.entrar('gerencia', 'teste-codex', deviceId).catch(() => null);
56:         }
57:         if (await cliente.tokenAtual()) setEu(await cliente.get<Eu>('/me'));
58:       } catch { /* sem rede ou sessão vencida: vai ao login */ }
59:       setCarregando(false);
60:     })();
61:   }, [cliente]);
```

- **Verbatim Leak**: A linha 55 contém a senha literal `'teste-codex'` e o usuário `'gerencia'` passados como argumentos para `cliente.entrar()`.
- **Bypass Silencioso**: A condição da linha 53 intercepta a inicialização do app quando `BASE` aponta para `localhost` ou `127.0.0.1`, forçando um login automático em segundo plano e ocultando a tela de login legítima (`<Login />`).
- **Conflito com Regras Pétreas**:
  - `AGENTS.md`: *"Regras que não podem ser quebradas: ... Nunca colocar senha em arquivo versionado, commit ou log."*
  - `ORIGINAL_REQUEST.md` (R6): *"Seguir as regras de segurança e operação do kartódromo: nunca expor senhas em código ou logs..."*

### 1.2 Violação das "Rules of Hooks" do React em `ProvedorSessao`
No arquivo `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/features/auth/sessao.tsx`, linhas 40 a 49:

```typescript
40: export function ProvedorSessao({ children }: PropsWithChildren) {
41:   if (!BASE_VALIDA) {
42:     return <ServidorNaoConfigurado />;
43:   }
44:   const [eu, setEu] = useState<Eu | null>(null);
45:   const [carregando, setCarregando] = useState(true);
46:   const [tempoReal, despachar] = useReducer(redutor, estadoInicial);
47:   const fluxo = useRef<ReturnType<typeof conectarFluxo> | null>(null);
48:   const cliente = useMemo(() => criarCliente({ base: BASE, fetch, cofre: cofreSeguro, aoSair: () => { setEu(null); despachar({ t: 'zerar' }); } }), []);
```

- **Early Return antes de Hooks**: O bloco `if (!BASE_VALIDA) return <ServidorNaoConfigurado />;` nas linhas 41-43 ocorre **antes** das declarações de hooks:
  - 2 x `useState` (linhas 44, 45)
  - 1 x `useReducer` (linha 46)
  - 1 x `useRef` (linha 47)
  - 1 x `useMemo` (linha 48)
  - 3 x `useEffect` (linhas 50, 63, 75)
- **Impacto**: Violação direta da regra fundamental do React (*"Don't call Hooks inside loops, conditions, or nested functions. Always use Hooks at the top level of your React function, before any early returns"*). Caso `BASE_VALIDA` seja falso, zero hooks são chamados; se verdadeiro, 8 hooks são executados. Em builds de produção, Fast Refresh ou testes com mock de variáveis de ambiente, isso acarreta falhas catastróficas de conciliação de estado no React Fiber (`Rendered fewer hooks than expected`).

### 1.3 Estado Atual dos Testes Automatizados no Projeto
Execução via terminal em `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`:
```bash
$ npm test
Test Suites: 11 passed, 11 total
Tests:       197 passed, 197 total
Snapshots:   0 total
Time:        0.601 s

$ npm run tipos
> tsc --noEmit (código 0, sem erros)
```
A suíte completa de testes já compila e executa com sucesso; contudo, a persistência do backdoor e da violação de hooks em `sessao.tsx` impede a homologação de integridade.

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio)

1. **Premissa 1: Segurança e Sigilo de Credenciais**:
   - Nenhuma senha ou bypass de credencial pode constar no código-fonte sob qualquer condição (`AGENTS.md` e Requisito R6).
   - O aplicativo móvel já possui tela completa e reativa de login em `src/app/index.tsx` (`<Login />`), que captura as credenciais fornecidas pelo operador e invoca `entrar(u, s)`.
   - Ao eliminar o bloco condicional de auto-login das linhas 53-56, o fluxo nativo é restaurado: se `cliente.tokenAtual()` for nulo, `eu` permanece `null`, `carregando` transiciona para `false` no bloco `finally`, e o app exibe a tela de login.

2. **Premissa 2: Conformidade Estrita com Rules of Hooks**:
   - Hooks não podem ser chamados após retornos antecipados.
   - A técnica canônica e idiomática no ecossistema React para renderização condicional protegida é o **Component Splitting**:
     - `ProvedorSessao`: atua como guarda puramente declarativo. Se `!BASE_VALIDA`, renderiza `<ServidorNaoConfigurado />`; se válida, renderiza `<ProvedorSessaoAtivo>{children}</ProvedorSessaoAtivo>`. Este componente não declara nenhum hook.
     - `ProvedorSessaoAtivo`: componente interno que inicializa todos os hooks no nível raiz, incondicionalmente, sem qualquer `return` prematuro antes dos hooks.
   - Isso elimina qualquer risco de inconsistência na contagem de hooks do React Fiber e atende 100% às diretrizes de conformidade estática.

3. **Premissa 3: Robustez de Inicialização**:
   - Na função assíncrona do `useEffect` de inicialização, `setCarregando(false)` deve ser movido para a cláusula `finally` para garantir que, mesmo em caso de erro de rede ou rejeição inesperada, o estado de carregamento seja liberado e a tela de login seja acessível.

---

## 3. Caveats (Ressalvas)

- O relatório de auditoria forense anterior (`auditor_operacional_m1_1/handoff.md`) mencionou um defeito secundário em `formatarInicioAgenda()` (`src/features/operacao/formato.ts`) e auto-bloqueio sem trim (`src/app/usuarios.tsx`). Essas correções foram atribuídas em paralelo ao `explorer_m1_remediation_2` e mantêm fronteiras ortogonais ao módulo de autenticação.
- O tipo `perfil` em `Eu` (`src/features/auth/sessao.tsx:11`) contém a literal `'GERENCIA'` em maiúsculas (`'RECEPCAO' | 'OPERACAO' | 'GERENCIA'`). Testes de integridade automatizados não devem fazer match case-insensitive ingênuo com `gerencia`, mas sim assegurar que a literal de usuário `'gerencia'` com aspas em chamadas `entrar(...)` foi eliminada.

---

## 4. Conclusion (Conclusão e Estratégia de Correção)

A estratégia de remediação foi formulada, validada e disponibilizada em dois artefatos prontos para aplicação pelo Worker:
1. **Patch Unificado**: `.agents/teamwork/explorer_m1_remediation_1/sessao_remediation.patch`
2. **Arquivo Proposto Integral**: `.agents/teamwork/explorer_m1_remediation_1/proposed_sessao.tsx`

### 4.1 Snippet de Comparação Linha a Linha (Before → After)

#### A. Separação de Componentes e Eliminação do Early Return antes dos Hooks
**Antes (Linhas 40-44 de `src/features/auth/sessao.tsx`):**
```typescript
export function ProvedorSessao({ children }: PropsWithChildren) {
  if (!BASE_VALIDA) {
    return <ServidorNaoConfigurado />;
  }
  const [eu, setEu] = useState<Eu | null>(null);
  const [carregando, setCarregando] = useState(true);
```

**Depois (Conformidade com Rules of Hooks):**
```typescript
function ProvedorSessaoAtivo({ children }: PropsWithChildren) {
  const [eu, setEu] = useState<Eu | null>(null);
  const [carregando, setCarregando] = useState(true);
  ...
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function ProvedorSessao({ children }: PropsWithChildren) {
  if (!BASE_VALIDA) {
    return <ServidorNaoConfigurado />;
  }
  return <ProvedorSessaoAtivo>{children}</ProvedorSessaoAtivo>;
}
```

#### B. Remoção do Backdoor de Credenciais e Auto-Login
**Antes (Linhas 50-61 de `src/features/auth/sessao.tsx`):**
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

**Depois (Remoção total de senhas e auto-login; uso de `finally`):**
```typescript
  useEffect(() => {
    void (async () => {
      try {
        if (await cliente.tokenAtual()) {
          setEu(await cliente.get<Eu>('/me'));
        }
      } catch {
        /* sem rede ou sessão vencida: vai ao login */
      } finally {
        setCarregando(false);
      }
    })();
  }, [cliente]);
```

### 4.2 Proposta de Testes de Regressão para o Worker
Recomenda-se adicionar os seguintes testes no arquivo de suíte do cliente (`tests/cliente.test.ts`):

```typescript
  it('sessao.tsx não possui credenciais hardcoded nem bypass de login', () => {
    const fs = require('node:fs');
    const conteudo = fs.readFileSync('src/features/auth/sessao.tsx', 'utf8');
    expect(conteudo).not.toContain('teste-codex');
    expect(conteudo).not.toContain("'gerencia'");
    expect(conteudo).not.toMatch(/entrar\s*\(\s*['"][^'"]+['"]\s*,\s*['"][^'"]+['"]/);
  });

  it('ProvedorSessao respeita as Rules of Hooks através de separação de componentes', () => {
    const fs = require('node:fs');
    const conteudo = fs.readFileSync('src/features/auth/sessao.tsx', 'utf8');
    expect(conteudo).toContain('function ProvedorSessaoAtivo');
    expect(conteudo).toMatch(/export function ProvedorSessao[\s\S]*?<ProvedorSessaoAtivo>/);
  });
```

---

## 5. Verification Method (Método de Verificação Independente)

Para auditar e validar a remediação:

1. **Inspeção de Ausência de Segredos**:
   ```bash
   grep -n "teste-codex" /Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/features/auth/sessao.tsx
   grep -n "'gerencia'" /Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/features/auth/sessao.tsx
   ```
   *Condição de invalidação*: Qualquer ocorrência dessas strings invalida o handoff.

2. **Aplicação do Patch e Checagem de Tipos**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm run tipos
   ```
   *Condição de sucesso*: Saída com código 0 (`tsc --noEmit`).

3. **Execução da Suíte Completa de Testes**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm test
   ```
   *Condição de sucesso*: Todas as suítes (11 suites, 197+ testes) aprovadas com código 0.

4. **Auditoria Estática de Hooks**:
   Verificar que a declaração `export function ProvedorSessao` não invoca nenhum hook antes do retorno de `<ServidorNaoConfigurado />`, e que todos os hooks do ciclo de vida residem exclusivamente no corpo incondicional de `ProvedorSessaoAtivo`.
