import HomeScreen from '../../components/home-screen';
import StartScreen from '../../components/start-screen';
import { DEMO_MODE } from '../../config/features';

export default DEMO_MODE ? HomeScreen : StartScreen;
