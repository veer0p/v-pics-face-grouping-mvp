/**
 * palettes.ts
 * Fully expanded accent color schemes for total theme harmony.
 * Includes all semantic variables to ensure complete consistency.
 */

export type Palette = {
    name: string;
    accent: string;
    accent2: string;
    accentSoft: string;
    ink: string;
    ink2: string;
    muted: string;
    muted2: string;
    bg: string;
    bgElevated: string;
    bgSubtle: string;
    glow: string;
    line: string;
    lineStrong: string;
};

export const ACCENT_PALETTES: { light: Palette[]; dark: Palette[] } = {
    light: [
        {
            name: "Barbie Light",
            accent: "#FF007F", accent2: "#FF66CC", accentSoft: "rgba(255, 0, 127, 0.08)",
            ink: "#300018", ink2: "#4D0026", muted: "#8B4D6D", muted2: "#B386A1",
            bg: "#FFF5F9", bgElevated: "#FFF0F6", bgSubtle: "#FFEBF4",
            glow: "rgba(255, 0, 127, 0.3)",
            line: "rgba(255, 0, 127, 0.12)", lineStrong: "rgba(255, 0, 127, 0.22)",
        },
        {
            name: "Lavender",
            accent: "#B19DFF", accent2: "#9B86FF", accentSoft: "rgba(177, 157, 255, 0.15)",
            ink: "#2B1B61", ink2: "#422E8A", muted: "#6B52D1", muted2: "#D4CBFF",
            bg: "#F6F4FF", bgElevated: "#FFFFFF", bgSubtle: "#EEF0FF",
            glow: "transparent",
            line: "rgba(177, 157, 255, 0.1)", lineStrong: "rgba(177, 157, 255, 0.2)",
        },
        {
            name: "Peach",
            accent: "#FFB38A", accent2: "#FF9671", accentSoft: "rgba(255, 179, 138, 0.15)",
            ink: "#61361B", ink2: "#8A4C2E", muted: "#D17F52", muted2: "#FFD4CB",
            bg: "#FFF8F4", bgElevated: "#FFFFFF", bgSubtle: "#FFF1EA",
            glow: "transparent",
            line: "rgba(255, 179, 138, 0.1)", lineStrong: "rgba(255, 179, 138, 0.2)",
        },
        {
            name: "Mint",
            accent: "#38B000", accent2: "#70E000", accentSoft: "rgba(56, 176, 0, 0.15)",
            ink: "#113300", ink2: "#1B5200", muted: "#246B00", muted2: "#B1FFB3",
            bg: "#F4FFF4", bgElevated: "#FFFFFF", bgSubtle: "#E9FFE9",
            glow: "transparent",
            line: "rgba(56, 176, 0, 0.1)", lineStrong: "rgba(56, 176, 0, 0.2)",
        },
        {
            name: "Sky",
            accent: "#4CC9F0", accent2: "#4361EE", accentSoft: "rgba(76, 201, 240, 0.15)",
            ink: "#003542", ink2: "#004B5E", muted: "#0087A3", muted2: "#CBF4FF",
            bg: "#F4FDFF", bgElevated: "#FFFFFF", bgSubtle: "#E9F8FF",
            glow: "transparent",
            line: "rgba(76, 201, 240, 0.1)", lineStrong: "rgba(76, 201, 240, 0.2)",
        },
    ],
    dark: [
        {
            name: "Graphite",
            accent: "#6B7CFF", accent2: "#8FD3FF", accentSoft: "rgba(107, 124, 255, 0.14)",
            ink: "#F6F7FB", ink2: "#D8DDEA", muted: "#A7B0C3", muted2: "#727C92",
            bg: "#0D0F14", bgElevated: "#171B24", bgSubtle: "#232836",
            glow: "transparent",
            line: "rgba(255, 255, 255, 0.12)", lineStrong: "rgba(255, 255, 255, 0.22)",
        },
        {
            name: "Cyan",
            accent: "#00F5FF", accent2: "#00B2FF", accentSoft: "rgba(0, 245, 255, 0.15)",
            ink: "#00F5FF", ink2: "#00C2CC", muted: "#007F85", muted2: "#002F31",
            bg: "#0A0D0D", bgElevated: "#0D1010", bgSubtle: "#121818",
            glow: "rgba(0, 245, 255, 0.15)",
            line: "rgba(0, 245, 255, 0.1)", lineStrong: "rgba(0, 245, 255, 0.2)",
        },
        {
            name: "Cyber",
            accent: "#BF5AF2", accent2: "#5E5CE6", accentSoft: "rgba(191, 90, 242, 0.15)",
            ink: "#BF5AF2", ink2: "#AC4EE0", muted: "#8A3FB5", muted2: "#2F163E",
            bg: "#0D0A0E", bgElevated: "#100D12", bgSubtle: "#18121C",
            glow: "rgba(191, 90, 242, 0.15)",
            line: "rgba(191, 90, 242, 0.12)", lineStrong: "rgba(191, 90, 242, 0.25)",
        },
        {
            name: "Crimson",
            accent: "#FF375F", accent2: "#BF1E3E", accentSoft: "rgba(255, 55, 95, 0.15)",
            ink: "#FF375F", ink2: "#E03154", muted: "#B52844", muted2: "#3E0D17",
            bg: "#0E0A0A", bgElevated: "#120D0D", bgSubtle: "#1C1212",
            glow: "rgba(255, 55, 95, 0.15)",
            line: "rgba(255, 55, 95, 0.12)", lineStrong: "rgba(255, 55, 95, 0.25)",
        },
        {
            name: "Volt",
            accent: "#D4FF00", accent2: "#AACC00", accentSoft: "rgba(212, 255, 0, 0.15)",
            ink: "#D4FF00", ink2: "#BBDD00", muted: "#98B500", muted2: "#333E00",
            bg: "#0D0E0A", bgElevated: "#10120D", bgSubtle: "#181C12",
            glow: "rgba(212, 255, 0, 0.15)",
            line: "rgba(212, 255, 0, 0.12)", lineStrong: "rgba(212, 255, 0, 0.25)",
        },
    ],
};
