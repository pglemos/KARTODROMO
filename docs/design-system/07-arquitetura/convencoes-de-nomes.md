# Convenções de nomes

## Tokens
`categoria.papel.variante[.estado]` — minúsculas, português **sem acento**, hífen dentro do segmento.
O gerador recusa maiúscula e acento.

| Camada | Exemplos |
|---|---|
| primitivo | `primitivo.cor.verde.650`, `primitivo.dimensao.16` |
| semântico | `cor.acao.principal`, `cor.texto.secundario`, `cor.estado.perigo.fundo`, `espaco.3`, `raio.cartao`, `elevacao.2`, `movimento.duracao.rapido` |
| componente | `componente.controle.altura-m`, `componente.totem.alvo-toque` |

Nome diz o **papel**, nunca a aparência: `cor.estado.perigo.texto` ✅, `cor.vermelho-escuro` ❌.

### Tradução por plataforma (automática)
| Token | CSS | C# | Kotlin | Android XML |
|---|---|---|---|---|
| `cor.acao.principal` | `--kib-cor-acao-principal` | `Tokens.Claro.CorAcaoPrincipal` | `Tokens.Claro.CorAcaoPrincipal` | `kib_claro_cor_acao_principal` |

## Código
| Onde | Convenção | Exemplo |
|---|---|---|
| C# classes/métodos | PascalCase em português | `DialogoDesign`, `AplicarRaio` |
| C# formulários | `Form` + assunto | `FormCheckout`, `FormTerminalAbrir` |
| C# parciais | `Form.Assunto.cs` | `FormCrono.Equalizacao.cs` |
| React componentes | PascalCase | `AdminShell`, `EstadoVazio` |
| TS funções/variáveis | camelCase | `gerarCss` |
| Arquivos web | `kebab-case.ts` (libs), `PascalCase.tsx` (componentes) | `race-engine.ts` |
| CSS classes novas | `kebab-case`, BEM leve | `.btn`, `.btn--primario` |
| Rotas web | minúsculas, hífen, português | `/admin/equalizacao`, `/placar-telao` |
| APIs | `/api/<recurso>` no plural ou nome do domínio | `/api/sessions`, `/api/equalizacao/metas` |

Existem nomes antigos em inglês (`race-engine`, `/api/sessions`, `runningId`); não renomear só por estética —
quebra integrações. Coisas **novas** em português.

## Textos
Glossário em [01-fundamentos/conteudo-e-mensagens.md](../01-fundamentos/conteudo-e-mensagens.md).
