#!/usr/bin/env node
/**
 * .liquid-lint.js — 栈式 Liquid 块标签嵌套校验
 *
 * 比「开闭标签计数」严格：能发现 {% if %}...{% endfor %} 这类错序嵌套、
 * 以及孤立的 {% endif %}。会先把 {% comment %}...{% endcomment %} 整块抹掉
 * （用等量换行占位以保持行号），避免注释里的文字被当成标签。
 *
 * 用法：node scripts/lint-liquid.js .
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = process.argv[2];
if (!root) {
  console.error('用法: node scripts/lint-liquid.js .');
  process.exit(2);
}

const PAIRS = {
  for: 'endfor',
  if: 'endif',
  unless: 'endunless',
  case: 'endcase',
  capture: 'endcapture',
  tablerow: 'endtablerow',
  highlight: 'endhighlight',
  comment: 'endcomment',
  raw: 'endraw',
};
const CLOSERS = new Set(Object.values(PAIRS));
// 这些文件虽以 .md 结尾，但已在 _config.yml 的 exclude 中，Jekyll 不会渲染；
// 文档里出现的 Liquid 示例会造成误报，故跳过。
const SKIP_FILES = new Set(['RESOURCE_CHECKLIST.md', 'README.md']);
const BRANCH = new Set(['else', 'elsif', 'when']);

function listFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, out);
    else if (/\.(html|md|markdown|xml|json)$/i.test(entry.name) && !SKIP_FILES.has(entry.name)) out.push(full);
  }
  return out;
}

/** 把 comment 块替换成等量换行，保持行号不变 */
function stripComments(src) {
  let out = src;
  let guard = 0;
  while (guard++ < 20) {
    const m = /\{%-?\s*comment\s*-?%\}([\s\S]*?)\{%-?\s*endcomment\s*-?%\}/.exec(out);
    if (!m) break;
    const newlines = '\n'.repeat((m[0].match(/\n/g) || []).length);
    out = out.slice(0, m.index) + newlines + out.slice(m.index + m[0].length);
  }
  return out;
}

function lineAt(src, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (src.charCodeAt(i) === 10) line++;
  return line;
}

let problems = 0;
let checked = 0;

for (const file of listFiles(root)) {
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.includes('{%')) continue;
  checked++;

  const src = stripComments(raw);
  const stack = [];

  const re = /\{%-?\s*([\s\S]*?)\s*-?%\}/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const body = m[1].trim();
    if (!body) continue;
    const name = body.split(/[\s(]/)[0];
    const line = lineAt(src, m.index);
    const rel = path.relative(root, file);

    if (PAIRS[name]) {
      stack.push({ name, line });
      continue;
    }

    if (CLOSERS.has(name)) {
      const top = stack.pop();
      if (!top) {
        console.log(`❌ ${rel}:${line}  孤立的 {% ${name} %}（没有对应的开标签）`);
        problems++;
      } else if (PAIRS[top.name] !== name) {
        console.log(
          `❌ ${rel}:${line}  嵌套错序：第 ${top.line} 行的 {% ${top.name} %} 需要 {% ${PAIRS[top.name]} %}，实际是 {% ${name} %}`
        );
        problems++;
      }
      continue;
    }

    if (BRANCH.has(name)) {
      const top = stack[stack.length - 1];
      const ok =
        top && (top.name === 'if' || top.name === 'unless' || top.name === 'case');
      if (!ok) {
        const where = top ? `当前块是 {% ${top.name} %}（第 ${top.line} 行）` : '当前不在任何条件块内';
        console.log(`❌ ${rel}:${line}  {% ${name} %} 位置非法：${where}`);
        problems++;
      }
    }
  }

  if (stack.length) {
    for (const open of stack) {
      const rel = path.relative(root, file);
      console.log(
        `❌ ${rel}:${open.line}  未闭合的 {% ${open.name} %}（缺少 {% ${PAIRS[open.name]} %}）`
      );
      problems++;
    }
  }
}

console.log('');
if (problems === 0) {
  console.log(`✅ Liquid 嵌套检查通过（${checked} 个含 Liquid 的文件）`);
  process.exit(0);
} else {
  console.log(`共 ${problems} 处问题`);
  process.exit(1);
}
