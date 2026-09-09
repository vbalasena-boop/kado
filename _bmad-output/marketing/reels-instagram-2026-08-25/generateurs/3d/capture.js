const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const N = parseInt(process.argv[2] || '360', 10);   // nb frames
  const HTML = process.argv[3] || 'wheel.html';
  const OUTDIR = process.argv[4] || 'frames';
  const FPS = 30;
  const OUT = path.join(__dirname, OUTDIR);
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png')) fs.unlinkSync(path.join(OUT, f));

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
           '--ignore-gpu-blocklist','--enable-webgl','--no-sandbox',
           '--allow-file-access-from-files','--disable-web-security']
  });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR '+e.message));
  await page.goto('file://' + path.join(__dirname, HTML));
  await page.waitForFunction('window.__ready===true', { timeout: 15000 });

  // check WebGL really active
  const gl = await page.evaluate(() => {
    const c=document.querySelector('canvas'); const g=c.getContext('webgl')||c.getContext('experimental-webgl');
    return g ? (g.getParameter(g.VERSION)+' | '+g.getParameter(g.RENDERER)) : 'NO-WEBGL';
  });
  console.log('WEBGL:', gl);
  if (errs.length) console.log('ERRORS:', errs.slice(0,5).join(' || '));

  for (let i=0;i<N;i++){
    const t = i/FPS;
    await page.evaluate((t)=>window.renderAt(t), t);
    await page.screenshot({ path: path.join(OUT, `w_${String(i).padStart(4,'0')}.png`), clip:{x:0,y:0,width:1080,height:1920} });
  }
  console.log('FRAMES OK', N, '->', OUT);
  await browser.close();
})().catch(e=>{ console.error('FATAL', e); process.exit(1); });
