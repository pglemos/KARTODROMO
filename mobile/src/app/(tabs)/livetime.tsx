import { Text, View } from 'react-native';

import { AoVivoReal } from '../../components/ao-vivo-real';
import { useLiveSession } from '../../features/live/api';
import { ActionButton, InlineError, LoadingMessage, Page, PageHeader, Panel, useUi } from '../../features/reservations/components';

/** Loja: a bateria que está na pista agora (ou a última que terminou), direto da cronometragem. */
export default function LiveTimeTab() {
  const { session, error, loading, refresh } = useLiveSession();
  const { styles } = useUi();
  if (session) return <AoVivoReal session={session} onRefresh={refresh} refreshError={error} />;
  return (
    <Page>
      <PageHeader title="Ao vivo" description="Posições, voltas e tempos da bateria que está na pista, direto da cronometragem." />
      {loading ? <LoadingMessage label="Conectando à cronometragem…" /> : null}
      {!loading && error ? <View style={{ gap: 12 }}><InlineError message={error} /><ActionButton label="Tentar novamente" onPress={() => void refresh()} secondary /></View> : null}
      {!loading && !error ? (
        <Panel>
          <Text style={styles.muted}>Nenhuma bateria na pista agora. Quando a próxima largar, ela aparece aqui sozinha.</Text>
        </Panel>
      ) : null}
    </Page>
  );
}
