using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

public record CampoCad(string Chave, string Rotulo, string Tipo = "text", int Span = 1, string[] Opcoes = null);
public record DefCad(string Titulo, CampoCad[] Campos, Col[] Colunas, bool ComProvas = false);

/// <summary>Cadastros "Registro de X" (formulario + lista + navegacao), como o Registro de Produto do LapTime.</summary>
public static class Cadastros
{
    static readonly string[] Cat = ["Indoor", "Super Kart"];
    public static readonly Dictionary<string, DefCad> Defs = new()
    {
        ["produtos"] = new("Registro de Produto",
            [new("classeContabil", "Classe contábil", "text", 3), new("ativo", "Ativo", "bool"), new("codigo", "Código"), new("nome", "Nome", "text", 2), new("preco", "Preço (R$)", "money"),
             new("categoria", "Categoria (padrão)", "select", 1, Cat), new("servicoLocacao", "Serviço de locação", "bool"), new("publicarNuvem", "Publicar em nuvem", "bool"), new("requerDevolucao", "Requer devolução", "bool")],
            [new("classeContabil", "Classe Contábil", Largura: 110), new("categoria", "Categoria (padrão)", Largura: 120), new("codigo", "Código", Largura: 70), new("nome", "Nome", Largura: 300), new("preco", "Preço (R$)", TipoCol.Dinheiro), new("ativo", "Ativo", TipoCol.Bool)], true),
        ["tracados"] = new("Registro de Traçado", [new("nome", "Nome", "text", 2), new("comprimento", "Comprimento (m)", "int"), new("ativo", "Ativo", "bool")],
            [new("nome", "Nome", Largura: 300), new("comprimento", "Comprimento", TipoCol.Inteiro), new("ativo", "Ativo", TipoCol.Bool)]),
        ["feriados"] = new("Registro de Feriado", [new("data", "Data", "date"), new("descricao", "Descrição", "text", 2), new("recorrente", "Repete todo ano", "bool")],
            [new("data", "Data", TipoCol.Data), new("descricao", "Descrição", Largura: 300), new("recorrente", "Recorrente", TipoCol.Bool)]),
        ["turnos"] = new("Registro de Turno", [new("descricao", "Descrição", "text", 2), new("inicio", "Início (hh:mm)", "time"), new("fim", "Término (hh:mm)", "time"), new("ativo", "Ativo", "bool")],
            [new("descricao", "Descrição", Largura: 220), new("inicio", "Início", Largura: 70), new("fim", "Término", Largura: 70), new("ativo", "Ativo", TipoCol.Bool)]),
        ["terminais"] = new("Registro de Terminal", [new("codigo", "Código"), new("nome", "Descrição", "text", 2), new("ativo", "Ativo", "bool")],
            [new("codigo", "Código", Largura: 70), new("nome", "Descrição", Largura: 220), new("ativo", "Ativo", TipoCol.Bool)]),
        ["formas"] = new("Métodos de Pagamento", [new("codigo", "Código"), new("nome", "Nome", "text", 2), new("tipo", "Tipo", "select", 1, ["dinheiro", "credito", "debito", "pix", "voucher", "outro"]), new("ativo", "Ativo", "bool")],
            [new("codigo", "Código", Largura: 70), new("nome", "Nome", Largura: 220), new("tipo", "Tipo", Largura: 90), new("ativo", "Ativo", TipoCol.Bool)]),
        ["itensManutencao"] = new("Itens de Manutenção", [new("codigo", "Código"), new("nome", "Nome", "text", 2), new("controlaPorTempo", "Controla por tempo de uso", "bool"), new("tempoHoras", "A cada (horas)", "int"), new("ativo", "Ativo", "bool")],
            [new("codigo", "Código", Largura: 70), new("nome", "Nome", Largura: 240), new("tempoHoras", "A cada (h)", TipoCol.Inteiro), new("ativo", "Ativo", TipoCol.Bool)]),
        ["padroes"] = new("Ferramenta de Configuração de Reservas",
            [new("nome", "Nome", "text", 2), new("produtoId", "Produto (padrão)", "produto", 2), new("tracadoId", "Traçado (padrão)", "tracado"), new("categoria", "Categoria (padrão)", "select", 1, Cat),
             new("quantidade", "Quantidade", "int"), new("primeiraHora", "1ª reserva (hh:mm)", "time"), new("vagas", "Vagas (máx)", "int"), new("intervaloMin", "Intervalo entre inícios (min)", "int"),
             new("voltaMinimaSeg", "Volta mínima (seg)", "int"), new("numerarNome", "Nomear reservas com nº sequencial", "bool"), new("online", "Publicar no totem", "bool"), new("ativo", "Ativo", "bool")],
            [new("nome", "Nome", Largura: 220), new("quantidade", "Qtde", TipoCol.Inteiro, 60), new("primeiraHora", "1ª reserva", Largura: 80), new("intervaloMin", "Intervalo", TipoCol.Inteiro, 70), new("vagas", "Vagas", TipoCol.Inteiro, 60), new("ativo", "Ativo", TipoCol.Bool)]),
        ["usuarios"] = new("Registro de Usuário", [new("login", "Login"), new("nome", "Nome", "text", 2), new("senha", "Nova senha (em branco = manter)", "password", 2), new("admin", "Administrador", "bool"), new("ativo", "Ativo", "bool")],
            [new("login", "Login", Largura: 100), new("nome", "Nome", Largura: 220), new("admin", "Admin", TipoCol.Bool), new("ativo", "Ativo", TipoCol.Bool)]),
    };

