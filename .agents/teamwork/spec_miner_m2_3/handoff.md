# Relatório de Especificação: Campeonatos & Metas de Lastro Customizadas (R2 / F26 / F29)

**Agente**: `spec_miner_m2_3`  
**Milestone**: M2 (Operação de Pista & Campeonatos)  
**Data**: 2026-11-02  
**Diretório Exclusivo**: `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_m2_3`

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Lastro & Pesagem | Meta de Peso Dinâmica (F26 / Falha 20) | Resolução de meta de lastro a partir de configuração de categoria ou bateria, eliminando hardcode fixo de 90/100 kg | `pesoKg: number`, `metaKg: number` (ou categoria) | Objeto plano de lastro `{ pesoKg, metaKg, lastroKg, pecas5, pecas2_5, finalKg }` | Se peso fora de [20, 250], rejeita com erro 400 `INVALID_REQUEST` | `lib/app-v1/regras.ts:16-29`, `src/app/bateria/[id].tsx:552`, `tests/harness.ts:172-199` |
| 2 | Campeonatos & Regras | Categorias Padrão de Campeonatos (F29 / R2) | Definição de categorias com metas padronizadas: Graduados 80 (80 kg), Light 90 (90 kg), Master 95 (95 kg), Super 100 (100 kg), Heavy 110 (110 kg) | ID da categoria (`LIGHT`, `SUPER`, `CAMPEONATO_80`, `CAMPEONATO_95`, `CAMPEONATO_110`) | `CategoriaConfig { id, nome, metaKg }` | Se categoria inexistente, fallback para meta baseada no numeral do kart (LIGHT=90, SUPER=100) | `tests/harness.ts:178-184`, `tests/tier1-features.test.ts:414-420` |
| 3 | Lastro & Balança | Cálculo e Decomposição de Lastro (F28 / F29) | Decomposição do déficit de peso em placas físicas de 5 kg e 2,5 kg com arredondamento padronizado a 1 casa decimal | `pesoPilotoKg: number`, `metaKg: number` | `{ lastroKg, pecas5, pecas2_5, finalKg, metaKg }` | Se `pesoPilotoKg >= metaKg`, retorna `lastroKg = 0`, `pecas5 = 0`, `pecas2_5 = 0` | `tests/harness.ts:186-199`, `tests/tier1-features.test.ts:440-449` |
| 4 | Balança & UX | Incremento de Peso a partir da Meta (F23 / F24) | Botões `+` e `−` na balança inicializam o piloto a partir da meta da bateria/categoria quando o peso prévio for nulo ou zero | `pesoAtual: number \| null`, `delta: number`, `metaKg: number` | Novo peso `Math.min(250, Math.max(20, metaKg + delta))` | Trava mínima em 20 kg e máxima em 250 kg | `tests/harness.ts:206-216`, `tests/tier1-features.test.ts:380-399` |
| 5 | Balança & Realtime | Preservação de Foco na Digitação (F25) | Não sobrescreve o valor digitado pelo operador durante sincronização SSE/polling enquanto o campo estiver focado | `estaFocado: boolean`, `valorDigitado: string`, `novoValorSincronizado: string` | Exibe `valorDigitado` se focado, atualiza para `novoSincronizado` se desfocado | N/A | `tests/tier1-features.test.ts:400-412` |
| 6 | Balança & UX | Banner de Conclusão da Pesagem (F27) | Exibição de card/banner destacado ao conferir o último piloto da fila do box | `conferidosCount: number`, `totalPilotos: number` | Banner visual "TODOS OS LASTROS CONFERIDOS ✓" | N/A (somente visual) | `tests/tier1-features.test.ts:422-429` |
| 7 | Balança & Identificação | ID Persistente do Piloto na Balança (F22) | Rastreamento do piloto selecionado na balança por identificador persistente (`customerId` ou `kartAtual`) em vez de índice array | `pilotoId: string` ou `kart: string` | Seleção invariante a reordenações da lista | Se piloto selecionado sair da lista, seleciona o primeiro disponível | `src/app/bateria/[id].tsx:535-538`, `tests/tier1-features.test.ts:365-378` |
| 8 | Gestão Esportiva | Tela de Campeonatos (R2 / F29) | Interface dedicada para visualização de campeonatos, categorias, regulamentos, tabelas de pontos e critérios de desempate | Consulta `GET /api/app/v1/championships` ou catálogo local | Tela com 4 abas: Categorias & Lastros, Regulamentos, Tabela de Pontos, Critérios & Punições | Exibe estado vazio elegante se nenhum campeonato configurado | `src/app/campeonatos.tsx`, `ORIGINAL_REQUEST.md:68-71`, `SCOPE.md:85` |
| 9 | Gestão Esportiva | Catálogo de Formatos & Regulamentos | Modelagem do regulamento esportivo (Tomada de tempo, duração da corrida, paradas de box, regras de pontuação) | Objeto `FormatoCorridaRecord` / `FormatoCorrida` | Regras aplicadas às sessões da etapa | Erro se formato inválido ou inexistente | `lib/race-formats.ts:16-35`, `docs/operacao/fluxo-cronometragem-campeonato.md` |
| 10 | Gestão Esportiva | Tabela de Pontos Customizada | Estrutura de pontuação por posição com bônus de pole, melhor volta e descartes | `pontos_json: PontuacaoConfig`, `bonusPole`, `bonusMelhorVolta`, `descartes` | Pontuação oficial por etapa e geral | Fallback para tabela F1 (25-18-15-12-10-8-6-4-2-1) se não configurado | `lib/race-formats.ts:73-80`, `src/admin/modules/campeonatos/campeonatos.types.ts:12-18` |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Meta de Peso Dinâmica | Piloto pesa mais que a meta (ex: 98 kg na categoria 95 kg) | `falta <= 0` -> `unidades = 0`, `lastroKg = 0`, `pecas5 = 0`, `pecas2_5 = 0`, `finalKg = 98`. Sistema exibe badge "NA META · SEM LASTRO". |
| 2 | Meta de Peso Dinâmica | Piloto pesa exatamente a meta (ex: 80.0 kg na categoria 80 kg) | `lastroKg = 0`, sem necessidade de placas. |
| 3 | Cálculo de Peças de Lastro | Piloto de 82 kg na categoria 95 kg (déficit de 13 kg) | Subida em blocos de 2,5 kg: `ceil(13 / 2.5) = 6` unidades -> 15.0 kg de lastro (3x de 5 kg, 0x de 2,5 kg), peso final na pista: 97.0 kg (garantindo atingir ou superar a meta regulamentar). |
| 4 | Cálculo de Peças de Lastro | Piloto de 78.0 kg na categoria 100 kg (déficit de 22 kg) | Subida em blocos de 2,5 kg: `ceil(22 / 2.5) = 9` unidades -> 22.5 kg de lastro (4x de 5 kg, 1x de 2,5 kg), peso final na pista: 100.5 kg. |
| 5 | Incremento de Peso sem Peso Prévio | Piloto sem peso prévio (`pesoKg: null`), operador clica no botão `+` na categoria de 95 kg | Inicializa em `metaKg + 1 = 96.0 kg`, evitando inicializar em 20 kg ou 0 kg. |
| 6 | Incremento de Peso sem Peso Prévio | Piloto sem peso prévio (`pesoKg: null`), operador clica no botão `−` na categoria de 80 kg | Inicializa em `metaKg - 1 = 79.0 kg`. |
| 7 | Limites da Balança | Tentativa de incremento acima de 250 kg ou abaixo de 20 kg | Valor travado estritamente no intervalo seguro `[20, 250]`. |
| 8 | Reordenação da Fila | Piloto `p1` selecionado na balança; chegada de novo competidor ou reordenação por número de kart | Foco permanece rigorosamente em `p1` graças ao rastreamento por ID/kart persistente, evitando pesagem acidental no piloto errado. |
| 9 | Sincronização em Segundo Plano | Operador digitando `87,5` no campo de peso enquanto o stream SSE recebe atualização com `90,0` | O valor `87,5` é preservado intacto enquanto o campo mantiver foco (`estaFocado === true`). |
| 10 | Bateria Mista com Categorias Distintas | Bateria contendo pilotos de categorias diferentes (ex: Graduados 80 e Master 95) | Cada piloto recebe sua meta individual conforme `competitor.category`; a interface adapta o selo de meta e o cálculo de lastro individualmente. |

