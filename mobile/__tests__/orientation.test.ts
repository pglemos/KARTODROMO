import { readFileSync } from 'node:fs';

describe('orientação do app e do cockpit', () => {
  it('alterna a orientação pelo segmento ativo sem lock global conflitante', () => {
    const cockpit = readFileSync('src/components/cockpit-real.tsx', 'utf8');
    const layout = readFileSync('src/app/_layout.tsx', 'utf8');
    const plist = readFileSync('ios/KartdromodeBetim/Info.plist', 'utf8');
    const config = JSON.parse(readFileSync('app.json', 'utf8')) as { expo: { orientation: string } };

    expect(cockpit).not.toMatch(/ScreenOrientation|lockAsync/);
    expect(layout).toMatch(/segments\.includes\('cockpit'\)/);
    expect(layout).toMatch(/ScreenOrientation\.lockAsync\(emCockpit \? ScreenOrientation\.OrientationLock\.LANDSCAPE : ScreenOrientation\.OrientationLock\.PORTRAIT_UP\)/);
    expect(layout).not.toMatch(/orientation: '(?:portrait|landscape)'/);
    expect(config.expo.orientation).toBe('default');
    expect(plist).toContain('UIInterfaceOrientationLandscapeLeft');
    expect(plist).toContain('UIInterfaceOrientationLandscapeRight');
  });
});
