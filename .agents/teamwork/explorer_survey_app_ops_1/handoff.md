# Relatório de Investigação Técnica — Fluxos Operacionais (R1 Falhas 08 a 38)

**Autor**: Explorer 2 (Operations Flow Explorer)  
**Data**: 2026-11-02  
**Repositório Alvo**: `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`  
**Integração Backend**: `/Users/pedroguilherme/PROJETOS/KARTODROMO` e `/Users/pedroguilherme/PROJETOS/KARTODROMO-snapshot/lib/app-v1`

---

## 1. Observações

### Visão Geral da Arquitetura do App Operacional
O app operacional (`kartodromo-operacional`) é uma aplicação React Native (0.86.3) com Expo SDK 57 (~57.0.31) e TypeScript (~6.0.3) utilizando roteamento via `expo-router` (~57.0.29).
A estrutura dos módulos e telas operacionais observada é:
- `src/app/index.tsx`: Tela inicial (Painel principal com bateria viva em destaque, próxima bateria na fila, alertas da frota/recepção/lastro, grade de módulos operacionais e histórico de baterias recentes).
- `src/app/bateria/[id].tsx`: Tela central de operações com cinco abas:
  1. `Sorteio`: Sorteio geral e "Um a um", atribuição manual e karts reservas.
  2. `Lastro`: Balança de pilotos, conferência de peso e indicação de placas de lastro (5 kg e 2,5 kg).
  3. `Galpao`: Troca de karts no box, retenção de voltas/recomeço e motivo da troca.
  4. `Direcao`: Painel de bandeiras, comissário de prova, advertências, acréscimo de tempo (+5s/+10s/+30s), bandeira preta, súmula e comandos de prova (start, checkered, close, restart, cancel).
  5. `Recepcao`: Visão de check-in e pendências de termos e pagamento.
- `src/app/frota.tsx`: Gestão de frota, karts disponíveis, em pista e em manutenção, filtros e devolução à operação.
- `src/app/passagens/[id].tsx`: Telemetria e auditoria de transponder, voltas válidas/suspeitas/excluídas, invalidação, exclusão, restauração, inserção manual e transferência de passagens.
- `src/features/operacao/baterias.ts`: Agrupamento de baterias por chave e ordenação de etapas.
- `src/features/operacao/sorteio.ts`: Algoritmo de sorteio de karts com restrição de exceções.
- `src/features/operacao/acao.ts`: Hook `useAcao` com controle de idempotência (`operationId`) e tratamento de comandos incertos via `SecureStore`.

---

### Detalhamento das Falhas 08 a 15 (Baterias e Sorteio)

#### Falha 08: Normalização da Chave de Agrupamento de Baterias
- **Arquivo**: `src/features/operacao/baterias.ts`
- **Linhas**: 13–24
- **Código Observado**:
  ```ts
  export function agruparBaterias(sessoes: Sessao[]): Bateria[] {
    const grupos = new Map<string, Sessao[]>();
    for (const s of sessoes) {
      const chave = s.agendaId != null
        ? `agenda-${s.agendaId}`
        : s.programaId
          ? `prog-${s.programaId}`
          : s.groupId
            ? `${s.id.slice(0, 10)}-grp-${s.groupId}`
            : `${s.id.slice(0, 10)}-${nomeDaBateria(s.name).toLowerCase()}`;
      grupos.set(chave, [...(grupos.get(chave) ?? []), s]);
    }
  ```
- **Problema**: Quando `groupId` ou o identificador da sessão contêm sufixos de etapa como `-tomada`, `-corrida` ou `-treino` (ex.: `b516-tomada` e `b516-corrida`), `chave` não remove o sufixo da etapa na chave de agrupamento. Isso gera chaves distintas (`...-grp-b516-tomada` e `...-grp-b516-corrida`), duplicando a bateria na tela inicial em vez de agrupá-la em uma única bateria com suas etapas.
- **Correção Necessária**: Aplicar `.replace(/-(?:tomada|corrida|treino).*$/i, '')` na chave calculada antes de inserir no mapa de grupos.

#### Falha 09: Ordem dos Pilotos no Modo "Um a um"
- **Arquivo**: `src/features/operacao/sorteio.ts` e `src/app/bateria/[id].tsx`
- **Linhas em `sorteio.ts`**: 19–26
- **Linhas em `bateria/[id].tsx`**: 94–100, 125–135, 343
- **Código Observado (`sorteio.ts`)**:
  ```ts
  // quem tem mais restrições escolhe primeiro
  for (const p of [...pilotos].sort((a, b) => b.excecoes.length - a.excecoes.length)) {
    if (!baralho.length) { semKart.push(p.nome); continue; }
    const pos = baralho.findIndex((k) => !p.excecoes.includes(k));
    const [kart] = baralho.splice(pos >= 0 ? pos : 0, 1);
    atribuicoes.push({ customerId: p.customerId, nome: p.nome, kart });
  }
  return { atribuicoes, semKart };
  ```
