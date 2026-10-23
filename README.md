# AkiraStation

> Therefore, you refused my connection.

Akiras 的个人站点：项目与作品、画作、文字。

- 线上地址：<https://akirastation.github.io/>
- 构建方式：**GitHub Pages 经典构建**（Jekyll 3.10.0）。没有自定义 Ruby 插件，
  只用了白名单里的 `jekyll-redirect-from`。
- 前端：手写 CSS + 原生 JS。不依赖 Bootstrap / jQuery，也没有预处理器与打包步骤。

## 架构总览

```
_posts/            文章（随笔、长文）          URL /YYYY/MM/DD/slug/
_projects/         项目与作品（一等公民）      URL /works/<slug>/

_data/
  home.yml         主页文案、区块、图墙数量
  taxonomy.yml     类型与标签白名单 + 筛选条展示顺序
  asset_map.yml    优化版图片 -> 原图 映射

_layouts/          base(外壳) / home / project / project-index / post / page
_includes/
  base/            head、nav、footer、page-header、search、mathjax
  home/            hero、stats、projects、recent、gallery
  works/           filter（筛选条）、grid（网格）
  project/         card（卡片）

index.html         主页
projects.html      项目索引         /projects/
writing.html       文字索引         /writing/
series.html        系列             /series/
updates.html       全部更新         /updates/
about.html         关于             /about/
404.html / offline.html

search.json        搜索索引（文章 + 项目，含摘要）
feed.xml           RSS（文章 + 项目合并）
css/site.css       设计系统
js/site.js         交互
scripts/           推送前自检脚本（不参与构建）
```

## 两种内容类型

| | 放哪里 | URL | 出现在 |
|---|---|---|---|
| 文章 | `_posts/YYYY-MM-DD-slug.md` | `/YYYY/MM/DD/slug/` | 主页近作、文字页、更新页、搜索、RSS |
| 项目 | `_projects/<name>.md` | `/works/<slug>/`（旧地址跳转） | 主页网格与图墙、项目索引、系列页、更新页、搜索、RSS |

项目不是"借 post"，它有独立布局、独立字段、独立索引与独立 URL。

## 项目字段

必填：

| 字段 | 说明 |
|---|---|
| `title` / `subtitle` | 标题、副标题 |
| `date` | **发布日期**：更新时间线、feed、RSS 排序用 |
| `year` | **创作年份**（四位数字）：筛选条按它分年 |
| `type` | 类型，必须在 `_data/taxonomy.yml` 的 `types` 里 |
| `order` | 策展顺序，数字小的在前（决定网格顺序与前后导航） |
| `permalink` | 形如 `/works/<slug>/` |
| `cover` / `thumb` | 详情页大图 / 卡片缩略图 |
| `summary` | 一句话摘要（卡片、搜索、feed 都用它） |
| `gallery` | 图集，对象数组 `{src, caption, role}`；`role: main` 的图在没有 `cover` 时充当封面 |

可选：`view`（`art` = 画作视图不裁切可放大 / `product`）、`status`、`series` + `series_name`、
`featured`（进首页图墙）、`medium`（媒介）、`edition`（限量）、`tools`、`links`、`tags`、`redirect_from`。

> **`date` 与 `year` 是两个不同语义**：前者是发布、后者是创作。补档作品因此不会因为"补发时间"
> 而排到最前面 —— 显示顺序由 `order` 决定，年份筛选看 `year`。

## 分类法与系列

- **类型/标签白名单**在 `_data/taxonomy.yml`，筛选条的 chip 顺序也按它渲染（不再是"首次出现顺序"）。
  未登记的 `type` 仍会追加显示，但 `scripts/lint-content.js` 会报错提醒你登记。
- **系列**：内容写 `series: backfill` + `series_name: 补档`，就会出现在 `/series/`，
  详情页「系列」一行也可点击。系列是成组的正式手段；`tags` 是次要元数据。

## 图片：优化版与原图

页面默认加载 `img/opt/` 下的**优化版**，**原始分辨率图全部保留**在 `img/` 下、一张都没被覆盖：

