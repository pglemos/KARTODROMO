import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { idiomaInicial, ligarIngles } from './i18n';
import { capturarNoNavegador } from '../../../src/config/atribuicao';

// de onde veio (UTM, fbclid, gclid): cookie do domínio que o /api/reservas lê ao criar o pedido
capturarNoNavegador(window);

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
if (idiomaInicial() === 'en') ligarIngles();
