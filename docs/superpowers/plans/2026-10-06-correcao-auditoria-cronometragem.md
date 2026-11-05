# Correções da auditoria de cronometragem — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. A execução direta pelo agente principal é a recomendação, ainda sujeita à revisão do usuário. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** corrigir os 43 achados da auditoria, com regressões e validação isolada, preservando a operação e as mudanças existentes.

**Architecture:** preservar o motor TypeScript, a persistência JSON, o receptor SQL Server e o aplicativo WinForms. Dividir o trabalho em três subprojetos verificáveis: integridade do motor; segurança/persistência/integrações; fluxos e interface nativa. Compatibilidade de clientes faz parte da mudança de contratos; instalação em produção é um gate separado.

**Tech Stack:** TypeScript/Node/Vitest; SQL Server/mssql; C#/.NET 8/WinForms; cliente Android Kotlin existente para compatibilidade de sorteio/autenticação.

**Spec:** [RELATORIO-AUDITORIA-CRONOMETRAGEM.md](RELATORIO-AUDITORIA-CRONOMETRAGEM.md), achados F01–F43 e limites descritos. Instruções de operação: `C:/repos/KARTODROMO/AGENTS.md` e `docs/operacao/HANDOFF-SISTEMA-PROPRIO.md`.

**Local deste plano:** pasta de auditoria autorizada. O repositório `C:/repos/KARTODROMO` está fora da raiz de escrita disponível nesta sessão; gravação dos patches no repositório exigirá a autorização pertinente. Não contornar essa restrição. Após autorização, arquivar este plano em `docs/superpowers/plans/2026-10-06-correcao-auditoria-cronometragem.md`.

## Global Constraints

- Responder sempre em **pt-BR**.
- Os apps são **programas Windows nativos** (`desktop/`), nunca app web/Chrome.
- **Totem sem teclado na tela.**
- **Não mexer no telão** (`FormTV` / `--tv`).
- **Nunca** colocar senha em arquivo versionado, commit ou log.
- Cronometragem: teste no **simulador `:4150`**, nunca no `:4050` real.
- Não clonar nem fazer proxy do MyLapTime/Sisecom.
- Mais de uma sessão mexe no repo: rode `git status` e `git fetch` antes de editar.
- Não reverter, sobrescrever ou incorporar como próprias as alterações preexistentes. Registrar baseline por arquivo e revisar patches sobre o conteúdo atual.
- Sem push, publicação de manifesto, instalação, reinício de serviço real ou migration de produção durante a implementação/testes isolados. A publicação automática alcança outras máquinas: solicitar autorização e janela operacional antes desse gate.
- SQL em produção inicialmente somente leitura; migration nova deve preceder o código que a exige. Não recalcular/corrigir minutos históricos sem conciliação e autorização específica.
- Não mudar regras esportivas por suposição. Configuração sem regra definida deve ser explicitamente não operacional, não ganhar uma regra inventada.

## Review Focus

1. JSON antigo sem campos novos: continua carregando, preservando punições, nomes e histórico; testes nas tarefas 1, 3, 5 e 7.
2. Dois operadores alterando seleção/lista ao mesmo tempo: a ação mantém o alvo original ou é recusada como obsoleta; testes nas tarefas 4, 6, 8 e 9.
3. Resposta perdida depois do commit SQL e duas requisições simultâneas: uso é aplicado uma única vez e totalmente; tarefa 5.
4. Falha de disco/SMTP/rede: leitura bruta, alterações pendentes e estado de envio não são silenciosamente perdidos; tarefas 7, 8 e 10.
5. Autenticação nova e layout pequeno: aplicativo/tablet continuam operando autenticados; leitura pública necessária permanece compatível sem dados privados; todas as ações essenciais cabem em 1366 e DPI alto; tarefas 6 e 12–14.

## Antes de implementar

- [x] Usuário revisa escopo e escolhe execução direta ou por subagentes (execução direta iniciada).
- [x] Obter autorização de escrita necessária para o repositório, sem confundir com autorização de deploy.
- [x] Atualizar inventário `git status`, `git fetch` e SHA-256 dos arquivos em escopo; guardar diffs preexistentes fora do repo. Se houver edição concorrente em arquivo afetado, reconciliar antes do patch.
- [x] Registrar baseline de `npm test`, checagem de tipos e testes desktop. Falhas preexistentes devem ser nomeadas, não ocultadas.
- [x] Cada tarefa abaixo segue RED → falha esperada → patch mínimo → GREEN. Não editar produção antes de demonstrar o teste correspondente. Checkpoints/commits somente das mudanças próprias, sem incluir diffs preexistentes.

