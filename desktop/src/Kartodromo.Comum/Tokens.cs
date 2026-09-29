namespace Kartodromo.Comum;

/// <summary>Design tokens do sistema (paleta do canvas, estilo Apple): TODA cor de tela sai daqui.
/// Tons quase iguais que estavam espalhados no código (5 cinzas de borda, 4 cinzas de botão, 4 verdes suaves)
/// foram unificados num nome só. Para mudar o visual, muda aqui.
/// Exceção: degradês dos ícones (arte de cada tela) continuam no próprio ícone.</summary>
public static class Tokens
{
    // ---------- texto
    /// <summary>Texto principal (#1D1D1F).</summary>
    public static readonly Color Texto = Color.FromArgb(29, 29, 31);
    /// <summary>Rótulos, subtítulos, legendas (#6E6E73).</summary>
    public static readonly Color TextoSecundario = Color.FromArgb(110, 110, 115);
    /// <summary>Dicas e placeholders (#8E8E93).</summary>
    public static readonly Color TextoTerciario = Color.FromArgb(142, 142, 147);
    /// <summary>Texto/controle desabilitado e bordas fortes (#C7C7CC).</summary>
    public static readonly Color TextoDesabilitado = Color.FromArgb(199, 199, 204);

    // ---------- superfícies
    /// <summary>Fundo das janelas e da área de trabalho (#F5F5F7).</summary>
    public static readonly Color Fundo = Color.FromArgb(245, 245, 247);
    /// <summary>Cartões, campos e cabeçalhos.</summary>
    public static readonly Color Superficie = Color.White;
    /// <summary>Superfície levemente cinza: menus suspensos, cabeçalho de tabela (#FAFAFC).</summary>
    public static readonly Color SuperficieSuave = Color.FromArgb(250, 250, 252);
    /// <summary>Busca, segmentados e botões “fantasma” (#F2F2F5).</summary>
    public static readonly Color FundoCampo = Color.FromArgb(242, 242, 245);
    /// <summary>Lateral (árvore) da tela principal (#ECECF0).</summary>
    public static readonly Color Lateral = Color.FromArgb(236, 236, 240);
    /// <summary>Linha divisória e borda de cartão/campo (#E5E5EA).</summary>
    public static readonly Color Linha = Color.FromArgb(229, 229, 234);
    /// <summary>Borda de campo de digitação sem foco (#DBDBDB).</summary>
    public static readonly Color BordaCampo = Color.FromArgb(219, 219, 219);
    /// <summary>Botão secundário (Cancelar, Fechar, ✕) (#EBEBEF).</summary>
    public static readonly Color BotaoSecundario = Color.FromArgb(235, 235, 239);

    // ---------- marca e estados
    /// <summary>Ação principal (Salvar, Entrar, seleção) (#0B7A53).</summary>
    public static readonly Color Verde = Color.FromArgb(11, 122, 83);
    /// <summary>Verde escuro de texto sobre verde suave (#0A5E40).</summary>
    public static readonly Color VerdeEscuro = Color.FromArgb(10, 94, 64);
    /// <summary>Valores positivos / ativo (#1C6B35).</summary>
    public static readonly Color VerdeTexto = Color.FromArgb(28, 107, 53);
    /// <summary>Fundo verde suave (botão de campo, selo “Ativo”) (#E8F5EE).</summary>
    public static readonly Color VerdeSuave = Color.FromArgb(232, 245, 238);
    /// <summary>Seleção na lateral (#DAE8E1).</summary>
    public static readonly Color VerdeSelecao = Color.FromArgb(218, 232, 225);
    /// <summary>Bolinha de status on-line / interruptor ligado (#34C759).</summary>
    public static readonly Color VerdeStatus = Color.FromArgb(52, 199, 89);
    /// <summary>Perigo: excluir, estornar, valores negativos (#C4281C).</summary>
    public static readonly Color Vermelho = Color.FromArgb(196, 40, 28);
    /// <summary>Atenção em texto: a pagar, pendente (#B26A00).</summary>
    public static readonly Color Laranja = Color.FromArgb(178, 106, 0);
    /// <summary>Selo/contador laranja (#FF9F0A).</summary>
    public static readonly Color LaranjaVivo = Color.FromArgb(255, 159, 10);
    /// <summary>Texto sobre fundo laranja suave (#8A4B00).</summary>
    public static readonly Color LaranjaEscuro = Color.FromArgb(138, 75, 0);
    /// <summary>Informação / links (#1E6FE8).</summary>
    public static readonly Color Azul = Color.FromArgb(30, 111, 232);
    /// <summary>Texto azul sobre azul suave (#0A4FA0).</summary>
    public static readonly Color AzulTexto = Color.FromArgb(10, 79, 160);
    /// <summary>Fundo azul suave (selo “Classificatório”, “Incluindo”) (#E1EEFF).</summary>
    public static readonly Color AzulSuave = Color.FromArgb(225, 238, 255);
    /// <summary>Superfície escura (painel do troco, lateral do voucher) (#1C1C1E).</summary>
    public static readonly Color Preto = Color.FromArgb(28, 28, 30);
    /// <summary>Cinza-grafite de ícones e texto sobre escuro (#3A3A3C).</summary>
    public static readonly Color Grafite = Color.FromArgb(58, 58, 60);

    // ---------- forma e espaço (px do canvas)
    public const int RaioCampo = 9, RaioBotao = 10, RaioCartao = 14, RaioJanela = 18;
    public const int Espaco1 = 4, Espaco2 = 8, Espaco3 = 12, Espaco4 = 16, Espaco5 = 20, Espaco6 = 24;

    // ---------- tipografia (tamanhos do canvas em px → pontos do Windows)
    public const float Legenda = 11f, Pequeno = 12f, Corpo = 13f, CorpoMaior = 13.5f, Subtitulo = 15f, Titulo = 17f, TituloGrande = 22f;
    /// <summary>Segoe UI no tamanho do canvas (px): Tokens.Fonte(Tokens.Corpo, FontStyle.Bold).</summary>
    public static Font Fonte(float px, FontStyle estilo = FontStyle.Regular) => new("Segoe UI", px * 0.75f, estilo);
}
