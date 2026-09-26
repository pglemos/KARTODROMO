using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>
/// Telao / TV. Modo "Placar" igual ao do LapTime (posicao em cima, numero do kart em verde, 20 casas)
/// e modo "Classificacao" (tabela com voltas e tempos). Tecla P/C ou clique direito troca; Esc fecha.
/// Le o servico de cronometragem sozinha, entao pode rodar em outro PC com "--tv".
/// </summary>
public class FormTV : Form
{
    readonly System.Windows.Forms.Timer _leitura = new() { Interval = 1000 };
    readonly System.Windows.Forms.Timer _relogio = new() { Interval = 200 };
    JsonObject _sess;
    DateTime _lidoEm = DateTime.Now;
    bool _placar = true, _ok = true, _ocupado;
    readonly bool _autoteste;

    public static FormTV Sozinha() => new();

    public FormTV(bool autoteste = false)
    {
        _autoteste = autoteste;
        Text = "Telão - Cronometragem";
        Icon = Icone.App;
        BackColor = Color.Black;
        DoubleBuffered = true;
        KeyPreview = true;
        FormBorderStyle = FormBorderStyle.None;
        if (!autoteste)
        {
            // segunda tela (TV) se houver; senao a principal
            var tela = Screen.AllScreens.FirstOrDefault(s => !s.Primary) ?? Screen.PrimaryScreen;
            StartPosition = FormStartPosition.Manual;
            Bounds = tela.Bounds;
        }
        try { _placar = Config.Get("TvModo", "placar") != "classificacao"; } catch { /* padrao */ }
        KeyDown += (_, e) =>
        {
            if (e.KeyCode == Keys.Escape) Close();
            else if (e.KeyCode is Keys.P) { _placar = true; Invalidate(); }
            else if (e.KeyCode is Keys.C) { _placar = false; Invalidate(); }
        };
        MouseUp += (_, e) => { if (e.Button == MouseButtons.Right) { _placar = !_placar; Invalidate(); } };
        _leitura.Tick += async (_, _) => await Ler();
        _relogio.Tick += (_, _) => { if (!_placar) Invalidate(); };
        Shown += async (_, _) => { await Ler(); _leitura.Start(); _relogio.Start(); };
        FormClosed += (_, _) => { _leitura.Stop(); _relogio.Stop(); };
    }

    async Task Ler()
    {
        if (_ocupado) return;
        _ocupado = true;
        try
        {
            var st = await Crono.Api.Get("/api/state");
            _sess = st?["focus"] as JsonObject;
            _ok = true;
        }
        catch (ApiException) { _ok = false; }
        finally { _ocupado = false; }
        _lidoEm = DateTime.Now;
        Invalidate();
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
        g.Clear(Color.Black);
        if (_placar) Placar(g); else Classificacao(g);
        if (!_ok)
        {
            using var f = new Font("Segoe UI", 12F, FontStyle.Bold);
            g.DrawString("sem conexão com a cronometragem", f, Brushes.Red, 10, ClientSize.Height - 30);
        }
    }

    void Placar(Graphics g)
    {
        var st = Crono.Arr(_sess, "standings").Where(s => s.I("laps") > 0 || s.L("bestLapMs") != null).ToList();
        const int colunas = 10, linhas = 2;
        var margem = ClientSize.Width * 0.006f;
        var alturaTotal = Math.Min(ClientSize.Height * 0.9f, ClientSize.Width * 0.235f);
        var topo = (ClientSize.Height - alturaTotal) / 2;
        var area = new RectangleF(margem, topo, ClientSize.Width - margem * 2, alturaTotal);
        using (var borda = new SolidBrush(Color.White)) g.FillRectangle(borda, area);
        var gap = area.Width * 0.004f;
        var w = (area.Width - gap * (colunas + 1)) / colunas;
        var h = (area.Height - gap * (linhas + 1)) / linhas;
        using var fPos = new Font("Arial Black", Math.Min(h * 0.33f, w * 0.30f), FontStyle.Bold, GraphicsUnit.Pixel);
        var digitos = Math.Max(2, st.Take(20).Select(s => s.S("kart").Length).DefaultIfEmpty(2).Max());
        using var fKart = new Font("Arial Black", Math.Min(h * 0.40f, w * 1.05f / (0.78f * digitos)), FontStyle.Bold, GraphicsUnit.Pixel);
        using var centro = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
        for (var i = 0; i < colunas * linhas; i++)
        {
            var x = area.X + gap + (i % colunas) * (w + gap);
            var y = area.Y + gap + (i / colunas) * (h + gap);
            var tem = i < st.Count;
            using (var fundo = new SolidBrush(tem ? Color.FromArgb(8, 8, 8) : Color.FromArgb(22, 22, 22))) g.FillRectangle(fundo, x, y, w, h);
            using var cPos = new SolidBrush(tem ? Color.White : Color.FromArgb(95, 95, 95));
            g.DrawString((i + 1).ToString(), fPos, cPos, new RectangleF(x, y + h * 0.04f, w, h * 0.42f), centro);
            if (tem)
            {
                var kart = st[i].S("kart");
                using var verde = new SolidBrush(Color.FromArgb(0, 240, 0));
                g.DrawString(kart, fKart, verde, new RectangleF(x - w * 0.1f, y + h * 0.44f, w * 1.2f, h * 0.5f), centro);
            }
            else
            {
                using var traco = new SolidBrush(Color.FromArgb(95, 95, 95));
                g.FillRectangle(traco, x + w / 2 - w * 0.06f, y + h * 0.7f, w * 0.12f, h * 0.05f);
            }
        }
    }

