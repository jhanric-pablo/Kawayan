#!/usr/bin/env node
/**
 * Generates md/SYSTEM_GUIDE.pdf from md/SYSTEM_GUIDE.md using Chrome headless.
 * Usage: npm run guide:system-pdf
 */
import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const mdPath = path.join(root, 'md', 'SYSTEM_GUIDE.md');
const htmlPath = path.join(root, 'md', 'SYSTEM_GUIDE.html');
const pdfPath = path.join(root, 'md', 'SYSTEM_GUIDE.pdf');

if (!fs.existsSync(mdPath)) {
  console.error('Missing:', mdPath);
  process.exit(1);
}

const md = fs.readFileSync(mdPath, 'utf8');

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inlineFormat(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function mdTableToHtml(block) {
  const lines = block.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return `<pre>${escapeHtml(block)}</pre>`;
  const rows = lines
    .filter((l) => !/^\|[\s\-:|]+\|$/.test(l.trim()))
    .map((l) =>
      l
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim())
    );
  const [head, ...body] = rows;
  const thead = `<thead><tr>${head.map((c) => `<th>${inlineFormat(c)}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inlineFormat(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return `<table>${thead}${tbody}</table>`;
}

function mdToHtml(source) {
  const parts = source.split(/(```[\s\S]*?```)/g);
  let html = '';
  for (const part of parts) {
    if (part.startsWith('```')) {
      const m = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
      if (m && m[1] === 'mermaid') {
        html += `<pre class="mermaid">${escapeHtml(m[2].trim())}</pre>\n`;
      } else {
        html += `<pre><code>${escapeHtml((m && m[2]) || part)}</code></pre>\n`;
      }
      continue;
    }
    const blocks = part.split(/\n\n+/);
    for (const block of blocks) {
      const t = block.trim();
      if (!t) continue;
      if (t.startsWith('# ')) {
        html += `<h1>${inlineFormat(t.slice(2))}</h1>\n`;
      } else if (t.startsWith('## ')) {
        html += `<h2>${inlineFormat(t.slice(3))}</h2>\n`;
      } else if (t.startsWith('### ')) {
        html += `<h3>${inlineFormat(t.slice(4))}</h3>\n`;
      } else if (t.startsWith('#### ')) {
        html += `<h4>${inlineFormat(t.slice(5))}</h4>\n`;
      } else if (t.startsWith('> ')) {
        html += `<blockquote>${inlineFormat(t.replace(/^>\s?/gm, ''))}</blockquote>\n`;
      } else if (t.startsWith('|')) {
        html += mdTableToHtml(t) + '\n';
      } else if (/^[-*] /.test(t)) {
        html += '<ul>' + t.split('\n').map((l) => `<li>${inlineFormat(l.replace(/^[-*] /, ''))}</li>`).join('') + '</ul>\n';
      } else if (/^\d+\. /.test(t)) {
        html += '<ol>' + t.split('\n').map((l) => `<li>${inlineFormat(l.replace(/^\d+\.\s*/, ''))}</li>`).join('') + '</ol>\n';
      } else if (t === '---') {
        html += '<hr/>\n';
      } else {
        html += `<p>${inlineFormat(t.replace(/\n/g, ' '))}</p>\n`;
      }
    }
  }
  return html;
}

const body = mdToHtml(md);
const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Kawayan AI — System Guide</title>
  <style>
    @page { margin: 18mm 16mm; size: A4; }
    body {
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      font-size: 10.5pt;
      line-height: 1.55;
      color: #1a2e28;
      max-width: 100%;
    }
    h1 { font-size: 22pt; color: #2B5748; border-bottom: 2px solid #9CB080; padding-bottom: 0.3em; page-break-before: always; }
    h1:first-of-type { page-break-before: avoid; }
    h2 { font-size: 14pt; color: #2B5748; margin-top: 1.4em; }
    h3 { font-size: 12pt; color: #3d6b5a; }
    h4 { font-size: 11pt; }
    table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 9pt; }
    th, td { border: 1px solid #c5d4c8; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #e8f0ea; font-weight: 600; }
    tr:nth-child(even) td { background: #f7faf8; }
    code, pre { font-family: "SF Mono", Consolas, monospace; font-size: 9pt; }
    pre { background: #f0f4f2; padding: 10px; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; }
    blockquote { border-left: 4px solid #9CB080; margin: 1em 0; padding: 0.5em 1em; background: #f7faf8; color: #3d4a44; }
    hr { border: none; border-top: 1px solid #c5d4c8; margin: 2em 0; }
    ul, ol { padding-left: 1.4em; }
    li { margin: 0.25em 0; }
    .mermaid { background: #fafcfa; border: 1px dashed #9CB080; font-size: 8pt; }
  </style>
</head>
<body>
${body}
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: true, theme: 'neutral', securityLevel: 'loose' });
</script>
</body>
</html>`;

fs.writeFileSync(htmlPath, fullHtml, 'utf8');
console.log('Wrote', htmlPath);

const chromePaths = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'google-chrome',
  'chromium',
  'chromium-browser',
];

let chrome = null;
for (const p of chromePaths) {
  try {
    if (p.startsWith('/')) {
      if (fs.existsSync(p)) chrome = p;
    } else {
      execSync(`which ${p}`, { stdio: 'ignore' });
      chrome = p;
    }
    if (chrome) break;
  } catch {
    /* try next */
  }
}

if (!chrome) {
  console.error('Chrome/Chromium not found. Open md/SYSTEM_GUIDE.html and print to PDF manually.');
  process.exit(0);
}

const fileUrl = `file://${htmlPath}`;
const result = spawnSync(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=15000',
    `--print-to-pdf=${pdfPath}`,
    fileUrl,
  ],
  { stdio: 'inherit' }
);

if (result.status === 0 && fs.existsSync(pdfPath)) {
  console.log('Wrote', pdfPath);
} else {
  console.error('PDF generation failed. Use md/SYSTEM_GUIDE.html → Print to PDF.');
  process.exit(result.status || 1);
}
