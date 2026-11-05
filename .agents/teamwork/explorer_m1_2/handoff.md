# Relatório de Handoff — Explorer M1-2: Administração, Usuários, Auditoria e Fuso Horário (Falhas 39 a 45)

**Data**: 2026-11-02  
**Agente**: Explorer M1-2 (`explorer_m1_2`)  
**Parent / Caller**: `88cadb65-7d49-4f0d-a278-9c17ee4251ab`  
**Escopo**: M1 Parte 2 — Falhas 39 a 45 (Administração, Dono, Usuários, Conta, Histórico, Formato e Index)  
**Diretório de Trabalho**: `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_2`  
**Projeto Alvo**: `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`  

---

## 1. Observation (Observações Diretas)

Todas as observações abaixo foram verificadas diretamente inspecionando o código-fonte em `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`.

### 1.1 Falha 39: RBAC para perfil `GERENCIA` em rotas sensíveis (`/usuarios` e `/dono`)
- **Arquivo**: `src/app/usuarios.tsx`
  - Linha 18: `const { cliente } = useSessao();`
  - Linhas 28-31:
    ```tsx
    const ler = useCallback(() => {
      cliente.get<{ usuarios: U[] }>('/users').then((r) => setLista(r.usuarios)).catch((e) => setMsg({ ok: false, t: (e as Error).message }));
    }, [cliente]);
    useEffect(ler, [ler]);
    ```
  - **Constatação**: O componente `Usuarios` não obtém o usuário autenticado (`eu`) nem seu perfil (`eu?.perfil`). Não há verificação se o operador é `GERENCIA`. Qualquer perfil autenticado (como `OPERACAO` ou `RECEPCAO`) que acesse a rota `/usuarios` dispara a leitura de `/users` e tem acesso à interface de gestão de operadores.
- **Arquivo**: `src/app/dono.tsx`
  - Linha 89: `const { cliente, tempoReal, eu } = useSessao();`
  - Linhas 103-122:
    ```tsx
    const ler = useCallback(() => {
      cliente.get<Dia>('/owner/today').then((r) => { setD(r); setErro(''); }).catch((e) => setErro((e as Error).message));
      cliente.get<{ auditoria: LinhaAuditoria[] }>('/audit').then((r) => setAuditoria(r.auditoria ?? [])).catch(() => null);
      ...
    useEffect(() => {
      ler();
      const t = setInterval(ler, 6000);
      const tique = setInterval(() => setRestaViva((x) => (x == null ? x : Math.max(0, x - 1000))), 1000);
      return () => { clearInterval(t); clearInterval(tique); };
    }, [ler]);
    ```
  - **Constatação**: Embora `eu` seja obtido na linha 89, não é utilizado para bloquear a tela ou o polling. O polling em `/owner/today` e `/audit` roda a cada 6 segundos independentemente do perfil do operador.

### 1.2 Falha 40: Auto-bloqueio de usuário conectado (`src/app/usuarios.tsx`)
- **Arquivo**: `src/app/usuarios.tsx`
  - Linhas 67-77:
    ```tsx
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
    ```
  - **Constatação**: Para o registro da lista onde `u.usuario === eu?.usuario`, o botão "Bloquear" permanece visível e interativo. Se o administrador confirmar o bloqueio, bloqueia a si mesmo no backend (`/users/:usuario/block`), perdendo imediatamente a capacidade de operar e gerenciar o sistema.

### 1.3 Falha 41: Ausência de confirmação de senha (`src/app/usuarios.tsx` e `src/app/conta.tsx`)
- **Arquivo**: `src/app/usuarios.tsx`
  - Linhas 25 e 104-106:
    ```tsx
    const [senha, setSenha] = useState('');
    ...
    <View style={{ gap: 4 }}>
      <Sobre>SENHA INICIAL (MÍNIMO 10 CARACTERES)</Sobre>
      <Campo placeholder="Senha inicial (10+)" secureTextEntry value={senha} onChangeText={setSenha} accessibilityLabel="Senha inicial" />
    </View>
    ```
- **Arquivo**: `src/app/conta.tsx`
  - Linhas 11 e 61-63:
    ```tsx
    const [nova, setNova] = useState('');
    ...
    <View style={{ gap: 5 }}>
      <Sobre>NOVA SENHA (MÍNIMO 10 CARACTERES)</Sobre>
      <Campo secureTextEntry placeholder="Senha nova (10+ caracteres)" value={nova} onChangeText={setNova} accessibilityLabel="Senha nova" />
    </View>
    ```
  - **Constatação**: Em ambas as telas há apenas um campo de digitação de senha mascarada (`secureTextEntry`). Não existe campo de confirmação (`confirmarSenha`). Erros de digitação geram perda irreversível de credencial ou bloqueio de operadores.

