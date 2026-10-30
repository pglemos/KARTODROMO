using Kartodromo.Cronometragem;
using Kartodromo.Comum;
using System.Reflection;
using System.Text.Json.Nodes;
using System.Windows.Forms;

static class Program
{
    [STAThread]
    static int Main()
    {
        var erros = 0;
        Teste("janela de campos (DialogoDados) no visual padrão: campos, Gravar/Cancelar e Valor()", ref erros, () =>
        {
            using var d = new DialogoDados("Atribuir passagem", "Escolha o número e o nome do competidor",
                new[] { ("Número do kart", "kart", "12"), ("Nome do competidor", "nome", "Maria Aparecida dos Santos Oliveira") }, new Size(640, 300));
            d.StartPosition = FormStartPosition.Manual; d.Location = new Point(-4000, 0); d.ShowInTaskbar = false;
            d.Show(); Application.DoEvents();
            Exigir(d.Valor("kart") == "12" && d.Valor("NOME").StartsWith("Maria"), "Valor() não leu os campos");
            Exigir(d.AcceptButton is Button { Text: "Gravar e fechar" }, "Enter não grava");
            var pasta = Environment.GetEnvironmentVariable("KARTODROMO_FOTOS");
            if (!string.IsNullOrEmpty(pasta)) { using var bmp = new Bitmap(d.Width, d.Height); d.DrawToBitmap(bmp, new Rectangle(0, 0, d.Width, d.Height)); bmp.Save(Path.Combine(pasta, "dialogo-dados.png")); }
            d.Close();
            using var muitos = new DialogoDados("Editar registro", "Passo 1 · evento", Enumerable.Range(1, 10).Select(i => ($"Campo {i}", $"c{i}", $"valor {i}")).ToArray());
            muitos.StartPosition = FormStartPosition.Manual; muitos.Location = new Point(-4000, 0); muitos.ShowInTaskbar = false;
            muitos.Show(); Application.DoEvents();
            Exigir(muitos.Valor("c10") == "valor 10", "10º campo");
            if (!string.IsNullOrEmpty(pasta)) { using var bmp = new Bitmap(muitos.Width, muitos.Height); muitos.DrawToBitmap(bmp, new Rectangle(0, 0, muitos.Width, muitos.Height)); bmp.Save(Path.Combine(pasta, "dialogo-dados-10.png")); }
            muitos.Close();
        });
        Teste("piloto sem kart: ações do resultado não abrem aviso modal", ref erros, () =>
        {
            Environment.SetEnvironmentVariable("KARTODROMO_SEM_PAINEL", "1");
            using var tela = new FormCrono("teste-sem-kart");
            var tipo = typeof(FormCrono);
            tipo.GetField("_sess", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(tela,
                new JsonObject { ["id"] = "teste", ["state"] = "preparando" });
            var linha = new JsonObject { ["name"] = "Piloto sem kart", ["kart"] = "" };
            var avisos = new List<string>();
            Msg.Registro = avisos.Add;
            try
            {
                tipo.GetMethod("EditarPosicao", BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(tela, [linha]);
                tipo.GetMethod("RetirarUltimaVolta", BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(tela, [linha]);
                Exigir(avisos.Count == 2 && avisos.All(a => a.StartsWith("TOAST (Aviso):") && a.Contains("ainda não tem kart")),
                    "ações sem kart abriram janela bloqueante: " + string.Join(" | ", avisos));
            }
            finally { Msg.Registro = null; }
        });
        Teste("voltas do kart e transponders no visual padrão (só com KARTODROMO_FOTOS: lê o servidor)", ref erros, () =>
        {
            var pasta = Environment.GetEnvironmentVariable("KARTODROMO_FOTOS");
            if (string.IsNullOrEmpty(pasta)) return;
            void Foto(Form j, string nome)
            {
                j.StartPosition = FormStartPosition.Manual; j.Location = new Point(-4000, 0); j.ShowInTaskbar = false;
                j.Show(); for (var i = 0; i < 60; i++) { Application.DoEvents(); Thread.Sleep(50); }
                using var bmp = new Bitmap(j.Width, j.Height); j.DrawToBitmap(bmp, new Rectangle(0, 0, j.Width, j.Height)); bmp.Save(Path.Combine(pasta, nome));
                j.Close();
            }
            using (var v = new FormVoltas(Environment.GetEnvironmentVariable("KARTODROMO_SESSAO") ?? "", Environment.GetEnvironmentVariable("KARTODROMO_KART") ?? "1")) Foto(v, "voltas.png");
            using (var t = new FormTransponders(["9999999"])) Foto(t, "transponders.png");
        });
        Teste("lista de baterias do alto: só as do dia, na ordem do horário (tomada antes da corrida)", ref erros, () =>
        {
            var hoje = new DateTime(2026, 10, 10);
            long Em(DateTime d) => new DateTimeOffset(d).ToUnixTimeMilliseconds();
            System.Text.Json.Nodes.JsonObject Ses(string id, string nome, string tipo, string estado, DateTime criada) => new() { ["id"] = id, ["name"] = nome, ["type"] = tipo, ["state"] = estado, ["createdAt"] = Em(criada) };
            var lista = new[]
            {
                Ses("a", "BATERIA 09:15 · CORRIDA", "corrida", "em_andamento", hoje.AddHours(8.6)),
                Ses("b", "BATERIA 09:15 · TOMADA DE TEMPO", "classificacao", "encerrada", hoje.AddHours(8.6)),
                Ses("c", "BATERIA 17:25 · CORRIDA", "corrida", "preparando", hoje),
                Ses("d", "BATERIA 09:50 · CORRIDA", "corrida", "preparando", hoje),
                Ses("e", "BATERIA 09:50 · TOMADA DE TEMPO", "classificacao", "preparando", hoje),
                Ses("f", "BATERIA 21:40 · CORRIDA", "corrida", "encerrada", hoje.AddDays(-1).AddHours(19.5)),   // ontem: fora
                Ses("g", "KART LIGTH 09/10", "equalizacao", "encerrada", hoje.AddDays(-1).AddHours(10.9)),        // ontem: fora
                Ses("h", "BIER KART I · CORRIDA", "corrida", "em_andamento", hoje.AddDays(-2)),                   // aberta: fica
            };
            var ids = string.Join(",", FormCrono.SessoesDoDia(lista, "g", hoje).Select(x => (string)x["id"]!));
            Exigir(ids == "b,a,e,d,c,h,g", "ordem/filtro: " + ids);
            Exigir(string.Join(",", FormCrono.SessoesDoDia(lista, null, hoje).Select(x => (string)x["id"]!)) == "b,a,e,d,c,h", "sem a selecionada de ontem");
        });
        Teste("faixa muda quando o líder cruza a linha", ref erros, () =>
        {
            // 3 karts: largada (líder 0), volta 1 dos três, volta 2 dos três
            var g = GrupoPassagens.PorVoltaDoLider([(0, false), (0, false), (0, false), (1, false), (1, false), (1, false), (2, false), (2, false), (2, false)]);
            Exigir(g.SequenceEqual([0, 0, 0, 1, 1, 1, 2, 2, 2]), "cada volta do líder é uma faixa: " + string.Join(",", g));
            Exigir(!GrupoPassagens.FundoCinza(0) && GrupoPassagens.FundoCinza(1) && !GrupoPassagens.FundoCinza(2), "faixas alternam branco/cinza");
            Exigir(GrupoPassagens.SepararGrupos(1, 0) && !GrupoPassagens.SepararGrupos(1, 1), "separador só entre faixas diferentes");
        });
        Teste("retardatário que toma volta não bagunça as faixas", ref erros, () =>
        {
            // 5 pilotos; o kart lento ainda fecha a volta 1 quando o líder já está na volta 2: fica na faixa 2,
            // e a faixa 3 começa exatamente quando o líder passa de novo (antes: blocos de 5 passagens escorregavam)
            var g = GrupoPassagens.PorVoltaDoLider([
                (1, false), (1, false), (1, false), (1, false), // volta 1 de 4 karts
                (2, false), (2, false), (2, false), (2, false), // líder abre a volta 2; o lento fecha a 1 aqui dentro
                (2, false),
                (3, false), (3, false)]);
            Exigir(g.SequenceEqual([1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3]), "faixas pela volta do líder: " + string.Join(",", g));
        });
        Teste("leitura recusada fica na faixa de quem passou antes", ref erros, () =>
        {
            var g = GrupoPassagens.PorVoltaDoLider([(1, false), (0, true), (2, false), (0, true)]);
            Exigir(g.SequenceEqual([1, 1, 2, 2]), "recusadas herdam a faixa: " + string.Join(",", g));
        });
        Teste("placar de LED (COM3): quadro completo com tempo e rodapé $F", ref erros, () =>
        {
            Environment.SetEnvironmentVariable("KARTODROMO_SEM_PAINEL", "1"); // nunca abre a COM3 no teste
            var painel = new PainelLed();
            var agora = new DateTime(2026, 10, 8, 20, 0, 0);
            var sessao = Corrida(10);
            var quadro = painel.MontarAlteracoes(sessao, agora);
            Exigir(Contar(quadro, "$SR,") == 10 && Contar(quadro, "$F,") == 1, "quadro inteiro contém 10 posições + rodapé $F");
            var bytes = System.Text.Encoding.ASCII.GetByteCount(quadro);
            Exigir(bytes > 900, $"quadro completo com {bytes} bytes");

            // tomada de tempo / grid: melhor tempo em $SP e $H
            var qualif = new System.Text.Json.Nodes.JsonObject
            {
                ["type"] = "classificacao",
                ["state"] = "encerrada",
                ["standings"] = new System.Text.Json.Nodes.JsonArray
                {
                    new System.Text.Json.Nodes.JsonObject { ["position"] = 1, ["kart"] = "12", ["laps"] = 5, ["bestLapMs"] = 43250, ["lastLapMs"] = null }
                }
            };
            var quadroQ = PainelLed.Montar(qualif, 0, 10, agora, out _);
            Exigir(quadroQ.Contains("$SP,1,\"012\",5,\"00:00:43.250\""), "SP com tempo correto");
            Exigir(quadroQ.Contains("$H,1,\"012\",5,\"00:00:43.250\""), "H com tempo correto sem zerar");
            Exigir(quadroQ.Contains("$F,"), "F presente mesmo em tomada de tempo");
        });
        Teste("placar de LED: o quadro montado continua igual ao do LapTime ($SR/$J/$G + $F)", ref erros, () =>
        {
            var texto = PainelLed.Montar(Corrida(2), 0, 10, new DateTime(2026, 10, 8, 20, 0, 0), out _);
            var (posicoes, rodape) = PainelLed.MontarQuadro(Corrida(2), 0, 10, new DateTime(2026, 10, 8, 20, 0, 0));
            Exigir(texto == string.Concat(posicoes) + rodape, "quadro por posição + rodapé = quadro inteiro");
            Exigir(posicoes[0].StartsWith("$SR,1,\"004\",5,") && posicoes[0].Contains("$J,\"004\"") && posicoes[0].Contains("$G,1,"), posicoes[0]);
        });
        Teste("lista de passagens: passagem nova não reescreve a lista inteira", ref erros, () =>
        {
            object[] L(int n, string nome) => [n, "7", nome];
            Exigir(LiveGrid.LinhasNovasNoTopo([L(2, "B"), L(1, "A")], [L(3, "C"), L(2, "B"), L(1, "A")]) == 1, "1 nova no topo");
            Exigir(LiveGrid.LinhasNovasNoTopo([L(2, "B"), L(1, "A")], [L(3, "C"), L(2, "X"), L(1, "A")]) == 0, "linha antiga mudou: reescreve");
            Exigir(LiveGrid.LinhasNovasNoTopo([], [L(1, "A")]) == 0 && LiveGrid.LinhasNovasNoTopo([L(1, "A")], [L(1, "A")]) == 0, "vazia/igual: caminho normal");
            foreach (var n in new[] { 400, 2500 })
            {
                using var f = new Form { StartPosition = FormStartPosition.Manual, Location = new System.Drawing.Point(-4000, 0), Size = new System.Drawing.Size(900, 700), ShowInTaskbar = false };
                var g = new LiveGrid();
                g.Col("#", 36).Col("Nº", 42, filtro: true).Col("Competidor", 130, DataGridViewContentAlignment.MiddleLeft, true, filtro: true).Col("Transp.", 72, filtro: true).Col("Tempo", 76).Col("Voltas", 66, filtro: true).Col("Líder", 50).Col("Hora", 84).Col("Situação", 150, DataGridViewContentAlignment.MiddleLeft, filtro: true);
                f.Controls.Add(g); f.Show(); Application.DoEvents();
                _ = g.AccessibilityObject; // como quando um leitor de acessibilidade (ex.: controle de tela) já olhou a grade
                List<object[]> Lista(int total) => Enumerable.Range(0, total).Select(i => new object[] { total - i, (i % 14 + 1).ToString(), "Piloto " + (i % 14), "1000" + i % 14, $"0:5{i % 10}.{i:000}", (total - i) / 14, (total - i) / 14, $"20:{i % 60:00}:{i % 60:00}.4", "contou" }).ToList();
                g.Preencher(Lista(n)); Application.DoEvents();
                var sw = System.Diagnostics.Stopwatch.StartNew();
                for (var k = 1; k <= 5; k++) { g.Preencher(Lista(n + k)); Application.DoEvents(); }
                var nova = sw.Elapsed.TotalMilliseconds / 5;
                sw.Restart();
                for (var k = 0; k < 5; k++) { g.Preencher(Lista(n + 5)); Application.DoEvents(); }
                var igual = sw.Elapsed.TotalMilliseconds / 5;
                Console.WriteLine($"   {n} passagens: passagem nova {nova:0} ms · nada mudou {igual:0} ms");
                Exigir(g.Rows.Count == n + 5 && g.Rows[0].Cells[0].Value?.ToString() == (n + 5).ToString() && g.Rows[n + 4].Cells[0].Value?.ToString() == "1", "ordem certa depois de inserir no topo");
                f.Close();
            }
        });
        Console.WriteLine(erros == 0 ? "PASS: agrupamento de cores das passagens" : $"FAIL: {erros} teste(s)");
        return erros == 0 ? 0 : 1;
    }

    /// <summary>Corrida com <paramref name="n"/> karts (kart = posição + 3); <paramref name="mudar"/> = posição que fechou mais uma volta.</summary>
    static System.Text.Json.Nodes.JsonObject Corrida(int n, int mudar = 0)
    {
        var st = new System.Text.Json.Nodes.JsonArray();
        for (var p = 1; p <= n; p++)
        {
            var volta = p == mudar ? 6 : 5;
            st.Add(new System.Text.Json.Nodes.JsonObject
            {
                ["position"] = p, ["kart"] = (p + 3).ToString(), ["laps"] = volta,
                ["lastLapMs"] = 63_000 + p * 100 + (p == mudar ? 7 : 0), ["bestLapMs"] = 62_000 + p * 100,
                ["totalMs"] = 320_000 + p * 1_000 + (p == mudar ? 63_000 : 0), ["lastCrossingWallMs"] = 1_000,
            });
        }
        return new System.Text.Json.Nodes.JsonObject
        {
            ["id"] = "b1", ["name"] = "BATERIA 20:00", ["type"] = "corrida", ["state"] = "em_andamento",
            ["remainingMs"] = 300_000, ["elapsedMs"] = 300_000, ["standings"] = st,
        };
    }

    static int Contar(string texto, string trecho)
    {
        var n = 0;
        for (var i = texto.IndexOf(trecho, StringComparison.Ordinal); i >= 0; i = texto.IndexOf(trecho, i + 1, StringComparison.Ordinal)) n++;
        return n;
    }

    static void Teste(string nome, ref int erros, Action acao)
    {
        try { acao(); Console.WriteLine("OK: " + nome); }
        catch (Exception e) { erros++; Console.Error.WriteLine("FAIL: " + nome + " — " + e.Message); }
    }

    static void Exigir(bool condicao, string motivo)
    {
        if (!condicao) throw new InvalidOperationException(motivo);
    }
}
