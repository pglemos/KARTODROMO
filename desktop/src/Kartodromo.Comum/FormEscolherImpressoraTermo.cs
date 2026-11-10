using System.Drawing.Drawing2D;
using System.Drawing.Printing;

namespace Kartodromo.Comum;

public enum ModoDestinoTermo
{
    Cancelar,
    Visualizar,
    Imprimir
}

public sealed class DestinoImpressaoTermo
{
    public ModoDestinoTermo Modo { get; init; }
    public string NomeImpressora { get; init; }

    public static DestinoImpressaoTermo ParaVisualizar() => new() { Modo = ModoDestinoTermo.Visualizar };
    public static DestinoImpressaoTermo ParaImprimir(string impressora) => new() { Modo = ModoDestinoTermo.Imprimir, NomeImpressora = impressora };
    public static DestinoImpressaoTermo Cancelado() => new() { Modo = ModoDestinoTermo.Cancelar };
}

/// <summary>
/// Diálogo modal que permite ao operador da recepção escolher onde imprimir o termo de responsabilidade:
/// Totem 1, Totem 2, Recepção ou Visualizar na tela. Atalhos: [1], [2], [R], [V], [Esc].
/// </summary>
public sealed class FormEscolherImpressoraTermo : DialogoDesign
{
    DestinoImpressaoTermo _resultado = DestinoImpressaoTermo.Cancelado();

    const string IconeImpressora = "M19 8h-1V3H6v5H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zM8 5h8v3H8V5zm8 12v2H8v-2h8zm2-2v-2H6v2H4v-4c0-.55.45-1 1-1h14c.55 0 1 .45 1 1v4h-2z";

    public FormEscolherImpressoraTermo(int totalTermos = 1)
        : base("Imprimir Termo de Responsabilidade",
               totalTermos > 1 ? $"{totalTermos} termos selecionados para impressão" : "Selecione o destino da impressão do termo",
               IconeImpressora,
               "linear-gradient(180deg, #38BDF8, #0284C7)",
               540, 480)
    {
        KeyPreview = true;
        var instaladas = ObterImpressorasInstaladas();

        var secao = Secao("Destino da Impressão", "Escolha a impressora térmica desejada ou visualize antes de imprimir:");

        // Encontra filas específicas ou equivalentes
        var t1 = instaladas.FirstOrDefault(p => string.Equals(p, "TOTEM 1 (T20)", StringComparison.OrdinalIgnoreCase))
              ?? instaladas.FirstOrDefault(p => p.IndexOf("TOTEM 1", StringComparison.OrdinalIgnoreCase) >= 0);

        var t2 = instaladas.FirstOrDefault(p => string.Equals(p, "TOTEM 2 (T20)", StringComparison.OrdinalIgnoreCase))
              ?? instaladas.FirstOrDefault(p => p.IndexOf("TOTEM 2", StringComparison.OrdinalIgnoreCase) >= 0);

        var rec = instaladas.FirstOrDefault(p => string.Equals(p, "TMT20", StringComparison.OrdinalIgnoreCase))
               ?? instaladas.FirstOrDefault(p => string.Equals(p, Config.Get("ImpressoraTermos", ""), StringComparison.OrdinalIgnoreCase))
               ?? instaladas.FirstOrDefault(p => p.IndexOf("TM-T20", StringComparison.OrdinalIgnoreCase) >= 0 && !p.Contains("TOTEM", StringComparison.OrdinalIgnoreCase))
               ?? instaladas.FirstOrDefault(p => p.IndexOf("EPSON", StringComparison.OrdinalIgnoreCase) >= 0 && !p.Contains("TOTEM", StringComparison.OrdinalIgnoreCase));

        // 1. Totem 1
        CriarCardDestino(secao, "1", "Totem 1 (T20)", "Impressora USB local do Totem 1 (192.168.20.161)", t1, () => SelecionarImpressora(t1 ?? "TOTEM 1 (T20)"));

        // 2. Totem 2
        CriarCardDestino(secao, "2", "Totem 2 (T20)", "Impressora USB local do Totem 2 (192.168.20.69)", t2, () => SelecionarImpressora(t2 ?? "TOTEM 2 (T20)"));

        // R. Recepção
        CriarCardDestino(secao, "R", "Recepção", "Impressora térmica do balcão da Recepção (TMT20)", rec, () => SelecionarImpressora(rec ?? "TMT20"));

        // Rodapé: Visualizar e Cancelar
        BotaoRodape("Cancelar", false, () => { _resultado = DestinoImpressaoTermo.Cancelado(); Close(); });
        var btnVis = BotaoRodape("Visualizar na tela (V)", true, () => { _resultado = DestinoImpressaoTermo.ParaVisualizar(); Close(); });
        btnVis.BackColor = Tokens.Azul;
    }

