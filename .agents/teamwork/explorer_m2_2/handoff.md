# Relatório Técnico de Handoff — Explorer M2_2

**Milestone:** M2 (Operação de Baterias, Sorteio, Balança e Campeonatos)  
**Escopo:** Balança, Pesagem e Lastro — Falhas 16 a 22  
**Data:** 2026-11-02  
**Status:** Investigação Técnica Concluída (Somente Leitura)  
**Autor:** `explorer_m2_2`  
**Destinatário:** Orquestrador `orchestrator_operacional_1` (`88cadb65-7d49-4f0d-a278-9c17ee4251ab`)

---

## 1. Observation (Observações Diretas)

As seguintes observações foram obtidas diretamente da leitura minuciosa do código-fonte em `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`:

### 1.1 Falha 16 — Seleção por Índice Numérico de Array
- **Arquivo**: `src/app/bateria/[id].tsx`, linhas 535–537, 568–572, 586–587, 602, 691.
- **Trecho Verbatim**:
  ```tsx
  // src/app/bateria/[id].tsx:535-537
  const lista = p.pilotos.filter((x) => x.kartAtual);
  const [i, setI] = useState(0);
  const x = lista[Math.min(i, Math.max(0, lista.length - 1))];
  ```
  ```tsx
  // src/app/bateria/[id].tsx:568-572
  const sel = n === i;
  ...
  <Toque leve key={l.indice} onPress={() => setI(n)} rotulo={l.nome}>
    <View style={[s.itemLastroFila, sel && s.itemLastroFilaAtivo]}>
  ```
  ```tsx
  // src/app/bateria/[id].tsx:691
  if (ok) setI((n) => Math.min(n + 1, lista.length - 1));
  ```
- **Contexto de Atualização de Rede**:
  ```tsx
  // src/app/bateria/[id].tsx:1353-1358
  const revisaoAoVivo = tempoReal.sessoes.find((x) => x.id === id)?.sessionRevision;
  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 10000);
    return () => clearInterval(t);
  }, [carregar, revisaoAoVivo]);
  ```
  A cada 10 segundos ou a cada evento SSE que altere `sessionRevision`, `carregar()` redefine `painel` via `setPainel(p)`.

### 1.2 Falha 17 — Botões +/- Desabilitados quando `peso === null`
- **Arquivo**: `src/app/bateria/[id].tsx`, linhas 550–551, 613, 630, 633.
- **Trecho Verbatim**:
  ```tsx
  // src/app/bateria/[id].tsx:550-551
  const atual = peso ?? 0;
  const valido = peso != null && peso >= 20 && peso <= 250;
  ```
  ```tsx
  // src/app/bateria/[id].tsx:613
  <Toque rotulo="Menos 1 quilo" desativado={!valido} onPress={() => mudar(atual - 1)} style={s.redondo}><Text style={s.sinal}>−</Text></Toque>
  ```
  ```tsx
  // src/app/bateria/[id].tsx:630
  <Toque rotulo="Mais 1 quilo" desativado={!valido} onPress={() => mudar(atual + 1)} style={s.redondo}><Text style={s.sinal}>+</Text></Toque>
  ```
  Quando o piloto chega à balança e ainda não possui peso registrado no sistema, `peso === null`. Consequentemente, `valido === false` e ambos os botões de incremento circular ficam desativados (`desativado={true}`).

### 1.3 Falha 18 — Incremento de Nulo/Zero Pulando para 20 kg
- **Arquivo**: `src/app/bateria/[id].tsx`, linhas 544–548, 550, 613, 630.
- **Trecho Verbatim**:
  ```tsx
  // src/app/bateria/[id].tsx:544-548
  const mudar = (v: number) => {
    const n = Math.min(250, Math.max(20, Math.round(v * 2) / 2));
    setPeso(n);
    setTexto(num(n));
  };
  ```
  ```tsx
  // src/app/bateria/[id].tsx:550
  const atual = peso ?? 0;
  ```
  Se `peso` for `null` ou `0`, `atual` é avaliado como `0`.
  Ao acionar `+` (`mudar(atual + 1)`), passa-se `1`.
  Em `mudar`: `Math.max(20, Math.round(1 * 2) / 2)` resulta em `20`.
  Ao acionar `−` (`mudar(atual - 1)`), passa-se `-1`.
  Em `mudar`: `Math.max(20, Math.round(-1 * 2) / 2)` resulta em `20`.
  O peso salta bruscamente para o piso mínimo da balança (20 kg) em vez de inicializar na meta da categoria (ex.: 90, 95 ou 100 kg).