| 位置 | 默认加载 | 原图 |
|---|---|---|
| 首页 Hero | `img/opt/default_header.jpg` **129 KB** | `img/default_header.jpg` 1850 KB |
| token 图集 | `img/opt/1t2f.jpg` **125 KB** | `img/shrine/1t2f.jpg` 4283 KB |
| 项目图墙 | `img/opt/*_compressed.jpg` | `img/shrine/*` |

右下角 **「加载完整资源」** 按钮会把当前页所有图片换成原图（先把原图拉进缓存再切换，避免闪白），
可「还原标准画质」；选择记在 `sessionStorage`，同一浏览会话内翻页保持。

**新增一张优化版**：文件放 `img/opt/`，再在 `_data/asset_map.yml` 补一行
「优化版路径 → 原图路径」，该页面的按钮就会自动把它算进去。

## 新增内容

**一个项目**：在 `_projects/` 新建文件，正文即详情内容：

```yaml
---
title: 代币
subtitle: token
date: 2025-10-29 09:05      # 发布
year: 2025                  # 创作
type: 周边
view: product
order: 10
status: 已完成
series: backfill
series_name: 补档
featured: true
cover: /img/opt/tokenize_bb.jpg
thumb: /img/smol/token_smol.jpg
summary: 一句话摘要
gallery:
  - src: /img/opt/tokenize_bb.jpg
    role: main
  - src: /img/opt/1t2f.jpg
    caption: 可选图注
tags: [周边, 项目]
permalink: /works/token/
redirect_from:
  - /2025/10/29/project_token/   # 若换过 URL，旧地址会生成跳转页
---
正文……
```

**一篇文章**：在 `_posts/` 新建 `YYYY-MM-DD-slug.md`，front matter 写 `layout: post`。

## 草稿与发布

- 想留在仓库但**不上线**：front matter 写 `published: false`（Jekyll 原生，全站隐藏）。
- 想本地预览未完成的稿子：放 `_drafts/`，用 `bundle exec jekyll serve --drafts`。
- 早期的自定义 `hidden` 字段（只影响首页）**已移除**，请统一用 `published`。

## URL 与跳转

- 文字页是 `/writing/`；旧地址 `/fblogs/` 会跳转到它。
- 项目是 `/works/<slug>/`；5 个历史项目的旧文章式地址（如 `/2025/10/29/project_token/`）会跳转。
- 由 `jekyll-redirect-from` 实现：在 `redirect_from:` 里声明旧地址。
  它生成的是**带 meta refresh 的跳转页（HTTP 200）**，不是服务端 301。

## 本地预览

本机需要 Ruby。`Gemfile` 已对齐线上的 `github-pages` gem：

```bash
bundle install
bundle exec jekyll serve
```

## 推送前自检

有四类错误会让线上翻车（构建失败或静默渲染成空白），推送前跑一遍：

```bash
node scripts/lint-liquid.js .   # Liquid 块标签嵌套
node scripts/lint-yaml.js .     # YAML 子集校验 + 文件 BOM
node scripts/lint-vars.js .     # 模板里的变量/数据键是否真的存在
node scripts/lint-content.js .  # 内容字段、分类法、图片、permalink 是否合规
```

## 已知约束

- **不能自定义 Ruby 插件**（GitHub Pages 以 `--safe` 运行），所以没有自动生成的标签页/系列页；
  `/series/`、`/updates/` 都是手写页面，靠 Liquid 分组。
- 依赖 Jekyll 3.10 的 Liquid 4 过滤器：`concat`、`where_exp`、`group_by`、`group_by_exp`、`jsonify`。
- 没有自动响应式图片，需要自己准备 `thumb`（卡片）与 `cover`（详情）。
- `/projects/` 页没有页头封面（用的是 `.section-head`），所以那一页不会出现「加载完整资源」按钮。

## 其他

- 缺失素材待补清单与维护速查：[RESOURCE_CHECKLIST.md](RESOURCE_CHECKLIST.md)
- `ads.txt`、`_includes/ads.html` 为历史遗留空文件，按你的要求保留未动
- 许可证：[LICENSE](LICENSE)