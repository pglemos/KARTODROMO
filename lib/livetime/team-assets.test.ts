import { describe, expect, it } from 'vitest';
import { resolveTeamAsset, teamAssetSrc, teamCodeForDriver } from './team-assets';

describe('team assets', () => {
  it('resolves the full LiveTime names to the supplied position assets', () => {
    expect(resolveTeamAsset('GORILLAS TEAM RACING 1')?.imageBase).toBe('GORILLAS_TEAM');
    expect(resolveTeamAsset('FIREPIT/ APEX 2')?.imageBase).toBe('APEX_FIREPIT');
    expect(resolveTeamAsset('ZERO 27/AGUIA 6')?.imageBase).toBe('XZERO27');
    expect(resolveTeamAsset('ESQUADRÃO DO KART 3')?.imageBase).toBe('ESQUADRAO_DO_KART');
  });

  it('keeps Minas Racing distinct from Madruga Race Team', () => {
    expect(resolveTeamAsset('MINAS RACING 2')?.key).toBe('minas');
    expect(resolveTeamAsset('MADRUGA RACE TEAM 1')?.key).toBe('madruga');
  });

  it('does not guess an asset from a short API code', () => {
    expect(resolveTeamAsset('GT1')).toBeNull();
    expect(teamAssetSrc(resolveTeamAsset('KTS')!, 3)).toBe('/tb50/teams/KTS_P3.png');
  });

  it('keeps the compact entry code when LapTime returns a full team name', () => {
    expect(teamCodeForDriver({ name: 'FIREPIT/ APEX 1' })).toBe('FA1');
    expect(teamCodeForDriver({ name: 'ZERO27/AGUIA 2' })).toBe('ZE2');
    expect(teamCodeForDriver({ name: 'FA2', team: 'Firepit/ Apex 2' })).toBe('FA2');
  });
});
