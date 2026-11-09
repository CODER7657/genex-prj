import React, { useId } from 'react';
import { ArrowLeft, X } from 'lucide-react';

/** Shared Clay pieces: a dialog shell and an on/off switch. Presentation only. */

interface ClayDialogProps {
    title: React.ReactNode;
    onClose: () => void;
    /** 'close' shows an X, 'back' an arrow. */
    closeKind?: 'close' | 'back';
    closeLabel?: string;
    /** Tailwind max-width class for the panel. */
    width?: string;
    /** Rendered under the title. */
    subtitle?: React.ReactNode;
    children: React.ReactNode;
    zClass?: string;
}

export const ClayDialog: React.FC<ClayDialogProps> = ({
    title,
    onClose,
    closeKind = 'close',
    closeLabel = 'Close',
    width = 'max-w-2xl',
    subtitle,
    children,
    zClass,
}) => {
    const titleId = useId();
    const Icon = closeKind === 'back' ? ArrowLeft : X;
    return (
        <div className={`clay-scrim clay-surface ${zClass ?? ''}`}>
            <div className={`clay-dialog ${width} clay-scroll`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h2 id={titleId} className="text-2xl font-extrabold text-ink">{title}</h2>
                        {subtitle ? <p className="mt-1 text-base text-ink-soft">{subtitle}</p> : null}
                    </div>
                    <button type="button" onClick={onClose} className="clay-btn clay-btn-icon flex-shrink-0" aria-label={closeLabel} title={closeLabel}>
                        <Icon className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
};

interface ClaySwitchProps {
    checked: boolean;
    onChange: () => void;
    label: string;
}

export const ClaySwitch: React.FC<ClaySwitchProps> = ({ checked, onChange, label }) => (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange} className="clay-switch">
        <span className="clay-switch-track">
            <span className="clay-switch-knob" />
        </span>
    </button>
);
