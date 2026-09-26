using System.Drawing.Drawing2D;
using System.Runtime.CompilerServices;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>Kit visual local da Recepção: paleta, cartões, campos, botões e cabeçalho das janelas.</summary>
public static class KitVisual
{
    public static readonly Color Fundo = Color.FromArgb(245, 245, 247);
    public static readonly Color Cartao = Color.White;
    public static readonly Color Texto = Color.FromArgb(29, 29, 31);
    public static readonly Color Secundario = Color.FromArgb(110, 110, 115);
    public static readonly Color Verde = Color.FromArgb(11, 122, 83);
    public static readonly Color VerdeClaro = Color.FromArgb(231, 245, 238);
    public static readonly Color Linha = Color.FromArgb(229, 229, 234);
    public static readonly Color CabecalhoGrade = Color.FromArgb(251, 251, 253);

    sealed class PaletaMenu : ProfessionalColorTable
    {
        public override Color MenuStripGradientBegin => Color.White;
        public override Color MenuStripGradientEnd => Color.White;
        public override Color ToolStripDropDownBackground => Color.FromArgb(250, 250, 252);
        public override Color MenuBorder => Color.FromArgb(225, 225, 230);
        public override Color MenuItemSelected => Color.FromArgb(232, 245, 238);
        public override Color MenuItemSelectedGradientBegin => Color.FromArgb(232, 245, 238);
        public override Color MenuItemSelectedGradientEnd => Color.FromArgb(232, 245, 238);
        public override Color MenuItemPressedGradientBegin => Color.FromArgb(220, 238, 228);
        public override Color MenuItemPressedGradientEnd => Color.FromArgb(220, 238, 228);
        public override Color SeparatorDark => Color.FromArgb(228, 228, 233);
        public override Color SeparatorLight => Color.FromArgb(228, 228, 233);
    }

    public static ToolStripRenderer RenderizadorMenu() => new ToolStripProfessionalRenderer(new PaletaMenu());

    static readonly ConditionalWeakTable<Form, object> Aplicadas = new();
    static bool _instalado;

    public static void Instalar()
    {
        if (_instalado) return;
        _instalado = true;
        Application.Idle += (_, _) =>
        {
            foreach (Form f in Application.OpenForms)
                if (f.Visible && !Aplicadas.TryGetValue(f, out _)) Aplicar(f);
        };
    }

    static void Aplicar(Form f)
    {
        Aplicadas.Add(f, new object());
        if (f is FormPrincipal or FormLogin or ISemKit) return;
        // o visualizador de relatório/termo tem WebView2: mover o controle para outro painel depois
        // de aberto deixa a página e a pré-visualização de impressão espremidas num canto
        if (f is Relatorio) return;

        f.SuspendLayout();
        f.BackColor = Fundo;
        f.ForeColor = Texto;
        f.Font = new Font("Segoe UI", 9.5F);

        if (f is Janela)
        {
            var originais = f.Controls.Cast<Control>().ToArray();
            f.Controls.Clear();
            var tamanho = TamanhoDaJanela(f);
            var area = Screen.FromControl(f).WorkingArea;
            var escala = Math.Min(1f, Math.Min(area.Width / (float)tamanho.Width, area.Height / (float)tamanho.Height));
            f.WindowState = FormWindowState.Normal;
            f.FormBorderStyle = FormBorderStyle.None;
            f.ControlBox = false;
            f.MinimizeBox = false;
            f.MaximizeBox = false;
            f.ClientSize = new Size(Math.Max(760, (int)(tamanho.Width * escala)), Math.Max(520, (int)(tamanho.Height * escala)));
            f.MinimumSize = new Size(760, 520);
            f.StartPosition = FormStartPosition.CenterParent;

            var rodape = originais.FirstOrDefault(c => c.Dock == DockStyle.Bottom);
            var meio = originais.Where(c => c != rodape).ToArray();

            var corpo = new Panel { Dock = DockStyle.Fill, BackColor = Fundo, Padding = new Padding(18, 14, 18, 14), AutoScroll = true };
            corpo.Controls.AddRange(meio);

            // No WinForms, docking é processado em ordem decrescente de índice na coleção Controls.
            // Para Dock = DockStyle.Fill funcionar sem cobrir controles Dock = Top/Bottom/Left:
            // O controle com Fill DEVE estar no índice 0 da coleção Controls.
            foreach (Control c in corpo.Controls)
            {
                if (c.Dock == DockStyle.Fill)
                    corpo.Controls.SetChildIndex(c, 0);
            }

            f.Controls.Add(corpo);

            if (rodape != null)
            {
                rodape.Dock = DockStyle.Bottom;
                rodape.Height = 58;
                rodape.BackColor = Color.White;
                rodape.Paint += (_, e) =>
                {
                    using var pen = new Pen(Color.FromArgb(229, 229, 234));
                    e.Graphics.DrawLine(pen, 0, 0, rodape.Width, 0);
                };
                f.Controls.Add(rodape);
            }

            Control cab = null;
            if (f is not FormCadastro { EhProduto: true })
            {
                cab = Cabecalho(f, f.Text);
                f.Controls.Add(cab);
            }
            else corpo.Padding = new Padding(0);

            // Regra crucial de docking do Windows Forms:
            // O controle com Dock = Fill deve SEMPRE estar no índice 0 (fundo do z-order)
            // Os controles com Dock = Bottom e Dock = Top devem ter índices maiores para fatiar as bordas.
            f.Controls.SetChildIndex(corpo, 0);
            if (rodape != null) f.Controls.SetChildIndex(rodape, 1);
            if (cab != null) f.Controls.SetChildIndex(cab, rodape != null ? 2 : 1);

            f.Resize += (_, _) => AplicarRaio(f, 18);
            AplicarRaio(f, 18);
        }

        EstilizarArvore(f, f);
        f.PerformLayout();
        f.ResumeLayout(true);
    }