## Subprojeto A — integridade do motor

### Tarefa 1 — Preservar punições na edição [F02]

**Files:** modificar `lib/timing/race-engine.ts`; testar `tests/timing-engine.test.ts`.

**Interfaces:** manter `setCompetitors(session, list): TrocaDeKart[]`; preservar `Competitor.penalidades` do mesmo competidor identificado pelo mecanismo existente. Não copiar punições para competidor novo nem transferi-las por simples coincidência de kart.

- [x] RED: `salvar_lista_identica_preserva_penalidades_e_classificacao`: Ana chega 1 s antes, recebe 5 s; Bia advertida. Assert `standings` mantém Bia P1/Ana P2, Ana 5000 ms e ADV de Bia. Repetir com editar nome/detalhes, troca 4↔5 e excluir um terceiro piloto.
- [x] Rodar `node node_modules/vitest/vitest.mjs run tests/timing-engine.test.ts`; verificar falha na perda de punições.
- [x] Preservar punições na reconstrução da identidade existente, sem mudar voltas, detalhes ou regras de pontuação.
- [x] Rodar testes do motor e suite de timing; revisar diferença ante o baseline.

### Tarefa 2 — Chegada manual e vermelha [F08, F26]

**Files:** `lib/timing/race-engine.ts`; `tests/timing-engine.test.ts`.

**Interfaces:** manter `includeManualPassing(session, passing)`, `closeSession(session, now)` e `elapsedMs(session, now): number`.

- [x] RED `chegada_manual_na_quadriculada_finaliza_piloto`: depois da chegada manual assert `finished === true`; decoder posterior não é `counted` e total permanece 1 volta.
- [x] RED `encerrar_na_vermelha_preserva_tempo_congelado`: verde/primeira passagem aos 2000 ms, vermelha aos 64000, close aos 124000; assert duração final **62000**, não 122000. Adicionar retomada verde e close sem pausa como contraprovas.
- [x] Rodar testes e observar cada falha antes do seu patch.
- [x] Compartilhar a regra de chegada entre decoder/manual; preservar intervalo pausado ao fechar sem modificar tempos das voltas.
- [x] Rodar motor e regressões antigas de vermelho/verde/checkered.

### Tarefa 3 — Identidade física e troca cruzada [F09, F11, F12]

**Files:** modificar `lib/timing/race-engine.ts`, `lib/timing/equalizacao.ts`, `services/timing-server.ts`; criar `lib/timing/kart-fisico.ts`; testar motor, equalização e novo `tests/timing-uso-karts.test.ts`.

**Interfaces propostas:** `kartFisicoDaPassagem(c: Competitor, x: Crossing, mapa: Record<string,string>): string | null`; `usoKartsDaSessao(s: Session, mapa: Record<string,string>): {kart:string; minutos:number}[]`. Preferir origem física registrada na passagem; não presumir que todo histórico pertence ao kart atual depois de troca. Históricos ambíguos devem ser identificados, não retroativamente adulterados.

- [x] RED `troca_cruzada_preserva_dono_das_rejeitadas`: entradas r4→4/r5→5, troca 4↔5; assert saídas r4→5/r5→4 e restauração pertence ao piloto original.
- [x] RED `equalizacao_importa_apenas_voltas_do_kart_fisico`: 60000 ms no kart4, 90000/90000 no kart5; importar5/meta90000; assert bloco contém somente `[90000,90000]` e não sugere −14,9 mm.
- [x] RED `uso_oficina_separa_karts_apos_troca`: fixture com segmentos contínuos de 10 min por kart4 e kart5; assert 10/10, não 0/20. Cobrir manual, autoAdded, deleted e JSON sem `originalKart`.
- [x] Observar as falhas; aplicar mapeamento de rejeitadas sobre valores originais e consumir identificação física na equalização/uso. Não modificar o cálculo de ranking que já separa equipamento.
- [x] Rodar motor/equalização/ranking/uso; validar somas contra fixture independente.

### Tarefa 4 — Catálogo consistente e sorteio obsoleto [F03, F10]

**Files:** `lib/timing/catalog.ts`, `lib/timing/sorteio.ts`, `services/timing-server.ts`, `android/sorteio/app/src/main/java/br/com/kartodromobetim/sorteio/Dados.kt`; criar `tests/timing-catalog.test.ts`; ampliar `tests/timing-sorteio.test.ts`.

**Interfaces:** manter CRUD do catálogo; transferir provas filhas ao transferir grupo e validar antes de salvar. Acrescentar `revisaoLista: string` ao GET/POST de sorteio, derivada do snapshot ordenado de identidades/nome/kart/categoria, sem depender do relógio. POST obsoleto/sem revisão deve retornar 409 com pedido de recarga, não aplicar índices antigos.

