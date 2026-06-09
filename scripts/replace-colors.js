const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/app/admin/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace background gradients
content = content.replace(/from-indigo-900\/10/g, 'from-slate-900/10');
content = content.replace(/from-violet-900\/10/g, 'from-slate-800/10');
content = content.replace(/from-indigo-500\/5/g, 'from-slate-500/5');
content = content.replace(/from-indigo-500\/10/g, 'from-slate-500/10');

// Replace button gradients
content = content.replace(/from-indigo-500 to-violet-600/g, 'from-slate-900 to-slate-800 dark:from-slate-700 dark:to-slate-800');
content = content.replace(/hover:from-indigo-400 hover:to-violet-500/g, 'hover:from-slate-800 hover:to-slate-700 dark:hover:from-slate-600 dark:hover:to-slate-700');

// Replace shadows
content = content.replace(/shadow-indigo-500\/25/g, 'shadow-slate-500/20 dark:shadow-black/40');
content = content.replace(/shadow-indigo-500\/5/g, 'shadow-slate-500/5');
content = content.replace(/shadow-\[0_0_15px_rgba\(99,102,241,0\.15\)\]/g, 'shadow-[0_0_15px_rgba(0,0,0,0.1)] dark:shadow-[0_0_15px_rgba(255,255,255,0.05)]');
content = content.replace(/shadow-\[0_0_15px_rgba\(99,102,241,0\.2\)\]/g, 'shadow-[0_0_15px_rgba(0,0,0,0.15)]');
content = content.replace(/shadow-\[0_0_15px_rgba\(99,102,241,0\.1\)\]/g, 'shadow-[0_0_15px_rgba(255,255,255,0.05)]');

// Replace text/borders/bg
content = content.replace(/text-indigo-600/g, 'text-slate-800 dark:text-slate-300');
content = content.replace(/text-indigo-400/g, 'text-slate-500 dark:text-slate-400');
content = content.replace(/text-indigo-700/g, 'text-slate-900 dark:text-slate-200');

content = content.replace(/bg-indigo-50/g, 'bg-slate-100');
content = content.replace(/bg-indigo-500\/10/g, 'bg-slate-500/10');
content = content.replace(/bg-indigo-500\/20/g, 'bg-slate-500/20');
content = content.replace(/bg-indigo-950\/30/g, 'bg-slate-800/30');

content = content.replace(/border-indigo-500/g, 'border-slate-400 dark:border-slate-500');
content = content.replace(/border-indigo-400/g, 'border-slate-300 dark:border-slate-600');

// Focus rings
content = content.replace(/focus:border-indigo-500/g, 'focus:border-slate-600 dark:focus:border-slate-400');
content = content.replace(/focus:ring-indigo-500\/10/g, 'focus:ring-slate-500/10');
content = content.replace(/focus:ring-indigo-500\/20/g, 'focus:ring-slate-500/20');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Colors replaced successfully.');
