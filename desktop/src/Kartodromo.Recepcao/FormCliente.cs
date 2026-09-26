using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>"Registro de Cliente" (REC-003): navegacao, incluir/editar/excluir, abas Principal e Financeiro.</summary>
public class FormCliente : Janela
{
    static Api Api => Sessao.Api;
    JsonObject _atual;
    string _modo = "ver";
    readonly bool _soNovo;
    public long? CriadoId { get; private set; }

    readonly ComboBox _tipoPessoa = Campos.Combo("Pessoa Física", "Pessoa Jurídica");
    readonly ComboBox _tipoDoc = Campos.Combo("CPF", "RG", "PASSAPORTE", "OUTRO");
    readonly TextBox _doc = Campos.Texto(40), _cep = Campos.Texto(10), _end = Campos.Texto(200), _nome = Campos.Texto(200), _num = Campos.Texto(20),
        _compl = Campos.Texto(100), _bairro = Campos.Texto(100), _email = Campos.Texto(200), _cidade = Campos.Texto(100), _uf = Campos.Texto(2),
        _peso = Campos.Texto(6), _fone = Campos.Texto(40), _resp = new() { ReadOnly = true }, _obs = Campos.Texto(400);
    readonly ComboBox _tipoCli = Campos.Combo("Consumidor Final");
    readonly ComboBox _sexo = Campos.Combo("Não Informado", "Masculino", "Feminino");
    readonly MaskedTextBox _nasc = new() { Mask = "00/00/0000", ValidatingType = typeof(DateTime) };
    readonly CheckBox _bloq = Campos.Check("Bloqueado"), _lgpd = Campos.Check("Concordo com os termos de uso dos meus dados");
    long? _respId;
    readonly Label _id = new() { Text = "0", AutoSize = true, Font = Tema.Negrito };
    readonly Label _pos = new() { AutoSize = true, ForeColor = Tema.Cinza, Anchor = AnchorStyles.Right };
    readonly Label _status = new() { AutoSize = true, ForeColor = Tema.Cinza, Font = Tema.Negrito };
    readonly Grade _hist = new();
    readonly Label _fin = new() { Dock = DockStyle.Top, Height = 44, Padding = new Padding(4) };
    readonly Dictionary<string, ToolStripButton> _bt = [];
    readonly TableLayoutPanel _form;