    public static void Abrir(Form dono, string ent)
    {
        var f = new FormCadastro(ent, Defs[ent]);
        f.FormClosed += (_, _) => Seguro.Rodar(dono, Sessao.CarregarApoio);
        f.Show(dono);
    }

    public static void Empresa(Form dono) => Seguro.Rodar(dono, async () =>
    {
        var e = await Sessao.Api.Get("/api/office/empresa");
        using var j = new Janela("Registro de Empresa", 760, 420);
        (string k, string r, int span)[] campos = [("nome", "Nome fantasia", 2), ("razaoSocial", "Razão social", 2), ("cnpj", "CNPJ", 1), ("telefone", "Telefone", 1), ("email", "E-mail", 2), ("cep", "CEP", 1),
            ("endereco", "Endereço", 2), ("numero", "Nº", 1), ("complemento", "Complemento", 1), ("bairro", "Bairro", 1), ("cidade", "Cidade", 1), ("estado", "UF", 1)];
        var g = Campos.Grade(4);
        var tb = new Dictionary<string, TextBox>();
        foreach (var (k, r, s) in campos) { var t = new TextBox { Text = e.S(k) }; tb[k] = t; Campos.Add(g, r, t, s); }
        var pol = new TextBox { Multiline = true, Height = 90, Text = e.S("politicaReembolso"), ScrollBars = ScrollBars.Vertical };
        Campos.Add(g, "Política de reembolso", pol, 4);
        j.Controls.Add(new Panel { Dock = DockStyle.Fill, Padding = new Padding(10), Controls = { g } });
        j.Rodape(("Cancelar", (_, _) => j.Close(), false), ("Salvar", (_, _) => Seguro.Rodar(j, async () =>
        {
            var body = new JsonObject(); foreach (var (k, t) in tb) body[k] = t.Text.Trim(); body["politicaReembolso"] = pol.Text;
            await Sessao.Api.Put("/api/office/empresa", body);
            Msg.Info(j, "Operação concluída com sucesso."); j.Close();
            await Sessao.CarregarApoio();
        }), true));
        j.ShowDialog(dono);
    });

