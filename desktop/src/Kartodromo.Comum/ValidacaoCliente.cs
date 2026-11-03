using System.Globalization;
using System.Text.RegularExpressions;

namespace Kartodromo.Comum;

public static class ValidacaoCliente
{
    public static string NormalizarInstagram(string instagram)
    {
        var usuario = instagram?.Trim() ?? "";
        var perfil = Regex.Match(usuario, @"^(?:https?://)?(?:www\.)?instagram\.com/([^/?#]+)/?(?:[?#].*)?$", RegexOptions.IgnoreCase);
        if (perfil.Success) usuario = perfil.Groups[1].Value;
        if (usuario.StartsWith('@')) usuario = usuario[1..];
        return usuario.Length == 0 ? "" : "@" + usuario.ToLowerInvariant();
    }

    public static string ErroInstagram(string instagram)
    {
        if (string.IsNullOrWhiteSpace(instagram)) return null; // Instagram é opcional
        var perfil = NormalizarInstagram(instagram);
        return Regex.IsMatch(perfil, @"^@[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$") && !perfil.Contains("..")
            ? null : "Instagram inválido. Informe o @usuário do piloto (ex.: @andre.silva).";
    }

    public static string ErroEmail(string email)
    {
        email = email?.Trim() ?? "";
        if (email.Length == 0) return "O e-mail é obrigatório.";
        if (email.Contains('*') && email.Contains('@')) return null;
        return email.Length <= 200 && Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$")
            ? null : "E-mail inválido. Informe um e-mail válido.";
    }

    public static string ErroPeso(string peso)
    {
        peso = peso?.Trim() ?? "";
        if (peso.Length == 0) return "O peso é obrigatório. Informe o peso em kg.";
        return double.TryParse(peso.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out var kg)
            && double.IsFinite(kg) && kg >= 10 && kg <= 250
            ? null : "Peso inválido. Informe um valor entre 10 e 250 kg.";
    }
}