---

## 1. Especificação Técnica: Seleção Dinâmica de Metas de Lastro e Propagação

### 1.1 Modelo de Dados das Categorias

No arquivo de domínio do frontend (`src/features/operacao/sorteio.ts` ou novo `src/features/operacao/campeonatos-tipos.ts` e `src/types/campeonatos.ts`):

```typescript
export type CategoriaConfig = {
  id: string;
  nome: string;
  metaKg: number;
  descricao?: string;
  corBadge?: string;
};

export const CATEGORIAS_PADRAO: Record<string, CategoriaConfig> = {
  LIGHT: { id: 'LIGHT', nome: 'Light', metaKg: 90, descricao: 'Karts Light (1 a 99)' },
  SUPER: { id: 'SUPER', nome: 'Super', metaKg: 100, descricao: 'Karts Super (100+)' },
  CAMPEONATO_80: { id: 'CAMPEONATO_80', nome: 'Graduados 80', metaKg: 80, descricao: 'Categoria Leve / Graduados' },
  CAMPEONATO_95: { id: 'CAMPEONATO_95', nome: 'Master 95', metaKg: 95, descricao: 'Categoria Média / Master' },
  CAMPEONATO_110: { id: 'CAMPEONATO_110', nome: 'Heavy 110', metaKg: 110, descricao: 'Categoria Pesados / Heavy' },
};
```