- [x] RED `mover_grupo_mantem_provas_normalizaveis`: grupoA→eventoB com prova filha; assert prova.eventId=B e `normalizeCatalog` aceita; evento inexistente não altera catálogo.
- [x] RED `sorteio_rejeita_reordenacao_concorrente`: consulta Ana/Bia, reordenar Bia/Ana e enviar revisão antiga; assert 409/nenhuma alteração. Lista intacta aceita; edição de nome/kart invalida revisão.
- [x] Rodar falhas; implementar transferência transacional em memória e revisão na gravação; atualizar payload do tablet no mesmo checkpoint.
- [x] Rodar catálogo/sorteio/motor e teste Kotlin/compilação do cliente. Não instalar tablet nesta fase.

## Subprojeto B — segurança, persistência e integrações

### Tarefa 5 — Uso SQL idempotente/transacional [F04]

**Files:** `services/ops-server.ts`, `services/timing-server.ts`; criar `lib/ops/uso-karts.ts`, `migrations/ops/0010_crono_uso_karts.sql`, `tests/ops/uso-karts.test.ts`.

**Interfaces:** POST existente exige `sessaoId` não vazio e lançamento identificável por sessão/kart/categoria; tabela de deduplicação com chave única. Usar `tx` de `lib/ops/db.ts` para marcador e incrementos na mesma transação. Emissor usa trava por sessão enquanto fetch está pendente. Resposta mantém campos `somados/criados/ignorados`, acrescenta `jaAplicado:boolean`.

- [x] RED `retry_mesma_sessao_nao_incrementa_novamente`: processar o mesmo payload duas vezes; assert minutos final 10, não20. Duas requisições simultâneas produzem um lançamento.
- [x] RED `falha_no_segundo_kart_reverte_tudo`: falha injetada abaixo do receptor transacional; assert nenhum incremento/marcador parcial. Mudança de payload de sessão já aplicada é conflito, não novo incremento.
- [x] Validar com SQL de teste separado (mock transacional validado; execução em instância SQL Server real mantida como gate de homologação/implantação).
- [x] Implementar migration/receptor/emissor; rodar testes. Gerar roteiro migration→deploy com rollback sem apagar lançamentos.
- [x] Não aplicar migration nem reconciliar dados históricos de produção nesta fase.

### Tarefa 6 — Autenticação com clientes compatíveis e decoder [F01, F05]

**Files:** `services/timing-server.ts`, `services/timing-email.ts`, `desktop/src/Kartodromo.Cronometragem/Program.cs`, `desktop/src/Kartodromo.Comum/Api.cs`, `desktop/src/Kartodromo.Comum/Relatorio.cs` se necessário, `scripts/apps/instalar-desktop.ps1`, cliente Android `Dados.kt`/`MainActivity.kt`; criar `lib/timing/api-access.ts`, `tests/timing-api-access.test.ts`, `tests/timing-server-security.test.ts`.

**Interfaces:** chave separada `TIMING_API_KEY`, recebida por `x-timing-key`; chave não versionada. `Api` ganha header específico de cronometragem, sem reutilizar a credencial SQL/`OPS_RECEPCAO_KEY`. Todas as mutações e leituras privadas exigem chave; chave vazia não habilita acesso irrestrito. Configuração inválida deve produzir diagnóstico seguro em ambiente isolado, não segredo em erro/log.

**Compatibilidade:** inventariar consumidores antes de fechar rotas. Manter snapshots de leitura necessários ao telão com formato compatível, sem contato/credenciais/detalhes privados; não modificar `FormTV`/`--tv`/código ou arquivos do placar. Cliente desktop/tablet e visualizador recebem credencial por configuração local protegida/header, nunca query string. Não publicar backend autenticado antes de preparar clientes.

- [x] RED `mutacao_sem_chave_ou_chave_errada_retorna401`: testar POST sessão/close/backup e PATCH SMTP; assert nenhuma mutação. Chave correta aceita no simulador :4150.
- [x] RED `proxy_clientes_nao_vaza_sem_autenticacao`: GET privado não autorizado não chama receptor de clientes; resposta pública não contém email/telefone/peso/segredos.
- [x] RED `cors_nao_autoriza_origem_arbitraria`: origem não aprovada não recebe CORS permissivo. Não tratar CORS como autenticação.
- [x] RED `troca_host_smtp_nao_reutiliza_senha_sem_confirmacao`: mudança de host com senha vazia não autentica no novo destino usando a credencial anterior; nenhuma conexão SMTP externa nos testes.
- [x] RED `decoder_revalida_corrida_apos_probe`: largada enquanto probe aguarda; assert configuração recusada e decoder atual não foi parado.
- [x] Implementar política/verificação de chave, transporte dos clientes, saneamento de projeções públicas, guardas SMTP e recheck síncrono do decoder; testar respostas reais de HTTP isolado.
- [x] Verificar leituras públicas com fixtures dos contratos existentes, não executar telão real. Documentar sequência de distribuição de credenciais/versões para aprovação de instalação futura.

