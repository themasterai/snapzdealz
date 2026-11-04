import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

// Plugin to copy standalone runtime scripts and styles to dist
const copyStaticFilesPlugin = (): Plugin => ({
  name: 'copy-static-files',
  closeBundle() {
    const files = ['products.js', 'script.js', 'admin.js', 'style.css', '.nojekyll'];
    const distDir = path.resolve(__dirname, 'dist');
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }
    for (const f of files) {
      const src = path.resolve(__dirname, f);
      const dest = path.resolve(distDir, f);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }
  },
});

// Plugin to remove Vite's development HMR client script from injected HTML,
// stopping WebSocket reconnect loops and spontaneous page reloads in cloud previews.
const disableDevReloadPlugin = (): Plugin => ({
  name: 'disable-dev-reload',
  transformIndexHtml: {
    order: 'post',
    handler(html: string) {
      return html.replace(/<script\s+type="module"\s+src="\/@vite\/client"><\/script>/gi, '');
    },
  },
});

export default defineConfig(() => {
  return {
    base: './',
    plugins: [disableDevReloadPlugin(), copyStaticFilesPlugin()],
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          shop: path.resolve(__dirname, 'shop.html'),
          product: path.resolve(__dirname, 'product.html'),
          cart: path.resolve(__dirname, 'cart.html'),
          wishlist: path.resolve(__dirname, 'wishlist.html'),
          about: path.resolve(__dirname, 'about.html'),
          contact: path.resolve(__dirname, 'contact.html'),
          privacy: path.resolve(__dirname, 'privacy.html'),
          terms: path.resolve(__dirname, 'terms.html'),
          login: path.resolve(__dirname, 'login.html'),
          signup: path.resolve(__dirname, 'signup.html'),
          admin: path.resolve(__dirname, 'admin.html'),
        },
      },
    },
    server: {
      hmr: false,
      watch: {
        ignored: ['**/*'],
      },
    },
  };
});
