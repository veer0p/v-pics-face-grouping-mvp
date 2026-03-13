"use client";

import { createContext, useContext, useEffect } from "react";

export type HeaderSyncAction = {
    title?: string;
    label?: string;
    loading?: boolean;
    onClick?: () => void | Promise<void>;
    ariaLabel?: string;
    onBack?: () => void;
    pageActions?: React.ReactNode;
};

const HeaderSyncContext = createContext<((action: HeaderSyncAction | null) => void) | null>(null);

export function HeaderSyncProvider({
    value,
    children,
}: {
    value: (action: HeaderSyncAction | null) => void;
    children: React.ReactNode;
}) {
    return <HeaderSyncContext.Provider value={value}>{children}</HeaderSyncContext.Provider>;
}

export function useHeaderSyncAction(action: HeaderSyncAction | null) {
    const setHeaderSync = useContext(HeaderSyncContext);

    useEffect(() => {
        if (!setHeaderSync) return;
        setHeaderSync(action);
        return () => setHeaderSync(null);
    }, [action, setHeaderSync]);
}
