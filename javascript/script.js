(() => {
  const canvas = document.getElementById('cloud');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;

  // ---- building definition (units) ----
  const Wu = 8.5;   // footprint width
  const Du = 5.2;   // footprint depth
  const floorH = 2.0;
  const floors = 3;
  const Hu = floorH * floors; // eave height
  const ridgeH = Hu + 2.6;

  let scale, originX, originY;
  const COS30 = Math.cos(Math.PI / 6);
  const SIN30 = Math.sin(Math.PI / 6);

  function iso(x, y, z) {
    const sx = originX + (x - y) * COS30 * scale;
    const sy = originY + (x + y) * SIN30 * scale - z * scale;
    return [sx, sy];
  }

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  // ---- point store ----
  // each point: {x,y,z, sx,sy, r, color:[r,g,b], baseA, phase, reveal}
  let points = [];

  function amberColor() {
    const t = Math.random();
    const c1 = [201, 138, 75], c2 = [122, 77, 36], c3 = [235, 190, 140];
    const c = t < 0.5 ? lerpC(c1, c2, t * 2) : lerpC(c1, c3, (t - 0.5) * 2);
    return c;
  }
  function slabColor() {
    const c1 = [178, 188, 196], c2 = [222, 228, 232];
    return lerpC(c1, c2, Math.random());
  }
  function strayColor() {
    const c1 = [140, 148, 154], c2 = [90, 96, 102];
    return lerpC(c1, c2, Math.random());
  }
  function lerpC(a, b, t) { return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }

  function addPoint(x, y, z, color, rmin, rmax) {
    points.push({
      x, y, z,
      color,
      r: rand(rmin, rmax),
      baseA: rand(0.35, 0.95),
      phase: rand(0, Math.PI * 2),
      speed: rand(0.4, 1.1),
      reveal: 0 // set later
    });
  }

  function buildCloud() {
    points = [];

    // ---- vertical studs across footprint (grid, with interior partitions) ----
    const stepX = 0.85, stepY = 0.85;
    for (let gx = 0; gx <= Wu + 0.001; gx += stepX) {
      for (let gy = 0; gy <= Du + 0.001; gy += stepY) {
        const onPerimeter = (gx < 0.05 || gx > Wu - 0.05 || gy < 0.05 || gy > Du - 0.05);
        // keep all perimeter studs, thin out interior randomly for partition-wall feel
        if (!onPerimeter && Math.random() < 0.45) continue;
        const jx = gx + rand(-0.04, 0.04);
        const jy = gy + rand(-0.04, 0.04);
        const dz = rand(0.10, 0.16);
        for (let z = 0; z <= Hu + 0.001; z += dz) {
          if (Math.random() < 0.06) continue; // scan gaps
          addPoint(jx, jy, z + rand(-0.02,0.02), amberColor(), 0.7, 1.6);
        }
      }
    }

    // ---- floor decks at each level ----
    for (let f = 0; f <= floors; f++) {
      const z = f * floorH;
      const count = f === 0 ? 950 : 620;
      for (let i = 0; i < count; i++) {
        const x = rand(0, Wu);
        const y = rand(0, Du);
        addPoint(x, y, z + rand(-0.03, 0.03), slabColor(), 0.6, 1.4);
      }
    }

    // ---- roof: ridge + sloped rafters ----
    const ridgeY = Du / 2;
    const rafterStep = 0.55;
    for (let x = 0; x <= Wu + 0.001; x += rafterStep) {
      const jitterX = x + rand(-0.03, 0.03);
      // two slopes from ridge to each eave
      [ [0, Hu], [Du, Hu] ].forEach(([edgeY, edgeZ]) => {
        const steps = 26;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const y = ridgeY + (edgeY - ridgeY) * t;
          const z = ridgeH + (edgeZ - ridgeH) * t + rand(-0.02, 0.02);
          if (Math.random() < 0.08) continue;
          addPoint(jitterX, y, z, amberColor(), 0.6, 1.4);
        }
      });
    }
    // ridge beam itself, denser
    for (let x = 0; x <= Wu + 0.001; x += 0.18) {
      addPoint(x + rand(-0.02,0.02), ridgeY + rand(-0.03,0.03), ridgeH + rand(-0.02,0.02), amberColor(), 0.8, 1.7);
    }

    // ---- stray scan debris off to the sides (like the source scan) ----
    for (let i = 0; i < 260; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = side < 0 ? rand(-4.2, -0.6) : rand(Wu + 0.6, Wu + 4.6);
      const y = rand(-1, Du + 2.5);
      const z = rand(0, Hu * 0.85);
      addPoint(x, y, z, strayColor(), 0.5, 1.3);
    }
    for (let i = 0; i < 120; i++) {
      const x = rand(-1, Wu + 1);
      const y = rand(Du + 0.6, Du + 3.2);
      const z = rand(0, 2.5);
      addPoint(x, y, z, strayColor(), 0.5, 1.1);
    }

    // ---- faint reflection under the ground floor ----
    const reflectionSource = points.slice(0, Math.floor(points.length * 0.35));
    reflectionSource.forEach(p => {
      addPoint(p.x, p.y, -p.z * 0.6 - 0.05, p.color, p.r * 0.8, p.r * 0.8);
    });
    // mark the last N (reflection) with lower alpha via flag
    for (let i = points.length - reflectionSource.length; i < points.length; i++) {
      points[i].baseA *= 0.22;
      points[i].isReflection = true;
    }

    // assign reveal order: top (roof) sweeps down first
    let minZ = Infinity, maxZ = -Infinity;
    points.forEach(p => { if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z; });
    const span = maxZ - minZ || 1;
    points.forEach(p => {
      const t = 1 - (p.z - minZ) / span; // 0 at top, 1 at bottom
      p.revealAt = t * 1650 + rand(-120, 120);
    });
  }

  function project() {
    for (const p of points) {
      const [sx, sy] = iso(p.x, p.y, p.z);
      p.sx = sx; p.sy = sy;
    }
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const fitW = W * 0.72;
    const fitH = H * 0.78;
    const scaleX = fitW / ((Wu + Du) * COS30);
    const scaleY = fitH / ((Wu + Du) * SIN30 + ridgeH);
    scale = Math.min(scaleX, scaleY);

    originX = W / 2 - ((Wu - Du) * COS30 * scale) / 2;
    originY = H * 0.5 + (ridgeH * scale) * 0.28;

    project();
    positionHotspots();
  }

  // ---- render loop ----
  let startTime = null;
  function frame(ts) {
    if (startTime === null) startTime = ts;
    const elapsed = ts - startTime;
    ctx.clearRect(0, 0, W, H);

    for (const p of points) {
      let reveal = reduceMotion ? 1 : Math.min(1, Math.max(0, (elapsed - p.revealAt) / 260));
      if (reveal <= 0) continue;
      const flicker = reduceMotion ? 1 : (0.82 + 0.18 * Math.sin(elapsed * 0.0016 * p.speed + p.phase));
      const a = p.baseA * reveal * flicker;
      if (a <= 0.01) continue;
      const [cr, cg, cb] = p.color;
      ctx.fillStyle = `rgba(${cr|0},${cg|0},${cb|0},${a.toFixed(3)})`;
      const r = p.r * (0.6 + 0.4 * reveal);
      ctx.fillRect(p.sx - r/2, p.sy - r/2, r, r);
    }

    requestAnimationFrame(frame);
  }

  // ---- hotspots ----
  // anchors given in building units, chosen to sit on real structural features
  const hotspots = [
    { id: '01', title: 'OVERVIEW',  href: 'overview.html',  x: Wu*0.5,  y: Du/2, z: ridgeH + 0.15 },
    { id: '02', title: 'STRUCTURE', href: 'structure.html', x: Wu*0.15, y: 0.0,  z: Hu * 0.62 },
    { id: '03', title: 'MATERIALS', href: 'materials.html', x: Wu*0.62, y: Du*0.35, z: floorH * 1.0 },
    { id: '04', title: 'PROCESS',   href: 'process.html',   x: 0.0,     y: Du*0.85, z: floorH * 0.15 },
    { id: '05', title: 'GALLERY',   href: 'gallery.html',   x: -2.3,    y: Du*0.6,  z: 1.1 },
    { id: '06', title: 'CONTACT',   href: 'contact.html',   x: Wu*0.9,  y: Du*0.9,  z: floorH * 2.35 },
  ];

  const hotspotEls = [];

  function buildHotspotDOM() {
    hotspots.forEach((h, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'hotspot';

      const a = document.createElement('a');
      a.href = h.href;
      a.setAttribute('aria-label', h.title);

      const reticle = document.createElement('div');
      reticle.className = 'reticle';
      reticle.innerHTML = `
        <div class="ring"></div>
        <div class="cross"><i class="h"></i><i class="v"></i></div>
        <div class="core"></div>
      `;

      const readout = document.createElement('div');
      readout.className = 'readout';
      const cx = Math.round((h.x / Wu) * 9200 + 1000);
      const cy = Math.round((h.y / Du) * 5400 + 400);
      const cz = Math.round(h.z * 1000);
      readout.textContent = `X ${cx}  Y ${cy}  Z ${cz}`;

      const idx = document.createElement('div');
      idx.className = 'idx';
      idx.textContent = `PT.${h.id}`;

      const label = document.createElement('div');
      label.className = 'label';
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', '0 0 280 80');
      const pathId = `arc-${h.id}`;
      const path = document.createElementNS(svgNS, 'path');
      const r = Math.max(58, h.title.length * 9);
      const cx0 = 140, cy0 = 6;
      path.setAttribute('id', pathId);
      path.setAttribute('d', `M ${cx0 - r} ${cy0} A ${r} ${r} 0 0 1 ${cx0 + r} ${cy0}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'none');
      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('text-anchor', 'middle');
      const textPath = document.createElementNS(svgNS, 'textPath');
      textPath.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${pathId}`);
      textPath.setAttribute('href', `#${pathId}`);
      textPath.setAttribute('startOffset', '50%');
      textPath.textContent = h.title;
      text.appendChild(textPath);
      svg.appendChild(path);
      svg.appendChild(text);
      label.appendChild(svg);

      reticle.appendChild(readout);
      a.appendChild(reticle);
      a.appendChild(idx);
      a.appendChild(label);
      wrap.appendChild(a);
      overlay.appendChild(wrap);

      hotspotEls.push({ el: wrap, def: h });
    });
  }

  function positionHotspots() {
    hotspotEls.forEach(({ el, def }) => {
      const [sx, sy] = iso(def.x, def.y, def.z);
      el.style.left = sx + 'px';
      el.style.top = sy + 'px';
    });
  }

  buildCloud();
  buildHotspotDOM();
  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(frame);
})();
