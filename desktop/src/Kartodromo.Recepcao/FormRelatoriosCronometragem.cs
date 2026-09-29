using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>
/// Entrada rápida dos relatórios da Cronometragem na Recepção.
/// A lista vem do serviço de cronometragem, portanto inclui provas encerradas e
/// não depende da situação comercial da bateria na agenda.
/// </summary>
public sealed class FormRelatoriosCronometragem : DialogoDesign
{
    static readonly (string slug, string nome)[] Tipos =
    [
        ("resultados_oficiais", "Resultado oficial"),
        ("sem_velocidade", "Resultado oficial · sem velocidade média"),
        ("com_tempo_medio", "Resultado oficial · com tempo médio"),
        ("ordem_chegada", "Ordem de chegada"),
        ("ordem_chegada_categoria", "Ordem de chegada · por categoria"),
        ("passagens", "Relatório de passagens"),
        ("volta_a_volta", "Volta a volta · todos"),
        ("mapa_voltas", "Mapa de voltas · todos"),
        ("mapa_prova", "Mapa de prova"),
        ("grid_2col_esq", "Grid · 2 colunas · líder à esquerda"),
        ("grid_2col_dir", "Grid · 2 colunas · líder à direita"),
        ("grid_3col_esq", "Grid · 3 colunas · líder à esquerda"),
        ("grid_3col_dir", "Grid · 3 colunas · líder à direita"),
    ];

    readonly JsonObject _bateriaInicial;
    readonly string _tipoInicial;
    readonly bool _abrirAutomaticamente;
    readonly Grade _lista = new();
    readonly ComboBox _tipo = Campos.Combo();
    readonly Label _criterio = new() { AutoSize = true, Font = new Font("Segoe UI", 9.2F), ForeColor = Tokens.Grafite, Margin = new Padding(0, 2, 0, 6) };
    readonly Label _estado = new() { AutoSize = true, Font = new Font("Segoe UI", 9F), ForeColor = Tokens.TextoSecundario, Margin = new Padding(0, 0, 0, 4) };
    List<JsonObject> _sessoes = [];

    public FormRelatoriosCronometragem(JsonObject bateriaInicial = null, string tipoInicial = "resultados_oficiais", bool abrirAutomaticamente = false)
        : base("Relatórios de cronometragem", "Escolha uma bateria e abra o resultado no mesmo padrão da Cronometragem", "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7", "linear-gradient(180deg, #6CB8FF, #1E6FE8)", 1080, 800) // 720 cortava o "Formato do relatório" no rodapé
    {
        _bateriaInicial = bateriaInicial;
        _tipoInicial = Tipos.Any(t => t.slug == tipoInicial) ? tipoInicial : "resultados_oficiais";
        _abrirAutomaticamente = abrirAutomaticamente;

        var lista = Secao("Baterias disponíveis", "As baterias encerradas continuam disponíveis aqui. Duplo clique abre o resultado selecionado.");
        _lista.Colunas(
            new("dataReferencia", "Data/Hora", TipoCol.DataHora, 140, r => DataReferencia(r)),
            new("name", "Bateria / prova", Largura: 360),
            new("tipo", "Tipo", Largura: 145, Valor: r => Tipo(r.S("type"))),
            new("state", "Situação", Largura: 120, Valor: r => Estado(r.S("state"))),
            new("competitors", "Pilotos", TipoCol.Inteiro, 78));
        _lista.CorLinha = r => r.S("state") == "encerrada" ? Color.FromArgb(52, 52, 54) : Tokens.Verde;
        _lista.Height = 330;
        _lista.MultiSelect = false;
        _lista.SelectionChanged += (_, _) => AtualizarCriterio();
        _lista.Duplo += _ => AbrirRelatorio();
        lista.Controls.Add(_lista);
        lista.SetColumnSpan(_lista, 6);

        var formato = Secao("Formato do relatório", "A classificação é definida pelo tipo da prova: corrida = ordem de chegada; tomada de tempo = melhor volta.");
        foreach (var (_, nome) in Tipos) _tipo.Items.Add(nome);
        _tipo.SelectedIndex = Math.Max(0, Array.FindIndex(Tipos, t => t.slug == _tipoInicial));
        Campo(formato, "Relatório", _tipo, 4);
        formato.Controls.Add(_criterio);
        formato.SetColumnSpan(_criterio, 6);
        formato.Controls.Add(_estado);
        formato.SetColumnSpan(_estado, 6);

        BotaoRodape("Abrir relatório", true, AbrirRelatorio);
        BotaoRodape("Fechar", false, Close);
        Load += (_, _) => Seguro.Rodar(this, CarregarAsync);
    }

