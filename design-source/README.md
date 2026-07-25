# design-source — fonte de verdade do design

Exportação intacta do bundle Claude Design (`kartodromo-handoff.zip`, projeto
`Páginas de campeonatos`). São 34 protótipos `.dc.html` + os scripts compartilhados.

**Não edite `public/design/` à mão.** Aquele diretório é gerado:

```bash
npm run sync:design
```

O gerador (`scripts/sync-design.mjs`) aplica somente o que é necessário para servir
os protótipos nas URLs reais do site:

1. `<base href="/">`;
2. troca `pagina.dc.html` pela rota pública correspondente;
3. mantém a URL limpa via `history.replaceState`;
4. entradas `Locação` e `BENEFÍCIOS` na navegação pública;
5. camada `mobile-fit` (`@media (max-width: 720px)`) — os protótipos são
   desktop-only e sem ela o conteúdo é cortado no celular. Acima de 720px o
   resultado é idêntico ao protótipo.

Nenhum ajuste visual de cor, tipografia, espaçamento ou composição entra aqui.
Para mudar o design, altere no Claude Design, reexporte o bundle, substitua estes
arquivos e rode `npm run sync:design`.

`npm test` falha se `public/design/` divergir desta pasta (`npm run check:design`).