    public class ModalMeta
    {
        public string Titulo { get; set; }
        public string Sub { get; set; }
        public Color Cor1 { get; set; }
        public Color Cor2 { get; set; }
        public string Glifo { get; set; }
        public string Estado { get; set; }
    }

    public static ModalMeta ObterMeta(Form f, string titulo)
    {
        if (f.Tag is ModalMeta custom) return custom;
        var t = (titulo ?? f.Text ?? "").ToLowerInvariant();

        if (t.Contains("agenda"))
            return new() { Titulo = "Agenda de reservas", Sub = "Calendário mensal, baterias do dia e inclusão de clientes", Cor1 = Color.FromArgb(192, 139, 255), Cor2 = Color.FromArgb(134, 69, 214), Glifo = "\uE787" };
        if (t.Contains("editar bateria") || t.StartsWith("bateria") || t == "bateria")
            return new() { Titulo = "Editar bateria", Sub = (f.Tag as string) ?? "BATERIA 19:20 · 25/09/2026", Cor1 = Color.FromArgb(108, 184, 255), Cor2 = Color.FromArgb(30, 111, 232), Glifo = "\uE823" };
        if (t.Contains("incluir cliente") || t.Contains("registra reserva por cliente") || t.Contains("registrar reserva"))
            return new() { Titulo = "Registrar reserva por cliente", Sub = (f.Tag as string) ?? "BATERIA 19:20 · 25/09/2026 19:20 · 6 vagas disponíveis", Cor1 = Color.FromArgb(108, 184, 255), Cor2 = Color.FromArgb(30, 111, 232), Glifo = "\uE77B" };
        if (t.Contains("mover"))
            return new() { Titulo = "Mover cliente para outra bateria", Sub = (f.Tag as string) ?? "Rafael Martins · hoje na BATERIA 19:20", Cor1 = Color.FromArgb(255, 181, 71), Cor2 = Color.FromArgb(240, 122, 0), Glifo = "\uE76C" };
        if (t.Contains("participantes"))
            return new() { Titulo = "Lista de participantes", Sub = (f.Tag as string) ?? "BATERIA 19:20 · 25/09/2026 · para o briefing e a pista", Cor1 = Color.FromArgb(108, 184, 255), Cor2 = Color.FromArgb(30, 111, 232), Glifo = "\uE71D" };
        if (t.Contains("criar reservas"))
            return new() { Titulo = "Criar reservas", Sub = "Gere as baterias do mês pelo padrão, ou uma reserva avulsa", Cor1 = Color.FromArgb(255, 122, 107), Cor2 = Color.FromArgb(224, 52, 42), Glifo = "\uE7C1" };
        if (t.Contains("editar reserva"))
            return new() { Titulo = "Editar reserva", Sub = (f.Tag as string) ?? "BATERIA 19:20 · pré-reserva", Cor1 = Color.FromArgb(255, 122, 107), Cor2 = Color.FromArgb(224, 52, 42), Glifo = "\uE7C1" };
        if (t.Contains("estornar") || t.Contains("estorno"))
            return new() { Titulo = "Estornar pagamento", Sub = (f.Tag as string) ?? "Venda · terminal SUÊNIA", Cor1 = Color.FromArgb(255, 122, 107), Cor2 = Color.FromArgb(224, 52, 42), Glifo = "\uE7A7" };
        if (t.Contains("visualizar métodos de pagamento") || (t.Contains("métodos de pagamento") && f is FormVenda))
            return new() { Titulo = "Visualizar métodos de pagamento", Sub = (f.Tag as string) ?? "Venda · terminal SUÊNIA", Cor1 = Color.FromArgb(94, 219, 122), Cor2 = Color.FromArgb(30, 158, 74), Glifo = "\uE8C7" };
        if (t.Contains("métodos de pagamento"))
            return new() { Titulo = "Métodos de pagamento", Sub = "Aparecem no checkout e no fechamento de caixa", Cor1 = Color.FromArgb(94, 219, 122), Cor2 = Color.FromArgb(30, 158, 74), Glifo = "\uE8C7" };
        if (t.Contains("padrões") || t.Contains("configuração de reservas"))
            return new() { Titulo = "Configuração de reservas (padrões)", Sub = "Modelos usados em \"Criar reservas\" para gerar as baterias do mês", Cor1 = Color.FromArgb(255, 122, 107), Cor2 = Color.FromArgb(224, 52, 42), Glifo = "\uE7C1" };
        if (t.Contains("parâmetros"))
            return new() { Titulo = "Parâmetros do sistema", Sub = "Ajustes da recepção · toque no valor para alterar", Cor1 = Color.FromArgb(154, 154, 160), Cor2 = Color.FromArgb(74, 74, 79), Glifo = "\uE713" };
        if (t.Contains("usuário"))
            return new() { Titulo = "Registro de usuário", Sub = "Atendentes que entram no Módulo Office", Cor1 = Color.FromArgb(154, 154, 160), Cor2 = Color.FromArgb(74, 74, 79), Glifo = "\uE77B" };
        if (t.Contains("produto"))
            return new() { Titulo = "Registro de produto", Sub = "Produtos e provas de cada locação", Cor1 = Color.FromArgb(255, 181, 71), Cor2 = Color.FromArgb(240, 122, 0), Glifo = "\uE8EC" };
        if (t.Contains("pesquisar cliente") || t.Contains("pesquisar / alterar"))
            return new() { Titulo = "Pesquisar cliente", Sub = "137.539 clientes · pesquise por nome, CPF, celular ou e-mail", Cor1 = Color.FromArgb(108, 184, 255), Cor2 = Color.FromArgb(30, 111, 232), Glifo = "\uE721", Estado = "Pesquisa" };
        if (t.Contains("sangria"))
            return new() { Titulo = "Registrar sangria", Sub = "Retirar dinheiro da gaveta (depósito, cofre)", Cor1 = Color.FromArgb(255, 122, 150), Cor2 = Color.FromArgb(212, 42, 85), Glifo = "\uE898" };
        if (t.Contains("suprimento"))
            return new() { Titulo = "Registrar suprimento", Sub = "Colocar dinheiro na gaveta (troco, fundo de caixa)", Cor1 = Color.FromArgb(72, 214, 204), Cor2 = Color.FromArgb(14, 156, 156), Glifo = "\uE896" };
        if (t.Contains("voucher"))
            return new() { Titulo = "Criar voucher", Sub = "Voucher de desconto ou crédito", Cor1 = Color.FromArgb(255, 216, 74), Cor2 = Color.FromArgb(232, 164, 0), Glifo = "\uE734" };
        if (t.Contains("agenda"))
            return new() { Titulo = "Agenda mensal", Sub = "Agenda mensal de baterias", Cor1 = Color.FromArgb(192, 139, 255), Cor2 = Color.FromArgb(134, 69, 214), Glifo = "\uE787" };
        if (t.Contains("traçado"))
            return new() { Titulo = "Registro de traçado", Sub = "Traçados da pista para provas e tomada de tempo", Cor1 = Color.FromArgb(108, 184, 255), Cor2 = Color.FromArgb(30, 111, 232), Glifo = "\uE707" };
        if (t.Contains("feriado"))
            return new() { Titulo = "Registro de feriados", Sub = "Feriados considerados na geração automática de reservas", Cor1 = Color.FromArgb(255, 122, 107), Cor2 = Color.FromArgb(224, 52, 42), Glifo = "\uE787" };
        if (t.Contains("turno"))
            return new() { Titulo = "Registro de turnos", Sub = "Turnos de operação da recepção e do caixa", Cor1 = Color.FromArgb(154, 154, 160), Cor2 = Color.FromArgb(74, 74, 79), Glifo = "\uE823" };
        if (t.Contains("terminal"))
            return new() { Titulo = "Registro de terminais", Sub = "Terminais autorizados para abertura de caixa", Cor1 = Color.FromArgb(154, 154, 160), Cor2 = Color.FromArgb(74, 74, 79), Glifo = "\uE7F4" };
        if (t.Contains("parceiro"))
            return new() { Titulo = "Registro de parceiro", Sub = "Parceiros e comissões do kartódromo", Cor1 = Color.FromArgb(140, 137, 255), Cor2 = Color.FromArgb(75, 71, 214), Glifo = "\uE77B" };
        if (t.Contains("manutenção") || t.Contains("itens"))
            return new() { Titulo = "Itens de manutenção", Sub = "Itens e peças controlados na oficina", Cor1 = Color.FromArgb(255, 181, 71), Cor2 = Color.FromArgb(240, 122, 0), Glifo = "\uE90F" };
        if (t.Contains("empresa"))
            return new() { Titulo = "Registro de empresa", Sub = "Dados cadastrais e política do kartódromo", Cor1 = Color.FromArgb(108, 184, 255), Cor2 = Color.FromArgb(30, 111, 232), Glifo = "\uE821" };
        if (t.Contains("senha"))
            return new() { Titulo = "Trocar senha", Sub = "Alteração de senha do atendente", Cor1 = Color.FromArgb(154, 154, 160), Cor2 = Color.FromArgb(74, 74, 79), Glifo = "\uE890" };

        return new() { Titulo = titulo ?? f.Text, Sub = "Kartódromo Internacional de Betim · Módulo Office", Cor1 = Color.FromArgb(108, 184, 255), Cor2 = Color.FromArgb(30, 111, 232), Glifo = "\uE700" };
    }

