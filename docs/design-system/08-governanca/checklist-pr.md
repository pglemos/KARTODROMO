# Checklist de PR com interface

Copie no PR e marque.

## Design
- [ ] Nenhuma cor, fonte ou tamanho novo fora dos tokens (`npm run lint:design` passa).
- [ ] Se mudou token: `npm run tokens` rodado, `tokens:check` passa, changelog atualizado.
- [ ] Componentes do design system usados (nada de botão/tabela/diálogo próprio).
- [ ] Espaços múltiplos de 8 (4 como meio passo); alturas 32/40/48.
- [ ] Tema certo: operação = claro; público = escuro.
- [ ] Telão e totem intocados (salvo pedido explícito).

## Comportamento
- [ ] Toda interação está na especificação da tela ([handoff](../06-handoff/como-especificar.md)).
- [ ] Estados: carregando, vazio, erro, sem permissão, off-line.
- [ ] Ação destrutiva com confirmação nomeando o item; nada parcial gravado em erro.
- [ ] Enter = ação principal, Esc = cancelar; foco inicial certo.
- [ ] Fim de bateria continua manual.

## Acessibilidade
- [ ] Navegável só com teclado, foco visível.
- [ ] Nada informado só por cor.
- [ ] Botões só-ícone com nome acessível e dica.
- [ ] Contraste ≥ 4,5:1 texto / 3:1 bordas e ícones.

## Responsividade
- [ ] Fotos do autoteste em 1920×1080, 1366×768 e **1280×720** sem corte nem sobreposição (desktop).
- [ ] 360 / 768 / 1440 sem rolagem horizontal da página (web).

## Texto
- [ ] Português do Brasil, termos do glossário, botões verbo + objeto, erros dizem o que fazer.

## Segurança e entrega
- [ ] Nenhum segredo no código (repositório público).
- [ ] `dotnet build` sem avisos / `npm test`, `typecheck`, `lint`.
- [ ] Desktop: `dotnet publish` feito antes de instalar; instalação fora do horário.
