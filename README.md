# AkiraStation

> Therefore, you refused my connection.

Akiras 的个人站点：项目与作品、画作、文字。

- 线上地址：<https://akirastation.github.io/>
- 构建方式：**GitHub Pages 经典构建**（Jekyll 3.10.0，无自定义 Ruby 插件）
- 前端：手写 CSS + 原生 JS，**不依赖 Bootstrap、jQuery，也没有预处理器与打包步骤**

---

## 架构总览

```
_posts/         文章（随笔、长文）      layout: post
_projects/      项目与作品（一等公民）  layout: project
_misc/          杂项                    layout: misc
_data/home.yml  主页与各区块的文案、图墙、数量配置

_layouts/       base(外壳) / home(主页) / project / project-index / post / page / misc
_includes/
  base/         head、nav、footer、page-header、search、mathjax
  home/         hero、stats、projects、recent、gallery（主页六个区块）
  works/        filter（类型×年份筛选）、grid（作品网格）
  project/      card（作品卡片）
  about/        zh.md（关于页正文）

css/site.css    设计系统：设计令牌 + 全部组件（深色主题，可切浅色）
js/site.js      交互：移动端导航、头部滚动态、筛选、搜索、标题锚点、滚动淡入
js/snackbar.js + js/sw-registration.js   Service Worker 注册与更新提示
sw.js           离线缓存（预缓存清单见文件内 PRECACHE_LIST）

index.html      主页（layout: home）
projects.html   项目索引（layout: project-index）
fblogs.html     文字索引（按年份分组）
about.html / misc.html / 404.html / offline.html
search.json     站内搜索索引（文章 + 项目合并）
feed.xml        RSS
scripts/        推送前自检脚本（不参与构建）
```

## 三种内容类型的区别

| | 放哪里 | URL | 出现在 |
|---|---|---|---|
| 文章 | `_posts/YYYY-MM-DD-slug.md` | `/YYYY/MM/DD/slug/` | 主页「近作」、文字页、搜索、RSS |
| 项目 | `_projects/<name>.md` | 由 front matter 的 `permalink` 决定 | 主页作品网格、项目索引、搜索 |
| 杂项 | `_misc/<name>.md` | `/misc/<name>/` | 杂项页 |

项目是最重要的区别：它**不再借用 post**，有独立布局、独立字段与独立索引页。
历史遗留的 5 个项目用 `permalink` 保留了旧的文章 URL，所以外链不会失效。

## 新增内容

**一个项目** —— 在 `_projects/` 新建文件，正文即详情页内容：

```yaml
---
title: Tokenize
subtitle: 代币
date: 2025-10-29 09:05
year: 2025
type: 周边                 # 周边 / 画作 …… 会自动出现在筛选条
cover: /img/shrine/tokenize_bb.jpg   # 详情页大图
thumb: /img/smol/token_smol.jpg      # 网格卡片缩略图
summary: 一句话摘要，显示在卡片上
gallery:                             # 可选，详情页图集
  - /img/shrine/1t2f.jpg
tools: [a1 打印机, PVA]              # 可选，元信息表会多一行
permalink: /2025/10/29/project_token/   # 可选；省略则用 /projects/<文件名>/
---
正文……
```

**一篇文章** —— 在 `_posts/` 新建 `YYYY-MM-DD-slug.md`，front matter 写 `layout: post`。
不想让它出现在主页「近作」就加 `hidden: true`（文字页与 RSS 仍会收录）。

**改首页** —— 只改 `_data/home.yml`：Hero 标题/副标题/背景图、CTA 按钮、图墙图片、区块标题与数量。

**改配色/字号/间距** —— 只改 `css/site.css` 顶部的 `:root` 设计令牌。切浅色主题把
`_layouts/base.html` 里的 `<html data-theme="dark">` 改成 `light`。

## 本地预览

本机需要 Ruby。`Gemfile` 已对齐线上的 `github-pages` gem：

```bash
bundle install
bundle exec jekyll serve
```

## 推送前自检（不需要 Ruby）

有两类错误会让 GitHub Pages **整个构建失败**（站点直接报错页），推送前跑一遍：

```bash
node scripts/lint-liquid.js .   # Liquid 块标签嵌套（能抓 {% if %}…{% endfor %} 这类错序）
node scripts/lint-yaml.js .     # front matter / _config.yml / _data 的 YAML 子集校验
node scripts/lint-vars.js .     # 变量引用：site.X / page.X / site.data.home.X 是否真的存在
```

`lint-yaml.js` 检查：制表符缩进、顶层重复键、值里未加引号的「冒号+空格」、引号未闭合、
以及**文件 BOM**（front matter 前带 BOM 会让 Jekyll 认不出它）。

`lint-vars.js` 覆盖另一类**静默失败**：模板里引用了数据中不存在的键时，Jekyll 不报错、
只渲染成空白。它会校验 `site.*`、`page.*`、`site.data.home.*`（含 `assign` 出来的别名）
以及 include 的参数契约。三个脚本都做过负向测试，确认能抓到真实错误。

## 已知约束

- **不能自定义 Ruby 插件**（GitHub Pages 经典构建以 `--safe` 运行），所以没有自动生成的
  标签页/分类页；筛选与搜索都在前端用原生 JS 完成。
- `jekyll-paginate` 只作用于 posts，不认 collections。项目数量多了以后，索引页要么一次性
  全量输出（几百个以内没问题），要么在前端做分页。
- 没有自动响应式图片，需要自己准备 `thumb`（卡片）与 `cover`（详情）两种尺寸。

## 其他

- 缺失素材的待补清单与维护速查：见 [RESOURCE_CHECKLIST.md](RESOURCE_CHECKLIST.md)
- `_includes/ads.html`、`ads.txt` 为历史遗留空文件，保留未动
- 许可证：[LICENSE](LICENSE)
