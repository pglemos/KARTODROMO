/**
 * StateFlagBadge Component
 * Vector-based high performance flag badge for Brazilian states and nationalities.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface StateFlagBadgeProps {
  flag: string;
  size?: number;
}

export const StateFlagBadge = React.memo(function StateFlagBadge({
  flag,
}: StateFlagBadgeProps) {
  const code = (flag || '').toUpperCase();

  if (code === 'MG') {
    return (
      <View
        testID="flag-mg"
        accessibilityLabel="Bandeira de Minas Gerais"
        style={flagStyles.mgContainer}
      >
        <Text style={flagStyles.mgTriangle}>▲</Text>
      </View>
    );
  }

  if (code === 'SP') {
    return (
      <View
        testID="flag-sp"
        accessibilityLabel="Bandeira de São Paulo"
        style={flagStyles.spContainer}
      >
        <View style={flagStyles.spStripeWhite} />
        <View style={flagStyles.spStripeRed} />
      </View>
    );
  }

  if (code === 'RJ') {
    return (
      <View
        testID="flag-rj"
        accessibilityLabel="Bandeira do Rio de Janeiro"
        style={flagStyles.rjContainer}
      >
        <View style={flagStyles.rjBlueQuarter} />
      </View>
    );
  }

  if (code === 'BR') {
    return (
      <View
        testID="flag-br"
        accessibilityLabel="Bandeira do Brasil"
        style={flagStyles.brContainer}
      >
        <View style={flagStyles.brRhombus} />
      </View>
    );
  }

  // Fallback badge with code
  return (
    <View testID={`flag-${code.toLowerCase()}`} style={flagStyles.defaultContainer}>
      <Text style={flagStyles.defaultText}>{code}</Text>
    </View>
  );
});

const flagStyles = StyleSheet.create({
  mgContainer: {
    width: 17,
    height: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#D4D4D8',
    marginRight: 6,
  },
  mgTriangle: {
    color: '#EF4444',
    fontSize: 7,
    lineHeight: 8,
    textAlign: 'center',
    transform: [{ translateY: -0.5 }],
  },
  spContainer: {
    width: 17,
    height: 12,
    backgroundColor: '#000000',
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: '#3F3F46',
    overflow: 'hidden',
    justifyContent: 'space-around',
    marginRight: 6,
  },
  spStripeWhite: {
    height: 2,
    backgroundColor: '#FFFFFF',
  },
  spStripeRed: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 6,
    height: 6,
    backgroundColor: '#EF4444',
  },
  rjContainer: {
    width: 17,
    height: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: '#3F3F46',
    overflow: 'hidden',
    marginRight: 6,
  },
  rjBlueQuarter: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 6,
    backgroundColor: '#3B82F6',
  },
  brContainer: {
    width: 17,
    height: 12,
    backgroundColor: '#009B3A',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  brRhombus: {
    width: 7,
    height: 7,
    backgroundColor: '#FEDF00',
    transform: [{ rotate: '45deg' }],
  },
  defaultContainer: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    backgroundColor: '#27272A',
    marginRight: 6,
  },
  defaultText: {
    color: '#A1A1AA',
    fontSize: 9,
    fontWeight: '700',
  },
});

export default StateFlagBadge;
