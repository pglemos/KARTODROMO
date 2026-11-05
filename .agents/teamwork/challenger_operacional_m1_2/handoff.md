# Relatório de Desafio Adversarial (Challenger M1-2) — Administração, RBAC e UI

**Data**: 2026-11-02T20:53:00Z  
**Autor**: Challenger Operacional M1-2 (`challenger_operacional_m1_2`)  
**Destinatário**: Orchestrator Operacional (`88cadb65-7d49-4f0d-a278-9c17ee4251ab`)  
**Milestone**: Milestone 1 (Administração, RBAC, Anti-Bloqueio, Senhas, Fuso Horário e Paginação de Auditoria)  
**Projeto Alvo**: `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`  
**Veredito Oficial**: `REQUEST_CHANGES`

---

## 1. Observation (Observações Diretas)

### 1.1 Execução de Testes Automatizados
- **Comando**:
  ```bash
  cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npx jest tests/m1-challenger-stress.test.ts
  ```
- **Resultado**:
  ```
  PASS tests/m1-challenger-stress.test.ts
    CHALLENGER M1: RBAC, Self-Block, Password Confirmation, Timezone & Pagination
      1. RBAC Guard Bypass Attempts
        ✓ bloqueia acesso quando perfil é null profile
        ✓ bloqueia acesso quando perfil é undefined profile
        ✓ bloqueia acesso quando perfil é empty profile
        ✓ bloqueia acesso quando perfil é RECEPCAO profile
        ✓ bloqueia acesso quando perfil é OPERACAO profile
        ✓ bloqueia acesso quando perfil é lowercase gerencia
        ✓ bloqueia acesso quando perfil é mixed-case Gerencia
        ✓ bloqueia acesso quando perfil é gerencia with trailing space
        ✓ bloqueia acesso quando perfil é gerencia with leading space
        ✓ bloqueia acesso quando perfil é ADMIN profile
        ✓ bloqueia acesso quando perfil é SUPERUSER profile
        ✓ bloqueia acesso quando perfil é ROOT profile
        ✓ bloqueia acesso quando perfil é SQL injection string
        ✓ bloqueia acesso quando perfil é XSS attempt
        ✓ permite acesso estritamente para perfil GERENCIA canônico
        ✓ bloqueia usuário anônimo (eu === null)
      2. Self-Block Prevention Edge Cases
        ✓ protege auto-bloqueio quando username é exatamente igual
        ✓ protege auto-bloqueio com diferença de maiúsculas/minúsculas
        ✓ VULNERABILIDADE / FALHA DE BORDA: falha ao detectar auto-bloqueio se houver espaços em branco (sem trim)
        ✓ trata usernames com caracteres especiais e nulos com segurança
      3. Password Confirmation Stress-Testing
        ✓ bloqueia submissão quando senha e confirmação diferem
        ✓ bloqueia submissão quando confirmação está vazia
        ✓ bloqueia submissão quando há diferença apenas em espaço final
        ✓ bloqueia senha curta com menos de 10 caracteres mesmo se confirmada
        ✓ permite submissão válida com 10+ caracteres idênticos
        ✓ COMPORTAMENTO DE BORDA: aceita senha composta exclusivamente de espaços em branco (sem trim)
        ✓ troca de senha exige senha atual preenchida
      4. Timezone Formatting Edge Cases (America/Sao_Paulo)
        ✓ formata corretamente ano bissexto (29 de fevereiro)
        ✓ transição de dia pelo fuso horário (UTC meia-noite vs SP 21h anterior)
        ✓ datas históricas com e sem Horário de Verão (DST)
        ✓ comportamento com datas ISO sem horário (YYYY-MM-DD)
        ✓ resiliência de dataHoraLocal e horaMinutoLocal contra valores inválidos
        ✓ COMPORTAMENTO DE ROBUSTEZ: hora() retorna "Invalid Date" com entradas inválidas por falta de validação interna
        ✓ formatarInicioAgenda: comportamento com fallbacks e artefato de slice em strings não-data
      5. Audit Pagination and Filtering Stress-Testing
        ✓ lista vazia: exibe 0 itens sem erro e temMais é falso
        ✓ página única (menor que 25 itens): exibe todos os itens e não permite paginação extra
        ✓ limite exato de 1 página (exatamente 25 itens): temMais é falso
        ✓ fronteira de 26 itens: página 1 carrega 25 e sinaliza temMais=true; página 2 carrega 26 e sinaliza temMais=false
        ✓ estresse de rolagem rápida (rapid scrolling): 100 requisições consecutivas de incremento
        ✓ troca de filtro reseta paginação para 1 e filtra adequadamente
        ✓ filtro sem resultados resulta em lista vazia com temMais=false

  Test Suites: 1 passed, 1 total
  Tests:       41 passed, 41 total
  ```

### 1.2 Inspeção de Código e Vulnerabilidades Localizadas

