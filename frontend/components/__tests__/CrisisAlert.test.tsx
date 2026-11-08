// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CrisisAlert, { FALLBACK_RESOURCES } from '../CrisisAlert';
import type { EmergencyResources } from '../../types';

afterEach(cleanup);

// What the backend sends with CRISIS_REGION=IN (crisisResponse.resources('IN')).
const INDIA: EmergencyResources = {
    crisis_lines: [
        { name: 'Tele-MANAS, the national mental health helpline', number: 'call 14416 or 1-800-891-4416 (free, 24/7)', description: 'India, free and confidential', region: 'IN', tel: '14416' },
    ],
    emergency: [{ region: 'IN', number: '112' }],
    immediate_actions: [],
};

const hrefs = () => screen.getAllByRole('link').map((a) => a.getAttribute('href'));

describe('crisis screen', () => {
    it('shows the helplines the backend chose for the region, and no others', () => {
        render(<CrisisAlert resources={INDIA} onClose={() => {}} />);
        expect(screen.getByRole('link', { name: /Call 14416/ })).toHaveProperty('href', 'tel:14416');
        expect(hrefs()).toEqual(['tel:14416', 'tel:112']);
        expect(document.body.textContent).not.toMatch(/988|911|741741/);
    });

    it('has exactly one large primary action: the first helpline', () => {
        render(<CrisisAlert resources={INDIA} onClose={() => {}} />);
        const primary = document.querySelectorAll('.crisis-primary');
        expect(primary).toHaveLength(1);
        expect(primary[0].getAttribute('href')).toBe('tel:14416');
    });

    it('without backend resources falls back to India first, then the US and a directory', () => {
        render(<CrisisAlert resources={null} onClose={() => {}} />);
        expect(hrefs()).toEqual(['tel:14416', 'tel:988', 'https://findahelpline.com', 'tel:112', 'tel:911']);
        expect(FALLBACK_RESOURCES.crisis_lines[0].region).toBe('IN');
    });

    it('treats an empty list like a missing one', () => {
        render(<CrisisAlert resources={{ ...INDIA, crisis_lines: [] }} onClose={() => {}} />);
        expect(hrefs()[0]).toBe('tel:14416');
    });

    it('a text line is an sms: link', () => {
        const us: EmergencyResources = {
            crisis_lines: [
                { name: 'the 988 Suicide & Crisis Lifeline', number: 'call or text 988', description: 'US', region: 'US', tel: '988' },
                { name: 'Crisis Text Line', number: 'text HOME to 741741', description: 'US', region: 'US', sms: '741741' },
            ],
            emergency: [{ region: 'US', number: '911' }],
            immediate_actions: [],
        };
        render(<CrisisAlert resources={us} onClose={() => {}} />);
        expect(hrefs()).toEqual(['tel:988', 'sms:741741', 'tel:911']);
    });

    it('is a labelled modal dialog that takes focus and closes on Escape or the button', () => {
        const onClose = vi.fn();
        render(<CrisisAlert resources={INDIA} onClose={onClose} />);
        const dialog = screen.getByRole('dialog', { name: "You don't have to go through this alone" });
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2 }));
        fireEvent.keyDown(window, { key: 'Escape' });
        fireEvent.click(screen.getByRole('button', { name: 'Back to the chat' }));
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('carries no emoji or animation classes (safety over style)', () => {
        const { container } = render(<CrisisAlert resources={INDIA} onClose={() => {}} />);
        expect(container.innerHTML).not.toMatch(/animate-|gradient|glass/);
        expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    });
});
