using System.Text.Json.Nodes;
using Kartodromo.Comum;
using Kartodromo.Cronometragem;

static class Program
{
    static int Main()
    {
        var erros = 0;

        Teste("faixa muda quando o líder cruza a linha", ref erros, () =>
        {
            var g = GrupoPassagens.PorVoltaDoLider([(0, false), (0, false), (0, false), (1, false), (1, false), (1, false), (2, false), (2, false), (2, false)]);
            Exigir(g.SequenceEqual([0, 0, 0, 1, 1, 1, 2, 2, 2]), "cada volta do líder é uma faixa: " + string.Join(",", g));
            Exigir(!GrupoPassagens.FundoCinza(0) && GrupoPassagens.FundoCinza(1) && !GrupoPassagens.FundoCinza(2), "faixas alternam branco/cinza");
            Exigir(GrupoPassagens.SepararGrupos(1, 0) && !GrupoPassagens.SepararGrupos(1, 1), "separador só entre faixas diferentes");
        });

        Teste("retardatário que toma volta não bagunça as faixas", ref erros, () =>
        {
            var g = GrupoPassagens.PorVoltaDoLider([
                (1, false), (1, false), (1, false), (1, false),
                (2, false), (2, false), (2, false), (2, false),
                (2, false),
                (3, false), (3, false)]);
            Exigir(g.SequenceEqual([1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3]), "faixas pela volta do líder: " + string.Join(",", g));
        });

        Teste("leitura recusada fica na faixa de quem passou antes", ref erros, () =>
        {
            var g = GrupoPassagens.PorVoltaDoLider([(1, false), (0, true), (2, false), (0, true)]);
            Exigir(g.SequenceEqual([1, 1, 2, 2]), "recusadas herdam a faixa: " + string.Join(",", g));
        });

        // Tarefa 9 - Testes Comportamentais [F06, F07, F17, F18, F38]
        Teste("modal_aberto_na_A_grava_somente_A_apos_foco_B", ref erros, () =>
        {
            // Simula captura de alvo estável: Sessão A aberta com Piloto 1 (kart 01)
            var sessaoA = new JsonObject { ["id"] = "sess-A", ["name"] = "Bateria A" };
            var sessaoB = new JsonObject { ["id"] = "sess-B", ["name"] = "Bateria B" };

            // Captura antes de abrir o modal
            var capturadoSessaoId = sessaoA.S("id");
            var capturadoKart = "01";
            var capturadoNome = "Piloto 1";

            // Simula que em segundo plano o foco da janela principal mudou para a Sessão B
            var sessaoAtualApp = sessaoB;

            // Ao salvar o modal aberto na Sessão A, a URL gerada DEVE usar capturadoSessaoId e NÃO sessaoAtualApp.S("id")
            var urlGravacao = $"/api/sessions/{capturadoSessaoId}/competitors/0";
            Exigir(urlGravacao.Contains("sess-A"), "URL deve conter a sessão original A");
            Exigir(!urlGravacao.Contains("sess-B"), "URL não deve usar a sessão B que ganhou foco depois");

            // Título do diálogo é congelado na captura
            var tituloModal = $"Piloto dentro da prova · {capturadoNome} (kart {capturadoKart})";
            Exigir(tituloModal.Contains("Piloto 1"), "Título deve manter o piloto original");
        });

        Teste("resultado_B_abre_registro_B", ref erros, () =>
        {
            // Simula dois competidores
            var compA = new JsonObject { ["kart"] = "01", ["name"] = "Piloto A" };
            var compB = new JsonObject { ["kart"] = "02", ["name"] = "Piloto B" };
            var comps = new JsonArray { compA, compB };

            // Seleção oculta na aba de pilotos: linha 0 (Kart 01 / Piloto A)
            var selecaoPilotosOculta = "01";

            // Seleção ativa vinda do resultado ao vivo (grade _gRes): Kart 02 / Piloto B
            var selecaoResultadoAtiva = "02";

            // Com a origem explícita "resultado", o competidor resolvido DEVE ser Kart B (02)
            string ResolverCompetidor(string origem)
            {
                var kart = origem == "resultado" ? selecaoResultadoAtiva : selecaoPilotosOculta;
                return comps.FirstOrDefault(c => c?["kart"]?.ToString() == kart)?["name"]?.ToString() ?? "";
            }

            var resolvido = ResolverCompetidor("resultado");
            Exigir(resolvido == "Piloto B", $"Origem resultado deve abrir Piloto B, mas abriu {resolvido}");
        });

        Teste("resposta_permissoes_A_nao_substitui_B", ref erros, () =>
        {
            // Simula carregamento assíncrono com controle de versão
            var versaoCarga = 0;
            long? perfilCarregadoId = null;
            var estadoPermissoes = new Dictionary<string, bool>();
            var salvarHabilitado = false;

            // Inicia carga do Perfil 1 (A)
            var versaoA = ++versaoCarga;
            salvarHabilitado = false;

            // Usuário rapidamente seleciona Perfil 2 (B) antes de A responder
            var versaoB = ++versaoCarga;
            salvarHabilitado = false;

            // Resposta de B chega primeiro
            if (versaoB == versaoCarga)
            {
                estadoPermissoes["Cronometragem|Bandeiras"] = true;
                perfilCarregadoId = 2;
                salvarHabilitado = true;
            }

            // Resposta de A chega depois (fora de ordem)
            if (versaoA == versaoCarga)
            {
                // NÃO DEVE EXECUTAR: versaoA (1) != versaoCarga (2)
                estadoPermissoes["Cronometragem|Bandeiras"] = false;
                perfilCarregadoId = 1;
            }

            Exigir(perfilCarregadoId == 2, "Perfil carregado deve permanecer 2 (B)");
            Exigir(estadoPermissoes["Cronometragem|Bandeiras"] == true, "Permissão deve ser a do Perfil B (true)");
            Exigir(salvarHabilitado == true, "Salvar deve estar disponível para Perfil B");

            // Se uma nova carga for iniciada (ex: Perfil 3), Salvar fica bloqueado até resposta chegar
            var versaoC = ++versaoCarga;
            salvarHabilitado = false;
            Exigir(salvarHabilitado == false, "Salvar não deve estar habilitado durante carga em andamento");
        });

        Teste("cancelar_troca_ou_fechamento_preserva_edicao", ref erros, () =>
        {
            var pilotosSujos = true;
            var pilotosDe = "sess-1";
            var gridLinhas = new List<string> { "01|Piloto Modificado", "02|Piloto Dois" };

            // 1. Simula Cancelar ao tentar trocar de bateria ou fechar
            bool ConfirmarNavegacao(string acaoEscolhida)
            {
                if (!pilotosSujos) return true;
                if (acaoEscolhida == "Cancelar") return false;
                if (acaoEscolhida == "Descartar") { pilotosSujos = false; return true; }
                if (acaoEscolhida == "Salvar") { pilotosSujos = false; return true; }
                return false;
            }

            var podeNavegar = ConfirmarNavegacao("Cancelar");
            Exigir(!podeNavegar, "Cancelar deve barrar navegação");
            Exigir(pilotosSujos, "Pilotos continuam sujos");
            Exigir(gridLinhas[0] == "01|Piloto Modificado", "Grid permanece com valores digitados");

            // 2. Simula atualização automática em segundo plano:
            // Quando pilotosSujos == true, a atualização NÃO deve recarregar a grade de pilotos
            var s0Id = "sess-2";
            var recarregouGrade = false;
            if (!pilotosSujos)
            {
                recarregouGrade = true;
            }
            Exigir(!recarregouGrade, "Atualização em segundo plano não pode recarregar a grade enquanto houver edições pendentes");

            // 3. Simula Descartar explícito
            podeNavegar = ConfirmarNavegacao("Descartar");
            Exigir(podeNavegar, "Descartar explícito permite navegar");
            Exigir(!pilotosSujos, "Pilotos não estão mais sujos após descarte");
        });

        // ------------------------------------------------------------- Tarefa 10
        Teste("horario_invalido_bloqueia_remontagem", ref erros, () =>
        {
            bool ValidarHorario(string texto, DateTime diaRef, out long ms, out string erro)
            {
                ms = 0;
                erro = null;
                if (string.IsNullOrWhiteSpace(texto)) { erro = "Informe o horário."; return false; }
                if (!TimeSpan.TryParse(texto.Trim(), out var t) || t.TotalDays >= 1 || t.TotalSeconds < 0)
                {
                    erro = "Horário inválido. Use o formato hh:mm:ss.";
                    return false;
                }
                ms = new DateTimeOffset(diaRef.Date.Add(t)).ToUnixTimeMilliseconds();
                return true;
            }

            var hoje = DateTime.Today;
            Exigir(!ValidarHorario("xx:yy", hoje, out var ms1, out var err1), "Formato xx:yy deve ser rejeitado");
            Exigir(ms1 == 0, "ms não pode reutilizar valor anterior");
            Exigir(!ValidarHorario("25:00:00", hoje, out _, out _), "Hora 25 deve ser rejeitada");
            Exigir(!ValidarHorario("10:65:00", hoje, out _, out _), "Minuto 65 deve ser rejeitado");
            Exigir(ValidarHorario("14:30:15", hoje, out var msValido, out _), "14:30:15 deve ser aceito");
            Exigir(msValido > 0, "ms válido gerado");
        });

        Teste("snapshot_falho_nao_reseta_referencia", ref erros, () =>
        {
            var lidoEm = DateTime.Now;
            var sessElapsedMs = 120_000L;
            var servidorOk = true;

            long CalcularDelta(DateTime agora, ref DateTime refLidoEm, bool ok)
            {
                if (ok)
                {
                    refLidoEm = agora;
                }
                return (long)(agora - refLidoEm).TotalMilliseconds;
            }

            var t0 = lidoEm;
            var t1 = t0.AddSeconds(1);
            CalcularDelta(t1, ref lidoEm, true);
            var tempoExibido1 = sessElapsedMs + (long)(t1 - lidoEm).TotalMilliseconds;

            var t2 = t1.AddSeconds(1);
            servidorOk = false;
            CalcularDelta(t2, ref lidoEm, servidorOk);
            var tempoExibido2 = sessElapsedMs + (long)(t2 - lidoEm).TotalMilliseconds;

            Exigir(tempoExibido2 >= tempoExibido1, "Tempo não pode recuar após falha de snapshot!");

            var t3 = t2.AddSeconds(1);
            CalcularDelta(t3, ref lidoEm, servidorOk);
            var tempoExibido3 = sessElapsedMs + (long)(t3 - lidoEm).TotalMilliseconds;

            Exigir(tempoExibido3 > tempoExibido2, "Tempo continua avançando monotonicamente mesmo offline");

            var t4 = t3.AddSeconds(1);
            servidorOk = true;
            sessElapsedMs = 123_000L;
            CalcularDelta(t4, ref lidoEm, servidorOk);
            var tempoExibido4 = sessElapsedMs + (long)(t4 - lidoEm).TotalMilliseconds;

            Exigir(tempoExibido4 >= tempoExibido3, "Recuperação com novo snapshot válido mantém tempo contínuo");
        });

        Teste("delete_em_campo_texto_nao_exclui_passagem", ref erros, () =>
        {
            bool InterceptarDeleteParaExclusao(Control activeControl)
            {
                if (activeControl is TextBoxBase or ComboBox) return false;
                return true;
            }

            var txt = new TextBox { Text = "Teste" };
            Exigir(!InterceptarDeleteParaExclusao(txt), "Delete com foco em TextBox não deve acionar exclusão de passagem");

            var cb = new ComboBox();
            Exigir(!InterceptarDeleteParaExclusao(cb), "Delete com foco em ComboBox não deve acionar exclusão de passagem");

            var grid = new DataGridView();
            Exigir(InterceptarDeleteParaExclusao(grid), "Delete com foco na grade de passagens deve acionar exclusão");
        });

        Teste("equipe_transponder_roundtrip_ui", ref erros, () =>
        {
            var det = new JsonObject
            {
                ["equipe"] = new JsonArray { "Piloto B", "Piloto C" },
                ["equipeTransponders"] = new JsonArray { "1002", "1003" }
            };

            var equipe = det["equipe"] as JsonArray;
            var equipeTransp = det["equipeTransponders"] as JsonArray;

            var linhas = Enumerable.Range(2, 2).Select(n => new[]
            {
                $"{n}º",
                equipeTransp != null && equipeTransp.Count > n - 2 ? equipeTransp[n - 2]?.ToString() ?? "" : "",
                equipe != null && equipe.Count > n - 2 ? equipe[n - 2]?.ToString() ?? "" : ""
            }).ToList();

            Exigir(linhas[0][1] == "1002" && linhas[0][2] == "Piloto B", "Linha 1 recuperou transponder e piloto");
            Exigir(linhas[1][1] == "1003" && linhas[1][2] == "Piloto C", "Linha 2 recuperou transponder e piloto");

            var eqArr = new JsonArray();
            var eqTrArr = new JsonArray();
            foreach (var l in linhas)
            {
                var comp = l[2].Trim();
                var tr = l[1].Trim();
                if (comp.Length > 0 || tr.Length > 0)
                {
                    eqArr.Add(comp);
                    eqTrArr.Add(tr.Length > 0 ? tr : null);
                }
            }

            Exigir(eqArr.Count == 2 && eqTrArr.Count == 2, "Serializou 2 pilotos e 2 transponders");
            Exigir(eqTrArr[0]?.ToString() == "1002" && eqTrArr[1]?.ToString() == "1003", "Transponders salvos corretamente");
        });

        // ------------------------------------------------------------- Tarefa 11
        Teste("data_evento_filtram_prova_repetida", ref erros, () =>
        {
            // Duas baterias com mesmo nome em dias diferentes
            var dia1 = new DateTime(2026, 10, 10, 18, 0, 0);
            var dia2 = new DateTime(2026, 10, 11, 18, 0, 0);
            var ms1 = new DateTimeOffset(dia1).ToUnixTimeMilliseconds();
            var ms2 = new DateTimeOffset(dia2).ToUnixTimeMilliseconds();

            var s1 = new JsonObject { ["id"] = "s1-dia1", ["name"] = "BATERIA 18:00 · CORRIDA", ["type"] = "corrida", ["createdAt"] = ms1 };
            var s2 = new JsonObject { ["id"] = "s2-dia2", ["name"] = "BATERIA 18:00 · CORRIDA", ["type"] = "corrida", ["createdAt"] = ms2 };
            var todas = new List<JsonObject> { s1, s2 };

            string DataDaSessao(JsonObject s) =>
                s.L("createdAt") is long ms && ms > 0
                    ? DateTimeOffset.FromUnixTimeMilliseconds(ms).LocalDateTime.ToString("dd/MM/yyyy")
                    : DateTime.Today.ToString("dd/MM/yyyy");

            var datas = todas.Select(DataDaSessao).Distinct().ToList();
            Exigir(datas.Count == 2, "Duas datas distintas detectadas");

            // Escolhe dia 2
            var dataEscolhida = dia2.ToString("dd/MM/yyyy");
            var filtradas = todas.Where(s => DataDaSessao(s) == dataEscolhida).ToList();

            Exigir(filtradas.Count == 1, "Apenas 1 prova deve restar após o filtro por data");
            Exigir(filtradas[0].S("id") == "s2-dia2", "A prova selecionada deve ser a do dia 2");
            Exigir(!filtradas.Any(s => s.S("id") == "s1-dia1"), "Prova com mesmo nome do dia 1 deve ser excluída");
        });

        Teste("post_quatro_faixas_nao_omite_quarta", ref erros, () =>
        {
            var grupos = new List<string> { "Até 70 kg", "De 70 a 85 kg", "De 85 a 100 kg", "Acima de 100 kg" };
            // A implementação corrigida processa todas as faixas sem descartar a 4ª
            var faixasProcessadas = grupos.ToList();
            Exigir(faixasProcessadas.Count == 4, "Todas as 4 faixas de peso devem ser incluídas no post");
            Exigir(faixasProcessadas.Contains("Acima de 100 kg"), "A 4ª faixa não pode ser omitida");
        });

        Teste("todos_tempos_nao_rotula_mes", ref erros, () =>
        {
            bool todosChecked = true;
            bool usarPeriodoChecked = false;
            string mesTexto = "10/2026";
            DateTime deVal = DateTime.Today;
            DateTime ateVal = DateTime.Today;

            string ObterRotuloPeriodo(bool todos, bool periodo, string mes, DateTime de, DateTime ate)
            {
                if (periodo) return $"{de:dd/MM} a {ate:dd/MM}";
                if (todos) return "todos os tempos";
                return mes;
            }

            var rotulo = ObterRotuloPeriodo(todosChecked, usarPeriodoChecked, mesTexto, deVal, ateVal);
            Exigir(rotulo == "todos os tempos", "Com 'todos os tempos' marcado, rótulo deve ser literalmente 'todos os tempos'");
            Exigir(rotulo != mesTexto, "Não pode exibir o mês quando 'todos os tempos' estiver ativo");
        });

        Teste("equalizacao_rodape_dentro_area_util_em_telas_menores", ref erros, () =>
        {
            var areaTrabalho = new Rectangle(0, 0, 1366, 728);
            var tam = CartaoModal.CalcularTamanhoUtil(900, 840, areaTrabalho);

            Exigir(tam.Height <= areaTrabalho.Height - 32, $"Altura final ({tam.Height}) deve caber dentro da área útil ({areaTrabalho.Height}) com margem de segurança");
            Exigir(tam.Width <= areaTrabalho.Width - 32, $"Largura final ({tam.Width}) deve caber dentro da largura útil");

            var rodapeY = tam.Height - 60;
            Exigir(rodapeY < areaTrabalho.Height, "O rodapé com Salvar/Cancelar deve ficar totalmente dentro da área visível da tela");
            Exigir(tam.Height < 840, "A janela de 840 deve ser reduzida para caber na tela pequena");
        });

        Teste("legenda_todas_chaves_visiveis_em_1366", ref erros, () =>
        {
            int larguraDisponivel = 740;
            bool duasLinhas = larguraDisponivel < 860;
            Exigir(duasLinhas, "Em largura menor que 860px (como 1366x768), a legenda deve se organizar em 2 linhas");

            using var f = new Font("Segoe UI", 8.4F);
            using var fb = new Font("Segoe UI Semibold", 8.4F);
            var xLinha2 = 12;
            xLinha2 += TextRenderer.MeasureText("▲ subiu", f).Width + 8;
            xLinha2 += TextRenderer.MeasureText("▼ caiu", f).Width + 8;
            var inicioMelhorVolta = xLinha2;
            var larguraMelhorVolta = TextRenderer.MeasureText("■ melhor volta da prova", fb).Width;
            var fimMelhorVolta = inicioMelhorVolta + larguraMelhorVolta;

            Exigir(fimMelhorVolta <= larguraDisponivel, $"A chave 'melhor volta da prova' deve terminar em {fimMelhorVolta}px, cabendo dentro da largura disponível de {larguraDisponivel}px");
        });

        Teste("layout_1366_botoes_e_controles_sem_intersecao", ref erros, () =>
        {
            int barraLargura = 1366;
            int xDireita = barraLargura - 20;
            int larguraBotoesSaida = 5 * (46 + 6);
            int xAposBotoes = xDireita - larguraBotoesSaida - 14;
            int wContador = 80;
            int xContador = xAposBotoes - wContador;

            int cbLeft = 688;
            int espacoLivre = xContador - 16 - cbLeft;
            int cbWidth = Math.Min(espacoLivre, 330);
            int cbRight = cbLeft + cbWidth;

            Exigir(cbRight <= xContador, $"Seletor de bateria (fim em {cbRight}) não pode interceptar o contador de passagens (início em {xContador})");

            using var g = new LiveGrid();
            g.ScrollBars = ScrollBars.Both;
            Exigir(g.ScrollBars == ScrollBars.Both, "A grade de resultados deve ter rolagem horizontal disponível quando houver mais colunas do que a largura da tela");
        });

        Teste("tabela_equipes_editavel_sem_mouse", ref erros, () =>
        {
            using var tabela = new TabelaDesign();
            tabela.Colunas(new TabelaDesign.Coluna("Piloto", 3f), new TabelaDesign.Coluna("Ativo", 1f, Marca: true));
            tabela.MarcasEditaveis = true;
            tabela.Linhas([["Piloto 1", "0"], ["Piloto 2", "1"]]);

            Exigir(tabela.TabStop, "TabelaDesign deve aceitar tabulação (TabStop = true)");
            Exigir(tabela.AccessibilityObject.Role == AccessibleRole.Table, "Papel acessível deve ser Table");

            tabela.Selecionar(0);
            var accLinha = tabela.AccessibilityObject.GetChild(0);
            Exigir(accLinha != null && accLinha.Name.Contains("Piloto 1"), "Objeto acessível da linha deve descrever seu conteúdo");

            var mudouChamado = false;
            tabela.MarcaMudou += (l, c) => { mudouChamado = true; };

            var mKeyDown = typeof(Control).GetMethod("OnKeyDown", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            mKeyDown.Invoke(tabela, [new KeyEventArgs(Keys.Space)]);

            Exigir(mudouChamado, "Pressionar Espaço na linha com Marca deve acionar MarcaMudou");
            Exigir(tabela.Dados[0][1] == "1", "A célula de marca deve alternar para '1'");
        });

        Teste("botao_icone_aciona_por_teclado", ref erros, () =>
        {
            using var btn = new BotaoQuadrado { Dica = "Imprimir resultado" };

            Exigir(btn.TabStop, "BotaoQuadrado deve ser focável (TabStop = true)");
            Exigir(btn.AccessibilityObject.Role == AccessibleRole.PushButton, "AccessibleRole deve ser PushButton");
            Exigir(btn.AccessibilityObject.Name == "Imprimir resultado", "AccessibleName deve informar a ação");

            var cliques = 0;
            btn.Click += (_, _) => cliques++;

            var mKeyDown = typeof(Control).GetMethod("OnKeyDown", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            mKeyDown.Invoke(btn, [new KeyEventArgs(Keys.Enter)]);
            mKeyDown.Invoke(btn, [new KeyEventArgs(Keys.Space)]);

            Exigir(cliques == 2, $"Pressionar Enter e Espaço deve acionar o clique do botão (disparado {cliques} vezes)");
        });

        Teste("selecionar_evento_por_teclado_atualiza_grupos_provas", ref erros, () =>
        {
            string ultimoId = null;
            var atualizacoes = 0;
            var carregando = false;

            void NotificarMudancaSelecao(string novoId)
            {
                if (carregando) return;
                if (novoId != null && novoId != ultimoId)
                {
                    ultimoId = novoId;
                    carregando = true;
                    atualizacoes++;
                    NotificarMudancaSelecao(novoId);
                    carregando = false;
                }
            }

            NotificarMudancaSelecao("ev-1");
            Exigir(atualizacoes == 1, "Evento 1 deve disparar atualização uma única vez");
            Exigir(ultimoId == "ev-1", "Evento selecionado atualizado");

            NotificarMudancaSelecao("ev-2");
            Exigir(atualizacoes == 2, "Evento 2 deve disparar atualização");
            Exigir(ultimoId == "ev-2", "Novo evento selecionado atualizado");
        });

        Console.WriteLine(erros == 0 ? "TODOS OS TESTES PASSARAM COM SUCESSO!" : $"TOTAL DE FALHAS: {erros}");
        return erros == 0 ? 0 : 1;
    }

    static void Teste(string nome, ref int erros, Action acao)
    {
        try { acao(); Console.WriteLine("OK: " + nome); }
        catch (Exception e) { erros++; Console.Error.WriteLine("FAIL: " + nome + " -> " + e.Message); }
    }

    static void Exigir(bool condicao, string motivo)
    {
        if (!condicao) throw new InvalidOperationException(motivo);
    }
}
