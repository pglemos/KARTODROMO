# Spec — Formatos de Corrida & Regras Configuráveis (Cronometragem, Campeonatos, Resultados)

Data: 2026-08-23
Status: **Implementado** (commits `3e146b2` spec/migration, `575c1ee` feature, seguindo-se desempates)
Relacionados: `2026-07-20-public-site-production-stabilization-design.md`, migration `0006_kart_equalizacao.sql`

> **Desvios aceitos na implementação final:**
> 1. Critérios de desempate `menos_punicoes` e `mais_poles` comparam neutros (dados não agregados localmente; punições vivem no LapTime).
> 2. A página de detalhe LapTime (`/admin/resultados/[racingId]`) mantém renderização integral dos dados reais da cronometragem — o condicionamento por formato aplica-se aos painéis administrativos (Ao Vivo/Sessões), que são governados pelo regulamento local.
> 3. Bônus de pole usa o vencedor quando o formato define grid via TT sem corrida de TT publicada; com corrida de TT publicada, pole = 1º colocado dela.

---

## 1. Contexto e problema

O Kartódromo Internacional de Betim opera **vários tipos de corrida**, e o sistema atual trata tudo como se fosse igual:

| Regra | Onde está hoje | Problema |
|---|---|---|
| Tabela de pontos `[25,18,15,12,10,8,6,4,2,1]` | constante `POINTS_BY_POSITION` (`src/admin/modules/cronometragem/cronometragem.api.ts:26`) | Igual para todos os campeonatos |
| Parada obrigatória (11× ≥7min, janela boxes) | fallback fixo no código (`cronometragem.api.ts:147`) e textos fixos na UI (`CronometragemPage.tsx:1048`, `:1321`) | Não existe no banco; aparece mesmo quando o campeonato não tem parada |
| Critério de classificação (melhor tempo vs. posição) | decidido implicitamente em `gerarResultados` (`cronometragem.api.ts:402`) | Não configurável nem auditável |
| Formato (TT + corrida / TT puro / endurance) | **inexistente** — schema `0001_admin_schema.sql` não tem nenhuma coluna de regra | Impossível diferenciar campeonatos/eventos |

## 2. Princípios levantados com o operador

1. **Padrão do dia a dia (Betim):** tomada de tempo (~5 min) cujo melhor tempo monta o grid → corrida normal (~20 min ou menos, duração definida automaticamente pela cronometragem), **sem parada obrigatória**, com punições normais.
2. **Punições são aplicadas em tempo real pelo cronometrista diretamente no LapTime** (ex.: +5:00 por não cumprir parada obrigatória). O sistema local **nunca calcula punição** — apenas exibe o que vier da cronometragem. O cálculo de "voltas de punição" existente hoje é exclusivo de provas de endurance e passa a ser parâmetro de formato, não comportamento fixo.
3. **Não existe parâmetro global.** Configurações diferentes (traçado, regulamento, paradas, penalidades) são definidas por evento ou campeonato; na maioria dos dias o padrão serve.
4. **Pontuação é totalmente configurável por campeonato** (tabela por posição + bônus como premiação da pole / melhor volta).
5. No formato misto, **a TT define o grid** e normalmente não pontua; quando o regulamento prevê, pode pontuar/premiar separadamente.
6. Cada sessão/corrida individual pode divergir do padrão do seu campeonato ("nem todas as corridas são iguais").

## 3. Modelo de dados

### 3.1 Nova tabela `formatos_corrida` (biblioteca de templates)

