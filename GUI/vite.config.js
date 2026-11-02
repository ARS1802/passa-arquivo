/**
 * Responsabilidade: Configurar o Vite com o plugin React para desenvolvimento e build da
 * GUI.
 *
 * Exemplo prático: Ao executar npm run build:gui, o Vite usa esta configuração para
 * processar App.jsx.
 */
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
