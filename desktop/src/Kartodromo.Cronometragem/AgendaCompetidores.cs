using System.Text.Json.Nodes;

namespace Kartodromo.Cronometragem;

/// <summary>Reconcilia a lista da cronometragem com as inscricoes atuais da recepcao.</summary>
internal static class AgendaCompetidores
{
    internal static bool PodeSincronizarAutomaticamente(string estado, string sessaoId, string runningId, bool temPassagens, bool listaSuja, bool editandoCelula) =>
        estado == "preparando" &&
        !string.IsNullOrWhiteSpace(sessaoId) &&
        (string.IsNullOrWhiteSpace(runningId) || !string.Equals(sessaoId, runningId, StringComparison.Ordinal)) &&
        !temPassagens &&
        !listaSuja &&
        !editandoCelula;

    internal static JsonArray Sincronizar(IEnumerable<JsonObject> atuais, IEnumerable<JsonObject> agenda)
    {
        static string Texto(JsonNode valor) => valor?.ToString().Trim() ?? "";

        var porCliente = atuais
            .Where(c => Texto(c["customerId"]).Length > 0)
            .GroupBy(c => Texto(c["customerId"]), StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);
        var resultado = new JsonArray();
        var incluidos = new HashSet<string>(StringComparer.Ordinal);

        foreach (var inscrito in agenda)
        {
            var clienteId = Texto(inscrito["clienteId"]);
            if (clienteId.Length == 0 || !incluidos.Add(clienteId)) continue;

            var competidor = porCliente.TryGetValue(clienteId, out var existente)
                ? (JsonObject)existente.DeepClone()
                : new JsonObject();
            competidor["customerId"] = clienteId;
            competidor["name"] = Texto(inscrito["nome"]);
            var categoria = Texto(inscrito["categoria"]);
            competidor["category"] = categoria.Length == 0 ? null : categoria;

            if (Texto(competidor["kart"]).Length == 0 && Texto(inscrito["kart"]).Length > 0)
                competidor["kart"] = Texto(inscrito["kart"]);

            if (long.TryParse(Texto(inscrito["equipeId"]), out var equipeId) && equipeId > 0)
                competidor["enduranceEquipeId"] = equipeId;
            else
                competidor.Remove("enduranceEquipeId");

            resultado.Add(competidor);
        }

        foreach (var manual in atuais.Where(c => Texto(c["customerId"]).Length == 0))
            resultado.Add(manual.DeepClone());

        return resultado;
    }
}
