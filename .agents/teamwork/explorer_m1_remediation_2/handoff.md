# Relatório de Handoff — Remediação de Formatação e Auto-Bloqueio (M1)

**Data**: 2026-11-02T21:05:00Z  
**Autor**: Explorer 2 (`explorer_m1_remediation_2`)  
**Destinatário**: Orchestrator Operacional (`88cadb65-7d49-4f0d-a278-9c17ee4251ab`)  
**Milestone**: Milestone M1 (Remediação de Falhas Técnicas, Fuso Horário e Administração)  
**Projeto Alvo**: `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`  
**Arquivos Produzidos**:
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_remediation_2/remediation_m1_explorer_2.patch` (Patch Git Unificado pronto para aplicação)
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_remediation_2/proposed_formato.ts` (Conteúdo completo proposto para `formato.ts`)

---

## 1. Observation (Observações Diretas)

### 1.1 Fatiamento Espúrio de Strings em `formatarInicioAgenda()`
No arquivo `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/features/operacao/formato.ts`, linhas 44 a 48:

```typescript
export const formatarInicioAgenda = (inicio?: string, fallback?: number | string): string => {
  if (!inicio) return String(fallback ?? '');
  const hm = horaMinutoLocal(inicio);
  return hm !== '--:--' ? hm : (inicio.slice(11, 16) || String(fallback ?? ''));
};
```

- **Comportamento Observado**:
  - Quando `inicio` não é parseável como data válida por `horaMinutoLocal` (ex.: strings de teste ou títulos descritivos de baterias como `"Bateria 10 - Treino"` ou `"nao-e-data-valida"`), `horaMinutoLocal` retorna `'--:--'`.
  - A expressão `inicio.slice(11, 16)` extrai cegamente os caracteres do índice 11 ao 15.
    - Para `"Bateria 10 - Treino"`, extrai `"- Tre"`. Em `src/app/index.tsx` (linhas 230 e 448: `item.nome ?? 'Bateria ' + formatarInicioAgenda(item.inicio, item.id)`), o título da bateria torna-se `"Bateria - Tre"` em vez de utilizar o ID fallback `"Bateria 10"`.
    - Para `"nao-e-data-valida"`, extrai `"valid"` em vez do fallback `'FALLBACK'`.
  - Quando `inicio` é um horário simples já pré-formatado (ex.: `"14:30"`):
    - `new Date('14:30')` resulta em `Invalid Date` no ECMAScript/V8. `horaMinutoLocal` retorna `'--:--'`.
    - `"14:30".slice(11, 16)` resulta em `""` (string vazia).
    - A função descarta o horário válido `"14:30"` e devolve o fallback (ex.: `10`), suprimindo o horário da bateria na interface.

### 1.2 Ausência de Blindagem Defensiva em `hora()`
No arquivo `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/features/operacao/formato.ts`, linhas 19 e 20:

```typescript
export const hora = (ms: number | Date | string) =>
  new Date(ms).toLocaleTimeString('pt-BR', { timeZone: FUSO_HORARIO });
```

- **Comportamento Observado**:
  - `hora()` é consumida em `src/app/passagens/[id].tsx` (linha 134: `<Selo texto={'HORÁRIO ' + hora(sel.wallMs)} />` e linha 288: `<Suave tam={13}>{hora(p.wallMs)}</Suave>`).
  - Ao contrário de `dataHoraLocal` e `horaMinutoLocal`, `hora()` não continha bloco `try/catch`, nem validação `Number.isNaN(d.getTime())`, nem guarda para `null`, `undefined` ou `""`.
  - Quando `ms` é `NaN`, `undefined` ou string inválida, retorna a string literal `'Invalid Date'`, poluindo o selo de auditoria de transponder com `'HORÁRIO Invalid Date'`.
  - Em ambientes estritos de Intl, a passagem de valores anômalos pode disparar `RangeError: Invalid time value` não capturado.

### 1.3 Falha de Anti Auto-Bloqueio por Espaços em Branco em `usuarios.tsx`
No arquivo `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/app/usuarios.tsx`, linha 88:

```typescript
const ehEu = Boolean(eu?.usuario && u.usuario.toLowerCase() === eu.usuario.toLowerCase());
```