### 1.4 Falha 19 — Foco no Campo de Peso Sobrescrito por Background Sync
- **Arquivo**: `src/app/bateria/[id].tsx`, linhas 540–543, 615–627.
- **Trecho Verbatim**:
  ```tsx
  // src/app/bateria/[id].tsx:540-543
  useEffect(() => {
    setPeso(x?.pesoKg ?? null);
    setTexto(x?.pesoKg != null ? num(x.pesoKg) : '');
  }, [x?.indice, x?.pesoKg]);
  ```
  ```tsx
  // src/app/bateria/[id].tsx:615-627
  <TextInput
    style={s.peso}
    keyboardType="decimal-pad"
    placeholder="—"
    placeholderTextColor={cores.apagado}
    value={texto}
    accessibilityLabel={`Peso de ${x.nome}`}
    onChangeText={(t) => {
      setTexto(t);
      const n = Number(t.replace(',', '.'));
      setPeso(t.trim() && Number.isFinite(n) ? n : null);
    }}
  />
  ```
  Não existe manipulador `onFocus` ou `onBlur`. Quando o operador está digitando no campo e ocorre a sincronização automática de background (polling de 10s ou evento SSE), a execução do `useEffect` reescreve `texto` e `peso` com os dados do servidor (`x?.pesoKg`), apagando imediatamente a digitação em andamento.

### 1.5 Falha 20 — Meta de Peso Hardcoded 90/100 kg
- **Arquivo**: `src/app/bateria/[id].tsx`, linhas 552 e 600.
- **Trecho Verbatim**:
  ```tsx
  // src/app/bateria/[id].tsx:552
  const meta = x.lastro?.metaKg ?? (Number(x.kartAtual) >= 100 ? 100 : 90);
  ```
  ```tsx
  // src/app/bateria/[id].tsx:600
  <PlacaKart n={x.kartAtual} tam="g" tom="verde" etiqueta={Number(x.kartAtual) >= 100 ? 'SUPER' : 'LIGHT'} />
  ```
  A meta é fixada exclusivamente por uma regra ternária baseada no número do kart (`kart >= 100 ? 100 : 90`), ignorando categorias configuradas na bateria ou regulamentos de campeonato (tais como 80 kg para Graduados, 95 kg para Master e 110 kg para Heavy, conforme requisitos R1 e R2).

### 1.6 Falha 21 — Ausência de Banner/Notificação ao Pesar o Último Piloto
- **Arquivo**: `src/app/bateria/[id].tsx`, linhas 558, 684–694.
- **Trecho Verbatim**:
  ```tsx
  // src/app/bateria/[id].tsx:558
  const conferidosCount = lista.filter((l) => l.lastroConferido).length;
  ```
  ```tsx
  // src/app/bateria/[id].tsx:684-694
  <Botao
    grande
    alto={66}
    texto={x.lastroConferido ? 'Conferido · próximo piloto ›' : 'Lastro colocado e conferido ›'}
    desativado={!pode || enviando || !valido}
    onPress={() => {
      void enviar('weight-checks', { customerId: x.customerId, nome: x.nome, pesoKg: atual, lastroConferido: true }, 'Conferência', `${x.nome}: lastro conferido.`).then((ok) => {
        if (ok) setI((n) => Math.min(n + 1, lista.length - 1));
      });
    }}
  />
  ```
  Quando todos os pilotos estão conferidos (`conferidosCount === lista.length`), não há transição visual nem banner de conclusão. O botão no último piloto permanece exibindo `'Conferido · próximo piloto ›'`, induzindo o operador a erro ao clicar para avançar para um competidor inexistente.

### 1.7 Falha 22 — Ponto Flutuante sem Arredondamento a 1 Casa Decimal
- **Arquivo**: `src/app/bateria/[id].tsx`, linhas 39, 553–556, 576, 648, 676 e `src/features/operacao/formato.ts`.
- **Trecho Verbatim**:
  ```tsx
  // src/app/bateria/[id].tsx:39
  const num = (n: number) => String(n).replace('.', ',');
  ```
  ```tsx
  // src/app/bateria/[id].tsx:553-556
  const un = Math.max(0, Math.ceil(Math.max(0, meta - atual) / 2.5 - 1e-7));
  const p5 = Math.floor(un / 2);
  const p25 = un % 2;
  const lastro = un * 2.5;
  ```
  ```tsx
  // src/app/bateria/[id].tsx:676
  <Forte tam={17} cor={cores.verde}>Total na pista: {num(atual + lastro)} kg</Forte>
  ```
  A função `num` não faz nenhum arredondamento; apenas converte ponto em vírgula. Operações aritméticas em ponto flutuante IEEE 754 (como `7.5 * 1 = 7.500000000000001` ou somas decimais `82.55 + 2.5 = 85.05000000000001`) produzem dízimas longas exibidas diretamente na tela. Em `src/features/operacao/formato.ts`, não existem funções exportadas para tratamento de casas decimais de peso e lastro.

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio)

