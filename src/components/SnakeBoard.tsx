import { useEffect, useRef } from "react";
import type { GameState } from "@/services/types";

const CELL = 20;

export function SnakeBoard({ state }: { state: GameState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = state.width * CELL;
    const h = state.height * CELL;

    // bg
    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    for (let i = 0; i <= state.width; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, h);
      ctx.stroke();
    }
    for (let j = 0; j <= state.height; j++) {
      ctx.beginPath();
      ctx.moveTo(0, j * CELL);
      ctx.lineTo(w, j * CELL);
      ctx.stroke();
    }

    // food
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(
      state.food.x * CELL + CELL / 2,
      state.food.y * CELL + CELL / 2,
      CELL / 2 - 2,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    // snake
    state.snake.forEach((c, i) => {
      ctx.fillStyle = i === 0 ? "#10b981" : "#34d399";
      ctx.fillRect(c.x * CELL + 1, c.y * CELL + 1, CELL - 2, CELL - 2);
    });

    if (!state.alive) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 28px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Game Over", w / 2, h / 2);
    }
  }, [state]);

  return (
    <canvas
      ref={canvasRef}
      width={state.width * CELL}
      height={state.height * CELL}
      className="rounded-md border border-border shadow-lg"
      data-testid="snake-board"
    />
  );
}