Colunas explícitas (não blob opaco) para caber no CRUD genérico `admin-d1` e permitir filtros:

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| `id` | TEXT PK | uuid | |
| `nome` | TEXT NOT NULL | | Ex.: "Padrão Betim — TT + Corrida sem parada" |
| `descricao` | TEXT | | Uso pretendido |
| `tt_habilitada` | INT 0/1 | 1 | Tem fase de tomada de tempo? |
| `tt_duracao_min` | INT NULL | 5 | Informativa (duração real vem do LapTime) |
| `tt_define_grid` | INT 0/1 | 1 | TT ordena o grid da corrida |
| `tt_pontua` | INT 0/1 | 0 | TT gera resultado/classificação própria com pontos |
| `corrida_duracao_min` | INT NULL | 20 | Informativa |
| `paradas_habilitadas` | INT 0/1 | **0** | Liga/desliga TODA a UI de pit stops |
| `paradas_quantidade` | INT | 0 | Obrigatórias |
| `parada_tempo_minimo_ms` | INT NULL | NULL | Ex.: 420000 (7:00) |
| `boxes_abrem_apos_ms` | INT NULL | NULL | Janela dos boxes |
| `boxes_fecham_apos_ms` | INT NULL | NULL | |
| `paradas_adicionais_permitidas` | INT | 0 | |
| `punicoes_fonte` | TEXT | `'cronometragem'` | Sempre `cronometragem` (tempo real, LapTime). Reservado p/ futuro |
| `classificacao_fonte` | TEXT CHECK | `'corrida'` | `corrida` \| `melhor_tempo` \| `combinada` |
| `desempate` | TEXT NULL | `["melhor_volta","mais_voltas"]` | Ordem de critérios (JSON) |
| `is_default` | INT 0/1 | 0 | Usado quando nada está atribuído (único) |

**Seeds:**
1. **Padrão Betim** (`is_default=1`): TT 5min define grid sem pontuar · corrida 20min · sem paradas · classificação pela corrida.
2. **Tomada de Tempo pura**: sem corrida (`corrida_duracao_min=NULL`, `classificacao_fonte='melhor_tempo'`, `tt_pontua=1`).
3. **Endurance com Paradas Obligatorias**: `paradas_habilitadas=1`, 11× ≥7min, janela boxes, classificação pela corrida (punição chega pronta do LapTime).

### 3.2 Alterações nas tabelas existentes (migration `0007`)

```sql
ALTER TABLE campeonatos ADD COLUMN formato_id TEXT REFERENCES formatos_corrida(id);
ALTER TABLE campeonatos ADD COLUMN pontos_json TEXT;              -- tabela de pontos custom
ALTER TABLE campeonatos ADD COLUMN bonus_pole REAL DEFAULT 0;      -- premiação da pole (regulamento)
ALTER TABLE campeonatos ADD COLUMN bonus_melhor_volta REAL DEFAULT 0;
ALTER TABLE campeonatos ADD COLUMN descartes INTEGER DEFAULT 0;    -- piores resultados descartados

ALTER TABLE etapas   ADD COLUMN formato_id TEXT REFERENCES formatos_corrida(id); -- override pontual
ALTER TABLE sessoes  ADD COLUMN formato_id TEXT REFERENCES formatos_corrida(id); -- override final por sessão
ALTER TABLE corridas ADD COLUMN formato_id TEXT REFERENCES formatos_corrida(id); -- corridas manuais/importadas
```

### 3.3 Resolução de formato (herança)

Para qualquer sessão/corrida:

```
sessao.corrida.formato_id  →  etapa.formato_id  →  campeonato.formato_id  →  formato is_default=1
```

A UI sempre mostra **de onde veio o valor** ("Herdado de: KAC 2026" / "Override nesta sessão").

### 3.4 Pontuação por campeonato (`pontos_json`)

```jsonc
{
  "posicoes": { "1": 25, "2": 18, "3": 15, "4": 12, "5": 10, "6": 8, "7": 6, "8": 4, "9": 2, "10": 1 },
  "foraDoPodioDemais": 0            // opcional: pontos fixos além da última posição mapeada
}
```

Fallback: se `pontos_json` for nulo, usa `[25,18,15,12,10,8,6,4,2,1]` (comportamento atual). Bônus (`bonus_pole`, `bonus_melhor_volta`) somam ao piloto contemplado. `descartes` aplica no fechamento do campeonato (não altera histórico de `resultados.pontos`, que continua gravado por corrida).

## 4. Impacto por aba/tela

### 4.1 Campeonatos (`/admin/campeonatos`)
- **Nova sub-aba "Formatos & Regras"**: CRUD de `formatos_corrida` (novo recurso `formatos_corrida` no `admin-d1`) + editor visual da `pontos_json` do campeonato (grid posição→pontos, bônus, descartes).
- Formulário do campeonato ganha: select de formato padrão + botão "Editar pontuação".
- Etapas ganham campo opcional "Formato desta etapa (override)".

