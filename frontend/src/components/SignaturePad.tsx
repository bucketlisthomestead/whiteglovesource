import { forwardRef, useImperativeHandle, useRef, useEffect, useCallback } from 'react';
import { Eraser } from 'lucide-react';

export type SignaturePadHandle = {
  clear: () => void;
  isEmpty: () => boolean;
  toDataUrl: () => string | null;
};

interface SignaturePadProps {
  disabled?: boolean;
  className?: string;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad({ disabled = false, className = '' }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const emptyRef = useRef(true);

    const getCtx = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return canvas.getContext('2d');
    }, []);

    const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#1a1a1a';
      }
      emptyRef.current = true;
    }, []);

    useEffect(() => {
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      return () => window.removeEventListener('resize', resizeCanvas);
    }, [resizeCanvas]);

    useImperativeHandle(ref, () => ({
      clear: () => {
        const canvas = canvasRef.current;
        const ctx = getCtx();
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        emptyRef.current = true;
      },
      isEmpty: () => emptyRef.current,
      toDataUrl: () => {
        const canvas = canvasRef.current;
        if (!canvas || emptyRef.current) return null;
        return canvas.toDataURL('image/png');
      },
    }));

    const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return;
      drawingRef.current = true;
      const ctx = getCtx();
      if (!ctx) return;
      const { x, y } = pos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      canvasRef.current?.setPointerCapture(e.pointerId);
    };

    const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current || disabled) return;
      const ctx = getCtx();
      if (!ctx) return;
      const { x, y } = pos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      emptyRef.current = false;
    };

    const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      try {
        canvasRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    return (
      <div className={className}>
        <div className="relative border border-cream-dark bg-white">
          <canvas
            ref={canvasRef}
            className={`w-full h-32 touch-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-crosshair'}`}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => {
                const canvas = canvasRef.current;
                const ctx = getCtx();
                if (!canvas || !ctx) return;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                emptyRef.current = true;
              }}
              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-wider bg-cream border border-cream-dark text-charcoal/60 hover:text-charcoal min-h-[32px]"
            >
              <Eraser size={12} /> Clear
            </button>
          )}
        </div>
      </div>
    );
  },
);