    public static void Parametros(Form dono) => Seguro.Rodar(dono, async () =>
    {
        var lista = await Sessao.Api.Lista("/api/office/parametros");
        using var j = new Janela("Parâmetros do Sistema", 820, 520);
        var t = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, AutoScroll = true, Padding = new Padding(10) };
        t.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 65)); t.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 35));
        var ctl = new Dictionary<string, Control>();
        foreach (var p in lista)
        {
            t.Controls.Add(new Label { Text = $"{p.S("descricao")}  ({p.S("chave")})", AutoSize = true, Margin = new Padding(3, 6, 3, 3) });
            Control c = p.S("valor") is "true" or "false" ? new CheckBox { Text = "ativado", Checked = p.S("valor") == "true", AutoSize = true } : new TextBox { Text = p.S("valor"), Width = 260 };
            ctl[p.S("chave")] = c; t.Controls.Add(c);
        }
        j.Controls.Add(t);
        j.Rodape(("Cancelar", (_, _) => j.Close(), false), ("Salvar", (_, _) => Seguro.Rodar(j, async () =>
        {
            var body = new JsonObject(); foreach (var (k, c) in ctl) body[k] = c is CheckBox cb ? (cb.Checked ? "true" : "false") : c.Text;
            await Sessao.Api.Put("/api/office/parametros", body);
            await Sessao.CarregarApoio();
            Msg.Info(j, "Parâmetros salvos."); j.Close();
        }), true));
        j.ShowDialog(dono);
    });
}

public class FormCadastro : Janela
{
    readonly string _ent;
    readonly DefCad _def;
    readonly Dictionary<string, Control> _c = [];
    readonly Grade _g = new();
    readonly Label _pos = new() { Dock = DockStyle.Bottom, Height = 20, TextAlign = ContentAlignment.MiddleRight };
    readonly Dictionary<string, Button> _b = [];
    readonly Panel _extra = new() { Dock = DockStyle.Top, AutoSize = true };
    List<JsonObject> _lista = [];
    JsonObject _atual;
    string _modo = "ver";

