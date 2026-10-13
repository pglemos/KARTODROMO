# Formulário e cadastro

## Estrutura
- Em [diálogo](../03-componentes/modal-e-dialogo.md) (padrão) ou em página no admin web.
- **Seções** com título (Dados pessoais, Contato, Responsável, Observações), cada uma em grade de 6 colunas.
- Ordem dos campos = ordem em que a informação chega (no balcão: documento → nome → nascimento → telefone).
- Rótulo acima, obrigatório com `*`, ajuda embaixo quando preciso.

```
DADOS PESSOAIS
CPF *              Nome completo *                         Nascimento *
[123.456.789-00]   [João da Silva                      ]   [12/03/1990]
Telefone *         E-mail
[(31) 99999-0000]  [joao@exemplo.com                    ]
```

## Validação
| Momento | O quê | Como aparece |
|---|---|---|
| Digitando | máscara (CPF, telefone, data, R$) | ao vivo |
| Ao sair do campo | formato (CPF válido, e-mail, data real, hora) | erro embaixo do campo |
| Ao salvar | obrigatórios + regras de negócio (CPF já cadastrado, idade mínima, limite) | erros nos campos + resumo no topo; foco no primeiro erro |
| Do servidor | conflito/duplicidade | mensagem com a saída ("Este CPF é de Maria Souza. [Abrir cadastro]") |

## Comportamento
- Enter avança/salva conforme o padrão do diálogo; Ctrl+S salva em formulários longos.
- Fechar com alteração → "Descartar alterações?".
- Salvar → fecha, volta à origem com o registro selecionado, toast.
- Campos dependentes (menor de idade → seção Responsável) aparecem/somem sem pular o layout de forma brusca.
- Nunca limpar o formulário em caso de erro.

## Regra de interface × regra de negócio
Documente as duas separadamente no [handoff](../06-handoff/como-especificar.md): "CPF com máscara" é interface;
"menor de 12 não corre adulto" é negócio (vive no servidor, a tela só mostra a mensagem).
