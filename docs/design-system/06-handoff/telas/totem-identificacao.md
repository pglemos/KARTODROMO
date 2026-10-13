# Totem — Identificação

| | |
|---|---|
| Status | implementada · **visual travado** |
| Quem usa | cliente, sozinho, de pé, com teclado USB |
| Tema | escuro |
| Padrão | [fluxo do totem](../../04-padroes-de-tela/fluxo-totem.md) |
| Desenho aprovado | `TotemIdentificacao.dc.html` |
| Código | `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs` (`TelaIdent`) |

## Layout
"Seja bem-vindo(a)!" · explicação "Digite seu CPF, RG, passaporte ou e-mail para reservar a bateria. Se já correu aqui,
seus dados aparecem sozinhos." · rótulo + campo grande · dica "Use o teclado USB do totem e pressione Enter para
continuar." · caixa "Sou responsável por menor de idade" · botão **Próximo**.

## Interações
| # | Elemento | Gatilho | Interface | Negócio | Destino |
|---|---|---|---|---|---|
| 1 | Campo | digitar (teclado USB) | texto aparece; foco sempre no campo | — | permanece |
| 2 | Próximo | clique / Enter | "Aguarde" | `POST /api/totem/identificar` | ver abaixo |
| 3 | Responsável por menor | clique / Espaço | marca | define o próximo passo | permanece |

Destinos do Próximo: cliente achado sem menor → **Confirmar cadastro**; com menor → **Quem vai participar?**;
não achado → **Cadastro novo**; bloqueado → alerta e permanece.

## Validações
| Campo | Regra | Momento | Mensagem |
|---|---|---|---|
| Documento | ≥ 5 caracteres | ao avançar | "Informe o CPF, RG, passaporte ou e-mail." |
| Cadastro | não bloqueado | servidor | "Seu cadastro precisa de atenção. Por favor, procure a recepção." |

## Regras
| Interface | Negócio |
|---|---|
| Sem teclado virtual | Pré-cadastro feito pelo QR code é encontrado pelo documento |
| 90 s sem interação com algo digitado → volta ao início limpo | Dados do cliente só vêm com token da sessão do totem |

## Critérios de aceite
- [ ] Fotos do autoteste idênticas às aprovadas em 1366×768 e 1920×1080.
- [ ] Enter avança sem tocar na tela.