- **Problema**: `sortear` reordena a lista por quantidade decrescente de restrições (`b.excecoes.length - a.excecoes.length`). As `atribuicoes` retornadas ficam nessa ordem reordenada. No modo "Um a um", o fluxo consome `previa[indiceUmAUm]`, fazendo com que os pilotos sejam chamados fora da ordem original da inscrição/grade, gerando confusão no grid de largada.
- **Correção Necessária**: Preservar a ordem original dos pilotos na saída de `atribuicoes` ou reordenar `atribuicoes` de volta para a ordem de entrada de `pilotos` (usando mapa de índices originais) antes de carregar o modo "Um a um".

#### Falha 10: Sorteio de Baterias Avulsas com Recepção Offline
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas**: 443–448, 461–468
- **Código Observado**:
  ```tsx
  {!p.sessao.recepcaoDisponivel ? (
    <Cartao tom="erro">
      <Forte cor={cores.erroClaro}>Recepção indisponível</Forte>
      <Suave>Sorteio bloqueado até voltar.</Suave>
    </Cartao>
  ) : null}
  ...
  <Botao
    grande
    alto={68}
    texto={...}
    onPress={comecar}
    desativado={!pode || !livres.length || !p.sessao.recepcaoDisponivel}
  />
  ```
- **Problema**: O botão de início de sorteio e o alerta de bloqueio consideram incondicionalmente `!p.sessao.recepcaoDisponivel`. Em sessões avulsas onde `!p.sessao.vinculadaRecepcao` (baterias criadas direto na cronometragem sem vínculo com a recepção), o sorteio fica indevidamente bloqueado se a recepção estiver fora do ar.
- **Correção Necessária**: Condicionar o bloqueio a `(p.sessao.vinculadaRecepcao && !p.sessao.recepcaoDisponivel)`.

#### Falha 11: Preservação da Prévia em Concorrência 409
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas**: 171–188
- **Código Observado**:
  ```ts
  const gravar = async () => {
    setFase('gravando');
    const modoApi = modoSorteio === 'UM_A_UM' ? 'um_a_um' : 'todos';
    const ok = await enviar(...);
    if (ok) {
      setFase('gravado');
      setXadrez(true);
    } else {
      setPrevia([]);
      setFase('inicio');
    }
  };
  ```
- **Problema**: Se a requisição de gravação falhar com 409 Conflict (`sessionRevision` desatualizada por concorrência de rede), `gravar` executa `setPrevia([]); setFase('inicio');`, descartando completamente todo o sorteio já conferido e forçando o operador a sortear tudo novamente.
- **Correção Necessária**: Em caso de falha 409, preservar `previa`, manter `fase` em `'conferir'` e atualizar a revisão interna (`revisaoSorteio.current = painel.sessao.sessionRevision`) para permitir reenvio imediato com um clique.

#### Falha 12: Condição de Bloqueio do Botão "Recusar / Outro"
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas**: 151–159, 404–405
- **Código Observado**:
  ```tsx
  <Botao tipo="neutro" alto={52} texto="Recusar / outro" onPress={recusarKartUmAUm} desativado={livres.length <= previa.length} />
  ```
- **Problema**: A condição `livres.length <= previa.length` desativa o botão de troca individual quando o número total de karts livres é igual ou menor ao número de pilotos na bateria (ex.: 20 karts livres para 20 pilotos). Mesmo havendo outros karts elegíveis ainda não aceitos por pilotos subsequentes na fila do "Um a um", o botão fica permanentemente bloqueado.
- **Correção Necessária**: A condição de desativação deve verificar se existem karts candidatos alternativos para o piloto atual que respeitem suas restrições e não tenham sido aceitos ainda.

#### Falha 13: Rótulo do Botão no Modo "Um a um" para 1 Piloto
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas**: 407, 464
- **Código Observado**:
  ```tsx
  texto={inicial ? (modoSorteio === 'UM_A_UM' ? 'CHAMAR 1 A 1 ›' : 'SORTEAR AGORA ›') : `SORTEAR SÓ ${faltam.length} ›`}
  ...
  <Botao alto={52} texto={indiceUmAUm + 1 >= previa.length ? 'Conferir ›' : 'Aceitar ›'} onPress={aceitarKartUmAUm} />
  ```
- **Problema**: Quando há apenas 1 piloto elegível na bateria, o botão no modo "Um a um" exibe "CHAMAR 1 A 1 ›", o que é contra-intuitivo para um único piloto, e no card o botão final deve indicar claramente confirmação imediata.
- **Correção Necessária**: Exibir rótulo contextual: se `faltam.length === 1` e `modoSorteio === 'UM_A_UM'`, exibir `'CONFIRMAR PILOTO ›'` ou `'SORTEAR PILOTO ›'`.

#### Falha 14: Validação de Pilotos Aptos Antes de Habilitar Sorteio
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas**: 461–468
- **Código Observado**:
  ```tsx
  <Botao
    grande
    alto={68}
    texto={...}
    onPress={comecar}
    desativado={!pode || !livres.length || !p.sessao.recepcaoDisponivel}
  />
  ```
