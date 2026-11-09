import { test } from '@playwright/test';
import { SHOTS_DIR, VIEWPORTS, mockApi, openChat } from './fixtures';

// Visual record of the welcome and chat screens. SHOT_PREFIX=before|after (default after).
const prefix = process.env.SHOT_PREFIX ?? 'after';

for (const vp of VIEWPORTS.filter((v) => v.name !== '768')) {
    test(`screenshots ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await mockApi(page);
        await page.goto('/');
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: `${SHOTS_DIR}/${prefix}-${vp.name}-welcome.png` });
        await openChat(page);
        await page.getByPlaceholder(/type your message/i).fill('I had an okay day, a bit tired');
        await page.keyboard.press('Enter');
        await page.getByText(/Thanks for sharing/).waitFor();
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SHOTS_DIR}/${prefix}-${vp.name}-chat.png` });
        if (prefix !== 'before') {
            await page.getByRole('button', { name: /how are you/i }).click();
            await page.getByRole('button', { name: /happy/i }).click();
            await page.screenshot({ path: `${SHOTS_DIR}/${prefix}-${vp.name}-mood.png` });
        }
    });
}
