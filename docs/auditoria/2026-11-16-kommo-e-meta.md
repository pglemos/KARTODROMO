# Auditoria Kommo + Meta — 16/11/2026

Fonte: leitura pela API v4 do Kommo e pelas telas do Meta Business (Gerenciador de Anúncios, Gerenciador de Eventos, Gerenciador do WhatsApp). Nada foi alterado.

## Kommo
- **Conta:** `kartodromodebetimhotmailcom.kommo.com` (id 34959724, BRL). Tem **1 usuário** só ("Kartodromo de Betim", admin): todo mundo usa o mesmo login, então não dá para saber quem atendeu.
- **Volume:** 51.770 leads de 25/04/2025 a 16/11/2026, média de cerca de 3.000 por mês. Julho/2026 teve 10.949, um pico de campanha.
- **Funil único "Funil de vendas"** com 17 etapas:
  - fluxo: entrada → em atendimento → em negociação → aguardando pagamento;
  - follow-up de 7, 15 e 30 dias;
  - aguardando resultado;
  - etapas por assunto: Estorno, Direção Defensiva, Carteirinha/Quiara, Atlético, Orçamento espaço/empresa, Reclamação, "pessoas que tem corrida paga";
  - fechamento: ganho / perdido.
- **Situação atual dos leads:**

  | Etapa | Leads |
  |---|---|
  | Perdido | 43.536 |
  | Ganho | 7.422 |
  | Corrida paga | 450 |
  | Em atendimento | 205 |
  | Negociação | 36 |
  | Reclamação | 32 |
  | Aguardando pagamento | 20 |

- **Ganhos por mês:** entre 231 e 964. **Valor da venda praticamente nunca é preenchido**: 16 leads com preço, e R$ 8.990 só em nov/2026. Ou seja, hoje não existe receita por lead.
- **Motivos de perda:**

  | Motivo | Leads |
  |---|---|
  | Não respondeu / sumiu | 2.870 |
  | Escolheu outra opção | 2.292 |
  | Comprou do concorrente | 1.044 |
  | Kart infantil | 53 |
  | Preço | 20 |

  Cerca de 37 mil leads perdidos estão sem motivo.
- **Tags mais usadas:**

  | Tag | Leads |
  |---|---|
  | Frio | 3.673 |
  | kart infantil | 1.273 |
  | Morno | 1.163 |
  | Quente | 191 |
  | Empresa | 129 |
  | SUPER KART | 102 |
  | parceria | 90 |
  | Cliente recorrente | 86 |

  Há tags duplicadas ("kart infantil"/"Kart infantil") e tags que são textos de mensagem coladas por engano.
- **Campos:**
  - Lead: rastreio UTM, gclid, fbclid, IDs de campanha, conjunto e anúncio da Meta, TikTok. **Nenhum lead tem esses campos preenchidos (0 de 51.770)**: a atribuição de anúncio não chega no CRM.
  - Contato: telefone, e-mail, `WhatsappUsername_WZ`, `WhatsappLid_WZ`, assinatura de marketing.
- **Integrações ativas:** `amocrm_whatsapp`, `amo_wapp_im`, `whatgram` (WhatsApp por QR), `whatsapp_cloud_api` (oficial), `tiktok_kommo`. Não há fontes (sources) cadastradas.
- **Robôs** (lidos em 17/11): "Robô de NPS" (tipo NPS, ativo), "Betina" (robô de vendas, ativo) e 11 disparos em massa ("Transmissão") entre nov/2025 e ago/2026. **Nenhuma etapa do funil tem gatilho automático**, então todos os robôs são acionados à mão ou pelo "Agente de IA" do Kommo (o menu mostra 2 agentes). A API não devolve os passos dos robôs.
- **Modelos oficiais WhatsApp** (todos MARKETING): Promoção de Aniversário (10 amigos a R$ 145 + aniversariante R$ 90), Esgota Rápido, Garanta seu Horário, Interesse, Últimas Vagas (de R$ 175), Bateria Fechada Troféu, Happy Hour Terça a Quinta (R$ 99,90; primeira vez R$ 89,90; botão para `reservas.`). Viram o catálogo de mensagens do novo CRM.
- **Fontes de lead ligadas ao funil:**

  | Fonte | Situação |
  |---|---|
  | WhatsApp 553198842898 | ok |
  | WhatsApp 553135112373 (oficial) | ok |
  | WhatsApp 553190742898 | ok |
  | WhatsApp 553183287759 | **erro de conexão** |
  | [WABA] 553199930482 | desabilitado |
  | Messenger / Instagram (Kartodromo de Betim, @kartodromobetim) | ok |
  | Comentários do Instagram e do Facebook | ok |
  | TikTok | ok |
  | TikTok Ads Manager | desabilitado |

  São 3 números de WhatsApp ativos além do oficial. Esses são os candidatos para conectar por QR Code no novo CRM.