### 1.4 Falha 42: Filtros de auditoria incompletos (`src/app/historico.tsx` e `src/app/dono.tsx`)
- **Arquivo**: `src/app/historico.tsx`
  - Linhas 9-25:
    ```ts
    const NOME: Record<string, string> = {
      draw: 'Sorteio gravado',
      'late-assignment': 'Atrasado incluído',
      'weight-check': 'Lastro conferido',
      'kart-swap': 'Troca de kart',
      penalty: 'Punição aplicada',
      'penalty-remove': 'Punição retirada',
      flag: 'Bandeira de pista',
      relargada: 'Relargada',
      fleet: 'Manutenção de frota',
    };
    const FILTROS = [
      { id: '', t: 'Tudo' },
      { id: 'penalty', t: 'Punições' },
      { id: 'draw', t: 'Sorteios' },
      { id: 'kart-swap', t: 'Trocas' },
    ];
    ```
  - **Constatação**: Os eventos `weight-check` (conferência de lastro) e `fleet` (manutenção de frota) estão mapeados no dicionário `NOME`, mas omitidos na lista de botões `FILTROS` tanto em `historico.tsx` quanto em `dono.tsx`.

### 1.5 Falha 43: Falta de virtualização e paginação em `src/app/historico.tsx`
- **Arquivo**: `src/app/historico.tsx`
  - Linhas 58-88:
    ```tsx
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 50 }}>
      {erro ? <Suave cor={cores.erroClaro}>{erro}</Suave> : null}
      <View style={tablet ? { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 } : { gap: 8 }}>
        {vis.map((l, i) => {
          ...
        })}
      </View>
    </ScrollView>
    ```
  - **Constatação**: Renderiza todos os registros da auditoria de uma só vez utilizando `ScrollView` com `vis.map()`. Em dias movimentados com centenas de eventos, isso degrada a taxa de quadros (FPS), causa travamentos durante a rolagem e eleva o consumo de memória.

### 1.6 Falha 44: Ausência de logout e redirecionamento após troca de senha (`src/app/conta.tsx`)
- **Arquivo**: `src/app/conta.tsx`
  - Linhas 14-24:
    ```tsx
    const trocar = async () => {
      setErro('');
      try {
        await cliente.postar('/auth/password', { atual, nova });
        setOk(true);
        setAtual('');
        setNova('');
      } catch (e) {
        setErro((e as Error).message);
      }
    };
    ```
  - **Constatação**: Quando a senha é alterada com sucesso, `setOk(true)` exibe a mensagem de sucesso, mas a sessão em memória não é encerrada e o aplicativo não redireciona o operador para a tela de login. O operador permanece na tela logado com tokens antigos até receber erros subsequentes.

### 1.7 Falha 45: Fuso horário local `America/Sao_Paulo` ausente
- **Arquivo**: `src/features/operacao/formato.ts` (Linhas 12-13)
  ```ts
  export const minutos = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  export const hora = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR');
  ```
- **Arquivo**: `src/app/index.tsx` (Linha 230 e 448)
  ```tsx
  nome: item.nome ?? `Bateria ${item.inicio?.slice(11, 16) ?? item.id}`,
  ```
- **Arquivo**: `src/app/historico.tsx` (Linha 64)
  ```tsx
  const dataHora = new Date(l.timestampServerUTC).toLocaleString('pt-BR');
  ```
- **Arquivo**: `src/app/dono.tsx` (Linha 227)
  ```tsx
  const horaStr = new Date(l.timestampServerUTC).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  ```
- **Constatação**: Nenhuma chamada especifica `{ timeZone: 'America/Sao_Paulo' }`. Dispositivos configurados em UTC ou outro fuso exibem divergências de 3 horas. Adicionalmente, `item.inicio?.slice(11, 16)` fatia os caracteres da string ISO 8601 UTC sem efetuar a conversão de fuso horário, fazendo com que uma bateria agendada para 18:00 (21:00 UTC) seja rotulada como "Bateria 21:00".

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio)

1. **Guarda RBAC em `/usuarios` e `/dono`**:
   - Da Observação 1.1: Sem checagem de `eu?.perfil === 'GERENCIA'`, usuários com perfis comuns acessam telas confidenciais e o app executa requisições `/users`, `/owner/today` e `/audit`.
   - Se o usuário não tiver perfil `GERENCIA`, a tela deve bloquear o acesso antes de disparar qualquer requisição e renderizar um estado amigável ("Acesso Restrito: Exclusivo para Gerência") com botão para retornar ao início (`router.replace('/')`).
   - Se a sessão ainda estiver em carregamento (`carregando === true`), exibe-se um `ActivityIndicator` até a determinação do perfil.