- **Comportamento Observado**:
  - Se o usuário cadastrado no banco/lista contiver espaços antes ou depois (ex.: `"gerencia "`, proveniente de digitação ou padding de colunas legadas), ou se `eu.usuario` contiver espaços, a comparação estrita falha (`"gerencia " === "gerencia"` -> `false`).
  - Como `ehEu` avalia para `false`, as linhas 107 a 118 renderizam o botão `<Pilula texto="Bloquear" />` para o próprio operador conectado.
  - Ao acionar a ação, o operador bloqueia seu próprio usuário via `POST /users/gerencia /block`, gerando auto-bloqueio acidental e perda de acesso gerencial imediata.
  - Adicionalmente, na linha 166 de `usuarios.tsx`, a criação envia `cliente.postar('/users', { usuario, nome, senha, perfil })` sem `trim()`, permitindo persistir usuários com espaços residuais.

### 1.4 Estado de `tests/m1-challenger-stress.test.ts`
No arquivo `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/tests/m1-challenger-stress.test.ts`:
- A suíte continha asserções escritas pelo Challenger 2 para *provar empiricamente* a existência das vulnerabilidades:
  - Linha 77-79: `expect(atualComEspaco).toBe(false); // Falha de proteção encontrada!`
  - Linha 223-224: `expect(hora('string-invalida')).toBe('Invalid Date');`
  - Linha 238: `expect(comArtefato).toBe('- Tre'); // Artefato empírico comprovado!`
- Para que o remediation seja validado de ponta a ponta e a suíte passe de forma limpa, essas asserções devem ser atualizadas para testar a prevenção e a resiliência efetiva.

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio)

1. **Remediação de `formatarInicioAgenda()`**:
   - `horaMinutoLocal(inicio)` localiza a data/hora para o fuso horário `America/Sao_Paulo`. Se ela retornar um valor diferente de `'--:--'`, o valor localizado deve ser retornado imediatamente.
   - Se `horaMinutoLocal` retornar `'--:--'`, a função deve checar se a entrada já é uma hora simples no formato `HH:mm` (`/^\d{2}:\d{2}$/`). Se for, deve retornar a própria string intacta (preservando horários como `"14:30"`).
   - Se a string não for uma hora simples, mas iniciar com o padrão de data ISO (`/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/`), o fatiamento `.slice(11, 16)` é seguro e extrai o trecho horário `HH:mm`.
   - Para qualquer outra entrada (strings inválidas, descrições, caracteres aleatórios, valores vazios ou não-strings), a função não deve fatiar e deve retornar `String(fallback ?? '')`.
   - Dessa forma, elimina-se 100% dos fatiamentos espúrios e corrupções de títulos.

2. **Remediação de `hora()`**:
   - A função deve aceitar opcionalmente `number | Date | string | null | undefined`.
   - Se a entrada for nula, indefinida ou string vazia (`ms == null || ms === ''`), deve retornar imediatamente o fallback neutro `'--:--'`.
   - O construtor `new Date(ms)` deve ser validado com `Number.isNaN(d.getTime())`. Se a data for inválida, retorna `'--:--'`.
   - A formatação via `toLocaleTimeString('pt-BR', { timeZone: FUSO_HORARIO })` deve ser encapsulada em `try/catch`. Caso ocorra qualquer exceção de Intl, o retorno deve ser `'--:--'`.
   - Isso elimina qualquer risco de `RangeError` ou exibição de `'Invalid Date'` na interface móvel.

3. **Remediação de Prevenção de Auto-Bloqueio em `usuarios.tsx`**:
   - Alterar linha 88 para:
     ```typescript
     const ehEu = Boolean(eu?.usuario && u.usuario.trim().toLowerCase() === eu.usuario.trim().toLowerCase());
     ```
   - E sanitizar o cadastro na linha 166:
     ```typescript
     usuario: usuario.trim(), nome: nome.trim()
     ```
   - Garante que mesmo diante de espaços à esquerda, à direita ou em ambos os lados, o usuário conectado é identificado como `VOCÊ` / `SUA CONTA`, bloqueando a renderização do botão destrutivo.

