# Uma marca, dois temas

Todo token semântico tem **dois valores**: um para o tema **claro** (operação) e outro para o **escuro** (público).
O nome é o mesmo; a tela escolhe o tema, nunca a cor.

## Qual tema cada parte usa

| Parte do sistema | Tema | Onde está | Situação |
|---|---|---|---|
| Cronometragem (app nativo) | Claro | `desktop/src/Kartodromo.Cronometragem` | migrar (fase 3) |
| Recepção (app nativo) | Claro | `desktop/src/Kartodromo.Recepcao` | migrar (fase 2) |
| Admin web | Claro (escuro opcional pelo botão sol/lua — decidido 10/10/2026) | `app/admin`, `components/admin`, `styles/admin.css` | migrar (fase 4) |
| Páginas de operação da cronometragem | Claro | `services/timing-ui/{operador,admin,equalizacao,resultado}.html` | migrar (fase 5) |
| Relatórios impressos / PDF | Claro (P&B legível) | `resultado.html`, `lib/timing/email-resultado.ts` | migrar (fase 5) |
| Site público e clube | Escuro | `app/[[...slug]]`, `design-source/`, `src/` | migrar (fase 8) |
| Totem de autoatendimento | Escuro | `desktop/src/Kartodromo.Autoatendimento` | **visual aprovado e congelado** (fase 6 só troca a origem dos valores) |
| Tablet do sorteio (Android) | Escuro | `android/sorteio` | migrar (fase 7, muda o verde: requer aprovação) |
| TV do briefing (sorteio) | Escuro | `services/timing-ui/sorteio.html` | migrar (fase 5) |
| Telão TB50 / placar / TV ao vivo | Escuro (paleta própria do telão) | `FormTV.cs`, `tv.html`, `tb50.html`, `app/telao`, `app/placar-telao*`, `app/podio-*` | **congelado**: não mexer |

## Como aplicar o tema

| Plataforma | Claro | Escuro |
|---|---|---|
| Web (CSS) | `<html data-tema="claro">` ou classe `.kib-tema-claro` | padrão (`:root`) ou `data-tema="escuro"` |
| WinForms | `Tokens.Claro.CorAcaoPrincipal` | `Tokens.Escuro.CorAcaoPrincipal` |
| Android (Compose) | `Tokens.Claro.*` | `Tokens.Escuro.*` |
| timing-ui | `<link rel="stylesheet" href="/tokens.css">` + `data-tema="claro"` | idem com `data-tema="escuro"` |

## O que é igual nos dois temas

- **Nomes** de todos os tokens.
- **Espaçamento** (grade de 8), **tamanhos** de fonte, **alturas** de controle, **durações** de movimento.
- **Cores de domínio** da pista (bandeiras, ouro do pódio, amarelo de posição).
- **Regras** de componente, de clique, de teclado e de acessibilidade.

## O que muda

Cores de superfície, texto, borda, ação e estado; família de fonte de interface (Segoe UI × Rajdhani) e de destaque
(Segoe UI negrito × Anton); raios (claro um pouco mais arredondado: campo 9 / escuro 8); sombras (o escuro usa mais
superfície e borda que sombra).

## Regra de mistura

Uma tela tem **um** tema. Exceção permitida: um painel inverso dentro do claro (ex.: faixa "ao vivo" escura, painel do
troco) usa `cor.superficie.inversa` + `cor.texto.inverso` — não troque o tema da tela inteira por isso.
