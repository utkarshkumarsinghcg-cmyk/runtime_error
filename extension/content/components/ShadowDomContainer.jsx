import React, { useRef, useEffect, useState } from 'react';
  import ReactDOM from 'react-dom';
  import tailwindStyles from '../tailwind.css?inline';

  export default function ShadowDomContainer({ children }) {
    const hostRef = useRef(null);
    const [shadowAnchor, setShadowAnchor] = useState(null);

    useEffect(() => {
      if (!hostRef.current || shadowAnchor) return;

      const host = hostRef.current;
      // Attach closed Shadow DOM
      const shadowRoot = host.attachShadow({ mode: 'closed' });

      // Create style element and inject Tailwind styles
      const style = document.createElement('style');
      style.textContent = tailwindStyles;
      shadowRoot.appendChild(style);

      // Create anchor element for React portal
      const anchor = document.createElement('div');
      anchor.id = 'ai-companion-anchor';
      anchor.className = 'w-full h-full';
      shadowRoot.appendChild(anchor);

      setShadowAnchor(anchor);
    }, [shadowAnchor]);

    return (
      <ai-companion-root ref={hostRef} style={{ display: 'contents' }}>
        {shadowAnchor && ReactDOM.createPortal(children, shadowAnchor)}
      </ai-companion-root>
    );
  }