- **Problema**: O botão não valida `!aptos.length` nem `!faltam.length`. Se a lista de inscritos tiver 0 pilotos aptos (por exemplo, todos com termos pendentes ou pagamento recusado na recepção), o botão de sorteio permanece ativo. Ao clicar, o sistema inicia a animação de largada com lista vazia e aborta silenciosamente.
- **Correção Necessária**: Adicionar `!faltam.length` e `!aptos.length` à lista de condições de `desativado`.

#### Falha 15: ActivityIndicator e Bloqueio Concorrente no Sorteio Individual
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas**: 223–228, 293–313
- **Código Observado**:
  ```tsx
  <Botao
    tipo="neutro"
    alto={48}
    texto="Sortear só este piloto"
    onPress={() => {
      const r = sortear([x], livres);
      const sorteado = r.atribuicoes[0]?.kart;
      if (!sorteado) return;
      void enviar(...);
      setManual(null);
    }}
  />
  ```
- **Problema**: Ao disparar o sorteio individual, `setManual(null)` fecha imediatamente o modal, não exibe `ActivityIndicator` no card do piloto em processamento e o toque nos demais cards de pilotos permanece habilitado (pois a prop `desativado` na linha 226 não checa `enviando`), permitindo cliques concorrentes múltiplos enquanto a operação viaja para o backend.
- **Correção Necessária**: Exibir `ActivityIndicator` no card do piloto sendo atribuído, controlar estado `sorteandoPilotoId` e bloquear ações concorrentes em todos os cards enquanto a requisição estiver pendente.

---

### Detalhamento das Falhas 16 a 22 (Balança e Lastro)

#### Falha 16: Identificação de Piloto na Balança por ID Persistente / Kart
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas**: 535–543, 567–590
- **Código Observado**:
  ```ts
  const lista = p.pilotos.filter((x) => x.kartAtual);
  const [i, setI] = useState(0);
  const x = lista[Math.min(i, Math.max(0, lista.length - 1))];
  ```
- **Problema**: O piloto selecionado na balança é identificado puramente pelo índice numérico `i`. Se o polling ou SSE atualizar a lista de pilotos (`p.pilotos`) e houver reordenação ou inclusão de retardatários, o índice `i` passa a apontar para outro competidor, fazendo com que o operador grave o peso no piloto errado.
- **Correção Necessária**: Controlar o piloto selecionado por `pilotoId` persistente (`x.customerId ?? x.kartAtual`) e derivar o objeto piloto a partir desse ID.

#### Falha 17: Incremento Rápido (+ e -) sem Peso Prévio
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas**: 551, 613, 630
- **Código Observado**:
  ```tsx
  const valido = peso != null && peso >= 20 && peso <= 250;
  ...
  <Toque rotulo="Menos 1 quilo" desativado={!valido} onPress={() => mudar(atual - 1)} style={s.redondo}><Text style={s.sinal}>−</Text></Toque>
  ...
  <Toque rotulo="Mais 1 quilo" desativado={!valido} onPress={() => mudar(atual + 1)} style={s.redondo}><Text style={s.sinal}>+</Text></Toque>
  ```
- **Problema**: Quando o piloto ainda não possui peso digitado (`peso === null`), `valido` é `false`, o que desativa os botões `+` e `−`. O operador é obrigado a digitar o peso manualmente no teclado virtual, inviabilizando o ajuste rápido com base na meta.
- **Correção Necessária**: Manter os botões habilitados quando `peso === null`, inicializando `peso` com o valor da meta da bateria (`meta`) ao primeiro toque.

#### Falha 18: Tratamento de Incremento a Partir de Zero ou Nulo
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas**: 544–548, 550
- **Código Observado**:
  ```ts
  const atual = peso ?? 0;
  const mudar = (v: number) => {
    const n = Math.min(250, Math.max(20, Math.round(v * 2) / 2));
    setPeso(n);
    setTexto(num(n));
  };
  ```
- **Problema**: Se `peso` for nulo ou zero, `atual` é avaliado como `0`. Um incremento de `+1` ou `+2.5` resulta em `1` ou `2.5`, que ao passar por `Math.max(20, ...)` salta para `20 kg` (limite inferior da balança), em vez de iniciar em um valor operacional realista próximo à meta (ex.: 85–90 kg).
- **Correção Necessária**: Ao incrementar a partir de nulo/zero, calcular o valor como `(meta + delta)` ou inicializar em `meta`.

#### Falha 19: Preservação do Foco Durante Atualizações em Segundo Plano
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas**: 539–543, 616–627
- **Código Observado**:
  ```ts
  useEffect(() => {
    setPeso(x?.pesoKg ?? null);
    setTexto(x?.pesoKg != null ? num(x.pesoKg) : '');
  }, [x?.indice, x?.pesoKg]);
  ```
- **Problema**: A cada 10 segundos (polling de `draw-panel`) ou a cada evento SSE, se `x.pesoKg` for atualizado ou referenciado, `setTexto` sobrescreve o valor que o operador está ativamente digitando no `TextInput`.
- **Correção Necessária**: Rastrear o estado de foco (`focado: boolean`) através dos eventos `onFocus` e `onBlur` do `TextInput` e ignorar a sincronização externa de `texto` enquanto o campo estiver com foco.

