import type { Page, Route } from '@playwright/test';

export const VIEWPORTS = [
    { name: '375', width: 375, height: 812 },
    { name: '768', width: 768, height: 1024 },
    { name: '1280', width: 1280, height: 800 },
] as const;

export const SHOTS_DIR = 'D:/repos/genex-shots';

export const INDIA_CRISIS = {
    crisis_lines: [
        { name: 'Tele-MANAS, the national mental health helpline', number: 'call 14416', description: 'India', region: 'IN', tel: '14416' },
    ],
    emergency: [{ region: 'IN', number: '112' }],
    immediate_actions: [],
};

const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

const json = (route: Route, body: unknown) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });

/** Mock every backend call. `crisis` makes chat/message return a crisis reply. */
export async function mockApi(page: Page, opts: { crisis?: boolean } = {}) {
    await page.route('**/api/**', async (route) => {
        const req = route.request();
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
        const url = req.url();
        if (url.includes('/api/auth/register')) {
            return json(route, { success: true, tokens: { accessToken: 't' }, user: { id: 1 } });
        }
        if (url.includes('/api/chat/message')) {
            return json(route, {
                success: true,
                data: {
                    sessionId: 's1',
                    aiResponse: opts.crisis
                        ? { content: 'I am really glad you told me.', crisisDetected: true, emergencyResources: INDIA_CRISIS }
                        : { content: 'Thanks for sharing. What has been on your mind today?' },
                },
            });
        }
        return json(route, { success: true, data: {} });
    });
}

export async function openChat(page: Page) {
    await page.getByRole('button', { name: /start a conversation/i }).click();
    await page.getByPlaceholder(/type your message/i).waitFor();
}