2. **Prevenção de Auto-Bloqueio**:
   - Da Observação 1.2: No mapeamento de operadores em `usuarios.tsx`, `u.usuario === eu?.usuario` indica a conta atualmente conectada.
   - Ocultar o botão "Bloquear" e exibir no lugar um `<Selo texto="SUA CONTA" tom="neutro" />` (e tag `<Selo texto="VOCÊ" tom="verde" />` ao lado do nome) elimina por completo o risco de auto-bloqueio acidental.

3. **Confirmação de Senha**:
   - Da Observação 1.3: Em `usuarios.tsx` (criação) e `conta.tsx` (troca), adicionar um segundo campo mascarado `confirmarSenha` com validação de igualdade (`senha === confirmarSenha`) antes de habilitar o botão de submissão previne perda de credenciais por erro de digitação.

4. **Filtros de Auditoria para Lastro e Frota**:
   - Da Observação 1.4: O backend já emite eventos `'weight-check'` e `'fleet'`. Incluir `{ id: 'weight-check', t: 'Lastro' }` e `{ id: 'fleet', t: 'Frota' }` no array `FILTROS` de `historico.tsx` e `dono.tsx` permite filtrar instantaneamente auditorias de lastro e manutenção de frota.

5. **Virtualização com `FlatList` Paginada**:
   - Da Observação 1.5: Substituir `ScrollView` por `FlatList` em `historico.tsx`.
   - Adicionar paginação sob demanda em lotes de 25 itens (`ITENS_POR_PAGINA = 25`), expandindo a lista via `onEndReached={() => setPagina((p) => p + 1)}` com `onEndReachedThreshold={0.4}`.
   - Suporte a 2 colunas no tablet com `numColumns={tablet ? 2 : 1}` e chave dinâmica `key={tablet ? 'grid-2' : 'list-1'}` para evitar o erro do React Native ao alterar `numColumns`.

6. **Encerramento de Sessão e Redirecionamento após Troca de Senha**:
   - Da Observação 1.6: Após sucesso em `cliente.postar('/auth/password', { atual, nova })`, a função deve exibir feedback visual claro, desativar novos envios e, após 2 segundos (ou clique imediato), acionar `await sair()` e navegar com `router.replace('/')` para o login.

7. **Padronização do Fuso Horário `America/Sao_Paulo`**:
   - Da Observação 1.7: Centralizar em `src/features/operacao/formato.ts` utilitários com `FUSO_HORARIO = 'America/Sao_Paulo'`:
     - `minutos()`: `toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO_HORARIO })`
     - `hora()`: `toLocaleTimeString('pt-BR', { timeZone: FUSO_HORARIO })`
     - `dataHoraLocal()`: `toLocaleString('pt-BR', { timeZone: FUSO_HORARIO })`
     - `horaMinutoLocal()`: `toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO_HORARIO })`
     - `formatarInicioAgenda()`: converte a string ISO UTC da agenda para `HH:mm` no fuso de Brasília, eliminando o erro de `.slice(11, 16)`.
   - Utilizar essas funções em `src/app/index.tsx`, `src/app/historico.tsx` e `src/app/dono.tsx`.

---

## 3. Caveats (Ressalvas e Suposições)

1. **Escopo Read-Only do Explorer**:
   - Este agente possui papel de Explorer e não aplicou modificações diretamente aos arquivos de código do projeto. Todas as especificações abaixo contêm os trechos exatos prontos para aplicação pelo Worker.
2. **Suporte de Timezone no Hermes / V8**:
   - A especificação `timeZone: 'America/Sao_Paulo'` depende do suporte a `Intl.DateTimeFormat` na engine JavaScript. No React Native 0.86 (Hermes moderno), o suporte a `Intl` com timezones IANA está compilado por padrão. Validações via Node confirmam a compatibilidade imediata.
3. **Resolução de Chave do `FlatList`**:
   - No React Native, alternar dinamicamente a propriedade `numColumns` em um mesmo `<FlatList>` montado lança uma exceção se a `key` do componente não mudar. Portanto, a `key` deve ser vinculada à flag do tablet: `key={tablet ? 'grid-2' : 'list-1'}`.

---

## 4. Conclusion (Especificações Exatas de Linha para o Worker)

Abaixo estão os patches exatos e detalhados para cada um dos 6 arquivos que compõem as Falhas 39 a 45, além da nova suíte de testes unitários.

---

### Patch 1: `src/features/operacao/formato.ts` (Falha 45)
**Alvo**: `src/features/operacao/formato.ts`  
**Objetivo**: Centralizar e padronizar todas as formatações temporais no fuso `America/Sao_Paulo`.

```ts
export const FUSO_HORARIO = 'America/Sao_Paulo';

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

export const hora = (ms: number | Date | string) =>
  new Date(ms).toLocaleTimeString('pt-BR', { timeZone: FUSO_HORARIO });

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
  if (!inicio) return String(fallback ?? '');
  const hm = horaMinutoLocal(inicio);
  return hm !== '--:--' ? hm : (inicio.slice(11, 16) || String(fallback ?? ''));
};
```

