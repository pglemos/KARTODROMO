using System.Text.Json.Nodes;
using Kartodromo.Comum;
namespace Kartodromo.Cronometragem;
public partial class FormCrono
{
    async Task TestarRecuperarPiloto()
    {
        if (!Config.CronoUrl.Contains(":4150")) throw new Exception("Teste permitido somente no simulador.");
        _sel = (await Crono.Api.Lista("/api/sessions")).First(s => s.S("name") == "TESTE CODEX RECUPERAR").S("id");
        _fixado = true; _abas.SelectedIndex = 2;
        await Atualizar();
        IEnumerable<Control> Todos(Control r) { foreach (Control c in r.Controls) { yield return c; foreach (var x in Todos(c)) yield return x; } }
        var botao = Todos(this).OfType<Button>().Single(b => b.Text == "Recuperar piloto");
        if (!botao.Visible) throw new Exception("Botão de recuperação não apareceu.");
        using (var foto = new Bitmap(Width, Height)) { DrawToBitmap(foto, new Rectangle(Point.Empty, foto.Size)); foto.Save(Path.Combine(_autoteste, "recuperar-piloto.png")); }
        var concluido = new TaskCompletionSource();
        using var timer = new System.Windows.Forms.Timer { Interval = 200 };
        timer.Tick += (_, _) => {
            var janela = Application.OpenForms.Cast<Form>().FirstOrDefault(f => f.Text == "Recuperar piloto");
            if (janela == null) return;
            timer.Stop();
            try {
                if (Todos(janela).OfType<ListaDesign>().Single().Items.Count != 2) throw new Exception("Seleção dos dois excluídos incorreta.");
                using var foto = new Bitmap(janela.Width, janela.Height);
                janela.DrawToBitmap(foto, new Rectangle(Point.Empty, foto.Size)); foto.Save(Path.Combine(_autoteste, "selecionar-kart.png"));
                File.WriteAllText(Path.Combine(_autoteste, "ok.txt"), "OK: botão visível e seleção de dois pilotos na janela real.");
            } catch (Exception ex) { File.WriteAllText(Path.Combine(_autoteste, "erro.txt"), ex.ToString()); }
            janela.Close(); concluido.SetResult();
        };
        timer.Start(); RecuperarPiloto();
        await concluido.Task.WaitAsync(TimeSpan.FromSeconds(30)); Close();
    }
    Action _posicionarRecuperarPiloto;
    void RecuperarPiloto() => Seguro.Rodar(this, async () =>
    {
        if (_sess == null) return;
        var sessaoId = _sess.S("id");
        var atual = (await Crono.Api.Get("/api/sessions/" + sessaoId))?.AsObject();
        var excluidos = Crono.Arr(atual, "excludedCompetitors");
        if (excluidos.Count == 0) { await Atualizar(); return; }
        var escolhido = excluidos[0];
        if (excluidos.Count > 1)
        {
            using var d = NovoDialogo("Recuperar piloto", "Escolha o kart e o piloto excluído desta bateria", "M12 5v14M5 12h14", CorEqualizacao, 620, 350);
            var lista = new ListaDesign();
            foreach (var x in excluidos) lista.Items.Add(new Campos.Item(0, $"Kart {x.S("kart")} · {x.S("name")}", x));
            lista.SelectedIndex = 0;
            d.Campo(d.Secao("Pilotos excluídos"), "Kart e piloto", lista, 6);
            d.BotaoRodape("Recuperar", true, () => { escolhido = (lista.SelectedItem as Campos.Item)?.Dados?.AsObject(); d.DialogResult = DialogResult.OK; d.Close(); });
            d.BotaoRodape("Cancelar", false, d.Close);
            if (d.ShowDialog(this) != DialogResult.OK || escolhido == null) return;
        }
        await Crono.Api.Post($"/api/sessions/{sessaoId}/competitors/restore", new JsonObject { ["id"] = escolhido.S("id"), ["autor"] = Environment.UserName });
        await Atualizar();
    });
}
