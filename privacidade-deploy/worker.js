// kartodromo-privacidade: só arquivos estáticos (política de privacidade e exclusão de conta do app).
export default { fetch: (req, env) => env.ASSETS.fetch(req) };
