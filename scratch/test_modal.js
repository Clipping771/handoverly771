const { chromium } = require('playwright-core');

async function run() {
  console.log("Launching local Chrome browser...");
  const browser = await chromium.launch({ 
    headless: true,
    channel: 'chrome'
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.log(`[BROWSER ERROR] ${err.message}`);
  });

  try {
    console.log("Navigating to login page...");
    await page.goto('http://localhost:3000/login');
    
    console.log("Filling in login credentials...");
    await page.fill('input[placeholder="e.g. EMP1001"]', '232312');
    await page.fill('input[placeholder="••••••••"]', 'password123');
    
    console.log("Submitting login form...");
    await page.click('button[type="submit"]');
    
    console.log("Waiting for navigation to shift registry...");
    await page.waitForURL('**/shift');
    
    console.log("Successfully navigated to /shift. Clicking 'Register Resident'...");
    await page.click('text=Register Resident');
    
    console.log("Waiting for modal to be visible...");
    await page.waitForSelector('input[placeholder="e.g. Sarah Jenkins"]');
    
    console.log("Filling name and room number...");
    await page.fill('input[placeholder="e.g. Sarah Jenkins"]', 'Liton Kumar');
    await page.fill('input[placeholder="e.g. 204"]', '23');
    
    console.log("Selecting Care Level...");
    await page.selectOption('select', { label: 'Dementia Care' });
    
    console.log("Checking if inputs are cleared...");
    const nameVal = await page.inputValue('input[placeholder="e.g. Sarah Jenkins"]');
    const roomVal = await page.inputValue('input[placeholder="e.g. 204"]');
    console.log(`Name input value after select change: "${nameVal}"`);
    console.log(`Room input value after select change: "${roomVal}"`);
    
    // Wait a brief moment to ensure all async renders finish
    await page.waitForTimeout(2000);
    
  } catch (err) {
    console.error("Test failed with error:", err);
  } finally {
    await browser.close();
    console.log("Browser closed.");
  }
}

run();
