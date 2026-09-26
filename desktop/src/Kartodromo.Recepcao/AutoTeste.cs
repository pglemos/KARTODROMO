using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>
/// Autoteste de telas: Kartodromo.Recepcao.exe --autoteste &lt;pasta&gt; &lt;login&gt; &lt;senha&gt;
/// Faz login, abre cada janela principal, salva um PNG de cada uma e fecha. Nao grava nada no servidor.
/// </summary>
public static class AutoTeste
{
    public static async Task Rodar(string pasta, string login, string senha)
    {
        Directory.CreateDirectory(pasta);
        var log = new List<string>();
        var r = await Sessao.Api.Post("/api/login", new { login, senha, termos = true });
        Sessao.Api.Token = r.S("token");
        Sessao.Usuario = r["usuario"]!.AsObject();
        await Sessao.CarregarApoio();

        var principal = new FormPrincipal { WindowState = FormWindowState.Normal, Size = new Size(1600, 900), StartPosition = FormStartPosition.Manual, Location = new Point(0, 0) };
        principal.FormClosing += (_, e) => e.Cancel = false;
        principal.Show();
        async Task Foto(Control c, string nome)
        {
            await Task.Delay(2500);
            Application.DoEvents();
            using var bmp = new Bitmap(c.Width, c.Height);
            c.DrawToBitmap(bmp, new Rectangle(0, 0, c.Width, c.Height));
            bmp.Save(Path.Combine(pasta, nome + ".png"));
            log.Add("ok " + nome);
        }
        async Task Janela(Form f, string nome) { try { f.StartPosition = FormStartPosition.Manual; f.Location = new Point(20, 20); f.Show(principal); await Foto(f, nome); } catch (Exception e) { log.Add($"ERRO {nome}: {e.Message}"); } finally { f.Close(); } }

        await Foto(principal, "01-principal-reservas");
        principal.Selecionar("baterias:todas"); await Foto(principal, "02-baterias");
        principal.Selecionar("vendas:liquidadas"); await Foto(principal, "03-vendas");
        principal.Selecionar("oficina:arealizar"); await Foto(principal, "04-oficina");
        await Janela(new FormCliente(null), "05-registro-cliente");
        await Janela(new FormAgenda(), "06-agenda");
        await Janela(new FormCriarReservas(), "07-criar-reservas");
        await Janela(new FormCadastro("produtos", Cadastros.Defs["produtos"]), "08-registro-produto");
        await Janela(new FormCadastro("padroes", Cadastros.Defs["padroes"]), "09-padroes-reserva");
        await Janela(new FormVoucher("fidelidade"), "10-voucher");
        var terminal = new System.Text.Json.Nodes.JsonObject { ["id"] = 0, ["terminal"] = "TESTE (simulado)" };
        await Janela(new FormCheckout(terminal, null, [], null), "11-checkout");
        File.WriteAllLines(Path.Combine(pasta, "log.txt"), log);
        principal.Dispose();
    }
}