    static DateTime? DataReferencia(JsonObject sessao)
    {
        var ms = sessao.L("startedAt") ?? sessao.L("finishedAt") ?? sessao.L("createdAt");
        return ms is long n && n > 0 ? DateTimeOffset.FromUnixTimeMilliseconds(n).LocalDateTime : null;
    }

    static string Tipo(string tipo) => tipo switch
    {
        "classificacao" => "Tomada de tempo",
        "corrida" => "Corrida",
        "treino" => "Treino",
        _ => string.IsNullOrWhiteSpace(tipo) ? "—" : tipo,
    };

    static string Estado(string estado) => estado switch
    {
        "encerrada" => "Encerrada",
        "em_andamento" => "Em andamento",
        "bandeira_final" => "Finalizando",
        "preparando" => "Preparando",
        "cancelada" => "Cancelada",
        _ => string.IsNullOrWhiteSpace(estado) ? "—" : estado,
    };

    async Task CarregarAsync()
    {
        try
        {
            // A API autenticada do servidor agrega a Cronometragem e usa
            // startedAt/finishedAt/createdAt, nessa ordem, para não perder encerradas.
            _sessoes = await Sessao.Api.Lista("/api/office/crono/sessoes");
            _lista.Carregar(_sessoes);
            _estado.Text = _sessoes.Count == 0 ? "Nenhuma bateria registrada na Cronometragem." : $"{_sessoes.Count} bateria(s) disponíveis para relatório.";

            if (_bateriaInicial != null)
            {
                var achada = EncontrarCorrespondente(_bateriaInicial);
                if (achada != null)
                {
                    _lista.Selecionar(s => s.S("id") == achada.S("id"));
                    if (_abrirAutomaticamente && IsHandleCreated)
                        BeginInvoke(new Action(() => AbrirRelatorio(_tipoInicial)));
                }
                else _estado.Text = "A bateria está na Recepção, mas ainda não foi associada a uma sessão da Cronometragem. Escolha uma sessão abaixo.";
            }
            AtualizarCriterio();
        }
        catch (Exception ex)
        {
            _estado.ForeColor = Tokens.Vermelho;
            _estado.Text = "Não foi possível consultar a Cronometragem: " + ex.Message;
        }
    }

    JsonObject EncontrarCorrespondente(JsonObject bateria)
    {
        var id = bateria.L("id");
        var porAgenda = id is long n ? _sessoes.FirstOrDefault(s => s.L("agendaId") == n) : null;
        if (porAgenda != null) return porAgenda;

        var hora = bateria.D("dataHora");
        var nome = Normalizar(bateria.S("nome"));
        return _sessoes
            .Where(s =>
            {
                var data = DataReferencia(s);
                var mesmoDia = hora == null || data == null || data.Value.Date == hora.Value.Date;
                var nomeSessao = Normalizar(s.S("name"));
                var mesmoNome = nome.Length == 0 || nomeSessao.Contains(nome) || nome.Contains(nomeSessao);
                var mesmaHora = hora == null || data == null || Math.Abs((data.Value - hora.Value).TotalMinutes) <= 90;
                return mesmoDia && (mesmoNome || mesmaHora);
            })
            .OrderBy(s => hora == null || DataReferencia(s) == null ? double.MaxValue : Math.Abs((DataReferencia(s)!.Value - hora.Value).TotalMinutes))
            .FirstOrDefault();
    }

    static string Normalizar(string valor) => new string((valor ?? "").Normalize().Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();

    void AtualizarCriterio()
    {
        var sessao = _lista.Atual;
        if (sessao == null)
        {
            _criterio.Text = "Selecione uma bateria para abrir o relatório.";
            return;
        }
        _criterio.Text = sessao.S("type") == "corrida"
            ? "Critério: CLASSIFICAÇÃO OFICIAL · ordem de chegada. A melhor volta é apenas informativa."
            : sessao.S("type") == "classificacao"
                ? "Critério: TOMADA DE TEMPO · melhor volta."
                : "Critério: TREINO · melhor volta.";
    }

    void AbrirRelatorio() => AbrirRelatorio(null);

    void AbrirRelatorio(string tipoForcado)
    {
        var sessao = _lista.Atual;
        if (sessao == null)
        {
            Msg.Aviso(this, "Selecione uma bateria da Cronometragem.");
            return;
        }
        var tipo = tipoForcado ?? Tipos[Math.Clamp(_tipo.SelectedIndex, 0, Tipos.Length - 1)].slug;
        var url = $"{Config.CronoUrl}/resultado/{Uri.EscapeDataString(sessao.S("id"))}?tipo={Uri.EscapeDataString(tipo)}";
        var titulo = $"{Tipos.First(t => t.slug == tipo).nome} · {sessao.S("name")}";
        var dono = Owner ?? this;
        Relatorio.Abrir(dono, url, titulo);
        BeginInvoke(new Action(Close));
    }
}