---

### Patch 2: `src/app/usuarios.tsx` (Falhas 39, 40, 41)
**Alvo**: `src/app/usuarios.tsx`  
**Objetivo**: RBAC para perfil `GERENCIA`, ocultar auto-bloqueio para a própria conta, confirmação de senha na criação de operador.

#### 1. Importações (Linhas 1-7):
Adicionar `useRouter` e `ActivityIndicator`:
```tsx
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Pop, Sobe } from '@/core/design-system/anim';
import { cores, fontes, LARGURA_TABLET } from '@/core/design-system/tokens';
import { Abas, Botao, Campo, Cartao, Forte, Fundo, Pilula, Selo, Sobre, Suave, Topo } from '@/core/design-system/ui';
import { useSessao } from '@/features/auth/sessao';
import { confirmar } from '@/features/operacao/acao';
```

#### 2. Componente e Estados (Linhas 17-31):
Adicionar `router`, `eu`, `carregando` e `confirmarSenha`:
```tsx
export default function Usuarios() {
  const router = useRouter();
  const { cliente, eu, carregando } = useSessao();
  const { width } = useWindowDimensions();
  const tablet = width >= LARGURA_TABLET;
  const [lista, setLista] = useState<U[]>([]);
  const [novo, setNovo] = useState(false);
  const [usuario, setUsuario] = useState('');
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [perfil, setPerfil] = useState<Perfil>('OPERACAO');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const ler = useCallback(() => {
    if (eu?.perfil !== 'GERENCIA') return;
    cliente.get<{ usuarios: U[] }>('/users').then((r) => setLista(r.usuarios)).catch((e) => setMsg({ ok: false, t: (e as Error).message }));
  }, [cliente, eu?.perfil]);

  useEffect(() => {
    if (eu?.perfil === 'GERENCIA') ler();
  }, [eu?.perfil, ler]);
```

#### 3. Guarda RBAC (antes de `colunaEquipe`):
```tsx
  if (carregando) {
    return (
      <Fundo>
        <Topo sobre="GERÊNCIA · CONTROLE DE ACESSOS" titulo="Usuários" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={cores.verde} size="large" />
        </View>
      </Fundo>
    );
  }

  if (eu?.perfil !== 'GERENCIA') {
    return (
      <Fundo>
        <Topo sobre="ACESSO RESTRITO" titulo="Usuários" />
        <View style={{ flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' }}>
          <Cartao tom="erro" style={{ padding: 24, gap: 14, alignItems: 'center', width: '100%', maxWidth: 440 }}>
            <Selo texto="GERÊNCIA EXCLUSIVA" tom="erro" />
            <Forte tam={22} cor={cores.erroClaro}>Acesso restrito</Forte>
            <Suave tam={15} style={{ textAlign: 'center' }}>
              Esta seção é restrita à Gerência. Seu perfil ({eu?.perfil ?? 'indefinido'}) não tem permissão para gerenciar operadores.
            </Suave>
            <Botao texto="Voltar ao início" alto={52} onPress={() => router.replace('/')} />
          </Cartao>
        </View>
      </Fundo>
    );
  }
```

#### 4. Ocultação de Auto-bloqueio em `colunaEquipe` (Falha 40):
```tsx
      {lista.map((u, i) => {
        const iniciais = (u.nome || u.usuario).slice(0, 2).toUpperCase();
        const nomePerfil = PERFIS.find((p) => p.id === u.perfil)?.nome ?? u.perfil;
        const ehEu = Boolean(eu?.usuario && u.usuario.toLowerCase() === eu.usuario.toLowerCase());
        return (
          <Sobe key={u.usuario} indice={i}>
            <Cartao tom={u.bloqueado ? 'erro' : 'neutro'} style={s.item}>
              <View style={[s.avatar, Boolean(u.bloqueado) && { borderColor: cores.erroLinha, backgroundColor: cores.erroFundo }]}>
                <Text style={[s.avatarTxt, Boolean(u.bloqueado) && { color: cores.erroClaro }]}>{iniciais}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={s.linha}>
                  <Forte tam={18}>{u.nome}</Forte>
                  {ehEu ? <Selo texto="VOCÊ" tom="verde" /> : null}
                  <Selo texto={nomePerfil.toUpperCase()} tom={u.perfil === 'GERENCIA' || u.perfil === 'ADMIN' ? 'roxo' : 'neutro'} />
                  <Selo texto={u.bloqueado ? 'BLOQUEADO' : 'ATIVO'} tom={u.bloqueado ? 'erro' : 'verde'} />
                </View>
                <Suave tam={14}>@{u.usuario}</Suave>
              </View>
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
            </Cartao>
          </Sobe>
        );
      })}
```