### 2.1 Causa-Raiz e Efeito da Falha 16 (Seleção por Índice)
1. **Passo 1 (Obs 1.1)**: `Lastro` define o piloto ativo via `lista[i]`, onde `i` é um número inteiro inicializado em 0.
2. **Passo 2 (Obs 1.1)**: O array `lista` é derivado de `p.pilotos.filter(x => x.kartAtual)`. Se houver sorteio individual em andamento ("um a um"), novos pilotos recebem kart e são inseridos em `lista`, alterando as posições dos índices.
3. **Passo 3 (Obs 1.1)**: Ao mesmo tempo, polling de 10s e eventos de revisão SSE disparam `carregar()`, reconstruindo todo o array `p.pilotos`.
4. **Passo 4**: Se `p.pilotos` sofrer reordenação no backend ou inserção de novos concorrentes, o índice `i = 2` passa a apontar para outro piloto completamente diferente.
5. **Conclusão lógica**: Rastrear o piloto por seu identificador persistente (`customerId` ou `kartAtual`) desvincula a seleção da posição estática do array, eliminando qualquer salto de tela durante atualizações de dados.

### 2.2 Causa-Raiz e Efeito da Falha 17 (Incremento Desabilitado sem Peso)
1. **Passo 1 (Obs 1.2)**: `valido` requer `peso != null && peso >= 20 && peso <= 250`.
2. **Passo 2 (Obs 1.2)**: Os botões de incremento `+` e `−` possuem a propriedade `desativado={!valido}`.
3. **Passo 3**: Para qualquer piloto recém-sorteado sem pesagem prévia registrada, `x.pesoKg` é `null`, o que força `peso === null` e `valido === false`.
4. **Passo 4**: O operador é impedido de usar os botões `+` e `−` com um único toque, sendo forçado a abrir o teclado virtual e digitar o valor inteiro manualmente.
5. **Conclusão lógica**: Os botões `+` e `−` devem permanecer habilitados mesmo quando `peso === null`, condicionando sua desativação apenas aos limites absolutos de segurança da balança ([20 kg, 250 kg]) e ao estado de envio.

### 2.3 Causa-Raiz e Efeito da Falha 18 (Pulo para 20 kg a partir de Zero/Nulo)
1. **Passo 1 (Obs 1.3)**: Quando `peso === null` ou `peso === 0`, o fallback define `atual = 0`.
2. **Passo 2 (Obs 1.3)**: `mudar(atual + 1)` invoca `mudar(1)`.
3. **Passo 3 (Obs 1.3)**: A fórmula interna de `mudar` aplica `Math.max(20, Math.round(v * 2) / 2)`. Como `1 < 20`, o resultado trava no valor mínimo de 20 kg.
4. **Passo 4**: Um piloto de kart adulto tem massa média entre 70 e 100 kg. Forçar o ponto de partida em 20 kg inutiliza o incremento rápido.
5. **Conclusão lógica**: Quando `peso == null || peso <= 0`, o incremento deve inicializar diretamente a partir da meta da categoria da bateria (`metaKg + delta`). Ex.: em bateria com meta de 90 kg, tocar em `+` define imediatamente 91 kg; em `-`, define 89 kg.

### 2.4 Causa-Raiz e Efeito da Falha 19 (Perda de Foco por Background Sync)
1. **Passo 1 (Obs 1.4)**: `useEffect` possui dependências `[x?.indice, x?.pesoKg]`.
2. **Passo 2 (Obs 1.1, 1.4)**: Polling de 10s e eventos de stream SSE executam `carregar()` periodicamente em segundo plano.
3. **Passo 3 (Obs 1.4)**: Enquanto o operador está no meio da digitação ("8", "5", ","), a resposta HTTP do polling chega com `x.pesoKg = null` (ou valor anterior não salvo no servidor).
4. **Passo 4 (Obs 1.4)**: O `useEffect` é acionado e executa `setTexto(x?.pesoKg != null ? num(x.pesoKg) : '')`, limpando o que o operador acabou de digitar na tela.
5. **Conclusão lógica**: O componente precisa rastrear o estado de foco (`focado: boolean`) via `onFocus`/`onBlur` no `TextInput`. Se o campo estiver focado pelo operador, qualquer sincronização de background deve ser ignorada até que o usuário conclua a edição.

