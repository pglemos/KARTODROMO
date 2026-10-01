using System.Drawing.Drawing2D;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>Passos 4–5 no visual do design (Competidores.dc.html): grupos e provas à esquerda; a bateria à direita
/// com abas (Competidores · Resultado oficial · Por categoria · Observações), o aviso da recepção e a lista.</summary>
public partial class FormCrono
{
    readonly Label _subArvore = new(), _subPilotos = new(), _totalPilotos = new();
    bool _preenchendoExtras;
    readonly Dictionary<string, JsonObject> _clientesInfo = [];
    Dictionary<string, string> _transpPorKart = [];
    DateTime _transpLidoEm = DateTime.MinValue;
    bool _buscandoClientes;

    TabPage AbaBateriasDesign()
    {
        var page = new TabPage("4–5 · Competidores") { BackColor = TemaCrono.Fundo, Padding = Padding.Empty };

        // ---- árvore (cartão 4)
        _arvore.DrawMode = TreeViewDrawMode.OwnerDrawAll; _arvore.ItemHeight = 30; _arvore.ShowLines = false; _arvore.ShowPlusMinus = false; _arvore.ShowRootLines = false;
        _arvore.Indent = 0; _arvore.FullRowSelect = true; _arvore.BackColor = Color.White; _arvore.Font = new Font("Segoe UI", 9.6F);
        _arvore.DrawNode += (_, e) => DesenharNo(e);
        _arvore.AfterSelect += (_, e) =>
        {
            if (_montandoArvore) return;
            if (e.Node?.Tag is not JsonObject tag) return;
            if (tag.S("kind") == "session") Selecionar(tag.S("sessionId"));
            else if (tag.S("kind") == "proof")
            {
                _selectedProof = _proofs.FirstOrDefault(p => p.S("id") == tag.S("proofId"));
                var session = Crono.Arr(_state, "sessions").FirstOrDefault(s => s.S("proofId") == tag.S("proofId"));
                if (session != null) Selecionar(session.S("id"));
                else { _lPilotosTitulo.Text = _selectedProof?.S("name") ?? "Selecione uma prova"; _subPilotos.Text = "Esta prova ainda não tem bateria · use Criar bateria nos passos 1–3"; }
            }
            _arvore.Invalidate();
        };
        var arvoreBox = new Panel { Dock = DockStyle.Fill, Padding = new Padding(8, 4, 8, 8), BackColor = Color.White };
        arvoreBox.Controls.Add(_arvore);
        _subArvore.Text = "Selecione uma prova";
        var arvCard = CartaoPasso(4, "Grupos e provas", _subArvore, arvoreBox, []);
        // sem rodapé de botões no cartão 4
        foreach (Control c in arvCard.Controls) if (c is Panel { Dock: DockStyle.Bottom } rp) rp.Visible = false;

        // ---- lista de competidores
        _gPilotos.Dock = DockStyle.Fill;
        TemaCrono.EstilizarGrade(_gPilotos, editavel: true);
        _gPilotos.Columns.Clear();
        _gPilotos.Columns.Add(new DataGridViewTextBoxColumn { Name = "kart", HeaderText = "Nº", Width = 56 });
        _gPilotos.Columns.Add(new DataGridViewTextBoxColumn { Name = "name", HeaderText = "Competidor", AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill, MinimumWidth = 160 });
        _gPilotos.Columns.Add(new DataGridViewTextBoxColumn { Name = "customerId", HeaderText = "Cliente", Width = 70, ReadOnly = true, Visible = false });
        _gPilotos.Columns.Add(new DataGridViewTextBoxColumn { Name = "category", HeaderText = "Categoria", Width = 104 });
        foreach (var (n, t, w) in new[] { ("transponder", "Transponder", 104), ("iniciais", "Iniciais", 62), ("email", "E-mail", 170), ("cidade", "Cidade", 120), ("uf", "UF", 40), ("pais", "País", 48), ("peso", "Peso", 64) })
            _gPilotos.Columns.Add(new DataGridViewTextBoxColumn { Name = n, HeaderText = t, Width = w, ReadOnly = true });
        // e-mail é dado pessoal que não serve para cronometrar: na tela só "jo•••@gmail.com" (mostra que tem e-mail
        // para o resultado); o valor completo continua na célula (envio e exportação)
        _gPilotos.CellFormatting += (_, e) =>
        {
            if (e.ColumnIndex < 0 || _gPilotos.Columns[e.ColumnIndex].Name != "email" || e.Value is not string em || em.Length == 0) return;
            var arroba = em.IndexOf('@');
            e.Value = arroba > 0 ? em[..Math.Min(2, arroba)] + "•••" + em[arroba..] : "•••";
            e.FormattingApplied = true;
        };
        var ordem = new[] { "category", "kart", "transponder", "name", "iniciais", "email", "cidade", "uf", "pais", "peso", "customerId" };
        for (var i = 0; i < ordem.Length; i++) _gPilotos.Columns[ordem[i]].DisplayIndex = i;
        _gPilotos.Columns["name"].DefaultCellStyle.Font = new Font("Segoe UI Semibold", 9.6F);
        foreach (var n in new[] { "transponder", "iniciais", "email", "cidade", "uf", "pais" }) _gPilotos.Columns[n].DefaultCellStyle.ForeColor = Color.FromArgb(58, 58, 60);
        _gPilotos.Columns["transponder"].DefaultCellStyle.Font = new Font("Cascadia Mono", 8.8F);
        _gPilotos.Columns["peso"].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleRight;
        _gPilotos.RowTemplate.Height = 34;
        foreach (DataGridViewColumn col in _gPilotos.Columns) col.SortMode = DataGridViewColumnSortMode.Automatic;
        _gPilotos.SortCompare += (_, e) =>
        {
            var a = e.CellValue1?.ToString()?.Trim() ?? "";
            var b = e.CellValue2?.ToString()?.Trim() ?? "";
            if (e.Column.Name is "kart" or "customerId" or "transponder" or "peso")
            {
                var na = decimal.TryParse(a, System.Globalization.NumberStyles.Number, Fmt.Br, out var x); var nb = decimal.TryParse(b, System.Globalization.NumberStyles.Number, Fmt.Br, out var y);
                e.SortResult = na && nb ? x.CompareTo(y) : na ? -1 : nb ? 1 : string.Compare(a, b, StringComparison.CurrentCultureIgnoreCase);
            }
            else e.SortResult = a.Length == 0 && b.Length > 0 ? 1 : b.Length == 0 && a.Length > 0 ? -1 : string.Compare(a, b, Fmt.Br, System.Globalization.CompareOptions.IgnoreCase | System.Globalization.CompareOptions.IgnoreNonSpace);
            if (e.SortResult == 0) e.SortResult = e.RowIndex1.CompareTo(e.RowIndex2);
            e.Handled = true;
        };
        _gPilotos.CellValueChanged += (_, e) => { if (!_preenchendoExtras && e.ColumnIndex <= 3) _pilotosSujos = true; };
        _gPilotos.UserDeletedRow += (_, _) => _pilotosSujos = true;
        _gPilotos.CellPainting += (_, e) =>
        {
            if (e.RowIndex < 0 || e.ColumnIndex < 0 || _gPilotos.IsCurrentCellInEditMode && _gPilotos.CurrentCell?.RowIndex == e.RowIndex && _gPilotos.CurrentCell.ColumnIndex == e.ColumnIndex) return;
            var nome = _gPilotos.Columns[e.ColumnIndex].Name;
            if (nome is not ("category" or "kart") || e.FormattedValue is not string t || t.Length == 0) return;
            var g = e.Graphics; g.SmoothingMode = SmoothingMode.None;
            var sel = (e.State & DataGridViewElementStates.Selected) != 0;
            using (var b = new SolidBrush(sel ? e.CellStyle.SelectionBackColor : e.CellStyle.BackColor)) g.FillRectangle(b, e.CellBounds);
            using (var p = new Pen(_gPilotos.GridColor)) g.DrawLine(p, e.CellBounds.Left, e.CellBounds.Bottom - 1, e.CellBounds.Right, e.CellBounds.Bottom - 1);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            if (nome == "category")
            {
                using var f = new Font("Segoe UI Semibold", 8.4F);
                var w = TextRenderer.MeasureText(t, f).Width + 8;
                var r = new Rectangle(e.CellBounds.X + 6, e.CellBounds.Y + (e.CellBounds.Height - 20) / 2, Math.Min(w, e.CellBounds.Width - 10), 20);
                var super = t.Contains("super", StringComparison.OrdinalIgnoreCase);
                using (var p = Forma.Redondo(r, 6)) using (var b = new SolidBrush(super ? Color.FromArgb(255, 236, 204) : Color.FromArgb(225, 238, 255))) g.FillPath(b, p);
                TextRenderer.DrawText(g, t, f, r, super ? Color.FromArgb(138, 75, 0) : Color.FromArgb(10, 79, 160), TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
            }
            else
            {
                var q = new RectangleF(e.CellBounds.X + 6, e.CellBounds.Y + (e.CellBounds.Height - 22) / 2f, 32, 22);
                using (var s = Forma.Redondo(new RectangleF(q.X, q.Y + 1, q.Width, q.Height), 6)) using (var bs = new SolidBrush(Color.FromArgb(174, 174, 178))) g.FillPath(bs, s);
                using (var p = Forma.Redondo(q, 6)) using (var lg = new LinearGradientBrush(q, Color.White, Color.FromArgb(229, 229, 234), 90f)) g.FillPath(lg, p);
                TextRenderer.DrawText(g, t.PadLeft(2, '0'), new Font("Cascadia Mono", 8.8F, FontStyle.Bold), Rectangle.Round(q), TemaCrono.Texto, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
            }
            g.SmoothingMode = SmoothingMode.None;
            e.Handled = true;
        };
        var flagsPiloto = new ContextMenuStrip();
        flagsPiloto.Items.Add("Registro do competidor…", null, (_, _) => EditarCompetidor());
        flagsPiloto.Items.Add("Trocar kart do piloto… (leva as voltas)", null, (_, _) => TrocarKart());
        flagsPiloto.Items.Add(new ToolStripSeparator());
        flagsPiloto.Items.Add("Bandeira verde para o piloto", null, (_, _) => BandeiraPiloto("green"));
        flagsPiloto.Items.Add("Bandeira amarela para o piloto", null, (_, _) => BandeiraPiloto("yellow"));
        flagsPiloto.Items.Add("Bandeira vermelha para o piloto", null, (_, _) => BandeiraPiloto("red"));
        flagsPiloto.Items.Add("Bandeira branca para o piloto", null, (_, _) => BandeiraPiloto("white"));
        _gPilotos.ContextMenuStrip = flagsPiloto;

        SetupResultado(_gResultComp); SetupResultado(_gCategoriaComp);
        EstilizarResultado(_gResultComp); EstilizarResultado(_gCategoriaComp);
        _gResultComp.CellDoubleClick += (_, e) => { if (e.RowIndex >= 0 && _gResultComp.Chaves[e.RowIndex] is JsonObject s) Voltas(s.S("kart")); };
        _gCategoriaComp.CellDoubleClick += (_, e) => { if (e.RowIndex >= 0 && _gCategoriaComp.Chaves[e.RowIndex] is JsonObject s) Voltas(s.S("kart")); };
        TemaCrono.EstilizarGrade(_gObs);
        _gObs.Col("Hora", 94).Col("Observação", 440, DataGridViewContentAlignment.MiddleLeft, true).Col("Responsável", 130);

        // abas sem cabeçalho + segmento
        var abasNovas = _tabsCompetidor; abasNovas.TabPages.Clear(); abasNovas.Dock = DockStyle.Fill;
        var tabComp = new TabPage("Competidores") { BackColor = Color.White };
        var banner = new Panel { Dock = DockStyle.Top, Height = 58, BackColor = Color.White, Padding = new Padding(12, 10, 12, 6) };
        var caixa = new TemaCrono.PainelArredondado { Dock = DockStyle.Fill, BackColor = Color.FromArgb(235, 244, 255), Raio = 10 };
        var textoBanner = new Label { AutoSize = false, Font = new Font("Segoe UI", 9.4F), ForeColor = Color.FromArgb(10, 79, 160), BackColor = Color.FromArgb(235, 244, 255), TextAlign = ContentAlignment.MiddleLeft };
        var puxar = new BotaoPlano { Text = "Puxar da recepção agora", FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(10, 132, 255), ForeColor = Color.White, Font = new Font("Segoe UI Semibold", 9F), Cursor = Cursors.Hand, Height = 28 };
        puxar.Width = TextRenderer.MeasureText(puxar.Text, puxar.Font).Width + 22; puxar.FlatAppearance.BorderSize = 0;
        puxar.Resize += (_, _) => Forma.AplicarRaio(puxar, 7); Forma.AplicarRaio(puxar, 7);
        puxar.Click += (_, _) => Seguro.Rodar(this, PuxarAgenda);
        caixa.Paint += (_, e) => Forma.DesenharSvg(e.Graphics, "M4 12a8 8 0 0 1 14-5.3M20 4v5h-5M20 12a8 8 0 0 1-14 5.3M4 20v-5h5", new RectangleF(12, (caixa.Height - 16) / 2f, 16, 16), Color.FromArgb(10, 79, 160), 2f);
        caixa.Controls.Add(textoBanner); caixa.Controls.Add(puxar);
        caixa.Resize += (_, _) => { puxar.Location = new Point(caixa.Width - puxar.Width - 10, (caixa.Height - puxar.Height) / 2); textoBanner.SetBounds(36, 0, Math.Max(50, puxar.Left - 44), caixa.Height); };
        banner.Controls.Add(caixa);
        _textoBannerPilotos = textoBanner;
        tabComp.Controls.Add(_gPilotos); tabComp.Controls.Add(banner); _gPilotos.BringToFront();
        var tabOficial = new TabPage("Resultado oficial") { BackColor = Color.White }; tabOficial.Controls.Add(_gResultComp);
        var tabCategoria = new TabPage("Por categoria") { BackColor = Color.White }; tabCategoria.Controls.Add(_gCategoriaComp);
        var tabObs = new TabPage("Observações") { BackColor = Color.White };
        var obsInput = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 48, WrapContents = false, Padding = new Padding(10, 8, 10, 4), BackColor = Color.White };
        _txtObservacao.Width = 550;
        obsInput.Controls.Add(_txtObservacao); obsInput.Controls.Add(BotaoPeq("Adicionar", 1, () => Seguro.Rodar(this, AdicionarObservacao)));
        tabObs.Controls.Add(_gObs); tabObs.Controls.Add(obsInput); _gObs.BringToFront();
        abasNovas.TabPages.AddRange([tabComp, tabOficial, tabCategoria, tabObs]);
        _tabsCompetidorNovo = abasNovas;
        var seg = new SegmentoDesign { BackColor = Color.White };
        seg.Itens = ["Competidores", "Resultado oficial", "Por categoria", "Observações"];
        seg.Mudou += i => abasNovas.SelectedIndex = i;
        abasNovas.SelectedIndexChanged += (_, _) => { seg.Selecionado = abasNovas.SelectedIndex; _abaCompetidores = abasNovas.SelectedTab?.Text ?? "Competidores"; AtualizarResultadoCompetidores(); };

        _lPilotosTitulo.Text = "Selecione uma prova";
        _totalPilotos.AutoSize = true; _totalPilotos.Font = new Font("Segoe UI", 9.4F); _totalPilotos.ForeColor = TemaCrono.Secundario; _totalPilotos.BackColor = Color.FromArgb(251, 251, 253);
        var direitaRod = new FlowLayoutPanel { AutoSize = true, WrapContents = false, BackColor = Color.FromArgb(251, 251, 253), Margin = Padding.Empty, Padding = Padding.Empty };
        _totalPilotos.Margin = new Padding(0, 7, 10, 0);
        direitaRod.Controls.Add(_totalPilotos);
        direitaRod.Controls.Add(BotaoPeq("Salvar", 1, () => Seguro.Rodar(this, SalvarPilotos)));
        direitaRod.Controls.Add(BotaoPeq("Ir para a cronometragem →", 3, () => _abas.SelectedIndex = 2));
        direitaRod.PerformLayout();
        direitaRod.Size = direitaRod.PreferredSize;
        var comp = CartaoPasso(5, null, _subPilotos, abasNovas,
            [BotaoPeq("+ Novo participante", 1, () => { _gPilotos.Rows.Add("", "", "", ""); _pilotosSujos = true; _abaCompetidoresIr(0); _gPilotos.CurrentCell = _gPilotos.Rows[^1].Cells["kart"]; _gPilotos.BeginEdit(true); }),
             BotaoPeq("Editar", 0, EditarCompetidor),
             BotaoPeq("Excluir", 2, () => { foreach (DataGridViewRow row in _gPilotos.SelectedRows) if (!row.IsNewRow) _gPilotos.Rows.Remove(row); _pilotosSujos = true; }),
             BotaoPeq("Excluir todos", 2, () => { if (_gPilotos.Rows.Count > 0 && Msg.Pergunta(this, "Tirar todos os competidores desta bateria? (só vale depois de Salvar)")) { _gPilotos.Rows.Clear(); _pilotosSujos = true; } }),
             BotaoPeq("Imprimir", 0, () => ImprimirResumo("Competidores", Crono.Arr(_sess, "competitors").Select(c => $"{c.S("kart")} · {c.S("name")}").ToList())),
             BotaoPeq("Importar", 0, ImportarPilotos), BotaoPeq("Exportar", 0, ExportarPilotos)], seg, _lPilotosTitulo, direitaRod);

        var grade = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1, Padding = new Padding(18, 16, 18, 16), BackColor = TemaCrono.Fundo };
        grade.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 334)); grade.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        grade.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        arvCard.Margin = new Padding(0, 0, 14, 0); comp.Margin = Padding.Empty;
        grade.Controls.Add(arvCard, 0, 0); grade.Controls.Add(comp, 1, 0);
        page.Controls.Add(grade);
        return page;
    }

    Label _textoBannerPilotos;
    TabControl _tabsCompetidorNovo;
    void _abaCompetidoresIr(int i) { if (_tabsCompetidorNovo != null) _tabsCompetidorNovo.SelectedIndex = i; }

    void DesenharNo(DrawTreeNodeEventArgs e)
    {
        if (e.Node == null || e.Bounds.Height <= 0) return;
        var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
        var r = new Rectangle(0, e.Bounds.Y, _arvore.ClientSize.Width, e.Bounds.Height);
        using (var b = new SolidBrush(Color.White)) g.FillRectangle(b, r);
        var tag = e.Node.Tag as JsonObject;
        var tipo = tag?.S("kind") ?? "";
        var sel = e.Node.IsSelected && tipo is "proof" or "session";
        if (sel) { using var p = Forma.Redondo(new Rectangle(2, r.Y + 1, r.Width - 4, r.Height - 2), 8); using var bs = new SolidBrush(Color.FromArgb(11, 122, 83)); g.FillPath(bs, p); }
        var nivel = e.Node.Level;
        if (tipo == "event")
        {
            TextRenderer.DrawText(g, tag.S("name").ToUpperInvariant(), new Font("Segoe UI", 8F, FontStyle.Bold), new Rectangle(6, r.Y, r.Width - 12, r.Height), TemaCrono.Secundario, TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
        }
        else if (tipo == "group" || nivel == 0 && tag == null)
        {
            using var pen = new Pen(TemaCrono.Secundario, 1.6f) { StartCap = LineCap.Round, EndCap = LineCap.Round };
            var cy = r.Y + r.Height / 2f;
            g.DrawLines(pen, [new PointF(9, cy - 2), new PointF(12, cy + 1.5f), new PointF(15, cy - 2)]);
            TextRenderer.DrawText(g, tag?.S("name") ?? e.Node.Text, new Font("Segoe UI", 9.4F, FontStyle.Bold), new Rectangle(22, r.Y, r.Width - 100, r.Height), TemaCrono.Texto, TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
            if (tag?.I("pilotos") is int n && n > 0) TextRenderer.DrawText(g, $"{n} pilotos", new Font("Segoe UI", 8.6F), new Rectangle(0, r.Y, r.Width - 10, r.Height), TemaCrono.Secundario, TextFormatFlags.VerticalCenter | TextFormatFlags.Right);
        }
        else
        {
            var corrida = tag?.S("type") == "corrida";
            var cor = corrida ? Color.FromArgb(255, 59, 48) : Color.FromArgb(10, 132, 255);
            using (var b = new SolidBrush(sel ? Color.White : cor)) g.FillEllipse(b, 28, r.Y + r.Height / 2f - 3, 6, 6);
            var nome = tag?.S("label") is { Length: > 0 } l ? l : e.Node.Text;
            TextRenderer.DrawText(g, nome, new Font(sel ? "Segoe UI Semibold" : "Segoe UI", 9.4F), new Rectangle(42, r.Y, r.Width - 110, r.Height), sel ? Color.White : TemaCrono.Texto, TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
            var estado = tag?.S("state") ?? "";
            if (estado.Length > 0)
            {
                var (txt, c) = estado switch { "em_andamento" => ("ao vivo", Color.FromArgb(28, 107, 53)), "bandeira_final" => ("final", Color.FromArgb(28, 107, 53)), "encerrada" => ("encerrada", TemaCrono.Secundario), "preparando" => ("preparando", Color.FromArgb(10, 79, 160)), _ => ("", TemaCrono.Secundario) };
                TextRenderer.DrawText(g, txt, new Font("Segoe UI", 8.4F), new Rectangle(0, r.Y, r.Width - 10, r.Height), sel ? Color.FromArgb(220, 255, 255, 255) : c, TextFormatFlags.VerticalCenter | TextFormatFlags.Right);
            }
        }
    }

    /// <summary>Colunas extras (transponder, iniciais, e-mail, cidade, UF, país, peso) sem marcar a lista como alterada.</summary>
    void AtualizarExtrasPilotos()
    {
        if (_gPilotos.IsCurrentCellInEditMode) return;
        if (DateTime.Now - _transpLidoEm > TimeSpan.FromSeconds(30))
        {
            _transpLidoEm = DateTime.Now;
            _ = Task.Run(async () =>
            {
                try
                {
                    var mapa = (await Crono.Api.Get("/api/transponders"))?.AsObject();
                    var inv = new Dictionary<string, string>();
                    if (mapa != null) foreach (var (raw, kart) in mapa) if (kart != null) inv[kart.ToString()] = raw;
                    BeginInvoke(() => { _transpPorKart = inv; AtualizarExtrasPilotos(); });
                }
                catch { }
            });
        }
        var faltam = _gPilotos.Rows.Cast<DataGridViewRow>().Where(r => !r.IsNewRow).Select(r => r.Cells["customerId"].Value?.ToString()).Where(id => !string.IsNullOrEmpty(id) && !_clientesInfo.ContainsKey(id)).Distinct().ToList();
        if (faltam.Count > 0 && !_buscandoClientes)
        {
            _buscandoClientes = true;
            _ = Task.Run(async () =>
            {
                try
                {
                    var lista = await Crono.Api.Lista("/api/clientes?ids=" + string.Join(",", faltam));
                    BeginInvoke(() =>
                    {
                        foreach (var id in faltam) _clientesInfo[id] = lista.FirstOrDefault(c => c.S("id") == id) ?? new JsonObject();
                        _buscandoClientes = false; AtualizarExtrasPilotos();
                    });
                }
                catch { BeginInvoke(() => { foreach (var id in faltam) _clientesInfo[id] = new JsonObject(); _buscandoClientes = false; }); }
            });
        }
        _preenchendoExtras = true;
        try
        {
            foreach (DataGridViewRow r in _gPilotos.Rows)
            {
                if (r.IsNewRow) continue;
                var kart = r.Cells["kart"].Value?.ToString() ?? "";
                var nome = r.Cells["name"].Value?.ToString() ?? "";
                var info = _clientesInfo.GetValueOrDefault(r.Cells["customerId"].Value?.ToString() ?? "");
                string[] vals =
                [
                    _transpPorKart.GetValueOrDefault(kart, ""),
                    string.Concat(nome.Split(' ', StringSplitOptions.RemoveEmptyEntries).Where(p => p.Length > 2 || p == nome).Take(3).Select(p => char.ToUpperInvariant(p[0]))),
                    info?.S("email") ?? "", info?.S("cidade") ?? "", info?.S("uf") ?? "", info == null || info.Count == 0 ? "" : "BR",
                    decimal.TryParse(info?.S("peso"), System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var kg) && kg > 0 ? kg.ToString("0.00", Fmt.Br) : "",
                ];
                string[] cols = ["transponder", "iniciais", "email", "cidade", "uf", "pais", "peso"];
                for (var i = 0; i < cols.Length; i++) if ((r.Cells[cols[i]].Value?.ToString() ?? "") != vals[i]) r.Cells[cols[i]].Value = vals[i];
            }
        }
        finally { _preenchendoExtras = false; }
        var total = _gPilotos.Rows.Cast<DataGridViewRow>().Count(r => !r.IsNewRow);
        _totalPilotos.Text = $"Total: {total}";
        if (_textoBannerPilotos != null)
            _textoBannerPilotos.Text = _sess == null ? "Selecione uma bateria à esquerda." : _pilotosSujos ? "Há alterações nesta lista: confira os números e clique em Salvar." :
                $"Os {total} pilotos desta bateria {(Crono.Arr(_sess, "competitors").Any(c => c.S("customerId").Length > 0) ? "vieram da recepção" : "estão na cronometragem")}. Novos pagamentos entram sozinhos até a largada.";
    }

    void ExportarPilotos()
    {
        using var d = new SaveFileDialog { FileName = $"competidores-{DateTime.Now:yyyyMMdd-HHmm}.csv", Filter = "Planilha (*.csv)|*.csv" };
        if (d.ShowDialog(this) != DialogResult.OK) return;
        var sb = new System.Text.StringBuilder("Nº;Competidor;Categoria;Transponder;E-mail;Cidade;UF;Peso\r\n");
        static string Q(object v) => "\"" + (v?.ToString() ?? "").Replace("\"", "\"\"") + "\"";
        foreach (DataGridViewRow r in _gPilotos.Rows)
            if (!r.IsNewRow) sb.AppendLine(string.Join(";", new[] { "kart", "name", "category", "transponder", "email", "cidade", "uf", "peso" }.Select(c => Q(r.Cells[c].Value))));
        File.WriteAllText(d.FileName, sb.ToString(), new System.Text.UTF8Encoding(true));
        Msg.Info(this, $"Lista salva em {Path.GetFileName(d.FileName)}.");
    }

    void ImportarPilotos()
    {
        using var d = new OpenFileDialog { Filter = "Planilha (*.csv)|*.csv", Title = "Importar competidores (colunas Nº;Competidor;Categoria)" };
        if (d.ShowDialog(this) != DialogResult.OK) return;
        var linhas = File.ReadAllLines(d.FileName).Skip(1).Where(l => l.Trim().Length > 0).ToList();
        var n = 0;
        foreach (var l in linhas)
        {
            var c = l.Split(l.Contains(';') ? ';' : ',').Select(x => x.Trim().Trim('"')).ToArray();
            if (c.Length < 2 || c[0].Length + c[1].Length == 0) continue;
            _gPilotos.Rows.Add(c[0], c[1], "", c.Length > 2 ? c[2] : ""); n++;
        }
        _pilotosSujos = true;
        Msg.Info(this, $"{n} competidor(es) incluído(s). Confira e clique em Salvar.");
    }
}
