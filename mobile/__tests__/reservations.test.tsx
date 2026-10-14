import { act, render, userEvent, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import type { PropsWithChildren } from 'react';
import { Alert, Text } from 'react-native';

import AgendaScreen from '../src/app/(tabs)/agenda';
import ReservationsScreen from '../src/app/(tabs)/reservas';
import ReservationDetailScreen from '../src/app/reservations/[id]';
import ActualLoginScreen from '../src/app/(auth)/login';
import type { AgendaResponse, ReservationOrder } from '../src/features/reservations/schemas';
import { useSession } from '../src/session/provider';

const mockRouter = { push: jest.fn(), replace: jest.fn() };
const mockUseLocalSearchParams = jest.fn();

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('../src/session/provider', () => ({ useSession: jest.fn() }));
jest.mock('expo-router', () => ({
  Link: ({ children }: PropsWithChildren) => children,
  router: {
    push: (...args: unknown[]) => mockRouter.push(...args),
    replace: (...args: unknown[]) => mockRouter.replace(...args),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

const accessToken = `test-${crypto.randomUUID()}`;
const session = {
  accessToken,
  refreshToken: `test-${crypto.randomUUID()}`,
  accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
};
const agenda: AgendaResponse = {
  atualizadoEm: '2026-10-12T12:00:00.000Z',
  precoCentavos: 14500,
  maxPilotos: 10,
  prazoMin: 15,
  antecedenciaMin: 120,
  pagamentoOnline: true,
  horarios: [{ id: 101, inicio: '2026-10-15T09:15', nome: 'BATERIA 09:15', livres: 4 }],
};
const order: ReservationOrder = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  codigo: 'BETIM-101',
  status: 'aguardando_pagamento',
  forma: 'pix',
  quantidade: 1,
  nome: 'Ana',
  descricao: 'BATERIA 09:15',
  inicio: '2026-10-15T09:15',
  valorCentavos: 9500,
  expiraEm: '2026-10-15T09:30:00-03:00',
  pix: { payload: 'pix-copia-e-cola', imagem: 'base64-qr' },
  invoiceUrl: null,
  preparandoPagamento: false,
  erro: null,
  criadoEm: '2026-10-12T12:00:00.000Z',
};

const originalFetch = globalThis.fetch;
let fetchMock: jest.Mock<Promise<Response>, [input: URL | RequestInfo, init?: RequestInit]>;
let agendaUnavailable = false;
let listedOrders: ReservationOrder[] = [];

function apiResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function requests(method: string, pathname: string) {
  return fetchMock.mock.calls.filter(([url, options]) =>
    new URL(String(url)).pathname === pathname && (options?.method ?? 'GET') === method,
  );
}

function LoginScreen() {
  return <Text>Entrar na conta</Text>;
}

function setSession(value: typeof session | null) {
  const logout = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
  jest.mocked(useSession).mockReturnValue({
    session: value,
    isLoading: false,
    login: jest.fn(),
    logout,
    refresh: jest.fn(),
  });
  return logout;
}

beforeEach(() => {
  jest.clearAllMocks();
  setSession(null);
  mockUseLocalSearchParams.mockReturnValue({});
  agendaUnavailable = false;
  listedOrders = [];
  fetchMock = jest.fn(async (input, init) => {
    const pathname = new URL(String(input)).pathname;
    const method = init?.method ?? 'GET';
    if (pathname === '/api/mobile/v1/agenda' && agendaUnavailable) throw new Error('network unavailable');
    if (pathname === '/api/mobile/v1/agenda') return apiResponse(agenda);
    if (pathname === '/api/mobile/v1/coupons/preview' && method === 'POST') return apiResponse({ requestId: 'preview-1' });
    if (pathname === '/api/mobile/v1/coupons/preview/preview-1') {
      return apiResponse({ status: 'completed', brutoCentavos: 14500, descontoCentavos: 5000, totalCentavos: 9500 });
    }
    if (pathname === '/api/mobile/v1/reservations' && method === 'POST') return apiResponse({ id: order.id, codigo: order.codigo });
    if (pathname === '/api/mobile/v1/reservations') return apiResponse(listedOrders);
    if (pathname === `/api/mobile/v1/reservations/${order.id}`) return apiResponse(order);
    throw new Error(`Unexpected request ${method} ${pathname}`);
  });
  globalThis.fetch = fetchMock as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('agenda e reservas do cliente', () => {
  it.each(['101', 'https://outside.example', '-1', '1.5'])('retorna somente ao horário interno válido após login: %s', async (bateriaId) => {
    const login = jest.fn().mockResolvedValue(undefined);
    jest.mocked(useSession).mockReturnValue({ ...jest.mocked(useSession)(), login });
    mockUseLocalSearchParams.mockReturnValue({ bateriaId });
    const view = await render(<ActualLoginScreen />);
    const user = userEvent.setup();
    await user.type(view.getByLabelText('E-mail ou CPF'), 'piloto@example.test');
    await user.type(view.getByLabelText('Senha'), 'test-only-password');
    await user.press(view.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(bateriaId === '101'
      ? { pathname: '/(tabs)/reservas', params: { bateriaId: '101' } } : '/'));
  });
  it('não navega para pedido atrasado depois de sair da conta', async () => {
    let finishCreate!: (response: Response) => void;
    const previous = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) =>
      init?.method === 'POST' && new URL(String(input)).pathname === '/api/mobile/v1/reservations'
        ? new Promise<Response>((resolve) => { finishCreate = resolve; }) : previous(input, init),
    );
    setSession(session);
    mockUseLocalSearchParams.mockReturnValue({ bateriaId: '101' });
    const view = await render(<ReservationsScreen />);
    const user = userEvent.setup();
    await view.findByText('BATERIA 09:15');
    await user.type(view.getByLabelText('Data de nascimento do responsável'), '15051990');
    expect(view.getByLabelText('Data de nascimento do responsável').props.value).toBe('15/05/1990');
    await user.press(view.getByLabelText('Aceito a política de cancelamento'));
    await user.press(view.getByRole('button', { name: 'Enviar reserva' }));
    await waitFor(() => expect(finishCreate).toBeDefined());
    setSession(null);
    await view.rerender(<ReservationsScreen />);
    await act(async () => finishCreate(apiResponse({ id: order.id, codigo: order.codigo })));
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(view.getByText('Entre para reservar')).toBeTruthy();
  });
  it('limpa detalhes e Pix ao trocar de conta mesmo se a nova consulta falhar', async () => {
    setSession(session);
    mockUseLocalSearchParams.mockReturnValue({ id: order.id });
    const view = await render(<ReservationDetailScreen />);
    expect(await view.findByText(order.pix!.payload)).toBeTruthy();
    fetchMock.mockImplementation(async () => ({ ok: false, status: 403, json: async () => ({ error: 'Sem acesso' }) }) as Response);
    setSession({ ...session, accessToken: 'next-account' });
    await view.rerender(<ReservationDetailScreen />);
    expect(view.queryByText(order.pix!.payload)).toBeNull();
    expect(await view.findByText('Não foi possível carregar')).toBeTruthy();
  });

  it('ignora detalhes atrasados da conta anterior', async () => {
    let finishOld!: (response: Response) => void;
    const oldResponse = new Promise<Response>((resolve) => { finishOld = resolve; });
    fetchMock.mockImplementation(async (_, init) =>
      new Headers(init?.headers).get('authorization') === `Bearer ${session.accessToken}`
        ? oldResponse : apiResponse({ ...order, codigo: 'BETIM-NOVA-CONTA', pix: null }),
    );
    setSession(session);
    mockUseLocalSearchParams.mockReturnValue({ id: order.id });
    const view = await render(<ReservationDetailScreen />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    setSession({ ...session, accessToken: 'next-account' });
    await view.rerender(<ReservationDetailScreen />);
    expect(await view.findByText('Pedido BETIM-NOVA-CONTA')).toBeTruthy();
    await act(async () => finishOld(apiResponse(order)));
    expect(view.queryByText(order.pix!.payload)).toBeNull();
    expect(view.getByText('Pedido BETIM-NOVA-CONTA')).toBeTruthy();
  });
  it('permite sair da conta pela lista e pelo formulário de reserva', async () => {
    const logout = setSession(session);
    const view = await render(<ReservationsScreen />);
    const user = userEvent.setup();
    await user.press(view.getByRole('button', { name: 'Sair da conta' }));
    expect(logout).toHaveBeenCalledTimes(1);

    mockUseLocalSearchParams.mockReturnValue({ bateriaId: '101' });
    await view.rerender(<ReservationsScreen />);
    expect(await view.findByText('Confirmar reserva')).toBeTruthy();
    await user.press(view.getByRole('button', { name: 'Sair da conta' }));
    expect(logout).toHaveBeenCalledTimes(2);
  });

  it('oferece nova tentativa se não conseguir apagar a sessão salva', async () => {
    const logout = setSession(session);
    logout.mockRejectedValueOnce(new Error('storage unavailable'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const view = await render(<ReservationsScreen />);
    await userEvent.setup().press(view.getByRole('button', { name: 'Sair da conta' }));
    await waitFor(() => expect(alert).toHaveBeenCalled());
    const retry = alert.mock.calls[0][2]?.find((button) => button.text === 'Tentar novamente');
    expect(retry?.onPress).toBeDefined();
    await act(async () => retry?.onPress?.());
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(2));
  });

  it('esconde imediatamente as reservas anteriores ao trocar de conta', async () => {
    setSession(session);
    listedOrders = [order];
    const view = await render(<ReservationsScreen />);
    expect(await view.findByText(order.codigo)).toBeTruthy();
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
    setSession({ ...session, accessToken: `test-next-${crypto.randomUUID()}` });
    await view.rerender(<ReservationsScreen />);
    expect(view.queryByText(order.codigo)).toBeNull();
  });

  it('ignora reservas recebidas depois que a conta de origem saiu', async () => {
    let finishOld!: (response: Response) => void;
    const oldResponse = new Promise<Response>((resolve) => { finishOld = resolve; });
    const nextSession = { ...session, accessToken: `test-next-${crypto.randomUUID()}` };
    const nextOrder = { ...order, codigo: 'BETIM-NOVA-CONTA' };
    fetchMock.mockImplementation(async (_, init) =>
      (init?.headers as Record<string, string>)?.authorization === `Bearer ${session.accessToken}`
        ? oldResponse : apiResponse([nextOrder]),
    );
    setSession(session);
    const view = await render(<ReservationsScreen />);
    await waitFor(() => expect(requests('GET', '/api/mobile/v1/reservations')).toHaveLength(1));
    setSession(nextSession);
    await view.rerender(<ReservationsScreen />);
    expect(await view.findByText(nextOrder.codigo)).toBeTruthy();
    await act(async () => finishOld(apiResponse([order])));
    expect(view.getByText(nextOrder.codigo)).toBeTruthy();
    expect(view.queryByText(order.codigo)).toBeNull();
  });

  it('carrega a agenda sem login e exige conta antes de abrir a reserva', async () => {
    const view = await render(<AgendaScreen />);

    expect(await view.findByText('BATERIA 09:15')).toBeTruthy();
    expect(view.getByText('15/10/2026 · 09:15')).toBeTruthy();
    expect(requests('GET', '/api/mobile/v1/agenda').length).toBeGreaterThan(0);
    const user = userEvent.setup();
    await user.press(view.getByRole('button', { name: /reservar/i }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/(auth)/login', params: { bateriaId: '101' } });
    expect(requests('POST', '/api/mobile/v1/reservations')).toHaveLength(0);
  });

  it('oferece nova tentativa quando a agenda cai por falta de conexão', async () => {
    agendaUnavailable = true;
    const view = await render(<AgendaScreen />);

    expect(await view.findByText('Sem conexão. Confira a internet e tente novamente.')).toBeTruthy();
    const callsBeforeRetry = requests('GET', '/api/mobile/v1/agenda').length;
    agendaUnavailable = false;
    const user = userEvent.setup();
    await user.press(view.getByRole('button', { name: 'Tentar novamente' }));
    expect(await view.findByText('BATERIA 09:15')).toBeTruthy();
    expect(requests('GET', '/api/mobile/v1/agenda')).toHaveLength(callsBeforeRetry + 1);
  });

  it('usa somente o total de cupom calculado pelo servidor e envia a reserva autenticada', async () => {
    setSession(session);
    mockUseLocalSearchParams.mockReturnValue({ bateriaId: '101' });
    const user = userEvent.setup();
    const view = await render(<ReservationsScreen />);

    expect(await view.findByText('Confirmar reserva')).toBeTruthy();
    expect(view.queryByText('R$ 95,00')).toBeNull();
    await user.type(view.getByLabelText('Cupom de desconto'), 'BETIM10');
    expect(view.getByLabelText('Cupom de desconto').props.value).toBe('BETIM10');
    const couponButton = view.getByRole('button', { name: 'Validar cupom' });
    await user.press(couponButton);
    await waitFor(() => expect(requests('POST', '/api/mobile/v1/coupons/preview')).toHaveLength(1));
    const [couponRequest] = requests('POST', '/api/mobile/v1/coupons/preview');
    expect(couponRequest[1]?.headers).toMatchObject({ authorization: `Bearer ${accessToken}` });
    expect(JSON.parse(String(couponRequest[1]?.body))).toEqual({ codigo: 'BETIM10', bateriaId: 101, quantidade: 1 });
    expect(requests('GET', '/api/mobile/v1/coupons/preview/preview-1')).toHaveLength(1);
    expect(await view.findByText(/95,00/)).toBeTruthy();

    await user.type(view.getByLabelText('Data de nascimento do responsável'), '15/05/1990');
    await user.press(view.getByLabelText('Aceito a política de cancelamento'));
    await user.press(view.getByRole('button', { name: 'Enviar reserva' }));

    await waitFor(() => expect(requests('POST', '/api/mobile/v1/reservations')).toHaveLength(1));
    const [reservationRequest] = requests('POST', '/api/mobile/v1/reservations');
    expect(reservationRequest[1]?.headers).toMatchObject({ authorization: `Bearer ${accessToken}` });
    expect(reservationRequest[1]?.headers).toHaveProperty('idempotency-key', expect.stringMatching(/^mobile-/));
    expect(JSON.parse(String(reservationRequest[1]?.body))).toEqual(expect.objectContaining({
      bateriaId: 101, quantidade: 1, forma: 'pix', cupom: 'BETIM10', nascimento: '1990-05-15', politica: true,
    }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/reservations/[id]', params: { id: order.id } });
  });

  it('copia o Pix retornado pelo servidor e lista apenas reservas da conta autenticada', async () => {
    setSession(session);
    listedOrders = [order];
    const user = userEvent.setup();
    const listView = await render(<ReservationsScreen />);
    expect(await listView.findByText('BETIM-101')).toBeTruthy();
    const [listRequest] = requests('GET', '/api/mobile/v1/reservations');
    expect(listRequest[1]?.headers).toMatchObject({ authorization: `Bearer ${accessToken}` });

    mockUseLocalSearchParams.mockReturnValue({ id: order.id });
    const detailView = await render(<ReservationDetailScreen />);
    expect(await detailView.findByText('Aguardando pagamento')).toBeTruthy();
    expect(detailView.getByText(/95,00/)).toBeTruthy();
    await user.press(detailView.getByRole('button', { name: 'Copiar código Pix' }));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith('pix-copia-e-cola'));
  });

  it('não consulta reservas sem sessão de cliente', async () => {
    const view = await render(<ReservationsScreen />);
    expect(await view.findByText('Entre para ver suas reservas e acompanhar o pagamento.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
