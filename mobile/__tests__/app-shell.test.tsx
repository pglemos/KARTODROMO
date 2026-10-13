import { fireEvent, renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import HomeScreen from '../src/app/index';

function AgendaScreen() {
  return <Text>Agenda da pista</Text>;
}

function LoginScreen() {
  return <Text>Entrar na conta</Text>;
}

test('home offers battery booking, agenda and login', async () => {
  const view = await renderRouter({
    index: HomeScreen,
    '(tabs)/agenda': AgendaScreen,
    '(auth)/login': LoginScreen,
  });

  expect(view.getByText('Reservar bateria')).toBeTruthy();
  expect(view.getByText('Entrar')).toBeTruthy();
  await fireEvent.press(view.getByText('Agenda'));
  expect(await view.findByText('Agenda da pista')).toBeTruthy();
});
