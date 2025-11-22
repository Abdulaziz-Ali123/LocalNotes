import React, { useEffect, useRef, useState } from "react";

interface Stroke {
  color: string;
  size: number;
  points: Array<{ x: number; y: number }>;
}

interface CanvasDoc {
  width?: number;
  height?: number;
  background?: string;
  strokes: Stroke[];
}

interface CanvasEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  isSaving?: boolean;
}

const CanvasEditor: React.FC<CanvasEditorProps> = ({ value, onChange, onSave, isSaving }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentColor, setCurrentColor] = useState<string>("#111827"); // near text-foreground in dark themes
  const [currentSize, setCurrentSize] = useState<number>(4);
  const [background, setBackground] = useState<string>("#ffffff");

  // Load initial value
  useEffect(() => {
    if (!value) return;
    try {
      const parsed: CanvasDoc = JSON.parse(value);
      setStrokes(Array.isArray(parsed.strokes) ? parsed.strokes : []);
      if (parsed.background) setBackground(parsed.background);
    } catch {
      // If not JSON, ignore (could be empty file); start fresh
    }
  }, [value]);

  // Resize canvas to fit container
  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    drawAll();
  };

  useEffect(() => {
    resizeCanvas();
    const handle = () => resizeCanvas();
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw entire canvas from strokes
  const drawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear and fill background
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // ensure transform reset
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    const cssWidth = parseFloat(canvas.style.width || `${canvas.width}px`);
    const cssHeight = parseFloat(canvas.style.height || `${canvas.height}px`);

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    for (const stroke of strokes) {
      if (!stroke.points.length) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  };

  useEffect(() => {
    drawAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, background]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = getPos(e);
    const newStroke: Stroke = {
      color: currentColor,
      size: currentSize,
      points: [pos],
    };
    setStrokes((prev) => [...prev, newStroke]);
    setIsDrawing(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const pos = getPos(e);
    setStrokes((prev) => {
      const last = prev[prev.length - 1];
      if (!last) return prev;
      const updated = [...prev];
      updated[updated.length - 1] = {
        ...last,
        points: [...last.points, pos],
      };
      return updated;
    });
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    // Persist to file content
    const canvas = canvasRef.current;
    const width = canvas?.width || 0;
    const height = canvas?.height || 0;
    const doc: CanvasDoc = { width, height, background, strokes };
    onChange(JSON.stringify(doc));
  };

  const handleUndo = () => {
    setStrokes((prev) => prev.slice(0, -1));
    const canvas = canvasRef.current;
    const doc: CanvasDoc = {
      width: canvas?.width || 0,
      height: canvas?.height || 0,
      background,
      strokes: strokes.slice(0, -1),
    };
    onChange(JSON.stringify(doc));
  };

  const handleClear = () => {
    setStrokes([]);
    const canvas = canvasRef.current;
    const doc: CanvasDoc = {
      width: canvas?.width || 0,
      height: canvas?.height || 0,
      background,
      strokes: [],
    };
    onChange(JSON.stringify(doc));
  };

  return (
    <div className="flex flex-col h-full w-full bg-background rounded-lg border border-border overflow-hidden">
      <div className="flex items-center gap-2 p-2 border-b border-border bg-muted">
        <label className="text-xs text-muted-foreground">Color</label>
        <input
          type="color"
          value={currentColor}
          onChange={(e) => setCurrentColor(e.target.value)}
          className="h-6 w-6 p-0 border border-border rounded"
        />
        <label className="text-xs text-muted-foreground ml-2">Size</label>
        <input
          type="range"
          min={1}
          max={24}
          value={currentSize}
          onChange={(e) => setCurrentSize(Number(e.target.value))}
          className="w-24"
        />
        <button
          className="px-2 py-1 text-sm rounded-md bg-background border border-border hover:bg-accent"
          onClick={handleUndo}
          title="Undo last stroke"
        >
          Undo
        </button>
        <button
          className="px-2 py-1 text-sm rounded-md bg-background border border-border hover:bg-accent"
          onClick={handleClear}
          title="Clear canvas"
        >
          Clear
        </button>
      </div>
      <div ref={containerRef} className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none cursor-crosshair"
          onPointerDown={(e) => {
            (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
            startDrawing(e);
          }}
          onPointerMove={draw}
          onPointerUp={endDrawing}
          onPointerLeave={endDrawing}
        />
      </div>
    </div>
  );
};

export default CanvasEditor;