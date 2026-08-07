import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Nom du dépôt : GitHub Pages sert le site depuis ce sous-chemin. */
const REPO = 'memo-basse';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  build: {
    // Le worklet doit rester un fichier : `audioWorklet.addModule` sur une URI
    // `data:` est refusé dès qu'une CSP un peu stricte s'applique.
    assetsInlineLimit: (filePath: string) =>
      filePath.endsWith('onset-processor.js') ? false : undefined,
  },
  // En développement le site est à la racine ; une fois publié il vit sous /memo-basse/.
  base: command === 'build' ? `/${REPO}/` : '/',
  // `host` expose le serveur sur le réseau local (téléphone, tablette) ;
  // `open` ouvre le navigateur au démarrage de `npm run dev`.
  server: { host: true, open: true },
}));
