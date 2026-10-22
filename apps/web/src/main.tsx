import React from 'react';import ReactDOM from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';import './lib/i18n';
import {AuthProvider,AccountBoundary} from './lib/auth';import App from './App';import './style.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AuthProvider><BrowserRouter><AccountBoundary><App/></AccountBoundary></BrowserRouter></AuthProvider></React.StrictMode>);
