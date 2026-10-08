# Superfície Nativa do Aplicativo de Cronometragem (WinForms)

> **Documento de Referência:** Descreve os componentes, comportamentos de interface, atalhos de teclado, acessibilidade e adaptações de resolução do aplicativo Windows nativo `Kartodromo.Cronometragem.exe`.

---

## 1. Arquitetura da Interface

O aplicativo é desenvolvido em **C# / .NET 8 com Windows Forms** nativo, respeitando as diretrizes visuais do sistema e as restrições operacionais da pista:
- **Tema:** Dark mode de alto contraste no painel ao vivo e light mode corporativo nas abas de cadastro, eventos e equalização.
- **Não há uso de Chromium/WebView2/Electron:** renderização puramente GDI+/Windows Forms.
- **Telão e TV:** Operados em processo e formulário separados (`FormTV` / `--tv`), não alterados por esta suíte.

---

## 2. Acessibilidade e Navegação por Teclado [F33, F34, F37]

### Componentes Personalizados com Acessibilidade Nativa
- **`TabelaDesign`:**
  - `AccessibleRole = AccessibleRole.Table`.
  - Expõe linhas como `LinhaAccessibleObject` e células legíveis para leitores de tela do Windows.
  - **Setas Cima / Baixo:** navega entre as linhas da tabela.
  - **Espaço:** em tabelas com coluna de marcação (`Marca: true`), alterna a marcação (0 ↔ 1) e dispara o evento `MarcaMudou`.
  - **Enter:** ativa o modo de edição na linha atual ou aciona a ação primária associada.
  - `TabStop = true`: recebe foco por tabulação ordenada.

- **`BotaoQuadrado` (Botões de Ação Rápida e Ícones):**
  - `AccessibleRole = AccessibleRole.PushButton`.
  - `AccessibleName`: preenchido com a dica do botão (`Dica`), informando claramente sua finalidade.
  - **Enter / Espaço:** dispara o evento `Click` do botão uma única vez.
  - **Foco Visual:** desenha moldura com borda destacada em verde (`#0B7A53`) quando focado via teclado.
  - `TabStop = true`: participa da cadeia de foco do formulário.

- **Seleção em Cascata de Eventos e Grupos:**
  - Suporta navegação pelas setas do teclado na grade de Eventos (`_gEventos`) e na grade de Grupos (`_gGrupos`).
  - O evento `SelectionChanged` detecta a nova seleção e recarrega os dados dependentes (grupos e provas) sem recursão nem estouro de pilha, utilizando controle de reentrância por flag (`_carregandoCatalogo`).

---

## 3. Resoluções e Layout Adaptativo [F28, F29, F30, F31, F32, F43]

O aplicativo foi calibrado para operar perfeitamente em:
- **Resolução Base:** 1366 × 768 px (monitores padrão de torre de cronometragem).
- **Resoluções Altas:** 1920 × 1080 px e superiores.
- **Escalas de DPI:** 100%, 125%, 150% e 200%.

### Adaptações Implementadas
1. **Diálogos Modais (`CartaoModal` e `DialogoDesign`):**
   - Calculam dinamicamente a área útil disponível na tela através de `Screen.FromControl(this).WorkingArea`.
   - Limitam a altura máxima subtraindo 32 px de margem, impedindo que rodapés com botões críticos ("Salvar", "Confirmar", "Cancelar") fiquem cortados fora da tela.
   - Adicionam barra de rolagem vertical automática (`AutoScroll = true`) no painel central de conteúdo mantendo o cabeçalho e o rodapé fixos.
2. **Grade de Resultados:**
   - Habilitada rolagem horizontal (`ScrollBars = ScrollBars.Both`) para garantir que as colunas de Tempo, Voltas e Penalidades sejam acessíveis em monitores menores ou grades com muitas colunas.
3. **Legenda de Resultados:**
   - Quebra automática em 2 linhas quando a largura disponível for inferior a 860 px, assegurando que todos os marcadores (inclusive "■ melhor volta da prova") permaneçam visíveis sem estourar o painel.
4. **Painel de Eventos e Passos 1–3:**
   - Proporções das colunas balanceadas (35% Eventos, 25% Grupos, 40% Provas).
   - O botão "Próximo: competidores →" é ancorado à direita no rodapé com rolagem interna das ações, eliminando colisões com "Distribuir" e "Imprimir".

---

## 4. Visualização e Emissão de Relatórios [F16, F23, F35, F36, F39, F40, F41]

- **Janela Nativa `FormRelatoriosCrono`:**
  - Filtros sincronizados em cascata: Data da Sessão → Evento → Grupo → Prova.
  - Conversão transparente de identificadores internos para nomes legíveis de categorias.
  - Sobrescrita de traçado: exibe o traçado específico configurado na prova sobrepondo o traçado padrão do evento.
- **Relatório de Ranking por Peso:**
  - Utiliza o visualizador nativo `Relatorio.Abrir(this, arq, "Ranking por peso")`.
- **Gerador de Cards para Redes Sociais (Instagram):**
  - Abrange integralmente as 4 faixas de peso cadastradas.
  - Cabeçalho devidamente rotulado como "TODOS OS TEMPOS" quando a opção de período histórico total estiver selecionada.
