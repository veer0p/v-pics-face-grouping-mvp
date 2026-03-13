"use client";

import React, { useMemo } from "react";

const PATTERN_SWATCHES = [
    { stroke: "#B66A85", fill: "#F7E2D6" },
    { stroke: "#C5967F", fill: "#F7E7D3" },
    { stroke: "#9F6988", fill: "#F2E2EA" },
    { stroke: "#B97891", fill: "#F6E4EA" },
    { stroke: "#C8A279", fill: "#F8EBD7" },
];

function buildPattern(stroke: string, fill: string) {
    return `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220">
            <g fill="none" stroke="${stroke}" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" opacity="0.52">
                <path d="M38 44l3.5 8 8 3.5-8 3.5-3.5 8-3.5-8-8-3.5 8-3.5z"/>
                <path d="M174 42l2.8 6.5 6.5 2.8-6.5 2.8-2.8 6.5-2.8-6.5-6.5-2.8 6.5-2.8z"/>
                <path d="M76 148c10-9 22-9 32 0-10 10-22 10-32 0Z"/>
                <path d="M144 148c-10-9-22-9-32 0 10 10 22 10 32 0Z"/>
                <path d="M110 146v23"/>
                <path d="M62 96c5-7 11-10 18-10s13 3 18 10"/>
                <circle cx="70" cy="114" r="2.2" fill="${fill}" stroke="none" opacity="0.75"/>
                <circle cx="146" cy="104" r="2.8" fill="${fill}" stroke="none" opacity="0.72"/>
                <circle cx="168" cy="166" r="2.1" fill="${fill}" stroke="none" opacity="0.68"/>
            </g>
        </svg>`,
    )}`;
}

export const PookieBackground: React.FC<{ accentIndex?: number }> = ({ accentIndex = 0 }) => {
    const swatch = PATTERN_SWATCHES[accentIndex % PATTERN_SWATCHES.length] || PATTERN_SWATCHES[0];
    const patternImage = useMemo(() => `url("${buildPattern(swatch.stroke, swatch.fill)}")`, [swatch.fill, swatch.stroke]);

    return (
        <div className="luxury-cute-bg" aria-hidden="true">
            <div className="luxury-cute-bg-gradient" />
            <div className="luxury-cute-bg-sheen" />
            <div className="luxury-cute-bg-pattern" style={{ backgroundImage: patternImage }} />
            <div className="luxury-cute-bg-grain" />
            <span className="luxury-cute-orb orb-a" />
            <span className="luxury-cute-orb orb-b" />
            <span className="luxury-cute-orb orb-c" />
        </div>
    );
};
