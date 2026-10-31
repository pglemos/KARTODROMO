using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

public partial class FormCrono
{
    List<JsonObject> _inscricoesEndurance = [];
    List<JsonObject> _vinculosEndurance = [];
    long _eventoEndurance;

    long InscricaoDoCompetidor(JsonObject c)
    {
        if (c?.L("enduranceEquipeId") is long id && id > 0) return id;
        if (c == null || c.S("customerId").Length > 0) return 0;
        return _inscricoesEndurance.FirstOrDefault(q => string.Equals(q.S("nome"), c.S("name"), StringComparison.OrdinalIgnoreCase))?.L("id") ?? 0;
    }

    string PilotosDaInscricao(JsonObject c)
    {
        var id = InscricaoDoCompetidor(c);
        return id == 0 ? "" : string.Join(" / ", _vinculosEndurance.Where(v => v.L("equipeId") == id)
            .OrderBy(v => v.S("piloto")).Select(v => $"{v.S("piloto")} · pulseira {v.S("pulseira")}"));
    }

    async Task AtualizarVinculosEndurance(string agendaId)
    {
        _equipesDaAgenda = agendaId;
        var grid = await Crono.Api.Lista($"/api/agenda/{agendaId}/grid");
        var info = (await Api.Servidor.Get($"/api/totem/endurance?bateria={agendaId}")) as JsonObject;
        var ids = string.Join(',', grid.Select(p => p.S("clienteId")).Concat(Crono.Arr(_sess, "competitors").Select(p => p.S("customerId")))
            .Where(id => long.TryParse(id, out var n) && n > 0).Distinct());
        var clientes = ids.Length > 0 ? await Crono.Api.Lista($"/api/clientes?ids={ids}") : [];
        if (_equipesDaAgenda != agendaId) return;
        _eventoEndurance = info?.L("eventoId") ?? 0;
        _inscricoesEndurance = Crono.Arr(info, "equipes");
        _vinculosEndurance = clientes.SelectMany(c => Crono.Arr(c, "enduranceVinculos")).Where(v => v.S("bateriaId") == agendaId).ToList();
        _equipesDosPilotos = clientes.ToDictionary(c => c.S("id"), c => {
            var vinculos = Crono.Arr(c, "enduranceVinculos").Where(v => v.S("bateriaId") == agendaId).ToList();
            return new JsonObject { ["equipe"] = string.Join(" / ", vinculos.Select(v => v.S("equipe")).Distinct()), ["pulseira"] = vinculos.FirstOrDefault()?.S("pulseira") ?? "" };
        });
    }

    async Task EditarInscricoesEndurance()
    {
        if (_eventoEndurance == 0) { Msg.Aviso(this, "Selecione uma prova de campeonato ligada à recepção."); return; }
        if (_pilotosSujos) { Msg.Aviso(this, "Salve as alterações da lista antes de editar os vínculos."); return; }
        if (!await EntrarComoUsuario()) return;
        var eventoId = _eventoEndurance;
        var dados = (await Api.Servidor.Get($"/api/office/endurance/eventos/{eventoId}"))?.AsObject();
        var equipes = Crono.Arr(dados, "equipes");
        var pilotos = equipes.SelectMany(q => Crono.Arr(q, "pilotos")).GroupBy(p => p.S("id")).Select(g => g.First()).OrderBy(p => p.S("nome")).ToList();
        if (pilotos.Count == 0) { Msg.Info(this, "Ainda não há pilotos cadastrados neste campeonato."); return; }
        using var d = NovoDialogo("Pilotos e inscrições", "Cadastro do campeonato · mesma pulseira nas inscrições da mesma família", "M4 6h16M4 12h16M4 18h10", "linear-gradient(180deg, #6CB8FF, #1E6FE8)", 920, 680);
        var escolha = new ListaDesign { DropDownStyle = ComboBoxStyle.DropDownList };
        foreach (var p in pilotos) escolha.Items.Add(new Campos.Item(p.L("id") ?? 0, $"Pulseira {p.S("pulseira")} · {p.S("nome")}", p));
        var nome = Txt("", 120);
        var lista = new CheckedListBox { CheckOnClick = true, Dock = DockStyle.Fill, Height = 300, Font = TemaCrono.Normal, IntegralHeight = false };
        foreach (var q in equipes.Where(q => !q.B("desclassificada")).OrderBy(q => q.S("nome"))) lista.Items.Add(new Campos.Item(q.L("id") ?? 0, q.S("nome"), q));
        var secao = d.Secao("Piloto");
        d.Campo(secao, "Piloto / pulseira", escolha, 6); d.Campo(secao, "Nome no campeonato", nome, 6);
        var inscricoes = d.Secao("Inscrições — máximo de quatro pilotos em cada uma");
        inscricoes.Controls.Add(lista); inscricoes.SetColumnSpan(lista, 6);
        void Carregar()
        {
            var p = (escolha.SelectedItem as Campos.Item)?.Dados;
            nome.Text = p.S("nome");
            for (var i = 0; i < lista.Items.Count; i++)
            {
                var q = (lista.Items[i] as Campos.Item)?.Dados;
                lista.SetItemChecked(i, Crono.Arr(q, "pilotos").Any(x => x.S("id") == p.S("id")));
            }
        }
        escolha.SelectedIndexChanged += (_, _) => Carregar(); escolha.SelectedIndex = 0;
        var selecionado = _gPilotos.CurrentRow?.Tag as JsonObject;
        var equipeAtual = InscricaoDoCompetidor(selecionado);
        var primeiro = equipes.FirstOrDefault(q => q.L("id") == equipeAtual);
        var pilotoAtual = Crono.Arr(primeiro, "pilotos").FirstOrDefault()?.S("id");
        if (selecionado?.S("customerId") is { Length: > 0 } cid) pilotoAtual = pilotos.FirstOrDefault(p => p.S("clienteId") == cid)?.S("id");
        if (pilotoAtual != null) for (var i = 0; i < escolha.Items.Count; i++) if ((escolha.Items[i] as Campos.Item)?.Dados?.S("id") == pilotoAtual) escolha.SelectedIndex = i;
        d.BotaoRodape("Gravar inscrições", true, () => Seguro.Rodar(d, async () => {
            var p = (escolha.SelectedItem as Campos.Item)?.Dados;
            if (nome.Text.Trim().Length == 0) { Msg.Aviso(d, "Informe o nome do piloto."); return; }
            var ids = lista.CheckedItems.Cast<Campos.Item>().Select(q => q.Dados.L("id") ?? 0).ToList();
            if (ids.Count == 0) { Msg.Aviso(d, "Marque pelo menos uma inscrição."); return; }
            await Api.Servidor.Put($"/api/office/endurance/eventos/{eventoId}/pilotos/{p.S("id")}/inscricoes", new JsonObject {
                ["nome"] = nome.Text.Trim(), ["equipeIds"] = new JsonArray(ids.Select(id => (JsonNode)JsonValue.Create(id)).ToArray())
            });
            _equipesLidasEm = DateTime.MinValue;
            d.DialogResult = DialogResult.OK; d.Close(); await Atualizar();
        }));
        d.BotaoRodape("Cancelar", false, d.Close); d.ShowDialog(this);
    }
}
