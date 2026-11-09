// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import WellnessResources from '../WellnessResources';

afterEach(cleanup);

describe('Crisis Support tab', () => {
    it('lists India first, then the US and a directory, with dialable links, never US-only', () => {
        render(<WellnessResources onClose={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: /Crisis Support/ }));
        const dialog = screen.getByRole('dialog');
        const hrefs = within(dialog).getAllByRole('link').map((a) => a.getAttribute('href'));
        expect(hrefs).toEqual(['tel:14416', 'tel:988', 'https://findahelpline.com', 'tel:112', 'tel:911']);
        expect(dialog.textContent).not.toMatch(/SAMHSA|1-800-662-4357/);
    });
});
