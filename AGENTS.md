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

## Site institucional

PRECISAMOS REFAZER COMPLETAMENTE O SITE https://www.kartodromodebetim.com.br