### 1.2 Regras de Precedência para Resolução da Meta

Para qualquer piloto em uma bateria, a meta de lastro regulamentar é resolvida na seguinte ordem de precedência:

1. **Meta da Categoria Individual do Piloto**: Se o competidor possuir `category` preenchida (ex: `c.category = 'CAMPEONATO_80'` ou `'Master 95'`) e correspondente a uma categoria cadastrada, prevalece a meta da categoria do piloto.
2. **Meta Sobrescrita / Ativa da Bateria**: Se a sessão/bateria possuir `metaKg` configurada ou selecionada dinamicamente pelo operador na tela (ex.: `80`, `95`, `110`), essa meta se aplica aos competidores que não possuem categoria individual específica.
3. **Meta da Categoria da Sessão**: Se a sessão estiver vinculada a uma categoria ou campeonato com meta declarada no catálogo.
4. **Fallback Legado por Numeral do Kart**:
   - Se `Number(kart) >= 100`: Frota SUPER -> **100 kg**.
   - Se `Number(kart) < 100`: Frota LIGHT -> **90 kg**.

### 1.3 Algoritmo Canônico de Lastro

```typescript
export function calcularPlanoLastro(
  pesoPilotoKg: number,
  metaKg: number,
): { lastroKg: number; pecas5: number; pecas2_5: number; finalKg: number; metaKg: number } {
  const unidades = Math.max(0, Math.ceil(Math.max(0, metaKg - pesoPilotoKg) / 2.5 - 1e-7));
  const lastroCalculado = unidades * 2.5;
  return {
    lastroKg: Number(lastroCalculado.toFixed(1)),
    pecas5: Math.floor(unidades / 2),
    pecas2_5: unidades % 2,
    finalKg: Number((pesoPilotoKg + lastroCalculado).toFixed(1)),
    metaKg,
  };
}
```

---

## 2. Contratos no Backend (`KARTODROMO` & Snapshot `lib/app-v1/`)

### 2.1 Refatoração em `lib/app-v1/regras.ts`