4. **Alinhamento dos Testes em `m1-challenger-stress.test.ts`**:
   - Substituir a prova de vulnerabilidade por validação positiva de robustez:
     - `verificarEhEu` deve usar `trim().toLowerCase()`, esperando `true` para variações com espaços.
     - `hora('string-invalida')` e `hora(NaN)` devem esperar `'--:--'`.
     - `formatarInicioAgenda('Bateria 10 - Treino', 'FALLBACK')` deve esperar `'FALLBACK'`.
     - `formatarInicioAgenda('14:30', 'FALLBACK')` deve esperar `'14:30'`.

---

## 3. Caveats (Ressalvas)

- **Escopo Deliberado**: Este relatório foca estritamente nos 3 itens da missão (formatação em `formato.ts`, auto-bloqueio em `usuarios.tsx` e integridade em `m1-challenger-stress.test.ts`). A remoção do backdoor de credencial `'teste-codex'` em `sessao.tsx` é atribuição do Explorer 1 / Worker de correção.
- **Ambiente de Testes**: A suíte foi validada no runtime Node.js v24 com Jest. Em dispositivos físicos, os fusos horários dependem do suporte a `Intl.DateTimeFormat` com fuso `America/Sao_Paulo`, plenamente suportado no Hermes / Expo 57.

---

## 4. Conclusion (Conclusão e Proposta de Implementação)

A estratégia de remediação foi totalmente desenhada, implementada no patch unificado `remediation_m1_explorer_2.patch` e validada com sucesso em ambiente isolado.

### 4.1 Código de Produção Proposto: `src/features/operacao/formato.ts`

```typescript
export const FUSO_HORARIO = 'America/Sao_Paulo';

const ISO_HORA_REGEX = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;
const HORA_SIMPLES_REGEX = /^\d{2}:\d{2}$/;

export const relogio = (ms: number | null | undefined) => {
  if (ms == null) return '--:--';
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

export const volta = (ms: number | null | undefined) => {
  if (ms == null) return '—';
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, '0').replace('.', ',');
  return m ? `${m}:${s}` : s.replace(/^0/, '');
};

export const minutos = (data: Date = new Date()) =>
  data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO_HORARIO });

export const hora = (ms?: number | Date | string | null): string => {
  if (ms == null || ms === '') return '--:--';
  try {
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('pt-BR', { timeZone: FUSO_HORARIO });
  } catch {
    return '--:--';
  }
};

export const dataHoraLocal = (valor: string | number | Date | null | undefined): string => {
  if (!valor) return '—';
  try {
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return String(valor);
    return d.toLocaleString('pt-BR', { timeZone: FUSO_HORARIO });
  } catch {
    return String(valor);
  }
};

export const horaMinutoLocal = (valor: string | number | Date | null | undefined): string => {
  if (!valor) return '--:--';
  try {
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO_HORARIO });
  } catch {
    return '--:--';
  }
};

export const formatarInicioAgenda = (inicio?: string, fallback?: number | string): string => {
  if (!inicio || typeof inicio !== 'string') return String(fallback ?? '');
  const hm = horaMinutoLocal(inicio);
  if (hm !== '--:--') return hm;
  if (HORA_SIMPLES_REGEX.test(inicio)) return inicio;
  if (ISO_HORA_REGEX.test(inicio)) {
    const fatiado = inicio.slice(11, 16);
    if (fatiado) return fatiado;
  }
  return String(fallback ?? '');
};
```

### 4.2 Código de Produção Proposto: `src/app/usuarios.tsx`

**Linha 88**:
```typescript
<<<< ANTES:
const ehEu = Boolean(eu?.usuario && u.usuario.toLowerCase() === eu.usuario.toLowerCase());
==== DEPOIS:
const ehEu = Boolean(eu?.usuario && u.usuario.trim().toLowerCase() === eu.usuario.trim().toLowerCase());
>>>>
```

**Linha 166**:
```typescript
<<<< ANTES:
void acao(() => cliente.postar('/users', { usuario, nome, senha, perfil }), 'Usuário criado.').then((ok) => {
==== DEPOIS:
void acao(() => cliente.postar('/users', { usuario: usuario.trim(), nome: nome.trim(), senha, perfil }), 'Usuário criado.').then((ok) => {
>>>>
```

