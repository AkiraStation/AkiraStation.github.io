# 资源待补核对清单

> 最后核对：2026-10-16（基于提交 `45306e5`）
> 本文件已加入 `_config.yml` 的 `exclude` 列表，**不会被 Jekyll 构建发布到站点上**。
> 用法：补上一个文件后，把对应行的状态改成 ✅，并完成文末「收尾动作」。

---

## 一、待补：仍被代码引用的缺失文件

| # | 期望路径 | 被谁引用 | 用途 | 建议规格 | 状态 |
|---|---|---|---|---|---|
| 1 | `pwa/icons/128.png` | `pwa/manifest.json` → `"src": "icons/128.png"` | PWA 图标（小） | 128×128 PNG，透明背景 | ⬜ 待补 |
| 2 | `pwa/icons/512.png` | `pwa/manifest.json` → `"src": "icons/512.png"` | PWA 图标（大，也是「添加到主屏幕」时的启动图） | 512×512 PNG，主体留出安全边距 | ⬜ 待补 |
| 3 | `img/icon_wechat.png` | `sw.js` 预缓存清单（已注释，见该文件内 TODO）；`_layouts/post.html`、`keynote.html`、`default.html` 里的微信 hack 代码块（均已注释） | 让微信分享卡片能取到一张小图 | 约 200×200 PNG 即可 | ⬜ 待补 |
| 4 | `img/home-bg.jpg` | `sw.js` 预缓存清单（已注释） | 主题原本的首页头图（现首页已改用 `img/default_header.jpg`） | 与 `img/default_header.jpg` 同尺寸即可 | ⬜ 待补（可选） |

**为什么 3、4 在补齐前必须保持注释**：`sw.js` 用的是 `cache.addAll()`，它是**原子操作** —— 列表里只要有一个 URL 返回 404，整个 Service Worker 的 `install` 就会失败，导致 SW 无法激活、离线功能完全不可用。补齐文件后请到 `sw.js` 取消对应的两行注释。

---

## 二、已就地规避：不需要补文件（除非你想沿用原来的命名）

| 原本被引用的路径 | 处理方式 |
|---|---|
| `img/404-bg.jpg`（`offline.html`、`sw.js`） | 仓库里实际是**下划线**命名的 `img/404_bg.jpg`，两处引用已改为实际文件名 |
| `img/header_img.jpg`（`_config.yml` 的 `header-img`，即全站缺省头图） | 已改指向实际存在的 `img/default_header.jpg` |
| `img/icon_wechat.png`（`_layouts/default.html` 底部的 `<img>`） | 该 `<img>` 已注释掉（`post.html` / `keynote.html` 里的同款写法本来就是注释状态），不再每页产生一次 404 |

---

## 三、只被「死文件」引用（可直接忽略）

`_includes/projects/project_head.md` 目前**没有任何地方 include 它**，其内容还引用了两个不存在的东西：

- `img/smol/guardian_smol.jpg`
- `https://akirastation.github.io/2023/06/17/project_guardian/`

以后若要启用该文件，需一并补齐；否则建议直接删除。

---

## 四、补齐后的收尾动作

1. 把 `pwa/icons/128.png`、`pwa/icons/512.png` 放到位。
2. 补好 `img/icon_wechat.png`、`img/home-bg.jpg` 后，到 `sw.js` 的 `PRECACHE_LIST` 取消对应注释。
3. 本地验证 Service Worker：Chrome DevTools → Application → Service Workers（安装不应报错）；Cache Storage 中应出现 `main-precache-then-runtime`。
4. 更新本文件第一行的「最后核对」日期，并把状态勾成 ✅。

---

## 五、顺带记录（非资源缺失，供以后决定）

- **本地与线上构建版本不一致**：`Gemfile` 钉的是 `jekyll "~> 4.0"`，而线上 GitHub Pages 实际用 **Jekyll 3.10.0**（见线上 `feed.xml` 的 `<generator>`）。想在本地得到与线上一致的预览，应改为 `gem "github-pages", group: :jekyll_plugins`。⚠️ 本机当前**未安装 Ruby**，此项无法代为验证，故未改动。
- **未被加载的产物**（页面只加载 `.min` 版本）：`css/bootstrap.css`、`css/hux-blog.css`、`js/jquery.js`、`js/bootstrap.js`；`js/animatescroll.min.js` 全仓库零引用。
- **未被引用的资源**：`img/Credence.jpg`（1.85 MB，实际是 PNG 格式却用了 `.jpg` 后缀）、`fonts/SmileySans-Oblique.otf.woff2` 与 `SmileySans-Oblique.ttf.woff2`（合计约 2.5 MB）、`img/smol/*`（5 张）、`img/miscfaces/test.jpg`。
- **`projects.html` 仍是占位页**（正文只有两行英文说明）。
- **`hidden: true` 的语义**：现已由 `index.html` 显式实现 —— 只影响**首页**；归档页 `fblogs`、`search.json`、`feed.xml` 仍会收录这些文章。若要让某篇文章在**全站**消失，请改用 Jekyll 原生的 `published: false`。
