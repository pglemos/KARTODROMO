# Benchmark: Reserva Online Granja Viana (KGV) × Betim

Data: 10/11/2026. Fontes: página pública `reservas.kartodromogranjaviana.com.br/reservaonline`, textos do bundle `index-knYLi7ZJ.js` (telas atrás de login), PDF do termo gerado pelo KGV, e nossos `reservas.` e `cadastro.kartodromodebetim.com.br`.

> Telas internas do KGV (minha conta, pagamento, convites, check-in) não foram navegadas — exigem conta. O mapeamento delas vem dos textos da interface no JS.

## 1. Como o KGV funciona (fluxos)

| Fluxo | O que fazem |
|---|---|
| Agenda pública | Calendário 6 semanas, lista de horários do dia, tipo (20/25 min), vagas restantes, "Bateria aberta/fechada", preço. Filtro "Ocultar indisponíveis". Botão **Compartilhar** link da data. Reservar exige login. |
| Conta | Login e-mail+senha, "lembrar de mim", esqueci senha (link 30 min), força de senha com requisitos, troca forçada de senha. Cadastro CPF/CNPJ/passaporte, estrangeiro residente/não residente, CEP auto, responsável legal p/ menor (≠ titular). Campos protegidos (nome, CPF, e-mail não editáveis). |
| Termo digital | Aceite do termo **versionado**: se mudou, bloqueia até aceitar de novo ("Validade: {days} dias"). Texto com placeholder `{companyName}`. PDF gerado com dados do cliente. |
| Reserva 1 pessoa | Paga depois em "Minhas Reservas". Limite de vagas **por CPF** por horário. |
| Reserva grupo (qtd > 1) | Gera **links de convite** (copiar, WhatsApp, e-mail, importar da agenda do celular). Convidado faz cadastro + aceite. Organizador vê lista: aguardando / aceito / pago / check-in; remove ou troca participante; convite expira. Aviso "X selecionados, só Y aceitaram termo". |
| Bateria fechada c/ organizador | Sem cobrança na hora; "Lançar em Conta Assinada" (faturamento empresa). |
| Pagamento | PIX (QR c/ validade, reaproveita cobrança existente) ou cartão crédito/débito com parcelas e juros; taxa de processamento separada com **desconto por nº de participantes**; motivo de recusa do cartão e orientação. |
| Voucher | Campo código, aplicar/remover, desconto no resumo. |
| Garantia de Reagendamento | Add-on pago ("tarifa full") que permite reagendar/cancelar. |
| Minhas Reservas | Abas por categoria, como participante, cancelar (irreversível), política de cancelamento linkada. |
| Check-in mobile | Janela de horário, **geolocalização** (precisão GPS), QR code no local, exige pago + termo aceito, rate limit. |
| Histórico/pontos | Extrato de pontos, corridas por ano/mês, distribuição por categoria. |
| i18n | PT/EN completo. |
| Erros | Mensagens específicas p/ timeout, sessão expirada, 404 API, JSON inválido. |

## 2. Onde Betim já está igual ou melhor

- Reserva **sem login** em 4 passos (Corrida → Pilotos → Cadastro → Pagamento): menos atrito que KGV.
- Vagas segregadas temporariamente com contador; tratamento de "disponibilidade mudou", "valor atualizado", "pagamento recebido mas não confirmado".
- `.ics` "Salvar na agenda", código da reserva, totem por CPF, link "Como chegar".
- Validações boas: CPF único por piloto, idade mínima 14/18, peso 20–250, Instagram.
- Cadastro com progresso "Faltam N itens", CEP automático, menores vinculados, consentimento LGPD.

## 3. Gaps — o que implementar (prioridade)

### P1 — impacto direto em receita/operação
1. **Convites de grupo com status** (reservas + cadastro): link por vaga, envio WhatsApp/copiar, painel do organizador com aguardando/cadastrado/pago, trocar/remover pessoa, expiração. Hoje temos o link `?r=` vinculado, falta o painel e status por vaga.
2. **Termo de responsabilidade digital com aceite versionado** no cadastro (texto + checkbox + hash/versão + data/IP), PDF gerado com dados (igual o PDF do KGV). Hoje: "termo sai impresso na recepção". Mantém a assinatura física se jurídico exigir, mas o aceite online adianta a fila.
3. **Voucher/cupom** no checkout — migração `0010_reserva_online_voucher.sql` já existe; confirmar se está na UI.
4. **Mostrar vagas restantes** por horário e indicar bateria aberta/fechada; **filtro ocultar indisponíveis**.
5. **Compartilhar link da data** (`?data=AAAA-MM-DD`) — barato, ajuda grupos.

### P2 — experiência
6. **Minhas reservas** sem senha: link mágico por e-mail/WhatsApp (CPF + código) para ver, pagar pendente, cancelar conforme política.
7. **Política de cancelamento escalonada** explícita por prazo (KGV: >7d 100%, 7–2d 50%, <2d 0; fechada 15/7d). Nossa política é genérica — definir regras e calcular reembolso automático.
8. **Garantia de reagendamento** como add-on pago.
9. **Limite de vagas por CPF** por horário (anti-acumulação).
10. **Cartão com parcelas** e motivo de recusa amigável (Asaas devolve).
11. **Desconto por quantidade** de pilotos.

### P3 — futuro
12. Check-in mobile (GPS + QR na recepção) para pular fila do totem.
13. Histórico de corridas/pontos por piloto (temos resultados — ligar ao CPF).
14. Versão em inglês; suporte a passaporte/estrangeiro nas reservas (cadastro já tem).
15. Bateria fechada empresarial com faturamento (conta assinada).

## 4. Boas práticas do termo KGV a copiar
- Dados completos do cliente no cabeçalho (nome, RG, CPF, endereço, telefone, e-mail).
- Limites físicos explícitos (KGV: 120 kg / 1,95 m) e lista de condições proibidas (cardíaco, hipertenso, gestante…).
- Opt-out de uso de imagem por checkbox.
- Política de reembolso dentro do termo.
- Referência LGPD (Lei 13.709/18).
- Cidade/data + assinatura locadora/responsável.

## 5. Não copiar
- Login obrigatório antes de reservar (perde conversão).
- Proxy/iframe de sistema de terceiros (ver memória: Cloudflare marcou phishing).
