import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/global.css';
import './styles/components.css';
import './styles/library.css';
import './styles/add-book.css';
import './styles/reader.css';
import './styles/sentence.css';
import './styles/settings.css';
import './styles/ai.css';
import './styles/chat.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('JEPUB root element is missing.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