#### 5. Confirmação de Senha em `colunaNovo` (Falha 41):
```tsx
        <View style={{ gap: 4 }}>
          <Sobre>SENHA INICIAL (MÍNIMO 10 CARACTERES)</Sobre>
          <Campo placeholder="Senha inicial (10+)" secureTextEntry value={senha} onChangeText={setSenha} accessibilityLabel="Senha inicial" />
        </View>
        <View style={{ gap: 4 }}>
          <Sobre>CONFIRMAR SENHA INICIAL</Sobre>
          <Campo placeholder="Repita a senha inicial" secureTextEntry value={confirmarSenha} onChangeText={setConfirmarSenha} accessibilityLabel="Confirmar senha inicial" />
        </View>
        {senha && confirmarSenha && senha !== confirmarSenha ? (
          <Suave cor={cores.erroClaro}>As senhas não coincidem.</Suave>
        ) : null}
        <Sobre>PERFIL DE PERMISSÃO</Sobre>
        <Abas abas={PERFIS} atual={perfil} aoMudar={setPerfil} />
        <Botao
          alto={58}
          texto="Criar usuário ›"
          desativado={!usuario || !nome || senha.length < 10 || senha !== confirmarSenha}
          onPress={() => {
            if (senha !== confirmarSenha) {
              setMsg({ ok: false, t: 'As senhas não coincidem.' });
              return;
            }
            void acao(() => cliente.postar('/users', { usuario, nome, senha, perfil }), 'Usuário criado.').then((ok) => {
              if (ok) {
                setNovo(false);
                setUsuario('');
                setNome('');
                setSenha('');
                setConfirmarSenha('');
              }
            });
          }}
        />
```

---

### Patch 3: `src/app/dono.tsx` (Falhas 39, 42, 45)
**Alvo**: `src/app/dono.tsx`  
**Objetivo**: RBAC para perfil `GERENCIA`, filtros de lastro e frota, e fuso horário `America/Sao_Paulo`.

#### 1. Importações e Constantes:
- Adicionar `ActivityIndicator` em `react-native`:
  `import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';`
- Importar `horaMinutoLocal` de `@/features/operacao/formato`:
  `import { horaMinutoLocal, relogio, volta } from '@/features/operacao/formato';`
- Expandir `FILTROS` (Linhas 59-64):
  ```ts
  const FILTROS = [
    { id: '', t: 'Tudo' },
    { id: 'penalty', t: 'Punições' },
    { id: 'draw', t: 'Sorteios' },
    { id: 'kart-swap', t: 'Trocas' },
    { id: 'weight-check', t: 'Lastro' },
    { id: 'fleet', t: 'Frota' },
  ];
  ```

#### 2. Sessão e Guarda RBAC (Linhas 89+):
```tsx
  const { cliente, tempoReal, eu, carregando } = useSessao();
```
E antes da renderização das colunas:
```tsx
  if (carregando) {
    return (
      <Fundo>
        <Topo sobre="PAINEL EXECUTIVO · GERÊNCIA" titulo="O dia de hoje" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={cores.verde} size="large" />
        </View>
      </Fundo>
    );
  }

  if (eu?.perfil !== 'GERENCIA') {
    return (
      <Fundo>
        <Topo sobre="ACESSO RESTRITO" titulo="O dia de hoje" />
        <View style={{ flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' }}>
          <Cartao tom="erro" style={{ padding: 24, gap: 14, alignItems: 'center', width: '100%', maxWidth: 440 }}>
            <Selo texto="GERÊNCIA EXCLUSIVA" tom="erro" />
            <Forte tam={22} cor={cores.erroClaro}>Acesso restrito</Forte>
            <Suave tam={15} style={{ textAlign: 'center' }}>
              O painel executivo é restrito a operadores com perfil GERÊNCIA. Seu perfil ({eu?.perfil ?? 'indefinido'}) não tem permissão para visualizar estes indicadores.
            </Suave>
            <Botao texto="Voltar ao início" alto={52} onPress={() => router.replace('/')} />
          </Cartao>
        </View>
      </Fundo>
    );
  }
```

#### 3. Polling Protegido (Linhas 117-122):
```tsx
  useEffect(() => {
    if (eu?.perfil !== 'GERENCIA') return;
    ler();
    const t = setInterval(ler, 6000);
    const tique = setInterval(() => setRestaViva((x) => (x == null ? x : Math.max(0, x - 1000))), 1000);
    return () => { clearInterval(t); clearInterval(tique); };
  }, [eu?.perfil, ler]);
```

#### 4. Fuso Horário Local no Feed de Eventos (Linha 227):
Substituir:
```tsx
const horaStr = new Date(l.timestampServerUTC).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
```
Por:
```tsx
const horaStr = horaMinutoLocal(l.timestampServerUTC);
```

---

### Patch 4: `src/app/conta.tsx` (Falhas 41 e 44)
**Alvo**: `src/app/conta.tsx`  
**Objetivo**: Campo de confirmação de nova senha, feedback visual e encerramento de sessão com redirecionamento ao login após troca da própria senha.

