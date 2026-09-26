using System.Globalization;
using System.Text.RegularExpressions;

namespace Kartodromo.Comum;

public static partial class Fmt
{
    public static readonly CultureInfo Br = CultureInfo.GetCultureInfo("pt-BR");

    public static string Dinheiro(long? centavos) => centavos == null ? "" : (centavos.Value / 100m).ToString("N2", Br);
    public static string Brl(long? centavos) => centavos == null ? "" : (centavos.Value / 100m).ToString("C2", Br);

    /// <summary>"1.234,56", "145", "R$ 10" -> centavos. null se invalido.</summary>
    public static long? Centavos(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto)) return 0;
        var t = texto.Replace("R$", "").Replace(" ", "").Trim();
        if (t.Contains(',')) t = t.Replace(".", "").Replace(',', '.');
        return decimal.TryParse(t, NumberStyles.Number, CultureInfo.InvariantCulture, out var d) ? (long)Math.Round(d * 100) : null;
    }

    /// <summary>Datas do servidor vem como texto local "YYYY-MM-DDTHH:mm[:ss]" ou "YYYY-MM-DD".</summary>
    public static DateTime? ParseData(string s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        string[] f = ["yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd'T'HH:mm", "yyyy-MM-dd"];
        return DateTime.TryParseExact(s.Length > 19 ? s[..19] : s, f, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) ? d : null;
    }
    public static string Iso(DateTime d) => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    public static string IsoHora(DateTime d) => d.ToString("yyyy-MM-dd'T'HH:mm", CultureInfo.InvariantCulture);
    public static string Dmy(string iso) => ParseData(iso)?.ToString("dd/MM/yyyy") ?? "";
    public static string DmyHm(string iso) => ParseData(iso)?.ToString("dd/MM/yyyy HH:mm") ?? "";
    public static string Hm(string iso) => ParseData(iso)?.ToString("HH:mm") ?? "";

    public static string Digitos(string s) => DigRx().Replace(s ?? "", "");

    public static string MascaraCpf(string v)
    {
        var d = Digitos(v);
        if (d.Length > 11) d = d[..11];
        if (d.Length <= 3) return d;
        if (d.Length <= 6) return $"{d[..3]}.{d[3..]}";
        if (d.Length <= 9) return $"{d[..3]}.{d[3..6]}.{d[6..]}";
        return $"{d[..3]}.{d[3..6]}.{d[6..9]}-{d[9..]}";
    }
    public static string MascaraFone(string v)
    {
        var d = Digitos(v);
        if (d.Length > 11) d = d[..11];
        if (d.Length == 0) return "";
        if (d.Length <= 2) return $"({d}";
        if (d.Length <= 6) return $"({d[..2]}) {d[2..]}";
        if (d.Length <= 10) return $"({d[..2]}) {d[2..6]}-{d[6..]}";
        return $"({d[..2]}) {d[2..7]}-{d[7..]}";
    }
    public static string MascaraCep(string v)
    {
        var d = Digitos(v);
        if (d.Length > 8) d = d[..8];
        return d.Length > 5 ? $"{d[..5]}-{d[5..]}" : d;
    }
    public static string MascaraData(string v)
    {
        var d = Digitos(v);
        if (d.Length > 8) d = d[..8];
        if (d.Length > 4) return $"{d[..2]}/{d[2..4]}/{d[4..]}";
        if (d.Length > 2) return $"{d[..2]}/{d[2..]}";
        return d;
    }
    /// <summary>"dd/MM/yyyy" -> "yyyy-MM-dd" (null se invalida ou no futuro).</summary>
    public static string DataBrParaIso(string dmy)
    {
        if (!DateTime.TryParseExact(dmy?.Trim(), "dd/MM/yyyy", Br, DateTimeStyles.None, out var d)) return null;
        return d.Year < 1900 || d > DateTime.Today ? null : Iso(d);
    }

    public static bool CpfValido(string v)
    {
        var c = Digitos(v);
        if (c.Length != 11 || c.Distinct().Count() == 1) return false;
        int Dv(int n) { var s = 0; for (var i = 0; i < n; i++) s += (c[i] - '0') * (n + 1 - i); var r = s * 10 % 11; return r == 10 ? 0 : r; }
        return Dv(9) == c[9] - '0' && Dv(10) == c[10] - '0';
    }

    public static int? Idade(string nascimentoIso)
    {
        var n = ParseData(nascimentoIso);
        if (n == null) return null;
        var hoje = DateTime.Today;
        var a = hoje.Year - n.Value.Year;
        if (n.Value.Date > hoje.AddYears(-a)) a--;
        return a;
    }

    [GeneratedRegex("\\D")]
    private static partial Regex DigRx();
}