    public FormCadastro(string ent, DefCad def) : base(def.Titulo, 900, def.ComProvas ? 680 : 560, true)
    {
        _ent = ent; _def = def;
        ShowInTaskbar = true;
        var g = Campos.Grade(4);
        foreach (var c in def.Campos)
        {
            Control ctl = c.Tipo switch
            {
                "bool" => Campos.Check(c.Rotulo),
                "select" => Campos.Combo(c.Opcoes),
                "produto" => Campos.Combo().Also(x => { x.Items.Add(new Campos.Item(0, "")); x.Items.AddRange(Sessao.Produtos(false)); }),
                "tracado" => Campos.Combo().Also(x => { x.Items.Add(new Campos.Item(0, "")); x.Items.AddRange(Sessao.Tracados()); }),
                "date" => new MaskedTextBox { Mask = "00/00/0000" },
                "time" => new MaskedTextBox { Mask = "00:00" },
                "password" => new TextBox { UseSystemPasswordChar = true },
                _ => new TextBox(),
            };
            _c[c.Chave] = ctl;
            Campos.Add(g, c.Tipo == "bool" ? null : c.Rotulo, ctl, c.Span);
        }
        _g.Colunas(def.Colunas);
        _g.SelectionChanged += (_, _) => { if (_modo == "ver" && _g.Atual != null && _g.Atual != _atual) Mostrar(_g.Atual); };

        var nav = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 52, Padding = new Padding(4) };
        Button B(string k, string t, string gl, Color cor, Action a)
        {
            var b = new Button { Text = t, Image = Icone.Tile(gl, cor, 18), TextImageRelation = TextImageRelation.ImageAboveText, Size = new Size(t.Length > 2 ? 66 : 38, 44) };
            b.Click += (_, _) => a(); _b[k] = b; return b;
        }
        nav.Controls.AddRange([B("first", "", "", Color.DimGray, () => Ir(0)), B("prev", "", "", Color.DimGray, () => Ir(Indice() - 1)), B("next", "", "", Color.DimGray, () => Ir(Indice() + 1)),
            B("last", "", "", Color.DimGray, () => Ir(_lista.Count - 1)), B("novo", "Novo", "", Tema.Azul, Novo), B("edit", "Editar", "", Tema.Azul, () => SetModo("edit")),
            B("del", "Excluir", "", Tema.Vermelho, Excluir), B("canc", "Cancelar", "", Color.DimGray, () => { if (_atual != null) Mostrar(_atual); else SetModo("ver"); }),
            B("pesq", "Pesquisar", "", Color.DimGray, Pesquisar), new Label { Width = 180 }, B("fechar", "Fechar", "", Tema.Vermelho, Close), B("gravar", "Gravar", "", Tema.Verde, Gravar)]);
        var gradeBox = new Panel { Dock = DockStyle.Fill, BorderStyle = BorderStyle.FixedSingle, Controls = { _g } };
        Controls.Add(new Panel { Dock = DockStyle.Fill, Padding = new Padding(8), Controls = { gradeBox, _pos, _extra, g } });
        Controls.Add(nav);
        Load += (_, _) => Carregar(null);
    }

    int Indice() => _atual == null ? -1 : _lista.FindIndex(x => x.S("id") == _atual.S("id"));
    void Ir(int i) { if (_lista.Count == 0) return; i = Math.Clamp(i, 0, _lista.Count - 1); _g.Selecionar(x => x.S("id") == _lista[i].S("id")); Mostrar(_lista[i]); }

    void Carregar(string idSel) => Seguro.Rodar(this, async () =>
    {
        _lista = await Sessao.Api.Lista($"/api/office/cad/{_ent}");
        _g.Carregar(_lista);
        var r = _lista.FirstOrDefault(x => x.S("id") == idSel) ?? _lista.FirstOrDefault();
        if (r != null) { _g.Selecionar(x => x.S("id") == r.S("id")); Mostrar(r); } else SetModo("ver");
    });

    void Mostrar(JsonObject r)
    {
        _atual = r;
        foreach (var c in _def.Campos)
        {
            var ctl = _c[c.Chave];
            switch (c.Tipo)
            {
                case "bool": ((CheckBox)ctl).Checked = r.B(c.Chave); break;
                case "select": ((ComboBox)ctl).SelectedItem = ((ComboBox)ctl).Items.Contains(r.S(c.Chave)) ? r.S(c.Chave) : null; break;
                case "produto": case "tracado": Campos.Selecionar((ComboBox)ctl, r.L(c.Chave) ?? 0); break;
                case "money": ctl.Text = Fmt.Dinheiro(r.L(c.Chave)); break;
                case "date": ctl.Text = Fmt.Dmy(r.S(c.Chave)); break;
                case "password": ctl.Text = ""; break;
                default: ctl.Text = r.S(c.Chave); break;
            }
        }
        _pos.Text = $"Registro {Indice() + 1} de {_lista.Count}";
        SetModo("ver");
        if (_def.ComProvas) Provas(r);
    }

    void SetModo(string m)
    {
        _modo = m;
        foreach (var ctl in _c.Values) ctl.Enabled = m != "ver";
        _b["gravar"].Enabled = _b["canc"].Enabled = m != "ver";
        foreach (var k in new[] { "novo", "edit", "del", "first", "prev", "next", "last", "pesq" }) _b[k].Enabled = m == "ver";
    }

    void Novo()
    {
        _atual = null;
        foreach (var c in _def.Campos)
        {
            var ctl = _c[c.Chave];
            if (ctl is CheckBox cb) cb.Checked = c.Chave == "ativo"; else if (ctl is ComboBox co) co.SelectedIndex = co.Items.Count > 0 ? 0 : -1; else ctl.Text = "";
        }
        SetModo("novo");
        _c.Values.First().Focus();
    }

    void Pesquisar()
    {
        var q = Prompt.Pedir(this, "Pesquisar (contém):", "", "Pesquisar");
        if (string.IsNullOrWhiteSpace(q)) return;
        var r = _lista.FirstOrDefault(x => x.Select(kv => kv.Value?.ToString() ?? "").Any(v => v.Contains(q, StringComparison.OrdinalIgnoreCase)));
        if (r == null) { Msg.Info(this, "Nada encontrado."); return; }
        _g.Selecionar(x => x.S("id") == r.S("id")); Mostrar(r);
    }

    void Excluir() => Seguro.Rodar(this, async () =>
    {
        if (_atual == null || !Msg.Pergunta(this, "Deseja excluir definitivamente o registro atual?")) return;
        var r = await Sessao.Api.Delete($"/api/office/cad/{_ent}/{_atual.S("id")}");
        if (r?.B("desativado") == true) Msg.Info(this, "Registro em uso: foi desativado em vez de excluído.");
        Carregar(null);
    });

    void Gravar() => Seguro.Rodar(this, async () =>
    {
        var body = new JsonObject();
        foreach (var c in _def.Campos)
        {
            var ctl = _c[c.Chave];
            switch (c.Tipo)
            {
                case "bool": body[c.Chave] = ((CheckBox)ctl).Checked; break;
                case "select": body[c.Chave] = ((ComboBox)ctl).SelectedItem?.ToString(); break;
                case "produto": case "tracado": body[c.Chave] = Campos.IdDe((ComboBox)ctl) is long id && id > 0 ? id : null; break;
                case "money": if (Fmt.Centavos(ctl.Text) is not long v) { Msg.Aviso(this, $"Valor inválido em {c.Rotulo}."); return; } body[c.Chave] = v; break;
                case "int": body[c.Chave] = int.TryParse(ctl.Text, out var n) ? n : null; break;
                case "date": body[c.Chave] = ((MaskedTextBox)ctl).MaskCompleted ? Fmt.Iso(DateTime.ParseExact(ctl.Text, "dd/MM/yyyy", Fmt.Br)) : null; break;
                case "time": body[c.Chave] = ((MaskedTextBox)ctl).MaskCompleted ? ctl.Text : null; break;
                case "password": if (ctl.Text.Length > 0) body[c.Chave] = ctl.Text; break;
                default: body[c.Chave] = ctl.Text.Trim(); break;
            }
        }
        var r = _modo == "novo" ? await Sessao.Api.Post($"/api/office/cad/{_ent}", body) : await Sessao.Api.Put($"/api/office/cad/{_ent}/{_atual.S("id")}", body);
        Msg.Info(this, "Operação concluída com sucesso.");
        Carregar(r.S("id"));
    });

    /// <summary>Secao "Item" do Registro de Produto: provas da bateria (Tomada de Tempo 5 min + Corrida 20 min...).</summary>
    void Provas(JsonObject produto) => Seguro.Rodar(this, async () =>
    {
        var lista = await Sessao.Api.Lista($"/api/office/cad/provas?produtoId={produto.S("id")}");
        _extra.Controls.Clear();
        var gb = new GroupBox { Text = "Item — provas da bateria (a cronometragem monta nesta ordem)", Dock = DockStyle.Top, Height = 170, Padding = new Padding(6) };
        var ordem = Campos.Num(lista.Count + 1, 1, 20); var nome = new TextBox(); var tipo = Campos.Combo("classificacao", "corrida", "treino");
        var fin = Campos.Combo("tempo", "voltas"); var tempo = Campos.Num(0, 0, 600); var voltas = Campos.Num(0, 0, 999);
        var gl = Campos.Grade(8, 8, 26, 14, 12, 10, 10, 10, 10);
        var bIns = new Button { Text = "⊕ Inserir", Height = 24 }; var bDel = new Button { Text = "🗑 Excluir", Height = 24 };
        Campos.Add(gl, "Ordem", ordem); Campos.Add(gl, "Nome", nome); Campos.Add(gl, "Tipo", tipo); Campos.Add(gl, "Autofinalizar", fin); Campos.Add(gl, "Tempo (min)", tempo); Campos.Add(gl, "Voltas (máx)", voltas);
        Campos.Add(gl, " ", bIns); Campos.Add(gl, " ", bDel);
        var gp = new Grade();
        gp.Colunas(new("ordem", "Qtde/Ordem", TipoCol.Inteiro, 80), new("finalizacao", "Tipo de Finalização", Largura: 120), new("tempoMin", "Tempo (minutos)", TipoCol.Inteiro, 110), new("voltasMax", "Voltas (máx)", TipoCol.Inteiro, 90), new("nome", "Nome", Largura: 200), new("tipo", "Tipo"));
        gp.Carregar(lista);
        gb.Controls.Add(new Panel { Dock = DockStyle.Fill, BorderStyle = BorderStyle.FixedSingle, Controls = { gp } });
        gb.Controls.Add(gl);
        _extra.Controls.Add(gb);
        bIns.Click += (_, _) => Seguro.Rodar(this, async () =>
        {
            if (string.IsNullOrWhiteSpace(nome.Text)) { Msg.Aviso(this, "Informe o nome da prova."); return; }
            await Sessao.Api.Post("/api/office/cad/provas", new { produtoId = produto.L("id"), ordem = (int)ordem.Value, nome = nome.Text.Trim(), tipo = tipo.Text, finalizacao = fin.Text, tempoMin = (int)tempo.Value, voltasMax = (int)voltas.Value });
            Provas(produto);
        });
        bDel.Click += (_, _) => Seguro.Rodar(this, async () =>
        {
            if (gp.Atual == null) { Msg.Aviso(this, "Selecione a prova."); return; }
            await Sessao.Api.Delete($"/api/office/cad/provas/{gp.Atual.S("id")}");
            Provas(produto);
        });
    });
}