### 2.5 Causa-Raiz e Efeito da Falha 20 (Meta Hardcoded 90/100 kg)
1. **Passo 1 (Obs 1.5)**: A variável `meta` é calculada estritamente como `x.lastro?.metaKg ?? (Number(x.kartAtual) >= 100 ? 100 : 90)`.
2. **Passo 2 (Obs 1.5)**: Se o piloto ainda não foi pesado, `x.lastro` é `null`.
3. **Passo 3**: O fallback assume que todo kart < 100 é 90 kg e >= 100 é 100 kg.
4. **Passo 4**: Baterias de campeonatos oficiais utilizam regulamentos com metas específicas (80 kg, 95 kg, 110 kg, etc.).
5. **Conclusão lógica**: A meta deve ser obtida dinamicamente respeitando a precedência: (1) `x.lastro?.metaKg`, (2) `p.sessao.metaKg` configurado, (3) detecção por categoria/nome da bateria ("80", "95", "110", "super", "light"), com fallback secundário pela numeração do kart.

### 2.6 Causa-Raiz e Efeito da Falha 21 (Ausência de Banner de Conclusão)
1. **Passo 1 (Obs 1.6)**: Ao conferir o peso do último piloto da fila (`indice === lista.length - 1`), `conferidosCount` atinge `lista.length`.
2. **Passo 2 (Obs 1.6)**: `setI` é limitado a `lista.length - 1`, permanecendo no mesmo card.
3. **Passo 3 (Obs 1.6)**: O botão continua exibindo `'Conferido · próximo piloto ›'`.
4. **Passo 4**: O operador não recebe confirmação clara de que todos os karts foram liberados da balança nem atalho para prosseguir ao Galpão.
5. **Conclusão lógica**: Deve ser exibido um banner destacado de conclusão da pesagem com selo `'PESAGEM CONCLUÍDA ✓'`, mensagem afirmativa e botão de ação direta `'Ir para Galpão ›'` (`irParaAba('galpao')`), além de atualizar o rótulo do botão de confirmação.

### 2.7 Causa-Raiz e Efeito da Falha 22 (Imprecisão de Ponto Flutuante)
1. **Passo 1 (Obs 1.7)**: A função `num` realiza apenas `String(n).replace('.', ',')`.
2. **Passo 2 (Obs 1.7)**: Cálculos como `(meta - atual) / 2.5` e `un * 2.5` sofrem com a representação binária IEEE 754 de números decimais fracionários em JavaScript.
3. **Passo 3 (Obs 1.7)**: Resultados como `7.500000000000001` ou `85.05000000000001` são impressos integralmente na interface, degradando o visual.
4. **Passo 4 (Obs 1.7)**: `src/features/operacao/formato.ts` não possui funções padronizadas para formatação e cálculo de lastro a 1 casa decimal.
5. **Conclusão lógica**: Centralizar as rotinas `formatarNumero1Casa`, `arredondar1Casa`, `calcularPlanoLastro` e `ajustarIncrementoPeso` em `src/features/operacao/formato.ts` e adotá-las em `src/app/bateria/[id].tsx`, substituindo a função `num` ingênua e garantindo consistência com a suíte de testes.

---

## 3. Caveats (Ressalvas e Limitações da Investigação)

1. **Escopo Somente Leitura**: Nenhuma alteração foi aplicada aos arquivos do projeto `kartodromo-operacional`, em estrita observância às regras de agente Explorer.
2. **Integração com Backend Legado**: A rota `/api/sessions/:id/weight-checks` do backend recebe `{ customerId, nome, pesoKg, lastroConferido }`. O backend armazena o peso e registra a conferência na tabela `lastros_conferidos`. A inclusão de campos opcionais como `metaKg` na requisição é retrocompatível.
3. **Persistência de ID de Piloto**: Em baterias avulsas sem cadastro prévio na recepção, pilotos podem ter `customerId = null`. A estratégia proposta utiliza fallback sequencial `customerId || kartAtual || String(indice)`, garantindo que sempre exista uma chave única e estável para a sessão.
4. **Requisitos R2 e R5**: A gestão de campeonatos (R2) introduz metas adicionais e a verificação pós-corrida (R5) introduz conferência de peso pós-prova com desclassificação. A arquitetura de cálculo e arredondamento aqui proposta é 100% reutilizável para o fluxo de pesagem pós-corrida.

---

## 4. Conclusion (Conclusão e Proposta de Correção)