### 4.2 Cronometragem (`/admin/cronometragem`)
- **Ao Vivo:** colunas de paradas/punição só renderizam quando o formato da sessão/corrida atual tem `paradas_habilitadas=1`. Sem paradas → grid limpo estilo tomada de tempo. Quando o snapshot LapTime trouxer `rules` diferentes das configuradas → **badge amarelo "Divergência de regulamento"** com diff (config local vs. recebida). Textos fixos ("11", "7:00") passam a vir do formato.
- **Importar p/ sessão:** cria a sessão já com o formato resolvido.
- **Sessões:** formulário ganha select "Formato" (default: herdado, com indicação da origem). Card da sessão mostra resumo do regulamento.
- **Voltas:** inalterada.
- **Gerar resultados** (mudança de comportamento):
  - `classificacao_fonte='melhor_tempo'` → ordena por melhor volta.
  - `classificacao_fonte='corrida'` → usa posição final informada pela cronometragem (fallback melhor tempo, como hoje).
  - `classificacao_fonte='combinada'` → soma resultado da TT + corrida (requer duas sessões vinculadas à mesma etapa).
  - Pontos vindos de `pontos_json` + bônus pole/melhor volta; grava `source='cronometragem'`.
  - **Remove** qualquer cálculo de punição local (hoje não calcula em gerarResultados, mas a UI sugere — limpar cópias fixas).

### 4.3 Resultados (`/admin/resultados`)
- Aba manual: form de corrida ganha select de formato (herdado/editável).
- Validação suave: se `resultados.pontos` divergir da tabela do campeonato → hint informativa (não bloqueia; resultado manual é autoridade).
- Detalhe LapTime (`ResultadoRacingDetailPage`): blocos de paradas/punições condicionados ao formato; nota explicativa de rodapé passa a citar os valores do formato (sem texto fixo).

## 5. Integração com a cronometragem (LapTime)

- Snapshot/`racing-detail` continuam sendo a **fonte da verdade em runtime** (tempos, posições, paradas, punições aplicadas em tempo real).
- O formato local governa: **quais colunas aparecem**, quais regras a equipe espera, como `gerarResultados` classifica e pontua.
- Divergência config-local vs. snapshot é **alertada, nunca auto-corrigida**.

## 6. API / recursos novos no `admin-d1`

- Recurso novo: `formatos_corrida` (CRUD completo; busca por `nome`; `is_default` único garantido em transação).
- Colunas novas expostas nos recursos existentes: `campeonatos`, `etapas`, `sessoes`, `sessoes_full`, `corridas`, `corridas_full`.
- Endpoint utilitário (opcional, fase 2): `GET /api/admin/formatos/resolver?sessao_id=` retornando o formato efetivo + cadeia de origem, para a UI não replicar a lógica de herança.

## 7. Migração

Arquivo: `migrations/d1/0007_race_formats.sql`. Segue a convenção do repo (`0006_kart_equalizacao.sql`): `CREATE TABLE`/`INSERT` de seeds com guarda `IF NOT EXISTS`/`WHERE NOT EXISTS`; `ALTER TABLE ADD COLUMN` simples — execução única garantida pelo controle de migrations aplicadas (`lib/local-sqlite-db.ts` local / rastreio do D1 remoto via wrangler). Validada sintaticamente em SQLite em memória sobre o schema 0001.

## 8. Fases de implementação

1. **Fase 1 — Base:** migration 0007 + recurso `formatos_corrida` no `admin-d1` + resolução de herança em `lib/race-formats.ts` (função pura, testável) + testes.
2. **Fase 2 — Admin de formatos:** sub-aba "Formatos & Regras" em Campeonatos + campos de formato em campeonato/etapa/sessão/corrida + editor de `pontos_json`.
3. **Fase 3 — Motor de resultados:** refatorar `gerarResultados`/`recalcularClassificacao` para consumir formato+pontos (com testes unitários dos três critérios de classificação e bônus).
4. **Fase 4 — UI condicional:** colunas de paradas sob flag; badge de divergência; remoção de textos hardcoded.