    void CriarCardDestino(TableLayoutPanel container, string tecla, string titulo, string descricao, string nomeFila, Action clique)
    {
        var disponivel = !string.IsNullOrWhiteSpace(nomeFila);

        var card = new Panel
        {
            Dock = DockStyle.Top,
            Height = 64,
            Margin = new Padding(0, 0, 0, 10),
            BackColor = Tokens.Primitivo.Branco,
            Cursor = Cursors.Hand
        };

        card.Paint += (_, e) =>
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var r = card.ClientRectangle;
            r.Width -= 1; r.Height -= 1;
            using var p = Forma.Redondo(r, 8);
            using var brush = new SolidBrush(Tokens.Primitivo.Branco);
            g.FillPath(brush, p);
            using var pen = new Pen(card.ContainsFocus ? Tokens.Verde : Tokens.Claro.CorBordaCampo, card.ContainsFocus ? 2f : 1f);
            g.DrawPath(pen, p);
        };

        var lblBadge = new Label
        {
            Text = tecla,
            Font = Tokens.Fonte(14, FontStyle.Bold),
            ForeColor = Tokens.Primitivo.Branco,
            BackColor = Tokens.Verde,
            TextAlign = ContentAlignment.MiddleCenter,
            Size = new Size(34, 34),
            Location = new Point(14, 15)
        };
        lblBadge.Paint += (_, e) =>
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var r = lblBadge.ClientRectangle;
            r.Width -= 1; r.Height -= 1;
            using var p = Forma.Redondo(r, 6);
            using var b = new SolidBrush(Tokens.Verde);
            g.FillPath(b, p);
            TextRenderer.DrawText(g, tecla, lblBadge.Font, r, Tokens.Primitivo.Branco, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        };

        var lblTitulo = new Label
        {
            Text = titulo,
            Font = Tokens.Fonte(13, FontStyle.Bold),
            ForeColor = PecasDesign.CorTexto,
            Location = new Point(58, 12),
            AutoSize = true,
            BackColor = Color.Transparent
        };

        var lblSub = new Label
        {
            Text = disponivel ? descricao : $"{descricao} — Fila não detectada",
            Font = Tokens.Fonte(10),
            ForeColor = disponivel ? Tokens.TextoSecundario : Tokens.Vermelho,
            Location = new Point(58, 34),
            AutoSize = true,
            BackColor = Color.Transparent
        };

        void AoClicar(object s, EventArgs e) => clique();
        card.Click += AoClicar;
        lblBadge.Click += AoClicar;
        lblTitulo.Click += AoClicar;
        lblSub.Click += AoClicar;

        card.Controls.AddRange([lblBadge, lblTitulo, lblSub]);
        container.Controls.Add(card);
    }

    void SelecionarImpressora(string impressora)
    {
        _resultado = DestinoImpressaoTermo.ParaImprimir(impressora);
        Close();
    }

    protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
    {
        switch (keyData)
        {
            case Keys.D1:
            case Keys.NumPad1:
                SelecionarImpressora("TOTEM 1 (T20)");
                return true;

            case Keys.D2:
            case Keys.NumPad2:
                SelecionarImpressora("TOTEM 2 (T20)");
                return true;

            case Keys.R:
                SelecionarImpressora("TMT20");
                return true;

            case Keys.V:
            case Keys.Enter:
                _resultado = DestinoImpressaoTermo.ParaVisualizar();
                Close();
                return true;

            case Keys.Escape:
                _resultado = DestinoImpressaoTermo.Cancelado();
                Close();
                return true;
        }

        return base.ProcessCmdKey(ref msg, keyData);
    }

    static List<string> ObterImpressorasInstaladas()
    {
        try
        {
            return PrinterSettings.InstalledPrinters.Cast<string>().ToList();
        }
        catch
        {
            return [];
        }
    }

    /// <summary>Exibe o diálogo e retorna o destino escolhido pelo operador.</summary>
    public static DestinoImpressaoTermo Pedir(IWin32Window dono, int totalTermos = 1)
    {
        using var dial = new FormEscolherImpressoraTermo(totalTermos);
        dial.ShowDialog(dono);
        return dial._resultado;
    }
}