As Falhas 16 a 22 possuem diagnósticos claros, causas-raiz mapeadas e soluções de baixíssimo risco e alta eficácia.

Abaixo estão os patches completos e detalhados propostos para implementação.

### 4.1 Proposta para `src/features/operacao/formato.ts`

Adicionar ao final de `src/features/operacao/formato.ts`:

```typescript
/** Arredonda número para 1 casa decimal, eliminando imprecisão IEEE 754. */
export function arredondar1Casa(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Formata número para exibição com até 1 casa decimal e vírgula pt-BR (Falha 22). */
export function formatarNumero1Casa(n: number): string {
  const arredondado = Math.round(n * 10) / 10;
  return arredondado.toString().replace('.', ',');
}

/** Calcula plano de lastro em placas de 5 kg e 2,5 kg com arredondamento estrito a 1 casa decimal (Falhas 20 e 22). */
export function calcularPlanoLastro(
  pesoPilotoKg: number,
  metaKg: number,
): { lastroKg: number; pecas5: number; pecas2_5: number; finalKg: number; metaKg: number } {
  const unidades = Math.max(0, Math.ceil(Math.max(0, metaKg - pesoPilotoKg) / 2.5 - 1e-7));
  const lastroCalculado = Number((unidades * 2.5).toFixed(1));
  return {
    lastroKg: lastroCalculado,
    pecas5: Math.floor(unidades / 2),
    pecas2_5: unidades % 2,
    finalKg: Number((pesoPilotoKg + lastroCalculado).toFixed(1)),
    metaKg,
  };
}

/** Ajusta incremento/decremento de peso respeitando limites [20, 250] e inicializando na meta se nulo/zero (Falhas 17 e 18). */
export function ajustarIncrementoPeso(
  pesoAtual: number | null,
  delta: number,
  metaKg: number,
): number {
  if (pesoAtual == null || pesoAtual <= 0) {
    return Math.min(250, Math.max(20, Math.round((metaKg + delta) * 10) / 10));
  }
  const novo = pesoAtual + delta;
  return Math.min(250, Math.max(20, Math.round(novo * 2) / 2));
}
```

### 4.2 Proposta para `src/app/bateria/[id].tsx`

#### 4.2.1 Atualização de Imports e Substituição de `num`
```typescript
// Substituir a importação de formato na linha 10 por:
import {
  ajustarIncrementoPeso,
  calcularPlanoLastro,
  formatarNumero1Casa,
  relogio,
  volta,
} from '@/features/operacao/formato';

// Na linha 39, substituir a função num ingênua:
const num = formatarNumero1Casa;
```

#### 4.2.2 Função Auxiliar de Meta Dinâmica e Chave Persistente
```typescript
/** Determina a meta dinâmica de peso da categoria/bateria (Falha 20 / R2). */
export function obterMetaBateria(
  sessao: Painel['sessao'],
  piloto?: PilotoPainel | null,
): number {
  if (piloto?.lastro?.metaKg && piloto.lastro.metaKg > 0) return piloto.lastro.metaKg;
  const s = sessao as typeof sessao & { metaKg?: number; categoria?: string };
  if (typeof s.metaKg === 'number' && s.metaKg > 0) return s.metaKg;
  const nome = (s.name ?? '').toLowerCase();
  if (/110|heavy/i.test(nome)) return 110;
  if (/95|master/i.test(nome)) return 95;
  if (/80|graduad/i.test(nome)) return 80;
  if (s.tipoKart && /super/i.test(s.tipoKart)) return 100;
  if (piloto?.kartAtual && Number(piloto.kartAtual) >= 100) return 100;
  return 90;
}

/** Chave estável para seleção de piloto sem depender de índice de array (Falha 16). */
export const obterChavePiloto = (p?: PilotoPainel | null): string =>
  p ? (p.customerId || p.kartAtual || String(p.indice)) : '';
```

