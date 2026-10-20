import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

const pagePath = fileURLToPath(new URL('./page.tsx', import.meta.url));

describe('política de privacidade do app', () => {
  it('explica dados, pagamentos, GPS local e os itens que ainda precisam de confirmação', async () => {
    expect(existsSync(pagePath)).toBe(true);
    const { default: PrivacyPage } = await import('./page');
    const markup = renderToStaticMarkup(PrivacyPage());

    expect(markup).toContain('Nome, CPF, e-mail e telefone');
    expect(markup).toContain('reservas e pagamentos');
    expect(markup).toContain('Asaas');
    expect(markup).toContain('GPS');
    expect(markup).toContain('primeiro plano');
    expect(markup).toContain('somente neste aparelho');
    expect(markup).toContain('contato@kartodromodebetim.com.br');
    expect(markup).toContain('prazo de retenção ainda precisa ser confirmado');
  });
});
