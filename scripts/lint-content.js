#!/usr/bin/env node
/**
 * lint-content.js — 内容字段自检
 *
 * 校验 _projects 与 _posts 的 front matter 是否符合当前架构约定，
 * 以及分类法、图片、URL 的一致性。目标是让人写内容时漏字段能被立刻发现，
 * 而不是上线后才发现卡片没图 / 筛选条少一项。
 *
 * 用法：node scripts/lint-content.js .
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = process.argv[2] || '.';
let problems = 0;
let warnings = 0;

function err(file, msg) { console.log(`❌ ${file}  ${msg}`); problems++; }
function warn(file, msg) { console.log(`⚠️  ${file}  ${msg}`); warnings++; }

/* ---------- 极简 YAML 解析（够用即可） ---------- */
function parseFrontMatter(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines[0].trim() !== '---') return null;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { end = i; break; }
  }
  if (end === -1) return null;

  const data = {};
  let current = null;
  let currentItem = null;

  for (let i = 1; i < end; i++) {
    const raw = lines[i];
    if (!raw.trim() || /^\s*#/.test(raw)) continue;
    const indent = raw.match(/^ */)[0].length;
    const line = raw.trim();

    if (indent === 0) {
      const m = /^([\w-]+):\s*(.*)$/.exec(line);
      if (!m) continue;
      current = m[1];
      currentItem = null;
      const v = m[2];
      if (v === '') { data[current] = []; }
      else if (/^\[.*\]$/.test(v)) {
        data[current] = v.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
      } else {
        data[current] = v.replace(/^['"]|['"]$/g, '');
      }
      continue;
    }

    // 列表项
    const item = /^-\s*(.*)$/.exec(line);
    if (item) {
      const rest = item[1];
      const kv = /^([\w-]+):\s*(.*)$/.exec(rest);
      if (kv) {
        currentItem = { [kv[1]]: kv[2].replace(/^['"]|['"]$/g, '') };
        if (!Array.isArray(data[current])) data[current] = [];
        data[current].push(currentItem);
      } else {
        currentItem = null;
        if (!Array.isArray(data[current])) data[current] = [];
        data[current].push(rest.replace(/^['"]|['"]$/g, ''));
      }
      continue;
    }

    // 列表项里的续行键
    const cont = /^([\w-]+):\s*(.*)$/.exec(line);
    if (cont && currentItem) {
      currentItem[cont[1]] = cont[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return data;
}

function imageExists(p) {
  if (!p || !p.startsWith('/')) return true;   // 外链不检查
  return fs.existsSync(path.join(root, p.replace(/^\//, '')));
}

/* ---------- 读分类法 ---------- */
const taxPath = path.join(root, '_data', 'taxonomy.yml');
if (!fs.existsSync(taxPath)) {
  console.log('❌ 缺少 _data/taxonomy.yml'); process.exit(1);
}
const taxRaw = fs.readFileSync(taxPath, 'utf8');
function readList(key) {
  const lines = taxRaw.split(/\r?\n/);
  const out = [];
  let inBlock = false;
  for (const line of lines) {
    if (new RegExp('^' + key + ':\\s*$').test(line)) { inBlock = true; continue; }
    if (!inBlock) continue;
    if (line.trim() !== '' && /^\S/.test(line)) break;      // 回到顶层键
    const m = /^\s+-\s*(.+)$/.exec(line);
    if (m) out.push(m[1].trim());
  }
  return out;
}
const TYPES = readList('types');
const TAGS = readList('tags');

const usedTypes = new Set();
const usedTags = new Set();
const permalinks = new Map();

/* ---------- 校验项目 ---------- */
const projDir = path.join(root, '_projects');
const projects = fs.existsSync(projDir) ? fs.readdirSync(projDir).filter(f => f.endsWith('.md')) : [];

for (const f of projects) {
  const rel = `_projects/${f}`;
  const data = parseFrontMatter(fs.readFileSync(path.join(projDir, f), 'utf8'));
  if (!data) { err(rel, 'front matter 解析失败'); continue; }

  for (const key of ['title', 'date', 'year', 'type', 'order', 'permalink', 'cover', 'thumb', 'summary', 'gallery']) {
    const v = data[key];
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) {
      err(rel, `缺少必填字段 ${key}`);
    }
  }

  if (data.type) {
    usedTypes.add(data.type);
    if (!TYPES.includes(data.type)) err(rel, `type「${data.type}」不在 _data/taxonomy.yml 的 types 里`);
  }
  if (data.view && !['art', 'product'].includes(data.view)) {
    err(rel, `view「${data.view}」只能是 art 或 product`);
  }
  if (data.order !== undefined && !/^\d+$/.test(String(data.order))) {
    err(rel, `order 必须是整数（当前：${data.order}）`);
  }
  if (data.year !== undefined && !/^\d{4}$/.test(String(data.year))) {
    err(rel, `year 必须是四位年份（当前：${data.year}）`);
  }

  (Array.isArray(data.tags) ? data.tags : []).forEach(t => {
    usedTags.add(t);
    if (!TAGS.includes(t)) err(rel, `标签「${t}」不在 _data/taxonomy.yml 的 tags 里`);
  });

  for (const key of ['cover', 'thumb']) {
    if (data[key] && !imageExists(data[key])) err(rel, `${key} 指向的文件不存在：${data[key]}`);
  }

  const gallery = Array.isArray(data.gallery) ? data.gallery : [];
  if (gallery.length === 0) err(rel, 'gallery 至少要有一张图');
  gallery.forEach((g, i) => {
    const src = (g && g.src) ? g.src : (typeof g === 'string' ? g : null);
    if (!src) { err(rel, `gallery[${i}] 缺少 src`); return; }
    if (!src.startsWith('/')) warn(rel, `gallery[${i}] 建议用站内绝对路径（当前：${src}）`);
    if (!imageExists(src)) err(rel, `gallery[${i}] 文件不存在：${src}`);
  });

  if (data.permalink) {
    if (!/^\/works\/[\w-]+\/$/.test(data.permalink)) {
      err(rel, `permalink 应形如 /works/<slug>/（当前：${data.permalink}）`);
    }
    if (permalinks.has(data.permalink)) {
      err(rel, `permalink 与 ${permalinks.get(data.permalink)} 重复：${data.permalink}`);
    } else permalinks.set(data.permalink, rel);

    const redirects = Array.isArray(data.redirect_from) ? data.redirect_from : [];
    for (const r of redirects) {
      if (r === data.permalink) err(rel, `redirect_from 与自身 permalink 相同：${r}`);
      if (permalinks.has(r)) err(rel, `redirect_from 与 ${permalinks.get(r)} 冲突：${r}`);
      else permalinks.set(r, rel);
    }
    if (redirects.length === 0) warn(rel, '没有 redirect_from：如果换过 URL，旧链接会断');
  }
}

/* ---------- 校验文章 ---------- */
const postDir = path.join(root, '_posts');
const posts = fs.existsSync(postDir) ? fs.readdirSync(postDir).filter(f => /\.(md|markdown|html)$/.test(f)) : [];
for (const f of posts) {
  const rel = `_posts/${f}`;
  const data = parseFrontMatter(fs.readFileSync(path.join(postDir, f), 'utf8'));
  if (!data) { err(rel, 'front matter 解析失败'); continue; }
  for (const key of ['layout', 'title', 'date']) {
    if (!data[key]) err(rel, `缺少必填字段 ${key}`);
  }
  if (data.layout && data.layout !== 'post') warn(rel, `layout 建议为 post（当前：${data.layout}）`);
  if (!/^\d{4}-\d{2}-\d{2}-/.test(f)) err(rel, '文件名必须是 YYYY-MM-DD-slug 格式');
  if (data.hidden !== undefined) err(rel, 'hidden 字段已废弃，请改用 published: false');
  (Array.isArray(data.tags) ? data.tags : []).forEach(t => {
    usedTags.add(t);
    if (!TAGS.includes(t)) err(rel, `标签「${t}」不在 _data/taxonomy.yml 的 tags 里`);
  });
}

/* ---------- 分类法反查 ---------- */
for (const t of TYPES) if (!usedTypes.has(t)) warn('_data/taxonomy.yml', `types 里的「${t}」没有任何项目在用`);
for (const t of TAGS) if (!usedTags.has(t)) warn('_data/taxonomy.yml', `tags 里的「${t}」没有任何内容在用`);

console.log('');
if (problems === 0 && warnings === 0) {
  console.log(`✅ 内容检查通过（${projects.length} 个项目、${posts.length} 篇文章）`);
  process.exit(0);
}
console.log(`错误 ${problems} 处，提示 ${warnings} 处`);
process.exit(problems === 0 ? 0 : 1);