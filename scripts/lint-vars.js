#!/usr/bin/env node
/**
 * lint-vars.js — 模板变量引用校验
 *
 * 目标是抓「静默失败」：模板里写了 site.xxx / page.xxx / site.data.home.xxx /
 * include.xxx，但数据里根本没有这个键 —— Jekyll 不会报错，只会渲染成空白，
 * 肉眼很难发现。
 *
 * 校验内容：
 *   1. site.<key>            必须存在于 _config.yml，或是 Jekyll 内建全局
 *   2. page.<key>            必须在某个内容文件的 front matter 里出现过，或是 Jekyll 内建
 *   3. site.data.home.<path> 必须存在于 _data/home.yml 的层级结构里
 *   4. 局部别名               {% assign s = site.data.home.recent_section %} 之后
 *                             s.<key> 会按 recent_section 的实际结构校验
 *   5. include 参数契约       调用处传的参数名，被调 include 里必须真的读取；
 *                             读取了但全站从没传过 → 提示为无用参数
 *
 * 用法：node scripts/lint-vars.js .
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = process.argv[2] || '.';
const SKIP_DIRS = new Set(['.git', 'node_modules']);
const SKIP_FILES = new Set(['RESOURCE_CHECKLIST.md', 'README.md']);

/** Jekyll 在每个页面都能拿到的内建属性 */
const BUILTIN_PAGE = new Set([
  'url', 'layout', 'title', 'date', 'content', 'permalink', 'slug', 'path',
  'collection', 'previous', 'next', 'id', 'tags', 'categories', 'excerpt',
  'dir', 'name', 'basename', 'ext', 'output', 'draft', 'data', 'relative_path',
]);
const BUILTIN_SITE = new Set([
  'posts', 'projects', 'misc', 'data', 'time', 'pages', 'documents',
  'static_files', 'html_pages', 'collections', 'tags', 'categories',
  'related_posts', 'github', 'baseurl', 'url',
]);

let problems = 0;
let warnings = 0;

function err(file, line, msg) {
  console.log(`❌ ${file}:${line}  ${msg}`);
  problems++;
}
function warn(file, line, msg) {
  console.log(`⚠️  ${file}:${line}  ${msg}`);
  warnings++;
}

/* ---------- 解析 _config.yml 顶层键 ---------- */
function configKeys() {
  const file = path.join(root, '_config.yml');
  const keys = new Set();
  if (!fs.existsSync(file)) return keys;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Za-z_][\w-]*):/.exec(line);
    if (m) keys.add(m[1]);
  }
  return keys;
}

/* ---------- 解析 _data/home.yml 成嵌套树 ---------- */
function parseYamlTree(file) {
  const tree = {};
  if (!fs.existsSync(file)) return tree;

  const stack = [{ indent: -1, node: tree }];
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

  for (const raw of lines) {
    if (!raw.trim() || /^\s*#/.test(raw)) continue;
    const indent = raw.match(/^ */)[0].length;
    const line = raw.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].node;

    const listItem = /^-\s*(.*)$/.exec(line);
    if (listItem) {
      const rest = listItem[1].trim();
      const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(rest);
      if (kv) {
        const obj = {};
        if (!Array.isArray(parent.__items)) parent.__items = [];
        parent.__items.push(obj);
        obj[kv[1]] = kv[2] === '' ? {} : kv[2];
        stack.push({ indent: indent + 2, node: obj });
      }
      continue;
    }

    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (kv) {
      const [, key, value] = kv;
      if (value === '') {
        const child = {};
        parent[key] = child;
        stack.push({ indent, node: child });
      } else {
        parent[key] = value;
      }
    }
  }
  return tree;
}

/* ---------- 收齐所有内容文件的 front matter 键 ---------- */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(html|md|markdown)$/i.test(entry.name) && !SKIP_FILES.has(entry.name)) out.push(full);
  }
  return out;
}

