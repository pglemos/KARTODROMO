# Estrutura de pastas

## Hoje (`C:\repos\KARTODROMO`)

```
tokens/                     ★ fonte única de design (kib.tokens.json) + baseline do lint
scripts/design-tokens/      ★ gerador, contraste, lint de hardcode
docs/design-system/         ★ esta documentação
styles/tokens.css           ⚙ gerado

app/                        Next.js (App Router): site público [[...slug]], admin/, api/, telão
components/admin/           shell e navegação do admin
src/                        site público (componentes React, site-ui/, legado Vite: main.tsx, App.tsx, index.css)
lib/                        regras de negócio TypeScript (timing/, equalizacao/, admin-*, telao-*)
services/                   servidores Node: timing-server.ts (:4050/:4153 simulador), ops-server.ts (SRVKART :4060),
                            timing-ui/ (HTML servido pelo timing-server), ops-ui/, smtp-ponte/
workers/                    Cloudflare Workers
desktop/src/                apps .NET: Kartodromo.Comum, .Cronometragem, .Recepcao, .Autoatendimento
desktop/tests/              testes .NET
android/sorteio/            app do tablet (Kotlin/Compose)
tests/                      testes Vitest (inclui tests/design-tokens/)
migrations/, supabase/      banco
design-source/, public/design/  desenhos aprovados (canvas) — referência, não código
data/, publish/, scratch/   locais — NUNCA versionar/enviar
```

## Regras
1. **Design**: valor visual só nasce em `tokens/kib.tokens.json`. Arquivos marcados ⚙ são gerados.
2. **Componentes compartilhados** ficam no lugar comum de cada plataforma ([onde-vivem-componentes](onde-vivem-componentes.md));
   uma tela não define cor, fonte ou botão próprio.
3. **Regra de negócio** fica em `lib/` (TS) ou no servidor; a tela só chama e mostra. Nada de cálculo de classificação,
   preço ou penalidade dentro de formulário.
4. Arquivo de tela grande (> 1.500 linhas) se divide por assunto em `partial` (`FormCrono.AoVivo.cs`, `.Equalizacao.cs`…).
5. Pastas novas em português, minúsculas com hífen (web) ou PascalCase (C#).

## Alvo (depois das fases de migração)
```
src/                         (site) → absorvido por app/ + components/site/ (fase 8)
components/
  ui/                        Botao, Campo, Tabela, Dialogo, Selo, Toast, EstadoVazio… (com --kib-*)
  site/                      componentes do público (escuro)
  admin/                     shell + módulos (claro)
desktop/src/Kartodromo.Comum/Design/   Botao, Campo, TabelaDesign, DialogoDesign, Selo, Toast, Banner, EstadoVazio
```
