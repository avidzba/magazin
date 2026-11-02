import React, { useState, useEffect, useRef, useCallback } from 'react';

interface ResizableSplitPaneProps {
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
  defaultRightWidth?: number;
  minRightWidth?: number;
  maxRightWidthRatio?: number;
  storageKey?: string;
  className?: string;
}

export const ResizableSplitPane: React.FC<ResizableSplitPaneProps> = ({
  leftContent,
  rightContent,
  defaultRightWidth = 400,
  minRightWidth = 300,
  maxRightWidthRatio = 0.5,
  storageKey = 'pos_receipt_width',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  // Initialize right width from localStorage or default
  const [rightWidth, setRightWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= minRightWidth) {
          return parsed;
        }
      }
    } catch (_) {}
    return defaultRightWidth;
  });

  const [isDragging, setIsDragging] = useState(false);

  // Handle window resize to toggle desktop layout
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;

      // Calculate width from the right edge of container
      const newWidth = containerRect.right - e.clientX;
      const maxWidth = Math.max(minRightWidth, Math.floor(containerWidth * maxRightWidthRatio));
      const clampedWidth = Math.min(Math.max(newWidth, minRightWidth), maxWidth);

      setRightWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      try {
        localStorage.setItem(storageKey, String(rightWidth));
      } catch (_) {}
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, rightWidth, minRightWidth, maxRightWidthRatio, storageKey]);

  // Double click resets to default
  const handleDoubleClick = () => {
    setRightWidth(defaultRightWidth);
    try {
      localStorage.setItem(storageKey, String(defaultRightWidth));
    } catch (_) {}
  };

  return (
    <div
      ref={containerRef}
      className={`flex-1 flex flex-col lg:flex-row w-full h-full min-h-0 overflow-hidden relative ${className}`}
    >
      {/* Left Column (Catalog) */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {leftContent}
      </div>

      {/* Draggable Divider (Desktop lg+) */}
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        title="Потяните, чтобы изменить ширину чека (двойной клик — сброс на 400px)"
        className={`hidden lg:flex w-2 shrink-0 bg-slate-200 hover:bg-blue-500/30 active:bg-blue-600/50 cursor-col-resize items-center justify-center transition-colors group select-none relative z-20 ${
          isDragging ? 'bg-blue-500/40 ring-1 ring-blue-500' : ''
        }`}
      >
        {/* Subtle center grip pill */}
        <div
          className={`w-1 rounded-full transition-all ${
            isDragging
              ? 'bg-blue-600 h-16'
              : 'bg-slate-400 group-hover:bg-blue-600 h-10 group-hover:h-14'
          }`}
        />
      </div>

      {/* Right Column (Receipt / Cart) */}
      <div
        style={{
          width: isDesktop ? `${rightWidth}px` : '100%',
          flexShrink: 0,
        }}
        className="w-full lg:shrink-0 flex flex-col h-full min-h-0 border-t lg:border-t-0 lg:border-l border-slate-200 shadow-lg select-none"
      >
        {rightContent}
      </div>
    </div>
  );
};
