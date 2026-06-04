// Higher-fidelity proof: load the ACTUAL compiled Tailwind CSS from the
// production build and render the drilldown's REAL class names, so any global
// rule that could block scrolling is included. 23 rows force overflow.
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const cssPath = path.resolve('dist/assets/index-rmeWEWDY.css');
const CSS = fs.readFileSync(cssPath, 'utf8');

// Exact class strings from JuggleCompetitionDrilldown.jsx
const HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body>
  <div class="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
    <div id="panel" class="bg-brand-dark border border-white/10 w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
      <div class="shrink-0 border-b border-white/10 p-4 flex items-center gap-3">
        <h3 class="text-white font-bold flex-1">June Juggling Competition</h3>
      </div>
      <div id="body" class="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div class="space-y-1">
          ${Array.from({ length: 23 }, (_, i) => `<div class="grid grid-cols-12 gap-2 items-center px-2 py-2 rounded-lg bg-white/[0.02] border border-white/5"><span class="col-span-12 text-sm text-gray-200">Player ${i + 1}</span></div>`).join('')}
          <div id="last" class="py-3 text-center text-white font-bold">BOTTOM OF LIST</div>
        </div>
      </div>
    </div>
  </div>
</body></html>`;

test.use({ viewport: { width: 390, height: 844 } });

test('drilldown scrolls with REAL compiled CSS at 390x844 portrait', async ({ page }) => {
  await page.addStyleTag({ content: CSS });
  await page.setContent(HTML);
  await page.addStyleTag({ content: CSS }); // ensure applied after content too

  const m = await page.evaluate(() => {
    const panel = document.getElementById('panel');
    const body = document.getElementById('body');
    return { vh: innerHeight, panelH: panel.clientHeight, bodyClient: body.clientHeight, bodyScroll: body.scrollHeight };
  });
  expect(m.panelH).toBeLessThanOrEqual(Math.round(m.vh * 0.91));
  expect(m.bodyScroll).toBeGreaterThan(m.bodyClient + 100);

  const beforeInView = await page.evaluate(() => {
    const r = document.getElementById('last').getBoundingClientRect();
    return r.top < innerHeight && r.bottom > 0;
  });
  expect(beforeInView).toBe(false);

  await page.evaluate(() => { const b = document.getElementById('body'); b.scrollTop = b.scrollHeight; });
  const afterTop = await page.evaluate(() => document.getElementById('body').scrollTop);
  expect(afterTop).toBeGreaterThan(0);

  const afterInView = await page.evaluate(() => {
    const r = document.getElementById('last').getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight + 1;
  });
  expect(afterInView).toBe(true);

  console.log('REAL-CSS PROOF:', JSON.stringify({ ...m, afterTop, reachedBottom: afterInView }, null, 2));
});
