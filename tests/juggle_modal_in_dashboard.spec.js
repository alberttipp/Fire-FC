// Most faithful proof: render the drilldown INSIDE the real Dashboard ancestor
// chain (overflow-x-hidden root + sticky backdrop-blur nav + <main>), with a
// tall background so the page itself scrolls, and with document.body overflow
// locked (as the component does on mount). If the modal still scrolls here,
// the ancestor chain is exonerated and the code is correct.
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const cssFile = fs.readdirSync(path.resolve('dist/assets')).find((f) => f.endsWith('.css'));
const CSS = fs.readFileSync(path.resolve('dist/assets', cssFile), 'utf8');

const HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head>
<body style="overflow:hidden">
  <div class="min-h-screen bg-brand-dark pb-20 overflow-x-hidden">
    <div class="sticky top-0 z-50 bg-brand-dark/95 backdrop-blur border-b border-white/10 px-3 py-3">NAV</div>
    <main class="max-w-7xl mx-auto px-4 py-8">
      ${Array.from({ length: 40 }, (_, i) => `<p style="color:#888">background line ${i}</p>`).join('')}
      <!-- the modal, exactly as JuggleCompetitionDrilldown renders it -->
      <div class="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
        <div id="panel" class="bg-brand-dark border border-white/10 w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <div class="shrink-0 border-b border-white/10 p-4 flex items-center gap-3"><h3 class="text-white font-bold flex-1">June Juggling Competition</h3></div>
          <div id="body" class="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div class="space-y-1">
              ${Array.from({ length: 23 }, (_, i) => `<div class="grid grid-cols-12 gap-2 items-center px-2 py-2 rounded-lg bg-white/[0.02] border border-white/5"><span class="col-span-12 text-sm text-gray-200">Player ${i + 1}</span></div>`).join('')}
              <div id="last" class="py-3 text-center text-white font-bold">BOTTOM OF LIST</div>
            </div>
          </div>
        </div>
      </div>
    </main>
    <!-- The real MobileBottomNav: fixed bottom-0 z-[80]. This is what occluded the
         modal's bottom when the modal was only z-50 (the actual bug). -->
    <nav id="nav" class="fixed bottom-0 left-0 right-0 z-[80] bg-brand-dark/95 backdrop-blur-lg border-t border-white/10" style="height:64px"></nav>
  </div>
</body></html>`;

test.use({ viewport: { width: 390, height: 844 } });

test('drilldown scrolls inside the real Dashboard ancestor chain (portrait)', async ({ page }) => {
  await page.setContent(HTML);
  await page.addStyleTag({ content: CSS });
  await page.waitForTimeout(700); // let the 0.5s animate-fade-in (transform) settle

  // The modal must be viewport-fixed (top-left at 0,0), not trapped/offset by an ancestor.
  const box = await page.locator('#panel').evaluate((el) => {
    const fixedAncestorRect = el.closest('.fixed').getBoundingClientRect();
    return { top: fixedAncestorRect.top, left: fixedAncestorRect.left, width: fixedAncestorRect.width, height: fixedAncestorRect.height };
  });
  expect(Math.round(box.top)).toBe(0);
  expect(Math.round(box.left)).toBe(0);
  expect(Math.round(box.height)).toBe(844); // covers full viewport, not trapped to a shorter ancestor

  const m = await page.evaluate(() => {
    const body = document.getElementById('body');
    return { panelH: document.getElementById('panel').clientHeight, bodyClient: body.clientHeight, bodyScroll: body.scrollHeight };
  });
  expect(m.bodyScroll).toBeGreaterThan(m.bodyClient + 100);

  await page.evaluate(() => { const b = document.getElementById('body'); b.scrollTop = b.scrollHeight; });
  const reached = await page.evaluate(() => {
    const r = document.getElementById('last').getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight + 1;
  });
  expect(reached).toBe(true);

  // CRITICAL regression guard for THE bug in the screenshot: the bottom of the
  // modal must sit ABOVE the fixed bottom nav (z-[80]), not behind it. At a point
  // ~24px from the bottom (inside the nav's band), the topmost element must be
  // the MODAL (z-[110]). With the old z-50 modal, this point returned the nav.
  const hit = await page.evaluate(() => {
    const el = document.elementFromPoint(Math.round(innerWidth / 2), innerHeight - 24);
    return { id: el?.id || '', inNav: !!el?.closest('#nav'), inModal: !!el?.closest('#panel') };
  });
  expect(hit.inNav).toBe(false);
  expect(hit.inModal).toBe(true);

  console.log('DASHBOARD-CHAIN PROOF:', JSON.stringify({ fixedBox: box, ...m, reachedBottom: reached, bottomHitsNav: hit.inNav, bottomHitsModal: hit.inModal }, null, 2));
});
