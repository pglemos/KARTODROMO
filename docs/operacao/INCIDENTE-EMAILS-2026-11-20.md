# Incidente: e-mails automáticos parados (14 a 20/11/2026)

## Sintoma
Clientes sem e-mail de reserva confirmada, termo assinado, confirmação de participação, conta e resultado das baterias.
No site o e-mail aparecia como "enviado" (entrava na fila), mas não chegava.

## Causas
1. **Cota diária do plano do Resend.** Site, CRM e cronometragem usam a mesma conta. Só o resultado das baterias manda
   um e-mail por piloto (30–44 por bateria; 220–250/dia no fim de semana): a cota acabava e nada mais saía.
2. **A fila do site (`mobile_email_outbox`) é esvaziada pela cronometragem, que também usava o Resend** — sem cota, a
   fila nunca andava: 464 e-mails presos de 14 a 20/11, com até 180 tentativas cada.
3. **A saída antiga pela HostGator estava morta:** o certificado de `mail.kartodromodebetim.com.br` venceu em
   17/11 23:11 (a renovação automática da HostGator falhou na mudança de DNS: `cpcalendars` aponta para outro IP e
   `webmail`/`cpanel` para a VPS).
4. O CRM escolhia um único transporte (SMTP ou Resend) e não trocava quando ele falhava.

## Correções (20/11)
- **Cronometragem (ORBITS), KARTODROMO `4ee4c82`:** cadeia **Resend → HostGator → Gmail** (`data/timing/email.json`,
  `email-reserva.json`, `email-gmail.json`). Servidor que falha por motivo dele (cota, limite, certificado, senha,
  conexão) sai da cadeia até a hora certa (`servidorForaAte`); erro do destinatário não derruba servidor. Vale para a
  fila do site e para o resultado das baterias (reenvio adiantado para segundos quando há outro servidor).
- **HostGator** pelo nome do próprio servidor, `sh-pro46.hostgator.com.br` (certificado válido até 13/12), com a
  mesma conta `crono@`. Testado: entrega em 2,4 s. **Gmail** (`cronokartbetim@gmail.com`) testado: 6,9 s.
- **CRM `kart.92`:** o roteador troca de transporte quando o principal falha (`rate_limited`, `send_failed`,
  `not_configured`). Para ter de fato a segunda saída no CRM, o dono precisa cadastrar o SMTP em Configurações (o CRM
  não tem SMTP gravado).
- **Fila atrasada:** 272 de 274 e-mails úteis entregues pela HostGator (termos, recibos, contas, tudo das últimas 24 h);
  2 endereços inválidos. 194 mensagens velhas (confirmação de bateria que já passou, "falta pagar" vencido) descartadas
  por decisão do dono, com backup em `/srv/kart-edge/dados/d1/kartodromo-mobile.backup-fila-20261120.sqlite`.

## Pendências do dono
- **Plano pago do Resend** (sem teto diário): resend.com/settings/billing. Sem ele, todo dia de movimento a carga cai
  na HostGator (500/h) e no Gmail (500/dia).
- **Certificado da HostGator:** cPanel › SSL/TLS Status › Run AutoSSL, ou acertar o DNS de `cpcalendars`, `webmail` e
  `cpanel` para o servidor da HostGator. Enquanto isso o envio usa `sh-pro46.hostgator.com.br`.
- **SMTP no CRM** (Configurações), para o CRM ter segunda saída.