### 4.3 Alinhamento de Testes: `tests/m1-challenger-stress.test.ts`

- **Seção 2 (Anti Auto-Bloqueio)**:
```typescript
  describe('2. Self-Block Prevention Edge Cases', () => {
    const verificarEhEu = (euUsuario: string | undefined, uUsuario: string): boolean => {
      return Boolean(euUsuario && uUsuario.trim().toLowerCase() === euUsuario.trim().toLowerCase());
    };

    it('protege auto-bloqueio quando username é exatamente igual', () => {
      expect(verificarEhEu('admin', 'admin')).toBe(true);
    });

    it('protege auto-bloqueio com diferença de maiúsculas/minúsculas', () => {
      expect(verificarEhEu('Gerencia', 'GERENCIA')).toBe(true);
      expect(verificarEhEu('PEDRO', 'pedro')).toBe(true);
    });

    it('protege auto-bloqueio mesmo se houver espaços em branco (com trim)', () => {
      expect(verificarEhEu('gerencia', 'gerencia ')).toBe(true);
      expect(verificarEhEu('gerencia', ' gerencia')).toBe(true);
      expect(verificarEhEu('gerencia ', 'gerencia')).toBe(true);
      expect(verificarEhEu(' gerencia ', 'gerencia')).toBe(true);
      expect(verificarEhEu('gerencia', '  gerencia  ')).toBe(true);
    });

    it('trata usernames com caracteres especiais e nulos com segurança', () => {
      expect(verificarEhEu(undefined, 'gerencia')).toBe(false);
      expect(verificarEhEu('', 'gerencia')).toBe(false);
    });
  });
```

- **Seção 4 (Robustez de `hora()` e `formatarInicioAgenda()`)**:
```typescript
    it('resiliência de hora() contra entradas inválidas retornando fallback seguro', () => {
      expect(hora('string-invalida')).toBe('--:--');
      expect(hora(NaN)).toBe('--:--');
      expect(hora(undefined)).toBe('--:--');
      expect(hora(null)).toBe('--:--');
      expect(hora('')).toBe('--:--');
    });

    it('formatarInicioAgenda: elimina artefato de slice em strings não-ISO e retorna fallback seguro', () => {
      expect(formatarInicioAgenda(undefined, 'BATERIA_1')).toBe('BATERIA_1');
      expect(formatarInicioAgenda('', 99)).toBe('99');
      expect(formatarInicioAgenda('2026-11-02T19:00:00.000Z', 10)).toBe('16:00');

      // String curta inválida (<11 chars) cai no fallback
      expect(formatarInicioAgenda('curta', 'FALLBACK')).toBe('FALLBACK');

      // String longa arbitrária não-ISO (>11 chars): não sofre mais artefato de slice(11, 16)
      expect(formatarInicioAgenda('Bateria 10 - Treino', 'FALLBACK')).toBe('FALLBACK');
      expect(formatarInicioAgenda('nao-e-data-valida', 'FALLBACK')).toBe('FALLBACK');

      // Horário simples pré-formatado (HH:mm) é preservado
      expect(formatarInicioAgenda('14:30', 'FALLBACK')).toBe('14:30');
    });
```

---

## 5. Verification Method (Método de Verificação Independente)

Para aplicar e verificar as mudanças propostas:

1. **Checar aplicação limpa do patch**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && git apply --check /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_remediation_2/remediation_m1_explorer_2.patch
   ```
   - **Critério de Sucesso**: Código de saída 0 sem nenhum erro ou rejeição.

2. **Aplicar o patch no repositório de trabalho**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && git apply /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_remediation_2/remediation_m1_explorer_2.patch
   ```

3. **Executar a suíte de testes de estresse do Challenger**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npx jest tests/m1-challenger-stress.test.ts
   ```
   - **Critério de Sucesso**: 100% de testes aprovados (41 passed).

4. **Executar a suíte completa de testes (`npm test`)**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm test
   ```
   - **Critério de Sucesso**: Todas as 11 suítes de testes (197 testes) aprovadas com código 0.

5. **Executar a checagem de tipos TypeScript (`npm run tipos`)**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm run tipos
   ```
   - **Critério de Sucesso**: `tsc --noEmit` encerra com código 0 e zero erros de tipo.
