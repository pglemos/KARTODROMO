# Matriz de alinhamento (31/10/2026)

Três versões: snapshot da produção (`snapshot/producao-2026-10-31`), `origin/main` (`cb9e78d`) e desenvolvimento (`f5108f6`).

**Correção do G0:** `origin/main` já contém "Estado em produção no ORBITS em 30/10/2026" e "Main alinhada ao SRVKART". A produção não está tão distante quanto parecia: diverge do GitHub só no que mudou depois disso. O desenvolvimento (`f5108f6`) está 16 commits atrás e 4 à frente de `origin/main`, e os 200+ pendentes locais não entram aqui.

**Correção do G0:** a porta 4060 do `ops-server` não está em escuta no ORBITS. O servidor de operação parece rodar no SRVKART, então `lib/ops` e `services/ops-server.ts` do ORBITS **não são o código em execução**. O SRVKART não foi inspecionado.

| Área | Decisão | Motivo |
|---|---|---|
| Painel LED (`PainelLed.cs`, `FormCrono*.cs`, rota `atualizar`) | Produção | Correções de 31/10 só nela |
| SSE leve (`/api/events?leve=1`) | Produção | Só nela; usado pelo programa |
| `Caixa.cs`, `FormCliente.cs`, `Ui.cs`, `Atualizacao.cs` e outros do Windows | Produção | Versão instalada 1.0.93 |
| `Directory.Build.props` | GitHub, com versão 1.0.93 | Produção tem acentos corrompidos |
| `lib/timing`, `timing-email`, resto do `timing-server` | GitHub | Só limpeza de lint, mesmo comportamento |
| `lib/ops`, `services/ops-server.ts`, `scripts/ops` | GitHub | Não rodam no ORBITS |
| `workers/*` | GitHub | Não rodam no ORBITS; validação da cópia da produção quebra 22 testes |
| Testes em conflito | GitHub | Combinam com o código escolhido |
| Kart alfanumérico, largada parada | Fora | Só em desenvolvimento; mudam comportamento |

## Para o dono decidir
A cópia em produção de `workers/pre-cadastro/src/validar.ts` torna obrigatórios e-mail, peso, endereço, bairro e cidade na reserva do site, e traz cadastro completo de acompanhante. Não é o que está no GitHub. **Não sei qual está publicado na Cloudflare.** O conteúdo está preservado na branch do snapshot.