## 9. Validação técnica no LapTime/Sisecom (2026-08-23)

Fontes: engenharia reversa das DLLs (`KARTODROMO - SISTEMA/EngenhariaReversa/DECOMPILED`), docs operacionais da pasta, e **validação ao vivo** dos serviços (scraper :4010 e mirror :4020 no ar; snapshot live da 500 MILHAS #637101 com 38 karts/442 paradas derivadas/21.558 voltas; agenda do dia seguinte confirmando padrão TT→Corrida).

### 9.1 Verdades do domínio LapTime que o formato deve espelhar

| Conceito | Comportamento real (evidência) |
|---|---|
| **Estados da prova** (`RacingStateEnum`) | 0 Aberta · 1 Verde · 2 Amarela · 3 Vermelha · 4 Quadriculada · 5 Encerrada · 9 Branca (última volta, endurance) |
| **Classificação calculada pelo LapTime** (`SaveCompetitorPositionAsync`) | Endurance (`Id_RacingType=4`): `Lap desc → TotalTime asc`. Demais tipos: `BestLapTime asc` (fallback TotalTime) → BestLap2nd → BestLap3rd. Ou seja: **no LapTime, corrida curta rankeia por melhor volta**; só endurance é por voltas/tempo. O formato configurável resolve exatamente essa ambiguidade para o operador |
| **Punições** | Colunas em `RacingCompetitor`, aplicadas em tempo real pelo cronometrista: `PenaltyTotalTime` (+tempo), `PenaltyLap` (entra em `Lap`), `PenaltyBestLapTime`, `PenaltyPos` (reordena), `PenaltyRacingPoint`, `PenaltyComment`. **StopAndGo** = contador operacional "Box", não entra em cálculo |
| **Voltas** | `MinimumTime` por prova (default 5 s) → volta abaixo vira `DeletedLap=1` automático; `InvalidLap` manual/bandeira-vermelha; `ManualLap` inserida à mão. Melhor volta considera **somente válidas** (`!InvalidLap && LapTime >= MinimumTime`) |
| **Encerramento** (`EndTypeEnum`) | 1 Não usar · 2 por tempo · 3 por volta · 4 tempo+volta · 5 tempo ou volta (`EndTime`/`EndPassing`) |
| **Bandeiras** (`FlagEnum`) | 0 Nenhuma · 1 Verde · 2 Amarela · 3 Vermelha · 4 Quadriculada · 5 Preta · 6 Preta/Laranja · 7 Preta/Branca · 8 Azul · 9 Branca |
| **Campeonato** | Tabela `Championship` existe **vazia/não implementada** no LapTime local. O conceito funcional vive no cloud novo (**Paddock**): pontos por etapa via tabela configurável + **desempate em 11 critérios ordenáveis**: vitrias → 2º lugares → 3º lugares → melhor posição → melhor posição na última etapa → melhor volta → menos punições → poles → voltas mais rápidas → 2ª melhor volta → 3ª melhor volta |

### 9.2 Inventário completo de hardcode a substituir (validado)

| Local | Valor hardcoded | Correção |
|---|---|---|
| `lib/livetime/laptime-pit-stops.ts:56` (`PIT_RULES`) | 11 paradas · ≥7min · janela 10min–11h40 · candidata ≥4min · 7 voltas/parada | Ler de `formatos_corrida` (parâmetros já existem na tabela) |
| `src/admin/modules/cronometragem/cronometragem.api.ts:26` (`POINTS_BY_POSITION`) | F1 [25…1] fixo | `campeonatos.pontos_json` |
| `cronometragem.api.ts:153` (fallback `boxCloseAfterMs`) | `42 * 60 * 60_000` = **42 h** — 🐞 bug: deveria ser 11h40 (`42_000_000 ms`), como em `PIT_RULES` e como exibido na UI ("Boxes: 10 min - 11h40") | Eliminado pela leitura do formato |
| Textos fixos da UI ("11", "7:00", "+7 voltas") em `CronometragemPage.tsx` / `ResultadoRacingDetailPage.tsx` | — | Vêm do formato resolvido |

### 9.3 Decisões de contexto já firmes (não contradizer)

- Site/admin já em **Cloudflare Workers + R2** (Vercel extinta); scraper/streamer/ViPlex rodam no servidor local e expostos via túnel; rotas nodejs não migram para workerd.
- Reserva/pagamento públicos continuam no SaaS **MyLapTime** (`tools.mylaptime.com.br`); inscrições de campeonato vão para webhook n8n.
- Punições **sempre** aplicadas em tempo real no LapTime; sistema novo apenas exibe (`PenaltyTotalTime/Lap/Pos`, `StopAndGo`, `statusLabel`).
- Telão próprio TB50 2048×512 híbrido (HDMI + ViPlex/NovaStar API `:16674`) consumindo o mesmo snapshot.

### 9.4 Topologia de execução validada (2026-08-23, nesta máquina)

| Caminho | Papel |
|---|---|
| `C:\KARTODROMO` | **Fonte da verdade** (repo git, Next.js Cloudflare). Serviços rodando agora: `next start` :3000 · scraper `livetime-scraper-server` :4010 · udk-bridge :4011 |
| `C:\KartodromoLocal` | API local standalone (`api-server.mjs`, **:4020 em execução**) com o MESMO contrato `/api/db/*` sobre SQLite (`kartodromo.db`) — é a opção 3 do proxy admin (`KARTODROMO_LOCAL_API_ENDPOINT`). Expõe views (`*_full`, `dashboard_summary`), `registrar_venda` atômico, upsert de estoque e `classificacao/upsert`. Túnel cloudflared dedicado (task **KartodromoLocalTunnel** em execução) + túnel RDP/SSH fixo (CloudflareTunnelTask) |
| `C:\Laptime` | Repositório de **backups diários automáticos**: `CALXPRO*.zip` (fev→hoje, ~124 MB/dia) e `LapTimeMirror*.zip` (desde 26/07) às 07:00; `Service\config.ini` do serviço de backup (valores ofuscados) |
| `C:\KARTODROMO-TB50` | Cópia de deploy no PC do telão (.250), **sem git** e defasada (scraper 229 linhas atrás do repo — sem rota `laptime-kart-history`, sem `telao-playlist-local`; usa `next build` sem webpack). Contém runtime ViPlex publicado (37 cópias de programa), logs de watchdog/pódio e APIs Vercel legadas (`api/inscricao.ts` → webhook n8n; `api/mylaptime.ts` → proxy MyLapTime) |

Tarefas agendadas desta máquina (validadas): `KartodromoLocalApi` ✅ executando · `KartodromoLocalTunnel` ✅ executando · `Kartodromo Cloudflare Live Bridge` ✅ executando · `LapTime Mirror` pronta · `Kartodromo TB50 Podium`/`TB50 Watchdog`/`TB50 Streaming Stack` (destinadas ao PC .250; as duas últimas desabilitadas aqui).

**Implicação para a Fase 1**: qualquer mudança em `formatos_corrida` precisa ser aplicada em TRÊS lugares: D1 remoto (produção), SQLite local (`migrations` já registradas em `local-sqlite-db.ts`) e o schema do `api-server.mjs`/`kartodromo.db` (seguir sendo fonte sincronizada) — além de atualizar a cópia do TB50 quando for tocar no telão.

## 10. Critérios de aceite (resumo)

- [ ] Criar campeonato "X" com pontos próprios (ex.: 30-24-20…) e bônus de pole → gerar resultados de uma sessão aplica exatamente essa tabela.
- [ ] Campeonato sem paradas → telas Ao Vivo/Detalhe não exibem colunas de pit stops.
- [ ] Endurance c/ paradas → painel de paradas funciona com limites vindos do formato (não mais hardcoded).
- [ ] Corrida avulsa com override de formato diferente do campeonato → funciona sem afetar as demais.
- [ ] TT pura → resultado classificado por melhor tempo.
- [ ] Nenhuma punição é calculada localmente; apenas exibida (fontes: `PenaltyTotalTime/Lap/Pos`, `StopAndGo`, `statusLabel` do LapTime).
- [ ] Classificação de campeonato usa desempate configurável com catálogo dos 11 critérios Paddock (ordem editável).
- [ ] Testes unitários cobrindo resolução de herança e os 3 modos de classificação.