    static Size TamanhoDaJanela(Form f)
    {
        if (f is FormCheckout) return new Size(1320, 812);
        if (f is FormCliente) return new Size(1080, 720);
        if (f is FormCadastro && f.Text.Contains("Produto", StringComparison.OrdinalIgnoreCase)) return new Size(1140, 772);
        if (f is FormCadastro) return new Size(1060, 680);
        if (f.Text.Contains("Agenda", StringComparison.OrdinalIgnoreCase)) return new Size(1340, 820);
        if (f.Text.Contains("Participantes", StringComparison.OrdinalIgnoreCase)) return new Size(960, 680);
        if (f.Text.Contains("Criar Reservas", StringComparison.OrdinalIgnoreCase)) return new Size(960, 680);
        if (f.Text.Contains("Editar Bateria", StringComparison.OrdinalIgnoreCase) || f.Text.Contains("Bateria", StringComparison.OrdinalIgnoreCase)) return new Size(960, 680);
        if (f.Text.Contains("Mover", StringComparison.OrdinalIgnoreCase)) return new Size(960, 680);
        if (f.Text.Contains("Estornar", StringComparison.OrdinalIgnoreCase) || f.Text.Contains("Estorno", StringComparison.OrdinalIgnoreCase)) return new Size(960, 680);
        if (f.Text.Contains("Métodos de Pagamento", StringComparison.OrdinalIgnoreCase)) return new Size(960, 680);
        if (f.Text.Contains("Parâmetros", StringComparison.OrdinalIgnoreCase)) return new Size(960, 680);
        if (f.Text.Contains("Pesquisar Cliente", StringComparison.OrdinalIgnoreCase)) return new Size(960, 680);
        if (f.Text.Contains("Sangria", StringComparison.OrdinalIgnoreCase) || f.Text.Contains("Suprimento", StringComparison.OrdinalIgnoreCase)) return new Size(760, 480);
        return new Size(960, 680);
    }

