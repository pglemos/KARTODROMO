using System.Text.Json.Nodes;

namespace Kartodromo.Cronometragem;

static class TestesPainel
{
    public static void Executar()
    {
        Console.WriteLine("=== INICIANDO TESTES DO PAINEL LED (COM3) ===");

        // Teste 1: Tomada de tempo com 25 pilotos e paginação
        TestarPaginacaoTomadaDeTempo();

        // Teste 2: Corrida com largada (volta 0) mostrando 00:00:00.000 para quem passou
        TestarCorridaVoltaZero();

        // Teste 3: Corrida com volta 1 completada mostrando tempo real
        TestarCorridaVoltaCompletada();

        // Teste 4: Retenção de classificação da tomada de tempo para montagem do grid
        TestarRetencaoClassificacaoGrid();

        Console.WriteLine("=== TODOS OS TESTES PASSARAM COM SUCESSO! ===");
    }

    static void Assert(bool condicao, string mensagem)
    {
        if (!condicao)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("[FALHA] " + mensagem);
            Console.ResetColor();
            Environment.Exit(1);
        }
        else
        {
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("[OK] " + mensagem);
            Console.ResetColor();
        }
    }

    static JsonObject CriarSessaoQualificacao(int numPilotos)
    {
        var sessao = new JsonObject
        {
            ["id"] = "qualif-100",
            ["name"] = "Bateria 16:00 · Tomada de Tempo",
            ["type"] = "classificacao",
            ["state"] = "encerrada",
            ["maxLaps"] = 0,
            ["remainingMs"] = 0,
            ["elapsedMs"] = 300000,
        };
        var standings = new JsonArray();
        for (var i = 1; i <= numPilotos; i++)
        {
            standings.Add(new JsonObject
            {
                ["position"] = i,
                ["kart"] = (i * 2).ToString(),
                ["laps"] = 10,
                ["bestLapMs"] = 42000 + i * 250,
                ["lastLapMs"] = 43000 + i * 200,
                ["totalMs"] = 420000 + i * 1000,
            });
        }
        sessao["standings"] = standings;
        return sessao;
    }

    static void TestarPaginacaoTomadaDeTempo()
    {
        Console.WriteLine("\n-- Teste 1: Paginação da Tomada de Tempo (25 pilotos) --");
        var qualif = CriarSessaoQualificacao(25);

        // Pagina 0: pilotos 1 a 10 (posições físicas 1 a 10)
        var p0 = PainelLed.Montar(qualif, 0, 10, DateTime.Now, out _);
        Assert(p0.Contains("$SP,1,\"002\",10,\"00:00:42.250\""), "Pagina 0 deve conter piloto 1 na linha física 1 com tempo correto");
        Assert(p0.Contains("$SP,10,\"020\",10,\"00:00:44.500\""), "Pagina 0 deve conter piloto 10 na linha física 10");
        Assert(!p0.Contains("$SP,1,\"022\""), "Pagina 0 não deve conter piloto 11");

        // Pagina 1: pilotos 11 a 20 (posições físicas 1 a 10)
        var p1 = PainelLed.Montar(qualif, 1, 10, DateTime.Now, out _);
        Assert(p1.Contains("$SP,1,\"022\",10,\"00:00:44.750\""), "Pagina 1 deve mapear piloto 11 para a linha física 1 do painel");
        Assert(p1.Contains("$SP,10,\"040\",10,\"00:00:47.000\""), "Pagina 1 deve mapear piloto 20 para a linha física 10 do painel");

        // Pagina 2: pilotos 21 a 25 (posições físicas 1 a 5)
        var p2 = PainelLed.Montar(qualif, 2, 10, DateTime.Now, out _);
        Assert(p2.Contains("$SP,1,\"042\",10,\"00:00:47.250\""), "Pagina 2 deve mapear piloto 21 para a linha física 1 do painel");
        Assert(p2.Contains("$SP,5,\"050\",10,\"00:00:48.250\""), "Pagina 2 deve mapear piloto 25 para a linha física 5 do painel");
        Assert(!p2.Contains("$SP,6,"), "Pagina 2 não deve conter linha física 6 pois só há 25 pilotos");
    }

    static void TestarCorridaVoltaZero()
    {
        Console.WriteLine("\n-- Teste 2: Corrida com largada (volta 0 - karts que passaram na linha) --");
        var corrida = new JsonObject
        {
            ["id"] = "race-200",
            ["name"] = "Bateria 16:30 · Corrida",
            ["type"] = "corrida",
            ["state"] = "em_andamento",
            ["maxLaps"] = 15,
            ["remainingMs"] = 600000,
            ["elapsedMs"] = 10000,
        };

        // 3 karts passaram na linha na largada (laps = 0, lastLapMs = null, lastCrossingWallMs > 0)
        // 1 kart ainda não passou na linha (lastCrossingWallMs = null, lastLapMs = null)
        var standings = new JsonArray
        {
            new JsonObject { ["position"] = 1, ["kart"] = "15", ["laps"] = 0, ["lastLapMs"] = null, ["totalMs"] = null, ["lastCrossingWallMs"] = 1790450000000 },
            new JsonObject { ["position"] = 2, ["kart"] = "8", ["laps"] = 0, ["lastLapMs"] = null, ["totalMs"] = null, ["lastCrossingWallMs"] = 1790450000500 },
            new JsonObject { ["position"] = 3, ["kart"] = "23", ["laps"] = 0, ["lastLapMs"] = null, ["totalMs"] = null, ["lastCrossingWallMs"] = 1790450001000 },
            new JsonObject { ["position"] = 4, ["kart"] = "99", ["laps"] = 0, ["lastLapMs"] = null, ["totalMs"] = null, ["lastCrossingWallMs"] = null },
        };
        corrida["standings"] = standings;

        var pacote = PainelLed.Montar(corrida, 0, 10, DateTime.Now, out _);

        // Deve conter os karts 15, 8, 23 com 0 voltas e tempo 00:00:00.000
        Assert(pacote.Contains("$SR,1,\"015\",0,\"00:00:00.000\""), "Kart 15 que passou na linha deve aparecer na pos 1 com tempo 00:00:00.000");
        Assert(pacote.Contains("$SR,2,\"008\",0,\"00:00:00.000\""), "Kart 8 que passou na linha deve aparecer na pos 2 com tempo 00:00:00.000");
        Assert(pacote.Contains("$SR,3,\"023\",0,\"00:00:00.000\""), "Kart 23 que passou na linha deve aparecer na pos 3 com tempo 00:00:00.000");

        // Kart 99 não passou na linha, NÃO deve aparecer no painel
        Assert(!pacote.Contains("\"099\""), "Kart 99 que ainda não passou na linha não deve aparecer no painel");
    }

    static void TestarCorridaVoltaCompletada()
    {
        Console.WriteLine("\n-- Teste 3: Corrida com volta completada (tempo real sobe no painel) --");
        var corrida = new JsonObject
        {
            ["id"] = "race-200",
            ["name"] = "Bateria 16:30 · Corrida",
            ["type"] = "corrida",
            ["state"] = "em_andamento",
            ["maxLaps"] = 15,
            ["remainingMs"] = 555000,
            ["elapsedMs"] = 45000,
        };

        var standings = new JsonArray
        {
            // Kart 15 completou volta 1 em 44.821s
            new JsonObject { ["position"] = 1, ["kart"] = "15", ["laps"] = 1, ["lastLapMs"] = 44821, ["totalMs"] = 44821, ["lastCrossingWallMs"] = 1790450044821 },
            // Kart 8 ainda na volta 0
            new JsonObject { ["position"] = 2, ["kart"] = "8", ["laps"] = 0, ["lastLapMs"] = null, ["totalMs"] = null, ["lastCrossingWallMs"] = 1790450000500 },
        };
        corrida["standings"] = standings;

        var pacote = PainelLed.Montar(corrida, 0, 10, DateTime.Now, out _);
        Assert(pacote.Contains("$SR,1,\"015\",1,\"00:00:44.821\""), "Kart 15 completou volta 1 e seu tempo real deve subir no painel de LED");
        Assert(pacote.Contains("$SR,2,\"008\",0,\"00:00:00.000\""), "Kart 8 continua na volta 0 com 00:00:00.000");
    }

    static void TestarRetencaoClassificacaoGrid()
    {
        Console.WriteLine("\n-- Teste 4: Retenção da classificação para montagem do grid --");
        using var painel = new PainelLed();

        var qualifFinalizada = CriarSessaoQualificacao(24);
        var corridaPreparando = new JsonObject
        {
            ["id"] = "race-prepare",
            ["name"] = "Bateria 16:30 · Corrida",
            ["type"] = "corrida",
            ["state"] = "preparando",
            ["standings"] = new JsonArray()
        };
        var corridaEmAndamento = new JsonObject
        {
            ["id"] = "race-running",
            ["name"] = "Bateria 16:30 · Corrida",
            ["type"] = "corrida",
            ["state"] = "em_andamento",
            ["standings"] = new JsonArray()
        };

        // 1. Recebe qualificação finalizada
        painel.Atualizar(qualifFinalizada);
        Assert(painel.EmModoGrid, "Ao receber tomada de tempo finalizada, deve entrar em Modo Grid");
        Assert(painel.TotalPilotos == 24, "Total de pilotos deve ser 24");
        Assert(painel.TotalPaginas == 3, "Total de páginas deve ser 3");
        Assert(painel.SessaoExibidaNome.Contains("Tomada de Tempo"), "Nome exibido deve ser da tomada de tempo");

        // 2. Operador prepara a corrida (estado = preparando). O painel NÃO pode apagar a tomada de tempo!
        painel.Atualizar(corridaPreparando);
        Assert(painel.EmModoGrid, "Ao focar em corrida em preparação, DEVE MANTER Modo Grid");
        Assert(painel.TotalPilotos == 24, "Total de pilotos deve continuar 24");
        Assert(painel.TotalPaginas == 3, "Total de páginas deve continuar 3");
        Assert(painel.SessaoExibidaNome.Contains("Tomada de Tempo"), "Sessão exibida deve continuar sendo a tomada de tempo para montagem do grid");

        // 3. Testar troca de páginas do grid
        painel.DefinirPagina(1);
        Assert(painel.Pagina == 1, "Página deve mudar para 1 (11 a 20)");
        painel.DefinirPagina(2);
        Assert(painel.Pagina == 2, "Página deve mudar para 2 (21 a 24)");

        // 4. Operador dá bandeira verde na corrida (estado = em_andamento)
        painel.Atualizar(corridaEmAndamento);
        Assert(!painel.EmModoGrid, "Com bandeira verde na corrida, sai do Modo Grid");
        Assert(painel.Pagina == 0, "Página deve resetar para 0 na largada da corrida");
        Assert(painel.SessaoExibidaNome.Contains("Corrida"), "Sessão exibida deve mudar para a corrida");
    }
}
