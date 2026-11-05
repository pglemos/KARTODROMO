import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { CartProvider, useCart } from '../src/features/cart/context';
import type { SessionTokens } from '../src/api/contracts';

let mockSession: SessionTokens | null = null;
jest.mock('../src/session/provider', () => ({ useSessionSafe: () => ({ session: mockSession }) }));
let cart: ReturnType<typeof useCart>;
function Consumer() { cart = useCart(); return <Text>{cart.totalQuantity}</Text>; }
const item = { sessionId: '1', sessionTitle: 'TESTE CODEX', trackName: 'BETIM', date: '20/10/2026', time: '10:00', quantity: 1, unitPriceCentavos: 10000 };

beforeEach(() => { mockSession = null; });

it.each([
  { ...item, quantity: 1.5 }, { ...item, quantity: NaN },
  { ...item, unitPriceCentavos: -1 }, { ...item, unitPriceCentavos: Infinity },
  { ...item, quantity: 2, unitPriceCentavos: Number.MAX_SAFE_INTEGER },
])('ignora valores inválidos sem contaminar o total: %j', async (invalid) => {
  await render(<CartProvider><Consumer /></CartProvider>);
  await act(async () => cart.addItem(invalid));
  expect(cart.items).toEqual([]);
  expect(cart.totalPriceFormatted).toBe('R$ 0,00');
});

it('não aceita quantidade fracionária na atualização', async () => {
  await render(<CartProvider><Consumer /></CartProvider>);
  await act(async () => cart.addItem(item));
  await act(async () => cart.updateQuantity('1', 1.5));
  expect(cart.totalQuantity).toBe(1);
});

it('não ultrapassa a capacidade depois de adicionar a mesma bateria novamente', async () => {
  await render(<CartProvider><Consumer /></CartProvider>);
  const limited = { ...item, maxQuantity: 2 };
  await act(async () => cart.addItem(limited));
  await act(async () => cart.addItem({ ...limited, quantity: 2 }));
  expect(cart.totalQuantity).toBe(1);
  await act(async () => cart.updateQuantity('1', 3));
  expect(cart.totalQuantity).toBe(1);
});

it('limpa o carrinho e o drawer quando a sessão muda', async () => {
  const view = await render(<CartProvider><Consumer /></CartProvider>);
  await act(async () => { cart.addItem(item); cart.openCart(); });
  mockSession = { accessToken: 'TESTE CODEX', refreshToken: 'TESTE CODEX', accessTokenExpiresAt: '', refreshTokenExpiresAt: '' };
  await view.rerender(<CartProvider><Consumer /></CartProvider>);
  expect(cart.totalQuantity).toBe(0);
  expect(cart.isCartOpen).toBe(false);
});
