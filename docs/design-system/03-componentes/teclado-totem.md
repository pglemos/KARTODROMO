# Teclado no totem (entrada de dados no autoatendimento)

**Status:** canônico · **Tema:** escuro · **Visual do totem: travado (aprovado)**

## Regra principal
Os totens têm **teclado USB físico**. **Nunca** exibir teclado virtual na tela, nem como alternativa. A tela mostra
apenas o campo grande e a instrução de digitar.

## Anatomia do campo do totem
```
 Seja bem-vindo(a)!                                 ← título grande
 Digite seu CPF, RG, passaporte ou e-mail…           ← explicação
 CPF, RG, passaporte ou e-mail                       ← rótulo
┌──────────────────────────────────────────────┐
│ 123.456.789-0▌                               │  altura 82 · borda neon no foco
└──────────────────────────────────────────────┘
 Use o teclado USB do totem e pressione Enter para continuar.  ← dica permanente
 [ Próximo ]                                        ← pílula ≥ 64 px
```

## Comportamento
| Gatilho | Interface | Efeito |
|---|---|---|
| Tela abre | foco **já** no campo; cursor piscando | — |
| Digitar | máscara ao vivo (CPF, telefone, data) | — |
| Enter | igual a "Próximo" | valida e avança |
| Backspace | apaga | — |
| Esc | fecha só a janela do termo LGPD; nas telas, use o botão "Voltar" | — |
| Espaço / Enter em opção da lista | marca/desmarca o participante | — |
| Qualquer tecla ou toque | reinicia a contagem de inatividade | — |
| 90 s sem interação (com algo digitado ou fora da tela inicial) | volta ao início | limpa os dados digitados |
| Tela final ("Inscrição na bateria confirmada") | mostra "Volta para o início após 90 segundos sem interação" | volta ao início |
| Documento curto (< 5) | alerta "Informe o CPF, RG, passaporte ou e-mail." e o valor continua no campo | — |
| Cadastro bloqueado | alerta "Seu cadastro precisa de atenção. Por favor, procure a recepção." | não avança |

## Pré-cadastro por QR code
Cliente que fez o [pré-cadastro](../06-handoff/telas/totem-identificacao.md) é encontrado pelo documento digitado;
os dados aparecem para confirmar, não para redigitar.

## Implementação
`Kartodromo.Autoatendimento`: `CampoTexto`, `Pilula`, `Estilo` — **não alterar visual**. Na fase 6 os valores
viram `componente.totem.*` com os **mesmos números** (pixel idêntico, conferido por foto).
