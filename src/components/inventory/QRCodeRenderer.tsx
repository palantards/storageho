"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QRCodeRenderer({ value, size = 160 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    QRCode.toString(value, { type: "svg", width: size, margin: 1 })
      .then(setSvg)
      .catch((error) => {
        console.error(error);
        setSvg("");
      });
  }, [value, size]);

  if (!svg) {
    return <div className="h-40 w-40 animate-pulse rounded-md bg-muted" />;
  }

  return (
    <div
      className="rounded-md border bg-white p-2"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