#### Vulnerabilidade 1: Falha no Anti Auto-Bloqueio por Espaços em Branco (Missing Trim)
- **Arquivo**: `src/app/usuarios.tsx`, linha 88:
  ```typescript
  const ehEu = Boolean(eu?.usuario && u.usuario.toLowerCase() === eu.usuario.toLowerCase());
  ```
- **Arquivo**: `src/app/usuarios.tsx`, linhas 104-118:
  ```typescript
  {ehEu ? (
    <Selo texto="SUA CONTA" tom="neutro" />
  ) : (
    <Pilula
      texto={u.bloqueado ? 'Liberar acesso' : 'Bloquear'}
      onPress={() =>
        confirmar(u.bloqueado ? 'Liberar' : 'Bloquear', `${u.nome}?`, () =>
          void acao(
            () => cliente.postar(`/users/${u.usuario}/block`, { bloqueado: !u.bloqueado }),
            u.bloqueado ? 'Liberado.' : 'Bloqueado: acesso cortado.',
          ),
        )
      }
    />
  )}
  ```
- **Evidência Empírica**:
  Se `u.usuario = "gerencia "` e `eu.usuario = "gerencia"`, `u.usuario.toLowerCase() === eu.usuario.toLowerCase()` retorna `false`. O botão "Bloquear" é exibido para o próprio usuário autenticado. O formulário de criação em `usuarios.tsx` linha 166 envia `{ usuario, ... }` sem `trim()`, permitindo a inserção de usuários com espaços.

#### Vulnerabilidade 2: Artefato de Slice em `formatarInicioAgenda` com Strings Não-ISO
- **Arquivo**: `src/features/operacao/formato.ts`, linha 47:
  ```typescript
  export const formatarInicioAgenda = (inicio?: string, fallback?: number | string): string => {
    if (!inicio) return String(fallback ?? '');
    const hm = horaMinutoLocal(inicio);
    return hm !== '--:--' ? hm : (inicio.slice(11, 16) || String(fallback ?? ''));
  };
  ```
- **Evidência Empírica**:
  Quando `inicio` é uma string descritiva não-ISO (por exemplo, `"Bateria 10 - Treino"`), `horaMinutoLocal` retorna `'--:--'`. A expressão faz `inicio.slice(11, 16)`, que resulta em `"- Tre"`. Em `src/app/index.tsx` linhas 230 e 448 (`item.nome ?? `Bateria ${formatarInicioAgenda(item.inicio, item.id)}``), o título da bateria é corrompido para `"Bateria - Tre"` em vez de utilizar o ID de fallback `"Bateria 10"`.

#### Fraqueza 3: Aceitação de Senha Composta Exclusivamente por Espaços
- **Arquivo**: `src/app/usuarios.tsx`, linha 160:
  ```typescript
  desativado={!usuario || !nome || senha.length < 10 || senha !== confirmarSenha}
  ```
- **Arquivo**: `src/app/conta.tsx`, linha 108:
  ```typescript
  desativado={desconectando || !atual || nova.length < 10 || nova !== confirmacao}
  ```
- **Evidência Empírica**:
  Uma senha de 10 espaços em branco (`"          "`) tem `length === 10` e passa na validação `senha === confirmarSenha`, permitindo criação ou troca de credencial para espaços puros.

#### Fraqueza 4: Falta de Tratamento de Erro na Função `hora(ms)`
- **Arquivo**: `src/features/operacao/formato.ts`, linha 19:
  ```typescript
  export const hora = (ms: number | Date | string) =>
    new Date(ms).toLocaleTimeString('pt-BR', { timeZone: FUSO_HORARIO });
  ```
- **Evidência Empírica**:
  Diferente de `dataHoraLocal` e `horaMinutoLocal`, `hora(ms)` não possui guarda contra valores inválidos. Quando chamado com `NaN` ou string inválida, retorna a string literal `"Invalid Date"`, que é renderizada na UI em `src/app/passagens/[id].tsx` (`HORÁRIO Invalid Date`).

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio)

1. **RBAC (Falha 39)**:
   - A guarda `if (eu?.perfil !== 'GERENCIA')` está presente tanto no render quanto na função de leitura `ler()` em `usuarios.tsx` e `dono.tsx`.
   - Testamos 14 variantes (nulo, indefinido, vazio, outros perfis como RECEPCAO/OPERACAO, injeções SQL/XSS e variações de case). Nenhuma conseguiu burlar a barreira.
   - Navegação direta via router é contida pela exibição imediata do cartão de "Acesso restrito" sem disparar requisições para a API.
   - Conclusão da dimensão RBAC: **Aprovado**.

