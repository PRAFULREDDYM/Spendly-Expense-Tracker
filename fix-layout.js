const fs = require('fs');

// Fix index.css
let css = fs.readFileSync('src/index.css', 'utf8');
const lines = css.split('\n');

// Extract the bottom-nav and chatbot-fab block (from line 654 to 762 roughly, let's locate it safely)
const startIdx = lines.findIndex(l => l.includes('.app-bottom-nav,'));
const endIdx = lines.findIndex(l => l.includes('.chatbot-fab svg,')) + 6;

if (startIdx !== -1 && endIdx > startIdx) {
  let navBlock = lines.slice(startIdx, endIdx).join('\n');
  
  // Remove block from its current place
  lines.splice(startIdx, endIdx - startIdx);
  
  // Convert fixed to absolute so it anchors to .app-shell
  navBlock = navBlock.replace(/position:\s*fixed;/g, 'position: absolute;');
  
  // Find the @media (min-width: 768px) block to insert the navBlock BEFORE it
  const mediaIdx = lines.findIndex(l => l.includes('@media (min-width: 768px) {'));
  if (mediaIdx !== -1) {
    // Insert the nav block right above the media query
    lines.splice(mediaIdx, 0, navBlock + '\n');
  }
}

// Now replace the desktop media query layout
let cssModified = lines.join('\n');
const desktopOld = `@media (min-width: 768px) {
  .app-shell {
    display: flex;
    flex-direction: row;
    height: 100vh;
    overflow: hidden;
    width: 100vw;
  }

  .app-sidebar {
    width: var(--sidebar-w);
    flex-shrink: 0;
    height: 100vh;
    overflow-y: auto;
    position: sticky;
    top: 0;
    left: 0;
    order: -1;
    display: flex;
  }

  .app-main {
    flex: 1;
    min-width: 0;
    overflow-x: hidden;
    overflow-y: auto;
    height: 100vh;
  }

  .app-bottom-nav,
  .bottom-nav,
  .fab-add {
    display: none !important;
  }

  .chatbot-fab {
    right: 24px;
    bottom: 24px;
    width: 52px;
    height: 52px;
    animation: none;
    box-shadow:
      0 0 0 2px var(--bg-card),
      0 0 0 2px var(--accent),
      0 0 12px rgba(79, 107, 255, 0.35),
      0 4px 16px rgba(0, 0, 0, 0.25);
  }
}`;

const desktopNew = `@media (min-width: 768px) {
  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
    position: relative;
    border-left: 1px solid var(--border-md);
    border-right: 1px solid var(--border-md);
    box-shadow: var(--shadow);
  }

  .app-main {
    flex: 1;
    min-width: 0;
    overflow-x: hidden;
    overflow-y: auto;
    height: 100vh;
    padding-bottom: var(--nav-total);
    -webkit-overflow-scrolling: touch;
  }

  .chatbot-fab {
    right: 24px;
    bottom: calc(var(--nav-total) + 24px);
    width: 52px;
    height: 52px;
    animation: none;
    box-shadow:
      0 0 0 2px var(--bg-card),
      0 0 0 2px var(--accent),
      0 0 12px rgba(79, 107, 255, 0.35),
      0 4px 16px rgba(0, 0, 0, 0.25);
  }
}`;

cssModified = cssModified.replace(desktopOld, desktopNew);
fs.writeFileSync('src/index.css', cssModified);


// Fix shell.tsx
let shell = fs.readFileSync('src/components/shell.tsx', 'utf8');
const asideRegex = /<aside className="app-sidebar[\s\S]*?<\/aside>/;
shell = shell.replace(asideRegex, '');
fs.writeFileSync('src/components/shell.tsx', shell);

console.log('Fixed exactly as requested.');