/// <summary>"Criar Voucher por Fidelidade / Parceiro".</summary>
public class FormVoucher : Janela
{
    public FormVoucher(string origem) : base(origem == "fidelidade" ? "Criar Voucher por Fidelidade" : origem == "parceiro" ? "Criar Voucher por Parceiro" : "Criar Voucher", 560, 380)
    {
        var refe = new TextBox(); var cod = new TextBox { CharacterCasing = CharacterCasing.Upper }; var bG = new Button { Text = "Gerar", Height = 24 };
        var tipo = Campos.Combo("Percentual", "Valor (R$)"); var valor = new TextBox();
        var ini = Campos.Data(); var fim = Campos.Data(DateTime.Today.AddDays(30));
        var prod = Campos.Combo(); prod.Items.Add(new Campos.Item(0, "(qualquer produto)")); prod.Items.AddRange(Sessao.Produtos()); prod.SelectedIndex = 0;
        var uso = Campos.Num(1, 1, 999); var unico = Campos.Check("Uso unico", true); var min = new TextBox(); var max = new TextBox();
        bG.Click += (_, _) => cod.Text = "KB" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();
        var g = Campos.Grade(3, 45, 35, 20);
        Campos.Add(g, origem == "fidelidade" ? "Conta fidelidade" : origem == "parceiro" ? "Parceiro" : "Referência (opcional)", refe, 3);
        Campos.Add(g, "Codigo", cod); Campos.Add(g, " ", bG); g.Controls.Add(new Label());
        Campos.Add(g, "Tipo desconto", tipo); Campos.Add(g, "Valor", valor); g.Controls.Add(new Label());
        Campos.Add(g, "Data inicial", ini); Campos.Add(g, "Data final", fim); g.Controls.Add(new Label());
        Campos.Add(g, "Produto", prod, 3);
        Campos.Add(g, "Uso max/cliente", uso); Campos.Add(g, null, unico); g.Controls.Add(new Label());
        Campos.Add(g, "Pedido minimo", min); Campos.Add(g, "Desconto maximo", max);
        Controls.Add(new Panel { Dock = DockStyle.Fill, Padding = new Padding(10), Controls = { g } });
        Rodape(("Cancelar", (_, _) => Close(), false), ("Salvar e Fechar", (_, _) => Seguro.Rodar(this, async () =>
        {
            var pct = tipo.SelectedIndex == 0;
            long v;
            if (pct) { if (!int.TryParse(valor.Text.Trim().TrimEnd('%'), out var p) || p <= 0 || p > 100) { Msg.Aviso(this, "Informe o percentual (1 a 100)."); return; } v = p; }
            else { if (Fmt.Centavos(valor.Text) is not long c || c <= 0) { Msg.Aviso(this, "Informe o valor."); return; } v = c; }
            await Sessao.Api.Post("/api/office/vouchers", new
            {
                origem, referencia = refe.Text.Trim(), codigo = cod.Text.Trim(), tipo = pct ? "percentual" : "valor", valor = v, inicio = Fmt.Iso(ini.Value), fim = Fmt.Iso(fim.Value),
                produtoId = Campos.IdDe(prod) is long pid && pid > 0 ? pid : (long?)null, usoMaxCliente = (int)uso.Value, usoUnico = unico.Checked,
                pedidoMinimo = Fmt.Centavos(min.Text) is long mn && mn > 0 ? mn : (long?)null, descontoMaximo = Fmt.Centavos(max.Text) is long mx && mx > 0 ? mx : (long?)null,
            });
            Msg.Info(this, "Voucher criado.");
            Close();
        }), true));
    }
}
