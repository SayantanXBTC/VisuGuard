import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Edith from './components/Edith.jsx';
import './styles.css';

// Edith (the assistant) sits outside App, so she is on every screen: home, sign in, dashboard.
createRoot(document.getElementById('root')).render(
  <>
    <App />
    <Edith />
  </>,
);
