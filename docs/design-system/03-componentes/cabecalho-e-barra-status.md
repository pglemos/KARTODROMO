# Cabeçalho e barra de status

**Status:** canônico · **Tema:** claro (operação)

## Cabeçalho do app
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [logo] Cronometragem │ Arquivo  Bateria  Ajuda │ (1 Bateria)─(2 Pilotos)─(3 Corrida) │ [●On-line] [👤 Ana] │
└──────────────────────────────────────────────────────────────────────────────┘
 altura 62–64 · superficie.padrao · borda inferior sutil
```
Esquerda: logo + nome do app (`titulo` 17 negrito). Meio: menus ou passos/abas. Direita: estado da conexão,
usuário, ações globais. Se faltar espaço: os passos vão para uma segunda linha antes de qualquer item cortar.

### Barra de ferramentas (Recepção)
Botões-bloco 36 px com ícone + nome embaixo (`VisualPrincipal.BotaoBarra`). **Todos os botões visíveis** (sem "Mais
ações"); se faltar espaço, a barra quebra linha.

## Barra de status (rodapé do app)
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 17:42  ·  PC .53 Recepção  ·  ● Servidor  ● Crono  ○ Impressora   ·  v1.0.46 │
└──────────────────────────────────────────────────────────────────────────────┘
 altura 32 · superficie.suave · pequeno 12 · cor.texto.secundario
```
Cada conexão = **bolinha + nome** (verde ok, vermelho caiu, amarelo lento) e a dica diz desde quando e o que fazer.

## Comportamento
| Gatilho | Interface | Efeito |
|---|---|---|
| Clique no indicador de conexão | abre o diagnóstico (último contato, endereço, "Tentar reconectar") | — |
| Conexão cai | bolinha vermelha + [banner](aviso-banner-toast.md) no topo do conteúdo | ações que dependem dela ficam desabilitadas com dica |
| Clique na versão | mostra o que mudou (changelog) | — |
| Clique no usuário | menu: trocar usuário, sair | — |

## Implementação
WinForms: cabeçalho próprio de cada app (Crono `PassosSegmento`, Recepção `VisualPrincipal`), status `SeloTerminal`
(Recepção) — unificar `CabecalhoApp`/`BarraStatus` em `Kartodromo.Comum` (fase 1). Web admin: `AdminShell`.
Totem: `CabecalhoTotem` — travado.
