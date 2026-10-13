# Shell operacional (a moldura de todo app de operação)

Vale para Cronometragem, Recepção e admin web (tema claro).

```
┌──────────────────────────────────────────────────────────────────────────┐
│ CABEÇALHO 62–64: [logo] Nome do app │ menus/passos │ conexão · usuário     │ fixo
├────────────┬─────────────────────────────────────────────────────────────┤
│ LATERAL    │ TÍTULO DA ÁREA (titulo-grande 22) + subtítulo     [Primária] │
│ (navegação │ barra de filtros / ferramentas                               │
│  ou árvore)│ ┌ cartão ─────────────────┐ ┌ cartão ───────────────────────┐ │ rola
│ 280–340    │ │                         │ │                               │ │
│            │ └─────────────────────────┘ └───────────────────────────────┘ │
├────────────┴─────────────────────────────────────────────────────────────┤
│ BARRA DE STATUS 32: hora · PC · conexões · versão                         │ fixa
└──────────────────────────────────────────────────────────────────────────┘
```

## Regras
1. Cabeçalho, lateral e barra de status **não rolam**; só o conteúdo.
2. Toda área tem título visível e **uma** ação primária no canto superior direito.
3. Fundo `cor.fundo.app`; conteúdo em [cartões](../03-componentes/cartao.md); margem 24.
4. Abrir o app volta para a última área usada (por PC), nunca para uma tela vazia.
5. Conexão caída → [banner](../03-componentes/aviso-banner-toast.md) no topo do conteúdo + ações dependentes desabilitadas com dica.
6. Janela abre **maximizada** no monitor onde estava; mínimo 1280×720 ([responsividade](../01-fundamentos/responsividade.md)).
7. Atalhos globais listados no menu Ajuda (Crono: F1 verde, F2 amarela, F3 vermelha, F4 quadriculada, F5 finalizar,
   F6 limpar passagens, F7 branca, F8–F10 páginas do painel, Shift+F8–F10 páginas do telão, F11 abrir TV).

## Por app
| App | Lateral | Cabeçalho |
|---|---|---|
| Cronometragem | árvore de baterias do dia | passos 1 Bateria → 2 Pilotos → 3 Corrida + bandeiras |
| Recepção | áreas (Caixa, Clientes, Agenda, Relatórios…) | barra de ferramentas com todos os botões visíveis |
| Admin web | módulos (`navigation.ts`) | título do módulo + usuário |
