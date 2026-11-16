import express, { type Express, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';

/**
 * Serves the web app: through Vite while developing, or the built files in dist/ in production.
 */
export async function attachWebApp(app: Express): Promise<boolean> {
  const isDev = process.env.NODE_ENV === 'development';
  const isProd =
    !isDev &&
    (process.env.NODE_ENV === 'production' ||
      Boolean(process.env.K_SERVICE) ||
      fs.existsSync(path.resolve(process.cwd(), 'dist', 'index.html')));

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    const indexHtml = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexHtml)) {
      console.error(`Build tidak ditemukan: ${indexHtml}. Jalankan npm run build.`);
    }
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        // A failed build must look like a failure, not like a working empty page.
        res.status(503).send('Build Fina tidak ditemukan. Periksa log build lalu terbitkan ulang.');
      }
    });
  }

  return isProd;
}
