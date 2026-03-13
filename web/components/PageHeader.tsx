"use client";

import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

type PageHeaderProps = {
    title: string;
    subtitle?: string;
    kicker?: string;
    actions?: ReactNode;
    meta?: ReactNode;
    showMeta?: boolean;
    onBack?: () => void;
    backLabel?: string;
};

export function PageHeader({
    title,
    subtitle,
    kicker,
    actions,
    meta,
    showMeta = false,
    onBack,
    backLabel = "Back",
}: PageHeaderProps) {
    return (
        <section className="page-header">
            <div className="page-header-main">
                {onBack && (
                    <button
                        type="button"
                        className="btn btn-icon btn-secondary page-header-back"
                        onClick={onBack}
                        aria-label={backLabel}
                    >
                        <ArrowLeft size={17} />
                    </button>
                )}

                <div className="page-header-copy">
                    {kicker && <p className="page-header-kicker">{kicker}</p>}
                    <div className="page-header-title-row">
                        <h1 className="page-header-title">{title}</h1>
                        {actions && <div className="page-header-actions">{actions}</div>}
                    </div>
                    {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
                </div>
            </div>

            {meta && showMeta ? <div className="page-header-meta">{meta}</div> : null}
        </section>
    );
}