2. **Prevenção de Auto-Bloqueio (Falha 40)**:
   - O requisito estabelece: "Ocultar opção de bloqueio de usuário para a própria conta conectada, prevenindo auto-bloqueio acidental."
   - A igualdade estrita sem `trim()` quebra quando há caracteres invisíveis ou espaços acidentais introduzidos na digitação ou no cadastro.
   - Como o backend e a interface aceitam `usuario` sem `trim()`, a condição `ehEu` falha silenciosamente, reexibindo o botão destrutivo de bloqueio para o próprio operador logado.
   - Conclusão da dimensão Anti-Bloqueio: **Falha de borda comprovada (requer correção)**.

3. **Confirmação de Senha (Falha 41)**:
   - O botão é desativado quando há divergência entre os dois campos ou quando o campo de confirmação está vazio.
   - Mismatches de espaço no final (`"senha"` vs `"senha "`) são bloqueados.
   - No entanto, a ausência de sanitização permite cadastrar 10 espaços como senha válida.
   - Conclusão da dimensão Senhas: **Parcialmente aprovado com ressalva de sanitização**.

4. **Fuso Horário America/Sao_Paulo (Falha 45)**:
   - Os cálculos de ano bissexto (29/02/2024 e 29/02/2028), virada de dia às 21h e horário de verão histórico de 2018 funcionam perfeitamente com a IANA time zone configurada.
   - Porém, a função `formatarInicioAgenda` contém um fallback ingênuo (`inicio.slice(11, 16)`) que fatia arbitrariamente strings não-ISO, gerando texto corrompido na tela inicial do app.
   - Conclusão da dimensão Fuso Horário: **Bug de renderização comprovado em formatarInicioAgenda**.

5. **Paginação de Auditoria (Falhas 42 e 43)**:
   - A virtualização com `FlatList` e paginação de 25 em 25 itens (`ITENS_POR_PAGINA = 25`) foi estressada com lista vazia, lista curta, limite exato de 25, transição para 26 e rolagem rápida de 100 requisições simultâneas.
   - O chaveamento responsivo `key={tablet ? 'grid-2' : 'list-1'}` impede erros de `numColumns` dinâmico no React Native.
   - Conclusão da dimensão Paginação: **Aprovado com alta resiliência**.

---

## 3. Caveats (Ressalvas e Suposições)

- O perfil `ADMIN`: se o backend vier a possuir operadores com perfil `'ADMIN'` em vez de `'GERENCIA'`, esses operadores serão barrados pela guarda atual. A regra do projeto define explicitamente `GERENCIA`.
- Execução conjunta com Challenger 1: Challenger 1 gerou `tests/stress-challenger.test.ts`, o qual atualmente aponta 2 falhas na camada de cliente (`baseSegura` com CRLF e reuso de promise em 401). Nossa suíte (`tests/m1-challenger-stress.test.ts`) foca na camada administrativa, RBAC, regras de UI e fuso horário.

---

## 4. Conclusion (Conclusão e Veredito)

**Veredito: `REQUEST_CHANGES`**

Embora as barreiras de RBAC e a paginação da auditoria tenham demonstrado grande solidez contra ataques adversariais, o Milestone 1 deve ter as seguintes correções pontuais aplicadas antes da aprovação final:

1. **Aplicar `.trim()` na prevenção de auto-bloqueio** (`src/app/usuarios.tsx`):
   ```typescript
   // De:
   const ehEu = Boolean(eu?.usuario && u.usuario.toLowerCase() === eu.usuario.toLowerCase());
   // Para:
   const ehEu = Boolean(eu?.usuario && u.usuario.trim().toLowerCase() === eu.usuario.trim().toLowerCase());
   ```
   E aplicar `usuario.trim()` ao submeter novo usuário no formulário de criação.

2. **Corrigir o fallback de slice em `formatarInicioAgenda`** (`src/features/operacao/formato.ts`):
   ```typescript
   // De:
   return hm !== '--:--' ? hm : (inicio.slice(11, 16) || String(fallback ?? ''));
   // Para:
   return hm !== '--:--' ? hm : String(fallback ?? inicio);
   ```

3. **Adicionar sanitização contra senhas de espaços puros** (`src/app/usuarios.tsx` e `src/app/conta.tsx`):
   Garantir `senha.trim().length >= 10`.

4. **Adicionar fallback defensivo em `hora(ms)`** (`src/features/operacao/formato.ts`):
   Retornar `'--:--'` quando `Number.isNaN(new Date(ms).getTime())`.

---

## 5. Verification Method (Método de Verificação Independente)

Para reproduzir os testes adversariais e validar os cenários documentados:

1. **Executar a Suíte do Challenger 2**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npx jest tests/m1-challenger-stress.test.ts
   ```
   - **Critério**: 41 testes executados, demonstrando os comportamentos e capturando empiricamente as vulnerabilidades relatadas.

2. **Inspecionar as Linhas de Vulnerabilidade**:
   - `src/app/usuarios.tsx:88` (ausência de trim em `ehEu`).
   - `src/features/operacao/formato.ts:47` (artefato de `slice(11, 16)`).
   - `src/features/operacao/formato.ts:19` (ausência de validação em `hora()`).