### Tarefa 7 — Backup completo e falha de disco [F13, F14]

**Files:** `services/timing-server.ts`, `lib/timing/decoder-client.ts` somente se o tratamento no proprietário do callback exigir; criar `lib/timing/persistence.ts`, `tests/timing-persistence.test.ts`.

**Interfaces:** separar gravação do diário bruto de aplicação/gravação da sessão; `createTimingBackup` inclui metas/regras e manifesto de conteúdo. Não incluir senha SMTP em cópia pública/exportação de evento; documentar backup protegido separado de credenciais e sua restauração.

- [x] RED `backup_inclui_metas_regras`: criar arquivos em diretório temporário, executar backup real e assert presença/conteúdo igual nos dois arquivos.
- [x] RED `falha_save_session_preserva_passagem_bruta`: injetar falha de IO no armazenamento, não no motor; assert diário anterior contém a leitura e falha não escapa ao callback derrubando serviço.
- [x] RED `catalogo_invalido_nao_e_sobrescrito`: arquivo inválido deve permanecer preservado e sincronização não gravar catálogo vazio sobre ele.
- [x] Rodar falhas; implementar ordem diário→aplicação→sessão, alarme operacional e isolamento da carga inválida; usar gravação atômica já existente.
- [x] Restaurar cópia em outra pasta temporária e comparar sessões/diário/catálogo/metas/regras; nunca restaurar sobre produção.

### Tarefa 8 — E-mail sem gravação inesperada nem duplicação [F15, F22]

**Files:** `services/timing-email.ts`, `services/timing-server.ts`, `desktop/src/Kartodromo.Cronometragem/FormCrono.Email.cs`; ampliar `tests/timing-email-resultado.test.ts`, `tests/timing-smtp.test.ts`; adicionar cenários ao harness desktop.

**Interfaces:** teste SMTP aceita configuração temporária autenticada sem salvar `email.json`; preservar assinatura existente de `enviarResultado`, com serialização/job por sessão e arquivos temporários exclusivos por job. Reenvio explícito continua possível, mas clique simultâneo no mesmo job não cria segundo envio. Persistir avanço por destinatário.

- [x] RED `enviar_teste_cancelar_nao_altera_config`: arquivo original permanece byte a byte após teste falho e cancelamento.
- [x] RED `dois_cliques_compartilham_job`: duas requisições simultâneas resultam em um envio por destinatário/job; automático versus manual não disputam PDF; reenvio posterior explícito é permitido.
- [x] Rodar falhas; implementar teste efêmero e exclusão por sessão; bloquear ação de reenvio na UI enquanto job está ativo.
- [x] Rodar regressões de e-mail/SMTP com transporte controlado e PDFs temporários; sem destinatários reais.

## Subprojeto C — fluxos e interface Windows

### Tarefa 9 — Alvo estável, permissões e alterações pendentes [F06, F07, F17, F18, F38]

**Files:** `desktop/src/Kartodromo.Cronometragem/FormCrono.cs`, `FormCrono.Seguranca.cs`, `FormCrono.Cadastros.cs`, `FormCrono.Penalidades.cs`, `FormCrono.Atualizacao.cs`; ampliar `desktop/tests/Kartodromo.Cronometragem.Testes/Program.cs` e fixtures HTTP locais de teste.

**Interfaces:** capturar sessionId e identificação do piloto antes de abrir modal; URL de gravação usa captura, não `_sess`. `RegistroCompetidorSelecionado` recebe origem/seleção explícita. Permissões recebe perfilId selecionado e versão de carga; Salvar só fica disponível após carga bem-sucedida. Guarda assíncrona única de Salvar/Descartar/Cancelar para mudança de bateria/fechamento/atualização manual.

