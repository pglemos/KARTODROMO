# Operação — Fluxo de Cronometragem para Campeonato

> Como rodar uma etapa de campeonato usando Cronometragem + Campeonatos + Resultados no admin
> (`kartodromodebetim.com.br/admin`). Válido desde a entrega de Formatos & Regras (2026-08-23).
> Acesso: perfis `owner`, `admin` e `operador_telao`.

---

## 0. Uma vez por campeonato (aba Campeonatos)

1. **Campeonatos** → criar/editar campeonato (nome, slug, temporada, status `ativo`).
2. No mesmo formulário, definir o **Regulamento esportivo**:
   - **Formato das corridas**: deixe em *Padrão Betim (default)* — tomada de tempo monta o grid,
     corrida sem parada obrigatória — ou escolha outro template (ex.: *Endurance com Paradas*).
   - **Tabela de pontos** por posição (botão *F1 padrão* preenche 25-18-15…; ajuste à vontade),
     campo "Demais posições" para pontos fixos fora da tabela.
   - **Bônus**: pole e melhor volta em pontos (ex.: premiação da pole).
   - **Descartes**: quantidade de piores etapas descartadas no fechamento.
   - **Ordem de desempate**: use ↑/↓ (padrão segue os 11 critérios: vitórias, podios, …).
3. Aba **Formatos & Regras** → só se precisar de um template novo (ex.: endurance 6h com 8 paradas × 7min).
4. Aba **Etapas** → criar a etapa do dia (round, data). Se a etapa tiver regulamento diferente do
   campeonato, use "Formato (override da etapa)".

## 1. Dia da prova (aba Cronometragem)

1. **Sessões** → *Nova sessão* duas vezes:
   - `TOMADA DE TEMPO` — tipo **Classificação**, vinculada ao campeonato + etapa do dia;
   - `CORRIDA` — tipo **Corrida**, mesma etapa.
   - Formato: deixe *Herdar do campeonato* salvo override pontual.
   - Encerre a sessão (**Encerrar**) após cada prova — sessão encerrada é pré-requisito para gerar resultado.
2. **Ao Vivo**: acompanhe a prova; num formato **sem paradas** o painel fica limpo (sem colunas de box);
   em endurance aparecem paradas válidas/faltam/punição e o botão PROJEÇÃO FUTURA.
   Se aparecer o alerta **"Divergência de regulamento"**, o regulamento configurado difere do que a
   cronometragem está aplicando — alinhe antes de gerar resultados.

## 2. Importação e resultados

Para cada prova encerrada:

1. **Ao Vivo** → aguarde status *Online* com os pilotos da prova → **Importar p/ sessão**
   → destino: a sessão correspondente (cria nova se preferir).
   A importação grava a **melhor volta** de cada piloto como volta válida.
2. Na linha da sessão (aba Sessões) → **Gerar resultados**. O sistema:
   - classifica pelo critério do formato (`melhor_tempo` na TT · posição informada na corrida);
   - aplica a tabela de pontos + bônus do campeonato;
   - cria a corrida como `publicada` (source `cronometragem`);
   - recalcula a **classificação geral** já com descartes e desempates.
3. No formato **combinado**, gerar o resultado da corrida publica também o da(s) TT(s) encerrada(s)
   da mesma etapa (a tomada de tempo pontua separadamente).

## 3. Conferência

- **Campeonatos → Classificação**: selecione o campeonato e confira posições/pontos.
- **Resultados → Manual**: resultados por corrida; edite manualmente apenas exceções
  (a edição manual não dispara recálculo automático — reabra *Gerar resultados* ou ajuste pontos).
- **Resultados → Corridas reais (LapTime)**: fonte da verdade da cronometragem; detalhe completo
  com voltas, paradas e punições aplicadas em pista.

## 4. Problemas rápidos

| Sintoma | Ação |
|---|---|
| Ao Vivo *Offline* | Scraper local (:4010) parado — reiniciar task `Kartodromo Cloudflare Live Bridge`; LapTime decodificador offline é problema de pista |
| "Divergência de regulamento" | Comparar formato da sessão vs. config do evento no LapTime; corrigir onde estiver errado antes de gerar resultados |
| Resultado gerado errado | Excluir a corrida (Resultados → Manual) — isso remove os resultados em cascata — corrigir sessão/formato e regerar |
| Piloto sem vínculo | Importação casa por nome normalizado ou nº do kart; cadastre o piloto (Campeonatos → Pilotos) e importe novamente |

## 5. Regras fixas (lembrando)

- **Punições são sempre aplicadas pela cronometragem em tempo real** (LapTime). Este sistema nunca
  calcula punição — apenas exibe.
- Pontos ficam gravados por corrida; alterar a tabela depois **não** retroage. Para reverter um
  campeonato inteiro, corrija a tabela e regenere as etapas afetadas.
- Desempate só entra em ação com pontos iguais; ordem final gravada em Campeonatos → Classificação.
