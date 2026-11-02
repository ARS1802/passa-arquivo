/**
 * Responsabilidade: Montar o componente App no elemento root e carregar os estilos globais.
 *
 * Exemplo prático: Ao abrir a página, React renderiza a tela inicial dentro da div root
 * definida em index.html.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
