// Pedido de permissão que as TVs LG (webOS) mostram na 1ª conexão ("Placar Kartódromo"). O tv-lg-abrir.mjs e o
// tv-lg-vigia.mjs usam O MESMO: se as permissões mudarem, a TV pede ACEITAR de novo.
// Só abrir apps/endereços, ler o app na tela e saber se a TV está ligada (nada de volume, canais etc.).
const PERMISSOES = ['LAUNCH', 'LAUNCH_WEBAPP', 'APP_TO_APP', 'READ_RUNNING_APPS', 'READ_INSTALLED_APPS', 'READ_POWER_STATE'];

export const manifesto = {
  manifestVersion: 1, appVersion: '1.0',
  signed: { appId: 'br.com.kartodromodebetim.placar', created: '20261009', localizedAppNames: { '': 'Placar Kartódromo' }, localizedVendorNames: { '': 'Kartódromo Internacional de Betim' }, permissions: PERMISSOES, serial: 'kib-placar-2', vendorId: 'br.com.kartodromodebetim' },
  permissions: PERMISSOES,
  signatures: [{ signatureVersion: 1, signature: 'kib' }],
};
