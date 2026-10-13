# Padrão de diálogo

Componente: [modal-e-dialogo.md](../03-componentes/modal-e-dialogo.md). Aqui: **quando** abrir diálogo e como encadear.

| Situação | Use |
|---|---|
| Criar/editar um registro | diálogo (960 padrão) |
| Escolher uma opção rápida (forma de pagamento, kart) | diálogo pequeno (560) ou menu |
| Confirmar ação destrutiva | [confirmação](../03-componentes/confirmacao-destrutiva.md) (560) |
| Informar sucesso | **toast**, não diálogo |
| Ver detalhes enquanto trabalha na lista | painel lateral, não diálogo |
| Fluxo com etapas (checkout, inscrição) | diálogo com [passos](../03-componentes/segmentado-e-abas.md) ou tela própria |

## Encadeamento
Máximo **2 níveis** (diálogo + confirmação). Se precisa de um terceiro, a tarefa está grande demais: vire tela/passos.
Ao fechar o de cima, o foco volta exatamente ao controle que o abriu.

## Desenho em WinForms
```csharp
var d = new DialogoDesign("Novo cliente", "Cadastro rápido no balcão", "clientes", largura: 960);
var g = d.Secao("Dados pessoais");
d.Campo(g, "CPF *", cpf, 2);
d.Campo(g, "Nome completo *", nome, 4);
// o rodapé empilha da DIREITA para a esquerda: chame o principal primeiro
d.BotaoRodape("Salvar cliente", principal: true, Salvar);
d.BotaoRodape("Cancelar", principal: false, () => d.Close());
d.ShowDialog(this);
```

Mensagens e confirmações não precisam de diálogo próprio: use `Msg.Aviso/Erro/Info/Sucesso/Pergunta` e, para
apagar/estornar, `Msg.Confirmar(this, "Excluir a observação?", "…consequência…", "Excluir observação")` — já saem no
visual do sistema (`DialogoMensagem`), com foco em Cancelar na destrutiva.
