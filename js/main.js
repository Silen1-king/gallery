/* Silen1 的画室：所有页面共用的脚本。
   作品数据来自 data/works.js（window.WORKS），不需要服务器，也没有任何外部请求。 */
(() => {
  'use strict';

  // 编号按完成顺序：最早的一幅是 No. 01。同一天的按 works.js 里的先后。
  const ALL = (Array.isArray(window.WORKS) ? window.WORKS : []).filter(w => w && w.id && w.image);
  const chrono = ALL.map((w, i) => ({ w, i }))
    .sort((a, b) => String(a.w.date || '').localeCompare(String(b.w.date || '')) || a.i - b.i)
    .map(x => x.w);
  chrono.forEach((w, i) => { w._no = i + 1; });
  const WORKS = chrono.slice().reverse(); // 展示顺序：新的在前

  const $ = (sel, root = document) => root.querySelector(sel);

  // 只用 DOM API 生成元素，不拼接 HTML 字符串，避免数据里的特殊字符变成代码
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }
  const fmtTime = s => {
    s = Math.max(0, Math.round(s || 0));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
  const no = w => `No. ${String(w._no).padStart(2, '0')}`;
  const year = w => String(w.date || '').slice(0, 4);
  const workUrl = w => `work.html?id=${encodeURIComponent(w.id)}`;
  const canvas = w => w.canvas || (w.width && w.height ? `${w.width} × ${w.height} px` : '');
  const medium = w => ['iPad 数字绘画', canvas(w)].filter(Boolean).join(' · ');

  // 展签：照博物馆的写法，作者、标题、英文名与年份、媒材、尺寸，最后是编号
  function label(w, tag = 'h3') {
    return h('div', { class: 'label' },
      h('p', { class: 'label__artist', lang: 'en', text: 'Silen1' }),
      h(tag, { class: 'label__title', text: w.title }),
      h('p', { class: 'label__en', lang: 'en' },
        w.title_en ? h('i', { text: w.title_en }) : null,
        year(w) ? `${w.title_en ? ', ' : ''}${year(w)}` : null),
      h('p', { class: 'label__meta', text: 'iPad 数字绘画' }),
      canvas(w) ? h('p', { class: 'label__meta label__num', text: canvas(w) }) : null,
      h('p', { class: 'label__no', lang: 'en', text: no(w) }));
  }

  // 有些托管服务不支持“分段下载”视频，浏览器就没法拖动进度。
  // 先把整段视频（通常只有 1 MB 左右）下载到内存里再播放，任何托管都能拖。
  function loadSeekable(video, url) {
    if (!window.fetch || location.protocol === 'file:') { video.src = url; return; }
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(b => { video.src = URL.createObjectURL(b); })
      .catch(() => { video.src = url; });
  }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 走到画前，灯才亮起来
  function reveal() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || reduce) {
      els.forEach(el => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.18 });
    els.forEach(el => io.observe(el));
  }

  // 顶栏：往下读时让开，往上翻时回来
  function bar() {
    const el = $('#bar');
    if (!el) return;
    let last = scrollY, ticking = false;
    const update = () => {
      const y = scrollY;
      el.classList.toggle('is-scrolled', y > 40);
      if (Math.abs(y - last) > 6) { el.classList.toggle('is-hidden', y > last && y > 240); last = y; }
      ticking = false;
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  // 从墙上点进详情页时，画平滑地飞过去（支持的浏览器才有）
  function morphTo(img) {
    document.querySelectorAll('img').forEach(x => { if (x.style.viewTransitionName) x.style.viewTransitionName = ''; });
    if (img) img.style.viewTransitionName = 'art';
  }

  const page = document.body.dataset.page;
  bar();
  if (page === 'home') initHome();
  if (page === 'work') initWork();

  /* =================== 首页 =================== */
  function initHome() {
    const latest = WORKS[0];
    if (latest) {
      $('#hero-fig').hidden = false;
      const a = $('#hero-art');
      a.href = workUrl(latest);
      a.dataset.id = latest.id;
      a.append(h('img', { src: latest.image, alt: latest.title, width: latest.width, height: latest.height, decoding: 'async', fetchpriority: 'high' }));
      $('#hero-cap').append(
        h('span', { class: 'label__num', text: no(latest) }),
        h('span', { text: latest.title }),
        latest.title_en ? h('i', { lang: 'en', text: latest.title_en }) : null);
    }
    $('#hero-count').textContent = `${WORKS.length} ${WORKS.length === 1 ? 'work' : 'works'}`;

    // 展厅：一面墙挂一幅画，左右交替着挂
    const hall = $('#hall');
    WORKS.forEach((w, i) => {
      const art = h('a', { class: 'frame wall__art', href: workUrl(w), 'data-id': w.id, 'aria-label': `${w.title}，查看作品` },
        h('img', { src: w.image, alt: w.title, width: w.width, height: w.height, decoding: 'async', loading: i < 1 ? 'eager' : 'lazy' }));
      hall.append(h('section', { class: `wall reveal ${i % 2 ? 'wall--r' : 'wall--l'}`, 'aria-label': w.title, 'data-i': i }, art, label(w)));
    });

    // 展品清单
    const list = $('#index');
    WORKS.forEach(w => {
      list.append(h('li', { class: 'row' },
        h('a', { href: workUrl(w), 'data-id': w.id },
          h('span', { class: 'row__no label__num', text: String(w._no).padStart(2, '0') }),
          h('span', { class: 'row__thumb' }, h('img', { src: w.thumb || w.image, alt: '', loading: 'lazy', decoding: 'async' })),
          h('span', { class: 'row__title' }, h('b', { text: w.title }), w.title_en ? h('i', { lang: 'en', text: w.title_en }) : null),
          h('span', { class: 'row__year label__num', text: year(w) }),
          h('span', { class: 'row__medium', text: medium(w) }),
          h('span', { class: 'row__go', 'aria-hidden': 'true', text: '→' }))));
    });
    $('#works-empty').hidden = WORKS.length > 0;

    // 页脚：最近更新
    const newest = WORKS.reduce((m, w) => (String(w.date || '') > m ? String(w.date) : m), '');
    if (newest) {
      $('#foot-year').textContent = newest.slice(0, 4);
      $('#foot-updated').textContent = `共 ${WORKS.length} 件 · 最近更新 ${newest.replace(/-/g, '.')}`;
    }

    // 角落里的展厅编号：走到哪一面墙，就显示第几件
    const room = $('#room');
    $('#room-total').textContent = String(WORKS.length).padStart(2, '0');
    if ('IntersectionObserver' in window) {
      const seen = new Set();
      const show = () => {
        const i = Math.min(...seen);
        const w = WORKS[i];
        room.classList.toggle('is-on', seen.size > 0);
        if (!w) return;
        $('#room-no').textContent = String(i + 1).padStart(2, '0');
        $('#room-title').textContent = w.title;
      };
      const io = new IntersectionObserver(es => {
        es.forEach(e => { const i = +e.target.dataset.i; e.isIntersecting ? seen.add(i) : seen.delete(i); });
        show();
      }, { rootMargin: '-45% 0px -45% 0px' });
      hall.querySelectorAll('.wall').forEach(el => io.observe(el));
    }

    // 点进去的那一幅，在新页面里接着出现
    document.addEventListener('click', e => {
      const a = e.target.closest('a[data-id]');
      if (a) morphTo(a.querySelector('img'));
    });
    // 从详情页返回时，画飞回它原来的墙上
    addEventListener('pagereveal', e => {
      if (!e.viewTransition || !window.navigation || !navigation.activation || !navigation.activation.from) return;
      const id = new URL(navigation.activation.from.url).searchParams.get('id');
      const wall = id && hall.querySelector(`a[data-id="${CSS.escape(id)}"] img`);
      if (!wall) return;
      morphTo(wall);
      e.viewTransition.finished.finally(() => { wall.style.viewTransitionName = ''; });
    });

    reveal();
  }

  /* =================== 作品详情页 =================== */
  function initWork() {
    const id = new URLSearchParams(location.search).get('id');
    const idx = WORKS.findIndex(w => w.id === id);
    const w = WORKS[idx];
    if (!w) {
      $('#piece').hidden = true;
      $('#piece-missing').hidden = false;
      document.title = '找不到这幅画 | Silen1 的画室';
      return;
    }

    document.title = `${w.title}${w.title_en ? ` ${w.title_en}` : ''} | Silen1 的画室`;
    $('#piece-label').replaceWith(Object.assign(label(w, 'h1'), { className: 'label label--lg', id: 'piece-label' }));
    $('#piece-notes').textContent = w.notes || '';
    $('#piece-notes').hidden = !w.notes;
    const art = $('#piece-art');
    art.href = w.image;
    const big = h('img', { src: w.image, alt: w.title, width: w.width, height: w.height, decoding: 'async' });
    art.append(big);
    morphTo(big);
    $('#piece-full').href = w.image;

    const meta = [
      ['完成', w.date ? String(w.date).replace(/-/g, '.') : null],
      ['软件', w.app],
      ['用时', w.hours ? `约 ${w.hours} 小时` : null],
      ['笔刷', Array.isArray(w.brushes) ? w.brushes.join('、') : w.brushes],
      ['标签', Array.isArray(w.tags) ? w.tags.join('、') : w.tags]
    ].filter(([, v]) => v);
    $('#piece-meta').append(...meta.map(([k, v]) => h('div', {}, h('dt', { text: k }), h('dd', { text: v }))));

    if (w.timelapse) initPlayer(w);

    const pager = (el, x, dir) => {
      if (!x) return;
      el.hidden = false;
      el.href = workUrl(x);
      el.append(
        h('img', { src: x.thumb || x.image, alt: '', loading: 'lazy', decoding: 'async' }),
        h('span', {},
          h('small', { text: dir }),
          h('b', { text: x.title }),
          x.title_en ? h('i', { lang: 'en', text: x.title_en }) : null));
    };
    pager($('#pager-prev'), WORKS[idx - 1], '← 上一件');
    $('.pager').addEventListener('click', e => {
      const a = e.target.closest('.pager__link');
      if (a) { big.style.viewTransitionName = ''; morphTo(a.querySelector('img')); }
    });
    pager($('#pager-next'), WORKS[idx + 1], '下一件 →');
  }

  function initPlayer(w) {
    $('#player').hidden = false;
    const video = h('video', { muted: true, playsinline: true, preload: 'auto', poster: w.thumb || w.image, 'aria-label': `${w.title} 的绘画过程` });
    video.muted = true;
    loadSeekable(video, w.timelapse);
    $('#player-screen').append(video);
    const btn = $('#player-btn'), range = $('#player-range'), time = $('#player-time');
    const update = () => {
      const d = video.duration || 0;
      range.value = d ? Math.round(video.currentTime / d * 1000) : 0;
      time.textContent = `${fmtTime(video.currentTime)} / ${fmtTime(d)}`;
    };
    btn.addEventListener('click', () => { video.paused ? video.play() : video.pause(); });
    video.addEventListener('play', () => { btn.textContent = '暂停'; });
    video.addEventListener('pause', () => { btn.textContent = '播放'; });
    video.addEventListener('ended', () => { btn.textContent = '重播'; });
    video.addEventListener('timeupdate', update);
    video.addEventListener('loadedmetadata', update);
    range.addEventListener('input', () => {
      if (video.duration) video.currentTime = range.value / 1000 * video.duration;
    });
  }
})();
