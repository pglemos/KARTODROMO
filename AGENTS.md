# Instruções para agentes (Codex / Claude)

## Sistema próprio do kartódromo (operação: recepção, totens, cronometragem)

**Leia primeiro `docs/operacao/HANDOFF-SISTEMA-PROPRIO.md`.** Ele tem as máquinas, os acessos
(com o lugar onde cada senha está guardada, nunca a senha), as rotas, o build, o deploy, as
regras do dono e as pendências.

Regras que não podem ser quebradas:

- Responder sempre em **pt-BR**.
- Os apps são **programas Windows nativos** (`desktop/`), nunca app web/Chrome.
- **Totem sem teclado na tela.**
- **Não mexer no telão** (`FormTV` / `--tv`).
- Testes em produção só com dados **"TESTE CODEX"**, desfeitos depois.
- Cronometragem: teste no **simulador `:4150`**, nunca no `:4050` real.
- **Nunca** colocar senha em arquivo versionado, commit ou log.
- **Não clonar nem fazer proxy do MyLapTime/Sisecom.**
- Mais de uma sessão mexe no repo: rode `git status` e `git fetch` antes de editar.
- **Nada de instalar app nem reiniciar servidor no horário de funcionamento** (ter–sex 17:00–21:40, sáb 09:15–18:35,
  dom até 18:00, feriado 14:40–21:40). Em 11/10 instalações manuais no ORBITS (pedido de PIN às 17:19, 17:49 e 18:05)
  fecharam a Cronometragem no meio das baterias duas vezes e o reinício do `:4050` 30 s depois de encerrar a corrida
  das 17:25 perdeu o e-mail do resultado de 35 pilotos. Nesse horário, publique o pacote e deixe a **atualização
  automática** instalar (ela espera o PC ficar parado). Reiniciar o `:4050` só sem bateria rodando (`runningId` vazio)
  **e** 3+ min depois do último encerramento (envio dos e-mails em andamento).
- **Antes de publicar `kartodromo-site-2026` ou `kartodromo-reservas-2026`: leia
  `docs/operacao/patches-producao/README.md`.** Política de reembolso com aceite e "uma vaga por pessoa" foram aplicadas
  direto nos pacotes em produção (09/10); publicar o código-fonte sem elas tira essas mudanças do ar.

## Site institucional

PRECISAMOS REFAZER COMPLETAMENTE O SITE https://www.kartodromodebetim.com.br