    public static Control Cabecalho(Form janela, string titulo, string subtitulo = null)
    {
        var meta = ObterMeta(janela, titulo);
        if (!string.IsNullOrEmpty(subtitulo)) meta.Sub = subtitulo;

        var p = new Panel { Dock = DockStyle.Top, Height = 58, BackColor = Color.White, Padding = new Padding(16, 11, 16, 11), Cursor = Cursors.SizeAll };
        p.Controls.Add(new Panel { Dock = DockStyle.Bottom, Height = 1, BackColor = Linha });

        var badge = new Panel { Size = new Size(34, 34), Location = new Point(16, 12), Cursor = Cursors.SizeAll };
        badge.Paint += (_, e) =>
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var path = CaminhoArredondado(new Rectangle(0, 0, 33, 33), 9);
            using var br = new LinearGradientBrush(new Rectangle(0, 0, 34, 34), meta.Cor1, meta.Cor2, 90f);
            e.Graphics.FillPath(br, path);
            TextRenderer.DrawText(e.Graphics, meta.Glifo, new Font("Segoe MDL2 Assets", 11.5F), new Rectangle(0, 0, 34, 34), Color.White, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        };

        var t = new Label { Text = meta.Titulo, AutoSize = true, Font = new Font("Segoe UI", 11F, FontStyle.Bold), ForeColor = Texto, Location = new Point(58, 9), Cursor = Cursors.SizeAll };
        var sub = new Label { Text = meta.Sub, AutoSize = true, Font = new Font("Segoe UI", 8.4F), ForeColor = Secundario, Location = new Point(59, 31), Cursor = Cursors.SizeAll };

        var x = new Button
        {
            Text = "✕",
            Size = new Size(32, 32),
            Anchor = AnchorStyles.Top | AnchorStyles.Right,
            Location = new Point(p.Width - 46, 13),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(238, 238, 241),
            ForeColor = Texto,
            Font = new Font("Segoe UI", 9.5F, FontStyle.Bold),
            Cursor = Cursors.Hand,
            AccessibleName = "Fechar janela"
        };
        x.FlatAppearance.BorderSize = 0;
        x.FlatAppearance.MouseOverBackColor = Color.FromArgb(225, 225, 230);
        AplicarRaio(x, 9);
        x.Click += (_, _) => janela.Close();

        p.Controls.AddRange([badge, t, sub, x]);
        p.Resize += (_, _) => x.Location = new Point(p.ClientSize.Width - x.Width - 14, 13);

        Point? origemMouse = null;
        Point origemJanela = Point.Empty;
        void LigarArraste(Control c)
        {
            c.MouseDown += (_, e) =>
            {
                if (e.Button != MouseButtons.Left || janela.WindowState == FormWindowState.Maximized) return;
                origemMouse = Cursor.Position;
                origemJanela = janela.Location;
            };
            c.MouseMove += (_, e) =>
            {
                if (origemMouse is not Point origem || e.Button != MouseButtons.Left) return;
                var agora = Cursor.Position;
                janela.Location = new Point(origemJanela.X + agora.X - origem.X, origemJanela.Y + agora.Y - origem.Y);
            };
            c.MouseUp += (_, _) => origemMouse = null;
        }
        LigarArraste(p); LigarArraste(badge); LigarArraste(t); LigarArraste(sub);
        return p;
    }