#### Falha 20: Meta de Peso Dinâmica (Eliminação de Hardcode 90/100)
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linha**: 552
- **Código Observado**:
  ```ts
  const meta = x.lastro?.metaKg ?? (Number(x.kartAtual) >= 100 ? 100 : 90);
  ```
- **Problema**: O código infere a meta assumindo que qualquer kart >= 100 tem meta de 100 kg e os demais 90 kg. Em campeonatos com categorias personalizadas (80 kg, 95 kg, 110 kg conforme exigido no requisito R2), essa suposição gera cálculos incorretos de placas de lastro.
- **Correção Necessária**: Obter a meta a partir da configuração da sessão (`sessao.metaKg` ou `sessao.categoria.metaKg`), recorrendo à meta de `x.lastro?.metaKg` e, como último fallback seguro, as regras da categoria.

#### Falha 21: Banner de Conclusão Após a Pesagem do Último Piloto
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas**: 684–694
- **Código Observado**:
  ```ts
  onPress={() => {
    void enviar('weight-checks', ...).then((ok) => {
      if (ok) setI((n) => Math.min(n + 1, lista.length - 1));
    });
  }}
  ```
- **Problema**: Ao concluir a conferência do último piloto da lista (`n === lista.length - 1`), a interface simplesmente para no último piloto com o botão indicando "Conferido · próximo piloto ›". Nenhum feedback visual de sucesso ou transição para a próxima etapa (Pista / Direção) é exibido.
- **Correção Necessária**: Detectar quando todos os pilotos com kart alocado foram conferidos (`conferidosCount === lista.length`) e exibir um banner comemorativo de encerramento com atalho direto "Ir para Direção de Prova ›".

#### Falha 22: Arredondamento Padronizado a 1 Casa Decimal
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas**: 39, 545, 556
- **Código Observado**:
  ```ts
  const num = (n: number) => String(n).replace('.', ',');
  ```
- **Problema**: Em operações de ponto flutuante no JavaScript (ex.: `un * 2.5` ou `atual - meta`), valores como `7.500000000000001` são formatados por `String(n)` como `"7,500000000000001"`, poluindo os selos e placas da tela.
- **Correção Necessária**: Padronizar `num` para aplicar `Number(n.toFixed(1))` antes da conversão para string com vírgula: `(Math.round(n * 10) / 10).toString().replace('.', ',')`.

---

### Detalhamento das Falhas 23 a 30 (Galpão, Troca de Kart e Frota)

#### Falha 23: Atualização de Status da Frota para `fora: true` ao Trocar por Quebra
- **Arquivo**: `src/app/bateria/[id].tsx` e backend `operacao.ts`
- **Linhas em `bateria/[id].tsx`**: 878–888
- **Linhas em `operacao.ts` (backend)**: 348–362
- **Código Observado (`bateria/[id].tsx`)**:
  ```ts
  void enviar(
    'kart-swaps',
    { fromKart: sel.kartAtual, toKart: novo, customerId: sel.customerId, nome: sel.nome, manterVoltas: manter },
    motivo,
    `${sel.nome} agora no kart ${novo}.`,
  );
  ```
- **Problema**: O endpoint `kart-swaps` altera o piloto para o novo kart na sessão da cronometragem, mas não altera o status do `fromKart` na tabela de frota para fora de operação (`fora: true`). Se o motivo da troca foi quebra, o kart avariado continua aparecendo como livre e apto a ser sorteado em outras sessões.
- **Correção Necessária**: Se o motivo for classificado como quebra, enviar também a retenção do kart na frota ou garantir que o endpoint/payload execute o registro de `{ fora: true, reason: motivo }` para o kart danificado.

#### Falha 24: Detalhamento de Motivos de Quebra e Campo Livre
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas**: 861–865
- **Código Observado**:
  ```tsx
  <View style={s.grade}>
    {['Kart quebrou', 'Kart ruim', 'Pedido do piloto'].map((m) => (
      <Pilula key={m} texto={m} ativo={motivo === m} onPress={() => setMotivo(m)} />
    ))}
  </View>
  ```
- **Problema**: Na tela de troca de kart durante a prova, existem apenas 3 botões estáticos ("Kart quebrou", "Kart ruim", "Pedido do piloto"), sem possibilidade de especificar o defeito mecânico (embreagem, freio, acelerador, etc.) e sem campo de texto livre.
- **Correção Necessária**: Expandir a lista de motivos mecânicos (alinhado a R3) e adicionar um `Campo` de texto livre para detalhamento pelo operador do box.

#### Falha 25: Karts com Identificadores Alfanuméricos / Sufixos no Filtro de Frota
- **Arquivo**: `src/app/frota.tsx`
- **Linhas**: 68–77
- **Código Observado**:
  ```ts
  for (const s of tempoReal.sessoes) for (const c of s.competitors) if (c.kart && /^\d+$/.test(c.kart)) conj.add(c.kart);
  return [...conj].sort((a, b) => Number(a) - Number(b));
  ...
  const kartsVisiveis = useMemo(() => todosKarts.filter((k) => {
    const n = Number(k);
    if (filtroFrota === 'LIGHT') return n < 100;
    if (filtroFrota === 'SUPER') return n >= 100;
    return true;
  }), [filtroFrota, todosKarts]);
  ```
