import { Redirect } from 'expo-router';

/** Carrinho demonstrativo removido; a reserva real começa na Agenda. */
export default function CarrinhoLegacyRoute() {
  return <Redirect href="/(tabs)/agenda" />;
}