#### 1. Importações (Linhas 1-6):
```tsx
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Confirmado, Pop } from '@/core/design-system/anim';
import { cores, fontes } from '@/core/design-system/tokens';
import { Botao, Campo, Cartao, Forte, Fundo, Selo, Sobre, Suave, Topo } from '@/core/design-system/ui';
import { useSessao } from '@/features/auth/sessao';
```

#### 2. Estados e Função `trocar` (Linhas 8-24):
```tsx
export default function Conta() {
  const router = useRouter();
  const { cliente, eu, sair } = useSessao();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState('');
  const [desconectando, setDesconectando] = useState(false);

  const trocar = async () => {
    setErro('');
    if (nova !== confirmacao) {
      setErro('A confirmação da nova senha não confere.');
      return;
    }
    try {
      await cliente.postar('/auth/password', { atual, nova });
      setOk(true);
      setAtual('');
      setNova('');
      setConfirmacao('');
      setDesconectando(true);
      setTimeout(async () => {
        try {
          await sair();
        } finally {
          router.replace('/');
        }
      }, 2000);
    } catch (e) {
      setErro((e as Error).message);
    }
  };
```

#### 3. JSX de Feedback e Campos (Linhas 52-68):
```tsx
            {ok ? (
              <Pop>
                <Cartao tom="verde" style={{ padding: 18, alignItems: 'center', gap: 10 }}>
                  <Confirmado tam={64} />
                  <Forte tam={18} cor={cores.verde}>Senha alterada com sucesso!</Forte>
                  <Suave cor={cores.verde} style={{ textAlign: 'center' }}>
                    Sua sessão está sendo encerrada por segurança. Faça login novamente com a nova senha. Redirecionando...
                  </Suave>
                  <ActivityIndicator color={cores.verde} size="small" />
                </Cartao>
              </Pop>
            ) : null}

            <View style={{ gap: 5 }}>
              <Sobre>SENHA ATUAL</Sobre>
              <Campo secureTextEntry placeholder="Senha atual" value={atual} onChangeText={setAtual} accessibilityLabel="Senha atual" editable={!desconectando} />
            </View>

            <View style={{ gap: 5 }}>
              <Sobre>NOVA SENHA (MÍNIMO 10 CARACTERES)</Sobre>
              <Campo secureTextEntry placeholder="Senha nova (10+ caracteres)" value={nova} onChangeText={setNova} accessibilityLabel="Senha nova" editable={!desconectando} />
            </View>

            <View style={{ gap: 5 }}>
              <Sobre>CONFIRMAR NOVA SENHA</Sobre>
              <Campo secureTextEntry placeholder="Repita a nova senha" value={confirmacao} onChangeText={setConfirmacao} accessibilityLabel="Confirmar nova senha" editable={!desconectando} />
            </View>

            {nova && confirmacao && nova !== confirmacao ? (
              <Suave cor={cores.erroClaro}>A nova senha e a confirmação não coincidem.</Suave>
            ) : null}

            {erro ? <Suave cor={cores.erroClaro}>{erro}</Suave> : null}

            <Botao
              grande
              alto={62}
              texto={desconectando ? 'Encerrando sessão...' : 'Trocar senha ›'}
              desativado={desconectando || !atual || nova.length < 10 || nova !== confirmacao}
              onPress={() => void trocar()}
            />
```

---

### Patch 5: `src/app/historico.tsx` (Falhas 42, 43, 45)
**Alvo**: `src/app/historico.tsx`  
**Objetivo**: Expandir filtros para `weight-check` e `fleet`, virtualizar a lista com `FlatList` paginada e aplicar fuso de São Paulo.

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Sobe } from '@/core/design-system/anim';
import { cores, LARGURA_TABLET } from '@/core/design-system/tokens';
import { Cartao, Forte, Fundo, Pilula, Selo, Sobre, Suave, Topo } from '@/core/design-system/ui';
import { useSessao } from '@/features/auth/sessao';
import { dataHoraLocal } from '@/features/operacao/formato';

type Linha = { auditId: string; action: string; reason: string | null; status: string; timestampServerUTC: string; actorRole: string | null; deviceId: string | null; routeMode: string | null };

const NOME: Record<string, string> = {
  draw: 'Sorteio gravado',
  'late-assignment': 'Atrasado incluído',
  'weight-check': 'Lastro conferido',
  'kart-swap': 'Troca de kart',
  penalty: 'Punição aplicada',
  'penalty-remove': 'Punição retirada',
  flag: 'Bandeira de pista',
  relargada: 'Relargada',
  fleet: 'Manutenção de frota',
};

