import {chromium} from '@playwright/test';
const browser=await chromium.launch();const page=await browser.newPage();
try{for(const [name,url,width] of [['entry','/',1440],['film','/en/de/movie/inception-27205/',390],['series','/en/de/show/dark-70523/',1440]]){
 await page.setViewportSize({width,height:900});await page.goto('http://localhost:3000'+url);await page.waitForFunction(()=>Array.from(document.images).filter(x=>x.loading!=='lazy').every(x=>x.complete));
 await page.screenshot({path:`docs/evidence/${name}-${width}.png`,fullPage:true,animations:'disabled'});
 console.log(name,await page.locator('h1').textContent(),await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
}}finally{await browser.close();}
