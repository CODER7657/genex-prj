import React, { useEffect, useRef } from 'react';
import type { EmergencyResources } from '../types';

/**
 * The crisis screen. Deliberately plain (roadmap §3: safety over style): white, black
 * text, one large button to the first helpline, the rest as ordinary links. The numbers
 * come from the backend, which chooses them by CRISIS_REGION; this file holds only the
 * fallback for when they did not arrive (the same India + US + directory list the
 * backend uses when no region is set).
 */
export const FALLBACK_RESOURCES: EmergencyResources = {
    crisis_lines: [
        { name: 'Tele-MANAS, the national mental health helpline', number: 'call 14416 or 1-800-891-4416 (free, 24/7)', description: 'India, free and confidential', region: 'IN', tel: '14416' },
        { name: 'the 988 Suicide & Crisis Lifeline', number: 'call or text 988 (free, 24/7)', description: 'US, free and confidential', region: 'US', tel: '988' },
        { name: 'Find A Helpline', number: 'findahelpline.com lists free services in your country', description: 'Worldwide directory', region: 'INTL' },
    ],
    emergency: [{ region: 'IN', number: '112' }, { region: 'US', number: '911' }],
    immediate_actions: [],
};

const REGION_NAME: Record<string, string> = { IN: 'India', US: 'US', UK: 'UK' };

interface CrisisAlertProps {
    resources?: EmergencyResources | null;
    onClose: () => void;
}

const CrisisAlert: React.FC<CrisisAlertProps> = ({ resources, onClose }) => {
    const r = resources?.crisis_lines?.length ? resources : FALLBACK_RESOURCES;
    const [primary, ...others] = r.crisis_lines;
    const heading = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        heading.current?.focus();
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="crisis-screen" role="dialog" aria-modal="true" aria-labelledby="crisis-title">
            <div className="crisis-body">
                <h2 id="crisis-title" ref={heading} tabIndex={-1}>You don't have to go through this alone</h2>
                <p>Talking to someone now can help. These services are free and confidential.</p>

                {primary?.tel ? (
                    <a className="crisis-primary" href={`tel:${primary.tel}`}>
                        Call {primary.tel}
                        <span>{primary.name}</span>
                    </a>
                ) : null}

                <ul className="crisis-list">
                    {(primary?.tel ? others : r.crisis_lines).map((line) => (
                        <li key={`${line.region}-${line.name}`}>
                            {line.tel ? (
                                <a href={`tel:${line.tel}`}>Call {line.tel}</a>
                            ) : line.sms ? (
                                <a href={`sms:${line.sms}`}>Text {line.sms}</a>
                            ) : line.region === 'INTL' ? (
                                <a href="https://findahelpline.com" rel="noopener noreferrer" target="_blank">findahelpline.com</a>
                            ) : null}{' '}
                            {line.name} ({REGION_NAME[line.region] ?? line.description})
                        </li>
                    ))}
                </ul>

                <p className="crisis-emergency">
                    In immediate danger, call{' '}
                    {r.emergency.map((e, i) => (
                        <React.Fragment key={e.region}>
                            {i > 0 ? ' or ' : ''}
                            <a href={`tel:${e.number}`}>{e.number}</a>
                            {r.emergency.length > 1 ? ` (${REGION_NAME[e.region] ?? e.region})` : ''}
                        </React.Fragment>
                    ))}
                    , or go to the nearest emergency department.
                </p>

                <button type="button" className="crisis-close" onClick={onClose}>
                    Back to the chat
                </button>
            </div>
        </div>
    );
};

export default CrisisAlert;