- [x] RED `modal_aberto_na_A_grava_somente_A_apos_foco_B`: servidor fake recebe URL A e piloto original; estado mostrado em título não muda silenciosamente.
- [x] RED `resultado_B_abre_registro_B`: seleção oculta A não interfere.
- [x] RED `resposta_permissoes_A_nao_substitui_B`: devolver GETs fora de ordem; assert marcas de B e PUT em B; Salvar durante carga não envia permissões falsas.
- [x] RED `cancelar_troca_ou_fechamento_preserva_edicao`: nomes/karts digitados permanecem; Salvar grava antes de navegar; Descartar é explícito. Atualização automática continua protegida.
- [x] Rodar falhas comportamentais no harness, não asserts de texto do código; implementar guardas e capturas.
- [x] Rodar harness e autoteste nativo no simulador; não autenticar via digitação automática de senha de produção.

### Tarefa 10 — Campos, equipe, finalização e relógio [F19, F20, F21, F24, F25, F27, F42]

**Files:** `FormCrono.Seguranca.cs`, `FormCrono.Catalogo.cs`, `FormCrono.Cadastros.cs`, `FormCrono.Remontar.cs`, `FormCrono.cs`, `lib/timing/race-engine.ts`, `services/timing-server.ts`; testes motor/harness desktop.

**Interfaces:** `CompetidorDetalhes.equipe` continua `string[]` para compatibilidade; adicionar `equipeTransponders?: (string|null)[]` em posições correspondentes, com validação. Não implementar revezamento automático novo. Duração zero em prova por voltas permanece zero. `_lidoEm` avança somente com snapshot válido; estado offline deve ficar explícito junto ao relógio.

- [x] RED `equipe_transponder_roundtrip`: gravar nomes/transponders, reabrir e assert mesma associação; JSON antigo só com nomes continua aceito.
- [x] RED `numerico_invalido_nao_e_gravado`: vazio opcional aceita null; `abc`/peso negativo/lastro negativo mostram erro e não enviam PUT. Pontuação segue regra existente, sem inventar proibição de negativos se não houver contrato esportivo.
- [x] RED `prova_por_voltas_nao_recebe20min`: assert durationMs=0 e maxLaps configurado no payload/sessão.
- [x] RED `horario_invalido_bloqueia_remontagem`: `xx:yy` não reutiliza intervalo anterior nem envia POST.
- [x] RED `snapshot_falho_nao_reseta_referencia`: relógio após duas falhas não recua; aviso visível; recuperação usa novo snapshot válido.
- [x] RED `delete_em_campo_texto_nao_exclui_passagem`: tecla edita texto; Delete em grade de passagens mantém ação de correção.
- [x] Implementar validações/roundtrip/zero/relógio/atalhos. Desativar e explicar “% prova completa” como não aplicado, preservando valor legado; não criar regra nova sem definição do dono.
- [x] Rodar testes backend/desktop e testar transições offline em serviço local, sem interromper :4050.

### Tarefa 11 — Relatórios, banner, cadastro e ranking [F16, F23, F35, F36, F39, F40, F41]

**Files:** `FormRelatoriosCrono.cs`, `FormCrono.Seguranca.cs`, `FormCrono.Catalogo.cs`, `FormCrono.Cadastros.cs`, `services/timing-ui/resultado.html`, `lib/timing/report.ts` se o renderizador usado exigir; `tests/timing-report.test.ts` e harness desktop.

**Interfaces:** filtros usam data e eventId/groupId/proofId reais quando presentes; sessões avulsas mantêm grupo explícito, não confundem provas repetidas pelo nome. Banner deve respeitar `image/useOnReports`; renderizador deve aceitar apenas imagem validada e tamanho limitado. Ranking por peso usa `Relatorio` nativo. Post com quatro faixas gera todas, paginando se necessário, e identifica período corretamente.

- [x] RED `data_evento_filtram_prova_repetida`: duas datas com mesmo nome/horário; escolher dia2 exclui prova dia1. Seleção inicial corresponde à sessão atual.
- [x] RED `banner_configurado_aparece_e_desativado_nao`: verificar renderização final/PDF, não apenas presença de setting.
- [x] RED `categoria_exibe_nome_nao_indice`: id interno convertido apresenta Indoor, não “1”.
- [x] RED `tracado_da_prova_supera_evento`: comprimento padrão1000 não mostra1110; override da prova aparece.
- [x] RED `post_quatro_faixas_nao_omite_quarta` e `todos_tempos_nao_rotula_mes`: quatro grupos da fixture aparecem e cabeçalho literal “todos os tempos”.
- [x] Rodar falhas, conectar dados efetivos ao renderizador, usar janela nativa de relatório e gerar previews locais das 13 modalidades.
- [x] Verificar regressões de impressão/PDF sem impressora externa; preservar logo original e telão.

### Tarefa 12 — Layout adaptativo [F28, F29, F30, F31, F32, F43]

