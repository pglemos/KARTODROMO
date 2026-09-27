using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>Os cadastros "Registro de X" do Office no componente Cadastro do design (CadFeriados, CadTurno,
/// CadTerminal, CadFormas, CadItensManutencao, CadPadroes, CadParceiro, OfficeUsuario, CadTracado).</summary>
public static class CadastrosDesign
{
    const string Cinza = "linear-gradient(180deg, #9A9AA0, #4A4A4F)";
    static string SimNao(JsonObject r, string k) => r.B(k) ? "Sim" : "Não";
    static ColunaReg Ativo => new("Ativo", 80, r => SimNao(r, "ativo"), 'C');
    static readonly string[] Categorias = ["Indoor=Indoor", "Super Kart=Super Kart"];

    public static bool Tem(string ent) => ent is "feriados" or "turnos" or "terminais" or "formas" or "itensManutencao" or "padroes" or "parceiros" or "usuarios" or "tracados";

    public static RegistroDesign Criar(string ent)
    {
        var api = Sessao.Api;
        FonteReg Cad(string e) => FonteReg.Rest(api, $"/api/office/cad/{e}");
        RegistroDesign f = ent switch
        {
            "feriados" => new("Registro de feriado", "Feriados são pulados ao gerar as reservas do mês",
                "M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z", "linear-gradient(180deg, #C08BFF, #8645D6)",
                [new("data", "Data", 2, "date"), new("descricao", "Descrição", 3), new("recorrente", "Repete todo ano", 1, "bool")],
                [new("Data", 140, r => Fmt.Dmy(r.S("data"))), new("Descrição", 0, r => r.S("descricao")), new("Repete", 90, r => SimNao(r, "recorrente"), 'C')],
                Cad("feriados")) { Nome = "feriado", Padrao = () => new JsonObject { ["data"] = Fmt.Iso(DateTime.Today), ["recorrente"] = true } },

            "turnos" => new("Registro de turno", "Turnos de trabalho do caixa",
                "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2.5", Cinza,
                [new("descricao", "Descrição", 3), new("inicio", "Início (hh:mm)", 1, "time"), new("fim", "Término (hh:mm)", 1, "time"), new("ativo", "Ativo", 1, "bool")],
                [new("Descrição", 0, r => r.S("descricao")), new("Início", 120, r => r.S("inicio")), new("Término", 120, r => r.S("fim")), Ativo],
                Cad("turnos")) { Nome = "turno" },

            "terminais" => new("Registro de terminal", "Cada atendente tem o seu caixa",
                "M4 5h16v10H4zM8 19h8M12 15v4", Cinza,
                [new("codigo", "Código", 1), new("nome", "Descrição", 4), new("ativo", "Ativo", 1, "bool")],
                [new("Código", 90, r => r.S("codigo")), new("Descrição", 0, r => r.S("nome")), new("Situação agora", 200, r => r.S("situacao") is { Length: > 0 } sit ? sit : "Fechado"), Ativo],
                Cad("terminais")) { Nome = "terminal" },

            "formas" => new("Métodos de pagamento", "Aparecem no checkout e no fechamento de caixa",
                "M2 5h20v14H2zM2 10h20M6 15h4", "linear-gradient(180deg, #5EDB7A, #1E9E4A)",
                [new("codigo", "Código", 1), new("nome", "Nome", 2), new("tipo", "Tipo", 2, "select", ["dinheiro=Dinheiro", "credito=Crédito", "debito=Débito", "pix=Pix", "voucher=Voucher", "outro=Outro"]), new("ativo", "Ativo", 1, "bool")],
                [new("Código", 90, r => r.S("codigo")), new("Nome", 0, r => r.S("nome")), new("Tipo", 160, r => TipoForma(r.S("tipo"))), Ativo],
                Cad("formas")) { Nome = "método" },

            "itensManutencao" => new("Itens de manutenção", "O que é revisado em cada kart e de quanto em quanto tempo",
                "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z", Cinza,
                [new("codigo", "Código", 1), new("nome", "Nome", 2), new("tempoHoras", "A cada (horas)", 1, "int"), new("controlaPorTempo", "Por horas de uso", 1, "bool"), new("ativo", "Ativo", 1, "bool")],
                [new("Código", 90, r => r.S("codigo")), new("Nome", 0, r => r.S("nome")), new("A cada (h)", 120, r => r.S("tempoHoras"), 'D'), Ativo],
                Cad("itensManutencao")) { Nome = "item" },

            "padroes" => new("Configuração de reservas (padrões)", "Modelos usados em \"Criar reservas\" para gerar as baterias do mês",
                "M5 21V4M5 4h12l-2 4 2 4H5", "linear-gradient(180deg, #FF7A6B, #E0342A)",
                [new("nome", "Nome", 2), new("produtoId", "Produto (padrão)", 2, "lista", Itens: () => Sessao.Lista("produtos").Select(p => new Campos.Item(p.L("id") ?? 0, p.S("nome"), p))),
                 new("tracadoId", "Traçado", 1, "lista", Itens: () => Sessao.Tracados()), new("categoria", "Categoria", 1, "select", Categorias),
                 new("quantidade", "Quantidade", 1, "int"), new("primeiraHora", "1ª reserva (hh:mm)", 1, "time"), new("intervaloMin", "Intervalo (min)", 1, "int"),
                 new("vagas", "Vagas (máx)", 1, "int"), new("voltaMinimaSeg", "Volta mínima (s)", 1, "int"), new("online", "Publicar no totem", 1, "bool")],
                [new("Nome", 0, r => r.S("nome")), new("Qtde", 70, r => r.S("quantidade"), 'D'), new("1ª reserva", 100, r => r.S("primeiraHora")), new("Intervalo", 90, r => r.S("intervaloMin"), 'D'),
                 new("Vagas", 70, r => r.S("vagas"), 'D'), new("Ativo", 70, r => SimNao(r, "ativo"), 'C')],
                Cad("padroes")) { Nome = "padrão", Padrao = () => new JsonObject { ["ativo"] = true, ["categoria"] = "Indoor", ["quantidade"] = 1, ["vagas"] = 12, ["intervaloMin"] = 35, ["online"] = true } },

            "parceiros" => new("Registro de parceiro", "Empresas que indicam clientes",
                "M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.9", "linear-gradient(180deg, #6FD6FF, #0A84FF)",
                [new("nome", "Nome", 3), new("documento", "CNPJ / CPF", 2), new("ativo", "Ativo", 1, "bool"), new("comissaoPercentual", "Comissão (%)", 1), new("telefone", "Telefone", 2), new("email", "E-mail", 3)],
                [new("Nome", 0, r => r.S("nome")), new("CNPJ / CPF", 200, r => r.S("documento")), new("Comissão", 110, r => r.S("comissaoPercentual") is { Length: > 0 } c ? c.TrimEnd('%') + "%" : "", 'D'), Ativo],
                FonteReg.Rest(api, "/api/office/parceiros")) { Nome = "parceiro" },

            "usuarios" => new("Registro de usuário", "Atendentes que entram no Módulo Office",
                "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0", Cinza,
                [new("login", "Login", 1), new("nome", "Nome", 2), new("senha", "Nova senha (vazio = manter)", 1, "password"), new("perfilId", "Perfil de acesso", 1, "lista", Itens: Perfis), new("admin", "Administrador", 1, "bool")],
                [new("Login", 140, r => r.S("login")), new("Nome", 0, r => r.S("nome")), new("Perfil de acesso", 150, r => r.S("perfil")), new("Admin", 80, r => SimNao(r, "admin"), 'C'), Ativo,
                 new("Último acesso", 160, r => r.D("ultimoAcesso") is DateTime d ? d.ToString("dd/MM HH:mm") : "")],
                Cad("usuarios"), ("Trocar senha", r => TrocarSenha(r))) { Nome = "usuário" },

            "tracados" => new("Registro de traçado", "Desenhos da pista · o comprimento calcula a velocidade média",
                "M4 18c0-6 4-12 8-12s4 6 8 6M4 18h4", "linear-gradient(180deg, #5EDB7A, #1E9E4A)",
                [new("nome", "Nome", 3), new("comprimento", "Comprimento (m)", 2, "int"), new("ativo", "Ativo", 1, "bool")],
                [new("Nome", 0, r => r.S("nome")), new("Comprimento (m)", 180, r => r.S("comprimento"), 'D'), Ativo],
                Cad("tracados")) { Nome = "traçado" },

            _ => throw new ArgumentException("Cadastro desconhecido: " + ent),
        };
        f.Depois = Sessao.CarregarApoio;
        if (ent == "usuarios") f.Validar = b => b["senha"]?.ToString() is { Length: > 0 and < 6 } ? "A senha precisa ter pelo menos 6 caracteres." : null;
        return f;
    }

    static string TipoForma(string t) => t switch { "dinheiro" => "Dinheiro", "credito" => "Crédito", "debito" => "Débito", "pix" => "Pix", "voucher" => "Voucher", "outro" => "Outro", _ => t };

    /// <summary>Perfis de acesso (os mesmos da cronometragem: Segurança › Perfil de acesso).</summary>
    static IEnumerable<Campos.Item> Perfis()
    {
        try { return Task.Run(() => Sessao.Api.Lista("/api/office/cad/perfis")).GetAwaiter().GetResult().Select(p => new Campos.Item(p.L("id") ?? 0, p.S("descricao"), p)).ToList(); }
        catch { return []; }
    }

    static void TrocarSenha(JsonObject usuario)
    {
        var dono = Form.ActiveForm;
        var nova = Prompt.Pedir(dono, $"Nova senha de {usuario.S("nome")} (mínimo 6 caracteres):", "", "Trocar senha", true);
        if (string.IsNullOrEmpty(nova)) return;
        if (nova.Length < 6) { Msg.Aviso(dono, "A senha precisa ter pelo menos 6 caracteres."); return; }
        var conf = Prompt.Pedir(dono, "Repita a nova senha:", "", "Trocar senha", true);
        if (conf != nova) { Msg.Aviso(dono, "As senhas não conferem."); return; }
        Seguro.Rodar(dono, async () =>
        {
            await Sessao.Api.Put($"/api/office/cad/usuarios/{usuario.S("id")}", new { senha = nova });
            Msg.Info(dono, "Senha alterada.");
        });
    }
}