const FILTROS = [
  { id: '', t: 'Tudo' },
  { id: 'penalty', t: 'Punições' },
  { id: 'draw', t: 'Sorteios' },
  { id: 'kart-swap', t: 'Trocas' },
  { id: 'weight-check', t: 'Lastro' },
  { id: 'fleet', t: 'Frota' },
];

const ITENS_POR_PAGINA = 25;

export default function Historico() {
  const { cliente } = useSessao();
  const { width } = useWindowDimensions();
  const tablet = width >= LARGURA_TABLET;
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [f, setF] = useState('');
  const [pagina, setPagina] = useState(1);
  const [erro, setErro] = useState('');

  const ler = useCallback(() => {
    cliente.get<{ auditoria: Linha[] }>('/audit').then((r) => setLinhas(r.auditoria ?? [])).catch((e) => setErro((e as Error).message));
  }, [cliente]);

  useEffect(() => {
    ler();
    const t = setInterval(ler, 8000);
    return () => clearInterval(t);
  }, [ler]);

  const vis = useMemo(() => linhas.filter((l) => !f || l.action.startsWith(f)), [f, linhas]);
  const paginados = useMemo(() => vis.slice(0, pagina * ITENS_POR_PAGINA), [vis, pagina]);

  const alternarFiltro = (id: string) => {
    setF(id);
    setPagina(1);
  };

  return (
    <Fundo>
      <Topo
        sobre="TRILHA DE AUDITORIA · QUEM, QUANDO E DE ONDE"
        titulo="Histórico"
        direita={<Selo texto={`${vis.length} REGISTROS`} tom="verde" />}
      />
      <View style={s.barraFiltros}>
        <View style={s.filtros}>
          {FILTROS.map((x) => (
            <Pilula key={x.id} texto={x.t} ativo={f === x.id} onPress={() => alternarFiltro(x.id)} />
          ))}
        </View>
      </View>
      <FlatList
        key={tablet ? 'grid-2' : 'list-1'}
        data={paginados}
        keyExtractor={(item) => item.auditId}
        numColumns={tablet ? 2 : 1}
        columnWrapperStyle={tablet ? s.wrapperColunas : undefined}
        renderItem={({ item: l, index: i }) => {
          const incerto = l.status === 'UNKNOWN' || l.status === 'PENDING';
          const recusado = l.status === 'REJECTED';
          const dataHora = dataHoraLocal(l.timestampServerUTC);
          const rotaTxt = l.routeMode === 'lan' ? 'WI-FI PISTA' : l.routeMode === 'internet' ? 'INTERNET' : l.routeMode?.toUpperCase();
          return (
            <View style={tablet ? s.colunaTablet : s.colunaCelular}>
              <Sobe indice={i % ITENS_POR_PAGINA} passo={20}>
                <Cartao tom={incerto ? 'alerta' : recusado ? 'erro' : 'neutro'} style={{ gap: 8, padding: 14 }}>
                  <View style={[s.linha, { justifyContent: 'space-between' }]}>
                    <Sobre cor={cores.verde}>{dataHora}</Sobre>
                    <View style={s.linha}>
                      {l.actorRole ? <Selo texto={l.actorRole} tom="neutro" /> : null}
                      {rotaTxt ? <Selo texto={rotaTxt} tom={l.routeMode === 'lan' ? 'verde' : 'neutro'} /> : null}
                    </View>
                  </View>
                  <Forte tam={18} cor={incerto ? cores.alerta : recusado ? cores.erroClaro : cores.texto}>
                    {incerto ? `Sem confirmação · ${NOME[l.action] ?? l.action}` : NOME[l.action] ?? l.action}
                  </Forte>
                  <Suave tam={14}>
                    {[l.reason, l.deviceId].filter(Boolean).join(' · ')}{recusado ? ' · recusado' : ''}
                  </Suave>
                </Cartao>
              </Sobe>
            </View>
          );
        }}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 60 }}
        onEndReached={() => {
          if (paginados.length < vis.length) {
            setPagina((p) => p + 1);
          }
        }}
        onEndReachedThreshold={0.4}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={7}
        ListHeaderComponent={erro ? <Suave cor={cores.erroClaro}>{erro}</Suave> : null}
        ListFooterComponent={
          paginados.length < vis.length ? (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <Suave tam={13}>Carregando mais eventos ({paginados.length} de {vis.length})...</Suave>
            </View>
          ) : null
        }
        ListEmptyComponent={!vis.length && !erro ? <Suave>Nada registrado ainda.</Suave> : null}
      />
    </Fundo>
  );
}

