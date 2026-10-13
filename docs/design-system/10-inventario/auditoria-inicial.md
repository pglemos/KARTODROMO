# Auditoria inicial — 08/10/2026

Primeira passagem do [processo de auditoria](../08-governanca/auditoria-ux-ui.md) sobre o que já se sabe das
auditorias de 27/09, 30/09 e 06/10 (cronometragem F01–F43, 24 corrigidos na 1.0.41 e correções de layout até a 1.0.46)
e do levantamento desta entrega. A auditoria completa tela a tela (fotos nas 5 resoluções) é o primeiro passo de cada fase.

## Achados
| Id | App / área | Achado | Regra | Sev. | Impacto | Esforço | Quadrante |
|---|---|---|---|---|---|---|---|
| A01 | Todos | Seis paletas e cores escritas no código | padrão / consistência (H4) | 2 | alto | alto | Planejar (fases 1–8) |
| A02 | Recepção | Texto de aviso laranja `#B26A00` reprova contraste | acessibilidade | 2 | médio | baixo | Fazer já (fase 2) |
| A03 | Recepção / Crono | Link/info azul `#1E6FE8` reprova sobre fundo | acessibilidade | 2 | médio | baixo | Fazer já |
| A04 | Desktop | Dica/placeholder `#8E8E93` reprova | acessibilidade | 1 | baixo | baixo | Encaixar |
| A05 | Desktop claro | Borda de campo 1,38:1 | acessibilidade (borda 3:1) | 2 | médio | baixo | **feito 10/10: #8E8E93 (3,26:1)** |
| A06 | Crono ao vivo | Melhor volta só por cor | nunca só cor | 2 | alto | baixo | ✅ resolvido 08/10 (marcador ■) |
| A07 | Desktop | Mensagens no `MessageBox` do Windows | consistência (H4) | 1 | médio | médio | ✅ resolvido 08/10 (`Msg` desenhado) |
| A08 | Desktop | Sem toast: sucesso abre caixa modal que interrompe | H1 / eficiência (H7) | 2 | médio | médio | ◐ `Toast` pronto; telas passam a usar nas fases 2–3 |
| A09 | Desktop | 8 tipos de botão, alturas 26–42 | consistência | 2 | alto | médio | Planejar (fase 1) |
| A10 | Desktop | Telas sem estado vazio padrão | H1 / H10 | 1 | médio | baixo | Encaixar |
| A11 | Tablet | `Tema.kt` e `themes.xml` com verdes diferentes | consistência | 1 | baixo | baixo | Encaixar (fase 7) |
| A12 | Site | Legado Vite com Inter/Montserrat ainda no repositório | manutenção | 1 | baixo | médio | Planejar (fase 8) |
| A13 | timing-ui | Três famílias de cor entre páginas | consistência | 1 | médio | baixo | ✅ resolvido 08/10 (fase 5) |
| A14 | Documentação | `PRODUCT.md` desatualizado (LapTime/MyLapTime) | — | 1 | médio | baixo | Fazer já |

Severidade 0–4 (Nielsen). Nenhum achado de severidade 4 aberto.

## Pendências herdadas da auditoria da cronometragem (06/10)
F01 (autenticação), F04 (SQL) e ajustes de layout/telas restantes — seguem a lista própria daquela auditoria.

## Próximo passo
Rodar o autoteste nas 5 resoluções de todos os apps, preencher a tabela tela a tela e reordenar pela matriz antes da fase 1.
