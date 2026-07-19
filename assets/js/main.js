window.__heroVisible = true;
(function() {
  const heroEl = document.getElementById('globe-sticky');
  if (!heroEl || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { window.__heroVisible = e.isIntersecting; });
  }, { rootMargin: '200px 0px' });
  io.observe(heroEl);
})();

if (window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
} else {
  console.warn('GSAP/ScrollTrigger failed to load — hero entrance & scroll-linked animations disabled, rest of the page continues normally.');
}

(function() {
  function hideLoader() {
    const loader = document.getElementById('loader');
    if (!loader) return;
    if (window.gsap) {
      gsap.to(loader, {
        opacity: 0, duration: 0.6, delay: 0.3, ease: 'power2.out',
        onComplete: () => { loader.style.display = 'none'; }
      });
    } else {
      loader.style.transition = 'opacity 0.6s ease';
      setTimeout(() => {
        loader.style.opacity = '0';
        setTimeout(() => { loader.style.display = 'none'; }, 600);
      }, 300);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideLoader);
  } else {
    hideLoader();
  }
})();

const logoHomeLink = document.getElementById('logoHomeLink');
if (logoHomeLink) logoHomeLink.addEventListener('click', e => {
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// AURORA BACKGROUND

(function() {
  const canvas = document.getElementById('aurora-canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return;

  const vs = `
    attribute vec2 p;
    void main(){ gl_Position=vec4(p,0.,1.); }
  `;
  const fs = `
    precision highp float;
    uniform float uT;
    uniform vec2 uR;

    vec3 permute(vec3 x){return mod(((x*34.)+1.)*x,289.);}
    float snoise(vec2 v){
      const vec4 C=vec4(.211324865,.366025404,-.577350269,.024390244);
      vec2 i=floor(v+dot(v,C.yy)),x0=v-i+dot(i,C.xx);
      vec2 i1=(x0.x>x0.y)?vec2(1,0):vec2(0,1);
      vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1;
      i=mod(i,289.);
      vec3 p=permute(permute(i.y+vec3(0,i1.y,1))+i.x+vec3(0,i1.x,1));
      vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);
      m=m*m;m=m*m;
      vec3 x2=2.*fract(p*C.www)-1.,h=abs(x2)-.5,ox=floor(x2+.5),a0=x2-ox;
      m*=1.79284291-.85373472*(a0*a0+h*h);
      vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;
      return 130.*dot(m,g);
    }

    void main(){
      vec2 uv=gl_FragCoord.xy/uR;
      vec3 c0=vec3(0.914,0.706,0.031);
      vec3 c1=vec3(0.329,0.031,0.847);
      vec3 c2=vec3(0.388,0.400,0.945);
      vec3 ramp=uv.x<.5?mix(c0,c1,uv.x*2.):mix(c1,c2,(uv.x-.5)*2.);
      float h=snoise(vec2(uv.x*2.+uT*.08,uT*.2))*.5*1.0;
      h=exp(h); h=(uv.y*2.-h+.2);
      float intensity=.55*h;
      float alpha=smoothstep(.0,.5,intensity);
      vec3 col=intensity*ramp;
      gl_FragColor=vec4(col*alpha,alpha);
    }
  `;

  function mkShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, mkShader(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, mkShader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog); gl.useProgram(prog);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
  const pLoc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(pLoc);
  gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);

  const uT = gl.getUniformLocation(prog, 'uT');
  const uR = gl.getUniformLocation(prog, 'uR');
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0,0,0,0);

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uR, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  const t0 = performance.now();
  function render(now) {
    if (window.__heroVisible === false) { requestAnimationFrame(render); return; }
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uT, (now-t0)*0.001);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();

// ============================================================
// ROTATING GLOBE — Three.js via CDN
// ============================================================
(function() {
  const script = document.createElement('script');
  script.src = 'assets/js/three.min.js';
  script.onload = function() {
    initGlobe();
    if (typeof initFloatingLinesBG === 'function') initFloatingLinesBG();
  };
  script.onerror = () => console.warn('Three.js CDN blocked — globe disabled (open via server or deploy)');
  document.head.appendChild(script);

  function initGlobe() {
    const canvas = document.getElementById('globe-canvas');
    const W = window.innerWidth, H = window.innerHeight;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // ── SCENE & CAMERA ──
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.set(0, 0, 3.2);

    // ── GLOBE ──
    const RADIUS = 1.0;
    const globeGeo = new THREE.SphereGeometry(RADIUS, 64, 64);

    // Draw globe texture on canvas
    function makeGlobeTexture(geoData) {
      const size = 2048;
      const tc = document.createElement('canvas');
      tc.width = size; tc.height = size;
      const ctx = tc.getContext('2d');

      // Ocean
      const oceanGrad = ctx.createLinearGradient(0, 0, 0, size);
      oceanGrad.addColorStop(0,   '#0a1628');
      oceanGrad.addColorStop(0.5, '#0d1f3c');
      oceanGrad.addColorStop(1,   '#071226');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, size, size);

      // Grid lines (latitude/longitude)
      ctx.strokeStyle = 'rgba(234,179,8,0.12)';
      ctx.lineWidth = 1;
      for (let lat = -80; lat <= 80; lat += 20) {
        const y = ((90 - lat) / 180) * size;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
      }
      for (let lon = 0; lon < 360; lon += 20) {
        const x = (lon / 360) * size;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
      }

      function lonLatToXY(lon, lat) {
        return [((lon + 180) / 360) * size, ((90 - lat) / 180) * size];
      }

      // Real coastline data — Natural Earth via world-atlas, country-level features
      function drawFeature(feat, fillOverride, strokeOverride) {
        const g = feat.geometry; if (!g) return;
        const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
        if (fillOverride)   ctx.fillStyle   = fillOverride;
        if (strokeOverride) ctx.strokeStyle = strokeOverride;
        for (const poly of polys) for (const ring of poly) {
          if (ring.length < 3) continue;
          ctx.beginPath();
          const [x0, y0] = lonLatToXY(ring[0][0], ring[0][1]);
          ctx.moveTo(x0, y0);
          for (let i = 1; i < ring.length; i++) {
            const [x, y] = lonLatToXY(ring[i][0], ring[i][1]);
            ctx.lineTo(x, y);
          }
          ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      }

      ctx.fillStyle   = 'rgba(234,179,8,0.22)';
      ctx.strokeStyle = 'rgba(234,179,8,0.45)';
      ctx.lineWidth   = 1.1;
      if (geoData && geoData.landFeatures) {
        // Continent silhouettes — single merged land mass, no internal borders
        for (const f of geoData.landFeatures) drawFeature(f);
      }
      if (geoData && geoData.indiaFeature) {
        ctx.lineWidth = 1.8;
        drawFeature(geoData.indiaFeature, 'rgba(234,179,8,0.42)', 'rgba(234,179,8,0.75)');
      }

      // Glowing dots for major cities
      const cities = [
        [72.88, 19.07],  // Mumbai
        [80.27, 13.08],  // Chennai
        [77.59, 12.97],  // Bengaluru
        [-74, 40.7],     // New York
        [-0.12, 51.5],   // London
        [2.35, 48.86],   // Paris
        [139.69, 35.68], // Tokyo
        [116.40, 39.90], // Beijing
        [151.21, -33.87],// Sydney
        [28.98, 41.01],  // Istanbul
        [55.27, 25.20],  // Dubai
        [-43.17, -22.90],// Rio
        [18.42, -33.92], // Cape Town
      ];

      cities.forEach(([lon, lat]) => {
        const [x, y] = lonLatToXY(lon, lat);
        const grad = ctx.createRadialGradient(x, y, 0, x, y, 12);
        grad.addColorStop(0, 'rgba(234,179,8,0.95)');
        grad.addColorStop(0.3, 'rgba(234,179,8,0.5)');
        grad.addColorStop(1, 'rgba(234,179,8,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f4ebd0';
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      return new THREE.CanvasTexture(tc);
    }

    const globeMat = new THREE.MeshPhongMaterial({
      map: makeGlobeTexture(null),
      transparent: true,
      opacity: 0.97,
      shininess: 25,
      specular: new THREE.Color(0.1, 0.1, 0.1),
    });

    const globe = new THREE.Mesh(globeGeo, globeMat);
    scene.add(globe);

    // Fetch real Natural Earth coastline data and repaint once loaded.
    // land-50m = continent silhouettes only, no internal country borders.
    // countries-50m = used only to extract India's polygon for the highlight.
    Promise.all([
      fetch('assets/data/land-50m.json').then(r => r.json()),
      fetch('assets/data/countries-50m.json').then(r => r.json())
    ]).then(([landWorld, countriesWorld]) => {
        function decodeWorld(world, topo) {
          const sc = world.transform.scale, tr = world.transform.translate;
          function decodeArc(i) {
            const rev = i < 0, idx = rev ? ~i : i; let x = 0, y = 0;
            const pts = world.arcs[idx].map(([dx, dy]) => { x += dx; y += dy; return [x*sc[0]+tr[0], y*sc[1]+tr[1]]; });
            return rev ? pts.reverse() : pts;
          }
          const features = [];
          topo.geometries.forEach(g => {
            if (g.type === 'Polygon')      features.push({ id: g.id, geometry: { type: 'Polygon', coordinates: g.arcs.map(a => a.flatMap(decodeArc)) } });
            else if (g.type === 'MultiPolygon') features.push({ id: g.id, geometry: { type: 'MultiPolygon', coordinates: g.arcs.map(p => p.map(a => a.flatMap(decodeArc))) } });
          });
          return features;
        }

        // Continent silhouette — single merged land feature, no borders
        const landFeatures = decodeWorld(landWorld, landWorld.objects.land);

        // Country-level data, filtered to India only (id 356)
        const countryFeatures = decodeWorld(countriesWorld, countriesWorld.objects.countries);
        const indiaFeature = countryFeatures.find(f => f.id === '356' || f.id === 356);

        globeMat.map.dispose();
        globeMat.map = makeGlobeTexture({ landFeatures, indiaFeature });
        globeMat.map.needsUpdate = true;
        globeMat.map.generateMipmaps = false;      
        globeMat.map.minFilter = THREE.LinearFilter;  
      })
      .catch(() => {
         console.error('Globe texture failed to load/render:', err);
      });

    // ── ATMOSPHERE GLOW ──
    const atmoGeo = new THREE.SphereGeometry(RADIUS * 1.08, 64, 64);
    const atmoMat = new THREE.ShaderMaterial({
      side: THREE.FrontSide,
      transparent: true,
      uniforms: {
        glowColor: { value: new THREE.Color(0.914, 0.706, 0.031) },
        viewVector: { value: camera.position }
      },
      vertexShader: `
        uniform vec3 viewVector;
        varying float intensity;
        void main() {
          vec3 vNormal = normalize(normalMatrix * normal);
          vec3 vNormel = normalize(normalMatrix * viewVector);
          intensity = pow(0.6 - dot(vNormal, vNormel), 2.5);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        varying float intensity;
        void main() {
          vec3 glow = glowColor * intensity;
          float clampedIntensity = clamp(intensity, 0.0, 1.0);
          gl_FragColor = vec4(glow, intensity * 0.65);
        }
      `
    });
    const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(atmosphere);

    // ── ROUTE ARCS ──
    const routeColor = new THREE.Color(0.914, 0.706, 0.031);

    function latLonToVec3(lat, lon, r) {
      const phi = (90 - lat) * Math.PI / 180;
      const theta = (lon + 180) * Math.PI / 180;
      return new THREE.Vector3(
        -r * Math.sin(phi) * Math.cos(theta),
         r * Math.cos(phi),
         r * Math.sin(phi) * Math.sin(theta)
      );
    }

    function createArc(lat1, lon1, lat2, lon2) {
      const start = latLonToVec3(lat1, lon1, RADIUS);
      const end   = latLonToVec3(lat2, lon2, RADIUS);
      const mid   = start.clone().add(end).normalize().multiplyScalar(RADIUS * 1.22);

      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const points = curve.getPoints(60);
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({ color: routeColor, transparent: true, opacity: 0.55 });
      return new THREE.Line(geo, mat);
    }

    const routes = [
      [19.07, 72.88,  13.08, 80.27],  // Mumbai ↔ Chennai
      [13.08, 80.27,  51.50, -0.12],  // Chennai ↔ London
      [51.50, -0.12,  40.71, -74.00], // London ↔ New York
      [40.71, -74.00, 35.68, 139.69], // New York ↔ Tokyo
      [35.68, 139.69, -33.87, 151.21],// Tokyo ↔ Sydney
      [25.20, 55.27,  19.07, 72.88],  // Dubai ↔ Mumbai
      [19.07, 72.88,  -22.90, -43.17],// Mumbai ↔ Rio
      [48.86, 2.35,   41.01, 28.98],  // Paris ↔ Istanbul
    ];

    const arcGroup = new THREE.Group();
    const arcCurves = [];
    routes.forEach(r => {
      arcGroup.add(createArc(...r));
      const s = latLonToVec3(r[0], r[1], RADIUS);
      const e = latLonToVec3(r[2], r[3], RADIUS);
      const m = s.clone().add(e).normalize().multiplyScalar(RADIUS * 1.22);
      arcCurves.push(new THREE.QuadraticBezierCurve3(s, m, e));
    });
    scene.add(arcGroup);

    // Package dots along arcs
    const dotGroup = new THREE.Group();
    const dots = [];
    arcCurves.forEach((curve, i) => {
      [0, 0.52].forEach(offset => {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.016, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xEAB308, transparent: true })
        );
        mesh.userData = { curve, t: offset, speed: 0.09 + Math.random() * 0.06 };
        dots.push(mesh);
        dotGroup.add(mesh);
      });
    });
    scene.add(dotGroup);

    // ── STARS ──
    const starGeo = new THREE.BufferGeometry();
    const starVerts = [];
    for (let i = 0; i < 2800; i++) {
      const r = 18 + Math.random() * 12;
      const phi   = Math.acos(2 * Math.random() - 1);
      const theta = 2 * Math.PI * Math.random();
      starVerts.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.045, transparent: true, opacity: 0.7 });
    scene.add(new THREE.Points(starGeo, starMat));

    // ── LIGHTS ──
    scene.add(new THREE.AmbientLight(0x222233, 0.9));
    const sunLight = new THREE.DirectionalLight(0xfff3cc, 1.3);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);
    const rimLight = new THREE.DirectionalLight(0x3344ff, 0.5);
    rimLight.position.set(-5, -2, -3);
    scene.add(rimLight);

    // ── RESIZE ──
    window.addEventListener('resize', () => {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });

    // ── SCROLL STATE (lerp for smoothness) ──
    let scrollProgress = 0;
    let targetProgress = 0;

    const heroText    = document.getElementById('hero-text');
    const scrollHint  = document.getElementById('scroll-hint');
    const progressBar = document.getElementById('progress-bar');
    const bloomOverlay = document.getElementById('bloom-overlay');
    const dotCanvas    = document.getElementById('dot-field-canvas');
    const page2        = document.getElementById('page2');
    const act3El       = document.getElementById('act3');
    let cardsRisen = false;

    function riseCards() {
      if (cardsRisen) return;
      cardsRisen = true;
      // heading stagger first
      gsap.fromTo('.p2-tag',   { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', delay: 0 });
      gsap.fromTo('.p2-title', { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.75, ease: 'power3.out', delay: 0.1 });
      gsap.fromTo('.p2-sub',   { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', delay: 0.22 });
      // then cards
      ['card-1','card-2','card-3'].forEach((id, i) => {
        const el = document.getElementById(id);
        if (!el) return;
        gsap.fromTo(el,
          { opacity: 0, y: 60, filter: 'blur(8px)' },
          { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9,
            ease: 'power3.out', delay: 0.3 + i * 0.16,
            onStart: () => el.classList.add('risen') }
        );
      });
    }

    window.addEventListener('scroll', () => {
      const driver = document.getElementById('scroll-driver');
      const driverH = driver.clientHeight - window.innerHeight;
      const raw = Math.max(0, window.scrollY / driverH);
      targetProgress = Math.min(1, raw);
      progressBar.style.width = (Math.min(raw,1) * 100) + '%';

      // Hero fades out
      const heroOpacity = Math.max(0, 1 - raw * 4);
      heroText.style.opacity = heroOpacity;
      heroText.style.transform = `translate(-50%, calc(-50% - ${raw * 60}px))`;
      scrollHint.style.opacity = heroOpacity;

      // Panels
      if (raw > 0.15 && raw < 0.55) document.getElementById('panel-1').classList.add('visible');
      else document.getElementById('panel-1').classList.remove('visible');
      if (raw > 0.35 && raw < 0.65) document.getElementById('panel-2').classList.add('visible');
      else document.getElementById('panel-2').classList.remove('visible');
      if (raw > 0.55 && raw < 0.72) document.getElementById('panel-3').classList.add('visible');
      else document.getElementById('panel-3').classList.remove('visible');

      // Bloom expand in last 28%
      const bp = Math.max(0, Math.min(1, (raw - 0.72) / 0.28));
      const eased = bp < 0.5 ? 2*bp*bp : 1 - Math.pow(-2*bp+2,2)/2;
      bloomOverlay.style.clipPath = `circle(${(eased*150).toFixed(2)}% at 50% 50%)`;
      if (dotCanvas) dotCanvas.classList.toggle('visible', bp > 0.3);
      const show = bp > 0.92;
      if (page2) { page2.classList.toggle('revealed', show); if (show) riseCards(); }
      if (act3El) act3El.classList.toggle('revealed', show);
    }, { passive: true });

    // ── GSAP: NAV hide/show on scroll direction ──
    (function() {
      const navEl = document.querySelector('nav');
      let lastY = 0, ticking = false;
      window.addEventListener('scroll', () => {
        if (!ticking) {
          requestAnimationFrame(() => {
            const y = window.scrollY;
            if (y > 80) navEl.classList.toggle('nav-hidden', y > lastY);
            else navEl.classList.remove('nav-hidden');
            lastY = y; ticking = false;
          });
          ticking = true;
        }
      }, { passive: true });
    })();

    const clock = new THREE.Clock();

    let smoothTiltX = 0, smoothTiltY = 0;
    let dragRotationY = 0, dragRotationX = 0;

    function animate() {
      requestAnimationFrame(animate);
      if (window.__heroVisible === false) return;

      const t = clock.getElapsedTime();

      // Smooth scroll progress
      scrollProgress += (targetProgress - scrollProgress) * 0.06;

      // BASE auto-rotation
      globe.rotation.y += 0.0018;

      // SCROLL-DRIVEN rotation + manual drag offset
      globe.rotation.x = scrollProgress * Math.PI * 0.4 - 0.25 + dragRotationX;
      globe.rotation.y += dragRotationY * 0.02; 
      dragRotationY *= 0.95; 

      arcGroup.rotation.y = globe.rotation.y;
      arcGroup.rotation.x = globe.rotation.x;
      dotGroup.rotation.y = arcGroup.rotation.y;
      dotGroup.rotation.x = globe.rotation.x;

      // Animate package dots
      dots.forEach(d => {
        const ud = d.userData;
        ud.t = (ud.t + ud.speed * 0.003) % 1;
        const pos = ud.curve.getPoint(ud.t);
        d.position.copy(pos);
        const fade = Math.min(ud.t * 8, 1) * Math.min((1 - ud.t) * 8, 1);
        d.material.opacity = fade * 0.85;
      });

      // Camera pulls back as we scroll, then zooms in at end
      const camZ = 3.2 + scrollProgress * 1.2 - Math.pow(scrollProgress, 3) * 1.8;
      camera.position.z += (camZ - camera.position.z) * 0.05;

      // Smooth the raw gyroscope input so it doesn't feel jittery
      smoothTiltX += ((window.heroTiltX || 0) - smoothTiltX) * 0.05;
      smoothTiltY += ((window.heroTiltY || 0) - smoothTiltY) * 0.05;

      // Camera slight Y drift + tilt parallax
      camera.position.y = Math.sin(t * 0.15) * 0.08 - scrollProgress * 0.3 + smoothTiltY * 0.6;
      camera.position.x = smoothTiltX * 0.6;
      camera.lookAt(0, 0, 0);

      // Atmosphere glow pulse
      atmoMat.uniforms.viewVector.value.copy(camera.position);
      atmosphere.material.uniforms.glowColor.value.setHSL(
        0.12 + Math.sin(t * 0.3) * 0.03, 0.85, 0.55
      );

      // Arc opacity based on scroll
      arcGroup.children.forEach((arc, i) => {
        arc.material.opacity = 0.25 + scrollProgress * 0.5 + Math.sin(t * 0.8 + i * 0.9) * 0.1;
      });

      renderer.render(scene, camera);
    }

    animate();

    // Darg to rotate globe ──
    (function() {
      let isDragging = false;
      let lastX = 0, lastY = 0;

      canvas.addEventListener('pointerdown', (e) => {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        canvas.style.cursor = 'grabbing';
      });

      window.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;

        dragRotationY += dx * 0.005;
        dragRotationX += dy * 0.005;
        dragRotationX = Math.max(-1, Math.min(1, dragRotationX));
      });

      window.addEventListener('pointerup', () => {
        isDragging = false;
        canvas.style.cursor = 'grab';
      });

      canvas.style.cursor = 'grab';
    })();


    // ── MAGNETIC ADMIN BUTTON ──
    (function() {
      const wrap = document.getElementById('adminWrap');
      const btn  = document.getElementById('adminBtn');
      if (!wrap || !btn) return;
      wrap.addEventListener('mousemove', e => {
        const r = btn.getBoundingClientRect();
        btn.style.transform = `translate(${(e.clientX-(r.left+r.width/2))*0.38}px,${(e.clientY-(r.top+r.height/2))*0.38}px)`;
      });
      wrap.addEventListener('mouseleave', () => {
        btn.style.transition = 'transform 0.45s cubic-bezier(0.23,1,0.32,1)';
        btn.style.transform = 'translate(0,0)';
        setTimeout(() => btn.style.transition = '', 450);
      });
    })();

    // ── MAGNETIC TRACK SHIPMENT BUTTON ──
    (function() {
      const wrap = document.getElementById('trackBtnWrap');
      const btn  = document.getElementById('trackBtn');
      if (!wrap || !btn) return;
      wrap.addEventListener('mousemove', e => {
        const r = btn.getBoundingClientRect();
        btn.style.transform = `translate(${(e.clientX-(r.left+r.width/2))*0.38}px,${(e.clientY-(r.top+r.height/2))*0.38}px)`;
      });
      wrap.addEventListener('mouseleave', () => {
        btn.style.transition = 'transform 0.45s cubic-bezier(0.23,1,0.32,1)';
        btn.style.transform = 'translate(0,0)';
        setTimeout(() => btn.style.transition = '', 450);
      });
    })();

    // ── NAV SCROLL LINKS (Services / About) ──
    (function() {
      document.querySelectorAll('a[data-scroll-target]').forEach(link => {
        link.addEventListener('click', e => {
          e.preventDefault();
          const targetId = link.getAttribute('data-scroll-target');

          if (targetId === 'last-section') {
            // last-section is revealed via act3's scroll-driven clip-path,
            // so jump to the very end of act3's scroll range to fully reveal it
            const act3El = document.getElementById('act3');
            if (act3El) {
              const top = act3El.offsetTop + act3El.offsetHeight - window.innerHeight;
              window.scrollTo({ top, behavior: 'smooth' });
            }
            return;
          }

          const target = document.getElementById(targetId);
          if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
      });
    })();

    // ── NAV STAYS VISIBLE ONCE LAST-SECTION IS FULLY REVEALED ──
    (function() {
      const navEl = document.querySelector('nav');
      window.addEventListener('scroll', () => {
        const lastSec = document.getElementById('last-section');
        if (lastSec && lastSec.classList.contains('ls-live')) {
          // check if circle has essentially finished expanding (visually full)
          const cp = lastSec.style.clipPath || '';
          const match = cp.match(/circle\(([\d.]+)%/);
          const radius = match ? parseFloat(match[1]) : 0;
          if (radius > 140) {
            navEl.classList.remove('nav-hidden');
            navEl.classList.add('nav-force-visible');
          } else {
            navEl.classList.remove('nav-force-visible');
          }
        } else {
          navEl.classList.remove('nav-force-visible');
        }
      }, { passive: true });
    })();

    // ── MODAL SYSTEM ──
    (function() {
      function openModal(id) {
        const m = document.getElementById(id);
        if (m) m.classList.add('open');
      }
      function closeModal(id) {
        const m = document.getElementById(id);
        if (m) m.classList.remove('open');
      }

      // Business Enquiry
      const bizBtn     = document.getElementById('bizEnquiryBtn');
      const railBizBtn = document.getElementById('railBizBtn');
      const bizModal   = document.getElementById('bizModal');
      const openBiz    = () => openModal('bizModal');
      if (bizBtn) bizBtn.addEventListener('click', openBiz);
      if (railBizBtn) railBizBtn.addEventListener('click', openBiz);
      const bizClose = document.getElementById('bizModalClose');
      if (bizClose) bizClose.addEventListener('click', () => closeModal('bizModal'));
      if (bizModal) bizModal.addEventListener('click', e => { if (e.target === bizModal) closeModal('bizModal'); });

      // Business number/email these enquiries go to
      const BIZ_EMAILS = ['slexpressbng@gmail.com', 'slexpress15@gmail.com'];

      const stepChoice  = document.getElementById('bizStepChoice');
      const stepShip    = document.getElementById('bizStepShip');
      const stepPartner = document.getElementById('bizStepPartner');

      function showBizStep(step) {
        [stepChoice, stepShip, stepPartner].forEach(s => { if (s) s.style.display = 'none'; });
        if (step) step.style.display = 'block';
      }

      // Reset to chooser every time the modal is (re)opened
      if (bizBtn) bizBtn.addEventListener('click', () => showBizStep(stepChoice));
      if (railBizBtn) railBizBtn.addEventListener('click', () => showBizStep(stepChoice));

      const shipCard    = document.getElementById('shipParcelCard');
      const partnerCard = document.getElementById('partnerCard');
      if (shipCard)    shipCard.addEventListener('click', () => showBizStep(stepShip));
      if (partnerCard) partnerCard.addEventListener('click', () => showBizStep(stepPartner));

      const shipBackBtn    = document.getElementById('shipBackBtn');
      const partnerBackBtn = document.getElementById('partnerBackBtn');
      if (shipBackBtn)    shipBackBtn.addEventListener('click', () => showBizStep(stepChoice));
      if (partnerBackBtn) partnerBackBtn.addEventListener('click', () => showBizStep(stepChoice));

      const ENQUIRY_ENDPOINT = 'https://xijrmwwhhawrwvzjfzml.supabase.co/functions/v1/send-enquiry';

      async function sendEnquiry(type, fields, submitBtn) {
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;

        try {
          const res = await fetch(ENQUIRY_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, fields }),
          });
          const data = await res.json();

          if (res.ok && data.success) {
            submitBtn.textContent = 'Sent ✓';
          } else {
            alert('Something went wrong sending your enquiry. Please try again or contact us directly.');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
          }
        } catch (err) {
          alert('Something went wrong sending your enquiry. Please check your connection and try again.');
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }
      }

      // Custom branch dropdowns (used instead of native <select> for consistent styling on mobile)
      document.querySelectorAll('.pill-select').forEach(wrap => {
        const btn  = wrap.querySelector('.pill-select-btn');
        const list = wrap.querySelector('.pill-select-list');
        btn.addEventListener('click', e => {
          e.stopPropagation();
          document.querySelectorAll('.pill-select.open').forEach(w => { if (w !== wrap) w.classList.remove('open'); });
          wrap.classList.toggle('open');
        });
        list.querySelectorAll('.pill-select-option').forEach(opt => {
          opt.addEventListener('click', () => {
            wrap.dataset.value = opt.dataset.value;
            btn.textContent = opt.textContent;
            btn.classList.add('has-value');
            list.querySelectorAll('.pill-select-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            wrap.classList.remove('open');
          });
        });
      });
      document.addEventListener('click', () => {
        document.querySelectorAll('.pill-select.open').forEach(w => w.classList.remove('open'));
      });

      const shipSubmitBtn = document.getElementById('shipSubmitBtn');
      if (shipSubmitBtn) shipSubmitBtn.addEventListener('click', () => {
        const name     = document.getElementById('shipName').value.trim();
        const phone    = document.getElementById('shipPhone').value.trim();
        const email    = document.getElementById('shipEmail').value.trim();
        const pickup   = document.getElementById('shipPickup').value.trim();
        const delivery = document.getElementById('shipDelivery').value.trim();
        const weight   = document.getElementById('shipWeight').value.trim();
        const count    = document.getElementById('shipCount').value.trim();
        const goods    = document.getElementById('shipGoods').value.trim();
        const date     = document.getElementById('shipDate').value.trim();
        const branch   = document.getElementById('shipBranchSelect').dataset.value;
        if (!name || !phone) { alert('Please fill in your name and phone number.'); return; }
        sendEnquiry('ship', {
          Name: name,
          Phone: phone,
          Email: email,
          'Pickup Address': pickup,
          'Delivery Address': delivery,
          'Approx Weight': weight,
          'Number of Parcels': count,
          'Nature of Goods': goods,
          'Preferred Pickup Date': date,
          'Preferred Branch': branch
        }, shipSubmitBtn);
      });

      const partnerSubmitBtn = document.getElementById('partnerSubmitBtn');
      if (partnerSubmitBtn) partnerSubmitBtn.addEventListener('click', () => {
        const name    = document.getElementById('partnerName').value.trim();
        const company = document.getElementById('partnerCompany').value.trim();
        const phone   = document.getElementById('partnerPhone').value.trim();
        const email   = document.getElementById('partnerEmail').value.trim();
        const branch  = document.getElementById('partnerBranchSelect').dataset.value;
        const message = document.getElementById('partnerMessage').value.trim();
        if (!name || !phone) { alert('Please fill in your name and phone number.'); return; }
        sendEnquiry('Partner Enquiry — S.L. Express', [
          'New Partner with Us enquiry from the website:',
          `Name: ${name}`,
          company ? `Company: ${company}` : '',
          `Phone: ${phone}`,
          email   ? `Email: ${email}` : '',
          branch  ? `Preferred branch: ${branch}` : '',
          message ? `Looking for: ${message}` : ''
        ]);
      });

      // Track Shipment
      const trackModal = document.getElementById('trackModal');
      const openTrack = () => openModal('trackModal');
      const trackBtn      = document.getElementById('trackBtn');
      const navTrackLink  = document.getElementById('navTrackLink');
      if (trackBtn) trackBtn.addEventListener('click', openTrack);
      if (navTrackLink) navTrackLink.addEventListener('click', e => { e.preventDefault(); openTrack(); });
      const trackClose = document.getElementById('trackModalClose');
      if (trackClose) trackClose.addEventListener('click', () => closeModal('trackModal'));
      if (trackModal) trackModal.addEventListener('click', e => { if (e.target === trackModal) closeModal('trackModal'); });

      const trackSubmit = document.getElementById('trackSubmitBtn');
      const trackResult = document.getElementById('trackResult');
      const awbInput     = document.getElementById('awbInput');
      if (trackSubmit) trackSubmit.addEventListener('click', () => {
        const val = (awbInput && awbInput.value || '').trim();
        if (!val) {
          trackResult.textContent = 'Please enter an AWB or tracking number.';
          trackResult.classList.add('show');
          return;
        }
        trackResult.textContent = `Tracking lookup for "${val}" — connect this to the live tracking API to show real status.`;
        trackResult.classList.add('show');
      });

      // Close any open modal on Escape
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeModal('bizModal'); closeModal('trackModal'); }
      });
    })();

    // ── ADMIN BUTTON → login modal ──
    (function() {
      function openModal(id) {
        const m = document.getElementById(id);
        if (m) m.classList.add('open');
      }
      function closeModal(id) {
        const m = document.getElementById(id);
        if (m) m.classList.remove('open');
      }

      const adminBtn   = document.getElementById('adminBtn');
      const adminModal = document.getElementById('login-modal');
      if (adminBtn) adminBtn.addEventListener('click', showAdminLogin);
      const railLoginBtn = document.getElementById('railLoginBtn');
      if (railLoginBtn) railLoginBtn.addEventListener('click', showAdminLogin);

      const adminClose = document.getElementById('adminModalClose');
      if (adminClose) adminClose.addEventListener('click', () => closeModal('adminModal'));
      if (adminModal) adminModal.addEventListener('click', e => { if (e.target === adminModal) closeModal('adminModal'); });

      const adminSubmit = document.getElementById('adminSubmitBtn');
      const adminResult = document.getElementById('adminResult');
      const userInput    = document.getElementById('adminUserInput');
      const passInput    = document.getElementById('adminPassInput');
      if (adminSubmit) adminSubmit.addEventListener('click', () => {
        const user = (userInput && userInput.value || '').trim();
        const pass = (passInput && passInput.value || '').trim();
        if (!user || !pass) {
          adminResult.textContent = 'Please enter both username and password.';
          adminResult.classList.add('show');
          return;
        }
        // Placeholder — wire this to real auth, then redirect to index.html on success
        window.location.href = 'index.html';
      });

      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeModal('adminModal');
      });
    })();

    // ── DOTFIELD ──
    function initDotField(canvasId) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const TWO_PI = Math.PI * 2;
      const SP = 20, RAD = 1.6, BLG = 70;
      let dots=[], w=0, h=0, eng=0, glowOp=0;
      let mx=-9999, my=-9999, px=-9999, py=-9999, spd=0;
      const dpr = Math.min(window.devicePixelRatio||1,2);

      function resize() {
        w = window.innerWidth; h = window.innerHeight;
        canvas.width = w*dpr; canvas.height = h*dpr;
        canvas.style.width=w+'px'; canvas.style.height=h+'px';
        ctx.setTransform(dpr,0,0,dpr,0,0);
        dots=[];
        const step=SP+RAD;
        const cols=Math.floor(w/step), rows=Math.floor(h/step);
        const padX=(w%step)/2, padY=(h%step)/2;
        for(let r=0;r<rows;r++) for(let co=0;co<cols;co++) {
          const ax=padX+co*step+step/2, ay=padY+r*step+step/2;
          dots.push({ax,ay,sx:ax,sy:ay});
        }
      }

      window.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;},{passive:true});
      setInterval(()=>{
        const d=Math.hypot(px-mx,py-my);
        spd+=(d-spd)*0.5; if(spd<0.001)spd=0;
        px=mx;py=my;
      },20);

      function tick() {
        requestAnimationFrame(tick);
        // only run when canvas's parent (or itself) is marked visible/active
        const parentActive = canvas.parentElement && canvas.parentElement.classList.contains('active');
        const selfVisible   = canvas.classList.contains('visible');
        if (!parentActive && !selfVisible) return;
        const tgt=Math.min(spd/5,1);
        eng+=(tgt-eng)*0.06; if(eng<0.001)eng=0;
        glowOp+=(eng-glowOp)*0.08;
        ctx.clearRect(0,0,w,h);
        const grad=ctx.createLinearGradient(0,0,w,h);
        grad.addColorStop(0,'rgba(200,140,0,0.85)');
        grad.addColorStop(1,'rgba(180,120,0,0.75)');
        ctx.fillStyle=grad;
        ctx.beginPath();
        for(const d of dots){
          const dx=mx-d.ax,dy=my-d.ay,dsq=dx*dx+dy*dy,cr=200;
          if(dsq<cr*cr&&eng>0.01){
            const dist=Math.sqrt(dsq),t=1-dist/cr;
            const push=t*t*BLG*eng,ang=Math.atan2(dy,dx);
            d.sx+=(d.ax-Math.cos(ang)*push-d.sx)*0.15;
            d.sy+=(d.ay-Math.sin(ang)*push-d.sy)*0.15;
          } else {
            d.sx+=(d.ax-d.sx)*0.1;
            d.sy+=(d.ay-d.sy)*0.1;
          }
          ctx.moveTo(d.sx+RAD/2,d.sy);
          ctx.arc(d.sx,d.sy,RAD/2,0,TWO_PI);
        }
        ctx.fill();
      }
      resize();
      window.addEventListener('resize',resize,{passive:true});
      requestAnimationFrame(tick);
    }
    initDotField('dot-field-canvas');

    // ── CLICKSPARK ──
    (function() {
      const canvas = document.getElementById('spark-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const sparks=[], DUR=480, COUNT=8, SZ=10, SR=18;
      const TWO_PI=Math.PI*2;
      function resize(){canvas.width=window.innerWidth;canvas.height=window.innerHeight;}
      resize();
      window.addEventListener('resize',resize,{passive:true});
      function draw(ts){
        requestAnimationFrame(draw);
        ctx.clearRect(0,0,canvas.width,canvas.height);
        for(let i=sparks.length-1;i>=0;i--){
          const s=sparks[i],el=ts-s.t;
          if(el>=DUR){sparks.splice(i,1);continue;}
          const p=el/DUR,ep=p*(2-p);
          ctx.strokeStyle='#EAB308';
          ctx.lineWidth=2;
          ctx.globalAlpha=1-p;
          ctx.beginPath();
          const x1=s.x+ep*SR*Math.cos(s.a),y1=s.y+ep*SR*Math.sin(s.a);
          const x2=s.x+(ep*SR+SZ*(1-p))*Math.cos(s.a),y2=s.y+(ep*SR+SZ*(1-p))*Math.sin(s.a);
          ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
        }
        ctx.globalAlpha=1;
      }
      requestAnimationFrame(draw);
      document.addEventListener('click',e=>{
        if(e.target.closest('#adminWrap')) return;
        const now=performance.now();
        for(let i=0;i<COUNT;i++) sparks.push({x:e.clientX,y:e.clientY,a:TWO_PI*i/COUNT,t:now});
      });
    })();

  }
})();

  // ── KEEP SCROLLING REMINDER (GSAP) ──
  (function() {
    const el = document.getElementById('keep-scrolling');
    if (!el) return;
    let idleTimer = null;
    let visible = false;

    function show() {
      if (visible) return;
      visible = true;
      gsap.to(el, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' });
      el.classList.add('show');
    }
    function hide() {
      if (!visible) return;
      visible = false;
      gsap.to(el, { opacity: 0, y: 20, duration: 0.4, ease: 'power2.in' });
      el.classList.remove('show');
    }

    function resetTimer() {
      clearTimeout(idleTimer);
      hide();
      const driver = document.getElementById('scroll-driver');
      if (!driver) return;
      const driverH = driver.clientHeight - window.innerHeight;
      const raw = window.scrollY / driverH;
      if (raw > 0.05 && raw < 0.70) {
        idleTimer = setTimeout(show, 3000);
      }
    }

    window.addEventListener('scroll', resetTimer, { passive: true });
    setTimeout(resetTimer, 4000);
  })();

  // ── ACT 3 SHOWCASE → LAST-SECTION'S OWN CIRCLE EXPANDS (mirrors page2's bloom) ──
  (function() {
    const section   = document.getElementById('act3');
    const frame     = section ? section.querySelector('.a3-frame') : null;
    const panels    = document.querySelectorAll('.a3-panel');
    const tabs      = document.querySelectorAll('.a3-tab');
    const thumb     = document.getElementById('a3-thumb');
    const lastSec   = document.getElementById('last-section');
    const total     = panels.length;
    let current     = -1;
    let lastRadius  = -1;
    let lastAct3Op  = -1;

    function easeInOutCubic(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }

    function setActive(idx) {
      if (idx === current) return;
      current = idx;
      panels.forEach((p, i) => p.classList.toggle('active', i === idx));
      tabs.forEach((t, i)   => t.classList.toggle('active', i === idx));
      if (thumb) {
        gsap.to(thumb, { height: (100/total)+'%', top: (idx*100/total)+'%', duration: 0.4, ease: 'power2.out' });
      }
    }

    function onScroll() {
      if (!section) return;
      const rect      = section.getBoundingClientRect();
      const scrolled  = -rect.top;
      const maxScroll = section.offsetHeight - window.innerHeight;
      if (maxScroll <= 0) return;
      const p = Math.max(0, Math.min(1, scrolled / maxScroll));

      // ─── PHASE 1 (0–60%): card entry + panel cycling ───────────────
      const entryP = Math.min(1, p / 0.05);
      const entryE = easeInOutCubic(entryP);

      if (p < 0.60) {
        const cardH = 70 + entryE * 20;
        const cardR = 28 - entryE * 8;
        if (frame) {
          frame.style.height       = cardH + 'vh';
          frame.style.borderRadius = cardR + 'px';
          frame.style.maxWidth     = '1300px';
        }
      }

      const panelP = Math.max(0, Math.min(1, (p - 0.05) / 0.55));
      const idx    = Math.min(total - 1, Math.floor(panelP * total));
      if (p < 0.60) setActive(idx);

      // ─── PHASE 2 (60–100%): last-section's own circle expands outward — content travels with it ──
      const bloomP    = Math.max(0, Math.min(1, (p - 0.60) / 0.40));
      const bloomEase = bloomP < 0.5 ? 2*bloomP*bloomP : 1 - Math.pow(-2*bloomP+2,2)/2;
      const radius    = bloomEase * 150; // 0% → 150%, identical curve to #bloom-overlay

      if (lastSec && Math.abs(radius - lastRadius) > 0.05) {
        lastRadius = radius;
        lastSec.style.clipPath = `circle(${radius.toFixed(2)}% at 50% 50%)`;
        lastSec.classList.toggle('ls-live', bloomP > 0);
        // FloatingLines waits for the bloom to be mostly settled — starting it mid-transition
        // means it's competing for GPU time with the clip-path animation + Act3 fade in the
        // exact same frames, which is what was making the scroll feel choppy.
        lastSec.classList.toggle('ls-bloom-settled', bloomP > 0.55);
      }

      // Act3 (card, panels, and the a3-thumb rail inside it) fades out in lockstep with the
      // bloom so nothing is left sitting frozen/visible underneath once last-section covers it.
      if (section) {
        const act3Opacity = Math.max(0, 1 - bloomP * 2.8); // fully gone by ~36% into the bloom
        if (Math.abs(act3Opacity - lastAct3Op) > 0.01) {
          lastAct3Op = act3Opacity;
          section.style.opacity = String(act3Opacity);
          section.style.pointerEvents = bloomP > 0.05 ? 'none' : '';
        }
      }
    }

    let act3Ticking = false;
    window.addEventListener('scroll', () => {
      if (act3Ticking) return;
      act3Ticking = true;
      requestAnimationFrame(() => { onScroll(); act3Ticking = false; });
    }, { passive: true });
    onScroll();
  })();

  // ── LAST SECTION: FLOATING LINES BACKGROUND (vanilla port of React Bits FloatingLines) ──
  // Called from the three.js script.onload handler above — THREE loads async, so this
  // can't just run inline as an IIFE at parse time, window.THREE won't exist yet.
  function initFloatingLinesBG() {
    const section = document.getElementById('last-section');
    const canvas  = document.getElementById('ls-floatinglines-canvas');
    if (!section || !canvas || !window.THREE) return;

    const vertexShader = `
precision highp float;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

    const fragmentShader = `
precision highp float;

uniform float iTime;
uniform vec3  iResolution;
uniform float animationSpeed;

uniform bool enableTop;
uniform bool enableMiddle;
uniform bool enableBottom;

uniform int topLineCount;
uniform int middleLineCount;
uniform int bottomLineCount;

uniform float topLineDistance;
uniform float middleLineDistance;
uniform float bottomLineDistance;

uniform vec3 topWavePosition;
uniform vec3 middleWavePosition;
uniform vec3 bottomWavePosition;

uniform vec2 iMouse;
uniform bool interactive;
uniform float bendRadius;
uniform float bendStrength;
uniform float bendInfluence;

uniform bool parallax;
uniform float parallaxStrength;
uniform vec2 parallaxOffset;

uniform vec3 gradientStart;
uniform vec3 gradientMid;
uniform vec3 gradientEnd;

const vec3 BLACK = vec3(0.0);

mat2 rotate(float r) {
  return mat2(cos(r), sin(r), -sin(r), cos(r));
}

vec3 getLineColor(float t) {
  vec3 gradientColor;
  float ct = clamp(t, 0.0, 1.0);
  if (ct < 0.5) {
    gradientColor = mix(gradientStart, gradientMid, ct * 2.0);
  } else {
    gradientColor = mix(gradientMid, gradientEnd, (ct - 0.5) * 2.0);
  }
  return gradientColor * 0.5;
}

float wave(vec2 uv, float offset, vec2 screenUv, vec2 mouseUv, bool shouldBend) {
  float time = iTime * animationSpeed;
  float x_offset   = offset;
  float x_movement = time * 0.1;
  float amp        = sin(offset + time * 0.2) * 0.3;
  float y          = sin(uv.x + x_offset + x_movement) * amp;

  if (shouldBend) {
    vec2 d = screenUv - mouseUv;
    float influence = exp(-dot(d, d) * bendRadius);
    float bendOffset = (mouseUv.y - screenUv.y) * influence * bendStrength * bendInfluence;
    y += bendOffset;
  }

  float m = uv.y - y;
  return 0.0175 / max(abs(m) + 0.01, 1e-3) + 0.01;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 baseUv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
  baseUv.y *= -1.0;

  if (parallax) {
    baseUv += parallaxOffset;
  }

  vec3 col = vec3(0.0);

  vec2 mouseUv = vec2(0.0);
  if (interactive) {
    mouseUv = (2.0 * iMouse - iResolution.xy) / iResolution.y;
    mouseUv.y *= -1.0;
  }

  if (enableBottom) {
    for (int i = 0; i < 40; ++i) {
      if (i >= bottomLineCount) break;
      float fi = float(i);
      float t = fi / max(float(bottomLineCount - 1), 1.0);
      vec3 lineCol = getLineColor(t);
      float angle = bottomWavePosition.z * log(length(baseUv) + 1.0);
      vec2 ruv = baseUv * rotate(angle);
      col += lineCol * wave(
        ruv + vec2(bottomLineDistance * fi + bottomWavePosition.x, bottomWavePosition.y),
        1.5 + 0.2 * fi, baseUv, mouseUv, interactive
      ) * 0.2;
    }
  }

  if (enableMiddle) {
    for (int i = 0; i < 40; ++i) {
      if (i >= middleLineCount) break;
      float fi = float(i);
      float t = fi / max(float(middleLineCount - 1), 1.0);
      vec3 lineCol = getLineColor(t);
      float angle = middleWavePosition.z * log(length(baseUv) + 1.0);
      vec2 ruv = baseUv * rotate(angle);
      col += lineCol * wave(
        ruv + vec2(middleLineDistance * fi + middleWavePosition.x, middleWavePosition.y),
        2.0 + 0.15 * fi, baseUv, mouseUv, interactive
      );
    }
  }

  if (enableTop) {
    for (int i = 0; i < 40; ++i) {
      if (i >= topLineCount) break;
      float fi = float(i);
      float t = fi / max(float(topLineCount - 1), 1.0);
      vec3 lineCol = getLineColor(t);
      float angle = topWavePosition.z * log(length(baseUv) + 1.0);
      vec2 ruv = baseUv * rotate(angle);
      ruv.x *= -1.0;
      col += lineCol * wave(
        ruv + vec2(topLineDistance * fi + topWavePosition.x, topWavePosition.y),
        1.0 + 0.2 * fi, baseUv, mouseUv, interactive
      ) * 0.1;
    }
  }

  fragColor = vec4(col, 1.0);
}

void main() {
  vec4 color = vec4(0.0);
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor = color;
}
`;

    function hexToVec3(hex) {
      let v = hex.trim().replace('#', '');
      if (v.length === 3) v = v.split('').map(c => c + c).join('');
      const num = parseInt(v, 16);
      return new THREE.Vector3(((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255);
    }

    // ─ config — demo colours kept as-is per your call ─
    const lineCount      = [8, 10, 14];        // top, middle, bottom
    const lineDistance   = [7, 5.5, 4];
    const gradientStart  = '#ffcd34';
    const gradientMid    = '#a8a08f';
    const gradientEnd    = '#919191';
    const animationSpeed = 0.55;
    const interactive    = true;
    const bendRadius     = 5.0;
    const bendStrength   = -1.0;
    const mouseDamping   = 0.06;
    const parallax       = true;
    const parallaxStrength = 0.12;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene  = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    camera.position.z = 1;

    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector3(1, 1, 1) },
      animationSpeed: { value: animationSpeed },
      enableTop: { value: true },
      enableMiddle: { value: false },
      enableBottom: { value: true },
      topLineCount: { value: lineCount[0] },
      middleLineCount: { value: lineCount[1] },
      bottomLineCount: { value: lineCount[2] },
      topLineDistance: { value: lineDistance[0] * 0.01 },
      middleLineDistance: { value: lineDistance[1] * 0.01 },
      bottomLineDistance: { value: lineDistance[2] * 0.01 },
      topWavePosition: { value: new THREE.Vector3(10.0, 0.6, -0.4) },
      middleWavePosition: { value: new THREE.Vector3(5.0, 0.0, 0.2) },
      bottomWavePosition: { value: new THREE.Vector3(2.0, -0.7, 0.4) },
      iMouse: { value: new THREE.Vector2(-1000, -1000) },
      interactive: { value: interactive },
      bendRadius: { value: bendRadius },
      bendStrength: { value: bendStrength },
      bendInfluence: { value: 0 },
      parallax: { value: parallax },
      parallaxStrength: { value: parallaxStrength },
      parallaxOffset: { value: new THREE.Vector2(0, 0) },
      gradientStart: { value: hexToVec3(gradientStart) },
      gradientMid: { value: hexToVec3(gradientMid) },
      gradientEnd: { value: hexToVec3(gradientEnd) }
    };

    const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true });
    const geometry = new THREE.PlaneGeometry(2, 2);
    scene.add(new THREE.Mesh(geometry, material));

    const clock = new THREE.Clock();
    const targetMouse  = new THREE.Vector2(-1000, -1000);
    const currentMouse = new THREE.Vector2(-1000, -1000);
    let targetInfluence = 0, currentInfluence = 0;
    const targetParallax  = new THREE.Vector2(0, 0);
    const currentParallax = new THREE.Vector2(0, 0);

    function setSize() {
      const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
      renderer.setSize(w, h, false);
      uniforms.iResolution.value.set(renderer.domElement.width, renderer.domElement.height, 1);
    }
    setSize();
    window.addEventListener('resize', setSize);

    section.addEventListener('pointermove', (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      const dpr = renderer.getPixelRatio();
      targetMouse.set(x * dpr, (rect.height - y) * dpr);
      targetInfluence = 1.0;
      const cx = rect.width / 2, cy = rect.height / 2;
      targetParallax.set(
        ((x - cx) / rect.width) * parallaxStrength,
        -((y - cy) / rect.height) * parallaxStrength
      );
    });
    section.addEventListener('pointerleave', () => { targetInfluence = 0; });

    function loop() {
      requestAnimationFrame(loop);
      if (!section.classList.contains('ls-live')) return;
      uniforms.iTime.value = clock.getElapsedTime();
      currentMouse.lerp(targetMouse, mouseDamping);
      uniforms.iMouse.value.copy(currentMouse);
      currentInfluence += (targetInfluence - currentInfluence) * mouseDamping;
      uniforms.bendInfluence.value = currentInfluence;
      currentParallax.lerp(targetParallax, mouseDamping);
      uniforms.parallaxOffset.value.copy(currentParallax);
      renderer.render(scene, camera);
    }
    requestAnimationFrame(loop);
  }

  // ── GSAP HERO ENTRANCE ──
  (function() {
    if (!window.gsap) return; // hero content is visible by default in CSS either way
    const tl = gsap.timeline({ delay: 0.5 });
    tl.from('#hero-text .eyebrow', { opacity: 0, y: 16, duration: 0.7, ease: 'power3.out' })
      .from('#hero-text h1',       { opacity: 0, y: 24, duration: 0.8, ease: 'power3.out' }, '-=0.4')
      .from('#hero-text p',        { opacity: 0, y: 16, duration: 0.6, ease: 'power2.out' }, '-=0.5')
      .from('#hero-text .cta-btn', { opacity: 0, y: 12, scale: 0.95, duration: 0.5, ease: 'back.out(1.5)' }, '-=0.3')
      .from('#scroll-hint',        { opacity: 0, duration: 0.5 }, '-=0.2');
  })();

    // ============================================
    // SUPABASE SETUP
    // ============================================
    const SUPABASE_URL = 'https://xijrmwwhhawrwvzjfzml.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpanJtd3doaGF3cnd2empmem1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDcyOTEsImV4cCI6MjA5MDM4MzI5MX0.pgH11u7eJiQQK_Lzt956bfBs_sMb9LXS-ooNdGbrICU';
    const { createClient } = window.supabase;
    const db = createClient(SUPABASE_URL, SUPABASE_KEY);

    // ============================================
    // SIMPLE SECURITY CONFIG
    // ============================================
    const SECURITY_CONFIG = {
      maxLoginAttempts: 3
    };

    let securityState = {
      loginAttempts: 0,
      sessionId: null,
      currentAdmin: null,
      isSessionActive: false,
      branch: null,
      role: null,
      activeBranch: 'all'
    };

    let shipments = [];
    let activityLog = [];
    let deletedShipments = [];
    let paidHistory = {};
    let currentTrackedShipment = null;
    let chartInstances = {};
    let analyticsInterval = null;
    let clients = [];
    let currentShipmentMonth = 'all';
    let currentParentTab = 0;
    let currentSubTab = 0;

    document.addEventListener('DOMContentLoaded', () => {
      ['admin-user', 'admin-pass'].forEach(id => {
        document.getElementById(id)?.addEventListener('keydown', e => {
          if (e.key === 'Enter') loginAdmin();
        });
      });

      document.getElementById('new-rate')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') addNewShipment();
      });

      document.getElementById('new-client-name')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') addClient();
      });
    });

    // ============================================
    // IMPORTANT ACTIONS FOR ACTIVITY LOG
    // ============================================
    const IMPORTANT_ACTIONS = [
      'LOGIN', 'LOGOUT', 'CREATE_SHIPMENT', 'UPDATE_STATUS',
      'DELETE_SHIPMENT', 'UPLOAD_POD', 'FAILED_LOGIN',
      'PASSWORD_RESET_REQUESTED', 'CLEAR_LOG', 'DOWNLOAD_LOG',
      'CONFIRM_UPDATE', 'UPDATE_CUSTOM_STATUS'
    ];

  // MAIN WORKING FILE //
      function sanitizeInput(input) {
        return String(input)
          .replace(/[<>\"'`]/g, '')
          .trim()
          .substring(0, 100);
      }

      async function logActivity(action, details) {
        if (!IMPORTANT_ACTIONS.includes(action)) return;

        const timestamp = new Date().toISOString();
        const logEntry = {
          timestamp,
          admin: securityState.currentAdmin || 'Anonymous',
          action,
          details,
          session_id: securityState.sessionId,
          branch: securityState.branch || 'blr'  // AUTO-TAG branch
        };

        activityLog.push({ ...logEntry, ipAddress: 'Local' });
        await db.from('activity_logs').insert(logEntry);

        if (currentParentTab === 3) renderActivityLog();
      }

      async function renderActivityLog() {
        const tbody = document.getElementById('activity-body');
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-zinc-400 text-sm">Loading...</td></tr>';

        let query = db.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(50);

        // Branch admins only see their own logs
        if (securityState.role !== 'super_admin') {
          query = query.eq('branch', securityState.branch);
        } else if (securityState.activeBranch && securityState.activeBranch !== 'all') {
          query = query.eq('branch', securityState.activeBranch);
        }

        const { data, error } = await query;
        if (error) { tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-400">Failed to load logs</td></tr>'; return; }

        const branchBadge = b => b === 'blr'
          ? '<span class="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">BLR</span>'
          : b === 'chennai'
          ? '<span class="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">CHN</span>'
          : '<span class="text-xs bg-zinc-500/20 text-zinc-400 px-2 py-0.5 rounded-full">ALL</span>';

        tbody.innerHTML = '';
        (data || []).forEach(log => {
          tbody.innerHTML += `
            <tr class="hover:bg-zinc-800">
              <td class="p-3 text-xs">${new Date(log.timestamp).toLocaleString()}</td>
              <td class="p-3 text-xs">${sanitizeInput(log.admin)}</td>
              <td class="p-3 text-xs font-semibold text-amber-400">${log.action}</td>
              <td class="p-3 text-xs">${sanitizeInput(log.details)}</td>
              <td class="p-3 text-xs">${branchBadge(log.branch)}</td>
            </tr>
          `;
        });
      }

      function updateCalcPreview() {
        const weight = parseFloat(document.getElementById('new-weight').value);
        const rate = parseFloat(document.getElementById('new-rate').value);

        if (!weight || !rate) {
          document.getElementById('calc-desc').textContent = 'Enter weight & rate to preview bill amount';
          document.getElementById('calc-amt').textContent = '—';
          return;
        }

        const total = weight * rate;
        document.getElementById('calc-desc').textContent = `${weight} kg × ₹${rate}/kg`;
        document.getElementById('calc-amt').textContent = `₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }

      function showUndoToast(message, onUndo) {
        const existing = document.getElementById('undo-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'undo-toast';
        toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-4 bg-zinc-800 border border-white/10 px-5 py-3 rounded-2xl shadow-xl text-sm';
        toast.innerHTML = `
          <span class="text-zinc-300">${message}</span>
          <button id="undo-btn" class="text-amber-400 font-semibold hover:text-amber-300 transition-all cursor-pointer">Undo</button>
        `;
        document.body.appendChild(toast);

        const timer = setTimeout(() => toast.remove(), 6000);

        document.getElementById('undo-btn').onclick = () => {
          clearTimeout(timer);
          toast.remove();
          onUndo();
        };
      }

      async function refreshShipments() {
        const btn = document.getElementById('refresh-shipments-btn');
        btn.classList.add('animate-spin');
        const query = db.from('shipments').select('*').order('created_at', { ascending: false });
        if (securityState.role !== 'super_admin') query.eq('branch', securityState.branch);
        else if (securityState.activeBranch && securityState.activeBranch !== 'all') query.eq('branch', securityState.activeBranch);
        const { data, error } = await query;
        if (!error && data) {
          shipments = data.map(s => ({ ...s, custId: s.cust_id, pod: s.pod_url }));
          renderShipments();
          updateStatusBadges();
          populateShipmentMonthFilter();
        }
        setTimeout(() => btn.classList.remove('animate-spin'), 600);
      }

    function populateShipmentMonthFilter() {
      const select = document.getElementById('shipment-month-filter');
      if (!select) return;

      // Get unique months from shipments
      const months = [...new Set(shipments
        .filter(s => s.date)
        .map(s => s.date.substring(0, 7))
      )].sort((a, b) => b.localeCompare(a)); // newest first

      select.innerHTML = '<option value="all">All Months</option>';
      months.forEach(m => {
        const [yr, mo] = m.split('-');
        const label = new Date(yr, mo - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
        select.innerHTML += `<option value="${m}" ${currentShipmentMonth === m ? 'selected' : ''}>${label}</option>`;
      });
    }

    function onShipmentMonthChange(val) {
      currentShipmentMonth = val;
      renderShipments();
    }

  function refreshBilling() {
    const btn = document.getElementById('refresh-billing-btn');
    btn.classList.add('animate-spin');
    renderBilling();
    setTimeout(() => btn.classList.remove('animate-spin'), 600);
  }

      async function clearActivityLog() {
        if (confirm("Are you sure? This cannot be undone.")) {
          await db.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          activityLog = [];
          await logActivity('CLEAR_LOG', 'Activity log cleared');
          renderActivityLog();
        }
      }

      function renderBranchSwitcher() {
        if (document.getElementById('branch-switcher')) return;

        securityState.activeBranch = 'all';

        const switcher = document.createElement('div');
        switcher.id = 'branch-switcher';
        switcher.className = 'flex items-center gap-2 bg-zinc-900 border border-amber-500/30 rounded-2xl px-4 py-2 mb-6';
        switcher.innerHTML = `
          <i class="fas fa-code-branch text-amber-400 text-sm"></i>
          <span class="text-xs text-zinc-400 mr-2">Branch:</span>
          ${['all', 'blr', 'chennai'].map(b => `
            <button onclick="switchBranch('${b}')" id="branch-btn-${b}"
              class="branch-btn text-xs px-3 py-1 rounded-xl transition-all ${b === 'all' ? 'bg-amber-500 text-zinc-950 font-bold' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}">
              ${b === 'all' ? 'All' : b === 'blr' ? 'Bengaluru' : 'Chennai'}
            </button>
          `).join('')}
        `;

        // Insert after the real-time banner
        const banner = document.querySelector('#admin-panel .mb-6');
        banner.parentNode.insertBefore(switcher, banner.nextSibling);
      }

      async function switchBranch(branch) {
        securityState.activeBranch = branch;

        // Update button styles
        ['all', 'blr', 'chennai'].forEach(b => {
          const btn = document.getElementById(`branch-btn-${b}`);
          btn.className = `branch-btn text-xs px-3 py-1 rounded-xl transition-all ${b === branch ? 'bg-amber-500 text-zinc-950 font-bold' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`;
        });

        // Re-fetch shipments for selected branch
        let query = db.from('shipments').select('*').order('created_at', { ascending: false });
        if (branch !== 'all') query = query.eq('branch', branch);
        const { data, error } = await query;
        if (!error && data) {
          shipments = data.map(s => ({ ...s, custId: s.cust_id, pod: s.pod_url }));
          updateStatusBadges();
          switchSubTab(0);
        }

        // Re-render logs if on that tab
        if (currentParentTab === 3) renderActivityLog();
      }
      async function downloadActivityLog() {
        const { data } = await db.from('activity_logs').select('*').order('timestamp', { ascending: false });
        let csv = 'Timestamp,Admin,Action,Details\n';
        (data || []).forEach(log => {
          csv += `"${log.timestamp}","${log.admin}","${log.action}","${log.details}"\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        
        logActivity('DOWNLOAD_LOG', 'Activity log downloaded');
      }

      // ============================================
      // SESSION MANAGEMENT (SIMPLIFIED)
      // ============================================
      
      function startSession(adminName) {
        securityState.currentAdmin = adminName;
        securityState.isSessionActive = true;
        securityState.sessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        
        logActivity('LOGIN', `Admin logged in`);
      }

      // ============================================
      // CORE FUNCTIONS
      // ============================================
      
      function saveData() {
        updateAnalytics();
        updateStatusBadges();
      }

      // NEW FUNCTION: Update Status Badge Counters
      function updateStatusBadges() {
        const delivered = shipments.filter(s => s.status === "Delivered").length;
        const inTransit = shipments.filter(s => s.status === "In Transit").length;
        const pending = shipments.filter(s => s.status !== "Delivered" && s.status !== "In Transit").length;

        document.getElementById('badge-delivered-count').textContent = delivered;
        document.getElementById('badge-intransit-count').textContent = inTransit;
        document.getElementById('badge-pending-count').textContent = pending;
      }

      function switchParentTab(n) {
        if (!securityState.isSessionActive) {
          alert('Session expired. Please log in again.');
          return;
        }
        
        currentParentTab = n;
        document.querySelectorAll('.parent-tab').forEach((btn, i) => {
          if (i === n) btn.classList.add('active');
          else btn.classList.remove('active');
          restyleTabPills();
          updateParentUnderline();
        });
        
        for (let i = 0; i < 6; i++) {
          const content = document.getElementById(`parent-content-${i}`);
          if (content) content.classList.toggle('hidden', i !== n);
        }
        
        if (n === 2) {
          setTimeout(() => updateAnalytics(), 100);
        }
        if (n === 3) {
          renderActivityLog();
        }
        if (n === 4) {
          renderBilling();
        }
        if (n === 5) {
        renderStatistics();
        }
        setTimeout(injectRippleButtons, 150);
      }

      function switchSubTab(n) {
        currentSubTab = n;
        document.getElementById('search-input').value = '';
        
        document.querySelectorAll('.sub-tab').forEach((btn, i) => {
          if (i === n) btn.classList.add('active',);
          else btn.classList.remove('active');
          restyleTabPills();
          updateSubUnderline();
        });
        renderShipments();
        setTimeout(injectRippleButtons, 150);
      }

      function renderShipments() {
        if (currentParentTab !== 0) return;
        const search = sanitizeInput(document.getElementById('search-input').value).toUpperCase();
        if (search) {
          const match = shipments.find(s => s.tracking.toUpperCase().includes(search));
          if (match) {
            const matchTab = !match.pod ? 0 : (match.status !== 'Delivered' ? 1 : 2);
            if (matchTab !== currentSubTab) {
              currentSubTab = matchTab;
              document.querySelectorAll('.sub-tab').forEach((btn, i) => {
                btn.classList.toggle('active', i === matchTab);
              });
              restyleTabPills();
              updateSubUnderline();
            }
          }
        }
        const tbody = document.getElementById('shipments-body');
        tbody.innerHTML = '';

        const filtered = shipments.filter(s => {
          if (search && !s.tracking.toUpperCase().includes(search)) return false;
          if (currentShipmentMonth !== 'all' && (!s.date || !s.date.startsWith(currentShipmentMonth))) return false;
          if (currentSubTab === 0) return !s.pod;
          if (currentSubTab === 1) return s.pod && s.status !== "Delivered";
          if (currentSubTab === 2) return s.pod && s.status === "Delivered";
          return true;
        });

        filtered.forEach((s) => {
          const idx = shipments.findIndex(item => item.tracking === s.tracking);
          const podDisplay = s.pod 
            ? `<button onclick="showPodModal(${idx})" class="text-emerald-400 hover:text-emerald-300 font-semibold transition-all cursor-pointer">📷 View POD</button>` 
            : `<span class="text-red-400 font-semibold">No POD</span>`;

          const branchTint = securityState.role !== 'super_admin' ? ''
          : s.branch === 'blr' ? 'background: rgba(59,130,246,0.08);'
          : s.branch === 'chennai' ? 'background: rgba(168,85,247,0.08);'
          : '';

        tbody.innerHTML += `
          <tr class="hover:bg-zinc-800 smooth-transition" style="${branchTint}">
              <td class="p-3 md:p-5 font-mono text-xs md:text-sm">${sanitizeInput(s.tracking)}</td>
              <td class="p-3 md:p-5 hidden sm:table-cell text-xs md:text-sm">${sanitizeInput(s.customer)}</td>
              <td class="p-3 md:p-5 hidden md:table-cell text-xs md:text-sm">${sanitizeInput(s.origin)} → ${sanitizeInput(s.destination)}</td>
              <td class="p-3 md:p-5 text-xs md:text-sm">
                <span class="px-3 py-1 rounded-xl text-xs font-semibold"
                  style="${
                    s.status === 'Delivered'        ? 'background:rgba(44,95,74,0.2);color:#6BA889;border:1px solid #2C5F4A' :
                    s.status === 'In Transit'       ? 'background:rgba(42,63,111,0.2);color:#7A9CC4;border:1px solid #2A3F6F' :
                    s.status === 'Out for Delivery' ? 'background:rgba(30,50,80,0.2);color:#7EB8D4;border:1px solid #1E4060' :
                    s.status === 'Pending'          ? 'background:rgba(92,74,30,0.2);color:#9C8A5C;border:1px solid #5C4A1E' :
                    s.status === 'Returned'         ? 'background:rgba(107,30,30,0.2);color:#B07070;border:1px solid #6B1E1E' :
                                                      'background:rgba(60,48,32,0.2);color:#7C6A50;border:1px solid #3D3020'
                  }">
                  ${s.status}
                </span>
              </td>
              <td class="p-3 md:p-5 hidden lg:table-cell text-xs md:text-sm">${s.date || 'N/A'}</td>
              <td class="p-3 md:p-5 text-xs md:text-sm text-zinc-400">${sanitizeInput(s.location) || 'N/A'}</td>
              <td class="p-3 md:p-5 text-xs md:text-sm">${podDisplay}</td>
              <td class="p-3 md:p-5 text-xs md:text-sm">
                <div class="row-action-group">
                  <button onclick="openStatusUpdateModal(${idx})" class="action-edit-btn" title="Update Status">
                    <svg class="edit-svgIcon" viewBox="0 0 512 512"><path d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7l22.6-22.6zm-32.5-135.9l62.1 62.1 39.4-39.4c15.6-15.6 15.6-40.9 0-56.6L433.9 15.6c-15.6-15.6-40.9-15.6-56.6 0L338 54.9l39.4 39.4z"/></svg>
                  </button>
                  <label class="action-pod-btn" title="Upload POD">
                    <svg class="edit-svgIcon" viewBox="0 0 512 512"><path d="M149.1 64.8L138.7 96H64C28.7 96 0 124.7 0 160V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H373.3L362.9 64.8C356.4 45.2 338.1 32 317.4 32H194.6c-20.7 0-39 13.2-45.5 32.8zM256 192a96 96 0 1 1 0 192 96 96 0 1 1 0-192z"/></svg>
                    <input type="file" accept="image/*" onchange="uploadPOD(event, ${idx})" class="hidden">
                  </label>
                  <button onclick="deleteShipment(${idx})" class="action-delete-btn" title="Delete">
                    <svg class="svgIcon" viewBox="0 0 448 512"><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/></svg>
                  </button>
                </div>
              </td>
            </tr>`;
        });
      }

      async function updateStatus(index, newStatus) {
        if (newStatus === "Others") {
          shipments[index].status = "Others: ";
        } else {
          shipments[index].status = sanitizeInput(newStatus);
        }
        await db.from('shipments').update({ status: shipments[index].status }).eq('tracking', shipments[index].tracking);
        saveData();
        logActivity('UPDATE_STATUS', `Updated shipment ${shipments[index].tracking} status to ${newStatus}`);
        renderShipments();
      }

      async function updateCustomStatus(index, text) {
        const sanitized = sanitizeInput(text);
        if (sanitized.length === 0) return;
        if (sanitized.length < 2) {
          alert('Custom status must be at least 2 characters');
          return;
        }
        shipments[index].status = "Others: " + sanitized;
        await db.from('shipments').update({ status: shipments[index].status }).eq('tracking', shipments[index].tracking);
        saveData();
        logActivity('UPDATE_CUSTOM_STATUS', `Updated shipment ${shipments[index].tracking} with custom status`);
      }

      function openStatusUpdateModal(index) {
        const shipment = shipments[index];
        const modal = document.createElement('div');
        modal.id = 'status-update-modal';
        modal.className = 'fixed inset-0 bg-black/90 flex items-center justify-center z-[400] p-4';
        
        const today = new Date().toISOString().split('T')[0];
        
        modal.innerHTML = `
          <div class="bg-zinc-900 p-6 md:p-10 rounded-3xl w-full max-w-md">
            <h2 class="heading-font text-2xl md:text-3xl mb-6 text-center">Update Status</h2>
            
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-semibold mb-2 text-zinc-300">Status</label>
                <select id="modal-status" onchange="toggleNoteField()" class="w-full bg-zinc-800 border border-amber-400 p-3 rounded-lg text-sm">
                  <option value="Picked Up">Picked Up</option>
                  <option value="In Transit" selected>In Transit</option>
                  <option value="Out for Delivery">Out for Delivery</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Note">Note</option>
                </select>
              </div>
              
              <div id="note-field" class="hidden">
                <label class="block text-sm font-semibold mb-2 text-zinc-300">Note</label>
                <input type="text" id="modal-note" placeholder="Enter note message..." class="w-full bg-zinc-800 border border-amber-400 p-3 rounded-lg text-sm" maxlength="200">
              </div>
              
              <div>
                <label class="block text-sm font-semibold mb-2 text-zinc-300">Update Date</label>
                <input type="date" id="modal-date" value="${today}" class="w-full bg-zinc-800 border border-white/20 p-3 rounded-lg text-sm">
              </div>
              
              <div>
                <label class="block text-sm font-semibold mb-2 text-zinc-300">Location</label>
                <input type="text" id="modal-location" placeholder="e.g., Delhi Distribution Center" value="${sanitizeInput(shipment.location) || ''}" class="w-full bg-zinc-800 border border-white/20 p-3 rounded-lg text-sm" maxlength="100">
              </div>
            </div>
            
            <div class="flex gap-3 mt-8">
              <button onclick="confirmStatusUpdate(${index})" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-semibold transition-all">
                Confirm
              </button>
              <button onclick="closeStatusUpdateModal()" class="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white py-3 rounded-lg font-semibold transition-all">
                Cancel
              </button>
            </div>
          </div>
        `;
        
        document.body.appendChild(modal);
      }

      async function confirmStatusUpdate(index) {
        const newStatus = document.getElementById('modal-status').value;
        const newDate = document.getElementById('modal-date').value;
        const newLocation = sanitizeInput(document.getElementById('modal-location').value);
        
        if (!newDate) {
          alert('Please select a date');
          return;
        }
        
        if (!newLocation) {
          alert('Please enter a location');
          return;
        }
        
        let noteText = '';
        if (newStatus === "Note") {
          noteText = sanitizeInput(document.getElementById('modal-note').value);
          if (!noteText || noteText.length < 2) {
            alert('Please enter a note message (at least 2 characters)');
            return;
          }
          shipments[index].status = shipments[index].status; // keep existing status unchanged
        } else {
          shipments[index].status = newStatus;
        }
        
        shipments[index].date = newDate;
        shipments[index].location = newLocation;
        
        if (!shipments[index].history) shipments[index].history = [];
        shipments[index].history.push({
          status: newStatus === "Note" ? `Note: ${noteText}` : shipments[index].status,
          date: newDate,
          location: newLocation
        });
        
        const updatePayload = {
          date: newDate,
          location: newLocation,
          history: shipments[index].history
        };
        if (newStatus !== "Note") updatePayload.status = shipments[index].status;
        
        await db.from('shipments').update(updatePayload).eq('tracking', shipments[index].tracking);

        saveData();
        const logDetail = newStatus === "Note" ? `Added note to ${shipments[index].tracking}: ${noteText}` : `Updated shipment ${shipments[index].tracking} - Status: ${newStatus}, Date: ${newDate}, Location: ${newLocation}`;
        logActivity('CONFIRM_UPDATE', logDetail);
        closeStatusUpdateModal();
        renderShipments();
        alert('Status updated successfully!');
      }

      function toggleNoteField() {
        const status = document.getElementById('modal-status').value;
        const noteField = document.getElementById('note-field');
        if (noteField) noteField.classList.toggle('hidden', status !== 'Note');
      }

      function closeStatusUpdateModal() {
        const modal = document.getElementById('status-update-modal');
        if (modal) modal.remove();
      }

      async function deleteShipment(index) {
        if (confirm("Delete this shipment permanently?")) {
          const trackingNo = shipments[index].tracking;
          await db.from('shipments').delete().eq('tracking', trackingNo);
          shipments.splice(index, 1);
          saveData();
          logActivity('DELETE_SHIPMENT', `Deleted shipment ${trackingNo}`);
          renderShipments();
        }
      }

      function showUndoToast(message, onUndo) {
        const existing = document.getElementById('undo-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'undo-toast';
        toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-4 bg-zinc-800 border border-white/10 px-5 py-3 rounded-2xl shadow-xl text-sm';
        toast.innerHTML = `
          <span class="text-zinc-300">${message}</span>
          <button id="undo-btn" class="text-amber-400 font-semibold hover:text-amber-300 transition-all cursor-pointer">Undo</button>
        `;
        document.body.appendChild(toast);

        const timer = setTimeout(() => toast.remove(), 6000);

        document.getElementById('undo-btn').onclick = () => {
          clearTimeout(timer);
          toast.remove();
          onUndo();
        };
      }

      async function uploadPOD(e, index) {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
          alert('Only image files are allowed');
          return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
          alert('File size must be less than 5MB');
          return;
        }

        const ext = file.name.split('.').pop();
        const fileName = `${shipments[index].tracking}_${Date.now()}.${ext}`;

        const { error: uploadError } = await db.storage.from('pod-images').upload(fileName, file);
        if (uploadError) { alert('Upload failed: ' + uploadError.message); return; }

        const { data: urlData } = db.storage.from('pod-images').getPublicUrl(fileName);
        const publicUrl = urlData.publicUrl;

        await db.from('shipments').update({ pod_url: publicUrl }).eq('tracking', shipments[index].tracking);
        shipments[index].pod = publicUrl;
        shipments[index].pod_url = publicUrl;

        saveData();
        logActivity('UPLOAD_POD', `Uploaded POD for shipment ${shipments[index].tracking}`);
        renderShipments();
        alert("POD uploaded!");
      }

      function showPodModal(index) {
        if (index === undefined || index === null || !shipments[index] || !shipments[index].pod) {
          alert("No POD available");
          return;
        }

        const podContainer = document.getElementById('pod-image-container');
        podContainer.innerHTML = '';

        const img = new Image();
        img.src = shipments[index].pod;
        img.onload = () => {
          podContainer.innerHTML = `
            <img src="${shipments[index].pod}" alt="POD" class="w-full h-auto max-h-96">
            <button onclick="deletePOD(${index})" 
                    class="mt-4 w-full bg-red-600 hover:bg-red-700 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2">
              <i class="fas fa-trash text-xs"></i> Delete POD
            </button>`;
          document.getElementById('pod-modal').classList.remove('hidden');
        };
        img.onerror = () => {
          podContainer.innerHTML = '<p class="text-red-400 text-center py-8">Failed to load image</p>';
          document.getElementById('pod-modal').classList.remove('hidden');
        };
      }

      async function deletePOD(index) {
        if (!confirm('Delete this POD permanently?')) return;

        const url = shipments[index].pod_url;
        // Extract filename from URL
        const fileName = url.split('/').pop().split('?')[0];

        await db.storage.from('pod-images').remove([fileName]);
        await db.from('shipments').update({ pod_url: null }).eq('tracking', shipments[index].tracking);

        shipments[index].pod = null;
        shipments[index].pod_url = null;

        saveData();
        logActivity('DELETE_POD', `Deleted POD for shipment ${shipments[index].tracking}`);
        document.getElementById('pod-modal').classList.add('hidden');
        renderShipments();
        alert('POD deleted!');
      }

      function closePodModal() {
        document.getElementById('pod-modal').classList.add('hidden');
      }

      async function addNewShipment() {
        let tracking = sanitizeInput(document.getElementById('new-tracking').value).toUpperCase();
        
        if (!tracking) {
          tracking = "SLX" + Math.floor(10000000 + Math.random()*90000000);
        }
        
        if (shipments.some(s => s.tracking.toUpperCase() === tracking.toUpperCase())) {
          alert("Tracking number already exists! Please use a different number.");
          return;
        }

        const customer = sanitizeInput(document.getElementById('new-customer').value) || "Customer";
        const origin = sanitizeInput(document.getElementById('new-origin').value) || "Bengaluru";
        const destination = sanitizeInput(document.getElementById('new-destination').value) || "Mumbai";
        let status = document.getElementById('new-status').value;
        const date = document.getElementById('new-date').value || new Date().toISOString().slice(0,10);

        if (status === "Others") status = "Others: Custom Status";

        const consignee = sanitizeInput(document.getElementById('new-consignee').value) || "";
        const custId    = sanitizeInput(document.getElementById('new-custid').value) || "";
        const boxes     = parseInt(document.getElementById('new-boxes').value) || 0;
        const weight    = parseFloat(document.getElementById('new-weight').value) || 0;
        const rate      = parseFloat(document.getElementById('new-rate').value) || 0;

        const newShipment = { 
          tracking, customer, consignee,
          cust_id: custId,        // ← was custId
          origin, destination, status, date,
          location: "Initial Pickup",
          history: [{ status, date, location: "Initial Pickup" }],
          pod_url: null, boxes, weight, rate,
          branch: securityState.role === 'super_admin'
            ? (securityState.activeBranch === 'all' ? 'blr' : securityState.activeBranch)
            : securityState.branch
        };

        const { error } = await db.from('shipments').insert(newShipment);
        if (error) { alert("Failed to create shipment: " + error.message); return; }

        shipments.push({ ...newShipment, pod: null });
        saveData();
        logActivity('CREATE_SHIPMENT', `Created new shipment ${tracking}`);
        document.getElementById('new-tracking').value = '';
        document.getElementById('new-customer').value = '';
        document.getElementById('new-origin').value = '';
        document.getElementById('new-destination').value = '';
        document.getElementById('new-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('new-custid').value = '';
        document.getElementById('new-consignee').value = '';
        document.getElementById('new-boxes').value = '';
        document.getElementById('new-weight').value = '';
        document.getElementById('new-rate').value = '';
        document.getElementById('calc-desc').textContent = 'Enter weight & rate to preview bill amount';
        document.getElementById('calc-amt').textContent = '—';
        renderShipments();
        alert("Shipment created");
        const { data: freshData, error: fetchErr } = await db.from('shipments').select('*').order('created_at', { ascending: false });
        if (!fetchErr && freshData) {
          shipments = freshData.map(s => ({ ...s, custId: s.cust_id, pod: s.pod_url }));
          populateShipmentMonthFilter();
        }
      }

      function initFuzzyText(canvas, text, opts = {}) {
        const {
          fontSize = 'clamp(2rem, 10vw, 10rem)',
          fontWeight = 900,
          fontFamily = 'inherit',
          color = '#fff',
          enableHover = true,
          baseIntensity = 0.18,
          hoverIntensity = 0.5,
          fuzzRange = 30,
          fps = 60,
          enableHover: _eh,
          clickEffect = false,
          glitchMode = false,
          glitchInterval = 2000,
          glitchDuration = 200,
        } = opts;

        let animationFrameId;
        let glitchTimeoutId, glitchEndTimeoutId, clickTimeoutId;
        let isCancelled = false;

        const init = async () => {
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          const computedFamily = fontFamily === 'inherit'
            ? window.getComputedStyle(canvas).fontFamily || 'sans-serif'
            : fontFamily;
          const fontSizeStr = typeof fontSize === 'number' ? `${fontSize}px` : fontSize;

          try { await document.fonts.load(`${fontWeight} ${fontSizeStr} ${computedFamily}`); }
          catch { await document.fonts.ready; }
          if (isCancelled) return;

          let numericFontSize;
          if (typeof fontSize === 'number') {
            numericFontSize = fontSize;
          } else {
            const temp = document.createElement('span');
            temp.style.fontSize = fontSize;
            document.body.appendChild(temp);
            numericFontSize = parseFloat(window.getComputedStyle(temp).fontSize);
            document.body.removeChild(temp);
          }

          const offscreen = document.createElement('canvas');
          const offCtx = offscreen.getContext('2d');
          offCtx.font = `${fontWeight} ${fontSizeStr} ${computedFamily}`;
          offCtx.textBaseline = 'alphabetic';

          const totalWidth = offCtx.measureText(text).width;
          const metrics = offCtx.measureText(text);
          const actualLeft = metrics.actualBoundingBoxLeft ?? 0;
          const actualAscent = metrics.actualBoundingBoxAscent ?? numericFontSize;
          const actualDescent = metrics.actualBoundingBoxDescent ?? numericFontSize * 0.2;
          const textBoundingWidth = Math.ceil(actualLeft + (metrics.actualBoundingBoxRight ?? metrics.width));
          const tightHeight = Math.ceil(actualAscent + actualDescent);
          const xOffset = 5;

          offscreen.width = textBoundingWidth + 10;
          offscreen.height = tightHeight;
          offCtx.font = `${fontWeight} ${fontSizeStr} ${computedFamily}`;
          offCtx.textBaseline = 'alphabetic';
          offCtx.fillStyle = color;
          offCtx.fillText(text, xOffset - actualLeft, actualAscent);

          const horizontalMargin = fuzzRange + 20;
          canvas.width = offscreen.width + horizontalMargin * 2;
          canvas.height = tightHeight;
          ctx.translate(horizontalMargin, 0);

          let isHovering = false, isClicking = false, isGlitching = false;
          let currentIntensity = baseIntensity, lastFrameTime = 0;
          const frameDuration = 1000 / fps;

          const startGlitch = () => {
            if (!glitchMode || isCancelled) return;
            glitchTimeoutId = setTimeout(() => {
              if (isCancelled) return;
              isGlitching = true;
              glitchEndTimeoutId = setTimeout(() => { isGlitching = false; startGlitch(); }, glitchDuration);
            }, glitchInterval);
          };
          if (glitchMode) startGlitch();

          const run = ts => {
            if (isCancelled) return;
            if (ts - lastFrameTime < frameDuration) { animationFrameId = requestAnimationFrame(run); return; }
            lastFrameTime = ts;
            ctx.clearRect(-fuzzRange - 20, -fuzzRange - 10, offscreen.width + 2 * (fuzzRange + 20), tightHeight + 2 * (fuzzRange + 10));
            const target = (isClicking || isGlitching) ? 1 : isHovering ? hoverIntensity : baseIntensity;
            currentIntensity = target;
            for (let j = 0; j < tightHeight; j++) {
              const dx = Math.floor(currentIntensity * (Math.random() - 0.5) * fuzzRange);
              ctx.drawImage(offscreen, 0, j, offscreen.width, 1, dx, j, offscreen.width, 1);
            }
            animationFrameId = requestAnimationFrame(run);
          };
          animationFrameId = requestAnimationFrame(run);

          const rect = () => canvas.getBoundingClientRect();
          canvas.addEventListener('mousemove', e => {
            const r = rect(); isHovering = true;
          });
          canvas.addEventListener('mouseleave', () => { isHovering = false; });
          if (clickEffect) {
            canvas.addEventListener('click', () => {
              isClicking = true;
              clearTimeout(clickTimeoutId);
              clickTimeoutId = setTimeout(() => { isClicking = false; }, 150);
            });
          }
        };

        init();
      }

      function showPodModalByUrl(url) {
        const podContainer = document.getElementById('pod-image-container');
        podContainer.innerHTML = `<img src="${url}" alt="POD" class="w-full h-auto max-h-96">`;
        document.getElementById('pod-modal').classList.remove('hidden');
      }


      function updateAnalytics() {
        const total = shipments.length;
        const delivered = shipments.filter(s => s.status === "Delivered").length;
        const inTransit = shipments.filter(s => s.status === "In Transit").length;
        const pending = shipments.filter(s => s.status !== "Delivered" && s.status !== "In Transit").length;

        document.getElementById('total-shipments').textContent = total;
        document.getElementById('delivered-count').textContent = delivered;
        document.getElementById('in-transit-count').textContent = inTransit;
        document.getElementById('pending-count').textContent = pending;

        renderStatusChart();
        renderRouteChart();
        renderActivityChart();
      }

      function renderStatusChart() {
        const ctx = document.getElementById('statusChart');
        if (!ctx) return;

        const delivered = shipments.filter(s => s.status === "Delivered").length;
        const inTransit = shipments.filter(s => s.status === "In Transit").length;
        const others = shipments.filter(s => !["Delivered", "In Transit"].includes(s.status)).length;

        if (chartInstances.status) {
          chartInstances.status.destroy();
          delete chartInstances.status;
        }
        
        chartInstances.status = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['Delivered', 'In Transit', 'Pending'],
            datasets: [{
              data: [delivered, inTransit, others],
              backgroundColor: ['#10b981', '#fbbf24', '#ef4444'],
              borderColor: '#18181b',
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: {
                labels: { color: '#fff', font: { size: 12 } }
              }
            }
          }
        });
      }

      function renderRouteChart() {
        const ctx = document.getElementById('routeChart');
        if (!ctx) return;

        const routes = {};
        shipments.forEach(s => {
          const route = `${sanitizeInput(s.origin)} → ${sanitizeInput(s.destination)}`;
          routes[route] = (routes[route] || 0) + 1;
        });

        if (chartInstances.route) {
          chartInstances.route.destroy();
          delete chartInstances.route;
        }
        
        chartInstances.route = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: Object.keys(routes),
            datasets: [{
              label: 'Shipments',
              data: Object.values(routes),
              backgroundColor: '#fbbf24',
              borderColor: '#f59e0b',
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            indexAxis: 'y',
            plugins: {
              legend: { labels: { color: '#fff' } }
            },
            scales: {
              x: { ticks: { color: '#fff' }, grid: { color: '#3f3f46' } },
              y: { ticks: { color: '#fff' }, grid: { color: '#3f3f46' } }
            }
          }
        });
      }

      function renderActivityChart() {
        const ctx = document.getElementById('activityChart');
        if (!ctx) return;

        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const data = [12, 19, 3, 5, 2, 15, 8];

        if (chartInstances.activity) {
          chartInstances.activity.destroy();
          delete chartInstances.activity;
        }
        
        chartInstances.activity = new Chart(ctx, {
          type: 'line',
          data: {
            labels: days,
            datasets: [{
              label: 'Shipments Processed',
              data: data,
              borderColor: '#fbbf24',
              backgroundColor: 'rgba(251, 191, 36, 0.1)',
              tension: 0.4,
              fill: true
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: { labels: { color: '#fff' } }
            },
            scales: {
              y: { ticks: { color: '#fff' }, grid: { color: '#3f3f46' } },
              x: { ticks: { color: '#fff' }, grid: { color: '#3f3f46' } }
            }
          }
        });
      }


      // ============================================
      // LOGIN & PASSWORD RESET FUNCTIONS
      // ============================================

      function showAdminLogin() {
        document.getElementById('progress-bar').style.display = 'none';
        document.getElementById('login-modal').classList.remove('hidden');
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('forgot-password-form').classList.add('hidden');
        securityState.loginAttempts = 0;
        updateLoginAttempts();
        document.getElementById('admin-user').value = '';
        document.getElementById('admin-pass').value = '';
      }

      function closeAdminLogin() {
        document.getElementById('progress-bar').style.display = 'block';
        document.getElementById('login-modal').classList.add('hidden');
      }

      function updateLoginAttempts() {
        const attemptsDiv = document.getElementById('login-attempts');
        if (securityState.loginAttempts > 0) {
          attemptsDiv.classList.remove('hidden');
          document.getElementById('attempts-count').textContent = SECURITY_CONFIG.maxLoginAttempts - securityState.loginAttempts;
        } else {
          attemptsDiv.classList.add('hidden');
        }
      }

      async function loginAdmin() {
        const email = document.getElementById('admin-user').value.trim();
        const pass = document.getElementById('admin-pass').value;

        if (!email || !pass) { showLoginError('Please enter username and password'); return; }
        if (securityState.loginAttempts >= SECURITY_CONFIG.maxLoginAttempts) {
          showLoginError('Too many failed attempts. Please try again later.'); return;
        }

        const { data: authData, error: authError } = await db.auth.signInWithPassword({ email, password: pass });

        if (!authError && authData.user) {
          // Fetch branch + role from admin_profiles
          const { data: profile, error: profileError } = await db
            .from('admin_profiles')
            .select('branch, role, email')
            .eq('id', authData.user.id)
            .single();
            console.log('user id:', authData.user.id);
            console.log('profile:', profile);
            console.log('profile error:', profileError);

          if (profileError || !profile) {
            showLoginError('Admin profile not found. Contact super admin.');
            await db.auth.signOut();
            return;
          }

          securityState.branch = profile.branch;
          securityState.role = profile.role;
          updateDashboardHeading();

          document.getElementById('login-modal').classList.add('hidden');
          document.getElementById('admin-panel').classList.remove('hidden');
          setTimeout(injectRippleButtons, 100);

          startSession(email);

          setTimeout(() => { restyleTabPills(); updateParentUnderline(); updateSubUnderline(); }, 100);

          // Fetch shipments filtered by branch (super admin gets all)
          const query = db.from('shipments').select('*').order('created_at', { ascending: false });
          if (securityState.role !== 'super_admin') query.eq('branch', securityState.branch);
          const { data, error: fetchError } = await query;
          if (!fetchError && data) {
            shipments = data.map(s => ({ ...s, custId: s.cust_id, pod: s.pod_url }));
            populateShipmentMonthFilter(); 
          }
          // Fetch clients
          const clientQuery = db.from('clients').select('*').order('created_at', { ascending: false });
          if (securityState.role !== 'super_admin') clientQuery.eq('branch', securityState.branch);
          const { data: clientData } = await clientQuery;
          if (clientData) clients = clientData;
          renderClientList();

          // Inject branch switcher if super admin
          if (securityState.role === 'super_admin') renderBranchSwitcher();

          switchParentTab(0);
          switchSubTab(0);
          updateStatusBadges();
          securityState.loginAttempts = 0;
        } else {
          securityState.loginAttempts++;
          updateLoginAttempts();
          showLoginError(`Invalid credentials. ${SECURITY_CONFIG.maxLoginAttempts - securityState.loginAttempts} attempts remaining.`);
          logActivity('FAILED_LOGIN', `Failed login attempt`);
        }
      }

      function updateDashboardHeading() {
        const heading = document.getElementById('dashboard-heading');
        if (!heading) return;

        if (securityState.role === 'super_admin') {
          heading.textContent = 'Welcome, Gaddy';
        } else if (securityState.branch === 'blr') {
          heading.textContent = 'Welcome, Bengaluru';
        } else if (securityState.branch === 'chennai') {
          heading.textContent = 'Welcome, Chennai';
        } else {
          heading.textContent = 'Admin Dashboard';
        }
      }

      async function addClient() {
        const custId = document.getElementById('new-client-id').value.trim().toUpperCase();
        const name = document.getElementById('new-client-name').value.trim().toUpperCase();

        if (!custId || !name) { alert('Both fields are required'); return; }
        if (clients.find(c => c.cust_id === custId)) { alert('Customer ID already exists'); return; }

        const branch = securityState.role === 'super_admin'
          ? (securityState.activeBranch === 'all' ? 'blr' : securityState.activeBranch)
          : securityState.branch;

        const { data, error } = await db.from('clients').insert({ cust_id: custId, name, branch }).select().single();
        if (error) { alert('Failed to add client'); return; }

        clients.unshift(data);
        renderClientList();
        document.getElementById('new-client-id').value = '';
        document.getElementById('new-client-name').value = '';
        logActivity('ADD_CLIENT', `Added client ${name} (${custId})`);
      }

      async function deleteClient(custId) {
        if (!confirm(`Remove client ${custId}?`)) return;
        await db.from('clients').delete().eq('cust_id', custId);
        clients = clients.filter(c => c.cust_id !== custId);
        renderClientList();
        logActivity('DELETE_CLIENT', `Removed client ${custId}`);
      }

      function renderClientList() {
        const list = document.getElementById('client-list');
        if (!clients.length) {
          list.innerHTML = '<p class="text-zinc-600 text-xs text-center py-4">No clients yet</p>';
          return;
        }
        const isSuperAdmin = securityState.role === 'super_admin';
        list.innerHTML = clients.map(c => {
          const branchColour = c.branch === 'blr'
            ? 'color:#7A9CC4;border:1px solid #2A3F6F;background:rgba(42,63,111,0.15)' 
            : 'color:#B07FD4;border:1px solid #6B3F8F;background:rgba(107,63,143,0.15)'; 
          const branchPill = isSuperAdmin
            ? `<span class="text-xs font-mono px-2 py-0.5 rounded-full ml-2" style="${branchColour}">${c.branch === 'blr' ? 'BLR' : 'CHE'}</span>`
            : '';
          return `
            <div class="flex items-center justify-between py-2 border-b border-white/5">
              <div class="flex items-center flex-wrap gap-1">
                <span class="text-xs font-mono" style="color:#C9A84C">${c.cust_id}</span>
                <span class="text-xs text-zinc-300 ml-2">${c.name}</span>
                ${branchPill}
              </div>
              <button onclick="deleteClient('${c.cust_id}')" class="text-zinc-600 hover:text-red-400 transition-all cursor-pointer text-xs">
                <i class="fas fa-times"></i>
              </button>
            </div>
          `;
        }).join('');
      }

      function autofillCustomer() {
        const custId = document.getElementById('new-custid').value.trim().toUpperCase();
        const match = clients.find(c => c.cust_id === custId);
        const nameInput = document.getElementById('new-customer');
        if (match) {
          nameInput.value = match.name;
          nameInput.classList.add('border-amber-400/60');
        } else {
          nameInput.classList.remove('border-amber-400/60');
        }
      }

      function showLoginError(msg) {
        const msgDiv = document.getElementById('login-msg');
        msgDiv.textContent = msg;
        msgDiv.classList.remove('hidden');
        setTimeout(() => msgDiv.classList.add('hidden'), 4000);
      }

      function showForgotPassword() {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('forgot-password-form').classList.remove('hidden');
        document.getElementById('reset-username').value = '';
        document.getElementById('reset-msg').textContent = '';
        document.getElementById('reset-msg').classList.add('hidden');
      }

      function backToLogin() {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('forgot-password-form').classList.add('hidden');
        document.getElementById('admin-user').value = '';
        document.getElementById('admin-pass').value = '';
      }

      function sendPasswordReset() {
        const username = sanitizeInput(document.getElementById('reset-username').value).trim().toLowerCase();
        const msgDiv = document.getElementById('reset-msg');

        if (!username) {
          msgDiv.textContent = 'Please enter your username';
          msgDiv.classList.remove('hidden', 'text-emerald-400');
          msgDiv.classList.add('text-red-500');
          return;
        }

        if (!ADMIN_USERS[username]) {
          msgDiv.textContent = 'Username not found';
          msgDiv.classList.remove('hidden', 'text-emerald-400');
          msgDiv.classList.add('text-red-500');
          return;
        }

        const resetCode = Math.random().toString(36).substr(2, 9).toUpperCase();
        
        msgDiv.innerHTML = `<strong> Success!</strong><br>A password reset link has been sent to your registered email.<br><br><strong>Demo Reset Code:</strong> <code>${resetCode}</code><br><br>In production, you would receive an email with further instructions.`;
        msgDiv.classList.remove('hidden', 'text-red-500');
        msgDiv.classList.add('text-emerald-400');
        
        logActivity('PASSWORD_RESET_REQUESTED', `Password reset requested for user: ${username}`);
        
        setTimeout(() => {
          backToLogin();
        }, 5000);
      }

      function logoutAdmin() {
        window.scrollTo({ top: 0, behavior: 'instant' });
        document.getElementById('progress-bar').style.display = 'block';
        logActivity('LOGOUT', `Admin logged out`);
        securityState.isSessionActive = false;
        securityState.branch = null;
        securityState.role = null;
        securityState.activeBranch = 'all';

        const switcher = document.getElementById('branch-switcher');
        if (switcher) switcher.remove();

        if (analyticsInterval) clearInterval(analyticsInterval);

        document.getElementById('admin-panel').classList.add('hidden');
        document.getElementById('security-banner').classList.add('hidden');

        db.auth.signOut();
      }

      // ============================================
      // INITIALIZATION
      // ============================================

      window.onload = () => {
        const today = new Date().toISOString().split('T')[0];
        const dateField = document.getElementById('new-date');
        if (dateField) {
          dateField.value = today;
        }
        
        console.log('S.L. Express Ready');
        console.log('All systems online');
      };
  
  let payStatus = {};
  let editingTrackingNo = null;
  let detailCustId = null;
  function payKey(c,m){ return c+"_"+m; }
  function getPayStatus(c,m){ return payStatus[payKey(c,m)]||"pending"; }
  function setPayStatus(c,m,st){ payStatus[payKey(c,m)]=st; }
  function inr(n){ return "₹"+Number(n||0).toLocaleString("en-IN"); }
  function fmtDate(d){ if(!d)return""; const p=d.split("-"); if(p.length!==3)return d; return p[2]+"."+p[1]+"."+p[0]; }
  function monthLabel(val){ const[y,m]=val.split("-"); return["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m]+" "+y; }
  // ════════════════════════════════════════════
  // BILLING TAB
  // ════════════════════════════════════════════
  const CUSTOMERS = [
      { custId: "123", name: "Your Customer Name", av: "av-a" },
    ];
  
  function getMonthShipments(monthVal){
    const [y,m]=monthVal.split("-");
    return shipments.filter(s=>{
      if(!s.date) return false;
      let yyyy, mm;
      if(s.date.includes("-")){
        // yyyy-mm-dd format
        [yyyy,mm]=s.date.split("-");
      } else {
        // ddmmyyyy format
        mm=s.date.slice(2,4);
        yyyy=s.date.slice(4,8);
      }
      return yyyy===y && mm===m;
    });
  }
  

  function renderBilling(){
    // auto-populate months
    const billSel = document.getElementById("bill-month");
    if(billSel.options.length === 0){
      const now = new Date();
      for(let i = 0; i < 12; i++){
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const val = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = d.toLocaleString("default",{month:"short"})+" "+d.getFullYear();
        billSel.appendChild(opt);
      }
    }

    const monthVal=document.getElementById("bill-month").value;
    const label=monthLabel(monthVal);
    document.getElementById("bill-month-label").textContent=label;
    closeBillDetail();

    const ms=getMonthShipments(monthVal);
    console.log("month:", monthVal, "matched shipments:", ms);
    const groups={};
    CUSTOMERS.forEach(c=>{groups[c.custId]={...c,shipments:[]};});
    ms.forEach(s=>{
      const key=s.custId||"UNCATEGORISED";
      if(!groups[key]) groups[key]={custId:key,name:s.customer,av:"av-a",shipments:[]};
      groups[key].shipments.push(s);
    });

    let totalBilled=0,totalCollected=0,totalOut=0,totalBoxes=0;
    Object.values(groups).forEach(g=>{
      const amt=g.shipments.reduce((a,s)=>a+(s.weight||0)*(s.rate||0),0);
      const st=getPayStatus(g.custId,monthVal);
      totalBilled+=amt;
      totalBoxes+=g.shipments.reduce((a,s)=>a+(s.boxes||0),0);
      if(st==="paid") totalCollected+=amt; else totalOut+=amt;
    });

    document.getElementById("bill-stats").innerHTML=`
      <div class="bill-stat"><div class="bill-stat-label">Total billed</div><div class="bill-stat-val" style="color:#fbbf24">${inr(totalBilled)}</div></div>
      <div class="bill-stat"><div class="bill-stat-label">Collected</div><div class="bill-stat-val" style="color:#10b981">${inr(totalCollected)}</div></div>
      <div class="bill-stat"><div class="bill-stat-label">Outstanding</div><div class="bill-stat-val" style="color:#fbbf24">${inr(totalOut)}</div></div>
      <div class="bill-stat"><div class="bill-stat-label">Total boxes</div><div class="bill-stat-val" style="color:#71717a">${totalBoxes.toLocaleString()}</div></div>
    `;

    let rows="";
    Object.values(groups).forEach(g=>{
      const cs=g.shipments;
      const boxes=cs.reduce((a,s)=>a+(s.boxes||0),0);
      const kg=cs.reduce((a,s)=>a+(s.weight||0),0);
      const amt=cs.reduce((a,s)=>a+(s.weight||0)*(s.rate||0),0);
      const rates=[...new Set(cs.map(s=>s.rate))].filter(Boolean);
      const rStr=rates.length?(rates.length>1?`₹${Math.min(...rates)}–${Math.max(...rates)}/kg`:`₹${rates[0]}/kg`):"—";
      const st=getPayStatus(g.custId,monthVal);
      const pillCls=st==="paid"?"pill-paid":st==="pending"?"pill-pending":"pill-draft";
      rows+=`<tr style="cursor:pointer" onclick="openBillDetail('${g.custId}','${monthVal}')">
        <td><div class="flex items-center gap-2"><div class="cust-av ${g.av}">${(g.name||"?").split(" ").map(w=>w[0]).join("").slice(0,2)}</div><span class="text-zinc-200">${sanitizeInput(g.name)}</span></div></td>
        <td class="text-zinc-500 text-xs">${sanitizeInput(g.custId)}</td>
        <td>${boxes||"—"}</td>
        <td class="font-medium">${kg?kg.toLocaleString()+" kg":"—"}</td>
        <td class="text-zinc-400">${rStr}</td>
        <td class="text-amber-400 font-semibold">${amt?inr(amt):"—"}</td>
        <td><span class="bill-pill ${pillCls}">${st[0].toUpperCase()+st.slice(1)}</span></td>
        <td>
          <button class="icon-action" title="Edit" onclick="event.stopPropagation();openEditForGroup('${g.custId}','${monthVal}')">
            <i class="fa-solid fa-pen"></i>
          </button>
        </td>
      </tr>`;
    });
    document.getElementById("bill-tbody").innerHTML=rows||`<tr><td colspan="8" class="p-8 text-center text-zinc-600 text-sm">No shipments this month</td></tr>`;
  }

  function openBillDetail(custId,monthVal){
    detailCustId=custId;
    const g={...(CUSTOMERS.find(c=>c.custId===custId)||{custId,name:custId,av:"av-a"}),shipments:getMonthShipments(monthVal).filter(s=>s.custId===custId)};
    const cs=g.shipments;
    const totalBoxes=cs.reduce((a,s)=>a+(s.boxes||0),0);
    const totalKg=cs.reduce((a,s)=>a+(s.weight||0),0);
    const totalAmt=cs.reduce((a,s)=>a+(s.weight||0)*(s.rate||0),0);
    const rates=[...new Set(cs.map(s=>s.rate))].filter(Boolean);
    const rStr=rates.length>1?`₹${Math.min(...rates)}–${Math.max(...rates)}/kg`:`₹${rates[0]||"—"}/kg`;
    const st=getPayStatus(custId,monthVal);

    document.getElementById("det-cname").textContent =g.name;
    document.getElementById("det-cid").textContent   =custId+"  ·  "+st[0].toUpperCase()+st.slice(1);
    document.getElementById("det-month").textContent =monthLabel(monthVal);
    document.getElementById("det-boxes").textContent =totalBoxes+" boxes";
    document.getElementById("det-wt").textContent    =totalKg.toLocaleString()+" kg";
    document.getElementById("det-rate").textContent  =rStr;
    document.getElementById("det-summary").textContent=cs.length+" shipments · "+totalBoxes+" boxes · "+totalKg.toLocaleString()+" kg";
    document.getElementById("det-total").textContent =inr(totalAmt);

    // FIX 3: columns match invoice format — S/No, Date, AWB No., Consignee, Destination, Qty, Weight, Amount
    let rows="";
    cs.forEach((s,i)=>{
      const lineAmt=(s.weight||0)*(s.rate||0);
      rows+=`<tr>
        <td class="text-zinc-500">${i+1}</td>
        <td class="text-zinc-400">${fmtDate(s.date)}</td>
        <td class="text-amber-400 font-mono text-xs">${sanitizeInput(s.tracking)}</td>
        <td class="text-zinc-200">${sanitizeInput(s.consignee||s.customer)}</td>
        <td class="text-zinc-400">${sanitizeInput(s.destination)}</td>
        <td>${s.boxes||"—"}</td>
        <td class="font-medium">${s.weight||"—"}${s.weight?" kg":""}</td>
        <td class="text-emerald-400 font-semibold">${lineAmt?inr(lineAmt):"—"}</td>
        <td><button class="icon-action" onclick="openEditSingle('${s.tracking}')"><i class="fa-solid fa-pen"></i></button></td>
      </tr>`;
    });
    document.getElementById("det-tbody").innerHTML=rows||`<tr><td colspan="9" class="p-6 text-center text-zinc-600 text-sm">No shipments found</td></tr>`;

    document.getElementById("bill-list-card").style.display="none";
    document.getElementById("bill-detail").style.display="block";
  }

  function closeBillDetail(){
    document.getElementById("bill-list-card").style.display="block";
    document.getElementById("bill-detail").style.display="none";
    detailCustId=null;
  }

  function markPaid() {
    const monthVal = document.getElementById("bill-month").value;
    if (!detailCustId) return;

    const key = `${detailCustId}_${monthVal}`;
    const prev = paidHistory[key] || 'unpaid';
    const next = prev === 'paid' ? 'unpaid' : 'paid';

    paidHistory[key] = next;
    setPayStatus(detailCustId, monthVal, next);
    openBillDetail(detailCustId, monthVal);
    renderBilling();
    document.getElementById("bill-list-card").style.display = "none";
    document.getElementById("bill-detail").style.display = "block";

    // Update button appearance
    const btn = document.getElementById('mark-paid-btn');
    if (btn) {
      if (next === 'paid') {
        btn.className = 'px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1 transition-all bg-amber-500 hover:bg-amber-600 text-black';
        btn.innerHTML = '<i class="fa-solid fa-rotate-left text-xs"></i> <span>Mark unpaid</span>';
      } else {
        btn.className = 'px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1 transition-all bg-emerald-600 hover:bg-emerald-700';
        btn.innerHTML = '<i class="fa-solid fa-check text-xs"></i> <span>Mark paid</span>';
      }
    }
  }

  // ════════════════════════════════════════════
  // EDIT BILLING
  // ════════════════════════════════════════════
  function openEditForGroup(custId,monthVal){
    const first=getMonthShipments(monthVal).find(s=>s.custId===custId);
    if(!first){alert("No shipments to edit for this client this month");return;}
    openEditSingle(first.tracking);
  }

  function openEditSingle(tracking){
    const s=shipments.find(x=>x.tracking===tracking);
    if(!s) return;
    editingTrackingNo=tracking;
    document.getElementById("edit-boxes").value =s.boxes||"";
    document.getElementById("edit-weight").value=s.weight||"";
    document.getElementById("edit-rate").value  =s.rate||"";
    updateEditCalc();
    document.getElementById("edit-modal").classList.add("open");
  }

  function updateEditCalc(){
    const wt  =parseFloat(document.getElementById("edit-weight").value)||0;
    const rate=parseFloat(document.getElementById("edit-rate").value)||0;
    const boxes=parseInt(document.getElementById("edit-boxes").value)||0;
    if(wt&&rate){
      document.getElementById("edit-calc-desc").textContent=`${boxes||"?"} boxes · ${wt} kg × ₹${rate}/kg`;
      document.getElementById("edit-calc-amt").textContent=inr(wt*rate);
    } else {
      document.getElementById("edit-calc-desc").textContent="—";
      document.getElementById("edit-calc-amt").textContent="—";
    }
  }

  const editBoxes = document.getElementById("edit-boxes");
  if(editBoxes) editBoxes.addEventListener("input", updateEditCalc);

  const editWeight = document.getElementById("edit-weight");
  if(editWeight) editWeight.addEventListener("input", updateEditCalc);

  const editRate = document.getElementById("edit-rate");
  if(editRate) editRate.addEventListener("input", updateEditCalc);

  function saveEditBilling(){
    if(!editingTrackingNo) return;
    const idx=shipments.findIndex(s=>s.tracking===editingTrackingNo);
    if(idx<0) return;
    const b=parseInt(document.getElementById("edit-boxes").value);
    const w=parseFloat(document.getElementById("edit-weight").value);
    const r=parseFloat(document.getElementById("edit-rate").value);
    if(b) shipments[idx].boxes=b;
    if(w) shipments[idx].weight=w;
    if(r) shipments[idx].rate=r;
    closeEditModal();
    renderBilling();
    const monthVal=document.getElementById("bill-month").value;
    if(detailCustId){openBillDetail(detailCustId,monthVal);document.getElementById("bill-list-card").style.display="none";document.getElementById("bill-detail").style.display="block";}
    alert("Billing entry updated");
  }

  function closeEditModal(){
    document.getElementById("edit-modal").classList.remove("open");
    editingTrackingNo=null;
  }

  // ════════════════════════════════════════════
  // FIX 2 + FIX 3: EXCEL EXPORT
  // custId = null → export ALL clients for the month
  // custId = "CUST-001" → export only that client
  // Columns: S/NO, DATE (dd.mm.yyyy), AWB NO, CONSIGNEE, DESTINATION, QTY, WEIGHT, AMOUNT
  // ════════════════════════════════════════════
  function exportRangeExcel(custId) {
    const from = document.getElementById("range-from").value;
    const to   = document.getElementById("range-to").value;
    if (!from || !to) { alert("Please select both start and end dates."); return; }

    let ms = shipments.filter(s => s.date && s.date >= from && s.date <= to);

    let clientName = "All Clients";
    if (custId) {
      ms = ms.filter(s => s.custId === custId);
      const c = clients.find(x => x.cust_id === custId);
      clientName = c ? c.name : custId;
    }

    if (!ms.length) { alert("No shipments found for that date range" + (custId ? " · " + clientName : "")); return; }

    const rows = ms.map((s, i) => ({
      "S/NO":        i + 1,
      "DATE":        fmtDate(s.date),
      "AWB NO":      s.tracking,
      "CONSIGNEE":   s.consignee || s.customer,
      "DESTINATION": s.destination,
      "QTY":         s.boxes || 0,
      "WEIGHT (KG)": s.weight || 0,
      "AMOUNT (₹)":  (s.weight || 0) * (s.rate || 0),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    ws["!cols"] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 16 },
      { wch: 28 },
      { wch: 20 },
      { wch: 8 },
      { wch: 14 },
      { wch: 16 },
    ];

    const border = { top: { style: 'thin', color: { rgb: '000000' } }, bottom: { style: 'thin', color: { rgb: '000000' } }, left: { style: 'thin', color: { rgb: '000000' } }, right: { style: 'thin', color: { rgb: '000000' } } };

    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
      if (cell) cell.s = { font: { bold: true }, alignment: { horizontal: 'center' }, border };
    }

    for (let R = 1; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        if (cell) cell.s = { alignment: { horizontal: [5,6,7].includes(C) ? 'right' : 'left' }, border };
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, custId ? clientName.substring(0, 28) : "Shipments");

    const fileName = `SLE_${from}_to_${to}${custId ? "_" + clientName.replace(/\s+/g, "_") : ""}.xlsx`;
    XLSX.writeFile(wb, fileName, { cellStyles: true });
  }
  
  function exportExcel(custId) {
    const monthVal = document.getElementById("bill-month").value;
    const label = monthLabel(monthVal);
    let ms = getMonthShipments(monthVal);
    let clientName = "All Clients";

    if (custId) {
      ms = ms.filter(s => s.custId === custId);
      const c = clients.find(x => x.cust_id === custId) || CUSTOMERS?.find(x => x.custId === custId);
      clientName = c ? (c.name || c.custId) : custId;
    }

    if (!ms.length) { alert("No shipments to export for " + label + (custId ? " · " + clientName : "")); return; }

    const rows = ms.map((s, i) => ({
      "S/NO":        i + 1,
      "DATE":        fmtDate(s.date),
      "AWB NO":      s.tracking,
      "CONSIGNEE":   s.consignee || s.customer,
      "DESTINATION": s.destination,
      "QTY":         s.boxes || 0,
      "WEIGHT (KG)": s.weight || 0,
      "AMOUNT (₹)":  (s.weight || 0) * (s.rate || 0),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Wider columns
    ws["!cols"] = [
      { wch: 6 },   // S/NO
      { wch: 14 },  // DATE
      { wch: 16 },  // AWB NO
      { wch: 28 },  // CONSIGNEE
      { wch: 20 },  // DESTINATION
      { wch: 8 },   // QTY
      { wch: 14 },  // WEIGHT
      { wch: 16 },  // AMOUNT
    ];

    const border = { top: { style: 'thin', color: { rgb: '000000' } }, bottom: { style: 'thin', color: { rgb: '000000' } }, left: { style: 'thin', color: { rgb: '000000' } }, right: { style: 'thin', color: { rgb: '000000' } } };

    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
      if (cell) cell.s = { font: { bold: true }, alignment: { horizontal: 'center' }, border };
    }

    for (let R = 1; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        if (cell) cell.s = { alignment: { horizontal: [5,6,7].includes(C) ? 'right' : 'left' }, border };
      }
    }

    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: false }] };
    const sheetName = custId ? clientName.substring(0, 28) : label;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const fileName = custId
      ? `SLE_Invoice_${clientName.replace(/\s+/g, "_")}_${label.replace(" ", "_")}.xlsx`
      : `SLE_Billing_All_${label.replace(" ", "_")}.xlsx`;

    XLSX.writeFile(wb, fileName, { cellStyles: true });
  }

  // ════════════════════════════════════════════
  // STATISTICS TAB — fancy version
  // ════════════════════════════════════════════
  const CLIENT_COLORS=[
    {border:"rgba(251,191,36,0.3)",bg:"rgba(251,191,36,0.06)",text:"#fbbf24",bar:"#fbbf24"},
    {border:"rgba(16,185,129,0.3)",bg:"rgba(16,185,129,0.06)",text:"#10b981",bar:"#10b981"},
    {border:"rgba(139,92,246,0.3)",bg:"rgba(139,92,246,0.06)",text:"#a78bfa",bar:"#a78bfa"},
    {border:"rgba(239,68,68,0.3)", bg:"rgba(239,68,68,0.06)", text:"#f87171",bar:"#f87171"},
    {border:"rgba(56,189,248,0.3)",bg:"rgba(56,189,248,0.06)",text:"#38bdf8",bar:"#38bdf8"},
  ];

  function renderStatistics(){
    // ── totals ──
    const allTimeTotal=shipments.reduce((a,s)=>a+(s.weight||0)*(s.rate||0),0);
    const allTimeBoxes=shipments.reduce((a,s)=>a+(s.boxes||0),0);
    const allTimeKg   =shipments.reduce((a,s)=>a+(s.weight||0),0);

    animateCounter("stats-all-time", allTimeTotal, true);
    document.getElementById("stats-shipcount").textContent=shipments.length.toLocaleString();
    document.getElementById("stats-boxcount").textContent =allTimeBoxes.toLocaleString();
    document.getElementById("stats-kgcount").textContent  =allTimeKg.toLocaleString();

    // ── group by month ──
    const monthMap={};
    shipments.forEach(s=>{
      if(!s.date) return;
      const key=s.date.substring(0,7);
      if(!monthMap[key]) monthMap[key]={total:0,count:0,boxes:0,kg:0};
      monthMap[key].total +=(s.weight||0)*(s.rate||0);
      monthMap[key].count ++;
      monthMap[key].boxes +=(s.boxes||0);
      monthMap[key].kg    +=(s.weight||0);
    });

    const sortedMonths=Object.keys(monthMap).sort((a,b)=>b.localeCompare(a));
    const maxMonthTotal=Math.max(...Object.values(monthMap).map(d=>d.total),1);

    // best month
    if(sortedMonths.length){
      const bestKey=Object.keys(monthMap).reduce((a,b)=>monthMap[b].total>monthMap[a].total?b:a);
      document.getElementById("stats-best-amt").textContent  =inr(monthMap[bestKey].total);
      document.getElementById("stats-best-month").textContent=monthLabel(bestKey);
    }

    let monthHTML="";
    sortedMonths.forEach((m,idx)=>{
      const d=monthMap[m];
      const pct=allTimeTotal>0?Math.round(d.total/allTimeTotal*100):0;
      const barW=Math.round(d.total/maxMonthTotal*100);
      const isBest=d.total===maxMonthTotal;
      monthHTML+=`
        <div style="background:${isBest?"rgba(251,191,36,0.05)":"#0d0d0d"};border:1px solid ${isBest?"rgba(251,191,36,0.2)":"rgba(255,255,255,0.05)"};border-radius:14px;padding:1rem 1.25rem;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
            <div>
              <div style="font-size:14px;font-weight:500;color:${isBest?"#fbbf24":"#d4d4d8"};display:flex;align-items:center;gap:6px;">
                ${monthLabel(m)}${isBest?`<span style="font-size:9px;background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.3);border-radius:9999px;padding:1px 7px;font-weight:600;letter-spacing:0.04em;">BEST</span>`:""}
              </div>
              <div style="font-size:11px;color:#52525b;margin-top:3px;">${d.count} shipments · ${d.boxes} boxes · ${d.kg.toLocaleString()} kg</div>
            </div>
            <div style="text-align:right;">
              <div style="font-family:'Playfair Display',serif;font-size:20px;color:#fbbf24;">${inr(d.total)}</div>
              <div style="font-size:10px;color:#3f3f46;margin-top:2px;">${pct}% of all-time</div>
            </div>
          </div>
          <div style="height:4px;background:rgba(255,255,255,0.05);border-radius:9999px;overflow:hidden;">
            <div style="height:100%;width:0%;background:${isBest?"#fbbf24":"#52525b"};border-radius:9999px;transition:width 0.8s cubic-bezier(.4,0,.2,1);transition-delay:${idx*60}ms;" data-bar="${barW}"></div>
          </div>
        </div>`;
    });
    document.getElementById("stats-month-rows").innerHTML=monthHTML||`<p style="color:#52525b;font-size:13px;padding:1rem 0;">No data yet.</p>`;

    // animate bars after paint
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      document.querySelectorAll("#stats-month-rows [data-bar]").forEach(el=>{
        el.style.width=el.dataset.bar+"%";
      });
    }));

    // ── per-client ──
    const clientMap={};
    shipments.forEach(s=>{
      const key=s.custId||s.customer||"Unknown";
      if(!clientMap[key]) clientMap[key]={name:s.customer,custId:s.custId||"—",total:0,count:0,kg:0,boxes:0};
      clientMap[key].total +=(s.weight||0)*(s.rate||0);
      clientMap[key].count ++;
      clientMap[key].kg    +=(s.weight||0);
      clientMap[key].boxes +=(s.boxes||0);
    });

    const sortedClients=Object.values(clientMap).sort((a,b)=>b.total-a.total);
    const maxClientTotal=Math.max(...sortedClients.map(c=>c.total),1);

    // top client
    if(sortedClients.length){
      const top=sortedClients[0];
      document.getElementById("stats-top-client").textContent    =top.name;
      document.getElementById("stats-top-client-amt").textContent=inr(top.total)+" billed";
    }

    let clientHTML="";
    sortedClients.forEach((c,i)=>{
      const col=CLIENT_COLORS[i%CLIENT_COLORS.length];
      const barW=Math.round(c.total/maxClientTotal*100);
      const share=allTimeTotal>0?Math.round(c.total/allTimeTotal*100):0;
      const initials=(c.name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
      clientHTML+=`
        <div style="background:${col.bg};border:1px solid ${col.border};border-radius:16px;padding:1.1rem 1.25rem;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
            <div style="width:36px;height:36px;border-radius:50%;background:${col.border};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${col.text};flex-shrink:0;">${initials}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:14px;font-weight:600;color:#e4e4e7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sanitizeInput(c.name)}</div>
              <div style="font-size:10px;color:#52525b;margin-top:1px;">${sanitizeInput(c.custId)} · ${c.count} shipments · ${c.boxes} boxes · ${c.kg.toLocaleString()} kg</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-family:'Playfair Display',serif;font-size:20px;color:${col.text};">${inr(c.total)}</div>
              <div style="font-size:10px;color:#3f3f46;margin-top:2px;">${share}% of total</div>
            </div>
          </div>
          <div style="height:3px;background:rgba(255,255,255,0.04);border-radius:9999px;overflow:hidden;">
            <div style="height:100%;width:0%;background:${col.bar};border-radius:9999px;transition:width 0.9s cubic-bezier(.4,0,.2,1);transition-delay:${i*80}ms;" data-cbar="${barW}"></div>
          </div>
        </div>`;
    });
    document.getElementById("stats-client-cards").innerHTML=clientHTML||`<p style="color:#52525b;font-size:13px;padding:1rem 0;">No data yet.</p>`;

    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      document.querySelectorAll("#stats-client-cards [data-cbar]").forEach(el=>{
        el.style.width=el.dataset.cbar+"%";
      });
    }));
  }

  function animateCounter(id, target, isCurrency){
    const el=document.getElementById(id);
    if(!el) return;
    const duration=900;
    const start=performance.now();
    function step(now){
      const progress=Math.min((now-start)/duration,1);
      const ease=1-Math.pow(1-progress,3);
      const val=Math.round(target*ease);
      el.textContent=isCurrency?inr(val):val.toLocaleString();
      if(progress<1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function injectRippleButtons() {
    const adminPanel = document.getElementById('admin-panel');
    if (!adminPanel) return;

    const skipClasses = ['icon-action', 'text-amber-400', 'text-zinc-400', 'text-zinc-500', 'text-emerald-400', 'text-red-400', 'parent-tab', 'sub-tab', 'login-fab-btn', 'logout-fab-btn'];
    const skipText = ['×', '←', 'Undo', 'Forgot Password', 'Back to Login'];

    const buttons = adminPanel.querySelectorAll('button');

    buttons.forEach(btn => {
      if (btn.classList.contains('ripple-btn')) return;

      const cls = btn.className || '';
      if (skipClasses.some(c => cls.includes(c))) return;
      const txt = btn.textContent.trim();
      if (skipText.some(t => txt.includes(t))) return;
      if (txt.length < 2) return; // icon-only (×, ←)

      const label = document.createElement('span');
      label.className = 'rpl-label';
      label.innerHTML = btn.innerHTML;
      btn.innerHTML = '';

      for (let i = 0; i < 5; i++) {
        const s = document.createElement('span');
        s.className = 'rpl';
        btn.appendChild(s);
      }

      btn.appendChild(label);
      btn.classList.add('ripple-btn');
    });
  }

  // ── TRACK SHIPMENT──
  (function() {
    const trackSubmit = document.getElementById('trackSubmitBtn');
    const awbInput     = document.getElementById('awbInput');
    const trResultPage = document.getElementById('trackingResultPage');
    const trContent    = document.getElementById('trackingResultContent');
    const trClose      = document.getElementById('trackingResultClose');
    if (!trackSubmit) return;

    trackSubmit.addEventListener('click', performTracking);
    awbInput.addEventListener('keydown', e => { if (e.key === 'Enter') performTracking(); });

    if (trClose) trClose.addEventListener('click', () => trResultPage.classList.remove('open'));
    if (trResultPage) trResultPage.addEventListener('click', e => {
      if (e.target === trResultPage) trResultPage.classList.remove('open');
    });

    async function performTracking() {
      const input = sanitizeInput(awbInput.value).trim().toUpperCase();
      if (!input) { alert('Please enter an AWB or tracking number.'); return; }

      document.getElementById('trackModal').classList.remove('open');
      trContent.innerHTML = `
        <div class="earth-loader-wrap">
          <div class="earth-loader">
            <svg viewBox="0 0 200 200"><path transform="translate(100 100)" d="M29.4,-17.4C33.1,1.8,27.6,16.1,11.5,31.6C-4.7,47,-31.5,63.6,-43,56C-54.5,48.4,-50.7,16.6,-41,-10.9C-31.3,-38.4,-15.6,-61.5,-1.4,-61C12.8,-60.5,25.7,-36.5,29.4,-17.4Z" fill="var(--landcolor)"></path></svg>
            <svg viewBox="0 0 200 200"><path transform="translate(100 100)" d="M31.7,-55.8C40.3,-50,45.9,-39.9,49.7,-29.8C53.5,-19.8,55.5,-9.9,53.1,-1.4C50.6,7.1,43.6,14.1,41.8,27.6C40.1,41.1,43.4,61.1,37.3,67C31.2,72.9,15.6,64.8,1.5,62.2C-12.5,59.5,-25,62.3,-31.8,56.7C-38.5,51.1,-39.4,37.2,-49.3,26.3C-59.1,15.5,-78,7.7,-77.6,0.2C-77.2,-7.2,-57.4,-14.5,-49.3,-28.4C-41.2,-42.4,-44.7,-63,-38.5,-70.1C-32.2,-77.2,-16.1,-70.8,-2.3,-66.9C11.6,-63,23.1,-61.5,31.7,-55.8Z" fill="var(--landcolor)"></path></svg>
            <svg viewBox="0 0 200 200"><path transform="translate(100 100)" d="M30.6,-49.2C42.5,-46.1,57.1,-43.7,67.6,-35.7C78.1,-27.6,84.6,-13.8,80.3,-2.4C76.1,8.9,61.2,17.8,52.5,29.1C43.8,40.3,41.4,53.9,33.7,64C26,74.1,13,80.6,2.2,76.9C-8.6,73.1,-17.3,59,-30.6,52.1C-43.9,45.3,-61.9,45.7,-74.1,38.2C-86.4,30.7,-92.9,15.4,-88.6,2.5C-84.4,-10.5,-69.4,-20.9,-60.7,-34.6C-52.1,-48.3,-49.8,-65.3,-40.7,-70C-31.6,-74.8,-15.8,-67.4,-3.2,-61.8C9.3,-56.1,18.6,-52.3,30.6,-49.2Z" fill="var(--landcolor)"></path></svg>
            <svg viewBox="0 0 200 200"><path transform="translate(100 100)" d="M39.4,-66C48.6,-62.9,51.9,-47.4,52.9,-34.3C53.8,-21.3,52.4,-10.6,54.4,1.1C56.3,12.9,61.7,25.8,57.5,33.2C53.2,40.5,39.3,42.3,28.2,46C17,49.6,8.5,55.1,1.3,52.8C-5.9,50.5,-11.7,40.5,-23.6,37.2C-35.4,34,-53.3,37.5,-62,32.4C-70.7,27.4,-70.4,13.7,-72.4,-1.1C-74.3,-15.9,-78.6,-31.9,-73.3,-43C-68.1,-54.2,-53.3,-60.5,-39.5,-60.9C-25.7,-61.4,-12.9,-56,1.1,-58C15.1,-59.9,30.2,-69.2,39.4,-66Z" fill="var(--landcolor)"></path></svg>
          </div>
          <p>Searching...</p>
          <div class="loader-marquee"><span>This loading screen is not fake &nbsp;&nbsp;•&nbsp;&nbsp; This loading screen is not fake &nbsp;&nbsp;•&nbsp;&nbsp;</span></div>
        </div>
      `;
      trResultPage.classList.add('open');

      const { data, error } = await db.from('shipments').select('*').eq('tracking', input).single();

      if (data && !error) {
        renderTrackResult(data);
      } else {
        renderTrackError();
      }
    }

    function statusInfo(shipment) {
      const latestHistory = shipment.history && shipment.history.length
        ? shipment.history[shipment.history.length - 1]
        : null;
      const rawStatus = latestHistory ? latestHistory.status : shipment.status;
      let statusText, statusClass = 'tr-pending';

      if (rawStatus.startsWith('Note: ')) {
        statusText = rawStatus.replace('Note: ', '');
        statusClass = 'tr-note';
      } else {
        statusText = `Your Shipment is ${rawStatus}`;
        if (rawStatus === 'Delivered') statusClass = 'tr-delivered';
        else if (rawStatus === 'Out for Delivery') statusClass = 'tr-outfordelivery';
        else if (rawStatus === 'In Transit') statusClass = 'tr-intransit';
      }

      return { statusText, statusClass };
    }

    function renderTrackResult(shipment) {
      const { statusText, statusClass } = statusInfo(shipment);

      trContent.innerHTML = `
        <p class="tr-status ${statusClass}">${sanitizeInput(statusText)}</p>
        ${buildBasicDetailsHTML(shipment)}
        <div class="tr-btn-row">
          <button class="tr-btn tr-btn-primary" id="trViewDetailsBtn">View Details</button>
          ${shipment.pod_url ? `<button class="tr-btn tr-btn-secondary" id="trViewPodBtn">View POD</button>` : ''}
        </div>
        <div class="tr-timeline-panel" id="trTimelinePanel" style="display:none;"></div>
      `;

      const detailsBtn    = document.getElementById('trViewDetailsBtn');
      const podBtn        = document.getElementById('trViewPodBtn');
      const timelinePanel = document.getElementById('trTimelinePanel');

      detailsBtn.addEventListener('click', () => {
        const isOpen = timelinePanel.style.display === 'block';
        if (isOpen) {
          timelinePanel.style.display = 'none';
          detailsBtn.textContent = 'View Details';
        } else {
          timelinePanel.style.display = 'block';
          timelinePanel.innerHTML = buildTimelineHTML(shipment);
          detailsBtn.textContent = 'Close Details';
        }
      });

      if (podBtn) podBtn.addEventListener('click', () => showPodModalByUrl(shipment.pod_url));
    }

    function buildBasicDetailsHTML(shipment) {
      return `
        <div class="track-details">
          <p><strong>Tracking:</strong> ${sanitizeInput(shipment.tracking)}</p>
          <p><strong>Route:</strong> ${sanitizeInput(shipment.origin)} → ${sanitizeInput(shipment.destination)}</p>
          <p><strong>Date:</strong> ${shipment.date || 'N/A'}</p>
          <p><strong>Location:</strong> ${sanitizeInput(shipment.location) || 'N/A'}</p>
          ${shipment.consignee ? `<p><strong>Consignee:</strong> ${sanitizeInput(shipment.consignee)}</p>` : ''}
        </div>
      `;
    }

    function buildTimelineHTML(shipment) {
      const history = shipment.history || [];
      if (!history.length) return '';
      return `
        <div class="track-timeline">
          <p class="track-timeline-label">Shipment Timeline</p>
          ${[...history].reverse().map((h, i) => `
            <div class="track-timeline-row">
              <div class="track-timeline-dotcol">
                <span class="track-timeline-dot ${i === 0 ? 'is-latest' : ''}"></span>
                ${i < history.length - 1 ? '<span class="track-timeline-line"></span>' : ''}
              </div>
              <div>
                <p class="track-timeline-status ${i === 0 ? 'is-latest' : ''}">${sanitizeInput(h.status)}</p>
                <p class="track-timeline-meta">${h.date || ''}${h.location ? ' 📍 ' + sanitizeInput(h.location) : ''}</p>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    function renderTrackError() {
      trContent.innerHTML = `
        <div class="tr-error">
          <canvas id="fuzzy-404-canvas"></canvas>
          <canvas id="fuzzy-notfound-canvas"></canvas>
          <p class="tr-error-msg">This shipment doesn't exist. Please double-check the tracking number.</p>
          <button class="tr-back-link" onclick="document.getElementById('trackingResultPage').classList.remove('open')">&larr; Back to site</button>
        </div>
      `;

      initFuzzyText(document.getElementById('fuzzy-404-canvas'), '404', {
        fontSize: 'clamp(6rem, 25vw, 16rem)', fontWeight: 900, fontFamily: 'Playfair Display, serif',
        color: '#EAB308', baseIntensity: 0.18, hoverIntensity: 0.5, fuzzRange: 30, fps: 60,
        enableHover: true, clickEffect: true, glitchMode: true, glitchInterval: 2000, glitchDuration: 200,
      });
      initFuzzyText(document.getElementById('fuzzy-notfound-canvas'), 'not found', {
        fontSize: 'clamp(1.5rem, 6vw, 3rem)', fontWeight: 500, fontFamily: 'Inter, sans-serif',
        color: 'rgba(244,235,208,0.7)', baseIntensity: 0.12, hoverIntensity: 0.4, fuzzRange: 20, fps: 60,
        enableHover: true, clickEffect: false, glitchMode: true, glitchInterval: 3000, glitchDuration: 150,
      });
    }
  })();

  // ── Haptic feedback on tap
  document.addEventListener('click', (e) => {
    const target = e.target.closest('button, .cta-btn, .rail-btn, .modal-choice-card, .tr-btn');
    if (target && navigator.vibrate) {
      navigator.vibrate(10);
    }
  });

  // ── Gyroscope tilt/parallax on hero globe ──
  (function() {
    const canvas = document.getElementById('globe-canvas'); 
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let tiltX = 0, tiltY = 0;

    function applyTilt(gamma, beta) {
      // gamma: left-right tilt (-90 to 90), beta: front-back tilt (-180 to 180)
      tiltX = Math.max(-1, Math.min(1, gamma / 30));
      tiltY = Math.max(-1, Math.min(1, (beta - 45) / 30)); 
      window.heroTiltX = tiltX;
      window.heroTiltY = tiltY;
    }

    function startListening() {
      window.addEventListener('deviceorientation', (e) => {
        applyTilt(e.gamma || 0, e.beta || 0);
      });
    }

    const needsPermission = typeof DeviceOrientationEvent !== 'undefined'
      && typeof DeviceOrientationEvent.requestPermission === 'function';

    if (!needsPermission) {
      startListening();
      return;
    }

    const prompt = document.createElement('button');
    prompt.textContent = 'Tap to enable tilt effect';
    prompt.className = 'tilt-permission-btn';
    document.body.appendChild(prompt);

    prompt.addEventListener('click', async () => {
      try {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result === 'granted') {
          startListening();
        }
      } catch (err) {
        console.warn('Motion permission denied or unavailable:', err);
      }
      prompt.remove();
    });
  })();

  function positionTabUnderline(buttons, underline) {
    if (!underline || !buttons.length) return;
    const parent = buttons[0].parentElement;
    const activeBtn = Array.from(buttons).find(b => b.classList.contains('active')) || buttons[0];
    const parentRect = parent.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    const barWidth = 22; // fixed small width, not the full button
    const btnCenter = (btnRect.left - parentRect.left) + (btnRect.width / 2);
    underline.style.left = (btnCenter - barWidth / 2) + 'px';
    underline.style.width = barWidth + 'px';
  }

  function updateParentUnderline() {
    positionTabUnderline(document.querySelectorAll('.parent-tab'), document.getElementById('parentTabUnderline'));
  }
  function updateSubUnderline() {
    positionTabUnderline(document.querySelectorAll('.sub-tab'), document.getElementById('subTabUnderline'));
  }

  function restyleTabPills() {
    document.querySelectorAll('.parent-tab, .sub-tab').forEach(btn => {
      btn.classList.remove('bg-amber-500', 'rounded-2xl');
      const isActive = btn.classList.contains('active');
      btn.style.setProperty('background', 'transparent', 'important');
      btn.style.setProperty('border-radius', '9999px', 'important');
      btn.style.setProperty('color', isActive ? '#f4ebd0' : 'rgba(244,235,208,0.5)', 'important');
      btn.style.setProperty('font-weight', '600', 'important');
      btn.style.setProperty('outline', 'none', 'important');
      btn.style.setProperty('box-shadow', 'none', 'important');
      btn.style.setProperty('border', 'none', 'important');
    });

    const parentRow = document.getElementById('parent0')?.parentElement;
    if (parentRow) {
      parentRow.style.setProperty('display', 'flex', 'important');
      parentRow.style.setProperty('width', 'fit-content', 'important');
      parentRow.style.setProperty('margin-left', 'auto', 'important');
      parentRow.style.setProperty('margin-right', 'auto', 'important');
      parentRow.style.setProperty('background', '#0d0d0f', 'important');
      parentRow.style.setProperty('border-radius', '9999px', 'important');
      parentRow.style.setProperty('padding', '6px', 'important');
      parentRow.style.setProperty('gap', '4px', 'important');
      parentRow.style.setProperty('position', 'relative', 'important');
      parentRow.style.setProperty('box-shadow', 'inset 2px 5px 10px rgba(5,5,5,0.6)', 'important');    }

    const subRow = document.getElementById('subtab0')?.parentElement;
    if (subRow) {
      subRow.style.setProperty('display', 'flex', 'important');
      subRow.style.setProperty('width', 'fit-content', 'important');
      subRow.style.setProperty('margin-left', '0', 'important');
      subRow.style.setProperty('margin-right', 'auto', 'important');
      subRow.style.setProperty('background', '#0d0d0f', 'important');
      subRow.style.setProperty('border-radius', '9999px', 'important');
      subRow.style.setProperty('padding', '6px', 'important');
      subRow.style.setProperty('gap', '4px', 'important');
      subRow.style.setProperty('position', 'relative', 'important');
      subRow.style.setProperty('box-shadow', 'inset 2px 5px 10px rgba(5,5,5,0.6)', 'important');    }
  }

  document.getElementById('shipments-body').addEventListener('mouseover', (e) => {
    const btn = e.target.closest('.action-edit-btn, .action-pod-btn, .action-delete-btn');
    if (!btn) return;
    const group = btn.closest('.row-action-group');
    if (!group) return;
    group.querySelectorAll('.action-edit-btn, .action-pod-btn, .action-delete-btn').forEach(sib => {
      if (sib !== btn) sib.classList.add('action-squeeze');
    });
  });
  document.getElementById('shipments-body').addEventListener('mouseout', (e) => {
    const group = e.target.closest('.row-action-group');
    if (!group || group.contains(e.relatedTarget)) return;
    group.querySelectorAll('.action-edit-btn, .action-pod-btn, .action-delete-btn').forEach(sib => {
      sib.classList.remove('action-squeeze');
    });
  });