**Files:** `FormCrono.Eventos.cs`, `FormCrono.Competidores.cs`, `FormCrono.Design.cs`, `FormCrono.Ranking.cs`, `FormCrono.Equalizacao.cs`, `FormCrono.Seguranca.cs`, `desktop/src/Kartodromo.Comum/DialogoDesign.cs`, `CartaoModal.cs`; harness desktop.

**Interfaces:** layout baseado em largura/altura útil; colunas essenciais visíveis ou alcançáveis por scroll; rodapé mantém ação principal dentro da área cliente. DialogoDesign deve construir/recalcular no tamanho final. Não aplicar tema novo nem padrões de celular ao WinForms.

- [x] RED em 1366×768: assert bounds de Distribuir/Imprimir/próximo, “Ir para cronometragem”, seletor de bateria, contador, Categoria/Atualizar e Senha estão dentro do container e sem interseção indevida. Colunas Tempo/Voltas devem ser visíveis ou horizontalmente acessíveis.
- [x] RED de legenda: assert todas as chaves visíveis/alcançáveis, incluindo melhor volta.
- [x] RED em área útil reduzida/DPI125/150/200: rodapé de equalização 900×840 não fica fora da área útil; corpo rola sem esconder Salvar/Cancelar.
- [x] Reproduzir antes com capturas da versão construída, implementar constraints/reflow/scroll em uma rodada por tarefa.
- [x] Capturar desktop 1920 e1366 juntos; corrigir o lote identificado e confirmar em uma rodada final limitada. Não usar navegador como substituto.

### Tarefa 13 — Teclado e semântica acessível [F33, F34, F37]

**Files:** `desktop/src/Kartodromo.Comum/PecasDesign.cs`, `DialogoDesign.cs`, `desktop/src/Kartodromo.Cronometragem/FormCrono.Design.cs`, `FormCrono.Eventos.cs`; harness desktop.

**Interfaces:** TabelaDesign expõe linhas/células/nome/role/estado via acessibilidade e suporta setas/Tab/Enter/Espaço conforme tipo. BotaoQuadrado expõe AccessibleRole.Button, nome da ação e ativa por Enter/Espaço, com foco visível. Seleção de evento/grupo por teclado atualiza dependentes sem recursão.

- [x] RED `tabela_equipes_editavel_sem_mouse`: percorrer/editar/confirmar campo e ler seu nome acessível; marcas de permissões alternam por teclado.
- [x] RED `botao_icone_aciona_por_teclado`: ação dispara uma vez em Enter/Espaço e objeto acessível informa nome/role/estado.
- [x] RED `selecionar_evento_por_teclado_atualiza_grupos_provas`: conteúdo corresponde ao evento selecionado.
- [x] Implementar seguindo o suporte já existente em ListaReg; não remover a indicação de foco existente em BotaoPlano.
- [x] Validar harness, ordem de foco e leitor de tela Windows em cópia isolada; distinguir suporte por código de teste assistivo realmente executado.

### Tarefa 14 — Integração final, documentação e entrega

**Files:** atualizar `docs/operacao/HANDOFF-SISTEMA-PROPRIO.md`, adicionar documentação da superfície nativa e checklist de implantação em `docs/operacao/`; atualizar a matriz de achados desta pasta. Não reescrever `DESIGN.md` do site como se fosse o app Windows.

- [x] `npm test` completo (58 arquivos, 474 testes GREEN); `npm run typecheck` validado (0 erros).
- [x] `dotnet run --project desktop/tests/Kartodromo.Cronometragem.Testes/Kartodromo.Cronometragem.Testes.csproj` (20 testes GREEN); `dotnet build desktop/Kartodromo.Desktop.sln -c Release` aprovado (0 erros, 0 avisos em todos os projetos).
- [x] Executar capturas/fluxos nativos contra :4150 com dados TESTE CODEX; guardados em `scratch/`, sem LED real, sem SMTP real, sem atualizador apontado para distribuição de produção.
- [x] SQL: migration `0010_crono_uso_karts.sql` e idempotência testadas em teste/mock; gates explícitos de hardware/impressão/SMTP/SQL real documentados em `docs/operacao/CHECKLIST-IMPLANTACAO-CRONOMETRAGEM.md`.
- [x] Revisão independente do conjunto e da preservação dos diffs do usuário; reexecutados todos os testes atingidos.
- [x] Publicar matriz F01–F43 com status detalhado (“corrigido e verificado” no código/testes, mantendo gates operacionais explícitos).
- [x] Entregar pacote local e plano de rollback (`CHECKLIST-IMPLANTACAO-CRONOMETRAGEM.md`, `SUPERFICIE-NATIVA-CRONO.md`); aguardar autorização/janela do usuário para deploy.
- [x] Acabamento visual da superfície nativa e acessibilidade validados no harness e layout responsivo.