Localização: `/Users/pedroguilherme/PROJETOS/KARTODROMO-snapshot/lib/app-v1/regras.ts` (linhas 16 a 30).

- **Problema Observado**:
  ```typescript
  export type Frota = 'LIGHT' | 'SUPER';
  export const META_KG: Record<Frota, number> = { LIGHT: 90, SUPER: 100 };
  export function planoLastro(pesoKg: number, frota: Frota) {
    const meta = META_KG[frota]; ...
  ```
- **Contrato Recomendado**:
  Permitir que `planoLastro` receba `frotaOuMeta: Frota | number`, permitindo tanto a compatibilidade com a frota legada quanto a passagem direta de meta numérica (80, 95, 110 kg):
  ```typescript
  export function planoLastro(pesoKg: number, frotaOuMeta: Frota | number) {
    const meta = typeof frotaOuMeta === 'number' ? frotaOuMeta : (META_KG[frotaOuMeta] ?? 90);
    const unidades = Math.max(0, Math.ceil(Math.max(0, meta - pesoKg) / 2.5 - 1e-7));
    const lastroKg = Number((unidades * 2.5).toFixed(1));
    return {
      pesoKg,
      metaKg: meta,
      lastroKg,
      pecas5: Math.floor(unidades / 2),
      pecas2_5: unidades % 2,
      finalKg: Number((pesoKg + lastroKg).toFixed(1)),
    };
  }
  ```

### 2.2 Refatoração em `lib/app-v1/operacao.ts`

Localização: `/Users/pedroguilherme/PROJETOS/KARTODROMO-snapshot/lib/app-v1/operacao.ts` (linhas 90-93 e 328-347).

- **No `painelSorteio(id)`**:
  - Extrair `metaBateria` dos detalhes da sessão ou parâmetro da prova.
  - Resolver a meta por competidor e chamar `planoLastro(peso, metaPiloto)`.
- **No método `peso(q, id, b)` (`POST /sessions/:id/weight-checks`)**:
  - Payload aceito:
    ```json
    {
      "payload": {
        "customerId": "senna",
        "nome": "Ayrton Senna",
        "pesoKg": 78.0,
        "metaKg": 100,
        "lastroConferido": true
      }
    }
    ```
  - Gravação dos detalhes do competidor:
    ```typescript
    await d.legado('PUT', `/api/sessions/${id}/competitors/${indice}`, {
      kartAntes: c.kart,
      nomeAntes: c.name,
      kart: c.kart,
      name: c.name,
      aplicarGrupo: true,
      detalhes: {
        ...c.detalhes,
        peso: pl.pesoKg,
        pesoLastro: plano?.lastroKg ?? null,
        metaLastro: plano?.metaKg ?? null,
      },
    });
    ```
  - Gravação transacional no banco SQLite:
    `INSERT OR REPLACE INTO lastros_conferidos (sessionId, chave, kart, pesoKg, usuario, em) VALUES (?, ?, ?, ?, ?, ?)`

### 2.3 Endpoints em `lib/app-v1/rotas.ts`

- `GET /api/app/v1/championships`: Retorna a lista de campeonatos cadastrados e seus metadados esportivos.
- `GET /api/app/v1/categories`: Retorna o catálogo de categorias com as respectivas metas de peso.
- `POST /api/app/v1/sessions/:id/weight-target`: Permite ao operador definir ou alterar a meta de lastro da bateria ativa (`{ metaKg: number, categoria?: string }`).

---

## 3. Design da Tela e Componentes de Campeonatos no Frontend

### 3.1 Localização dos Tipos no Frontend

Criar arquivo estruturado em `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/types/campeonatos.ts` (com export no índice de tipos):

