// Relacje Instagram mają format 9:16 (1080×1920). Grafika posta 4:5 (1080×1350) wrzucona wprost
// jako relacja jest przycinana po bokach. Tu dokładamy tło u góry i u dołu (rozciągnięty, rozmyty
// brzeg grafiki), a cały post zostaje nietknięty pośrodku – w bezpiecznej strefie relacji.
// Użycie CLI: node tools/ig/story.js wej.jpg wyj.jpg [wej2.jpg wyj2.jpg ...]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function toStory(browser, input, output) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  try {
    const src = 'data:image/jpeg;base64,' + fs.readFileSync(input).toString('base64');
    await page.setContent('<html><body style="margin:0;background:#05071a"><canvas id="c" width="1080" height="1920"></canvas></body></html>');
    await page.evaluate(async (src) => {
      const img = new Image(); img.src = src; await img.decode();
      const W = 1080, H = 1920, h = Math.round(img.height * W / img.width), y = Math.round((H - h) / 2);
      const ctx = document.getElementById('c').getContext('2d');
      const strip = Math.max(8, Math.round(img.height * 0.012)), ov = 60;
      ctx.filter = 'blur(25px)';
      ctx.drawImage(img, 0, 0, img.width, strip, -40, -40, W + 80, y + ov + 40);
      ctx.drawImage(img, 0, img.height - strip, img.width, strip, -40, y + h - ov, W + 80, H - (y + h) + ov + 40);
      ctx.filter = 'none';
      ctx.drawImage(img, 0, y, W, h);
    }, src);
    await page.locator('#c').screenshot({ path: output, type: 'jpeg', quality: 90 });
  } finally { await page.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { chromium } = createRequire(import.meta.url)('playwright');
  const args = process.argv.slice(2);
  if (!args.length || args.length % 2) { console.error('Użycie: node tools/ig/story.js wej.jpg wyj.jpg [...]'); process.exit(1); }
  const b = await chromium.launch();
  for (let i = 0; i < args.length; i += 2) { await toStory(b, args[i], args[i + 1]); console.log('story', args[i + 1]); }
  await b.close();
}