    public FormCliente(long? id, bool soNovo = false, string preenche = null) : base("Registro de Cliente", 980, 470)
    {
        _soNovo = soNovo;
        ShowInTaskbar = !soNovo;
        Campos.Mascara(_fone, Fmt.MascaraFone);
        Campos.Mascara(_cep, Fmt.MascaraCep);
        Campos.Mascara(_doc, s => _tipoDoc.Text == "CPF" ? Fmt.MascaraCpf(s) : s);

        // barra de ferramentas (Pesquisar, Incluir, Editar, Excluir, Salvar, Cancelar, Inicio, Anterior, Proximo, Fim, Fechar)
        var tb = new ToolStrip { GripStyle = ToolStripGripStyle.Hidden, ImageScalingSize = new Size(20, 20), Font = Tema.Normal, Padding = new Padding(4, 2, 4, 2), RenderMode = ToolStripRenderMode.System };
        void B(string k, string t, string gl, Color c, Action a) { var b = new ToolStripButton(t, Icone.Tile(gl, c, 20), (_, _) => a()) { TextImageRelation = TextImageRelation.ImageAboveText }; _bt[k] = b; tb.Items.Add(b); }
        B("pesq", "Pesquisar", "", Color.DimGray, Pesquisar); B("novo", "Incluir", "", Tema.Azul, Novo); B("edit", "Editar", "", Tema.Azul, () => SetModo("edit"));
        B("del", "Excluir", "", Tema.Vermelho, Excluir); B("save", "Salvar", "", Tema.Verde, Salvar); B("canc", "Cancelar", "", Color.DimGray, Cancelar);
        tb.Items.Add(new ToolStripSeparator());
        B("first", "Início", "", Color.DimGray, () => Navegar("first")); B("prev", "Anterior", "", Color.DimGray, () => Navegar("prev"));
        B("next", "Próximo", "", Color.DimGray, () => Navegar("next")); B("last", "Fim", "", Color.DimGray, () => Navegar("last"));
        tb.Items.Add(new ToolStripSeparator());
        B("fechar", "Fechar", "", Tema.Vermelho, Close);
        tb.Items.Add(new ToolStripLabel { Alignment = ToolStripItemAlignment.Right }.Also(l => l.Text = ""));

        // Principal
        _form = Campos.Grade(6, 14, 12, 17, 11, 16, 30);
        Campos.Add(_form, "Tipo de pessoa", _tipoPessoa); Campos.Add(_form, "Tipo documento", _tipoDoc); Campos.Add(_form, "Nº documento", _doc);
        Campos.Add(_form, "Cep", _cep); var bCep = new Button { Text = "🔍 Buscar CEP", Height = 24 }; bCep.Click += (_, _) => BuscarCep(); Campos.Add(_form, " ", bCep); Campos.Add(_form, "Endereço", _end);
        Campos.Add(_form, "Tipo de cliente", _tipoCli); Campos.Add(_form, "Nome *", _nome, 2); Campos.Add(_form, "Nº", _num); Campos.Add(_form, "Complemento", _compl); Campos.Add(_form, "Bairro", _bairro);
        Campos.Add(_form, "Sexo", _sexo); Campos.Add(_form, "E-mail", _email, 2); Campos.Add(_form, "Estado", _uf); Campos.Add(_form, "Cidade", _cidade, 2);
        Campos.Add(_form, "Peso (kg)", _peso); Campos.Add(_form, "Aniversário", _nasc); Campos.Add(_form, "Telefone", _fone); Campos.Add(_form, "País", new TextBox { Text = "Brasil", ReadOnly = true }); Campos.Add(_form, null, _bloq, 2);
        var respBox = new Panel { Height = 24 };
        var bResp = new Button { Text = "➕", Width = 30, Dock = DockStyle.Right }; bResp.Click += (_, _) => { if (_modo == "ver") return; var c = FormPesquisarCliente.Escolher(this, "Selecionar responsável"); if (c != null) { _respId = c.L("id"); _resp.Text = c.S("nome"); } };
        var bRespX = new Button { Text = "✕", Width = 30, Dock = DockStyle.Right }; bRespX.Click += (_, _) => { if (_modo == "ver") return; _respId = null; _resp.Text = ""; };
        _resp.Dock = DockStyle.Fill; respBox.Controls.Add(_resp); respBox.Controls.Add(bRespX); respBox.Controls.Add(bResp);
        Campos.Add(_form, "Responsável", respBox, 3); Campos.Add(_form, null, _lgpd, 3);
        Campos.Add(_form, "Observação", _obs, 6);

        var idBar = new Panel { Dock = DockStyle.Top, Height = 28, BackColor = Color.White, BorderStyle = BorderStyle.FixedSingle, Padding = new Padding(4) };
        idBar.Controls.Add(new Label { Text = "Id:", BackColor = Color.FromArgb(139, 0, 0), ForeColor = Color.White, AutoSize = false, Size = new Size(60, 18), TextAlign = ContentAlignment.MiddleCenter, Location = new Point(4, 4) });
        _id.Location = new Point(76, 5);
        idBar.Controls.Add(_id);
        idBar.Controls.Add(_pos);
        idBar.Resize += (_, _) => _pos.Location = new Point(idBar.Width - _pos.Width - 10, 5);

        var abas = new TabControl { Dock = DockStyle.Fill };
        var pPrincipal = new TabPage("Principal") { Padding = new Padding(8), BackColor = Tema.Janela };
        pPrincipal.Controls.Add(_form);
        pPrincipal.Controls.Add(idBar);
        var pFin = new TabPage("Financeiro") { Padding = new Padding(8), BackColor = Tema.Janela };
        _hist.Colunas(new("dataHora", "Data/Hora", TipoCol.DataHora), new("bateria", "Bateria", Largura: 140), new("produto", "Produto", Largura: 220), new("valor", "Valor", TipoCol.Dinheiro), new("pago", "Pago", TipoCol.Bool), new("status", "Situação"));
        pFin.Controls.Add(_hist); pFin.Controls.Add(_fin);
        abas.TabPages.AddRange([pPrincipal, pFin]);
        var topo = new Panel { Dock = DockStyle.Top, Height = 24 };
        _status.Location = new Point(8, 4); topo.Controls.Add(_status);

        Controls.Add(abas);
        Controls.Add(topo);
        Controls.Add(tb);

        Load += async (_, _) =>
        {
            if (soNovo) { Novo(); Preencher(preenche); return; }
            SetModo("ver");
            if (id != null) await Mostrar(id.Value); else Navegar("last");
        };
    }

