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
  const byline = w => ['Silen1', year(w)].filter(Boolean).join(' · ');

  // 展签：编号、标题、英文名、作者与年份、媒材
  function label(w, tag = 'h3') {
    return h('div', { class: 'label' },
      h('p', { class: 'label__no', text: no(w) }),
      h(tag, { class: 'label__title', text: w.title }),
      w.title_en ? h('p', { class: 'label__en', lang: 'en', text: w.title_en }) : null,
      h('p', { class: 'label__meta', text: byline(w) }),
      h('p', { class: 'label__meta', text: medium(w) }));
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

  // 滚到眼前时慢慢浮现
  function reveal() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach(el => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
    els.forEach(el => io.observe(el));
  }

  const page = document.body.dataset.page;
  if (page === 'home') initHome();
  if (page === 'work') initWork();

  /* =================== 首页 =================== */
  function initHome() {
    const latest = WORKS[0];
    if (latest) {
      $('#hero-fig').hidden = false;
      const a = $('#hero-art');
      a.href = workUrl(latest);
      a.append(h('img', { src: latest.image, alt: latest.title, width: latest.width, height: latest.height, decoding: 'async', fetchpriority: 'high' }));
      $('#hero-cap').textContent = [`${latest.title}${latest.title_en ? `　${latest.title_en}` : ''}`, year(latest)].filter(Boolean).join('，');
      $('#hero-year').textContent = year(latest) || $('#hero-year').textContent;
    }

    // 展厅：一面墙挂一幅画
    const hall = $('#hall');
    WORKS.forEach((w, i) => {
      const art = h('a', { class: 'frame wall__art', href: workUrl(w), 'aria-label': `${w.title}，查看作品` },
        h('img', { src: w.image, alt: w.title, width: w.width, height: w.height, decoding: 'async', loading: i < 1 ? 'eager' : 'lazy' }));
      hall.append(h('section', { class: 'wall reveal', 'aria-label': w.title }, art, label(w)));
    });

    // 目录
    const grid = $('#index');
    WORKS.forEach(w => {
      grid.append(h('li', { class: 'cell reveal' },
        h('a', { href: workUrl(w) },
          h('div', { class: 'cell__img' }, h('img', { src: w.thumb || w.image, alt: w.title, loading: 'lazy', decoding: 'async' })),
          h('p', { class: 'cell__cap' },
            h('span', { text: `${String(w._no).padStart(2, '0')}　${w.title}` }),
            w.title_en ? h('em', { lang: 'en', text: w.title_en }) : null))));
    });
    $('#count').textContent = `${WORKS.length} 件作品 · ${WORKS.length} ${WORKS.length === 1 ? 'work' : 'works'}`;
    $('#works-empty').hidden = WORKS.length > 0;

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
    $('#piece-no').textContent = no(w);
    $('#piece-title').textContent = w.title;
    $('#piece-en').textContent = w.title_en || '';
    $('#piece-en').hidden = !w.title_en;
    $('#piece-by').textContent = byline(w);
    $('#piece-medium').textContent = medium(w);
    $('#piece-notes').textContent = w.notes || '';
    $('#piece-notes').hidden = !w.notes;
    const art = $('#piece-art');
    art.href = w.image;
    art.append(h('img', { src: w.image, alt: w.title, width: w.width, height: w.height, decoding: 'async' }));
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
          x.title_en ? h('em', { lang: 'en', text: x.title_en }) : null));
    };
    pager($('#pager-prev'), WORKS[idx - 1], '← 上一件');
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