    void Classificacao(Graphics g)
    {
        var W = ClientSize.Width; var H = ClientSize.Height;
        var st = Crono.Arr(_sess, "standings");
        var estado = _sess?.S("state") ?? "";
        var andando = estado is "em_andamento" or "bandeira_final";
        var delta = andando ? (long)(DateTime.Now - _lidoEm).TotalMilliseconds : 0;
        var cab = H * 0.12f;
        using var fTitulo = new Font("Segoe UI", cab * 0.34f, FontStyle.Bold, GraphicsUnit.Pixel);
        using var fSub = new Font("Segoe UI", cab * 0.22f, FontStyle.Regular, GraphicsUnit.Pixel);
        using var fRel = new Font("Consolas", cab * 0.42f, FontStyle.Bold, GraphicsUnit.Pixel);
        using (var faixa = new LinearGradientBrush(new RectangleF(0, 0, W, cab), Color.FromArgb(200, 16, 46), Color.FromArgb(110, 8, 24), 0f)) g.FillRectangle(faixa, 0, 0, W, cab);
        g.DrawString(_sess?.S("name") ?? "Aguardando bateria", fTitulo, Brushes.White, W * 0.015f, cab * 0.08f);
        var sub = _sess == null ? "Kartódromo Internacional de Betim" : $"{Crono.Tipo(_sess.S("type"))} · {Crono.Estado(estado)}";
        g.DrawString(sub, fSub, Brushes.Gainsboro, W * 0.017f, cab * 0.56f);
        if (_sess != null)
        {
            var rel = _sess.L("remainingMs") is long r ? Crono.Relogio(Math.Max(0, r - delta))[..8] : Crono.Relogio((_sess.L("elapsedMs") ?? 0) + delta)[..8];
            if (estado == "bandeira_final") rel = "🏁 " + rel;
            using var dir = new StringFormat { Alignment = StringAlignment.Far, LineAlignment = StringAlignment.Center };
            g.DrawString(rel, fRel, Brushes.White, new RectangleF(0, 0, W * 0.985f, cab), dir);
        }

        string[] titulos = ["POS", "KART", "PILOTO", "VOLTAS", "ÚLTIMA", "MELHOR", "DIF."];
        float[] larg = [0.07f, 0.09f, 0.36f, 0.1f, 0.13f, 0.13f, 0.12f];
        var linhas = Math.Max(10, Math.Min(20, st.Count));
        var topo = cab + H * 0.01f;
        var hCab = H * 0.045f;
        var hLin = (H - topo - hCab - H * 0.01f) / linhas;
        using var fCab = new Font("Segoe UI", hCab * 0.55f, FontStyle.Bold, GraphicsUnit.Pixel);
        using var fLin = new Font("Segoe UI", hLin * 0.52f, FontStyle.Bold, GraphicsUnit.Pixel);
        using var fNum = new Font("Consolas", hLin * 0.52f, FontStyle.Bold, GraphicsUnit.Pixel);
        using var sfC = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center, Trimming = StringTrimming.EllipsisCharacter, FormatFlags = StringFormatFlags.NoWrap };
        using var sfE = new StringFormat { Alignment = StringAlignment.Near, LineAlignment = StringAlignment.Center, Trimming = StringTrimming.EllipsisCharacter, FormatFlags = StringFormatFlags.NoWrap };
        var x0 = W * 0.01f; var lw = W * 0.98f;
        var x = x0;
        for (var c = 0; c < titulos.Length; c++)
        {
            g.DrawString(titulos[c], fCab, Brushes.Silver, new RectangleF(x, topo, lw * larg[c], hCab), c == 2 ? sfE : sfC);
            x += lw * larg[c];
        }
        var melhor = st.Where(s => s.L("bestLapMs") != null).Select(s => s.L("bestLapMs")).DefaultIfEmpty(null).Min();
        for (var i = 0; i < Math.Min(st.Count, linhas); i++)
        {
            var s = st[i];
            var y = topo + hCab + i * hLin;
            using (var fundo = new SolidBrush(i % 2 == 0 ? Color.FromArgb(22, 22, 24) : Color.FromArgb(12, 12, 14))) g.FillRectangle(fundo, x0, y, lw, hLin - 1);
            var gapL = s.I("gapLaps");
            var dif = i == 0 ? "" : gapL > 0 ? $"+{gapL}v" : Crono.Volta(s.L("gapMs"));
            string[] v = [s.S("position"), s.S("kart"), s.S("name").Length > 0 ? s.S("name").ToUpperInvariant() : "KART " + s.S("kart"), s.S("laps"), Crono.Volta(s.L("lastLapMs")), Crono.Volta(s.L("bestLapMs")), dif];
            x = x0;
            for (var c = 0; c < v.Length; c++)
            {
                var cor = c switch
                {
                    0 => i < 3 ? new[] { Color.Gold, Color.Silver, Color.FromArgb(205, 127, 50) }[i] : Color.White,
                    1 => Color.FromArgb(0, 230, 0),
                    5 when s.L("bestLapMs") == melhor && melhor != null => Color.FromArgb(200, 90, 255),
                    _ => Color.White,
                };
                using var b = new SolidBrush(cor);
                g.DrawString(v[c], c is 2 ? fLin : fNum, b, new RectangleF(x, y, lw * larg[c], hLin), c == 2 ? sfE : sfC);
                x += lw * larg[c];
            }
        }
    }
}