    void Preencher(string q)
    {
        if (string.IsNullOrWhiteSpace(q)) return;
        if (Fmt.Digitos(q).Length >= 5 && !q.Any(char.IsLetter)) _doc.Text = q;
        else if (q.Contains('@')) _email.Text = q;
        else _nome.Text = q;
    }

    void SetModo(string m)
    {
        _modo = m;
        _status.Text = m == "novo" ? "Incluindo" : m == "edit" ? "Editando" : "";
        var ro = m == "ver";
        foreach (var c in new Control[] { _tipoPessoa, _tipoDoc, _doc, _cep, _end, _tipoCli, _nome, _num, _compl, _bairro, _sexo, _email, _cidade, _uf, _peso, _nasc, _fone, _bloq, _lgpd, _obs })
        {
            if (c is TextBoxBase t) t.ReadOnly = ro; else c.Enabled = !ro;
        }
        _bt["save"].Enabled = _bt["canc"].Enabled = !ro;
        foreach (var k in new[] { "pesq", "novo", "edit", "del", "first", "prev", "next", "last" }) _bt[k].Enabled = ro && (!_soNovo);
    }

    async Task Mostrar(long id)
    {
        var c = await Api.Get($"/api/office/clientes/{id}");
        _atual = c.AsObject();
        _tipoPessoa.SelectedIndex = 0;
        _tipoDoc.SelectedItem = _tipoDoc.Items.Contains(c.S("tipoDocumento")) ? c.S("tipoDocumento") : "CPF";
        _doc.Text = c.S("documento"); _cep.Text = c.S("cep"); _end.Text = c.S("endereco"); _nome.Text = c.S("nome"); _num.Text = c.S("numero");
        _compl.Text = c.S("complemento"); _bairro.Text = c.S("bairro"); _email.Text = c.S("email"); _cidade.Text = c.S("cidade"); _uf.Text = c.S("estado");
        _peso.Text = c.S("peso"); _fone.Text = c.S("telefone"); _obs.Text = c.S("observacao");
        _sexo.SelectedIndex = c.S("sexo") == "M" ? 1 : c.S("sexo") == "F" ? 2 : 0;
        _nasc.Text = Fmt.Dmy(c.S("nascimento"));
        _bloq.Checked = c.B("bloqueado"); _lgpd.Checked = !string.IsNullOrEmpty(c.S("lgpdAceiteEm"));
        _respId = c.L("responsavelId"); _resp.Text = c.S("responsavelNome");
        _id.Text = c.S("id");
        _pos.Text = $"Registro {c.S("posicao")} de {c.S("totalRegistros")} · origem {c.S("origem")} · desde {Fmt.Dmy(c.S("criadoEm"))}";
        var f = c["financeiro"];
        var deps = c["dependentes"] is JsonArray d && d.Count > 0 ? "\nDependentes: " + string.Join(", ", d.Select(x => x.S("nome"))) : "";
        _fin.Text = $"Compras: {f.S("vendas")} · Total: {Fmt.Brl(f.L("total"))} · Última: {Fmt.DmyHm(f.S("ultima"))}{deps}";
        _hist.Carregar(c["historico"] is JsonArray h ? h.OfType<JsonObject>() : []);
        SetModo("ver");
    }

