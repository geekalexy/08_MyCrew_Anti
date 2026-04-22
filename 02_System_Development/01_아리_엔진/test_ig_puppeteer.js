import puppeteer from 'puppeteer-core';
const url = process.argv[2];
(async () => {
  const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1024 });
  console.log('Navigating to URL...');
  const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 }).catch(e => e);
  console.log('URL after redirect:', page.url());
  const title = await page.title();
  console.log('Title:', title);
  await page.screenshot({ path: 'test_ig.png' });
  console.log('Screenshot saved to test_ig.png');
  await browser.close();
})();