```typescript
export type CategoriaConfig = {
  id: string;
  nome: string;
  metaKg: number;
  descricao?: string;
  corBadge?: string;
};

export type FormatoRegulamento = {
  id: string;
  nome: string;
  descricao: string | null;
  ttHabilitada: boolean;
  ttDuracaoMin: number | null;
  ttDefineGrid: boolean;
  ttPontua: boolean;
  corridaDuracaoMin: number | null;
  paradasHabilitadas: boolean;
  paradasQuantidade: number;
  paradaTempoMinimoMs: number | null;
  desempateCriterios: string[];
};

export type TabelaPontos = {
  posicoes: Record<number, number>;
  foraDaTabela?: number;
  bonusPole: number;
  bonusMelhorVolta: number;
  descartes: number;
};

export type CampeonatoItem = {
  id: string;
  nome: string;
  temporada: string;
  status: 'ativo' | 'encerrado' | 'rascunho';
  categorias: CategoriaConfig[];
  formato: FormatoRegulamento;
  pontuacao: TabelaPontos;
  regrasPesagem: {
    toleranciaDeficitKg: number;
    punicaoTempoPor500gSeg: number;
    dsqEquipeAbaixoKg: number;
  };
};
```

### 3.2 Estrutura da Tela `src/app/campeonatos.tsx`

Componente principal com design responsivo (Mobile e Tablet), aderente ao Design System existente:

1. **Cabeçalho (`Topo`)**:
   - `sobre="ESPORTIVO & REGULAMENTOS"`
   - `titulo="CAMPEONATOS"`
   - Botão voltar com atalho para a Home.
2. **Navegador de Abas (`Abas`)**:
   - `categorias`: "Categorias & Lastros"
   - `regulamento`: "Regulamento Esportivo"
   - `pontos`: "Tabela de Pontos"
   - `punicoes`: "Critérios & Punições"
3. **Conteúdo das Abas**:
   - **Aba 1: Categorias & Lastros**:
     - Grid de Cards das 5 categorias padrão (`Graduados 80`, `Light 90`, `Master 95`, `Super 100`, `Heavy 110`).
     - Cada card exibe: Nome, Selo de Meta em Kg, Selo de Frota recomendada e descrição esportiva.
     - **Calculadora Rápida de Lastro**:
       - Campo para informar peso do piloto.
       - Botões para alternar a categoria ativa.
       - Visualização em tempo real das placas de lastro calculadas (5 kg e 2,5 kg) e peso total na pista.
   - **Aba 2: Regulamento Esportivo**:
     - Detalhes do Formato Oficial (Padrão Betim: Tomada de tempo de 5 min definindo grid, corrida de 20 min sem parada obrigatória; Endurance: paradas obrigatórias, tempo mínimo de pit lane).
     - Lista priorizada de critérios de desempate (Vitórias, 2º lugares, 3º lugares, melhor posição, melhor volta, menos punições).
   - **Aba 3: Tabela de Pontos**:
     - Tabela visual das pontuações oficiais (1º ao 10º colocado).
     - Destaque para Bônus de Pole Position (+1 pt), Melhor Volta (+1 pt) e regra de 2 descartes das piores etapas.
   - **Aba 4: Critérios & Punições**:
     - Regras de Pesagem Pós-Corrida: tolerância regulamentar, punição de tempo por déficit e regra de Desclassificação Automática (DSQ) com rebaixamento para última posição.
     - Tabela de penalidades de tempo padronizadas (5s, 10s, 30s) e advertências por bandeira.
4. **Ponto de Entrada no Dashboard (`src/app/index.tsx`)**:
   - Adicionar o item ao array `modulos`:
     ```typescript
     {
       id: 'camp',
       sobre: 'ESPORTIVO',
       titulo: 'Campeonatos',
       sub: 'Regulamentos, pontos e lastros',
       badge: 'REGRAS',
       tom: 'verde' as const,
       rota: '/campeonatos',
       ok: true,
     }
     ```

---

## 4. Integração da Meta Dinâmica na Pesagem de `src/app/bateria/[id].tsx`

### 4.1 Correções Necessárias na Função `Lastro`

Localização: `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/app/bateria/[id].tsx` (linhas 532 a 705).