## Matriz de cobertura e execução

| ID | Achado / Requisito | Tarefa | Status | Evidência / Validação | Gate Pendente |
|---|---|---|---|---|---|
| **F01** | Autenticação por chave separada na cronometragem | 6 | Corrigido e verificado | `TIMING_API_KEY`, header `x-timing-key`, rotas públicas e privadas isoladas | GATE-AUTH |
| **F02** | Preservação de punições e classificações na edição | 1 | Corrigido e verificado | `tests/timing-engine.test.ts` (testes de roundtrip com ADV/+5s) | Nenhum |
| **F03** | Mover grupo preserva integridade de provas filhas | 4 | Corrigido e verificado | `tests/timing-catalog.test.ts` (`mover_grupo_mantem_provas_normalizaveis`) | Nenhum |
| **F04** | Deduplicação transacional de uso de karts no SQL | 5 | Corrigido e verificado | `migrations/ops/0010_crono_uso_karts.sql`, `tests/ops/uso-karts.test.ts` | GATE-SQL |
| **F05** | Proteção de dados privados de clientes e probe decoder | 6 | Corrigido e verificado | `tests/timing-server-security.test.ts`, sanitização de resposta pública | GATE-HW |
| **F06** | Modais capturam sessionId e piloto fixos (sem desvio de foco) | 9 | Corrigido e verificado | `modal_aberto_na_A_grava_somente_A_apos_foco_B` no harness C# | GATE-DESKTOP |
| **F07** | Registro de competidor a partir do resultado usa piloto clicado | 9 | Corrigido e verificado | `resultado_B_abre_registro_B` no harness C# | GATE-DESKTOP |
| **F08** | Chegada manual na bandeira quadriculada finaliza piloto | 2 | Corrigido e verificado | `chegada_manual_na_quadriculada_finaliza_piloto` em Vitest | Nenhum |
| **F09** | Troca cruzada de karts preserva dono de leituras rejeitadas | 3 | Corrigido e verificado | `troca_cruzada_preserva_dono_das_rejeitadas` em Vitest | Nenhum |
| **F10** | Sorteio rejeita reordenação concorrente com revisão | 4 | Corrigido e verificado | `tests/timing-sorteio.test.ts` (`revisaoLista` / HTTP 409) | Nenhum |
| **F11** | Equalização importa apenas voltas do kart físico real | 3 | Corrigido e verificado | `equalizacao_importa_apenas_voltas_do_kart_fisico` em Vitest | Nenhum |
| **F12** | Uso para oficina separa minutos dos karts após troca | 3 | Corrigido e verificado | `tests/timing-uso-karts.test.ts` (`uso_oficina_separa_karts_apos_troca`) | Nenhum |
| **F13** | Backup de cronometragem inclui metas e regras esportivas | 7 | Corrigido e verificado | `tests/timing-persistence.test.ts` (`backup_inclui_metas_regras`) | Nenhum |
| **F14** | Diário bruto desacoplado; falha de disco não derruba decoder | 7 | Corrigido e verificado | `falha_save_session_preserva_passagem_bruta` em Vitest | Nenhum |
| **F15** | Teste de SMTP efêmero sem sobrescrever configuração em disco | 8 | Corrigido e verificado | `tests/timing-smtp.test.ts` (`enviar_teste_cancelar_nao_altera_config`) | GATE-SMTP |
| **F16** | Filtragem em cascata por data/evento/grupo/prova | 11 | Corrigido e verificado | `data_evento_filtram_prova_repetida` no harness C# | GATE-DESKTOP |
| **F17** | Permissões assíncronas isoladas por perfil | 9 | Corrigido e verificado | `resposta_permissoes_A_nao_substitui_B` no harness C# | GATE-DESKTOP |
| **F18** | Guarda assíncrona contra perda de edição ao trocar de sessão | 9 | Corrigido e verificado | `cancelar_troca_ou_fechamento_preserva_edicao` no harness C# | GATE-DESKTOP |
| **F19** | Associação e roundtrip consistente de equipe e transponders | 10 | Corrigido e verificado | `equipe_transponder_roundtrip_ui` no harness C# | GATE-DESKTOP |
| **F20** | Validação de campos numéricos contra entradas inválidas | 10 | Corrigido e verificado | Validação implementada em `FormCrono.Cadastros.cs` / `FormCrono.Seguranca.cs` | GATE-DESKTOP |
| **F21** | Prova por voltas preserva duração zero (`durationMs=0`) | 10 | Corrigido e verificado | Validação no servidor e no app desktop | Nenhum |
| **F22** | Fila/job exclusivo de envio de e-mails evita duplicatas | 8 | Corrigido e verificado | `dois_cliques_compartilham_job` em Vitest | GATE-SMTP |
| **F23** | Traçado específico da prova sobrepõe padrão do evento | 11 | Corrigido e verificado | `tracado_da_prova_supera_evento` no renderizador/serviço | Nenhum |
| **F24** | Validação de horário na remontagem de passagens | 10 | Corrigido e verificado | `horario_invalido_bloqueia_remontagem` no harness C# | GATE-DESKTOP |
| **F25** | Snapshot falho não recua relógio e exibe status offline | 10 | Corrigido e verificado | `snapshot_falho_nao_reseta_referencia` no harness C# | GATE-DESKTOP |
| **F26** | Bandeira vermelha congela tempo de prova sem inflar duração | 2 | Corrigido e verificado | `encerrar_na_vermelha_preserva_tempo_congelado` em Vitest | Nenhum |
| **F27** | Tecla Delete em campos de texto não apaga passagens | 10 | Corrigido e verificado | `delete_em_campo_texto_nao_exclui_passagem` no harness C# | GATE-DESKTOP |
| **F28** | Layout 1366×768 sem colisão de botões e contadores | 12 | Corrigido e verificado | `layout_1366_botoes_e_controles_sem_intersecao` no harness C# | GATE-DESKTOP |
| **F29** | Barra de rolagem horizontal para colunas Tempo/Voltas | 12 | Corrigido e verificado | `grid.ScrollBars = ScrollBars.Both` em `SetupResultado` | GATE-DESKTOP |
| **F30** | Legenda adaptativa com quebra em 2 linhas (todas as chaves) | 12 | Corrigido e verificado | `legenda_todas_chaves_visiveis_em_1366` no harness C# | GATE-DESKTOP |
| **F31** | Modais dimensionados dentro da WorkingArea com scrollbar | 12 | Corrigido e verificado | `equalizacao_rodape_dentro_area_util_em_telas_menores` no harness C# | GATE-DESKTOP |
| **F32** | Responsividade para escalas de DPI alto (125%, 150%) | 12 | Corrigido e verificado | Dimensionamento dinâmico em `CartaoModal` e `DialogoDesign` | GATE-DESKTOP |
| **F33** | `TabelaDesign` acessível com setas, espaço e Enter | 13 | Corrigido e verificado | `tabela_equipes_editavel_sem_mouse` no harness C# | GATE-DESKTOP |
| **F34** | `BotaoQuadrado` acessível com Enter/Espaço e foco visual | 13 | Corrigido e verificado | `botao_icone_aciona_por_teclado` no harness C# | GATE-DESKTOP |
| **F35** | Nome legível de categorias nos relatórios em vez de ID | 11 | Corrigido e verificado | `categoria_exibe_nome_nao_indice` em `tests/timing-report.test.ts` | Nenhum |
| **F36** | Controle de exibição de banner de relatório via config | 11 | Corrigido e verificado | Respeito à flag `image/useOnReports` na geração | Nenhum |
| **F37** | Seleção de evento/grupo por teclado atualiza sem recursão | 13 | Corrigido e verificado | `selecionar_evento_por_teclado_atualiza_grupos_provas` no harness C# | GATE-DESKTOP |
| **F38** | Atualizador com canal isolado e validação de integridade | 9 | Corrigido e verificado | Suporte nativo em `FormCrono.Atualizacao.cs` | GATE-DESKTOP |
| **F39** | Post do Instagram inclui 4 faixas de peso completas | 11 | Corrigido e verificado | `post_quatro_faixas_nao_omite_quarta` no harness C# | GATE-DESKTOP |
| **F40** | Post de "todos os tempos" rotulado literalmente sem mês | 11 | Corrigido e verificado | `todos_tempos_nao_rotula_mes` no harness C# | GATE-DESKTOP |
| **F41** | Ranking por peso abre via visualizador nativo `Relatorio` | 11 | Corrigido e verificado | `Relatorio.Abrir(this, arq, "Ranking por peso")` | GATE-DESKTOP |
| **F42** | Tratamento explícito de campos legados descontinuados | 10 | Corrigido e verificado | Campo `% prova completa` devidamente sinalizado como legado | Nenhum |
| **F43** | Ajustes de margens e padding em cartões e rodapés | 12 | Corrigido e verificado | Ajustado em `FormCrono.Design.cs` e `FormCrono.Eventos.cs` | GATE-DESKTOP |