const s = StyleSheet.create({
  barraFiltros: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wrapperColunas: { justifyContent: 'space-between', gap: 10 },
  colunaTablet: { width: '49.1%' },
  colunaCelular: { width: '100%', marginBottom: 8 },
});
```

---

### Patch 6: `src/app/index.tsx` (Falha 45)
**Alvo**: `src/app/index.tsx`  
**Objetivo**: Substituir `.slice(11, 16)` por `formatarInicioAgenda` com fuso horário `America/Sao_Paulo`.

1. Importação na Linha 11:
Substituir:
```tsx
import { minutos, relogio, volta } from '@/features/operacao/formato';
```
Por:
```tsx
import { formatarInicioAgenda, minutos, relogio, volta } from '@/features/operacao/formato';
```

2. Na função `prepararDaAgenda` (Linha 230):
Substituir:
```tsx
nome: item.nome ?? `Bateria ${item.inicio?.slice(11, 16) ?? item.id}`,
```
Por:
```tsx
nome: item.nome ?? `Bateria ${formatarInicioAgenda(item.inicio, item.id)}`,
```

3. Na listagem de cards da agenda (Linha 448):
Substituir:
```tsx
<Forte tam={16}>{item.nome ?? `Bateria ${item.inicio?.slice(11, 16) ?? item.id}`}</Forte>
```
Por:
```tsx
<Forte tam={16}>{item.nome ?? `Bateria ${formatarInicioAgenda(item.inicio, item.id)}`}</Forte>
```

---

### Nova Suíte de Testes: `tests/formato.test.ts`
**Alvo**: `tests/formato.test.ts`  
**Objetivo**: Garantir cobertura automatizada para todas as funções de fuso horário `America/Sao_Paulo`.

```ts
import { FUSO_HORARIO, minutos, hora, dataHoraLocal, horaMinutoLocal, formatarInicioAgenda } from '../src/features/operacao/formato';

describe('utilitários de formato e fuso horário America/Sao_Paulo (Falha 45)', () => {
  it('fuso horário padrão configurado é America/Sao_Paulo', () => {
    expect(FUSO_HORARIO).toBe('America/Sao_Paulo');
  });

  it('dataHoraLocal converte ISO UTC para fuso de São Paulo (UTC-3)', () => {
    // 21:00 UTC em 02/11/2026 deve ser 18:00 em São Paulo
    const isoUtc = '2026-11-02T21:00:00.000Z';
    const formatado = dataHoraLocal(isoUtc);
    expect(formatado).toContain('18:00');
    expect(formatado).toMatch(/02\/11\/2026/);
  });

  it('horaMinutoLocal retorna HH:mm em São Paulo', () => {
    const isoUtc = '2026-11-02T21:30:00.000Z';
    expect(horaMinutoLocal(isoUtc)).toBe('18:30');
  });

  it('formatarInicioAgenda retorna hora formatada em SP ou fallback', () => {
    expect(formatarInicioAgenda('2026-11-02T20:15:00.000Z', 101)).toBe('17:15');
    expect(formatarInicioAgenda(undefined, 101)).toBe('101');
    expect(formatarInicioAgenda('', 102)).toBe('102');
  });

  it('tratamento seguro de valores nulos ou inválidos', () => {
    expect(dataHoraLocal(null)).toBe('—');
    expect(dataHoraLocal(undefined)).toBe('—');
    expect(dataHoraLocal('data-invalida')).toBe('data-invalida');
    expect(horaMinutoLocal(null)).toBe('--:--');
    expect(horaMinutoLocal('invalido')).toBe('--:--');
  });

  it('hora() formata milissegundos respeitando São Paulo', () => {
    const timestamp = new Date('2026-11-02T19:00:00.000Z').getTime();
    expect(hora(timestamp)).toContain('16:00');
  });
});
```

---

## 5. Verification Method (Método de Verificação Independente)

Após a implementação dos patches pelo Worker, execute as seguintes etapas no terminal:

1. **Executar Verificação de Tipos TypeScript**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm run tipos
   ```
   *Condição de Sucesso*: Código de saída 0 sem erros de tipos.

2. **Executar a Suíte Completa de Testes**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm test
   ```
   *Condição de Sucesso*: 5 suítes aprovadas (incluindo `tests/formato.test.ts`), 100% dos testes passando.

3. **Verificação Específica de Formato e Fuso**:
   ```bash
   cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npx jest tests/formato.test.ts
   ```

4. **Critérios de Invalidação**:
   - Se `/usuarios` ou `/dono` carregar dados para um usuário sem `perfil === 'GERENCIA'`, a guarda RBAC falhou.
   - Se o operador logado visualizar o botão "Bloquear" em seu próprio card em `/usuarios`, a proteção contra auto-bloqueio falhou.
   - Se a tela de criação ou troca de senha permitir envio com senhas divergentes nos dois campos, a validação de confirmação falhou.
   - Se a tela de histórico continuar instanciando nós estáticos via `ScrollView.map()` em vez de nós virtuais via `FlatList`, a virtualização falhou.
   - Se horários de baterias da agenda ou auditoria continuarem usando UTC sem deslocamento para o fuso `America/Sao_Paulo`, a correção de fuso falhou.
