import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { databaseFixture } from '../tests/database-fixture.js';
const f = await databaseFixture();
const { default: app } = await import('../server/app.js');
const server = app.listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;
process.env.APP_ORIGIN = base;
const browser = await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const context = await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page = await context.newPage();
const out = 'tmp/pdfs/report-shots';
await mkdir(out,{recursive:true});
try {
  const registration = await context.request.post(base+'/api/auth/register',{data:{name:'Report Demo',email:'report@example.test',password:'ReportDemo2026!'},headers:{Origin:base}});
  if (!registration.ok()) throw Error('Report fixture registration failed '+registration.status());
  for(const [name,selector] of [['index','main'],['dashboard','.dashboard-landscape'],['challenges','.challenge-tools'],['forest','.game-heading'],['community','.india-community'],['connect','#connect-status']]) {
    if(process.argv[2] && name!==process.argv[2]) continue;
    await page.goto(base+'/'+name+'.html',{waitUntil:'networkidle'});
    await page.waitForTimeout(2500);
    const target=page.locator(selector);
    if(await target.count()) await target.first().evaluate(el=>window.scrollTo(0,Math.max(0,el.getBoundingClientRect().top+window.scrollY-125)));
    await page.screenshot({path:`${out}/${name}.png`});
    console.log('Captured',name);
  }
} finally {
 await browser.close();
 await new Promise(r=>server.close(r));
 await f.cleanup();
}
