namespace Kartodromo.Comum;

/// <summary>Desenhos de traço da família Lucide (grade 24, traço 2) usados pelos componentes do design system.
/// Um conceito = um ícone em todo o sistema (docs/design-system/01-fundamentos/iconografia.md).
/// Desenhe com <see cref="Forma.DesenharSvg"/>. Cada trecho depois do primeiro começa com M MAIÚSCULO: o m relativo
/// seria contado a partir do fim do trecho anterior (o círculo), não da origem.</summary>
public static class IconesLucide
{
    const string Circulo = "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20";

    public const string Info = Circulo + "M12 16v-4M12 8h.01";
    public const string Sucesso = Circulo + "M9 12l2 2l4-4";
    public const string Erro = Circulo + "M15 9l-6 6M9 9l6 6";
    public const string Aviso = "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01";
    public const string Pergunta = Circulo + "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01";
    public const string Fechar = "M18 6 6 18M6 6l12 12";
    public const string Mais = "M5 12h14M12 5v14";
    public const string Lixeira = "M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2";
    public const string Lapis = "M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5zM15 5l4 4";
    public const string Busca = "M11 3a8 8 0 1 0 0 16a8 8 0 1 0 0-16M21 21l-4.3-4.3";
    public const string Caixa = "M3 7h18v12H3zM16 13h.01M3 7l2-4h14l2 4";
    public const string Bandeira = "M4 22V4M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1";
}
