# Design System do Kartódromo Internacional de Betim

**Guia único** para TODA tela do sistema: site público, admin web, Cronometragem, Recepção, totem de
autoatendimento, telão, tablet do sorteio e páginas servidas pela cronometragem. Se uma tela não segue este guia, ela
está errada, não o guia. Para mudar o guia, siga [08-governanca/como-propor-mudanca.md](08-governanca/como-propor-mudanca.md).

> Regra de ouro: **nenhuma cor, fonte, tamanho, espaço, raio, sombra ou duração escrita direto no código.**
> Tudo vem dos tokens em [`tokens/kib.tokens.json`](../../tokens/kib.tokens.json) (gerados com `npm run tokens`).
> O `npm run lint:design` reprova código novo que escreva valor solto.

## Uma marca, dois temas

| Tema | Para quem | Onde | Marca/ação |
|---|---|---|---|
| **Claro** (operação) | quem trabalha: cronometrista, recepção, gerência | Cronometragem, Recepção, admin web, relatórios e páginas de operação da cronometragem | verde `#0B7A53` |
| **Escuro** (público) | piloto, cliente, plateia | site, totem, telão, tablet do sorteio, TV do briefing | neon `#00E676` |

Detalhes em [00-fundacao/dois-temas.md](00-fundacao/dois-temas.md).

## Como usar este guia

| Vou… | Leia |
|---|---|
| criar ou mudar uma tela | [04-padroes-de-tela](04-padroes-de-tela/) → [03-componentes](03-componentes/) → [06-handoff/_modelo-especificacao-tela.md](06-handoff/_modelo-especificacao-tela.md) → [08-governanca/aceite-de-tela.md](08-governanca/aceite-de-tela.md) |
| escolher cor/fonte/espaço | [01-fundamentos](01-fundamentos/) e a [referência de tokens](02-tokens/referencia.md) |
| criar um componente | [03-componentes/_modelo.md](03-componentes/_modelo.md) e [07-arquitetura/onde-vivem-componentes.md](07-arquitetura/onde-vivem-componentes.md) |
| organizar pastas, nomes e rotas | [07-arquitetura](07-arquitetura/) |
| especificar uma funcionalidade | [09-produto/modelo-prd.md](09-produto/modelo-prd.md) + handoff |
| auditar uma tela | [08-governanca/auditoria-ux-ui.md](08-governanca/auditoria-ux-ui.md) |
| abrir um PR | [08-governanca/checklist-pr.md](08-governanca/checklist-pr.md) |

## Hierarquia (do mais geral ao mais específico)

```
00 Fundação        identidade, dois temas, princípios, heurísticas de usabilidade
01 Fundamentos     cor · tipografia · espaço · grid · raio · borda · elevação · movimento · ícones · acessibilidade · responsividade · texto
02 Tokens          a fonte única dos valores (primitivo → semântico → componente)
03 Componentes     botão, campo, tabela, modal… (anatomia, estados, clique, teclado, por plataforma)
04 Padrões de tela shell, lista com filtros, formulário, diálogo, tela ao vivo, relatório, totem, estados vazios
05 Plataformas     como aplicar em WinForms, Next.js, timing-ui, Android, totem
06 Handoff         como especificar cada tela e cada clique
07 Arquitetura     pastas, nomes, rotas, onde vive cada componente, proibição de hardcode, refatoração
08 Governança      mudança, checklist de PR, aceite de tela, auditoria UX/UI, changelog
09 Produto         modelo de PRD, PRD do próprio design system
10 Inventário      divergências atuais, componentes existentes, relatório de hardcode, auditoria inicial
```

Quando dois documentos conflitarem, vale o de número **menor** (fundação > fundamentos > … > inventário), e os
**tokens** valem sobre qualquer texto.

## Status (08/10/2026)

- [x] Tokens únicos + gerador (CSS, C#, Kotlin, XML Android, referência) + verificação de contraste.
- [x] Verificador de hardcode com catraca (`npm run lint:design`) e relatório.
- [x] Documentação completa (este guia).
- [x] Fase 1 (parte 1): componentes canônicos no desktop e mensagens no visual do sistema — ver [refatoração](07-arquitetura/refatoracao-proposta.md).
- [x] Fase 3 (parte 1): Cronometragem nos tokens sem mudar pixel, melhor volta com marcador, confirmações destrutivas.
- [x] Fase 5: páginas da cronometragem (operador, admin, resultado, equalização) nos tokens, tema claro.
- [ ] Migração das telas por fases — ver [07-arquitetura/refatoracao-proposta.md](07-arquitetura/refatoracao-proposta.md).

As telas continuam com os mesmos valores (nomes antigos preservados); só as **mensagens/perguntas** dos apps nativos ganharam o visual novo.

## Comandos

```bash
npm run tokens                # gera styles/tokens.css, timing-ui/tokens.css, Tokens.g.cs, Tokens.kt, cores_tokens.xml, referência
npm run tokens:check          # falha se algum gerado estiver desatualizado (CI)
npm run lint:design           # falha se houver cor/fonte NOVA fora dos tokens (CI)
npm run lint:design:relatorio # atualiza 10-inventario/hardcode-relatorio.md
npm run lint:design:baseline  # registra a contagem depois de uma migração que reduziu o hardcode
```

## Documentos relacionados

- [`DESIGN.md`](../../DESIGN.md) — descrição do tema público "Pit Lane Noturno" (os valores oficiais agora são os tokens).
- [`PRODUCT.md`](../../PRODUCT.md) — visão de produto (ainda cita o LapTime/MyLapTime; ver [09-produto/prd-design-system.md](09-produto/prd-design-system.md)).
- [`docs/brandbook-kartodromo.md`](../brandbook-kartodromo.md) — **substituído** por [00-fundacao/identidade-visual.md](00-fundacao/identidade-visual.md).
- `desktop/design-aprovado/*.dc.html` — canvas aprovado das telas desktop (referência visual por tela).
- `design-source/*.dc.html` — protótipos do site/admin (fonte do `npm run sync:design`).
