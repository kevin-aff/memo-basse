import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // `host` expose le serveur sur le réseau local (téléphone, tablette) ;
  // `open` ouvre le navigateur au démarrage de `npm run dev`.
  server: { host: true, open: true },
});
