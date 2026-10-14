import { Link } from 'expo-router';
import { Image, TouchableOpacity, Text, View, useWindowDimensions } from 'react-native';

import { Brand, Icon } from './brand';
import { useUi } from './theme';
import { Page } from '../features/reservations/components';

const destinations = [
  { href: '/(tabs)/agenda', icon: 'calendar', title: 'Agenda da pista', detail: 'Horários e disponibilidade' },
  { href: '/(tabs)/reservas', icon: 'ticket', title: 'Minhas reservas', detail: 'Acompanhe seus pedidos' },
  { href: '/(tabs)/resultados', icon: 'results', title: 'Meu histórico', detail: 'Resultados oficiais da sua conta' },
  { href: '/(tabs)/gps', icon: 'gps', title: 'Treino GPS', detail: 'Cronometragem pessoal' },
] as const;

export default function HomeScreen() {
  const { palette, styles } = useUi();
  const photoWidth = Math.min(useWindowDimensions().width, 600) - 40;
  return (
    <Page>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <Brand width={234} />
        <Link href="/(tabs)/reservas" asChild>
          <TouchableOpacity activeOpacity={0.65} accessibilityRole="link" accessibilityLabel="Minha conta" style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="account" color={palette.accent} size={28} />
          </TouchableOpacity>
        </Link>
      </View>
      <Image source={require('../../assets/betim-track.jpg')} accessibilityLabel="Karts na pista do Kartódromo Internacional de Betim" resizeMode="cover"
        style={{ width: photoWidth, height: photoWidth / 1.9, borderRadius: 12, marginBottom: 20 }} />
      <Text style={styles.title}>Seu próximo encontro com a pista.</Text>
      <Text style={[styles.description, { marginBottom: 20 }]}>Reserve sua bateria e acompanhe cada volta em Betim.</Text>
      <Link href="/(tabs)/agenda" asChild>
        <TouchableOpacity activeOpacity={0.65} accessibilityRole="button" accessibilityHint="Abre os horários disponíveis para reserva." style={styles.action}>
          <Text style={styles.actionText}>Reservar bateria</Text>
        </TouchableOpacity>
      </Link>
      <View style={{ marginTop: 16 }}>
        {destinations.map((item) => (
          <Link key={item.href} href={item.href} asChild>
            <TouchableOpacity activeOpacity={0.65} accessibilityRole="link" style={styles.row}>
              <Icon name={item.icon} color={palette.accent} />
              <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowDetail}>{item.detail}</Text></View>
              <Icon name="chevron" color={palette.muted} size={18} />
            </TouchableOpacity>
          </Link>
        ))}
      </View>
    </Page>
  );
}
