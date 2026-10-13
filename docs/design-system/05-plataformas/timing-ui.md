# Páginas do servidor de cronometragem (timing-ui)

HTML estático servido por `services/timing-server.ts` a partir de `services/timing-ui/`.

| Página | Tema | Uso |
|---|---|---|
| `operador.html` | claro | operação auxiliar |
| `admin.html` | claro | configuração do servidor |
| `resultado.html` | claro (impressão) | resultado da bateria, PDF, e-mail |
| `equalizacao.html` | claro (impressão) | relatório de equalização para a oficina |
| `sorteio.html` | escuro | tela do sorteio |
| `tv.html`, `tb50.html` | congelado | telão — **não** importar `tokens.css` |

## Tokens
O servidor entrega `GET /tokens.css` (gerado em `services/timing-ui/tokens.css`).
```html
<html lang="pt-BR" data-tema="claro">
<link rel="stylesheet" href="/tokens.css">
```
Use só `var(--kib-*)`. As classes (`.btn`, `.primary`, `.danger`, `.panel`, `.field`, `.b-blue`, `.rdlc-table`…) mantêm os
nomes; os valores vêm dos tokens desde a fase 5 (08/10/2026).

**Relatórios** (`resultado.html`, `equalizacao.html`) abrem também dentro dos apps e na impressão: use o token **com
reserva**, `var(--kib-cor-acao-principal, #0B7A53)`, para a página não perder as cores se o `/tokens.css` não estiver no
servidor. Ao instalar no ORBITS, copie juntos `services/timing-server.ts` (rota `/tokens.css`) e a pasta `timing-ui`.

## E-mail do resultado
O resultado é enviado **automaticamente** aos pilotos quando a bateria é finalizada (`services/timing-email.ts`).
O HTML do e-mail usa cores **literais** (clientes de e-mail não leem variáveis CSS): copie os valores de
`docs/design-system/02-tokens/referencia.md` e marque a linha com `design-lint-ignore: e-mail não suporta var()`.

## Reiniciar o servidor
Só sem bateria em andamento (`runningId` vazio).
