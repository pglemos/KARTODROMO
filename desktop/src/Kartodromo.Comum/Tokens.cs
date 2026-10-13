namespace Kartodromo.Comum;

/// <summary>Design tokens do sistema: TODA cor, fonte, raio e espaço de tela sai daqui.
/// Os valores vêm de tokens/kib.tokens.json e são gerados em Tokens.g.cs (`npm run tokens`); não escreva cor
/// nem tamanho direto no código. Telas novas usam <c>Tokens.Claro.*</c> (operação) ou <c>Tokens.Escuro.*</c> (público).
/// Os nomes antigos (Texto, Verde, RaioCampo…) continuam valendo com o valor de antes.
/// Documentação: docs/design-system/README.md.
/// Exceção: degradês dos ícones (arte de cada tela) continuam no próprio ícone.</summary>
public static partial class Tokens
{
    /// <summary>Segoe UI no tamanho do canvas (px): Tokens.Fonte(Tokens.Corpo, FontStyle.Bold).</summary>
    public static Font Fonte(float px, FontStyle estilo = FontStyle.Regular) => new("Segoe UI", px * 0.75f, estilo);
    /// <summary>Segoe UI Semibold (peso 600) no tamanho do canvas (px).</summary>
    public static Font FonteSemibold(float px, FontStyle estilo = FontStyle.Regular) => new("Segoe UI Semibold", px * 0.75f, estilo);
    /// <summary>Números alinhados (tempos, voltas, posições): Cascadia Mono no tamanho do canvas (px).</summary>
    public static Font FonteNumero(float px, FontStyle estilo = FontStyle.Regular) => new("Cascadia Mono", px * 0.75f, estilo);
}
