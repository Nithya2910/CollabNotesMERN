import { useRef, useState, useEffect, useCallback } from 'react';
import { uploadAPI } from '../services/api';
import toast from 'react-hot-toast';

const COLORS = ['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff'];
const BRUSH_SIZES = [2, 5, 10, 18, 28];

/**
 * DrawingCanvas
 * Full-screen drawing overlay. On "Insert", uploads the canvas as PNG
 * and calls onInsert(markdownString). On Cancel, calls onClose().
 */
const DrawingCanvas = ({ onInsert, onClose }) => {
  const canvasRef = useRef(null);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [tool, setTool] = useState('pen'); // 'pen' | 'eraser'
  const [drawing, setDrawing] = useState(false);
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const lastPos = useRef(null);

  // Fill canvas white on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top)  * scaleY,
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const pos = getPos(e, canvas);
    // Snapshot for undo
    const ctx = canvas.getContext('2d');
    setHistory((h) => [...h, ctx.getImageData(0, 0, canvas.width, canvas.height)]);
    lastPos.current = pos;
    setDrawing(true);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!drawing || !lastPos.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineWidth = tool === 'eraser' ? brushSize * 3 : brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDrawing = () => {
    setDrawing(false);
    lastPos.current = null;
  };

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const prev = history[history.length - 1];
    ctx.putImageData(prev, 0, 0);
    setHistory((h) => h.slice(0, -1));
  }, [history]);

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    setHistory((h) => [...h, ctx.getImageData(0, 0, canvas.width, canvas.height)]);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleInsert = async () => {
    setSaving(true);
    const toastId = toast.loading('Saving drawing…');
    try {
      const canvas = canvasRef.current;
      // Convert canvas to Blob then upload as a PNG file
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], `drawing-${Date.now()}.png`, { type: 'image/png' });
      const { data } = await uploadAPI.uploadFile(file);
      const decodedUrl = encodeURI(data.url);
      const md = `![drawing](${decodedUrl})`;
      toast.success('Drawing inserted!', { id: toastId });
      onInsert(md);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save drawing', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  // Keyboard shortcut: Ctrl+Z = undo
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') undo();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700"
           style={{ width: '90vw', maxWidth: 960, height: '90vh' }}>

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-wrap">

          {/* Title */}
          <span className="font-semibold text-gray-800 dark:text-white text-sm hidden sm:block">🖊 Drawing Canvas</span>

          <div className="h-5 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />

          {/* Tool: pen / eraser */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              id="draw-pen-btn"
              onClick={() => setTool('pen')}
              title="Pen"
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                tool === 'pen' ? 'bg-white dark:bg-gray-700 shadow text-brand-600 dark:text-brand-400' : 'text-gray-500'
              }`}
            >✏️ Pen</button>
            <button
              id="draw-eraser-btn"
              onClick={() => setTool('eraser')}
              title="Eraser"
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                tool === 'eraser' ? 'bg-white dark:bg-gray-700 shadow text-brand-600 dark:text-brand-400' : 'text-gray-500'
              }`}
            >◻ Eraser</button>
          </div>

          {/* Color palette */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                id={`draw-color-${c.replace('#', '')}`}
                onClick={() => { setColor(c); setTool('pen'); }}
                title={c}
                style={{ background: c, border: color === c && tool === 'pen' ? '3px solid #6366f1' : '2px solid #d1d5db' }}
                className="w-6 h-6 rounded-full transition-transform hover:scale-110 focus:outline-none"
              />
            ))}
          </div>

          {/* Brush size */}
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Size</span>
            <input
              type="range"
              min={1}
              max={40}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-24 accent-brand-600"
              title={`Brush size: ${brushSize}px`}
            />
            <span className="w-5 text-center">{brushSize}</span>
          </div>

          <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />

          {/* Undo / Clear */}
          <button
            id="draw-undo-btn"
            onClick={undo}
            disabled={history.length === 0}
            className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
            title="Undo (Ctrl+Z)"
          >↩ Undo</button>
          <button
            id="draw-clear-btn"
            onClick={clear}
            className="btn-secondary text-xs py-1.5 px-3 text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20"
          >🗑 Clear</button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Cancel / Insert */}
          <button id="draw-cancel-btn" onClick={onClose} className="btn-secondary text-sm py-1.5 px-4">Cancel</button>
          <button
            id="draw-insert-btn"
            onClick={handleInsert}
            disabled={saving}
            className="btn-primary text-sm py-1.5 px-4 disabled:opacity-60"
          >
            {saving ? 'Saving…' : '✓ Insert'}
          </button>
        </div>

        {/* ── Canvas ── */}
        <div className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-2">
          <canvas
            ref={canvasRef}
            width={1400}
            height={900}
            className="bg-white rounded-lg shadow-inner cursor-crosshair max-w-full max-h-full"
            style={{ touchAction: 'none' }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
      </div>
    </div>
  );
};

export default DrawingCanvas;