function frontMatterKeys(files) {
  const keys = new Set();
  for (const file of files) {
    let raw = fs.readFileSync(file, 'utf8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    if (!raw.startsWith('---')) continue;
    const lines = raw.split(/\r?\n/);
    for (let i = 1; i < lines.length; i++) {
      if (/^---\s*$/.test(lines[i])) break;
      const m = /^([A-Za-z_][\w-]*):/.exec(lines[i]);
      if (m) keys.add(m[1]);
    }
  }
  return keys;
}

/* ---------- 工具 ---------- */
function lineAt(src, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (src.charCodeAt(i) === 10) line++;
  return line;
}

/** Liquid 在任何对象上都能取的通用属性，无法也不需要校验 */
const LIQUID_PROPS = new Set(['size', 'length', 'first', 'last']);

/** 设计上允许「没有内容使用」的可选页面键（模板里用 if 守卫） */
const OPTIONAL_PAGE_KEYS = new Set(['mathjax', 'header-img']);

/** 在 home.yml 树里按路径查找，返回 {ok, node} */
function lookup(tree, segments) {
  let node = tree;
  for (const seg of segments) {
    if (LIQUID_PROPS.has(seg)) return { ok: true, node: null };
    if (node === null || typeof node !== 'object') return { ok: false, node: null };
    if (Array.isArray(node.__items)) {
      // 列表元素统一当成“有这些键的对象”
      const union = {};
      for (const item of node.__items) Object.assign(union, item);
      node = union;
    }
    if (!(seg in node)) return { ok: false, node: null };
    node = node[seg];
  }
  return { ok: true, node };
}

/* ---------- 主流程 ---------- */
const cfgKeys = configKeys();
const homeTree = parseYamlTree(path.join(root, '_data', 'home.yml'));
const allFiles = walk(root);
const pageKeys = frontMatterKeys(allFiles);

const templates = allFiles.filter((f) => /\.(html|md|markdown)$/i.test(f));
const liquidRe = /\{\{([\s\S]*?)\}\}|\{%-?\s*([\s\S]*?)\s*-?%\}/g;
const dottedRe = /\b([a-zA-Z_][\w-]*)((?:\.[\w-]+)+)/g;
const bracketRe = /\b([a-zA-Z_][\w-]*)\[\s*['"]([^'"]+)['"]\s*\]/g;

/** include 文件读取了哪些参数 */
const includeReads = new Map();
/** include 调用处实际传了哪些参数 */
const includePassed = new Map();

for (const file of templates) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  let src = fs.readFileSync(file, 'utf8');
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);

  // 记录本地别名：assign X = <path>
  const aliases = new Map();

  liquidRe.lastIndex = 0;
  let m;
  while ((m = liquidRe.exec(src)) !== null) {
    const body = (m[1] || m[2] || '').trim();
    const line = lineAt(src, m.index);
    if (!body) continue;

    // include 调用：收集传参
    const incCall = /^include\s+([\w./-]+)\s*(.*)$/.exec(body);
    if (incCall) {
      const incPath = incCall[1];
      const params = incCall[2] || '';
      const passed = new Set();
      for (const pm of params.matchAll(/([a-zA-Z_][\w-]*)\s*=/g)) passed.add(pm[1]);
      if (!includePassed.has(incPath)) includePassed.set(incPath, new Set());
      for (const p of passed) includePassed.get(incPath).add(p);
    }

    // assign 别名
    const asg = /^assign\s+([a-zA-Z_][\w-]*)\s*=\s*([^|]+)/.exec(body);
    if (asg) {
      const firstPath = asg[2].trim();
      if (/^[a-zA-Z_][\w-]*(?:\.[\w-]+)+$/.test(firstPath)) {
        aliases.set(asg[1], firstPath);
      } else {
        aliases.delete(asg[1]);
      }
    }

    // include.X 读取（在 _includes 里的文件）
    if (rel.startsWith('_includes/')) {
      for (const rm of body.matchAll(/\binclude\.([\w-]+)/g)) {
        if (!includeReads.has(rel)) includeReads.set(rel, new Set());
        includeReads.get(rel).add(rm[1]);
      }
    }

    // 校验点号路径（先把引号里的字符串挖空，避免把 '/css/site.css' 当成变量）
    const clean = body.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
    for (const dm of clean.matchAll(dottedRe)) {
      const rootName = dm[1];
      const segs = dm[2].split('.').filter(Boolean);
      if (!segs.length) continue;

      if (rootName === 'site') {
        const head = segs[0];
        if (head === 'data') {
          if (segs[1] !== 'home') continue;
          const r = lookup(homeTree, segs.slice(2));
          if (!r.ok) err(rel, line, `site.data.home.${segs.slice(2).join('.')} 在 _data/home.yml 里不存在`);
        } else if (!cfgKeys.has(head) && !BUILTIN_SITE.has(head)) {
          err(rel, line, `site.${head} 既不在 _config.yml 也不是 Jekyll 内建全局`);
        }
        continue;
      }

      if (rootName === 'page') {
        const head = segs[0];
        if (!pageKeys.has(head) && !BUILTIN_PAGE.has(head) && !OPTIONAL_PAGE_KEYS.has(head)) {
          err(rel, line, `page.${head} 在所有 front matter 里都没出现过`);
        }
        continue;
      }

      if (rootName === 'include') {
        // 参数契约在下面按 include 文件统一检查
        continue;
      }

      if (aliases.has(rootName)) {
        const base = aliases.get(rootName);
        if (base.startsWith('site.data.home.')) {
          const baseSegs = base.split('.');
          const r = lookup(homeTree, baseSegs.slice(3).concat(segs));
          if (!r.ok) {
            err(rel, line, `${rootName}.${segs.join('.')} 无效（${rootName} = ${base}）`);
          }
        }
      }
    }

    // 校验方括号取值：page['xxx']
    for (const bm of body.matchAll(bracketRe)) {
      const rootName = bm[1];
      const key = bm[2];
      if (rootName === 'page' && /^[a-z][\w-]*$/.test(key)) {
        if (!pageKeys.has(key) && !BUILTIN_PAGE.has(key) && !OPTIONAL_PAGE_KEYS.has(key)) {
          err(rel, line, `page['${key}'] 在所有 front matter 里都没出现过`);
        }
      }
      if (rootName === 'site') {
        const norm = key.replace(/-/g, '_');
        if (!cfgKeys.has(key) && !BUILTIN_SITE.has(key) && !BUILTIN_SITE.has(norm)) {
          err(rel, line, `site['${key}'] 既不在 _config.yml 也不是 Jekyll 内建全局`);
        }
      }
    }
  }
}

/* ---------- include 参数契约 ---------- */
const allPassed = new Set();
for (const set of includePassed.values()) for (const p of set) allPassed.add(p);

for (const [inc, reads] of includeReads) {
  for (const param of reads) {
    const passedForThis = includePassed.get(inc);
    if (!passedForThis || !passedForThis.has(param)) {
      if (!allPassed.has(param)) {
        warn(inc, 0, `读取了 include.${param}，但全站没有任何调用处传这个参数`);
      }
    }
  }
}

console.log('');
if (problems === 0 && warnings === 0) {
  console.log(`✅ 变量引用检查通过（${templates.length} 个模板，${pageKeys.size} 个 page 键，${Object.keys(homeTree).length} 个 data 顶层键）`);
  process.exit(0);
}
console.log(`错误 ${problems} 处，提示 ${warnings} 处`);
process.exit(problems === 0 ? 0 : 1);
