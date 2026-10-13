using System.Globalization;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>Limites e ajustes absolutos de cada faixa; o limite superior pertence à própria linha.</summary>
public sealed class EditorFaixasRedutor : UserControl
{
    readonly DataGridView _grade = new();
    public EditorFaixasRedutor()
    {
        Height = 290; Dock = DockStyle.Fill;
        _grade.Dock = DockStyle.Fill;
        _grade.BackgroundColor = Tokens.Primitivo.Branco;
        _grade.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill;
        _grade.AllowUserToAddRows = true; _grade.AllowUserToDeleteRows = true;
        _grade.RowHeadersVisible = true; _grade.RowHeadersWidth = 42;
        _grade.RowTemplate.Height = 32;
        _grade.Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo);
        _grade.SelectionMode = DataGridViewSelectionMode.CellSelect;
        _grade.Columns.Add("ate", "Até diferença (segundos)");
        _grade.Columns.Add("mm", "Abrir ou fechar (mm)");
        _grade.AccessibleName = "Faixas individuais do redutor";
        _grade.RowPostPaint += (_, e) => TextRenderer.DrawText(e.Graphics, (e.RowIndex + 1).ToString(), _grade.Font, new Rectangle(e.RowBounds.Left + 14, e.RowBounds.Top, _grade.RowHeadersWidth - 18, e.RowBounds.Height), Tokens.Claro.CorTextoSecundario, TextFormatFlags.Right | TextFormatFlags.VerticalCenter); // à direita da setinha/asterisco do Windows (antes ficava "▶1")
        Controls.Add(_grade);
    }
    public void Preencher(JsonArray faixas)
    {
        _grade.Rows.Clear();
        foreach (var f in faixas.OfType<JsonObject>())
            _grade.Rows.Add(((f.L("ateMs") ?? 0) / 1000m).ToString("0.000", Fmt.Br), f["mm"]?.ToString().Replace('.', ','));
    }
    public JsonArray Ler(decimal toleranciaSeg)
    {
        _grade.EndEdit();
        var saida = new JsonArray(); var anterior = toleranciaSeg;
        foreach (DataGridViewRow row in _grade.Rows)
        {
            if (row.IsNewRow) continue;
            var limite = Convert.ToString(row.Cells[0].Value)?.Trim(); var mm = Convert.ToString(row.Cells[1].Value)?.Trim();
            if (!decimal.TryParse(limite?.Replace(',', '.'), NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var ate) || ate <= anterior || ate > 60)
                throw new Exception($"Faixa {row.Index + 1}: informe um limite maior que o anterior e de até 60 segundos.");
            if (!decimal.TryParse(mm?.Replace(',', '.'), NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var ajuste) || ajuste < 0 || ajuste > 99)
                throw new Exception($"Faixa {row.Index + 1}: informe quantos milímetros abrir ou fechar (0 a 99).");
            saida.Add(new JsonObject { ["ateMs"] = (long)Math.Round(ate * 1000), ["mm"] = ajuste }); anterior = ate;
        }
        if (saida.Count < 1 || saida.Count > 100) throw new Exception("Preencha entre 1 e 100 faixas do redutor.");
        return saida;
    }
}
