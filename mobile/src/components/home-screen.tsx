import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const colors = {
  background: '#07110f',
  surface: '#111e1a',
  border: '#273b32',
  text: '#f2f5ed',
  muted: '#a5b2a8',
  accent: '#c9f36a',
};

export default function HomeScreen() {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brand}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>K</Text>
          </View>
          <View>
            <Text style={styles.brandName}>KARTÓDROMO</Text>
            <Text style={styles.brandLocation}>INTERNACIONAL DE BETIM</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.pill}>
            <View style={styles.pillDot} />
            <Text style={styles.pillText}>SUA EXPERIÊNCIA COMEÇA AQUI</Text>
          </View>
          <Text style={styles.title}>Garanta sua próxima bateria.</Text>
          <Text style={styles.description}>
            Consulte a agenda e escolha quando acelerar na pista de Betim.
          </Text>
          <Link href="/(tabs)/agenda" asChild>
            <Pressable
              accessibilityHint="Abre os horários disponíveis para reserva."
              accessibilityRole="button"
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Reservar bateria</Text>
              <Text accessibilityElementsHidden style={styles.arrow}>
                ↗
              </Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acompanhe o kartódromo</Text>
          <View style={styles.quickLinks}>
            <Link href="/(tabs)/agenda" asChild>
              <Pressable
                accessibilityHint="Mostra horários e disponibilidade das baterias."
                accessibilityRole="link"
                style={styles.quickLink}
              >
                <Text style={styles.quickLinkTitle}>Agenda</Text>
                <Text style={styles.quickLinkDescription}>
                  Horários e disponibilidade
                </Text>
              </Pressable>
            </Link>
            <Link href="/(tabs)/resultados" asChild>
              <Pressable
                accessibilityHint="Mostra resultados oficiais publicados e seu histórico validado."
                accessibilityRole="link"
                style={styles.quickLink}
              >
                <Text style={styles.quickLinkTitle}>Resultados</Text>
                <Text style={styles.quickLinkDescription}>
                  Classificações oficiais
                </Text>
              </Pressable>
            </Link>
            <Link href="/(auth)/login" asChild>
              <Pressable
                accessibilityHint="Entre para consultar suas reservas e cupons."
                accessibilityRole="link"
                style={styles.quickLink}
              >
                <Text style={styles.quickLinkTitle}>Entrar</Text>
                <Text style={styles.quickLinkDescription}>
                  Reservas e cupons
                </Text>
              </Pressable>
            </Link>
          </View>
        </View>

        <View style={styles.trackCard}>
          <View style={styles.trackAccent} />
          <View style={styles.trackCopy}>
            <Text style={styles.trackEyebrow}>KARTÓDROMO INTERNACIONAL</Text>
            <Text style={styles.trackTitle}>Betim, Minas Gerais</Text>
            <Text style={styles.trackDescription}>
              Encontre a próxima bateria e prepare-se para a pista.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 44,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  brandMarkText: {
    color: colors.background,
    fontSize: 25,
    fontWeight: '900',
  },
  brandName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  brandLocation: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.25,
    marginTop: 3,
  },
  hero: {
    paddingVertical: 28,
    paddingHorizontal: 22,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 20,
    backgroundColor: '#1c2b22',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  pillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  pillText: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 24,
  },
  description: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
    marginBottom: 24,
  },
  primaryButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 15,
    paddingHorizontal: 18,
    backgroundColor: colors.accent,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '800',
  },
  arrow: {
    color: colors.background,
    fontSize: 22,
    fontWeight: '700',
  },
  section: {
    marginTop: 30,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 13,
  },
  quickLinks: {
    flexDirection: 'row',
    gap: 12,
  },
  quickLink: {
    flex: 1,
    minHeight: 92,
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  quickLinkTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  quickLinkDescription: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  trackCard: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 20,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#0d1915',
  },
  trackAccent: {
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  trackCopy: {
    flex: 1,
  },
  trackEyebrow: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  trackTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 5,
  },
  trackDescription: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
});
