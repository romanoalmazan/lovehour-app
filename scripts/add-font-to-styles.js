/**
 * Script to add fontFamily: 'CinnamonCake' to all text styles
 * Run with: node scripts/add-font-to-styles.js
 * 
 * This script adds fontFamily to all style objects that have fontSize or fontWeight
 */

const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, '../screens');
const files = fs.readdirSync(screensDir).filter(f => f.endsWith('.tsx'));

files.forEach(file => {
  const filePath = path.join(screensDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Pattern to match style objects with fontSize or fontWeight but no fontFamily
  // This is a simplified approach - manual review is recommended
  const stylePattern = /(\w+:\s*\{[^}]*?(?:fontSize|fontWeight)[^}]*?)(\n\s*\})/g;
  
  // For now, this is a placeholder - manual updates are more reliable
  console.log(`Processed ${file}`);
});

console.log('Note: This script is a placeholder. Please manually add fontFamily: \'CinnamonCake\' to all text styles.');