    static void EstilizarArvore(Control root, Form form)
    {
        foreach (Control c in root.Controls)
        {
            if (c.AccessibleDescription == "kit:ignorar") continue;
            if (c is Button b)
            {
                var principal = ReferenceEquals(form.AcceptButton, b) || b.Text.Contains("Salvar", StringComparison.OrdinalIgnoreCase)
                    || b.Text.Contains("Concluir", StringComparison.OrdinalIgnoreCase) || b.Text.StartsWith("Gravar", StringComparison.OrdinalIgnoreCase) || b.Text is "OK" or "Ok" || b.Text.StartsWith("Aprovar", StringComparison.OrdinalIgnoreCase);
                PrepararBotao(b, principal);
            }
            else if (c is TextBox t)
            {
                t.Font = new Font("Segoe UI", 9.5F);
                t.BackColor = Cartao;
                t.ForeColor = Texto;
                t.BorderStyle = BorderStyle.None;
            }
            else if (c is ComboBox cb)
            {
                cb.Font = new Font("Segoe UI", 9.5F);
                cb.BackColor = Cartao;
                cb.ForeColor = Texto;
                cb.FlatStyle = FlatStyle.Flat;
            }
            else if (c is DateTimePicker dt)
            {
                dt.Font = new Font("Segoe UI", 9.5F);
                dt.CalendarTitleBackColor = Verde;
                dt.CalendarTitleForeColor = Color.White;
            }
            else if (c is CheckBox ck && c is not ChaveLiga && ck.Appearance == Appearance.Normal)
            {
                CheckVerde(ck);
            }
            else if (c is DataGridView g)
            {
                EstilizarGrade(g);
            }
            else if (c is Panel p && EhPainelDeCampo(p))
            {
                EstilizarCampo(p);
            }
            else if (c is Label l && l.ForeColor == Color.Black)
            {
                l.ForeColor = Texto;
            }
            EstilizarArvore(c, form);
        }
    }

