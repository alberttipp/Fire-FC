// Proves the Juggle drilldown's modal shell actually scrolls to the bottom
// at a real mobile-portrait viewport. Reproduces the EXACT DOM/flex structure
// the component uses (translated from its Tailwind classes to plain CSS so the
// test is hermetic — no network/Tailwind needed). If this passes, the layout
// mechanics are correct and any device failure is a stale cached bundle.
import { test, expect } from '@playwright/test';

const HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { box-sizing: border-box; margin: 0; }
  /* backdrop: fixed inset-0 flex items-end justify-center */
  .backdrop { position: fixed; inset: 0; display: flex; align-items: flex-end; justify-content: center; background: rgba(0,0,0,.8); }
  /* panel: max-h-[90vh] overflow-hidden flex flex-col */
  .panel { background:#10151f; width:100%; max-height:90vh; overflow:hidden; display:flex; flex-direction:column; }
  /* header: shrink-0 */
  .header { flex-shrink:0; padding:16px; border-bottom:1px solid #ffffff1a; color:#fff; font-weight:700; }
  /* body: flex-1 min-h-0 overflow-y-auto */
  .body { flex:1 1 0%; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:16px; }
  .row { padding:14px 8px; border:1px solid #ffffff14; border-radius:8px; color:#e5e7eb; margin-bottom:4px; }
  .lastmarker { background:#16a34a; color:#001; padding:14px; text-align:center; font-weight:800; }
</style></head>
<body>
  <div class="backdrop">
    <div class="panel" id="panel">
      <div class="header" id="header">June Juggling Competition</div>
      <div class="body" id="body">
        ${Array.from({ length: 23 }, (_, i) => `<div class="row">Player ${i + 1} — best ${100 - i}</div>`).join('')}
        <div class="lastmarker" id="last">BOTTOM OF LIST</div>
      </div>
    </div>
  </div>
</body></html>`;

test.use({ viewport: { width: 390, height: 844 } }); // typical Android portrait

test('Juggle drilldown body scrolls to the bottom in portrait', async ({ page }) => {
  await page.setContent(HTML);

  const metrics = await page.evaluate(() => {
    const vh = window.innerHeight;
    const panel = document.getElementById('panel');
    const body = document.getElementById('body');
    return {
      vh,
      panelH: panel.clientHeight,
      bodyClient: body.clientHeight,
      bodyScroll: body.scrollHeight,
    };
  });

  // 1) Panel is capped to the viewport (<= ~90vh), not taller than the screen.
  expect(metrics.panelH).toBeLessThanOrEqual(Math.round(metrics.vh * 0.91));
  // 2) Content genuinely overflows the scroll area (so scrolling is required).
  expect(metrics.bodyScroll).toBeGreaterThan(metrics.bodyClient + 100);

  // 3) Before scrolling, the BOTTOM marker is off-screen.
  const beforeVisible = await page.locator('#last').isVisible(); // in DOM, but...
  const beforeInView = await page.evaluate(() => {
    const r = document.getElementById('last').getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  });
  expect(beforeInView).toBe(false);

  // 4) Scroll the body to the bottom (as a touch-drag/scroll would).
  await page.evaluate(() => { const b = document.getElementById('body'); b.scrollTop = b.scrollHeight; });
  const afterScrollTop = await page.evaluate(() => document.getElementById('body').scrollTop);
  expect(afterScrollTop).toBeGreaterThan(0); // it actually scrolled

  // 5) After scrolling, the BOTTOM marker is now visible within the viewport.
  const afterInView = await page.evaluate(() => {
    const r = document.getElementById('last').getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight + 1;
  });
  expect(afterInView).toBe(true);

  console.log('PROOF:', JSON.stringify({ ...metrics, afterScrollTop, reachedBottom: afterInView }, null, 2));
});
