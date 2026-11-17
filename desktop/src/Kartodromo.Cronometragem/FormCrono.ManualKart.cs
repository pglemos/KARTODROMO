using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>Teste real do cadastro de kart (transponder + chassi) com fotos de cada passo para o manual da equipe.
/// Roda com KARTODROMO_TESTE=manual-kart e --autoteste &lt;pasta&gt;: janelas fora da tela, nada aparece para o operador.
/// Grava fotos (.png), "passos.json" (onde clicar em cada foto) e "log.txt" (resultado de cada conferência).
/// Usa transponders e karts de teste (9990001/9990002 → karts 98/97) e apaga tudo no fim.</summary>
public partial class FormCrono
{
    const string TranspA = "9990001", TranspB = "9990002", KartA = "98", KartB = "97", ChassiA = "TESTE-301", ChassiB = "TESTE-302";

    async Task TestarManualKartAsync()
    {
        var pasta = _autoteste;
        var log = Path.Combine(pasta, "log.txt");
        void L(string m) => File.AppendAllText(log, m + Environment.NewLine);
        Msg.Registro = m => L("AVISO NA TELA: " + m);
        var passos = new JsonArray();
        var focoAntes = GetForegroundWindow();
        var vigia = new System.Windows.Forms.Timer { Interval = 15 };
        vigia.Tick += (_, _) => { foreach (Form f in Application.OpenForms) if (f.Visible && f.Left > -3000) { f.ShowInTaskbar = false; f.Location = new Point(-4000 + Math.Max(0, f.Left), Math.Max(0, f.Top)); SetForegroundWindow(focoAntes); } };
        vigia.Start();
        var falhas = 0;
        void Conferir(bool ok, string o) { L((ok ? "OK    " : "FALHOU ") + o); if (!ok) falhas++; }

        // foto da janela inteira (com barra de título) e a posição dos alvos em pixels da foto
        void Foto(Control janela, string nome, params Control[] alvos)
        {
            Application.DoEvents();
            using var bmp = new Bitmap(janela.Width, janela.Height);
            using (var g = Graphics.FromImage(bmp))
            {
                var hdc = g.GetHdc(); PrintWindow(janela.Handle, hdc, 2); g.ReleaseHdc(hdc);
                IEnumerable<Control> Todos(Control r) { foreach (Control x in r.Controls) { yield return x; foreach (var y in Todos(x)) yield return y; } }
                foreach (var filho in Todos(janela).Where(x => x.Visible && x.Width > 0 && x.Height > 0 && x is ButtonBase or Label or TextBox))
                {
                    try
                    {
                        var p = filho.PointToScreen(Point.Empty);
                        var visivel = new Rectangle(p, filho.Size);
                        for (var pai = filho.Parent; pai != null && pai != janela; pai = pai.Parent) visivel.Intersect(pai.RectangleToScreen(pai.ClientRectangle));
                        if (visivel.Width <= 0 || visivel.Height <= 0) continue;
                        using var parte = new Bitmap(filho.Width, filho.Height);
                        filho.DrawToBitmap(parte, new Rectangle(0, 0, filho.Width, filho.Height));
                        g.SetClip(new Rectangle(visivel.X - janela.Left, visivel.Y - janela.Top, visivel.Width, visivel.Height));
                        if (filho.Region != null) { using var rg = filho.Region.Clone(); rg.Translate(p.X - janela.Left, p.Y - janela.Top); g.SetClip(rg, System.Drawing.Drawing2D.CombineMode.Intersect); }
                        g.DrawImage(parte, p.X - janela.Left, p.Y - janela.Top);
                        g.ResetClip();
                    }
                    catch { }
                }
            }
            bmp.Save(Path.Combine(pasta, nome + ".png"));
            var arr = new JsonArray();
            foreach (var a in alvos.Where(a => a != null)) { var r = a.RectangleToScreen(a.ClientRectangle); arr.Add(new JsonObject { ["x"] = r.X - janela.Left, ["y"] = r.Y - janela.Top, ["w"] = r.Width, ["h"] = r.Height, ["nome"] = a.Text ?? a.AccessibleName ?? "" }); }
            passos.Add(new JsonObject { ["foto"] = nome + ".png", ["largura"] = janela.Width, ["altura"] = janela.Height, ["alvos"] = arr });
        }
        void FotoRet(Control janela, string nome, params Rectangle[] alvosTela)
        {
            Foto(janela, nome);
            var ult = (JsonObject)passos[^1]!;
            var arr = (JsonArray)ult["alvos"]!;
            foreach (var r in alvosTela) arr.Add(new JsonObject { ["x"] = r.X - janela.Left, ["y"] = r.Y - janela.Top, ["w"] = r.Width, ["h"] = r.Height });
        }

        async Task Limpar()
        {
            foreach (var t in new[] { TranspA, TranspB }) try { await Crono.Api.Put("/api/transponders", new JsonObject { ["raw"] = t, ["kart"] = "" }); } catch { }
            foreach (var k in new[] { KartA, KartB }) try { await Crono.Api.Put("/api/frota/chassis", new JsonObject { ["kart"] = k, ["chassi"] = "" }); } catch { }
        }

        try
        {
            await Limpar();
            var antes = (await Crono.Api.Get("/api/transponders"))?.AsObject() ?? [];
            Conferir(!antes.Any(kv => kv.Value?.ToString() is KartA or KartB), $"karts de teste {KartA} e {KartB} livres antes do teste");

            // 1) tela principal: menu Cadastros
            _abas.SelectedIndex = 2; await Task.Delay(400);
            var cad = MainMenuStrip.Items.OfType<ToolStripMenuItem>().First(i => i.Text == "Cadastros");
            FotoRet(this, "01-tela-principal-menu-cadastros", MainMenuStrip.RectangleToScreen(cad.Bounds));

            // 2) menu aberto: item do cadastro de kart
            cad.ShowDropDown(); await Task.Delay(300);
            var item = cad.DropDownItems.OfType<ToolStripItem>().First(i => i.Text.StartsWith("Kart: transponder"));
            var dd = cad.DropDown;
            {
                using var bmp = new Bitmap(dd.Width, dd.Height);
                dd.DrawToBitmap(bmp, new Rectangle(Point.Empty, dd.Size));
                bmp.Save(Path.Combine(pasta, "02-menu-cadastros-aberto.png"));
                passos.Add(new JsonObject { ["foto"] = "02-menu-cadastros-aberto.png", ["largura"] = dd.Width, ["altura"] = dd.Height, ["alvos"] = new JsonArray(new JsonObject { ["x"] = item.Bounds.X, ["y"] = item.Bounds.Y, ["w"] = item.Bounds.Width, ["h"] = item.Bounds.Height, ["nome"] = item.Text }) });
            }
            cad.HideDropDown();

            // 3) a janela do registro (modal): roda o roteiro de dentro de um temporizador
            var fim = new TaskCompletionSource<bool>();
            var t = new System.Windows.Forms.Timer { Interval = 150 };
            var achou = false;
            t.Tick += async (_, _) =>
            {
                if (achou) return;
                if (Application.OpenForms.Cast<Form>().FirstOrDefault(f => f is RegistroDesign && f.Visible) is not RegistroDesign reg) return;
                achou = true; t.Stop();
                try { await RoteiroRegistro(reg); }
                catch (Exception ex) { L("ERRO no roteiro: " + ex); falhas++; }
                finally { try { reg.Close(); } catch { } fim.TrySetResult(true); }
            };
            t.Start();
            CadastroDesign("CadTranspDePara");
            await Task.WhenAny(fim.Task, Task.Delay(60000));
            t.Stop(); t.Dispose();
            Conferir(achou, "janela 'Registro de kart' abriu pelo menu");

            async Task RoteiroRegistro(RegistroDesign reg)
            {
                await Task.Delay(1500);
                var tipo = typeof(RegistroDesign);
                var campos = (Dictionary<string, Control>)tipo.GetField("_c", BindingFlags.NonPublic | BindingFlags.Instance)!.GetValue(reg)!;
                Button Botao(string texto) => Todos(reg).OfType<Button>().First(b => b.Text == texto);
                static IEnumerable<Control> Todos(Control r) { foreach (Control x in r.Controls) { yield return x; foreach (var y in Todos(x)) yield return y; } }
                async Task Invocar(string metodo, params object[] a) { var r = tipo.GetMethod(metodo, BindingFlags.NonPublic | BindingFlags.Instance)!.Invoke(reg, a); if (r is Task task) await task; await Task.Delay(700); }
                void Digitar(string chave, string valor) { campos[chave].Text = valor; }
                var cRaw = campos["raw"]; var cKart = campos["kart"]; var cCh = campos["chassi"];

                Foto(reg, "03-registro-de-kart-lista", Botao("+ Novo"));

                await Invocar("Novo");
                Foto(reg, "04-novo-campos-vazios", cRaw.Parent!, cKart.Parent!, cCh.Parent!);

                Digitar("raw", TranspA); Digitar("kart", KartA); Digitar("chassi", ChassiA);
                Foto(reg, "05-novo-preenchido", cRaw.Parent!, cKart.Parent!, cCh.Parent!, Botao("Gravar e fechar"));

                await Invocar("GravarAsync", false);
                await Task.Delay(800);
                Foto(reg, "06-gravado-na-lista");
                var m = (await Crono.Api.Get("/api/transponders"))?.AsObject() ?? [];
                var ch = (await Crono.Api.Get("/api/frota/chassis"))?.AsObject() ?? [];
                Conferir(m[TranspA]?.ToString() == KartA, $"transponder {TranspA} ligado ao kart {KartA}");
                Conferir(ch[KartA]?.ToString() == ChassiA, $"chassi {ChassiA} gravado no kart {KartA}");

                // segundo kart, para testar a troca de chassi
                await Invocar("Novo");
                Digitar("raw", TranspB); Digitar("kart", KartB); Digitar("chassi", ChassiB);
                await Invocar("GravarAsync", false);
                ch = (await Crono.Api.Get("/api/frota/chassis"))?.AsObject() ?? [];
                Conferir(ch[KartB]?.ToString() == ChassiB, $"chassi {ChassiB} gravado no kart {KartB}");

                // troca: a placa 98 e o sensor foram para o chassi que era do 97
                var lista = (ListaReg)Todos(reg).First(x => x is ListaReg);
                var idx = lista.Linhas.FindIndex(r => r.S("raw") == TranspA);
                reg.SelecionarLinha(idx); await Task.Delay(500);
                Foto(reg, "07-editar-selecionado", Botao("Editar"));
                await Invocar("Editar");
                Digitar("chassi", ChassiB);
                Foto(reg, "08-trocar-chassi", cCh.Parent!, Botao("Gravar e fechar"));
                await Invocar("GravarAsync", false);
                await Task.Delay(800);
                Foto(reg, "09-chassi-trocado");
                ch = (await Crono.Api.Get("/api/frota/chassis"))?.AsObject() ?? [];
                Conferir(ch[KartA]?.ToString() == ChassiB && ch[KartB] is null, $"troca: chassi {ChassiB} foi para o kart {KartA} e o kart {KartB} ficou sem chassi");

                // número inválido no servidor
                try { await Crono.Api.Put("/api/transponders", new JsonObject { ["raw"] = TranspA, ["kart"] = "0" }); Conferir(false, "kart 0 recusado"); }
                catch { Conferir(true, "kart 0 recusado pelo servidor"); }
                // zero à esquerda vira número normal
                var r07 = await Crono.Api.Put("/api/transponders", new JsonObject { ["raw"] = TranspB, ["kart"] = "097" });
                Conferir(r07?["kart"]?.ToString() == "97", "kart '097' gravado como 97");

                // excluir (desvincular)
                await Invocar("Carregar", (object)null!);
                idx = lista.Linhas.FindIndex(r => r.S("raw") == TranspB); reg.SelecionarLinha(idx); await Task.Delay(400);
                Foto(reg, "10-excluir", Botao("Excluir"));
            }
        }
        catch (Exception ex) { L("ERRO: " + ex); falhas++; }
        finally
        {
            await Limpar();
            var depois = (await Crono.Api.Get("/api/transponders"))?.AsObject() ?? [];
            Conferir(!depois.ContainsKey(TranspA) && !depois.ContainsKey(TranspB), "limpeza: transponders de teste removidos");
            File.WriteAllText(Path.Combine(pasta, "passos.json"), passos.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
            L(falhas == 0 ? "RESULTADO: TUDO OK" : $"RESULTADO: {falhas} FALHA(S)");
            vigia.Stop();
            Close();
        }
    }
}
