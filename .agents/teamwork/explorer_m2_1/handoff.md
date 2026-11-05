# Relatório Técnico de Investigação — Milestone M2 (Falhas 08 a 15)
**Baterias e Sorteio de Karts no Kartódromo Operacional**

- **Autor**: Explorer M2_1 (M2 Baterias e Sorteio Explorer)
- **Data**: 2026-11-02T21:35:00Z
- **Escopo**: Falhas 08 a 15 do Milestone M2 (Features F14 a F21)
- **Destinatário**: Orquestrador Operacional (`88cadb65-7d49-4f0d-a278-9c17ee4251ab`)
- **Repositório Investigado**: `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`

---

## 1. Observation (Observações Diretas do Código Fonte)

### 1.1 Falha 08: Chave de agrupamento duplicando baterias devido a sufixos de etapa
- **Arquivo**: `src/features/operacao/baterias.ts`
- **Linhas Observadas**: 10–24
- **Código Atual**:
  ```typescript
  /** Nome sem a etapa: "BATERIA 18:00 · TOMADA DE TEMPO" vira "BATERIA 18:00". */
  export const nomeDaBateria = (nome = '') => nome.replace(/\s+[·-]\s+(?:tomada(?:\s+de\s+tempo)?|classifica[cç][aã]o|corrida(?:\s+\d+)?|treino(?:\s+\d+)?)$/i, '').trim();

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
- **Constatação Direta**:
  1. A expressão regular em `nomeDaBateria` exige `\s+[·-]\s+` (espaço obrigatório antes e depois do hífen/ponto) e termina estritamente no final (`$`).
  2. Baterias com nomes como `"BATERIA 18:00 - TOMADA"` ou `"BATERIA 18:00 - CORRIDA 1"` ou `"BATERIA 18:00-TOMADA"` ou variações onde o sufixo contém etapas adicionais (`-(?:tomada|corrida|treino).*`) não são limpos se não houver espaço estrito ou se houver caracteres subsequentes.
  3. Quando `s.groupId` possui sufixos como `b516-tomada` e `b516-corrida`, a linha 21 gera chaves diferentes (`${s.id.slice(0, 10)}-grp-${s.groupId}`), duplicando a bateria na tela.
  4. O contrato testado em `tests/harness.ts` e `tests/tier1-features.test.ts` (linhas 286–293) exige explicitamente a função `normalizarChaveBateria(id, nomeOuGroup)` que remove `-(?:tomada|corrida|treino).*`, a qual não existia exportada em `baterias.ts`.

---

### 1.2 Falha 09: Sorteio "Um a um" reordenando a lista original de pilotos
- **Arquivo**: `src/features/operacao/sorteio.ts`
- **Linhas Observadas**: 11–27
- **Código Atual**:
  ```typescript
  export function sortear(pilotos: PilotoPainel[], livres: string[], aleatorio: () => number = Math.random): { atribuicoes: Atribuicao[]; semKart: string[] } {
    const baralho = [...livres];
    for (let i = baralho.length - 1; i > 0; i--) {
      const j = Math.floor(aleatorio() * (i + 1));
      [baralho[i], baralho[j]] = [baralho[j], baralho[i]];
    }
    const atribuicoes: Atribuicao[] = [];
    const semKart: string[] = [];
    // quem tem mais restrições escolhe primeiro
    for (const p of [...pilotos].sort((a, b) => b.excecoes.length - a.excecoes.length)) {
      if (!baralho.length) { semKart.push(p.nome); continue; }
      const pos = baralho.findIndex((k) => !p.excecoes.includes(k));
      const [kart] = baralho.splice(pos >= 0 ? pos : 0, 1);
      atribuicoes.push({ customerId: p.customerId, nome: p.nome, kart });
    }
    return { atribuicoes, semKart };
  }
  ```
- **Constatação Direta**:
  1. A linha 20 itera sobre `[...pilotos].sort((a, b) => b.excecoes.length - a.excecoes.length)` para priorizar a escolha de pilotos com restrições (`excecoes`).
  2. Na linha 24, `atribuicoes.push(...)` insere o piloto sorteado diretamente nessa ordem de prioridade de exceções.
  3. No modo "Um a um" em `src/app/bateria/[id].tsx` (linhas 96–100, 130–135), os pilotos são chamados no paddock na ordem de `previa = r.atribuicoes`. Como resultado, os pilotos são chamados na ordem de quantas restrições tinham no cadastro, destruindo a ordem cronológica de inscrição/grid e gerando desorganização no paddock.

---

### 1.3 Falha 10: Sorteio bloqueado em baterias avulsas quando recepção offline
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas Observadas**: 443–449 e 461–468
- **Código Atual**:
  ```tsx
  443:       {!p.sessao.recepcaoDisponivel ? (
  444:         <Cartao tom="erro">
  445:           <Forte cor={cores.erroClaro}>Recepção indisponível</Forte>
  446:           <Suave>Sorteio bloqueado até voltar.</Suave>
  447:         </Cartao>
  448:       ) : null}
  449:       {!p.sessao.vinculadaRecepcao ? <Suave cor={cores.alerta}>Sem vínculo com a recepção: vale a lista da cronometragem.</Suave> : null}
  ...
  461:           <Botao
  462:             grande
  463:             alto={68}
  464:             texto={inicial ? (modoSorteio === 'UM_A_UM' ? 'CHAMAR 1 A 1 ›' : 'SORTEAR AGORA ›') : `SORTEAR SÓ ${faltam.length} ›`}
  465:             onPress={comecar}
  466:             desativado={!pode || !livres.length || !p.sessao.recepcaoDisponivel}
  467:           />
  ```
- **Constatação Direta**:
  1. Na linha 466, o botão é desabilitado incondicionalmente por `!p.sessao.recepcaoDisponivel`.
  2. Na linha 443, o aviso de erro é exibido sempre que `!p.sessao.recepcaoDisponivel`.
  3. No entanto, quando `p.sessao.vinculadaRecepcao === false` (baterias avulsas cadastradas diretamente na cronometragem ou operando em contingência local), a recepção do totem não é necessária ("vale a lista da cronometragem"). O bloqueio deveria ocorrer SOMENTE se a bateria for vinculada à recepção (`p.sessao.vinculadaRecepcao && !p.sessao.recepcaoDisponivel`).

---

### 1.4 Falha 11: Erro 409 descartando prévia sorteada em vez de preservar e atualizar revisão
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas Observadas**: 117–123 e 171–188
- **Código Atual**:
  ```typescript
  117:   const revisaoSorteio = useRef(0);
  118:   const comecar = () => {
  119:     revisaoSorteio.current = p.sessao.sessionRevision;
  120:     setRevelados(0);
  121:     setIndiceUmAUm(0);
  122:     setFase('luzes');
  123:   };
  ...
  171:   const gravar = async () => {
  172:     setFase('gravando');
  173:     const modoApi = modoSorteio === 'UM_A_UM' ? 'um_a_um' : 'todos';
  174:     const ok = await enviar(
  175:       inicial ? 'draw' : 'late-assignments',
  176:       { atribuicoes: previa, modo: modoApi },
  177:       inicial ? 'Sorteio' : 'Atrasados',
  178:       inicial ? 'Sorteio gravado na cronometragem.' : 'Atrasados gravados: os outros não mudaram.',
  179:       revisaoSorteio.current,
  180:     );
  181:     if (ok) {
  182:       setFase('gravado');
  183:       setXadrez(true);
  184:     } else {
  185:       setPrevia([]);
  186:       setFase('inicio');
  187:     }
  188:   };
  ```
- **Constatação Direta**:
  1. Nas linhas 184–187, se `enviar(...)` falhar (por exemplo, erro HTTP 409 Conflict decorrente de `sessionRevision` concorrente), o bloco `else` executa `setPrevia([])` e `setFase('inicio')`.
  2. Todo o sorteio realizado (inclusive todas as trocas e confirmações manuais do modo "Um a um") é descartado da memória. O fiscal de pista precisa sortear todos os pilotos novamente do zero.
  3. Além disso, `revisaoSorteio.current` só era alimentado na chamada de `comecar()` (linha 119) e nunca sincronizado com a nova revisão atualizada trazida pelo polling/SSE em `p.sessao.sessionRevision`.

---

### 1.5 Falha 12: Condição de habilitar/desabilitar botão de recusar kart
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas Observadas**: 151–160 e 403–407
- **Código Atual**:
  ```typescript
  151:   const recusarKartUmAUm = () => {
  152:     const atualAtrib = previa[indiceUmAUm];
  153:     if (!atualAtrib) return;
  154:     const usadosNaPrevia = new Set(previa.map((x, idx) => (idx === indiceUmAUm ? '' : x.kart)).filter(Boolean));
  155:     const candidatos = livres.filter((k) => k !== atualAtrib.kart && !usadosNaPrevia.has(k));
  156:     if (!candidatos.length) return;
  157:     const novoKart = candidatos[Math.floor(Math.random() * candidatos.length)];
  158:     setPrevia((ant) => ant.map((item, idx) => (idx === indiceUmAUm ? { ...item, kart: novoKart } : item)));
  159:   };
  ...
  403:               <View style={[s.linha, { width: '100%', marginTop: 4 }]}>
  404:                 <View style={{ flex: 1 }}>
  405:                   <Botao tipo="neutro" alto={52} texto="Recusar / outro" onPress={recusarKartUmAUm} desativado={livres.length <= previa.length} />
  406:                 </View>
  ```
- **Constatação Direta**:
  1. Na linha 405, a condição `desativado={livres.length <= previa.length}` trava o botão caso a quantidade total de karts livres seja igual ou menor que a quantidade total de pilotos a sortear (por exemplo, 10 karts para 10 pilotos).
  2. No início do "Um a um", o Piloto 1 não consegue trocar de kart mesmo havendo outros 9 karts livres ainda não chamados nem aceitos por ninguém.
  3. Na linha 154–155, `usadosNaPrevia` considera karts atribuídos preliminarmente a pilotos futuros (`idx > indiceUmAUm`), impedindo o swap entre karts ainda não aceitos.
  4. O contrato formal em `tests/harness.ts` define que o botão só deve ser desativado quando NÃO houver karts candidatos livres que não tenham sido já aceitos pelos pilotos anteriores (`kartsJaAceitos`), que não estejam nas exceções do piloto atual e que não sejam o kart atualmente sorteado para ele.

---

### 1.6 Falha 13: Rótulo de botão singular para 1 piloto no "Um a um"
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas Observadas**: 461–467
- **Código Atual**:
  ```tsx
  461:           <Botao
  462:             grande
  463:             alto={68}
  464:             texto={inicial ? (modoSorteio === 'UM_A_UM' ? 'CHAMAR 1 A 1 ›' : 'SORTEAR AGORA ›') : `SORTEAR SÓ ${faltam.length} ›`}
  465:             onPress={comecar}
  466:             desativado={!pode || !livres.length || !p.sessao.recepcaoDisponivel}
  467:           />
  ```
- **Constatação Direta**:
  1. Na linha 464, quando resta apenas 1 piloto (`faltam.length === 1`), se o modo selecionado for `UM_A_UM`, o texto do botão continua sendo `'CHAMAR 1 A 1 ›'`.
  2. Em um grid com apenas 1 competidor restante (ou bateria de 1 piloto), a expressão plural/iterativa "CHAMAR 1 A 1" não faz sentido gramatical nem operacional.
  3. O contrato testado em `tests/harness.ts` (`obterRotuloBotaoUmAUm`) e `tests/tier1-features.test.ts` (linhas 343–349) exige expressamente `'CONFIRMAR PILOTO ›'` quando `faltamCount <= 1 && modo === 'UM_A_UM'`.

---

### 1.7 Falha 14: Validação de pilotos aptos antes do sorteio
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas Observadas**: 107–110, 457 e 466
- **Código Atual**:
  ```typescript
  107:   const aptos = p.pilotos.filter(podeSortear);
  108:   const bloqueados = p.pilotos.filter((x) => !podeSortear(x));
  109:   const faltam = aptos.filter((x) => !x.kartAtual);
  110:   const inicial = !aptos.some((x) => x.kartAtual);
  ...
  457:       {preparando && fase === 'inicio' && faltam.length ? (
  ...
  466:             desativado={!pode || !livres.length || !p.sessao.recepcaoDisponivel}
  ```
- **Constatação Direta**:
  1. A condição `desativado` na linha 466 não valida se `aptos.length > 0` ou `faltam.length > 0`.
  2. Se a lista de inscritos da bateria estiver vazia ou se todos os pilotos estiverem inelegíveis (`bloqueados`), o botão pode permanecer em estado incoerente ou disparar sorteios vazios se a renderização for disparada.
  3. Na linha 364, a interface exibe "0 pilotos prontos para sortear", sem apresentar um aviso claro de que inexistem pilotos aptos na sessão.

---

### 1.8 Falha 15: ActivityIndicator e lock concorrente no sorteio individual
- **Arquivo**: `src/app/bateria/[id].tsx`
- **Linhas Observadas**: 220–256 (card do piloto) e 292–313 (modal de atribuição manual)
- **Código Atual**:
  ```tsx
  293:                   {livres.length > 0 ? (
  294:                     <View style={{ flex: 1 }}>
  295:                       <Botao
  296:                         tipo="neutro"
  297:                         alto={48}
  298:                         texto="Sortear só este piloto"
  299:                         onPress={() => {
  300:                           const r = sortear([x], livres);
  301:                           const sorteado = r.atribuicoes[0]?.kart;
  302:                           if (!sorteado) return;
  303:                           void enviar(
  304:                             x.kartAtual || inicial ? 'draw' : 'late-assignments',
  305:                             { atribuicoes: [{ customerId: x.customerId, nome: x.nome, kart: sorteado }], modo: 'um_a_um' },
  306:                             'Sorteio individual',
  307:                             `${x.nome} sorteado no kart ${sorteado}.`,
  308:                           );
  309:                           setManual(null);
  310:                         }}
  311:                       />
  312:                     </View>
  313:                   ) : null}
  ```
- **Constatação Direta**:
  1. Na linha 303, `void enviar(...)` é disparado de forma desvinculada e assíncrona, e `setManual(null)` fecha imediatamente o modal na linha 309.
  2. Não existe nenhum estado de trava (`sorteandoPilotoId`) que impeça duplo clique rápido no botão antes do fechamento do modal ou cliques simultâneos em múltiplos pilotos na grade.
  3. No card do piloto na grade (linhas 228–236), não há renderização de `ActivityIndicator` indicando que o piloto está com requisição de sorteio individual em andamento.

---

## 2. Logic Chain (Cadeia de Raciocínio e Diagnóstico Causal)

1. **Da Duplicação de Chaves à Falha 08**:
   - A listagem agrupa sessões em baterias pela chave calculada.
   - Em sessões onde `agendaId` e `programaId` inexistem, o app recorre a `groupId` ou ao nome formatado da etapa.
   - Os nomes de provas de cronometragem vêm com sufixos como `"- TOMADA"`, `"- CORRIDA"`, `"- TREINO"`. Se a chave não remover esses sufixos de maneira unificada e normalizada (minúsculas, sem traços de etapa), tomada e corrida da mesma bateria geram chaves distintas no `Map`, aparecendo como duas baterias duplicadas na home e no seletor de etapas.
   - *Correção necessária*: Exportar `normalizarChaveBateria` e unificar a extração de chave no `agruparBaterias` utilizando a regex `/\s*-\s*(?:tomada|corrida|treino).*$/i`.

2. **Da Ordenação por Restrições à Falha 09**:
   - Para resolver restrições de karts (ex: "piloto A já usou karts 1 e 2 hoje"), o algoritmo ordena pilotos com mais restrições primeiro.
   - No entanto, a lista resultante era empurrada diretamente no array de saída sem restaurar os índices originais.
   - Como consequência, o chamador do paddock visualizava uma ordem embaralhada.
   - *Correção necessária*: Mapear os pilotos com seu índice original `{ p, idx }`, realizar o sorteio priorizado e reordenar o array final por `idx` antes de retornar.

3. **Do Vínculo de Recepção à Falha 10**:
   - Baterias avulsas (treinos livres, eventos fechados, baterias rápidas) não utilizam o fluxo de pagamento e check-in do totem da recepção.
   - Bloquear o botão de sorteio quando `recepcaoDisponivel === false` em baterias que sequer têm vínculo com a recepção impede a operação do kartódromo caso a rede dos totens caia.
   - *Correção necessária*: Condicionar o bloqueio a `p.sessao.vinculadaRecepcao && !p.sessao.recepcaoDisponivel`.

4. **Da Concorrência HTTP 409 à Falha 11**:
   - O backend utiliza `expectedSessionRevision` para evitar escritas concorrentes (OCC).
   - Quando outro operador ou telemetria incrementa a revisão da sessão, a tentativa de gravar o sorteio retorna HTTP 409.
   - O app tratava qualquer retorno falso de `enviar(...)` zerando a prévia (`setPrevia([])`) e voltando à tela inicial.
   - Com isso, o trabalho de sorteio de até 35 karts era jogado fora desnecessariamente.
   - *Correção necessária*: No caso de erro na gravação, NÃO esvaziar `previa`. Atualizar `revisaoSorteio.current = p.sessao.sessionRevision` e manter a tela na fase `'conferir'`, permitindo reenviar imediatamente com 1 clique.

5. **Do Cálculo de Candidatos à Falha 12**:
   - O botão "Recusar / outro" serve para o piloto recusar o kart sorteado e receber outro elegível na hora.
   - A condição `livres.length <= previa.length` desabilitava o botão mesmo quando ainda restavam karts não aceitos por outros pilotos.
   - *Correção necessária*: O botão deve ser desabilitado apenas se `candidatos.length === 0`, onde candidatos são karts livres não aceitos pelos pilotos anteriores (`kartsJaAceitos`), não presentes nas exceções do piloto e diferentes do kart atual. Ao trocar, realiza-se o swap com o kart atribuído provisoriamente a um piloto posterior.

6. **Do Rótulo Gramatical/Operacional à Falha 13**:
   - No modo "Um a um", com 1 piloto restante, "CHAMAR 1 A 1" é uma mensagem errônea para a equipe de pista.
   - *Correção necessária*: Usar a regra `faltam.length <= 1 ? 'CONFIRMAR PILOTO ›' : 'CHAMAR 1 A 1 ›'`.

7. **Da Validação de Aptos à Falha 14**:
   - Impedir o acionamento de sorteio quando `aptos.length === 0` ou `faltam.length === 0`.
   - *Correção necessária*: Inserir a checagem explícita na propriedade `desativado` do botão e exibir aviso informativo caso não haja nenhum piloto apto.

8. **Do Lock e Feedback Visual à Falha 15**:
   - Operações assíncronas em telas touch de galpão sofrem frequentemente com toques duplos acidentais.
   - *Correção necessária*: Criar o estado `pilotoSorteandoId`, travar o botão e toques adicionais enquanto pendente, e exibir `ActivityIndicator` verde no card do piloto em sorteio.

---

## 3. Caveats (Ressalvas e Limitações)

1. **Somente Leitura**: Nenhuma alteração foi realizada nos arquivos em disco nesta etapa.
2. **Compatibilidade com Testes Existentes**: As suítes `tests/baterias.test.ts`, `tests/sorteio.test.ts` e `tests/tier1-features.test.ts` esperam que `sortear(...)` continue com a mesma assinatura, aceitando `aleatorio?: () => number` determinístico nos testes.
3. **Persistência de Revisão**: Quando o servidor responde com erro 409, a sessão é recarregada via `carregar()`. É essencial que o componente sincronize `revisaoSorteio.current` com a revisão recém-chegada.

---

## 4. Conclusion (Proposta de Código e Patches de Correção)

### 4.1 Correção da Falha 08 em `src/features/operacao/baterias.ts`

```typescript
// Subsituição das linhas 10–24 de src/features/operacao/baterias.ts:

/** Normaliza a chave de agrupamento removendo sufixos de etapa como -tomada, -corrida, -treino. */
export function normalizarChaveBateria(id: string, nomeOuGroup: string): string {
  const limpo = nomeOuGroup.replace(/\s*-\s*(?:tomada|corrida|treino).*$/i, '').trim().toLowerCase();
  return `${id.slice(0, 10)}-${limpo}`;
}

/** Nome sem a etapa: "BATERIA 18:00 · TOMADA DE TEMPO" vira "BATERIA 18:00". */
export const nomeDaBateria = (nome = '') =>
  nome.replace(/\s*[·-]\s*(?:tomada(?:\s+de\s+tempo)?|classifica[cç][aã]o|corrida(?:\s+\d+)?|treino(?:\s+\d+)?).*$/i, '').trim();

export function agruparBaterias(sessoes: Sessao[]): Bateria[] {
  const grupos = new Map<string, Sessao[]>();
  for (const s of sessoes) {
    const chave = s.agendaId != null
      ? `agenda-${s.agendaId}`
      : s.programaId
        ? `prog-${s.programaId}`
        : s.groupId
          ? normalizarChaveBateria(s.id, `grp-${s.groupId}`)
          : normalizarChaveBateria(s.id, nomeDaBateria(s.name));
    grupos.set(chave, [...(grupos.get(chave) ?? []), s]);
  }
  return [...grupos].map(([chave, lista]) => {
    const etapas = [...lista].sort((a, b) => ordem(a) - ordem(b));
    const ativas = etapas.filter((s) => s.state !== 'cancelada');
    const atual = ativas.find(vivo) ?? ativas.find((s) => s.state === 'preparando') ?? ativas[ativas.length - 1] ?? etapas[0];
    const situacao = vivo(atual) ? 'viva' : atual.state === 'preparando' ? 'proxima' : 'encerrada';
    return { chave, nome: nomeDaBateria(etapas[0].name), etapas: ativas.length ? ativas : etapas, atual, situacao };
  });
}
```

---

### 4.2 Correção da Falha 09 em `src/features/operacao/sorteio.ts`

```typescript
// Substituição da função sortear em src/features/operacao/sorteio.ts (linhas 11–27):

/** Sorteia os pilotos entre os karts livres, preservando a ordem original de chamada. */
export function sortear(
  pilotos: PilotoPainel[],
  livres: string[],
  aleatorio: () => number = Math.random,
): { atribuicoes: Atribuicao[]; semKart: string[] } {
  const baralho = [...livres];
  for (let i = baralho.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [baralho[i], baralho[j]] = [baralho[j], baralho[i]];
  }

  // Mapeia com índice original para preservar a ordem de entrada
  const comIndice = pilotos.map((p, idx) => ({ p, idx }));
  // Quem tem mais restrições escolhe primeiro no baralho
  comIndice.sort((a, b) => b.p.excecoes.length - a.p.excecoes.length);

  const atribuicoesTemporarias: { idx: number; atribuicao: Atribuicao }[] = [];
  const semKart: string[] = [];

  for (const { p, idx } of comIndice) {
    if (!baralho.length) {
      semKart.push(p.nome);
      continue;
    }
    const pos = baralho.findIndex((k) => !p.excecoes.includes(k));
    const [kart] = baralho.splice(pos >= 0 ? pos : 0, 1);
    atribuicoesTemporarias.push({ idx, atribuicao: { customerId: p.customerId, nome: p.nome, kart } });
  }

  // Restaura rigorosamente a ordem original de entrada para chamada no paddock
  atribuicoesTemporarias.sort((a, b) => a.idx - b.idx);
  return {
    atribuicoes: atribuicoesTemporarias.map((t) => t.atribuicao),
    semKart,
  };
}

/** Alias de sortear para conformidade com contratos de testes */
export const sortearComOrdemPreservada = sortear;
```

---

### 4.3 Correções das Falhas 10, 11, 12, 13, 14 e 15 em `src/app/bateria/[id].tsx`

#### A. Falha 15: Adição de Estado de Lock e Sorteio Individual:
```typescript
// No componente Sorteio (após linha 87):
const [pilotoSorteandoId, setPilotoSorteandoId] = useState<string | null>(null);
```

#### B. Falha 11: Preservação de Prévia em Erro 409 e Atualização de Revisão:
```typescript
// Sincronizar revisão do sorteio quando a sessão atualizar
useEffect(() => {
  if (p.sessao.sessionRevision > revisaoSorteio.current) {
    revisaoSorteio.current = p.sessao.sessionRevision;
  }
}, [p.sessao.sessionRevision]);

// Modificação de gravar() (linhas 171–188):
const gravar = async () => {
  setFase('gravando');
  const modoApi = modoSorteio === 'UM_A_UM' ? 'um_a_um' : 'todos';
  const ok = await enviar(
    inicial ? 'draw' : 'late-assignments',
    { atribuicoes: previa, modo: modoApi },
    inicial ? 'Sorteio' : 'Atrasados',
    inicial ? 'Sorteio gravado na cronometragem.' : 'Atrasados gravados: os outros não mudaram.',
    revisaoSorteio.current,
  );
  if (ok) {
    setFase('gravado');
    setXadrez(true);
  } else {
    // FALHA 11: NÃO descarta previa! Atualiza revisão da sessão e mantém na tela de conferência
    revisaoSorteio.current = p.sessao.sessionRevision;
    setFase('conferir');
  }
};
```

#### C. Falha 12: Função e Condição de Recusar Kart com Swap Inteligente:
```typescript
// Helpers de recusar kart:
const kartsJaAceitos = useMemo(
  () => new Set(previa.slice(0, indiceUmAUm).map((x) => x.kart)),
  [previa, indiceUmAUm],
);

const pilotoUmAUmObj = aptos.find((x) => x.nome === pilotoUmAUm?.nome) ?? {
  excecoes: [],
  kartAtual: pilotoUmAUm?.kart ?? '',
};

const candidatosRecusa = useMemo(() => {
  if (!pilotoUmAUm) return [];
  return livres.filter(
    (k) => !kartsJaAceitos.has(k) && !pilotoUmAUmObj.excecoes.includes(k) && k !== pilotoUmAUm.kart,
  );
}, [livres, kartsJaAceitos, pilotoUmAUmObj.excecoes, pilotoUmAUm]);

const podeRecusar = candidatosRecusa.length > 0;

const recusarKartUmAUm = () => {
  const atualAtrib = previa[indiceUmAUm];
  if (!atualAtrib || !candidatosRecusa.length) return;
  const novoKart = candidatosRecusa[Math.floor(Math.random() * candidatosRecusa.length)];

  // Se o novo kart estava provisoriamente alocado a um piloto futuro, faz a troca entre ambos
  const idxFuturo = previa.findIndex((item, idx) => idx > indiceUmAUm && item.kart === novoKart);
  setPrevia((ant) =>
    ant.map((item, idx) => {
      if (idx === indiceUmAUm) return { ...item, kart: novoKart };
      if (idx === idxFuturo) return { ...item, kart: atualAtrib.kart };
      return item;
    }),
  );
};
```
E no JSX do botão Recusar (linha 405):
```tsx
<Botao
  tipo="neutro"
  alto={52}
  texto="Recusar / outro"
  onPress={recusarKartUmAUm}
  desativado={!podeRecusar}
/>
```

#### D. Falha 13: Rótulo de 1 Piloto no "Um a um" e Falhas 10 e 14 no Botão Principal:
```tsx
// Substituição do Botão principal de sorteio (linhas 461–468):
const bloqueadoPorRecepcao = p.sessao.vinculadaRecepcao && !p.sessao.recepcaoDisponivel;

<Botao
  grande
  alto={68}
  texto={
    modoSorteio === 'UM_A_UM'
      ? (faltam.length <= 1 ? 'CONFIRMAR PILOTO ›' : 'CHAMAR 1 A 1 ›')
      : (inicial ? 'SORTEAR AGORA ›' : `SORTEAR SÓ ${faltam.length} ›`)
  }
  onPress={comecar}
  desativado={
    !pode ||
    !livres.length ||
    !aptos.length ||
    !faltam.length ||
    bloqueadoPorRecepcao
  }
/>
```
E na exibição do aviso da recepção (linha 443):
```tsx
{bloqueadoPorRecepcao ? (
  <Cartao tom="erro">
    <Forte cor={cores.erroClaro}>Recepção indisponível</Forte>
    <Suave>Sorteio bloqueado até voltar.</Suave>
  </Cartao>
) : null}
```

#### E. Falha 15: ActivityIndicator no Card e Lock Concorrente no Sorteio Individual:
```tsx
// No modal manual (linhas 298–311):
<Botao
  tipo="neutro"
  alto={48}
  texto="Sortear só este piloto"
  desativado={enviando || Boolean(pilotoSorteandoId)}
  onPress={async () => {
    if (pilotoSorteandoId || enviando) return;
    const pilotoId = x.customerId ?? x.nome;
    setPilotoSorteandoId(pilotoId);
    const r = sortear([x], livres);
    const sorteado = r.atribuicoes[0]?.kart;
    if (!sorteado) {
      setPilotoSorteandoId(null);
      return;
    }
    setManual(null);
    try {
      await enviar(
        x.kartAtual || inicial ? 'draw' : 'late-assignments',
        { atribuicoes: [{ customerId: x.customerId, nome: x.nome, kart: sorteado }], modo: 'um_a_um' },
        'Sorteio individual',
        `${x.nome} sorteado no kart ${sorteado}.`,
      );
    } finally {
      setPilotoSorteandoId(null);
    }
  }}
/>
```
E na renderização do card do piloto (linhas 228–236):
```tsx
const estaSorteando = pilotoSorteandoId === (x.customerId ?? x.nome);

<View style={[s.piloto, k ? s.pilotoOk : null, !x.kartAtual && fase === 'inicio' && !inicial ? s.pilotoEspera : null, aberto && { borderColor: cores.verde }]}>
  {estaSorteando ? (
    <View style={[s.roloVazio, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color={cores.verde} size="small" />
    </View>
  ) : novo && k ? (
    <Rolo valor={k} />
  ) : k ? (
    <PlacaKart n={k} tam="g" tom={Number(k) >= 100 ? 'alerta' : 'verde'} etiqueta={Number(k) >= 100 ? 'SUPER' : 'LIGHT'} />
  ) : (
    <RoloVazio />
  )}
  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
    <Text style={s.nomePiloto} numberOfLines={1}>{x.nome}</Text>
    ...
```

---

## 5. Verification Method (Método de Verificação Independente)

### 5.1 Testes Automatizados Jest
Executar na pasta do app `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`:
```bash
npm test -- tests/baterias.test.ts tests/sorteio.test.ts tests/tier1-features.test.ts tests/tier2-boundary-corner-cases.test.ts tests/tier3-cross-feature.test.ts
```

### 5.2 Critérios de Sucesso por Falha
1. **Falha 08**: `normalizarChaveBateria('2026-11-02-1', 'BATERIA 18:00 - TOMADA')` e `normalizarChaveBateria('2026-11-02-1', 'BATERIA 18:00 - CORRIDA')` retornam exatamente a mesma chave (`'2026-11-02-bateria 18:00'`).
2. **Falha 09**: `sortear([p1, p2, p3], karts)` onde `p2` possui 3 exceções e `p1` possui 1 retorna `r.atribuicoes` na ordem exata de chamada `[p1, p2, p3]`.
3. **Falha 10**: `podeSortearBateria(false, false)` (avulsa + recepção offline) retorna `true`, e o botão permanece habilitado.
4. **Falha 11**: Ao simular resposta HTTP 409, `previa` permanece com comprimento igual a N (não vazia) e `revisaoSorteio.current` assume a nova revisão recebida.
5. **Falha 12**: Em grid de 10 pilotos e 10 karts, com Piloto 1 no kart '10', o botão "Recusar / outro" está habilitado enquanto houver outros karts livres não aceitos e sem exceção para o piloto.
6. **Falha 13**: Com `faltam.length = 1` e modo `UM_A_UM`, o texto do botão é `'CONFIRMAR PILOTO ›'`.
7. **Falha 14**: Com `aptos.length = 0`, o botão de sorteio é desabilitado (`desativado = true`).
8. **Falha 15**: Durante o envio do sorteio individual, `pilotoSorteandoId` bloqueia novas requisições concorrentes e o card do piloto exibe `ActivityIndicator`.

### 5.3 Condições de Invalidação
A solução será considerada inválida se:
- O sorteio no modo "Um a um" reordenar a chamada dos pilotos de acordo com a quantidade de karts anteriormente usados.
- Um erro 409 apagar a prévia em memória forçando o operador a sortear todos os pilotos novamente.
- Uma bateria avulsa não puder ser sorteada caso o servidor dos totens de recepção esteja inacessível.
- O botão "Recusar / outro" continuar travado quando houver karts livres elegíveis.
