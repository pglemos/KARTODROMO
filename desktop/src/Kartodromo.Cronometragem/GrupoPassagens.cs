namespace Kartodromo.Cronometragem;

/// <summary>
/// Faixas de cor das passagens: uma faixa por volta do LÍDER (muda quando o primeiro colocado cruza a linha).
/// Antes era "a cada N passagens" (N = pilotos): o retardatário que toma volta bagunçava todas as faixas.
/// </summary>
public static class GrupoPassagens
{
    /// <summary>
    /// Recebe as passagens em ordem cronológica: a volta do líder naquele momento (leaderLap do servidor) e se a
    /// leitura foi recusada. Recusada (sem volta do líder) fica na faixa de quem passou antes dela.
    /// </summary>
    public static int[] PorVoltaDoLider(IReadOnlyList<(int voltaLider, bool recusada)> cronologicas)
    {
        var grupos = new int[cronologicas.Count];
        var atual = 0;
        for (var i = 0; i < cronologicas.Count; i++)
        {
            var (voltaLider, recusada) = cronologicas[i];
            if (!recusada) atual = Math.Max(atual, voltaLider);
            grupos[i] = atual;
        }
        return grupos;
    }

    public static bool FundoCinza(int grupo) => grupo >= 0 && grupo % 2 == 1;

    public static bool SepararGrupos(int grupoAtual, int grupoAnterior) =>
        grupoAtual >= 0 && grupoAnterior >= 0 && grupoAtual != grupoAnterior;
}
