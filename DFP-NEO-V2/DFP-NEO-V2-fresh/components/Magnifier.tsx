import React, { useState, useEffect, useRef } from 'react';

interface MagnifierProps {
  isEnabled: boolean;
}

const LENS_SIZE = 200; // Diameter of the magnifying glass in pixels
const ZOOM_LEVEL = 2;   // How much to magnify the content

const Magnifier: React.FC<MagnifierProps> = ({ isEnabled }) => {
  const [position, setPosition] = useState({ x: -1000, y: -1000 });
  const lensRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cloneRef = useRef<Node | null>(null);
  
  // Use a ref to hold the latest position, accessible from the animation loop without dependencies.
  const positionRef = useRef(position);
  positionRef.current = position;

  useEffect(() => {
    const appContent = document.getElementById('app-content');
    if (!appContent || !contentRef.current) return;
    
    if (isEnabled) {
      document.body.style.cursor = 'none';
      requestAnimationFrame(() => {
        cloneRef.current = appContent.cloneNode(true);
        if (contentRef.current) {
            while(contentRef.current.firstChild) {
                contentRef.current.removeChild(contentRef.current.firstChild);
            }
            contentRef.current.appendChild(cloneRef.current);
        }
      });
    } else {
      document.body.style.cursor = 'default';
      cloneRef.current = null;
      if (contentRef.current) {
        while(contentRef.current.firstChild) {
            contentRef.current.removeChild(contentRef.current.firstChild);
        }
      }
    }

    return () => {
        document.body.style.cursor = 'default';
    }
  }, [isEnabled]);


  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        setPosition({ x: e.clientX, y: e.clientY });
    };
    
    if (isEnabled) {
      window.addEventListener('mousemove', handleMouseMove);
    } else {
      setPosition({ x: -1000, y: -1000 });
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isEnabled]);
  
  useEffect(() => {
    if (!isEnabled) return;

    let animationFrameId: number;

    const updateLoop = () => {
        const lens = lensRef.current;
        const contentContainer = contentRef.current;
        const appContent = document.getElementById('app-content');
        if (!lens || !contentContainer || !appContent || !cloneRef.current) {
            animationFrameId = requestAnimationFrame(updateLoop);
            return;
        }

        const currentPosition = positionRef.current;
        
        // --- SCROLL SYNC ---
        const originalScrollables = appContent.querySelectorAll('.overflow-auto');
        const clonedScrollables = contentContainer.querySelectorAll('.overflow-auto');
        originalScrollables.forEach((originalEl, index) => {
            if (clonedScrollables[index]) {
                clonedScrollables[index].scrollTop = originalEl.scrollTop;
                clonedScrollables[index].scrollLeft = originalEl.scrollLeft;
            }
        });

        // --- POSITIONING ---
        lens.style.left = `${currentPosition.x - LENS_SIZE / 2}px`;
        lens.style.top = `${currentPosition.y - LENS_SIZE / 2}px`;

        const appContentRect = appContent.getBoundingClientRect();
        const contentRelativeX = currentPosition.x - appContentRect.left;
        const contentRelativeY = currentPosition.y - appContentRect.top;

        const tx = (LENS_SIZE / 2) / ZOOM_LEVEL - contentRelativeX;
        const ty = (LENS_SIZE / 2) / ZOOM_LEVEL - contentRelativeY;
        
        contentContainer.style.transform = `scale(${ZOOM_LEVEL}) translate(${tx}px, ${ty}px)`;
        
        animationFrameId = requestAnimationFrame(updateLoop);
    };

    updateLoop();

    return () => {
        cancelAnimationFrame(animationFrameId);
    };

  }, [isEnabled]);

  if (!isEnabled) {
    return null;
  }

  return (
    <div
      ref={lensRef}
      style={{
        position: 'fixed',
        width: `${LENS_SIZE}px`,
        height: `${LENS_SIZE}px`,
        borderRadius: '50%',
        border: '3px solid white',
        boxShadow: '0 5px 15px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 1000,
        willChange: 'transform',
        backgroundColor: 'rgba(31, 41, 55, 1)', // bg-gray-800
      }}
    >
      <div
        ref={contentRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          transformOrigin: 'top left',
          willChange: 'transform',
        }}
      >
        {/* The cloned content will be appended here by the useEffect hook */}
      </div>
    </div>
  );
};

export default Magnifier;
