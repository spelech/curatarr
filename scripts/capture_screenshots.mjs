import { chromium } from '../tests/Curatarr.E2E/node_modules/playwright/index.mjs';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = path.resolve('docs/assets/screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    extraHTTPHeaders: {
      'X-Curatarr-Bypass-Auth': 'true',
    },
  });

  const page = await context.newPage();

  console.log('Navigating to http://localhost:8909...');
  await page.goto('http://localhost:8909/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. Grid View (Never Watched with badges)
  console.log('Capturing Grid View...');
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'curatarr-grid-view.png'),
    fullPage: false,
  });

  // 2. Table View
  console.log('Switching to Table View...');
  const listBtn = page.locator('button').filter({ has: page.locator('svg.lucide-list') }).first();
  if (await listBtn.isVisible()) {
    await listBtn.click();
    await page.waitForTimeout(1500);
    console.log('Capturing Table View...');
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'curatarr-table-view.png'),
      fullPage: false,
    });
  }

  // 3. Detail Modal
  console.log('Opening Detail Modal...');
  const rowItem = page.locator('tbody tr td div.cursor-pointer').first();
  if (await rowItem.isVisible()) {
    await rowItem.click();
    await page.waitForTimeout(1500);
    console.log('Capturing Detail Modal...');
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'curatarr-detail-modal.png'),
      fullPage: false,
    });
    const closeBtn = page.locator('button:has-text("Close")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(800);
  }

  // 4. Protected Items View (Sidebar)
  console.log('Navigating to Protected Items View via Sidebar...');
  const protectedTab = page.locator('aside nav button').filter({ hasText: 'Protected Items' }).first();
  if (await protectedTab.isVisible()) {
    await protectedTab.click();
    await page.waitForTimeout(1500);
    console.log('Capturing Protected Items View...');
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'curatarr-protected-view.png'),
      fullPage: false,
    });
  }

  // 5. Audit History View (Sidebar)
  console.log('Navigating to Audit History View via Sidebar...');
  const auditTab = page.locator('aside nav button').filter({ hasText: 'Audit History' }).first();
  if (await auditTab.isVisible()) {
    await auditTab.click();
    await page.waitForTimeout(1500);
    console.log('Capturing Audit History View...');
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'curatarr-audit-view.png'),
      fullPage: false,
    });
  }

  // 6. Settings & Rules View (Sidebar)
  console.log('Navigating to Settings & Rules View via Sidebar...');
  const settingsTab = page.locator('aside nav button').filter({ hasText: 'Settings & Rules' }).first();
  if (await settingsTab.isVisible()) {
    await settingsTab.click();
    await page.waitForTimeout(1500);
    console.log('Capturing Settings & Rules View...');
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'curatarr-settings-view.png'),
      fullPage: false,
    });
  }

  await browser.close();
  console.log('All screenshots captured successfully in', SCREENSHOT_DIR);
}

run().catch((err) => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