- Não há pontuação de lead. O controle de duplicatas existe (regras não lidas).

## Meta
- **Business Manager:** "Kartódromo Internacional de Betim", id 2581288062081006. Página FB com 1,2 mil seguidores; Instagram com 75,2 mil.
- **Conta de anúncios:** 2317389868593953. Nos últimos 30 dias (17/10–15/11) foram **R$ 3.889,35** e 418 mil impressões, **todas as campanhas com objetivo "conversa no WhatsApp"**:

  | Campanha | Status | Orçamento/dia | Gasto | Conversas | Custo/conversa |
  |---|---|---|---|---|---|
  | `[V4]_[EB]_WPP_BATERIAS_KIB_2373` | ativa | R$ 300 | R$ 2.926 | 875 | R$ 3,34 |
  | `TESTE - BLACK 15 MINUTOS` | ativa | R$ 100 | R$ 648 | 214 | R$ 3,03 |
  | `[V4]_[EB]_WPP_HAPPY-HOUR-TER-QUI_KIB` | ativa | R$ 57 | R$ 194 | 31 | R$ 6,26 |
  | `[V4]_[EB]_WPP_ANIVERSARIO_KIB` | ativa | R$ 30 | R$ 122 | 18 | R$ 6,75 |
  | `[V4]_[EB]_WPP_EVENTOS-CORPORATIVOS_KIB` | desativada | — | — | — | — |

  O otimizador da Meta só enxerga "conversa iniciada", nunca a venda.
- **Gerenciador de Eventos:** um dataset, "Kartódromo Internacional de Beti" (id 1617559156207933), com **0 eventos nos últimos 28 dias**, **nenhuma integração**, sem pixel no site e sem Conversions API.
- **WhatsApp:**
  - a WABA 545413958656562 ("Kartódromo Internacional Betim LTDA") tem o número **+55 31 3511-2373** conectado e "em análise", com classificação de qualidade indisponível;
  - há 3 contas de mensagens: 2 no app WhatsApp Business (coexistência) e 1 de API.

## O que isso muda no plano
1. **A maior oportunidade é a atribuição.** Os anúncios são todos de clique para o WhatsApp, mas o CRM não recebe o `ctwa_clid` nem o ID do anúncio, e a Meta não recebe a venda. O DeskcommCRM (`lib/conversoes/*`) mais a CAPI no dataset 1617559156207933 resolvem isso. Isso vira prioridade da Fase 6.
2. **Valor da venda tem que ser automático.** O agente fecha com o link Asaas, e o valor pago vira o valor do negócio e da conversão. Hoje ele é zero.
3. **Motivo de perda obrigatório** e um usuário por atendente no novo CRM.
4. **Migração do Kommo:** 51.770 leads e os contatos. Só leads em aberto e ganhos recentes viram negócios ativos; os perdidos entram como histórico do contato.
5. **Funil novo:** separar "Vendas de baterias", "Eventos/empresas" e "Atendimento/pós-venda" (reclamação, estorno, achados e perdidos) em vez de etapas por assunto num funil só.
6. **Número oficial +55 31 3511-2373:** confirmar se usa coexistência com o app WhatsApp Business antes de ligar no Deskcomm, para não derrubar o atendimento atual.
