# Acesso antecipado (testadores do Play)

Página pública em `acesso.kartodromodebetim.com.br` com dois passos para o cliente:

1. Entrar no Grupo do Google `testadores-kartodromobetim@googlegroups.com` (entrada livre, dono `kartodromobetim@gmail.com`).
2. Aceitar o teste fechado (faixa **Alpha**) do app cliente e instalar.

O grupo é o testador da faixa Alpha de `br.com.kartodromobetim.app`. Ninguém precisa aprovar.

- `/?equipe` também mostra o app da **Operação**. Essa faixa continua com lista fechada de e-mails (equipe), não usa o grupo aberto.
- CPF e senha não são coletados aqui: a conta é criada no app.

## Limitações conhecidas

- A API do Play recusa alterar testadores dessas faixas ("upgraded to use open or closed testing"); a troca foi feita pelo console.
- Faixa interna não aceita Grupo do Google; por isso o link usa a faixa Alpha.
- No console, lista de e-mails e Grupo do Google são exclusivos por faixa.
- Mudanças de testadores passam por revisão do Google antes de valer.

## Publicar

```bash
npx wrangler deploy -c workers/acesso-testadores/wrangler.jsonc
```

## Testes

```bash
npx vitest run --config vitest.config.ts --root workers/acesso-testadores
```
