"use client";

import { useEffect, useState } from "react";
import CommandPalette from "./CommandPalette";

export default function CommandPaletteProvider() {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setIsPaletteOpen(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key?.toLowerCase() === "k") {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener("open-command-palette", handleOpen);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("open-command-palette", handleOpen);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} />;
}