- **Problema**:
  1. Linha 68 rejeita karts alfanuméricos com a regex `/^\d+$/`.
  2. A ordenação `Number(a) - Number(b)` gera `NaN` para karts com sufixos (ex.: `12A`, `K05`).
  3. No filtro `LIGHT`/`SUPER`, `Number(k)` retorna `NaN`, fazendo com que `NaN < 100` e `NaN >= 100` sejam falsos, ocultando completamente karts alfanuméricos de todas as visões filtradas.
- **Correção Necessária**: Aceitar strings alfanuméricas, extrair o prefixo numérico (`parseInt(k, 10)`) para classificação e utilizar `localeCompare` com `{ numeric: true }` para ordenação natural de karts.

#### Falha 26: Confirmação de Troca Não Bloqueante (Toast/Banner)
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas**: 732–743
- **Código Observado**:
  ```tsx
  if (feito) {
    return (
      <View style={s.vazio}>
        <Confirmado />
        <Text style={[s.titulo, { fontSize: 32 }]}>NO KART {feito}</Text>
        <Suave>A cronometragem já mostra a troca.</Suave>
        <View style={{ width: 240, marginTop: 12 }}>
          <Botao tipo="neutro" texto="Concluir" onPress={() => setFeito(null)} />
        </View>
      </View>
    );
  }
  ```
- **Problema**: Ao confirmar uma troca de kart, a tela renderiza um estado de tela cheia que esconde toda a lista de pilotos e posições em pista até o operador clicar em "Concluir". Em plena corrida, isso cega o operador para os demais pilotos no box.
- **Correção Necessária**: Substituir a tela bloqueante por um banner flutuante (`Pop`) de confirmação no topo da lista de pilotos.

#### Falha 27: Normalização de Numeração de Karts (Zeros à Esquerda)
- **Arquivo**: `src/app/frota.tsx`, `src/app/bateria/[id].tsx` e `src/features/operacao/sorteio.ts`
- **Linhas**: `frota.tsx`: 65–70; `bateria/[id].tsx`: 830–840; `sorteio.ts`: 22
- **Problema**: Numerais como `'04'` e `'4'` são tratados como karts distintos. Na frota, aparecem baias duplicadas; no sorteio, exceções cadastradas com `'4'` não conferem com karts nomeados `'04'`.
- **Correção Necessária**: Criar função de normalização de kart `normalizarKart = (k: string) => k.trim().replace(/^0+(?=\d)/, '')` aplicada em todas as entradas e comparações de identificadores de karts.

#### Falha 28: Idempotência nas Ações de Oficina com `enviarOperacao`
- **Arquivo**: `src/app/frota.tsx`
- **Linhas**: 82–87
- **Código Observado**:
  ```ts
  const marcar = async (kartAlvo: string, corpo: object) => {
    if (!kartAlvo.trim()) return;
    setErro('');
    const r = await cliente.postar(`/fleet/${kartAlvo.trim()}`, corpo).catch((e) => { setErro((e as Error).message); return null; });
    if (r) { setSel(''); setMotivo(''); carregar(); }
  };
  ```
- **Problema**: `marcar` utiliza `cliente.postar` em vez de `cliente.enviarOperacao`. Não gera `operationId`, não possui tratamento de falhas transientes e perde a proteção contra reenvios duplicados garantida pela tabela de operações idempotentes do backend.
- **Correção Necessária**: Migrar a rota de frota para `cliente.enviarOperacao` gerando `operationId: novoId()`.

#### Falha 29: Padronização do Payload de Remoção e Retorno de Karts na Frota
- **Arquivo**: `src/app/frota.tsx`
- **Linhas**: 204, 210, 232
- **Código Observado**:
  ```tsx
  marcar(sel, { fora: false })
  ...
  marcar(sel, { reason: motivo })
  ...
  marcar(f.kart, { fora: false })
  ```
- **Problema**: Ao retirar o kart de operação (linha 210), o payload enviado é `{ reason: motivo }`, omitindo a flag `{ fora: true }`. O retorno envia `{ fora: false }`. O formato é assimétrico e não padronizado.
- **Correção Necessária**: Padronizar os payloads: `{ fora: true, reason: motivo }` para remoção e `{ fora: false }` para retorno.

#### Falha 30: Resumo de Alertas da Tela Inicial Abrangendo Todas as Baterias
- **Arquivo**: `src/app/index.tsx`
- **Linhas**: 197–206, 262–305
- **Código Observado**:
  ```ts
  const proximaPrincipal = proximas[0] ?? null;
  const idAlvoResumo = proximaPrincipal?.atual.id ?? vivas[0]?.atual.id ?? null;
  ...
  if (resumoProx && idAlvoResumo) {
    const aptos = resumoProx.pilotos.filter(podeSortear);
    ...
  }
  ```
