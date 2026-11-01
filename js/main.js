/* Silen1 的画室：所有页面共用的脚本。
   作品数据来自 data/works.js（window.WORKS），不需要服务器，也没有任何外部请求。 */
(() => {
  'use strict';

  const WORKS = (Array.isArray(window.WORKS) ? window.WORKS : [])
    .filter(w => w && w.id && w.image)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

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
  const fmtDate = d => (d ? String(d).replace(/-/g, '.') : '');
  const workUrl = w => `work.html?id=${encodeURIComponent(w.id)}`;
  // 用 id 生成稳定的“随机数”，这样每次打开，作品都落在同一个位置
  function seeded(str) {
    let x = 2166136261;
    for (const c of String(str)) x = Math.imul(x ^ c.charCodeAt(0), 16777619);
    return () => {
      x = Math.imul(x ^ (x >>> 15), 2246822507);
      x = Math.imul(x ^ (x >>> 13), 3266489909);
      return ((x ^= x >>> 16) >>> 0) / 4294967296;
    };
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

  const page = document.body.dataset.page;
  if (page === 'home') initHome();
  if (page === 'work') initWork();

  /* =================== 首页 =================== */
  function initHome() {
    initDive();
    initBoard();
  }

  /* 掉进画里：
     每幅画里有一个洞口（portal），下一幅画就藏在洞口里，尺寸只有它的 K 倍。
     滚动时镜头朝洞口放大，放大到 1/K 倍时，下一幅画正好铺满屏幕，于是“掉”了进去。
     最后一幅画的洞口通回第一幅，所以这条路是一个圈。 */
  function initDive() {
    const sec = $('#dive');
    if (!sec) return;
    const list = WORKS;
    const N = list.length;
    if (N < 2 || reduceMotion) {
      sec.hidden = true;
      const lede = $('#static-lede');
      if (lede && N) lede.hidden = false;
      return;
    }

    const K = 0.2;            // 下一幅画在洞里的大小（相对当前这幅）
    const HOLE = 0.42;        // 洞口半径，占画面短边的比例（在下一幅画自己的尺寸下）
    const world = $('#dive-world');
    sec.style.setProperty('--levels', N);

    // 每幅画一个图层，只在需要时才加载图片
    const levels = list.map(w => {
      const img = h('img', { alt: '', decoding: 'async', draggable: 'false' });
      // 洞口张大时会超出画面边缘，外面用同一幅画的模糊版本补上，洞就一直是圆的
      const halo = h('img', { class: 'level__halo', alt: '', decoding: 'async', draggable: 'false' });
      const frame = h('div', { class: 'level__frame' }, img);
      const clip = h('div', { class: 'level__hole' }, halo, frame);
      const ring = h('span', { class: 'ring' });
      const el = h('div', { class: 'level' }, clip, ring);
      el.hidden = true;
      world.append(el);
      return { w, el, clip, img, halo, ring, loaded: false };
    });
    const ensure = i => {
      const L = levels[i];
      if (L.loaded) return;
      L.img.src = L.w.image;
      L.halo.src = L.w.thumb || L.w.image;
      L.loaded = true;
    };

    // 深度计
    const depth = $('#depth');
    const dots = list.map((w, i) => {
      const b = h('button', { type: 'button', text: String(i + 1), 'aria-label': `第 ${i + 1} 层：${w.title}`, title: w.title });
      b.addEventListener('click', () => {
        const span = sec.offsetHeight - window.innerHeight;
        window.scrollTo({ top: sec.offsetTop + span * (i / N), behavior: 'smooth' });
      });
      depth.append(h('li', {}, b));
      return b;
    });

    let vw = 0, vh = 0, md = 0, portals = [];
    function measure() {
      vw = window.innerWidth; vh = window.innerHeight; md = Math.min(vw, vh);
      levels.forEach(L => { L.el.style.width = `${vw}px`; L.el.style.height = `${vh}px`; });
      // 把“画上的位置”换算成“屏幕上的位置”（画是 cover 铺满的，会被裁掉一部分）
      portals = list.map(w => {
        const W = w.width || 1000, H = w.height || 1000;
        const s = Math.max(vw / W, vh / H), dw = W * s, dh = H * s;
        const rnd = seeded(w.id);
        const [u, v] = Array.isArray(w.portal) ? w.portal : [0.3 + rnd() * 0.4, 0.3 + rnd() * 0.4];
        const x = clamp((vw - dw) / 2 + u * dw, vw * 0.16, vw * 0.84);
        const y = clamp((vh - dh) / 2 + v * dh, vh * 0.2, vh * 0.8);
        return { x: x - vw / 2, y: y - vh / 2 };
      });
      // 洞口的圈画在每一层上，位置就是它的 portal
      const r = HOLE * md * K * 1.18;
      levels.forEach((L, i) => {
        const p = portals[i];
        Object.assign(L.ring.style, { width: `${r * 2}px`, height: `${r * 2}px`, left: `${vw / 2 + p.x - r}px`, top: `${vh / 2 + p.y - r}px` });
      });
    }

    const smooth = x => x * x * (3 - 2 * x); // 在每幅画上多停一会儿
    let lastShown = [];
    function render(t) {
      const c = Math.min(Math.floor(t), N);
      const f = t - c;
      const fe = smooth(f);
      const Z = Math.pow(K, -fe);
      const p0 = portals[c % N];
      const q = { x: p0.x / (1 - K), y: p0.y / (1 - K) };  // 放大时保持不动的那个点
      const p1 = portals[(c + 1) % N];
      const layers = [
        { i: c % N, C: { x: 0, y: 0 }, S: 1 },
        { i: (c + 1) % N, C: p0, S: K },
        { i: (c + 2) % N, C: { x: p0.x + K * p1.x, y: p0.y + K * p1.y }, S: K * K }
      ];
      const r0 = HOLE * md;
      const rMax = Math.hypot(vw, vh) / 2 + 4;
      const shown = [];
      layers.forEach((Ly, j) => {
        const L = levels[Ly.i];
        if (shown.includes(L)) return; // 只有两幅画时避免重复
        shown.push(L);
        ensure(Ly.i);
        const scale = Ly.S * Z;
        const sx = q.x + (Ly.C.x - q.x) * Z;
        const sy = q.y + (Ly.C.y - q.y) * Z;
        L.el.hidden = false;
        L.el.style.zIndex = String(j + 1);
        L.el.style.transform = `translate3d(${sx.toFixed(2)}px, ${sy.toFixed(2)}px, 0) scale(${scale.toFixed(5)})`;
        L.el.classList.toggle('is-deep', j > 0);
        const r = j === 0 ? rMax : j === 1 ? r0 + (rMax - r0) * fe : r0;
        L.clip.style.clipPath = j === 0 ? 'none' : `circle(${r.toFixed(1)}px at 50% 50%)`;
        L.ring.style.opacity = j === 0 ? String(clamp(1 - fe * 2.5)) : '1';
      });
      lastShown.forEach(L => { if (!shown.includes(L)) L.el.hidden = true; });
      lastShown = shown;
      // 提前加载再往下一层
      ensure((c + 3) % N);

      // 文字：停稳的时候才出现
      const cur = (fe < 0.5 ? c : c + 1) % N;
      const settled = Math.min(f, 1 - f) < 0.08;
      sec.classList.toggle('is-moving', !settled);
      sec.classList.toggle('is-deeper', t > 0.5);
      sec.classList.toggle('is-looped', t > N - 0.08);
      const w = list[cur];
      $('#dive-layer').textContent = `第 ${cur + 1} 层，共 ${N} 层`;
      $('#dive-title').textContent = w.title;
      $('#dive-link').href = workUrl(w);
      dots.forEach((d, i) => d.setAttribute('aria-current', String(i === cur)));
    }

    let target = 0, current = 0, raf = 0;
    const progress = () => {
      const r = sec.getBoundingClientRect();
      return clamp(-r.top / Math.max(1, r.height - window.innerHeight)) * N;
    };
    function tick() {
      current += (target - current) * 0.14;
      if (Math.abs(target - current) < 0.0005) current = target;
      render(current);
      raf = current === target ? 0 : requestAnimationFrame(tick);
    }
    const onScroll = () => {
      target = progress();
      // 一下子跳很远（比如点了导航）时，不必把中间每一层都飞一遍
      if (Math.abs(target - current) > 1.2) current = target - Math.sign(target - current) * 1.2;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => { measure(); render(current); onScroll(); });
    measure();
    target = current = progress();
    render(current);
  }

  function initBoard() {
    const board = $('#board');
    const grid = $('#grid');
    if (!board || !grid) return;

    $('#works-count').textContent = WORKS.length ? `${WORKS.length} 幅` : '';
    if (!WORKS.length) { $('#works-empty').hidden = false; board.hidden = true; return; }

    const cards = WORKS.map(w => {
      const rnd = seeded(w.id);
      const li = h('li', { class: 'card' },
        h('a', { href: workUrl(w), draggable: 'false' },
          h('span', { class: 'card__paper' },
            h('img', { src: w.thumb || w.image, alt: w.title, width: w.width, height: w.height, loading: 'lazy', decoding: 'async', draggable: 'false' }),
            h('span', { class: 'card__title', text: w.title }),
            h('span', { class: 'card__meta' }, fmtDate(w.date), w.timelapse ? h('span', { class: 'card__badge', text: '有回放' }) : null)
          )
        )
      );
      li._rnd = rnd;
      li._w = w;
      return li;
    });
    grid.append(...cards);

    const toggle = $('#layout-toggle');
    const hint = $('#board-hint');
    const small = window.matchMedia('(max-width: 820px)');
    let scatter = !reduceMotion && !small.matches;
    let pan = { x: 0, y: 0 }, plane = { w: 0, h: 0 };

    function layout() {
      board.classList.toggle('is-scatter', scatter);
      board.classList.toggle('is-tidy', !scatter);
      toggle.textContent = scatter ? '排整齐' : '撒开来';
      toggle.setAttribute('aria-pressed', String(!scatter));
      hint.hidden = !scatter;
      if (!scatter) {
        grid.style.transform = '';
        cards.forEach(c => { c.style.left = c.style.top = c.style.width = ''; c.style.removeProperty('--rot'); });
        return;
      }
      // 把作品撒在网格的格子里，每个格子里再随机偏一点、歪一点
      const n = cards.length;
      const cols = Math.max(2, Math.ceil(Math.sqrt(n * 1.6)));
      const rows = Math.ceil(n / cols);
      const cell = 400;
      plane = { w: cols * cell + 200, h: rows * cell * 1.15 + 200 };
      grid.style.width = `${plane.w}px`;
      grid.style.height = `${plane.h}px`;
      cards.forEach((c, i) => {
        const r = c._rnd;
        const w = 210 + r() * 130;
        const col = i % cols, row = Math.floor(i / cols);
        const x = 100 + col * cell + r() * (cell - w) + (row % 2 ? cell * .3 : 0);
        const y = 100 + row * cell * 1.15 + r() * 60;
        c.style.width = `${w}px`;
        c.style.left = `${x}px`;
        c.style.top = `${y}px`;
        c.style.setProperty('--rot', `${(r() * 16 - 8).toFixed(1)}deg`);
      });
      // 一开始先把画板中心对准视口
      const bw = board.clientWidth, bh = board.clientHeight;
      pan = { x: (bw - plane.w) / 2, y: Math.min(0, (bh - plane.h) / 2 + 60) };
      applyPan();
    }

    function applyPan() {
      const bw = board.clientWidth, bh = board.clientHeight;
      const slack = 160;
      pan.x = clamp(pan.x, Math.min(0, bw - plane.w) - slack, slack);
      pan.y = clamp(pan.y, Math.min(0, bh - plane.h) - slack, slack);
      grid.style.transform = `translate3d(${pan.x}px, ${pan.y}px, 0)`;
    }

    // 拖动画板（带一点惯性）
    let drag = null, vel = { x: 0, y: 0 }, glide = 0, moved = false;
    board.addEventListener('pointerdown', e => {
      if (!scatter || e.button !== 0) return;
      cancelAnimationFrame(glide);
      drag = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, t: performance.now() };
      vel = { x: 0, y: 0 };
      moved = false;
    });
    window.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!moved && Math.hypot(dx, dy) > 6) {
        moved = true;
        board.classList.add('is-dragging');
        try { board.setPointerCapture(e.pointerId); } catch (_) {}
      }
      if (!moved) return;
      const now = performance.now();
      const nx = drag.px + dx, ny = drag.py + dy;
      const dt = Math.max(1, now - drag.t);
      vel = { x: (nx - pan.x) / dt * 16, y: (ny - pan.y) / dt * 16 };
      drag.t = now;
      pan.x = nx; pan.y = ny;
      applyPan();
    });
    const endDrag = () => {
      if (!drag) return;
      drag = null;
      board.classList.remove('is-dragging');
      if (!moved) return;
      const step = () => {
        vel.x *= 0.92; vel.y *= 0.92;
        pan.x += vel.x; pan.y += vel.y;
        applyPan();
        if (Math.hypot(vel.x, vel.y) > 0.3) glide = requestAnimationFrame(step);
      };
      glide = requestAnimationFrame(step);
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    // 拖动后松手不算点击
    board.addEventListener('click', e => { if (moved) { e.preventDefault(); moved = false; } }, true);

    // 用键盘 Tab 到某幅画时，把它挪进视野
    board.addEventListener('focusin', e => {
      if (!scatter) return;
      const card = e.target.closest('.card');
      if (!card) return;
      board.scrollTop = board.scrollLeft = 0;
      const bw = board.clientWidth, bh = board.clientHeight;
      pan.x = bw / 2 - (card.offsetLeft + card.offsetWidth / 2);
      pan.y = bh / 2 - (card.offsetTop + card.offsetHeight / 2);
      applyPan();
    });

    toggle.addEventListener('click', () => { scatter = !scatter; layout(); });
    small.addEventListener?.('change', ev => { scatter = !reduceMotion && !ev.matches; layout(); });
    window.addEventListener('resize', () => { if (scatter) applyPan(); });
    layout();
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

    document.title = `${w.title} | Silen1 的画室`;
    $('#piece-title').textContent = w.title;
    $('#piece-date').textContent = fmtDate(w.date);
    $('#piece-notes').textContent = w.notes || '';
    $('#piece-art').append(h('img', { src: w.image, alt: w.title, width: w.width, height: w.height, decoding: 'async' }));
    $('#piece-full').href = w.image;
    $('#piece-full').target = '_blank';
    $('#piece-full').rel = 'noopener';

    const meta = [
      ['软件', w.app],
      ['画布', w.canvas],
      ['用时', w.hours ? `约 ${w.hours} 小时` : null],
      ['笔刷', Array.isArray(w.brushes) ? w.brushes.join('、') : w.brushes],
      ['标签', Array.isArray(w.tags) ? w.tags.join('、') : w.tags]
    ].filter(([, v]) => v);
    $('#piece-meta').append(...meta.map(([k, v]) => h('div', {}, h('dt', { text: k }), h('dd', { text: v }))));

    if (w.timelapse) initPlayer(w);

    const prev = WORKS[idx - 1], next = WORKS[idx + 1];
    if (prev) Object.assign($('#pager-prev'), { hidden: false, href: workUrl(prev), textContent: `较新：${prev.title}` });
    if (next) Object.assign($('#pager-next'), { hidden: false, href: workUrl(next), textContent: `较早：${next.title}` });
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
