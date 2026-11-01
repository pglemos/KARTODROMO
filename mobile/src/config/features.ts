import React from 'react';
import { Redirect } from 'expo-router';

/**
 * Modo demonstração: telas com dados ilustrativos (src/mock) só existem em desenvolvimento.
 * Builds de loja nunca mostram dado fictício ("dado real ou nada").
 * EXPO_PUBLIC_DEMO_MODE=1 força ligado (builds internos de QA); =0 força desligado.
 */
export function isDemoMode(): boolean {
  if (process.env.EXPO_PUBLIC_DEMO_MODE === '1') return true;
  if (process.env.EXPO_PUBLIC_DEMO_MODE === '0') return false;
  return typeof __DEV__ !== 'undefined' && Boolean(__DEV__);
}

export const DEMO_MODE: boolean = isDemoMode();

/** Envolve uma tela que usa dado ilustrativo: fora do modo demo, redireciona para o início. */
export function demoOnly<P extends object>(Screen: React.ComponentType<P>): React.ComponentType<P> {
  function DemoOnlyScreen(props: P) {
    if (!isDemoMode()) return React.createElement(Redirect, { href: '/(tabs)' });
    return React.createElement(Screen, props);
  }
  DemoOnlyScreen.displayName = `demoOnly(${Screen.displayName ?? Screen.name ?? 'Screen'})`;
  return DemoOnlyScreen;
}