    void Navegar(string dir) => Seguro.Rodar(this, async () =>
    {
        var r = await Api.Get($"/api/office/clientes/nav?dir={dir}&id={_atual?.S("id") ?? "0"}");
        if (r?.L("id") is long id) await Mostrar(id);
    });

    void Pesquisar()
    {
        var c = FormPesquisarCliente.Escolher(this);
        if (c != null) Seguro.Rodar(this, () => Mostrar(c.L("id") ?? 0));
    }

    void Novo()
    {
        _atual = null;
        foreach (var t in new[] { _doc, _cep, _end, _nome, _num, _compl, _bairro, _email, _cidade, _uf, _peso, _fone, _resp, _obs }) t.Text = "";
        _nasc.Text = ""; _sexo.SelectedIndex = 0; _tipoDoc.SelectedIndex = 0; _bloq.Checked = false; _lgpd.Checked = true; _respId = null;
        _id.Text = "0"; _pos.Text = "";
        SetModo("novo");
        _doc.Focus();
    }

    void Cancelar()
    {
        if (_soNovo) { Close(); return; }
        if (_atual != null) Seguro.Rodar(this, () => Mostrar(_atual.L("id") ?? 0)); else SetModo("ver");
    }

    JsonObject Corpo()
    {
        string nascIso = null;
        if (_nasc.MaskCompleted) { nascIso = Fmt.DataBrParaIso(_nasc.Text); if (nascIso == null) throw new ApiException("Data de aniversário inválida.", 400); }
        return new JsonObject
        {
            ["tipoDocumento"] = _tipoDoc.Text, ["documento"] = _doc.Text.Trim(), ["nome"] = _nome.Text.Trim(), ["email"] = _email.Text.Trim(), ["telefone"] = _fone.Text.Trim(),
            ["nascimento"] = nascIso, ["sexo"] = _sexo.SelectedIndex == 1 ? "M" : _sexo.SelectedIndex == 2 ? "F" : null, ["peso"] = _peso.Text.Trim(), ["cep"] = _cep.Text.Trim(),
            ["endereco"] = _end.Text.Trim(), ["numero"] = _num.Text.Trim(), ["complemento"] = _compl.Text.Trim(), ["bairro"] = _bairro.Text.Trim(), ["cidade"] = _cidade.Text.Trim(),
            ["estado"] = _uf.Text.Trim().ToUpperInvariant(), ["responsavelId"] = _respId, ["lgpd"] = _lgpd.Checked, ["bloqueado"] = _bloq.Checked, ["observacao"] = _obs.Text.Trim(),
        };
    }

    void Salvar() => Seguro.Rodar(this, async () =>
    {
        if (string.IsNullOrWhiteSpace(_nome.Text)) { Msg.Aviso(this, "Informe o nome."); return; }
        var body = Corpo();
        if (_modo == "novo")
        {
            var r = await Api.Post("/api/office/clientes", body);
            CriadoId = r.L("id");
            Msg.Info(this, "Operação concluída com sucesso.");
            if (_soNovo) { DialogResult = DialogResult.OK; Close(); return; }
            await Mostrar(CriadoId.Value);
        }
        else
        {
            await Api.Put($"/api/office/clientes/{_atual.S("id")}", body);
            Msg.Info(this, "Operação concluída com sucesso.");
            await Mostrar(_atual.L("id") ?? 0);
        }
    });

    void Excluir() => Seguro.Rodar(this, async () =>
    {
        if (_atual == null || !Msg.Pergunta(this, "Deseja excluir definitivamente o registro atual?")) return;
        await Api.Delete($"/api/office/clientes/{_atual.S("id")}");
        _atual = null;
        Navegar("last");
    });

    async void BuscarCep()
    {
        var cep = Fmt.Digitos(_cep.Text);
        if (cep.Length != 8) { Msg.Aviso(this, "Informe o CEP com 8 dígitos."); return; }
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(8) };
            var r = JsonNode.Parse(await http.GetStringAsync($"https://viacep.com.br/ws/{cep}/json/"));
            if (r?["erro"] != null) { Msg.Aviso(this, "CEP não encontrado."); return; }
            _end.Text = r.S("logradouro"); _bairro.Text = r.S("bairro"); _cidade.Text = r.S("localidade"); _uf.Text = r.S("uf");
        }
        catch { Msg.Aviso(this, "Não foi possível consultar o CEP (sem internet?)."); }
    }

    /// <summary>Cadastro rapido a partir da pesquisa: abre em modo inclusao e devolve o id.</summary>
    public static long? Novo(IWin32Window dono, string preenche = null)
    {
        using var f = new FormCliente(null, true, preenche);
        return f.ShowDialog(dono) == DialogResult.OK ? f.CriadoId : null;
    }
}

