# Rotas e telas

## Site e admin (Next.js na Cloudflare)
| Rota | Tema | O quê |
|---|---|---|
| `/[[...slug]]` | escuro | site público (home, pistas, eventos, campeonatos, reservas…) |
| `/login` | escuro | login do clube |
| `/admin` | claro | painel |
| `/admin/[module]` | claro | módulos: reservas, recepcao, lanchonete, cronometragem, campeonatos, resultados, telao, financeira, clientes, equalizacao, administrativa, clube (`components/admin/navigation.ts`) |
| `/admin/resultados/[racingId]` | claro | resultado de uma bateria |
| `/admin/equalizacao/[kartId]` | claro | histórico de um kart |
| `/admin/login` | claro | login do admin |
| `/telao`, `/placar-telao`, `/placar-telao-tb50`, `/podio-final-tb50`, `/podio-live-tb50`, `/designer-telao` | congelado | telão |

APIs (`app/api/…`): `admin/*` (login, logout, clientes, campeonatos, db, equalizacao, laptime, calxpro), `inscricao`,
`livetime`, `livetime-snapshot`, `tb50-*`, `telao-*`, `viplex-programs`.

Subdomínios: `reservas.kartodromodebetim.com.br` (reserva online), `cadastro.kartodromodebetim.com.br` (pré-cadastro QR).

## Servidor de cronometragem (`services/timing-server.ts`, ORBITS :4050; simulador :4153)
| Página | Arquivo |
|---|---|
| `/`, `/operador` | `timing-ui/operador.html` |
| `/equalizacao` | `equalizacao.html` |
| `/sorteio` | `sorteio.html` |
| `/tv`, `/tb50` | congelado |
| `/tokens.css` | tokens gerados |
| `/healthz` | saúde |

APIs: `/api/state`, `/api/sessions`, `/api/events`, `/api/settings` (+ `decoder`), `/api/transponders`, `/api/catalog`
(+ backups/export/import), `/api/equalizacao` (+ metas, regras), `/api/ranking-karts`, `/api/ranking-peso`,
`/api/clientes`, `/api/agenda`, `/api/empresa`, `/api/crono/*`, `/api/email-config`, `/api/backup`, `/api/sorteio/ultimo`,
`/api/painel-led-page`, `/api/tb50-*`, `/api/livetime-snapshot`.

## Servidor de operação (`services/ops-server.ts`, SRVKART :4060)
Recepção, totem, caixa, impressão, espelho de clientes. Reiniciar só fora do horário com a fila de impressão vazia.

## Apps nativos — mapa de telas
| App | Entrada | Telas principais |
|---|---|---|
| Cronometragem | `FormCrono` | passos Bateria → Pilotos → Corrida; Cadastros, Catálogo, Competidores, Equalização, Penalidades, Ranking, Relatórios, Segurança, E-mail, TV (`FormTV`, congelada) |
| Recepção | `FormLogin` → `FormPrincipal` | Caixa (`FormCheckout`, `FormVenda`, `FormEstorno`, terminal abrir/fechar), Clientes (`FormCliente`), Agenda, Baterias, Vouchers, Relatórios |
| Totem | `FormTotem` | Identificação → Cadastro / Menores → Baterias → Sucesso |

Todo novo item de menu, rota ou tela entra nesta página e no [inventário](../10-inventario/componentes-existentes.md).
