import fs from 'fs';

const indexPath = 'dfp-neo-platform/public/flight-school-app/index.html';
const indexV2Path = 'dfp-neo-platform/public/flight-school-app/index-v2.html';

function updateCSS(content) {
  // 1. Update .btn-aluminium-brushed.active to use #a0a0a0 background
  const oldActivePattern = /\.btn-aluminium-brushed\.active, \.btn-aluminium-brushed:active \{\s*background-image: linear-gradient\(to right, #9ca3af, #d1d5db, #9ca3af\);\s*box-shadow: inset 0 1px 2px rgba\(0,0,0,0\.2\);\s*border-top-color: #9ca3af;\s*border-bottom-color: #d1d5db;\s*border-left-color: #9ca3af;\s*border-right-color: #9ca3af;\s*transform: none;/gs;
  
  const newActive = `.btn-aluminium-brushed.active, .btn-aluminium-brushed:active {
    background-color: #a0a0a0;
    background-image: none;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);
    border-top-color: #909090;
    border-bottom-color: #b0b0b0;
    border-left-color: #909090;
    border-right-color: #909090;
    transform: none;`;
  
  content = content.replace(oldActivePattern, newActive);
  
  // 2. Add NEO-Tile pulsing animation CSS
  const neoAnimationCSS = `
  @keyframes pulse-neo-text {
    0%, 100% { color: #fb923c; text-shadow: 0 0 4px rgba(251, 146, 60, 0.6); }
    50% { color: #fdba74; text-shadow: 0 0 8px rgba(251, 146, 60, 1); }
  }
  .animate-pulse-neo-text { animation: pulse-neo-text 1s ease-in-out infinite; }
  .neo-tile-text { color: #fb923c; }`;
  
  // Insert after .no-select class
  const noSelectPattern = /(\.no-select \{[^}]+\})/;
  content = content.replace(noSelectPattern, '$1' + neoAnimationCSS);
  
  return content;
}

try {
  if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, 'utf8');
    content = updateCSS(content);
    fs.writeFileSync(indexPath, content);
    console.log('✅ Updated index.html successfully!');
  }
  
  if (fs.existsSync(indexV2Path)) {
    let content = fs.readFileSync(indexV2Path, 'utf8');
    content = updateCSS(content);
    fs.writeFileSync(indexV2Path, content);
    console.log('✅ Updated index-v2.html successfully!');
  }
  
  console.log('✅ All CSS updates complete!');
} catch (err) {
  console.error('Error updating CSS:', err);
  process.exit(1);
}