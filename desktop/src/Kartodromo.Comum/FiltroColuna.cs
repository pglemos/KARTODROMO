using System.Drawing.Drawing2D;

namespace Kartodromo.Comum;

/// <summary>
/// Filtro de coluna como no LapTime: funil no cabeçalho; clicando nele abre a lista dos valores
/// da coluna com caixas de marcar, busca e "(Selecionar tudo)".
/// </summary>
public static class FiltroColuna
{
    public const int LarguraFunil = 22;
    /// <summary>Lista de filtro aberta agora (usada pelo autoteste para fotografar).</summary>
    public static ToolStripDropDown Aberto { get; private set; }
    static readonly Color Azul = Color.FromArgb(0, 113, 227);

    /// <summary>Área do funil dentro da célula do cabeçalho (canto direito).</summary>
    public static Rectangle Area(Rectangle celula) => new(celula.Right - LarguraFunil, celula.Top, LarguraFunil, celula.Height);

    public static bool NoFunil(Rectangle celula, Point p) => Area(celula).Contains(p);

    /// <summary>Desenha o funil (contorno cinza; azul preenchido quando a coluna está filtrada).</summary>
    public static void Desenhar(Graphics g, Rectangle celula, bool ativo)
    {
        var a = Area(celula);
        var w = 10f; var h = 11f;
        var x = a.X + (a.Width - w) / 2f; var y = a.Y + (a.Height - h) / 2f;
        using var path = new GraphicsPath();
        path.AddPolygon(new[]
        {
            new PointF(x, y), new PointF(x + w, y), new PointF(x + w * 0.62f, y + h * 0.5f),
            new PointF(x + w * 0.62f, y + h), new PointF(x + w * 0.38f, y + h * 0.82f), new PointF(x + w * 0.38f, y + h * 0.5f),
        });
        var modo = g.SmoothingMode;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        if (ativo) { using var b = new SolidBrush(Azul); g.FillPath(b, path); }
        using var pen = new Pen(ativo ? Azul : Color.FromArgb(142, 142, 147), 1.2f) { LineJoin = LineJoin.Round };
        g.DrawPath(pen, path);
        g.SmoothingMode = modo;
    }

    /// <summary>
    /// Abre a lista de valores embaixo da coluna. <paramref name="aplicar"/> recebe os valores marcados,
    /// ou null quando o filtro é limpo (ou todos ficam marcados).
    /// </summary>
    public static void Abrir(Control dono, Rectangle celulaNoDono, string titulo, IEnumerable<string> valores, HashSet<string> atual, Action<HashSet<string>> aplicar)
    {
        var contagem = valores.GroupBy(v => v ?? "").ToDictionary(g => g.Key, g => g.Count());
        var todos = contagem.Keys.OrderBy(v => v.Length == 0 ? 1 : 0).ThenBy(v => double.TryParse(v.Replace(".", "").Replace(",", "."), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var n) ? n : double.MaxValue).ThenBy(v => v, StringComparer.CurrentCultureIgnoreCase).ToList();
        var marcados = new HashSet<string>(atual ?? (IEnumerable<string>)todos);

        var fonte = new Font("Segoe UI", 9F);
        var painel = new Panel { Size = new Size(270, 340), BackColor = Color.White, Padding = new Padding(10), Font = fonte };
        var cab = new Label { Text = "Filtrar · " + titulo.Trim(), Dock = DockStyle.Top, Height = 24, Font = new Font("Segoe UI", 9F, FontStyle.Bold), ForeColor = Color.FromArgb(29, 29, 31) };
        var busca = new TextBox { Dock = DockStyle.Top, PlaceholderText = "Pesquisar", BorderStyle = BorderStyle.FixedSingle, Font = fonte };
        var espaco = new Panel { Dock = DockStyle.Top, Height = 6 };
        var lista = new CheckedListBox { Dock = DockStyle.Fill, CheckOnClick = true, BorderStyle = BorderStyle.None, IntegralHeight = false, Font = fonte };
        var rodape = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 40, FlowDirection = FlowDirection.RightToLeft, Padding = new Padding(0, 8, 0, 0) };
        var filtrar = new Button { Text = "Filtrar", Size = new Size(88, 28), FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(21, 128, 61), ForeColor = Color.White, Font = new Font("Segoe UI", 9F, FontStyle.Bold), Cursor = Cursors.Hand };
        var limpar = new Button { Text = "Limpar", Size = new Size(80, 28), FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(238, 238, 241), ForeColor = Color.FromArgb(29, 29, 31), Font = fonte, Cursor = Cursors.Hand };
        filtrar.FlatAppearance.BorderSize = 0; limpar.FlatAppearance.BorderSize = 0;
        rodape.Controls.Add(filtrar); rodape.Controls.Add(limpar);
        painel.Controls.Add(lista); painel.Controls.Add(espaco); painel.Controls.Add(busca); painel.Controls.Add(cab); painel.Controls.Add(rodape);

        const string tudo = "(Selecionar tudo)";
        string Rotulo(string v) => (v.Length == 0 ? "(vazio)" : v) + $"   ({contagem[v]})";
        var visiveis = new List<string>();
        var montando = false;
        void Montar()
        {
            montando = true;
            var termo = busca.Text.Trim();
            visiveis = todos.Where(v => termo.Length == 0 || v.Contains(termo, StringComparison.CurrentCultureIgnoreCase)).ToList();
            lista.BeginUpdate();
            lista.Items.Clear();
            lista.Items.Add(tudo, visiveis.Count > 0 && visiveis.All(marcados.Contains));
            foreach (var v in visiveis) lista.Items.Add(Rotulo(v), marcados.Contains(v));
            lista.EndUpdate();
            montando = false;
        }
        lista.ItemCheck += (_, e) =>
        {
            if (montando) return;
            var marcar = e.NewValue == CheckState.Checked;
            if (e.Index == 0)
            {
                foreach (var v in visiveis) { if (marcar) marcados.Add(v); else marcados.Remove(v); }
                lista.BeginInvoke(Montar);
                return;
            }
            var valor = visiveis[e.Index - 1];
            if (marcar) marcados.Add(valor); else marcados.Remove(valor);
            lista.BeginInvoke(() => { montando = true; lista.SetItemChecked(0, visiveis.Count > 0 && visiveis.All(marcados.Contains)); montando = false; });
        };
        busca.TextChanged += (_, _) => Montar();
        Montar();

        var host = new ToolStripControlHost(painel) { Margin = Padding.Empty, Padding = Padding.Empty, AutoSize = false, Size = painel.Size };
        var pop = new ToolStripDropDown { Padding = new Padding(1), BackColor = Color.FromArgb(214, 214, 219), DropShadowEnabled = true };
        pop.Items.Add(host);
        filtrar.Click += (_, _) =>
        {
            // com busca digitada vale só o que aparece na lista (como no Excel)
            var escolha = busca.Text.Trim().Length > 0 ? visiveis.Where(marcados.Contains).ToHashSet() : marcados;
            pop.Close();
            aplicar(escolha.Count == todos.Count && todos.All(escolha.Contains) ? null : escolha);
        };
        limpar.Click += (_, _) => { pop.Close(); aplicar(null); };
        busca.KeyDown += (_, e) => { if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; filtrar.PerformClick(); } };
        pop.Closed += (_, _) => { if (Aberto == pop) Aberto = null; dono.BeginInvoke(() => pop.Dispose()); };
        Aberto = pop;
        var ponto = new Point(Math.Max(0, celulaNoDono.Right - painel.Width), celulaNoDono.Bottom);
        pop.Show(dono, ponto);
        busca.Focus();
    }
}
