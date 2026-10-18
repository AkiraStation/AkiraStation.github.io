/* ============================================================================
 * site.js — 新前端交互层（无依赖，不使用 jQuery / Bootstrap）
 * ----------------------------------------------------------------------------
 * 1. 移动端导航开合
 * 2. 头部滚动状态
 * 3. 项目筛选（类型 × 年份，AND 组合）
 * 4. 站内搜索（懒加载 /search.json）
 * 5. 滚动进入视口的淡入
 * ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -- 1. 移动端导航 ------------------------------------------------------ */
  function initNav() {
    var toggle = document.querySelector('[data-nav-toggle]');
    var links = document.querySelector('[data-nav-links]');
    if (!toggle || !links) return;

    function setOpen(open) {
      links.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    }

    toggle.addEventListener('click', function () {
      setOpen(!links.classList.contains('is-open'));
    });

    // 点击导航项后收起
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });

    document.addEventListener('click', function (e) {
      if (!links.classList.contains('is-open')) return;
      if (e.target.closest('[data-nav-links], [data-nav-toggle]')) return;
      setOpen(false);
    });

    // 桌面宽度下复位，避免旋转屏幕后菜单残留
    window.addEventListener('resize', function () {
      if (window.innerWidth > 860) setOpen(false);
    });
  }

  /* -- 2. 头部滚动状态 ---------------------------------------------------- */
  function initHeader() {
    var header = document.querySelector('[data-site-header]');
    if (!header) return;
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 12);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* -- 3. 项目筛选 -------------------------------------------------------- */
  function initFilter() {
    var groups = document.querySelectorAll('[data-filter-group]');
    if (!groups.length) return;

    var cards = Array.prototype.slice.call(
      document.querySelectorAll('[data-work]')
    );
    if (!cards.length) return;

    // { type: 'all', year: 'all' }
    var state = {};

    groups.forEach(function (group) {
      var key = group.getAttribute('data-filter-group');
      state[key] = 'all';

      group.addEventListener('click', function (e) {
        var chip = e.target.closest('[data-value]');
        if (!chip || chip.classList.contains('is-active')) return;

        Array.prototype.forEach.call(
          group.querySelectorAll('[data-value]'),
          function (c) { c.classList.remove('is-active'); }
        );
        chip.classList.add('is-active');
        state[key] = chip.getAttribute('data-value');
        apply();
      });
    });

    var counter = document.querySelector('[data-filter-count]');

    function apply() {
      var shown = 0;
      cards.forEach(function (card) {
        var ok = true;
        Object.keys(state).forEach(function (key) {
          var want = state[key];
          if (want === 'all') return;
          if (card.getAttribute('data-' + key) !== want) ok = false;
        });
        card.classList.toggle('is-hidden', !ok);
        if (ok) shown += 1;
      });

      if (counter) {
        counter.textContent = shown + ' / ' + cards.length;
      }
      // 空结果提示
      var empty = document.querySelector('[data-filter-empty]');
      if (empty) empty.hidden = shown !== 0;
    }

    apply();
  }

  /* -- 4. 站内搜索 -------------------------------------------------------- */
  function initSearch() {
    var root = document.querySelector('[data-search]');
    if (!root) return;

    var openers = document.querySelectorAll('[data-search-open]');
    var closers = root.querySelectorAll('[data-search-close]');
    var field = root.querySelector('[data-search-field]');
    var results = root.querySelector('[data-search-results]');
    var url = root.getAttribute('data-search-url') || '/search.json';

    var index = null;
    var loading = null;

    function load() {
      if (index) return Promise.resolve(index);
      if (loading) return loading;
      loading = fetch(url, { credentials: 'same-origin' })
        .then(function (r) {
          if (!r.ok) throw new Error('search index ' + r.status);
          return r.json();
        })
        .then(function (data) {
          index = (data || []).filter(function (x) { return x && x.title; });
          return index;
        })
        .catch(function () {
          index = [];
          return index;
        });
      return loading;
    }

    function open() {
      root.classList.add('is-open');
      root.setAttribute('aria-hidden', 'false');
      document.body.classList.add('is-locked');
      load();
      window.setTimeout(function () { if (field) field.focus(); }, 60);
    }

    function close() {
      root.classList.remove('is-open');
      root.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('is-locked');
    }

    function render(items, query) {
      if (!results) return;
      if (!items.length) {
        results.innerHTML = '<p class="search-empty">' +
          (query ? '没有匹配「' + escapeHtml(query) + '」的结果' : '输入关键词开始搜索') +
          '</p>';
        return;
      }
      results.innerHTML = items.map(function (item) {
        var kind = item.kind === 'project' ? '项目' : '文章';
        var meta = [item.date, kind, item.tags].filter(Boolean).join(' · ');
        return '<a class="search-hit" href="' + escapeHtml(item.url) + '">' +
               '<div class="search-hit-title">' + escapeHtml(item.title) + '</div>' +
               '<div class="search-hit-meta">' + escapeHtml(meta) + '</div>' +
               '</a>';
      }).join('');
    }

    function search(query) {
      var q = query.trim().toLowerCase();
      if (!index) return;
      if (!q) { render(index.slice(0, 6), ''); return; }

      var hits = index.filter(function (item) {
        return (item.title + ' ' + (item.subtitle || '') + ' ' + (item.tags || ''))
          .toLowerCase().indexOf(q) > -1;
      }).slice(0, 12);

      render(hits, q);
    }

    Array.prototype.forEach.call(openers, function (btn) {
      btn.addEventListener('click', function (e) { e.preventDefault(); open(); });
    });
    Array.prototype.forEach.call(closers, function (btn) {
      btn.addEventListener('click', function (e) { e.preventDefault(); close(); });
    });

    if (field) {
      field.addEventListener('input', function () { search(field.value); });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('is-open')) close();
      // Ctrl/⌘ + K 唤起
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        root.classList.contains('is-open') ? close() : open();
      }
    });

    root.addEventListener('click', function (e) {
      if (e.target === root) close();
    });
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* -- 5. 正文标题锚点（原生实现，替代 anchor.js） ------------------------ */
  function slugify(text) {
    return String(text || '').trim().toLowerCase()
      .replace(/[\s\u3000]+/g, '-')
      .replace(/[^\w\u4e00-\u9fa5-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'section';
  }

  function initAnchors() {
    var heads = document.querySelectorAll('.prose h2, .prose h3, .prose h4');
    if (!heads.length) return;

    Array.prototype.forEach.call(heads, function (h) {
      if (!h.id) h.id = slugify(h.textContent);
      if (!h.id) return;
      var a = document.createElement('a');
      a.className = 'heading-anchor';
      a.href = '#' + h.id;
      a.setAttribute('aria-label', '链接到本节');
      a.textContent = '#';
      h.appendChild(a);
    });
  }

  /* -- 6. 淡入 ------------------------------------------------------------ */
  function initReveal() {
    var nodes = document.querySelectorAll('[data-reveal]');
    if (!nodes.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(nodes, function (n) { n.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    Array.prototype.forEach.call(nodes, function (n, i) {
      n.style.transitionDelay = Math.min(i * 40, 240) + 'ms';
      io.observe(n);
    });
  }

  /* -- 7. 加载完整分辨率资源（把 img/opt 换回原图） ----------------------- */
  function initFullAssets() {
    var imgs = Array.prototype.slice.call(document.querySelectorAll('img[data-full-src]'));
    var covers = Array.prototype.slice.call(document.querySelectorAll('[data-full-cover]'));
    var wrap = document.querySelector('[data-asset-quality]');
    var total = imgs.length + covers.length;
    if (!wrap || !total) return;

    var btn = wrap.querySelector('button');
    var key = 'akira:full-assets';
    var active = false;

    function swapImages(on) {
      imgs.forEach(function (img) {
        if (on) {
          if (!img.getAttribute('data-src-standard')) {
            img.setAttribute('data-src-standard', img.getAttribute('src'));
          }
          img.setAttribute('src', img.getAttribute('data-full-src'));
        } else {
          var std = img.getAttribute('data-src-standard');
          if (std) img.setAttribute('src', std);
        }
      });
    }

    function swapCovers(on) {
      covers.forEach(function (el) {
        if (on) {
          if (!el.getAttribute('data-cover-standard')) {
            el.setAttribute('data-cover-standard', el.style.getPropertyValue('--cover'));
          }
          el.style.setProperty('--cover', 'url(' + el.getAttribute('data-full-cover') + ')');
        } else {
          var std = el.getAttribute('data-cover-standard');
          if (std) el.style.setProperty('--cover', std);
        }
      });
    }

    function sync() {
      btn.setAttribute('aria-pressed', String(active));
      btn.textContent = active ? '还原标准画质' : '加载完整资源 · ' + total + ' 张';
    }

    function persist() {
      try {
        if (active) sessionStorage.setItem(key, '1');
        else sessionStorage.removeItem(key);
      } catch (e) { /* 隐私模式忽略 */ }
    }

    function switchTo(on) {
      active = on;
      swapImages(on);
      swapCovers(on);
      sync();
      persist();
    }

    btn.addEventListener('click', function () {
      if (active) { switchTo(false); return; }

      // 先把原图拉进缓存再换，避免切换瞬间出现空白
      var queue = [];
      imgs.forEach(function (i) { queue.push(i.getAttribute('data-full-src')); });
      covers.forEach(function (c) { queue.push(c.getAttribute('data-full-cover')); });

      btn.disabled = true;
      btn.textContent = '正在加载原图…';

      var pending = queue.length;
      function one() {
        if (--pending > 0) return;
        btn.disabled = false;
        switchTo(true);
      }
      if (!pending) { btn.disabled = false; switchTo(true); return; }
      queue.forEach(function (src) {
        var probe = new Image();
        probe.onload = one;
        probe.onerror = one;   // 原图缺失也要恢复按钮状态
        probe.src = src;
      });
    });

    wrap.hidden = false;
    sync();

    var saved = false;
    try { saved = sessionStorage.getItem(key) === '1'; } catch (e) { /* 忽略 */ }
    if (saved) { active = true; swapImages(true); swapCovers(true); sync(); }
  }
  /* -- 启动 --------------------------------------------------------------- */
  function boot() {
    initNav();
    initHeader();
    initFilter();
    initSearch();
    initAnchors();
    initReveal();
    initFullAssets();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