- **Problema**: A tela inicial consulta `draw-panel` apenas para a PRIMEIRA próxima bateria (`proximas[0]`). Se houver três baterias em preparação na fila, pendências de sorteio, termos da recepção e lastros não conferidos das baterias 2 e 3 não aparecem na seção "PRECISA DE VOCÊ".
- **Correção Necessária**: Expandir o carregamento de alertas para iterar sobre todas as baterias ativas e em preparação (`[...vivas, ...proximas]`).

---

### Detalhamento das Falhas 31 a 38 (Direção de Prova e Passagens)

#### Falha 31: Identificadores de Bandeiras em Inglês (`flag: b.api`)
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas**: 899–904, 1143–1158, 1220
- **Código Observado**:
  ```ts
  const BANDEIRAS = [
    { f: 'verde', n: 'VERDE', sub: 'PISTA LIVRE', c: cores.verde, api: 'green' },
    { f: 'amarela', n: 'AMARELA', sub: 'ATENÇÃO', c: cores.amarela, api: 'yellow' },
    { f: 'vermelha', n: 'VERMELHA', sub: 'INTERROMPER', c: cores.erro, api: 'red' },
    { f: 'quadriculada', n: 'FINAL', sub: 'ENCERRAR', c: cores.texto, api: 'checkered' },
  ];
  ...
  void enviar('flags', { flag: b.f }, m, `Bandeira ${b.n}.`);
  ```
- **Problema**: O comando envia `b.f` (`'verde'`, `'amarela'`, `'vermelha'`, `'quadriculada'`). A API de cronometragem do servidor e os protocolos de painel aceitam apenas as chaves em inglês (`b.api`: `'green'`, `'yellow'`, `'red'`, `'checkered'`). Além disso, na relargada (linha 1220), envia `{ flag: 'verde' }` em vez de `'green'`.
- **Correção Necessária**: Enviar sempre `flag: b.api` nas requisições de bandeira.

#### Falha 32: Diálogo de Confirmação para Advertências
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas**: 1042–1050
- **Código Observado**:
  ```tsx
  <Botao
    tipo="neutro"
    alto={52}
    texto="Advertência"
    desativado={!pode || enviando}
    onPress={() => void enviar('penalties', { kart, tipo: 'advertencia', motivo: m }, m, 'Advertência aplicada.')}
  />
  ```
- **Problema**: Diferente das punições de tempo (+5s, +10s, +30s) que chamam `confirmar(...)`, o botão "Advertência" dispara a chamada imediatamente ao menor toque acidental na tela, gravando uma penalidade oficial no histórico do piloto sem confirmação prévia.
- **Correção Necessária**: Envolver o disparo da advertência no diálogo `confirmar('Aplicar advertência', `Advertir kart ${kart} (${atual.name}) por "${m}"?`, () => ...)`.

#### Falha 33: Aplicação de Penalidades com Segundos Customizados
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas**: 1051–1066
- **Código Observado**:
  ```tsx
  {[5, 10, 30].map((n) => (
    <View key={n} style={{ flex: 0.58 }}>
      <Toque ...><Text style={s.tempoTexto}>+{n}s</Text></Toque>
    </View>
  ))}
  ```
- **Problema**: Estão disponíveis unicamente três botões estáticos (+5s, +10s, +30s). Penalidades regulamentares de 3s, 15s ou 20s não podem ser aplicadas pelo comissário através da tela.
- **Correção Necessária**: Adicionar um campo/seletor para entrada de segundos customizados com confirmação.

#### Falha 34: Justificativa Opcional para Largadas Normais de Prova
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas**: 968, 1173–1181
- **Código Observado**:
  ```ts
  const semMotivo = !motivoProva.trim();
  ...
  {estado === 'preparando' ? <Botao grande alto={64} texto="LARGAR PROVA ›" desativado={!pode || enviando || semMotivo} onPress={() => comando('start', 'Largar')} /> : null}
  ```
- **Problema**: Para largar uma bateria normalmente agendada no horário regular, o botão "LARGAR PROVA ›" fica bloqueado exigindo preenchimento de texto no campo `motivoProva`. No fluxo operacional de pista, largadas normais ocorrem a cada 20 minutos e a exigência de digitação atrasa a operação.
- **Correção Necessária**: Desvincular `semMotivo` da ação `'start'`, exigindo justificativa apenas para relargada, reinício, encerramento antecipado ou cancelamento.

#### Falha 35: Proteção com Fallback Contra Arrays Nulos na Lista de Penalidades
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas**: 983–986, 1083–1094
- **Código Observado**:
  ```tsx
  {atual.penalidades.map((x) => (
  ```
- **Problema**: Se o backend responder com competidor sem a propriedade `penalidades` inicializada (ou `penalidades: null`), o acesso direto `.map` resulta em `TypeError: Cannot read properties of undefined (reading 'map')`, crashando todo o componente `Direcao`.
- **Correção Necessária**: Utilizar `(atual.penalidades ?? []).map((x) => ...)`.

