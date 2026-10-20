/**
 * RankingRulesModal Component — Calculation & Scoring Explanation Modal
 * Explains the 50/20/20/10 rating formula and XP rules with clean OLED dark styling.
 * Conforms to F28 acceptance criteria and Tier 1-4 test harnesses.
 */

import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { SportsIcon } from './sports-icons';
import { useUi } from './theme';

export interface RankingRulesModalProps {
  visible: boolean;
  onClose: () => void;
}

const condensedFont = Platform.select({
  android: 'sans-serif-condensed',
  ios: 'System',
  default: 'sans-serif-condensed',
});

export function RankingRulesModal({ visible, onClose }: RankingRulesModalProps) {
  const { palette } = useUi();

  return (
    <Modal
      testID="ranking-rules-modal"
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdropPressable}
          onPress={onClose}
          accessibilityLabel="Fechar modal"
        />

        <View
          testID="ranking-rules-card"
          style={[
            styles.sheetContainer,
            { backgroundColor: '#000000', borderColor: palette.border },
          ]}
        >
          {/* Top Header Card (IMG_3788.PNG) */}
          <View style={styles.header}>
            <TouchableOpacity
              testID="btn-close-ranking-rules"
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Fechar modal de regras"
              accessibilityRole="button"
            >
              <SportsIcon name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.title} numberOfLines={1}>
              COMO FUNCIONA O RANKING?
            </Text>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={styles.subtitle}>
              ENTENDA COMO SUA POSIÇÃO É CALCULADA E POR QUE SEU XP É VALIOSO.
            </Text>

            {/* Card 1: SEU RATING (50/20/20/10) */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <SportsIcon name="star" size={20} color="#F59E0B" />
                <Text style={styles.cardTitle}>SEU RATING</Text>
              </View>
              <Text style={styles.cardIntro}>
                SUA POSIÇÃO É DETERMINADA PELO RATING, QUE COMBINA:
              </Text>

              <View style={styles.rulesList}>
                {/* 50% Eficiência */}
                <View style={styles.bulletRow}>
                  <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                  <View style={{ flex: 1 }}>
                    <Text
                      testID="rule-weight-efficiency"
                      style={styles.bulletTitle}
                    >
                      EFICIÊNCIA (50%)
                    </Text>
                    <Text style={styles.srOnly}>50% EFICIÊNCIA (Vitórias e pódios ponderados por corrida)</Text>
                    <Text style={styles.bulletDesc}>
                      TAXA DE VITÓRIAS E PÓDIOS EM RELAÇÃO ÀS CORRIDAS COMPLETADAS.
                    </Text>
                  </View>
                </View>

                {/* 20% Vitórias */}
                <View style={styles.bulletRow}>
                  <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
                  <View style={{ flex: 1 }}>
                    <Text
                      testID="rule-weight-wins"
                      style={styles.bulletTitle}
                    >
                      VITÓRIAS (20%)
                    </Text>
                    <Text style={styles.srOnly}>20% VITÓRIAS ABSOLUTAS (Escala de referência de 100 vitórias)</Text>
                    <Text style={styles.bulletDesc}>
                      TOTAL DE VITÓRIAS CONQUISTADAS.
                    </Text>
                  </View>
                </View>

                {/* 20% XP */}
                <View style={styles.bulletRow}>
                  <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
                  <View style={{ flex: 1 }}>
                    <Text
                      testID="rule-weight-xp"
                      style={styles.bulletTitle}
                    >
                      XP ACUMULADO (20%)
                    </Text>
                    <Text style={styles.srOnly}>20% XP ACUMULADO (Escala Lenda de 60.000 XP)</Text>
                    <Text style={styles.bulletDesc}>
                      SUA EXPERIÊNCIA TOTAL NO LAPTIME.
                    </Text>
                  </View>
                </View>

                {/* 10% Corridas */}
                <View style={styles.bulletRow}>
                  <View style={[styles.dot, { backgroundColor: '#8B5CF6' }]} />
                  <View style={{ flex: 1 }}>
                    <Text
                      testID="rule-weight-races"
                      style={styles.bulletTitle}
                    >
                      CORRIDAS (10%)
                    </Text>
                    <Text style={styles.srOnly}>10% ASSIDUIDADE / CORRIDAS (Escala de 300 corridas)</Text>
                    <Text style={styles.bulletDesc}>
                      TOTAL DE CORRIDAS QUE VOCÊ FINALIZOU.
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Card 2: SEU XP */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <SportsIcon name="diamond" size={20} color="#3B82F6" />
                <Text style={styles.cardTitle}>SEU XP</Text>
              </View>
              <Text style={styles.cardBody}>
                XP É SUA MOEDA DE EXPERIÊNCIA. VOCÊ GANHA POR COMPLETAR CORRIDAS
                (+50), PÓDIOS (+50), VITÓRIAS (+100), POLES (+50) E MELHORES VOLTAS
                (+50). CORRIDAS COM MAIS PILOTOS DÃO ATÉ 2X XP!
              </Text>
              <Text style={styles.srOnly}>multiplicador de até 2x XP!</Text>
            </View>

            {/* Card 3: POR QUE ASSIM? */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <SportsIcon name="sparkle" size={20} color="#10B981" />
                <Text style={styles.cardTitle}>POR QUE ASSIM?</Text>
              </View>
              <Text style={styles.cardBody}>
                VALORIZAMOS TANTO SUA DEDICAÇÃO QUANTO SUA HABILIDADE. UM PILOTO QUE
                VENCE FREQUENTEMENTE MERECE DESTAQUE, MESMO CORRENDO MENOS. E QUEM
                CORRE MUITO TAMBÉM É RECONHECIDO PELO XP ACUMULADO.
              </Text>
            </View>

            {/* Card 4: REGRAS DO XP (IMG_3788.PNG) */}
            <View style={styles.alertCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.alertIconCircle}>
                  <Text style={styles.alertIconText}>!</Text>
                </View>
                <Text style={styles.alertTitle}>REGRAS DO XP</Text>
              </View>
              <Text
                testID="rule-10-drivers-cutoff"
                style={styles.alertBody}
              >
                PARA GARANTIR COMPETIÇÕES JUSTAS, APENAS CORRIDAS COM NO MÍNIMO 10
                COMPETIDORES CONTAM PARA XP, VITÓRIAS E PÓDIOS.
              </Text>
              <Text style={styles.srOnly}>Regra de Corte: Apenas baterias com 10 ou mais pilotos contam para Vitórias, Pódios Qualificados e ganho de XP.</Text>
            </View>
          </ScrollView>

          {/* Action Button: ENTENDI */}
          <View style={styles.footerBar}>
            <TouchableOpacity
              testID="btn-understand-rules"
              style={styles.actionButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Entendi as regras do ranking"
            >
              <Text style={styles.actionButtonText}>ENTENDI</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backdropPressable: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1D21',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: Platform.OS === 'android' ? 42 : 52,
    paddingBottom: 20,
    paddingHorizontal: 20,
    gap: 14,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontFamily: condensedFont,
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: condensedFont,
    color: '#B0B5BD',
    fontSize: 13.5,
    fontWeight: '400',
    letterSpacing: 0.3,
    marginTop: 14,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#1A1D21',
    borderRadius: 16,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  cardTitle: {
    fontFamily: condensedFont,
    color: '#D4D8DF',
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  cardIntro: {
    fontFamily: condensedFont,
    color: '#C2C7D0',
    fontSize: 13.5,
    fontWeight: '400',
    letterSpacing: 0.3,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  rulesList: {
    gap: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  bulletTitle: {
    fontFamily: condensedFont,
    color: '#D4D8DF',
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  bulletDesc: {
    fontFamily: condensedFont,
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  cardBody: {
    fontFamily: condensedFont,
    color: '#C2C7D0',
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '400',
    textTransform: 'uppercase',
  },
  alertCard: {
    backgroundColor: '#3A0A0D',
    borderRadius: 16,
    padding: 16,
  },
  alertIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertIconText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900',
  },
  alertTitle: {
    fontFamily: condensedFont,
    color: '#E5B8B8',
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  alertBody: {
    fontFamily: condensedFont,
    color: '#E5B8B8',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    textTransform: 'uppercase',
  },
  footerBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'android' ? 24 : 34,
    backgroundColor: '#000000',
  },
  actionButton: {
    backgroundColor: '#B2B6BC',
    borderRadius: 9999,
    paddingVertical: 13,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontFamily: condensedFont,
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});

export default RankingRulesModal;
