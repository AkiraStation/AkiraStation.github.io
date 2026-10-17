#!/usr/bin/env node
/**
 * .yaml-lint.js — 针对 Jekyll front matter 与 _config.yml / _data/*.yml 的
 * YAML 子集校验。目标不是完整 YAML 解析，而是抓住最可能让
 * GitHub Pages 构建整体失败的几类错误：
 *
 *   1. 制表符（YAML 禁止用 tab 缩进）
 *   2. 顶层重复键（后者会静默覆盖前者）
 *   3. 值里出现「冒号+空格」却没加引号（YAML 会解析成嵌套映射）
 *   4. 值以引号开头却没有以同类引号结尾
 *   5. 行非法（既不是 key:、也不是 - 列表项、也不是缩进映射键）
 *
 * 用法：node scripts/lint-yaml.js .
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = process.argv[2];
if (!root) {
  console.error('用法: node scripts/lint-yaml.js .');
  process.exit(2);
}

let problems = 0;
let filesChecked = 0;

function fail(rel, line, msg) {
  console.log(`❌ ${rel}:${line}  ${msg}`);
  problems++;
}

/** 逐行校验一段 YAML 文本 */
function checkYamlBlock(rel, lines, startLine) {
  const seenTopKeys = new Map();

  lines.forEach((line, idx) => {
    const lineNo = startLine + idx;
    const noComment = line.replace(/\s+#.*$/, '');

    if (line.includes('\t')) {
      fail(rel, lineNo, '包含制表符（YAML 禁止用 tab 缩进）');
      return;
    }
    if (!noComment.trim()) return;
    if (/^\s*#/.test(noComment)) return;

    const indent = noComment.match(/^ */)[0].length;
    const isList = /^\s*-(\s|$)/.test(noComment);

    // 键值行
    const kv = /^(\s*)([A-Za-z_][\w.-]*):(?:\s+(.*))?$/.exec(noComment);
    if (!isList && !kv) {
      // 可能是缩进映射的纯键、或列表项的续行
      const bare = /^(\s*)([A-Za-z_][\w.-]*):\s*$/.exec(noComment);
      if (!bare && !isList) {
        fail(rel, lineNo, `行格式无法识别：${noComment.trim().slice(0, 60)}`);
        return;
      }
    }

    if (kv) {
      const key = kv[2];
      const value = (kv[3] || '').trim();
      if (indent === 0) {
        if (seenTopKeys.has(key)) {
          fail(rel, lineNo, `顶层键重复：${key}（首次出现在第 ${seenTopKeys.get(key)} 行）`);
        } else {
          seenTopKeys.set(key, lineNo);
        }
      }
      // 未加引号却含「冒号+空格」
      if (value && !/^["'|>[{]/.test(value) && /:\s/.test(value)) {
        fail(rel, lineNo, `值含「冒号+空格」但未加引号：${value.slice(0, 60)}`);
      }
      // 引号不配对
      if (value.startsWith('"') && !/^"(?:[^"\\]|\\.)*"$/.test(value)) {
        fail(rel, lineNo, `双引号未闭合：${value.slice(0, 60)}`);
      }
      if (value.startsWith("'") && !/^'(?:[^']|'')*'$/.test(value)) {
        fail(rel, lineNo, `单引号未闭合：${value.slice(0, 60)}`);
      }
    }
  });
}

function checkFrontMatter(file) {
  const rel = path.relative(root, file);
  let raw = fs.readFileSync(file, 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) {
    fail(rel, 1, '文件带 UTF-8 BOM —— Jekyll 可能无法识别 front matter，请去掉 BOM');
    raw = raw.slice(1);
  }
  if (!raw.startsWith('---')) return;

  const lines = raw.split(/\r?\n/);
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (/^---\s*$/.test(lines[i])) { end = i; break; }
  }
  if (end === -1) {
    fail(rel, 1, 'front matter 没有闭合的 ---');
    return;
  }
  filesChecked++;
  checkYamlBlock(rel, lines.slice(1, end), 2);
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(md|markdown|html)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

// 1) 所有带 front matter 的内容文件
for (const file of walk(root)) checkFrontMatter(file);

// 2) _config.yml 与 _data/*.yml
const yamlFiles = [path.join(root, '_config.yml')];
const dataDir = path.join(root, '_data');
if (fs.existsSync(dataDir)) {
  for (const f of fs.readdirSync(dataDir)) {
    if (/\.ya?ml$/i.test(f)) yamlFiles.push(path.join(dataDir, f));
  }
}
for (const file of yamlFiles) {
  if (!fs.existsSync(file)) continue;
  const rel = path.relative(root, file);
  let text = fs.readFileSync(file, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) {
    fail(rel, 1, '文件带 UTF-8 BOM，请去掉');
    text = text.slice(1);
  }
  const lines = text.split(/\r?\n/);
  filesChecked++;
  checkYamlBlock(rel, lines, 1);
}

console.log('');
if (problems === 0) {
  console.log(`✅ YAML 子集检查通过（${filesChecked} 个文件）`);
  process.exit(0);
} else {
  console.log(`共 ${problems} 处问题`);
  process.exit(1);
}
