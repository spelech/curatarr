import { test, expect } from '@spelech/playwright-layout-inspector/fixture';

test.describe('Curatarr Layout & Responsive UX Audits', () => {
  test('should pass comprehensive layout audit with zero overflow and mobile fit', async ({ page, layoutInspector: _ }) => {
    await page.goto('/');

    // 1. Assert zero horizontal overflow / canvas bleed
    await expect(page).toHaveNoLayoutOverflow();

    // 2. Assert mobile viewport & zoom accessibility readiness
    await expect(page).toHaveMobileFit();

    // 3. Assert touch targets meet WCAG standards (min size 24px)
    await expect(page).toHaveTouchFriendlyTargets({ minSize: 24 });

    // 4. Assert composite layout UX score passes with Grade A / high score
    await expect(page).toPassLayoutAudit({ minScore: 85 });
  });
});