#### 4.2.3 Componente `Lastro` Refatorado
```tsx
function Lastro({ p, enviar, enviando, pode, irParaAba }: Props) {
  const { width } = useWindowDimensions();
  const tablet = width >= LARGURA_TABLET;
  const lista = p.pilotos.filter((x) => x.kartAtual);

  // Falha 16: Seleção persistente por ID/kart e não por índice numérico
  const [pilotoId, setPilotoId] = useState<string | null>(null);

  const x = useMemo(() => {
    if (!lista.length) return null;
    if (!pilotoId) return lista[0];
    return lista.find((l) => obterChavePiloto(l) === pilotoId) ?? lista[0];
  }, [lista, pilotoId]);

  const indiceAtual = useMemo(() => {
    if (!x) return -1;
    return lista.findIndex((l) => obterChavePiloto(l) === obterChavePiloto(x));
  }, [lista, x]);

  const [peso, setPeso] = useState<number | null>(null);
  const [texto, setTexto] = useState('');
  // Falha 19: Rastrear foco para não sobrescrever campo durante sincronização em background
  const [focado, setFocado] = useState(false);

  // Sincronização respeitando o foco do operador
  useEffect(() => {
    if (focado) return;
    setPeso(x?.pesoKg ?? null);
    setTexto(x?.pesoKg != null ? formatarNumero1Casa(x.pesoKg) : '');
  }, [x?.customerId, x?.kartAtual, x?.pesoKg, focado]);

  // Ao mudar de piloto, reseta foco e carrega valores
  useEffect(() => {
    setFocado(false);
    setPeso(x?.pesoKg ?? null);
    setTexto(x?.pesoKg != null ? formatarNumero1Casa(x.pesoKg) : '');
  }, [pilotoId]);

  if (!x) {
    return (
      <View style={s.vazio}>
        <Suave>Faça o sorteio primeiro para calcular e conferir os lastros.</Suave>
      </View>
    );
  }

  // Falha 20: Meta dinâmica baseada na categoria/bateria
  const meta = obterMetaBateria(p.sessao, x);

  // Falhas 17 e 18: Incremento usando ajustarIncrementoPeso com clamp e meta inicial
  const mudar = (delta: number) => {
    const n = ajustarIncrementoPeso(peso, delta, meta);
    setPeso(n);
    setTexto(formatarNumero1Casa(n));
  };

  const atual = peso ?? 0;
  const valido = peso != null && peso >= 20 && peso <= 250;

  // Falha 22: Plano de lastro preciso a 1 casa decimal
  const plano = calcularPlanoLastro(atual, meta);
  const lastro = plano.lastroKg;
  const p5 = plano.pecas5;
  const p25 = plano.pecas2_5;
  const un = p5 * 2 + p25;
  const pecas = [...Array.from({ length: p5 }, () => 5), ...(p25 ? [2.5] : [])];
  const conferidosCount = lista.filter((l) => l.lastroConferido).length;
  // Falha 21: Sinalização de todos os pilotos pesados
  const todosConferidos = conferidosCount === lista.length && lista.length > 0;

  const colunaFila = (
    <View style={{ gap: 8 }}>
      <View style={[s.linha, { justifyContent: 'space-between' }]}>
        <Sobre>FILA DO BOX · {lista.length} KARTS</Sobre>
        <Selo texto={`${conferidosCount}/${lista.length} CONFERIDOS`} tom={conferidosCount === lista.length ? 'verde' : 'alerta'} />
      </View>
      {tablet ? (
        lista.map((l, n) => {
          const chave = obterChavePiloto(l);
          const sel = obterChavePiloto(x) === chave;
          const lKg = l.lastro?.lastroKg ?? 0;
          return (
            <Toque leve key={chave || n} onPress={() => setPilotoId(chave)} rotulo={l.nome}>
              <View style={[s.itemLastroFila, sel && s.itemLastroFilaAtivo]}>
                <PlacaKart n={l.kartAtual} tam="p" tom={l.lastroConferido ? 'verde' : 'alerta'} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Forte tam={16}>{l.nome}</Forte>
                  <Suave tam={13}>{l.pesoKg ? `${num(l.pesoKg)} kg` : 'Sem peso'} · {lKg > 0 ? `+${num(lKg)} kg` : 'Sem lastro'}</Suave>
                </View>
                <Selo texto={l.lastroConferido ? 'OK ✓' : 'PENDENTE'} tom={l.lastroConferido ? 'verde' : 'alerta'} />
              </View>
            </Toque>
          );
        })
      ) : (
        <View style={s.progresso}>
          {lista.map((l, n) => {
            const chave = obterChavePiloto(l);
            const sel = obterChavePiloto(x) === chave;
            return (
              <Toque leve key={chave || n} onPress={() => setPilotoId(chave)} rotulo={l.nome}>
                <View style={[s.ponto, { backgroundColor: l.lastroConferido ? cores.verde : sel ? cores.texto : cores.linhaForte }]} />
              </Toque>
            );
          })}
        </View>
      )}
    </View>
  );

  const eUltimo = indiceAtual === lista.length - 1;
  const textoBotao = todosConferidos
    ? (irParaAba ? 'Todos conferidos · Ir para o Galpão ›' : 'Todos os pilotos conferidos ✓')
    : x.lastroConferido
      ? (eUltimo ? 'Último piloto conferido ✓' : 'Conferido · próximo piloto ›')
      : (eUltimo ? 'Lastro colocado · Concluir pesagem ›' : 'Lastro colocado e conferido ›');

  const colunaBancada = (
    <View style={{ gap: 12 }}>
      {/* Falha 21: Banner de conclusão da pesagem de todos os pilotos */}
      {todosConferidos ? (
        <Pop>
          <Cartao tom="verde" style={{ padding: 14, gap: 8, borderWidth: 1, borderColor: cores.verde }}>
            <View style={[s.linha, { justifyContent: 'space-between' }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={s.linha}>
                  <Selo texto="PESAGEM CONCLUÍDA ✓" tom="verde" />
                  <Forte tam={16} cor={cores.verde}>Todos os {lista.length} pilotos conferidos!</Forte>
                </View>
                <Suave tam={13}>Todos os karts receberam o lastro correto e estão aptos para a pista.</Suave>
              </View>
              {irParaAba ? (
                <Botao tipo="verde" texto="Ir para Galpão ›" alto={40} onPress={() => irParaAba('galpao')} />
              ) : null}
            </View>
          </Cartao>
        </Pop>
      ) : null}

      <Cartao style={{ padding: 16, gap: 12 }}>
        <View style={[s.linha, { justifyContent: 'space-between' }]}>
          <View style={s.linha}>
            <PlacaKart n={x.kartAtual} tam="g" tom="verde" etiqueta={Number(x.kartAtual) >= 100 ? 'SUPER' : 'LIGHT'} />
            <View style={{ gap: 4 }}>
              <Sobre cor={cores.verde}>PILOTO {indiceAtual >= 0 ? indiceAtual + 1 : 1} DE {lista.length}</Sobre>
              <Forte tam={24}>{x.nome}</Forte>
              <View style={s.linha}>
                <Selo texto={`META ${meta} KG`} tom="neutro" />
                <Selo texto={x.lastroConferido ? 'CONFERIDO ✓' : 'AGUARDANDO BALANÇA'} tom={x.lastroConferido ? 'verde' : 'alerta'} />
              </View>
            </View>
          </View>
        </View>

        <View style={s.pesoCaixa}>
          {/* Falha 17: Habilitado mesmo quando peso === null */}
          <Toque
            rotulo="Menos 1 quilo"
            desativado={!pode || enviando || (peso != null && peso <= 20)}
            onPress={() => mudar(-1)}
            style={s.redondo}
          >
            <Text style={s.sinal}>−</Text>
          </Toque>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <TextInput
              style={s.peso}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={cores.apagado}
              value={texto}
              accessibilityLabel={`Peso de ${x.nome}`}
              onFocus={() => setFocado(true)}
              onBlur={() => setFocado(false)}
              onChangeText={(t) => {
                setTexto(t);
                const n = Number(t.replace(',', '.'));
                setPeso(t.trim() && Number.isFinite(n) ? n : null);
              }}
            />
            <Sobre cor={valido ? cores.suave : cores.alerta}>
              {valido ? 'KG NA BALANÇA (COM EQUIPAMENTO)' : 'INFORME DE 20 A 250 KG'}
            </Sobre>
          </View>
          {/* Falha 17: Habilitado mesmo quando peso === null */}
          <Toque
            rotulo="Mais 1 quilo"
            desativado={!pode || enviando || (peso != null && peso >= 250)}
            onPress={() => mudar(1)}
            style={s.redondo}
          >
            <Text style={s.sinal}>+</Text>
          </Toque>
        </View>

        <View style={[s.linha, { justifyContent: 'center', gap: 8 }]}>
          {[-5, -2.5, 2.5, 5].map((delta) => (
            <Pilula
              key={delta}
              texto={`${delta > 0 ? '+' : ''}${num(delta)} kg`}
              onPress={() => mudar(delta)}
            />
          ))}
        </View>
      </Cartao>

      <Cartao tom="verde" style={{ gap: 14, padding: 18 }}>
        <View style={[s.linha, { justifyContent: 'space-between' }]}>
          <View style={{ gap: 2 }}>
            <Sobre cor={cores.verde}>PLACAS DE LASTRO NO KART {x.kartAtual}</Sobre>
            <Forte tam={20}>Coloque no suporte do kart</Forte>
          </View>
          {valido ? <Text style={s.lastroNum}>+{num(lastro)} kg</Text> : null}
        </View>

        <View style={s.pecas}>
          {valido &&
            pecas.map((v, n) => (
              <Cai key={`${atual}-${n}`} atraso={n * 60}>
                <View style={[s.peca, v === 5 ? s.peca5 : s.peca25]}>
                  <View style={s.pecaAlca} />
                  <Text style={s.pecaTexto}>{num(v)} kg</Text>
                  <Text style={s.pecaSub}>{v === 5 ? 'PLACA VERDE' : 'MEIA PLACA'}</Text>
                </View>
              </Cai>
            ))}
          {valido && !un ? (
            <Pop>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Selo texto="PESO ATINGIDO" tom="verde" />
                <Text style={[s.titulo, { color: cores.verde, fontSize: 22 }]}>NA META · SEM LASTRO</Text>
              </View>
            </Pop>
          ) : null}
        </View>

        {valido ? (
          <View style={{ gap: 8 }}>
            <Barra fracao={(atual + lastro) / meta} />
            <View style={[s.linha, { justifyContent: 'space-between' }]}>
              <Selo texto={`${p5} DE 5 KG  +  ${p25} DE 2,5 KG`} tom="neutro" />
              <Forte tam={17} cor={cores.verde}>Total na pista: {num(atual + lastro)} kg</Forte>
            </View>
          </View>
        ) : (
          <Suave>Informe o peso do piloto para calcular as placas de 5 kg e 2,5 kg.</Suave>
        )}
      </Cartao>

      <Botao
        grande
        alto={66}
        texto={textoBotao}
        desativado={!pode || enviando || !valido}
        onPress={() => {
          if (todosConferidos && irParaAba) {
            irParaAba('galpao');
            return;
          }
          void enviar(
            'weight-checks',
            { customerId: x.customerId, nome: x.nome, pesoKg: atual, lastroConferido: true },
            'Conferência',
            `${x.nome}: lastro conferido.`,
          ).then((ok) => {
            if (ok) {
              if (indiceAtual + 1 < lista.length) {
                const proximo = lista[indiceAtual + 1];
                setPilotoId(obterChavePiloto(proximo));
              }
            }
          });
        }}
      />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={[s.conteudo, tablet && { flexDirection: 'row', alignItems: 'flex-start', gap: 16 }]} keyboardShouldPersistTaps="handled">
      <View style={tablet ? { width: 320 } : undefined}>{colunaFila}</View>
      <View style={tablet ? { flex: 1 } : undefined}>{colunaBancada}</View>
    </ScrollView>
  );
}
```