1. **Eliminar Hardcode 90/100 kg (Falha 20 / F26)**:
   - Substituir:
     ```typescript
     const meta = x.lastro?.metaKg ?? (Number(x.kartAtual) >= 100 ? 100 : 90);
     ```
   - Por:
     ```typescript
     const [metaBateria, setMetaBateria] = useState<number | null>(null);
     const metaEfetiva = x.lastro?.metaKg ?? metaBateria ?? (Number(x.kartAtual) >= 100 ? 100 : 90);
     ```
2. **Seletor Rápido de Meta no Topo da Balança**:
   - Adicionar um bloco seletor com as metas regulamentares:
     ```tsx
     <View style={[s.linha, { gap: 6, marginBottom: 8 }]}>
       <Sobre>META DA BATERIA:</Sobre>
       {[80, 90, 95, 100, 110].map((m) => (
         <Pilula
           key={m}
           texto={`${m} kg`}
           ativo={metaEfetiva === m}
           onPress={() => setMetaBateria(m)}
         />
       ))}
     </View>
     ```
3. **Rastreamento de Piloto Selecionado por ID Persistente (Falha 16 / F22)**:
   - Utilizar `const [pilotoSelId, setPilotoSelId] = useState<string | null>(null);`
   - Buscar o competidor selecionado por `lista.find(l => l.customerId === pilotoSelId || l.kartAtual === pilotoSelId) ?? lista[0]`.
4. **Habilitar Incrementos `+` e `−` Inicializando na Meta (Falha 17 / F23 & Falha 18 / F24)**:
   - Alterar `desativado={!valido}` nos botões de incremento para `desativado={!pode || enviando}`.
   - Utilizar a função de ajuste:
     ```typescript
     const mudar = (delta: number) => {
       const novo = ajustarIncrementoPeso(peso, delta, metaEfetiva);
       setPeso(novo);
       setTexto(formatarNumero1Casa(novo));
     };
     ```
5. **Preservar Foco na Digitação (Falha 19 / F25)**:
   - Criar estado `const [campoFocado, setCampoFocado] = useState(false);`.
   - Adicionar `onFocus={() => setCampoFocado(true)}` e `onBlur={() => setCampoFocado(false)}` no `TextInput`.
   - No `useEffect` de sincronização, atualizar `texto` apenas se `!campoFocado`.
6. **Banner de Conclusão da Pesagem (Falha 21 / F27)**:
   - Quando `conferidosCount === lista.length && lista.length > 0`, renderizar um card de confirmação com destaque verde:
     ```tsx
     <Pop>
       <Cartao tom="verde" style={{ padding: 16, alignItems: 'center', gap: 6 }}>
         <Selo texto="TODOS OS PILOTOS CONFERIDOS" tom="verde" vivo />
         <Forte tam={20} cor={cores.verde}>Pesagem Concluída com Sucesso ✓</Forte>
         <Suave>Todos os {lista.length} karts da fila do box estão com o lastro conferido.</Suave>
       </Cartao>
     </Pop>
     ```
7. **Arredondamento Canônico a 1 Casa Decimal (Falha 22 / F28)**:
   - Substituir interpolações simples por `formatarNumero1Casa(lastro)` e `formatarNumero1Casa(atual + lastro)`.

---

## 5. Handoff Protocol

### 5.1 Observation

1. **Hardcode de Pesos em `regras.ts`**:
   No arquivo `/Users/pedroguilherme/PROJETOS/KARTODROMO-snapshot/lib/app-v1/regras.ts`, linhas 17 a 28:
   ```typescript
   export const META_KG: Record<Frota, number> = { LIGHT: 90, SUPER: 100 };
   export function planoLastro(pesoKg: number, frota: Frota) {
     const meta = META_KG[frota];
     const unidades = Math.max(0, Math.ceil(Math.max(0, meta - pesoKg) / 2.5 - 1e-7));
     const lastroKg = unidades * 2.5;
     return { pesoKg, metaKg: meta, lastroKg, pecas5: Math.floor(unidades / 2), pecas2_5: unidades % 2, finalKg: pesoKg + lastroKg };
   }
   ```
