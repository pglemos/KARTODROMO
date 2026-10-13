import { fireEvent, renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import LandingRoute from '../src/app/index';
import HomeScreen from '../src/components/home-screen';

function AgendaScreen() {
  return <Text>Agenda da pista</Text>;
}

function LoginScreen() {
  return <Text>Entrar na conta</Text>;
}

test('home offers battery booking, agenda and login', async () => {
  const view = await renderRouter({
    index: LandingRoute,
    '(tabs)/index': HomeScreen,
    '(tabs)/agenda': AgendaScreen,
    '(auth)/login': LoginScreen,
  }, { initialUrl: '/' });

  expect(view.getByText('Reservar bateria')).toBeTruthy();
  expect(view.getByText('Entrar')).toBeTruthy();
  await fireEvent.press(view.getByText('Agenda'));
  expect(await view.findByText('Agenda da pista')).toBeTruthy();
});