#### Falha 36: Sincronização Periódica ou em Tempo Real em Passagens
- **Arquivo**: `src/app/passagens/[id].tsx`
- **Linhas**: 61–75
- **Código Observado**:
  ```ts
  const ler = useCallback(() => { ... }, [cliente, id, kart, selInicial]);
  useEffect(ler, [ler]);
  ```
- **Problema**: A tela de passagens carrega os dados apenas uma vez ao montar. Durante a prova, à medida que o kart cruza as antenas, nenhuma volta nova aparece na lista sem que o usuário saia e reabra a tela.
- **Correção Necessária**: Adicionar sincronização periódica (`setInterval(ler, 3000)`) e disparar recarregamento quando o estado SSE indicar novas passagens ou mudança de revisão.

#### Falha 37: Validação Explícita de Tempo no Formato `MM:SS.mmm`
- **Arquivo**: `src/app/passagens/[id].tsx`
- **Linhas**: 26–37, 326–331
- **Código Observado**:
  ```ts
  function segundosParaMs(txt: string): number | null {
    const limpo = txt.trim().replace(',', '.');
    if (!limpo) return null;
    if (limpo.includes(':')) {
      const [m, s] = limpo.split(':');
      const ms = (Number(m) * 60 + Number(s)) * 1000;
      return Number.isFinite(ms) && ms > 0 ? Math.round(ms) : null;
    }
    const n = Number(limpo);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n > 500 ? Math.round(n) : Math.round(n * 1000);
  }
  ```
- **Problema**: A conversão aceita formatos ambíguos, não valida se segundos ultrapassam 59 (ex.: `1:95`), aceita caracteres inválidos e não força a máscara canônica `MM:SS.mmm`.
- **Correção Necessária**: Implementar validação formal via regex rigorosa `^(?:([0-5]?\d):)?([0-5]?\d)(?:[.,](\d{1,3}))?$` com retorno visual de erro quando a digitação for inválida.

#### Falha 38: Validação da Existência do Kart Destino Antes da Transferência
- **Arquivo**: `src/app/passagens/[id].tsx`
- **Linhas**: 176–198
- **Código Observado**:
  ```tsx
  <Botao
    texto={`Atribuir ao kart ${kartDestino || '?'}`}
    alto={52}
    desativado={!pode || !motivo.trim() || !kartDestino.trim()}
    onPress={() => void corrigir('assign', { kart: kartDestino.trim() })}
  />
  ```
- **Problema**: A interface permite transferir a passagem para qualquer número digitado pelo operador, sem checar se aquele kart está participando da bateria. Se o operador errar um dígito (ex.: digitar 99 em vez de 19), a volta é atribuída a um kart inexistente no grid.
- **Correção Necessária**: Consultar a lista de competidores da sessão e validar se `kartDestino` existe na bateria antes de habilitar a transferência.

---

## 2. Cadeia Lógica

1. **Agrupamento e Listagem de Baterias (Falha 08)**:
   - *Premissa*: O sistema agrupa sessões de tomada de tempo e corrida na mesma bateria para apresentar um fluxo operacional unificado.
   - *Fato*: A cronometragem gera IDs de sessão ou `groupId` com sufixos descritivos das fases (`-tomada`, `-corrida`, `-treino`).
   - *Dedução*: A chave calculada no `agruparBaterias` divide as etapas em itens separados na UI se o sufixo não for removido. Normalizar a chave eliminando esses sufixos garante o agrupamento correto.

2. **Integridade do Modo "Um a um" e Concorrência (Falhas 09, 11, 12, 13, 14, 15)**:
   - *Premissa*: O sorteio "Um a um" é um momento cerimonial onde cada piloto é chamado individualmente no paddock.
   - *Fato*: `sortear()` reorganiza o array colocando pilotos com mais restrições no topo, desvirtuando a ordem de chamada. Em caso de 409 (outra estação mexeu na lista), o app descarta a prévia local. Para 1 piloto, os textos tratam como plural. E sem pilotos elegíveis, a ação iniciava animação vazia.
   - *Dedução*: É imperativo preservar a ordem de entrada, manter a prévia viva após 409 atualizando apenas o número de revisão para reenvio ágil, ajustar rótulos singulares, travar sorteio sem pilotos aptos e bloquear concorrência com spinners individuais.

3. **Operação de Pesagem e Lastro de Alta Confiabilidade (Falhas 16, 17, 18, 19, 20, 21, 22)**:
   - *Premissa*: A balança do box atende pilotos em fila rápida com luvas e equipamentos, sofrendo constantes atualizações em segundo plano.
   - *Fato*: Indexar por posição no array causa perda de seleção durante updates; polling sobrescreve campos com foco; metas de 90/100 kg são insuficientes para campeonatos com 80/95/110 kg; o último piloto não recebia confirmação e casas decimais flutuavam.
   - *Dedução*: Usar ID imutável do competidor, blindar o campo focado de sobrescrita, ler metas dinâmicas da categoria, habilitar `+/-` a partir da meta e exibir banner conclusivo resolvem a estabilidade da balança.