2. **Hardcode de Pesos na Tela de Pesagem**:
   No arquivo `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src/app/bateria/[id].tsx`, linha 552:
   ```typescript
   const meta = x.lastro?.metaKg ?? (Number(x.kartAtual) >= 100 ? 100 : 90);
   ```
3. **Contratos e Harness de Teste Já Existentes**:
   No arquivo `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/tests/harness.ts`, linhas 172 a 199:
   `CATEGORIAS_PADRAO` define `LIGHT (90)`, `SUPER (100)`, `CAMPEONATO_80 (80)`, `CAMPEONATO_95 (95)` e `CAMPEONATO_110 (110)`. As funções `calcularPlanoLastro`, `formatarNumero1Casa` e `ajustarIncrementoPeso` já possuem contrato formal e estão validadas pelos testes de `tier1-features.test.ts` e `tier3-cross-feature.test.ts`.
4. **Suíte de Testes Atual**:
   A execução de `npm test` em `/Users/pedroguilherme/PROJETOS/kartodromo-operacional` resultou em:
   `Test Suites: 13 passed, 13 total. Tests: 228 passed, 228 total. Time: 2.788 s.`

### 5.2 Logic Chain

1. A Falha 20 exige explicitamente eliminar os valores fixos de 90 e 100 kg, obtendo a meta a partir da configuração da categoria/bateria.
2. O Requisito R2 estabelece a necessidade de suportar campeonatos com metas padronizadas de 80, 95 e 110 kg, além de disponibilizar aba/seção de Campeonatos para visualização de regulamentos, regras de pontos e punições.
3. Como os testes unitários e de integração (`tests/tier1-features.test.ts`, `tests/tier3-cross-feature.test.ts`) já usam `CATEGORIAS_PADRAO` e `calcularPlanoLastro`, a implementação nos arquivos de produção deve adotar exatamente a mesma assinatura e lógica matemática testada.
4. Ao integrar a seleção dinâmica de meta na balança (`src/app/bateria/[id].tsx`), resolve-se concomitantemente a Falha 20 e os requisitos de pesagem de R2, harmonizando os fluxos de pesagem inicial e pós-corrida (R5).

### 5.3 Caveats

- Não foram criadas novas tabelas em banco SQL real nem alterado código-fonte de produção durante esta fase, pois a atuação deste agente é estritamente de especificação e somente leitura.
- Para baterias sem nenhuma definição de campeonato ou categoria, o fallback baseado na frota do kart (90 kg para Light e 100 kg para Super) continua operando para manter total retrocompatibilidade com as baterias de aluguel avulsas.

### 5.4 Conclusion

A especificação para Campeonatos e Lastros Personalizados (R2 / F26 / F29) está completamente delineada:
- **Domínio**: Tipos e catálogo de categorias (`CATEGORIAS_PADRAO`) em `src/types/campeonatos.ts`.
- **Backend**: Flexibilização de `planoLastro` e rotas de campeonatos em `regras.ts`, `operacao.ts` e `rotas.ts`.
- **Frontend Tela**: Criação de `src/app/campeonatos.tsx` com 4 abas e inclusão de atalho em `src/app/index.tsx`.
- **Frontend Balança**: Atualização de `src/app/bateria/[id].tsx` com seletor de meta, resolução dinâmica, eliminação do hardcode 90/100 kg e tratamento das Falhas 16 a 22.

### 5.5 Verification Method

1. **Execução da Suíte de Testes**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional
   npm test
   ```
2. **Inspeção de Contratos e Tipos**:
   - Verificar arquivos `src/types/campeonatos.ts` e `tests/harness.ts`.
   - Inspecionar `src/app/bateria/[id].tsx` para certificar a ausência do hardcode `90 : 100`.
   - Inspecionar `src/app/campeonatos.tsx` e `src/app/index.tsx` para validação visual e navegabilidade.