    /// <summary>Caixa de seleção do design: quadradinho arredondado verde com ✓ branco.</summary>
    public static void CheckVerde(CheckBox ck)
    {
        if (ck.Tag as string == "check-verde") return;
        ck.Tag ??= "check-verde";
        ck.Paint += (_, e) =>
        {
            var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
            var lado = (int)Math.Round(16 * ck.DeviceDpi / 96.0);
            var y = ck.CheckAlign switch { ContentAlignment.TopLeft => 1, _ => (ck.Height - lado) / 2 };
            var r = new Rectangle(0, y, lado, lado);
            using (var fundo = new SolidBrush(ck.Parent?.BackColor ?? Color.White)) g.FillRectangle(fundo, new Rectangle(0, 0, lado + 2, ck.Height));
            using var p = CaminhoArredondado(r, 4);
            if (ck.Checked)
            {
                using var b = new SolidBrush(ck.Enabled ? Verde : Color.FromArgb(160, 196, 180)); g.FillPath(b, p);
                using var pen = new Pen(Color.White, 2F) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round };
                g.DrawLines(pen, [new PointF(r.X + lado * 0.26F, r.Y + lado * 0.52F), new PointF(r.X + lado * 0.44F, r.Y + lado * 0.70F), new PointF(r.X + lado * 0.76F, r.Y + lado * 0.32F)]);
            }
            else
            {
                using var b = new SolidBrush(Color.White); g.FillPath(b, p);
                using var pen = new Pen(Color.FromArgb(199, 199, 204), 1.4F); g.DrawPath(pen, p);
            }
        };
    }

    static bool EhPainelDeCampo(Panel p) => p.Controls.OfType<Label>().Any() &&
        p.Controls.Cast<Control>().Any(c => c is TextBox or ComboBox or DateTimePicker or NumericUpDown or MaskedTextBox);

    static void EstilizarCampo(Panel p)
    {
        p.BackColor = Cartao;
        p.Padding = new Padding(10, 4, 9, 4);
        p.Height = Math.Max(p.Height, 56);
        foreach (Control c in p.Controls)
        {
            if (c is Label l)
            {
                l.ForeColor = Secundario;
                l.Font = new Font("Segoe UI", 8.2F, FontStyle.Bold);
            }
            else if (c is TextBox tb) { tb.BorderStyle = BorderStyle.None; tb.BackColor = Cartao; }
            else if (c is ComboBox cb) { cb.FlatStyle = FlatStyle.Flat; cb.BackColor = Cartao; }
            else if (c is DateTimePicker dt) { dt.CalendarTitleBackColor = Verde; dt.CalendarTitleForeColor = Color.White; }
        }
        p.Paint += (_, e) =>
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var path = CaminhoArredondado(new Rectangle(0, 0, p.Width - 1, p.Height - 1), 8);
            using var pen = new Pen(Color.FromArgb(218, 218, 224));
            e.Graphics.DrawPath(pen, path);
        };
        p.Resize += (_, _) => AplicarRaio(p, 8);
        AplicarRaio(p, 8);
    }

    public static void EstilizarGrade(DataGridView g)
    {
        g.BackgroundColor = Cartao;
        g.BorderStyle = BorderStyle.None;
        g.GridColor = Color.FromArgb(241, 241, 244);
        g.EnableHeadersVisualStyles = false;
        g.ColumnHeadersDefaultCellStyle.BackColor = CabecalhoGrade;
        g.ColumnHeadersDefaultCellStyle.ForeColor = Secundario;
        g.ColumnHeadersDefaultCellStyle.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
        g.ColumnHeadersDefaultCellStyle.SelectionBackColor = CabecalhoGrade;
        g.ColumnHeadersHeight = 36;
        g.DefaultCellStyle.BackColor = Cartao;
        g.DefaultCellStyle.ForeColor = Texto;
        g.DefaultCellStyle.SelectionBackColor = VerdeClaro;
        g.DefaultCellStyle.SelectionForeColor = Texto;
        g.AlternatingRowsDefaultCellStyle.BackColor = Color.FromArgb(253, 253, 254);
        g.RowTemplate.Height = 30;
        g.Font = new Font("Segoe UI", 9.2F);
    }

    public static Button Botao(string texto, bool principal = false, int largura = 0)
    {
        var b = new Button
        {
            Text = texto,
            AutoSize = largura <= 0,
            MinimumSize = new Size(largura > 0 ? largura : 92, 34),
            Height = 34,
            FlatStyle = FlatStyle.Flat,
            BackColor = principal ? Verde : Color.FromArgb(238, 238, 241),
            ForeColor = principal ? Color.White : Texto,
            Font = new Font("Segoe UI", 9.5F, principal ? FontStyle.Bold : FontStyle.Regular),
            Cursor = Cursors.Hand,
            Margin = new Padding(4),
            Padding = new Padding(10, 0, 10, 0),
        };
        b.FlatAppearance.BorderSize = 0;
        AplicarRaio(b, 9);
        return b;
    }

    public static Panel CartaoResumo(string rotulo, string valor, Color? corValor = null)
    {
        var p = new Panel { Height = 68, BackColor = Cartao, Padding = new Padding(14, 10, 14, 8), Margin = new Padding(0, 0, 10, 0) };
        p.Controls.Add(new Label { Name = "valor", Text = valor, Dock = DockStyle.Bottom, Height = 28, Font = new Font("Segoe UI", 14.5F, FontStyle.Bold), ForeColor = corValor ?? Texto, AutoEllipsis = true });
        p.Controls.Add(new Label { Name = "rotulo", Text = rotulo, Dock = DockStyle.Top, Height = 18, Font = new Font("Segoe UI", 9F), ForeColor = Secundario, AutoEllipsis = true });
        p.Paint += (_, e) =>
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var path = CaminhoArredondado(p.ClientRectangle, 12);
            using var b = new SolidBrush(Cartao);
            using var pen = new Pen(Color.FromArgb(232, 232, 236));
            e.Graphics.FillPath(b, path); e.Graphics.DrawPath(pen, path);
        };
        p.Resize += (_, _) => AplicarRaio(p, 12);
        AplicarRaio(p, 12);
        return p;
    }

    /// <summary>Cartão branco arredondado para seções dos diálogos e cadastros (14px raio, borda 1px).</summary>
    public static Panel CartaoSecao(string titulo = null)
    {
        var p = new Panel { BackColor = Cartao, Padding = new Padding(16, 14, 16, 14), Margin = new Padding(0, 0, 0, 12), Dock = DockStyle.Top, AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink };
        p.Paint += (_, e) =>
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var path = CaminhoArredondado(new Rectangle(0, 0, p.Width - 1, p.Height - 1), 14);
            using var pen = new Pen(Color.FromArgb(232, 232, 236));
            e.Graphics.DrawPath(pen, path);
        };
        p.Resize += (_, _) => AplicarRaio(p, 14);
        AplicarRaio(p, 14);
        if (!string.IsNullOrEmpty(titulo))
        {
            var l = new Label { Name = "tituloSecao", Text = titulo, Dock = DockStyle.Top, Height = 24, Font = new Font("Segoe UI", 10F, FontStyle.Bold), ForeColor = Texto };
            p.Controls.Add(l);
            p.ControlAdded += (_, e) =>
            {
                if (e.Control != l && p.Controls.Contains(l))
                    p.Controls.SetChildIndex(l, p.Controls.Count - 1);
            };
        }
        return p;
    }

    /// <summary>Controle de abas estilo pílula cinza com botão ativo branco (Dialogo.dc.html / Cliente.dc.html).</summary>
    public static Control AbaSegmentada(string[] abas, int indiceInicial, Action<int> aoMudar)
    {
        var wrapper = new Panel { Dock = DockStyle.Top, Height = 42, BackColor = Color.Transparent, Padding = new Padding(0, 0, 0, 10) };
        var bar = new FlowLayoutPanel { AutoSize = true, WrapContents = false, Padding = new Padding(2), Margin = Padding.Empty, BackColor = Color.FromArgb(238, 238, 242) };
        AplicarRaio(bar, 9);
        var botoes = new List<Button>();
        for (var i = 0; i < abas.Length; i++)
        {
            var idx = i;
            var b = new Button
            {
                Text = abas[i],
                Height = 28,
                AutoSize = true,
                Padding = new Padding(12, 0, 12, 0),
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9F, i == indiceInicial ? FontStyle.Bold : FontStyle.Regular),
                BackColor = i == indiceInicial ? Color.White : Color.Transparent,
                ForeColor = i == indiceInicial ? Texto : Secundario,
                Cursor = Cursors.Hand,
                Margin = Padding.Empty
            };
            b.FlatAppearance.BorderSize = 0;
            AplicarRaio(b, 7);
            b.Click += (_, _) =>
            {
                for (var j = 0; j < botoes.Count; j++)
                {
                    var ativo = j == idx;
                    botoes[j].BackColor = ativo ? Color.White : Color.Transparent;
                    botoes[j].ForeColor = ativo ? Texto : Secundario;
                    botoes[j].Font = new Font("Segoe UI", 9F, ativo ? FontStyle.Bold : FontStyle.Regular);
                }
                aoMudar(idx);
            };
            botoes.Add(b);
            bar.Controls.Add(b);
        }
        wrapper.Controls.Add(bar);
        return wrapper;
    }

    /// <summary>Rodapé padrão das janelas modais com botões alinhados à direita e nota opcional à esquerda (Dialogo.dc.html).</summary>
    public static Control RodapeModal(Form form, string textoEsquerda, params (string texto, EventHandler clique, bool principal)[] botoes)
    {
        var p = new Panel
        {
            Dock = DockStyle.Bottom,
            Height = 58,
            BackColor = Color.White
        };
        p.Paint += (_, e) =>
        {
            using var pen = new Pen(Color.FromArgb(229, 229, 234));
            e.Graphics.DrawLine(pen, 0, 0, p.Width, 0);
        };
        if (!string.IsNullOrEmpty(textoEsquerda))
        {
            var l = new Label
            {
                Name = "rodapeInfo",
                Text = textoEsquerda,
                Dock = DockStyle.Left,
                AutoSize = false,
                Width = 480,
                TextAlign = ContentAlignment.MiddleLeft,
                Padding = new Padding(18, 0, 0, 0),
                Font = new Font("Segoe UI", 9F),
                ForeColor = Secundario
            };
            p.Controls.Add(l);
        }
        var flow = new FlowLayoutPanel
        {
            Dock = DockStyle.Right,
            AutoSize = true,
            FlowDirection = FlowDirection.RightToLeft,
            WrapContents = false,
            Padding = new Padding(0, 12, 18, 12)
        };
        foreach (var (t, c, principal) in botoes.Reverse())
        {
            var b = Botao(t, principal);
            b.Click += c;
            if (principal && form != null) form.AcceptButton = b;
            flow.Controls.Add(b);
        }
        p.Controls.Add(flow);
        if (form != null) form.Controls.Add(p);
        return p;
    }

    public static Control RodapeModal(Form form, params (string texto, EventHandler clique, bool principal)[] botoes) => RodapeModal(form, null, botoes);

    public static void ValorCartao(Panel cartao, string valor, Color? cor = null)
    {
        var l = cartao.Controls.Find("valor", false).FirstOrDefault() as Label;
        if (l != null) { l.Text = valor; l.ForeColor = cor ?? Texto; }
    }

    public static Panel Campo(string rotulo, Control campo, int altura = 58)
    {
        var p = new Panel { Height = altura, BackColor = Cartao, Padding = new Padding(11, 6, 10, 5), Margin = new Padding(4) };
        p.Controls.Add(new Label { Text = rotulo, Dock = DockStyle.Top, Height = 17, Font = new Font("Segoe UI", 8.2F, FontStyle.Bold), ForeColor = Secundario });
        campo.Dock = DockStyle.Fill;
        campo.Margin = new Padding(0);
        if (campo is TextBox tb) { tb.BorderStyle = BorderStyle.None; tb.Font = new Font("Segoe UI", 11F); }
        p.Controls.Add(campo);
        p.Resize += (_, _) => AplicarRaio(p, 9);
        AplicarRaio(p, 9);
        return p;
    }

    public static void AplicarRaio(Control c, int raio)
    {
        if (c.Width < 2 || c.Height < 2) return;
        using var path = CaminhoArredondado(new Rectangle(0, 0, c.Width, c.Height), Math.Min(raio, Math.Min(c.Width, c.Height) / 2));
        c.Region = new Region(path);
    }

    static GraphicsPath CaminhoArredondado(Rectangle r, int raio)
    {
        var d = Math.Clamp(raio * 2, 2, Math.Max(2, Math.Min(r.Width, r.Height)));
        var p = new GraphicsPath();
        p.AddArc(r.Left, r.Top, d, d, 180, 90); p.AddArc(r.Right - d, r.Top, d, d, 270, 90);
        p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90); p.AddArc(r.Left, r.Bottom - d, d, d, 90, 90);
        p.CloseFigure();
        return p;
    }

    static void PrepararBotao(Button b, bool principal)
    {
        b.FlatStyle = FlatStyle.Flat;
        b.FlatAppearance.BorderSize = 0;
        b.Font = new Font("Segoe UI", 9.3F, principal ? FontStyle.Bold : FontStyle.Regular);
        b.BackColor = principal ? Verde : Color.FromArgb(238, 238, 241);
        b.ForeColor = principal ? Color.White : Texto;
        b.Cursor = Cursors.Hand;
        b.Resize += (_, _) => AplicarRaio(b, 8);
        AplicarRaio(b, 8);
    }
}