public static class Extensoes
{
    public static T Also<T>(this T o, Action<T> a) { a(o); return o; }
}

/// <summary>"Pesquisar Cliente": busca por nome/CPF/telefone/e-mail, devolve o escolhido.</summary>
public class FormPesquisarCliente : Janela
{
    readonly TextBox _q = new();
    readonly RadioButton _auto = new() { Text = "Auto", Checked = true, AutoSize = true }, _nome = new() { Text = "Nome", AutoSize = true },
        _doc = new() { Text = "CPF/Telefone", AutoSize = true }, _email = new() { Text = "E-mail", AutoSize = true };
    readonly Grade _g = new();
    public JsonObject Escolhido { get; private set; }

    FormPesquisarCliente(string titulo, string inicial) : base(titulo, 900, 440, true)
    {
        var topo = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 36, Padding = new Padding(6, 6, 6, 0), WrapContents = false };
        _q.Width = 360; _q.Text = inicial ?? "";
        var b = new Button { Text = "Pesquisar", AutoSize = true };
        b.Click += (_, _) => Buscar();
        _q.KeyDown += (_, e) => { if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; Buscar(); } };
        topo.Controls.AddRange([new Label { Text = "Pesquisar:", AutoSize = true, Margin = new Padding(0, 6, 4, 0) }, _q, _auto, _nome, _doc, _email, b]);
        _g.Colunas(new("nome", "Nome", Largura: 250), new("documento", "Documento", Largura: 120), new("telefone", "Telefone", Largura: 120), new("email", "E-mail", Largura: 200),
            new("nascimento", "Nascimento", TipoCol.Data), new("cidade", "Cidade", Largura: 120), new("responsavelNome", "Responsável", Largura: 160), new("bloqueado", "Bloq.", TipoCol.Bool));
        _g.Duplo += r => { Escolhido = r; DialogResult = DialogResult.OK; Close(); };
        Controls.Add(new Panel { Dock = DockStyle.Fill, Padding = new Padding(6), Controls = { _g } });
        Controls.Add(topo);
        Rodape(("Novo cliente", (_, _) => Seguro.Rodar(this, async () =>
            {
                var id = FormCliente.Novo(this, _q.Text);
                if (id != null) { Escolhido = (await Sessao.Api.Get($"/api/office/clientes/{id}")).AsObject(); DialogResult = DialogResult.OK; Close(); }
            }), false),
            ("Cancelar", (_, _) => Close(), false),
            ("Selecionar", (_, _) => { if (_g.Atual != null) { Escolhido = _g.Atual; DialogResult = DialogResult.OK; Close(); } }, false));
        Shown += (_, _) => { _q.Focus(); if (!string.IsNullOrWhiteSpace(inicial)) Buscar(); };
    }

    void Buscar() => Seguro.Rodar(this, async () =>
    {
        var q = _q.Text.Trim();
        if (q.Length < 2) return;
        var campo = _nome.Checked ? "nome" : _doc.Checked ? "documento" : _email.Checked ? "email" : "auto";
        var r = await Sessao.Api.Lista($"/api/office/clientes?q={Uri.EscapeDataString(q)}&campo={campo}");
        _g.Carregar(r);
        if (r.Count == 0) Msg.Info(this, "Cliente não localizado.");
    });

    public static JsonObject Escolher(IWin32Window dono, string titulo = "Pesquisar Cliente", string inicial = null)
    {
        using var f = new FormPesquisarCliente(titulo, inicial);
        return f.ShowDialog(dono) == DialogResult.OK ? f.Escolhido : null;
    }
}
