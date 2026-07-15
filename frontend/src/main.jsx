import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AutomaticGlossaryCoverage from './components/common/AutomaticGlossaryCoverage';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AutomaticGlossaryCoverage />
    <App />
  </React.StrictMode>
);
