"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

type UserAvatarProps = {
  src?: string | null;
  name?: string | null;
  alt?: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
};

function initialsFor(name?: string | null) {
  const text = String(name || "").trim();
  if (!text) return "U";
  const parts = text.split(/\s+/).slice(0, 2);
  const joined = parts.map((part) => part[0] || "").join("").toUpperCase();
  return joined || text.slice(0, 1).toUpperCase();
}

export function UserAvatar({
  src,
  name,
  alt,
  size = 36,
  className,
  style,
}: UserAvatarProps) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [src]);

  const initials = useMemo(() => initialsFor(name), [name]);
  const showImage = !!src && !broken;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
        color: "#fff",
        fontWeight: 800,
        fontSize: Math.max(11, Math.floor(size * 0.38)),
        lineHeight: 1,
        flexShrink: 0,
        ...style,
      }}
      aria-label={alt || name || "User avatar"}
    >
      {showImage ? (
        <img
          src={src || ""}
          alt={alt || name || "Profile"}
          onError={() => setBroken(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
