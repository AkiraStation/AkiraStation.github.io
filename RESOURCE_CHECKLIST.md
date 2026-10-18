# 资源待补核对清单

> 最后核对：2026-10-16（前端重写之后）
> 本文件在 `_config.yml` 的 `exclude` 列表里，**不会被 Jekyll 构建发布到站点上**。
> 用法：补上一个文件后，把对应行的状态改成 ✅，并完成「四、补齐后的收尾动作」。

---

## 一、待补：仍被代码引用的缺失文件

| # | 期望路径 | 被谁引用 | 用途 | 建议规格 | 状态 |
|---|---|---|---|---|---|
| 1 | `pwa/icons/128.png` | `pwa/manifest.json` → `"src": "icons/128.png"` | PWA 图标（小） | 128×128 PNG，透明背景 | ⬜ 待补 |
| 2 | `pwa/icons/512.png` | `pwa/manifest.json` → `"src": "icons/512.png"` | PWA 图标（大，也是「添加到主屏幕」时的启动图） | 512×512 PNG，主体留出安全边距 | ⬜ 待补 |
| 3 | `img/icon_wechat.png` | 仅 `sw.js` 预缓存清单（已注释，见该文件内 TODO） | 让微信分享卡片能取到一张小图 | 约 200×200 PNG 即可 | ⬜ 待补（可选） |
| 4 | `img/home-bg.jpg` | 仅 `sw.js` 预缓存清单（已注释） | 原主题的首页头图（现首页 Hero 用 `img/default_header.jpg`） | 与 `img/default_header.jpg` 同尺寸即可 | ⬜ 待补（可选） |

**为什么 3、4 在补齐前必须保持注释**：`sw.js` 用的是 `cache.addAll()`，它是**原子操作** —— 列表里只要有一个 URL 返回 404，整个 Service Worker 的 `install` 就会失败，导致 SW 无法激活、离线功能完全不可用。补齐文件后请到 `sw.js` 的 `PRECACHE_LIST` 取消对应注释。

---

## 二、已就地规避：不需要补文件

| 原本被引用的路径 | 处理方式 |
|---|---|
| `img/404-bg.jpg` | 仓库里实际是**下划线**命名的 `img/404_bg.jpg`；`404.html`、`offline.html`、`sw.js` 均已指向实际文件 |
| `img/header_img.jpg`（旧的全站缺省头图） | `_config.yml` 的 `header-img` 已改指向 `img/default_header.jpg` |
| `img/icon_wechat.png`（页面里的 `<img>`） | 旧布局中那处 0×0 的「微信 hack」已随旧布局一起删除，页面不再请求它 |

---

## 三、已随前端重写删除的内容

- `_includes/projects/project_head.md`（从未被 include 的死文件，且引用了不存在的 `guardian_smol.jpg` 与 `/2023/06/17/project_guardian/`）→ **已删除**，项目网格已由 `_includes/project/card.html` + `_includes/works/grid.html` 正确实现。
- 旧主题资产全部移除：`less/`、`css/bootstrap*.css`、`css/hux-blog*.css`、`js/jquery*.js`、`js/bootstrap*.js`、`js/hux-blog*.js`、`js/jquery.nav.js`、`js/jquery.tagcloud.js`、`js/archive.js`、`js/simple-jekyll-search.min.js`、`js/animatescroll.min.js`、`fonts/`（含 2.5 MB 的 SmileySans 与 Bootstrap 的 glyphicons）。
- 旧布局与旧 include：`_layouts/default.html`、`keynote.html`，以及 `intro-header.html`、`featured-tags.html`、`short-about.html`、`sns-links.html`、`friends.html`、`multilingual-sel.html`、`search.html`、`mathjax_support.html` 等。
- 已失效的构建链：`Gruntfile.js`、`package.json`、`package-lock.json`、`Rakefile`（新前端是手写的纯 CSS/JS，不再需要预处理器）。

---

## 四、补齐后的收尾动作