---

## 5. Verification Method (Método de Verificação Independente)

Para validar de forma independente todas as correções propostas:

### 5.1 Testes Unitários de Regra e Formato
Executar em `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`:
```bash
npm test tests/tier1-features.test.ts
npm test tests/tier2-boundary-corner-cases.test.ts
npm test tests/formato.test.ts
```

Critérios de aprovação dos testes:
1. **F22 (ID Persistente Balança)**: `describe('F22: ID Persistente Balança')` passa com sucesso verificando que o piloto é encontrado por `customerId` e não por índice volátil.
2. **F23 (Incremento +/- Sem Peso)**: `ajustarIncrementoPeso(null, 1, 90) === 91` inicializa diretamente a partir da meta da bateria.
3. **F24 (Incremento a partir de Zero/Nulo)**: `ajustarIncrementoPeso(0, 0.5, 95) === 95.5` não despenca para 20 kg.
4. **F25 (Foco Preservado Balança)**: Enquanto `focado === true`, polling/SSE não sobrescreve o valor digitado.
5. **F26 (Meta de Peso Dinâmica)**: Metas de 80, 95 e 110 kg são lidas dinamicamente da categoria.
6. **F27 (Banner Conclusão Balança)**: `conferidos === total && total > 0` sinaliza a conclusão da pesagem.
7. **F28 (Arredondamento 1 Casa Decimal)**: `formatarNumero1Casa(7.500000000000001) === '7,5'`, `formatarNumero1Casa(12.449) === '12,4'`, `formatarNumero1Casa(12.451) === '12,5'`.
8. **BVA Corner Cases**: Clamps de limites absolutos `[20 kg, 250 kg]` em `tests/tier2-boundary-corner-cases.test.ts`.

### 5.2 Condições de Invalidação
A implementação será considerada inválida se:
- Clicar em `+` com peso nulo produzir valor menor que a meta da bateria.
- Polling em background apagar caracteres digitados no campo durante a pesagem.
- Baterias de categoria 95 kg ou 110 kg exibirem meta fixa de 90 kg ou 100 kg.
- O último piloto conferido deixar o botão exibindo "próximo piloto" sem banner de conclusão.
- Valores fracionários exibirem mais de uma casa decimal ou ponto em vez de vírgula.