4. **Operação de Box, Quebras e Frota (Falhas 23, 24, 25, 26, 27, 28, 29, 30)**:
   - *Premissa*: Um kart que quebra na pista deve ser retirado imediatamente da frota de disponíveis e substituído sem paralisar a visão de corrida do operador.
   - *Fato*: A troca de kart não enviava `{ fora: true }` à frota; a confirmação tomava a tela inteira em modal cego; karts alfanuméricos sumiam dos filtros; números com zero à esquerda duplicavam; as chamadas de frota não tinham `operationId`; e a home só alertava sobre a primeira bateria.
   - *Dedução*: Integrar o envio de status de quebra à frota, adotar toasts não-bloqueantes, normalizar strings de karts, usar `enviarOperacao` idempotente e monitorar todas as baterias em preparo na home fecha o ciclo de segurança do galpão.

5. **Direção de Prova e Auditoria de Voltas (Falhas 31, 32, 33, 34, 35, 36, 37, 38)**:
   - *Premissa*: O comissário de prova toma decisões críticas sob pressão de tempo (bandeiras, punições, largada).
   - *Fato*: Bandeiras em português não são processadas pela cronometragem; advertências podiam ser disparadas sem confirmação; largadas exigiam digitação de justificativa; listas de punição quebravam em `null`; passagens não atualizavam em tempo real; formatos manuais permitiam tempos espúrios; e passagens podiam ser passadas para karts que nem corriam.
   - *Dedução*: Adoção de enums em inglês (`green`, `yellow`, `red`, `checkered`), diálogos de confirmação para advertências, penalidades de tempo customizadas, flexibilização de largada normal, validação por regex `MM:SS.mmm` e checagem de existência do kart destino protegem a integridade da prova.

---

## 3. Ressalvas (Caveats)

1. **Modo Read-Only no Repositório**: A presente investigação foi estritamente não destrutiva e em modo somente-leitura. Nenhuma linha de código foi alterada em `/Users/pedroguilherme/PROJETOS/kartodromo-operacional` nem em `/Users/pedroguilherme/PROJETOS/KARTODROMO`.
2. **Ambiente de Testes da Cronometragem**: Os testes reais de integração com cronometragem devem sempre utilizar a porta de simulação `:4150` em conformidade com as regras de ouro do kartódromo (`AGENTS.md`), preservando o servidor de produção `:4050`.
3. **Novos Fluxos R2 a R6**: As correções das Falhas 08 a 38 preparam as fundações de dados para os novos fluxos de Campeonatos (R2), Ordens de Serviço e Gerência de Trocas (R3), Validação de Trocas pela Cronometragem (R4), Pesagem Pós-Corrida com DSQ (R5) e Trilha de Auditoria (R6). Tais fluxos expandirão os componentes analisados sem conflitar com suas estruturas.

---

## 4. Conclusão

A arquitetura do `kartodromo-operacional` possui base sólida em Expo e design system bem estruturado, porém apresentava lacunas críticas nos fluxos de exceção, concorrência e integridade operacional.
As 31 falhas mapeadas (Falhas 08 a 38) estão completamente diagnosticadas com linha, causa-raiz e solução técnica especificada. A resolução dessas falhas é direta, não requer refatoração arquitetural ampla e restaura a robustez necessária para a operação no pitlane e comissariado.

---

## 5. Método de Verificação Independente

Para verificar independentemente os pontos apontados:

1. **Executar a Suíte de Testes do App Operacional**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional
   npm test
   ```
   *Resultado esperado*: 4 suites passam (29 testes unitários existentes).

2. **Verificar a Tipagem TypeScript**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional
   npm run tipos
   ```
   *Resultado esperado*: Compilação com zero erros.

3. **Arquivos e Linhas Críticas a Inspecionar**:
   - `src/features/operacao/baterias.ts` (linhas 13–24): normalização de sufixos na chave de agrupamento.
   - `src/features/operacao/sorteio.ts` (linhas 19–26): ordenação dos pilotos no retorno de `sortear`.
   - `src/app/bateria/[id].tsx`:
     - Linhas 443–468: bloqueio incondicional por recepção.
     - Linhas 171–188: descarte da prévia em erro de envio.
     - Linhas 404–405: desativação do botão "Recusar / outro".
     - Linhas 535–543: índice numérico em vez de ID persistente no lastro.
     - Linhas 613–630: desativação do incremento rápido quando `peso === null`.
     - Linhas 732–743: tela cheia bloqueante após troca de kart.
     - Linhas 1150–1158: envio de `b.f` (português) em vez de `b.api` (inglês) nas bandeiras.
     - Linhas 1042–1050: ausência de confirmação na advertência.
     - Linhas 1181: campo de justificativa obrigatório para largar prova.
   - `src/app/frota.tsx` (linhas 68–77): regex `^\d+$` que elimina karts alfanuméricos.
   - `src/app/passagens/[id].tsx` (linhas 26–37, 61–75): ausência de validação estrita `MM:SS.mmm` e falta de polling.
