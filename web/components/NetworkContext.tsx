"use client";

import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";

type NetworkContextType = {
    isOnline: boolean;
};

const NetworkContext = createContext<NetworkContextType>({ isOnline: true });

function getSnapshot(): boolean {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
}

function getServerSnapshot(): boolean {
    return true;
}

function subscribe(callback: () => void): () => void {
    window.addEventListener("online", callback);
    window.addEventListener("offline", callback);
    return () => {
        window.removeEventListener("online", callback);
        window.removeEventListener("offline", callback);
    };
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
    const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    return (
        <NetworkContext.Provider value={{ isOnline }}>
            {children}
        </NetworkContext.Provider>
    );
}

export function useNetwork() {
    return useContext(NetworkContext);
}
