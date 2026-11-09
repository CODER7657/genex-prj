import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { VIEWPORTS, mockApi, openChat } from './fixtures';

/** Clay UI acceptance checks (roadmap §3) at phone, tablet and desktop widths. */

async function seriousAxeViolations(page: Page) {
    const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
    return results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

async function horizontalOverflow(page: Page) {
    return page.evaluate(() => {
        const d = document.documentElement;
        return Math.max(d.scrollWidth - d.clientWidth, document.body.scrollWidth - d.clientWidth);
    });
}

/** Visible interactive elements smaller than 44 x 44 CSS px. */
async function smallTargets(page: Page) {
    return page.evaluate(() => {
        const els = Array.from(document.querySelectorAll<HTMLElement>(
            'button, a[href], input, select, textarea, [role="switch"], [tabindex]:not([tabindex="-1"])',
        ));
        return els
            .map((el) => ({ el, r: el.getBoundingClientRect(), s: getComputedStyle(el) }))
            .filter(({ r, s }) => r.width > 0 && r.height > 0 && s.visibility !== 'hidden')
            .filter(({ r }) => r.width < 44 || r.height < 44)
            .map(({ el, r }) => `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    });
}

async function darkModeTraces(page: Page) {
    return page.evaluate(() => ({
        darkClasses: Array.from(document.querySelectorAll('[class]'))
            .filter((el) => /(^|\s)dark(:|\s|$)/.test(el.getAttribute('class') ?? '')).length,
        htmlDark: document.documentElement.classList.contains('dark'),
        toggles: Array.from(document.querySelectorAll('button'))
            .filter((b) => /dark|light mode|theme/i.test(`${b.title} ${b.getAttribute('aria-label') ?? ''} ${b.textContent}`)).length,
    }));
}

async function nunitoLoaded(page: Page) {
    return page.evaluate(async () => {
        await document.fonts.ready;
        const family = getComputedStyle(document.querySelector('h1')!).fontFamily;
        const loaded = Array.from(document.fonts).some((f) => /Nunito/.test(f.family) && f.status === 'loaded');
        return { family, loaded, check: document.fonts.check('600 16px Nunito') && document.fonts.check('800 16px Nunito') };
    });
}

async function expectCleanScreen(page: Page) {
    expect(await seriousAxeViolations(page)).toEqual([]);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await smallTargets(page)).toEqual([]);
    expect(await darkModeTraces(page)).toEqual({ darkClasses: 0, htmlDark: false, toggles: 0 });
    const font = await nunitoLoaded(page);
    expect(font.family).toMatch(/Nunito/);
    expect(font.loaded).toBe(true);
    expect(font.check).toBe(true);
}

for (const vp of VIEWPORTS) {
    test.describe(`${vp.width}x${vp.height}`, () => {
        test.beforeEach(async ({ page }) => {
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await mockApi(page);
            await page.goto('/');
        });

        test('welcome screen renders and meets the Clay checks', async ({ page }) => {
            await expect(page.getByRole('heading', { level: 1, name: /welcome to your ai wellness companion/i })).toBeVisible();
            await expect(page.getByRole('button', { name: /start a conversation/i })).toBeVisible();
            await expectCleanScreen(page);
        });

        test('chat screen renders and meets the Clay checks', async ({ page }) => {
            await openChat(page);
            await expect(page.getByText(/I'm Aura, your AI wellness companion/)).toBeVisible();
            for (const name of [/how are you/i, /goals/i, /resources/i, /analytics/i, /voice settings/i, /clear chat/i]) {
                await expect(page.getByRole('button', { name })).toBeVisible();
            }
            await expectCleanScreen(page);
        });

        test('a normal reply appears in the chat', async ({ page }) => {
            await openChat(page);
            await page.getByPlaceholder(/type your message/i).fill('I had an okay day');
            await page.getByRole('button', { name: /send message/i }).click();
            await expect(page.getByText('Thanks for sharing. What has been on your mind today?')).toBeVisible();
            await expect(page.getByRole('dialog')).toHaveCount(0);
            expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
        });

        test('mood check-in dialog is accessible and selectable', async ({ page }) => {
            await openChat(page);
            await page.getByRole('button', { name: /how are you/i }).click();
            const dialog = page.getByRole('dialog', { name: /how are you feeling right now/i });
            await expect(dialog).toBeVisible();
            const save = dialog.getByRole('button', { name: 'Save' });
            await expect(save).toBeDisabled();
            const happy = dialog.getByRole('button', { name: /happy/i });
            await happy.click();
            await expect(happy).toHaveAttribute('aria-pressed', 'true');
            await expect(save).toBeEnabled();
            expect(await seriousAxeViolations(page)).toEqual([]);
            expect(await smallTargets(page)).toEqual([]);
            expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
            await save.click();
            await expect(dialog).toHaveCount(0);
        });

        test('goals, resources and analytics dialogs pass axe', async ({ page }) => {
            await openChat(page);
            for (const [button, title] of [[/goals/i, /goals & reminders/i], [/resources/i, /wellness resources/i], [/analytics/i, /mood analytics/i]] as const) {
                await page.getByRole('button', { name: button }).first().click();
                const dialog = page.getByRole('dialog', { name: title });
                await expect(dialog).toBeVisible();
                expect(await seriousAxeViolations(page)).toEqual([]);
                expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
                await dialog.getByRole('button', { name: 'Close' }).click();
                await expect(dialog).toHaveCount(0);
            }
        });
    });
}

test('a crisis reply still opens the plain white crisis dialog with the helpline first', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockApi(page, { crisis: true });
    await page.goto('/');
    await openChat(page);
    await page.getByPlaceholder(/type your message/i).fill('I do not want to be here anymore');
    await page.getByRole('button', { name: /send message/i }).click();

    const dialog = page.getByRole('dialog', { name: /have to go through this alone/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('link').first()).toHaveAttribute('href', 'tel:14416');
    const hrefs = await dialog.getByRole('link').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs).toEqual(['tel:14416', 'tel:112']);

    const look = await page.locator('.crisis-screen').evaluate((el) => {
        const s = getComputedStyle(el);
        return { bg: s.backgroundColor, color: s.color, animation: s.animationName };
    });
    expect(look).toEqual({ bg: 'rgb(255, 255, 255)', color: 'rgb(17, 17, 17)', animation: 'none' });
    expect(await dialog.evaluate((el) => el.innerHTML)).not.toMatch(/clay-|animate-|gradient|glass/);
});