1. 把 `pwa/icons/128.png`、`pwa/icons/512.png` 放到位。
2. 补好 `img/icon_wechat.png`、`img/home-bg.jpg` 后，到 `sw.js` 的 `PRECACHE_LIST` 取消对应注释。
3. 本地验证 Service Worker：Chrome DevTools → Application → Service Workers（安装不应报错）；Cache Storage 中应出现 `main-precache-then-runtime`。
4. 更新本文件第一行的「最后核对」，并把状态勾成 ✅。

---

## 五、仍需你决定的事项

- **图片已做优化版**：页面默认加载 `img/opt/`（首页 749 KB，优化前 ~2776 KB）；`img/` 下的原图
  **一张未改**，通过右下角「加载完整资源」按钮按需加载，映射表见 `_data/asset_map.yml`。
- **未被引用的图片**（我没有删除，因为属于你的作品素材）：`img/Credence.jpg`（1.85 MB，实际是 PNG 格式却用了 `.jpg` 后缀）、`img/miscfaces/test.jpg`。`img/smol/*` 与 `img/shrine/*` 现在都已正常使用（项目卡片 / 详情页大图）。
- **`Gemfile` 已改为 `gem "github-pages"`**，与线上 Jekyll 3.10.0 对齐。⚠️ 本机未安装 Ruby，**无法代为验证** `bundle install` 是否顺利；若你以后要在本地预览，这一步需要你自己跑一次。
- **`hidden: true` 的语义**（现已写进代码）：只影响**首页「近作」**区块；文字页 `fblogs`、`search.json`、`feed.xml` 仍会收录。要让某篇在**全站**消失，请用 Jekyll 原生的 `published: false`。
- **`_includes/ads.html` 与 `ads.txt`** 按你的要求保留未动（目前没有任何模板引用它们）。
- **统计脚本**（Google Analytics / 百度）在新外壳中不再内置，需要时自行加回。

---

## 六、内容维护速查

| 想做的事 | 改哪里 |
|---|---|
| 新增一个项目/作品 | 在 `_projects/` 新建 Markdown，写 `title / year / type / cover / thumb / summary`，正文即详情内容；URL 默认 `/projects/<文件名>/` |
| 新增一篇文字 | 在 `_posts/` 新建 `YYYY-MM-DD-slug.md`，`layout: post` |
| 改首页 Hero 文案 / 图墙图片 / 区块标题 | `_data/home.yml` |
| 改整体配色、字号、间距 | `css/site.css` 顶部的 `:root` 设计令牌 |
| 新增一张图片的优化版 | 文件放 img/opt/，并在 _data/asset_map.yml 补「优化版 → 原图」映射 |
| 切换浅色主题 | 把 `<html data-theme="dark">` 改成 `data-theme="light"`（`_layouts/base.html`） |
| 首页不显示某篇文字 | 该文 front matter 写 `hidden: true` |

---

## 七、推送前自检（不需要装 Ruby）

本机没有 Ruby，无法本地 `jekyll build`；但有两类错误会让 GitHub Pages **整个构建失败**（站点直接报错），
所以这里放了三个零依赖的 Node 自检脚本，推送前跑一遍即可（在仓库根目录执行）：

```bash
node scripts/lint-liquid.js .   # Liquid 块标签嵌套（能抓 {% if %}…{% endfor %} 这类错序）
node scripts/lint-yaml.js .     # front matter / _config.yml / _data 的 YAML 子集校验
node scripts/lint-vars.js .     # 变量引用是否存在（抓「渲染成空白但不报错」的错键）
```

`lint-yaml.js` 会检查：制表符缩进、顶层重复键、值里未加引号的「冒号+空格」、引号未闭合、
以及 **文件 BOM**（front matter 前带 BOM 会让 Jekyll 认不出它）。

`lint-vars.js` 覆盖另一类静默失败：引用了数据里不存在的键时 Jekyll 不报错、只渲染成空白。
它校验 `site.*`、`page.*`、`site.data.home.*`（含 `assign` 别名）与 include 参数契约。

三个脚本都在 `_config.yml` 的 `exclude` 里，不会被发布到站点上。
