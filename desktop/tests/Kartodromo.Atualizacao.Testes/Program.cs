using Kartodromo.Comum;

static class Program
{
    static int Main()
    {
        Teste("versão remota maior atualiza", () =>
        {
            var remoto = new ManifestoDesktop { App = "Recepcao", Version = "1.0.1", Pacote = "recepcao.zip", Sha256 = new string('A', 64) };
            Exigir(Atualizacao.DeveAtualizar("1.0.0", "Recepcao", remoto));
        });
        Teste("versão igual ou menor não atualiza", () =>
        {
            var remoto = new ManifestoDesktop { App = "Recepcao", Version = "1.0.0", Pacote = "recepcao.zip", Sha256 = new string('A', 64) };
            Exigir(!Atualizacao.DeveAtualizar("1.0.0", "Recepcao", remoto));
            remoto.Version = "0.9.9";
            Exigir(!Atualizacao.DeveAtualizar("1.0.0", "Recepcao", remoto));
        });
        Teste("manifesto de outro aplicativo ou hash inválido não atualiza", () =>
        {
            var remoto = new ManifestoDesktop { App = "Cronometragem", Version = "9.0.0", Pacote = "crono.zip", Sha256 = "ruim" };
            Exigir(!Atualizacao.DeveAtualizar("1.0.0", "Recepcao", remoto));
        });
        Teste("configuração local nunca é substituída", () =>
        {
            Exigir(!Atualizacao.PodeSubstituirArquivo("appsettings.json"));
            Exigir(!Atualizacao.PodeSubstituirArquivo("subpasta/appsettings.json"));
            Exigir(Atualizacao.PodeSubstituirArquivo("Kartodromo.Recepcao.exe"));
        });
        Teste("download informa percentual somente quando o tamanho é conhecido", () =>
        {
            Exigir(Atualizacao.PercentualDownload(0, 100) == 0);
            Exigir(Atualizacao.PercentualDownload(50, 100) == 50);
            Exigir(Atualizacao.PercentualDownload(100, 100) == 100);
            Exigir(Atualizacao.PercentualDownload(1, null) == -1);
        });
        Teste("não permite dois instaladores do mesmo aplicativo", () =>
        {
            var nome = "teste-" + Guid.NewGuid().ToString("N");
            using var primeiro = Atualizacao.AdquirirBloqueio(nome, TimeSpan.Zero);
            Exigir(primeiro != null);
            using var segundo = Task.Run(() => Atualizacao.AdquirirBloqueio(nome, TimeSpan.Zero)).GetAwaiter().GetResult();
            Exigir(segundo == null);
        });
        Console.WriteLine("PASS: contratos de atualização desktop");
        return 0;
    }

    static void Teste(string nome, Action acao)
    {
        try { acao(); Console.WriteLine("OK: " + nome); }
        catch (Exception ex) { Console.Error.WriteLine("FAIL: " + nome + " — " + ex.Message); Environment.ExitCode = 1; }
    }

    static void Exigir(bool valor)
    {
        if (!valor) throw new InvalidOperationException("assertion falhou");
    }
}
