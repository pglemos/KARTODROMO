# Estados de uma tela: vazio, carregando, erro, sem permissão, off-line

Toda tela especificada precisa dizer como fica em cada estado ([handoff](../06-handoff/como-especificar.md)).

| Estado | Quando | O que mostrar | Ação oferecida |
|---|---|---|---|
| **Carregando** | dados a caminho (> 300 ms) | [esqueleto](../03-componentes/carregando.md) no lugar do conteúdo; moldura visível | Cancelar (se demorado) |
| **Vazio** | consulta ok, zero itens | [estado vazio](../03-componentes/estado-vazio.md) | criar / limpar filtros |
| **Parcial** | parte carregou, parte falhou | conteúdo + nota no bloco que falhou | Tentar de novo (só o bloco) |
| **Erro** | falha ao buscar | ícone ✕ + "Não foi possível carregar as baterias." + motivo simples | **Tentar de novo**; detalhe técnico no `erros.log` |
| **Sem permissão** | usuário sem acesso | "Você não tem acesso a esta área." | nenhuma (ou "Entrar com outro usuário") |
| **Off-line** | servidor/ORBITS fora | [banner](../03-componentes/aviso-banner-toast.md) + dados marcados "atualizado às hh:mm" | Tentar reconectar |
| **Somente leitura** | bateria encerrada, caixa fechado | selo "Encerrada" + campos sem edição | ação de reabrir, se permitida, com confirmação |

## Regras
- Nunca mostrar tela em branco, `null`, `undefined`, `NaN`, `-1` ou mensagem de exceção.
- Erro não apaga o que o usuário digitou.
- Erros repetidos (3×) sugerem chamar o suporte e dizem qual PC/serviço.
- Os apps nativos gravam o detalhe em `%LOCALAPPDATA%\Kartodromo\erros.log` (`Msg`).
