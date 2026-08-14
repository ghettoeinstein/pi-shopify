const LOFTS = document.querySelectorAll('[data-pi-loft]');

async function initLoft(root) {
  if (root.dataset.ready) return;
  root.dataset.ready = 'loading';
  const canvas = root.querySelector('[data-pi-canvas]');
  const loader = root.querySelector('[data-pi-loader]');
  const loadbar = root.querySelector('[data-pi-loadbar]');
  const products = [...root.querySelectorAll('[data-pi-product]')].map((node) => ({ ...node.dataset }));

  try {
    const THREE = await import(root.dataset.threeUrl);
    if (!window.WebGLRenderingContext) throw new Error('WebGL unavailable');
    loadbar.style.width = '22%';

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = !matchMedia('(max-width:749px)').matches;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(max-width:749px)').matches ? 1.35 : 1.8));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x171715);
    scene.fog = new THREE.FogExp2(0x24221f, 0.014);
    const camera = new THREE.PerspectiveCamera(47, 1, 0.1, 120);
    const clock = new THREE.Clock();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(9, 9);
    const interactive = [];
    let hovered = null;
    let selected = null;
    let drag = false;
    let dragged = false;
    let downX = 0;
    let downY = 0;
    let lastX = 0;
    let lastY = 0;
    let zoneIndex = 0;
    let holdTimer;

    const zones = [
      { id: 'entry', pos: [0, 5.2, 21], look: [0, 3.4, -5] },
      { id: 'lounge', pos: [-10, 4.8, 7], look: [-3, 2.2, -3] },
      { id: 'rack', pos: [8.8, 4.4, 4], look: [8.5, 2.7, -7] },
      { id: 'window', pos: [8.5, 5.2, -13], look: [-3, 3.1, -15] }
    ];
    const cameraState = { x: 0, y: 5.2, z: 21, lx: 0, ly: 3.4, lz: -5, yaw: 0, pitch: 0 };

    const material = (color, roughness = 0.75, metalness = 0.05) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const mats = {
      wall: material(0x5c554b, 0.98), dark: material(0x171717, 0.72, 0.35), steel: material(0x5d5e5c, 0.32, 0.82),
      chrome: material(0xa6aaa7, 0.18, 0.92), sofa: material(0x762b25, 0.96), cream: material(0xd6cbbb, 0.9), wood: material(0x3a2018, 0.78), acid: material(0xd9ff00, 0.45)
    };
    function box(name, size, position, mat, parent = scene) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
      mesh.name = name;
      mesh.position.set(...position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }
    function cylinder(name, radius, height, position, mat, parent = scene) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16), mat);
      mesh.name = name; mesh.position.set(...position); mesh.castShadow = true; parent.add(mesh); return mesh;
    }

    function stoneTexture() {
      const c = document.createElement('canvas'); c.width = c.height = 1024;
      const x = c.getContext('2d'); x.fillStyle = '#77736c'; x.fillRect(0, 0, 1024, 1024);
      for (let i = 0; i < 24000; i++) { const v = 80 + Math.random() * 60; x.fillStyle = `rgba(${v},${v - 3},${v - 8},${Math.random() * .08})`; x.fillRect(Math.random() * 1024, Math.random() * 1024, Math.random() * 7 + 1, Math.random() * 7 + 1); }
      x.strokeStyle = 'rgba(32,30,27,.62)'; x.lineWidth = 7;
      for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 256, 0); x.lineTo(i * 256, 1024); x.stroke(); x.beginPath(); x.moveTo(0, i * 256); x.lineTo(1024, i * 256); x.stroke(); }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3.5, 5); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
    }

    const floorMat = new THREE.MeshStandardMaterial({ map: stoneTexture(), color: 0x9b958a, roughness: .87, metalness: .03 });
    box('stone floor', [34, .35, 48], [0, -.2, -2], floorMat);
    box('left brick wall', [.6, 13, 48], [-17, 6.3, -2], mats.wall);
    box('rear wall', [34, 13, .6], [0, 6.3, -26], mats.wall);
    box('ceiling', [34, .45, 48], [0, 12.7, -2], mats.dark);

    for (let z = 19; z >= -22; z -= 8.2) {
      box('ceiling beam', [34, .45, .52], [0, 11.8, z], mats.dark);
      box('column', [.55, 12, .55], [-16, 5.8, z], mats.steel);
      box('column', [.55, 12, .55], [16, 5.8, z], mats.steel);
    }
    for (let i = 0; i < 5; i++) {
      const z = 13 - i * 8;
      box('window glass', [.18, 7.8, 6.4], [16.25, 6.7, z], new THREE.MeshPhysicalMaterial({ color: 0x7693a0, transmission: .32, transparent: true, opacity: .58, roughness: .24, metalness: .1 }));
      box('window mullion', [.3, 8.2, .18], [16.12, 6.7, z - 3.25], mats.dark);
      box('window mullion', [.3, 8.2, .18], [16.12, 6.7, z + 3.25], mats.dark);
      box('window mullion', [.3, .18, 6.6], [16.12, 6.7, z], mats.dark);
    }

    const city = new THREE.Group(); city.position.set(18, 0, -2); scene.add(city);
    for (let i = 0; i < 26; i++) {
      const h = 4 + Math.random() * 14; const b = box('city', [2 + Math.random() * 4, h, 2 + Math.random() * 5], [3 + Math.random() * 20, h / 2, -25 + Math.random() * 50], material(0x191c1e, .9), city); b.castShadow = false;
    }

    const lounge = new THREE.Group(); lounge.position.set(-4.5, 0, -4); scene.add(lounge);
    box('rug', [12, .08, 9], [0, .05, 0], material(0x2d2a23, 1), lounge);
    box('sofa base', [8, 1.1, 3.2], [-1, .75, -1], mats.sofa, lounge);
    box('sofa back', [8, 2.5, .75], [-1, 2.1, -2.25], mats.sofa, lounge).rotation.x = -.12;
    box('chaise', [3, 1.05, 6], [-4.1, .72, .35], mats.sofa, lounge);
    for (let i = 0; i < 3; i++) box('sofa cushion', [2.25, .32, 2.35], [-3.2 + i * 2.35, 1.42, -1], i === 1 ? mats.cream : mats.sofa, lounge);
    cylinder('coffee table', 2.15, .22, [2.2, 1, 1.3], mats.chrome, lounge).rotation.z = Math.PI / 2;
    cylinder('table leg', .18, 1.8, [2.2, .5, 1.3], mats.steel, lounge);
    box('art plinth', [2.7, 3.2, 2.7], [-8.5, 1.6, -5.5], mats.cream, lounge);
    const sculpture = new THREE.Mesh(new THREE.TorusKnotGeometry(.8, .22, 80, 10), mats.acid); sculpture.position.set(-8.5, 4, -5.5); sculpture.castShadow = true; lounge.add(sculpture);
    box('speaker left', [1.5, 4.5, 1.4], [4.8, 2.25, -3.2], mats.dark, lounge);

    function buildRack(x, z, rotation, rackProducts, startIndex) {
      const rack = new THREE.Group(); rack.position.set(x, 0, z); rack.rotation.y = rotation; scene.add(rack);
      [-4.6, 4.6].forEach((px) => { cylinder('rack upright', .095, 6.2, [px, 3.1, 0], mats.chrome, rack); cylinder('rack foot', .1, 2.4, [px, .12, 0], mats.chrome, rack).rotation.z = Math.PI / 2; });
      cylinder('rack rail', .11, 9.2, [0, 6, 0], mats.chrome, rack).rotation.z = Math.PI / 2;
      rackProducts.forEach((product, i) => {
        const group = new THREE.Group(); group.position.set((i - (rackProducts.length - 1) / 2) * 2.1, 3.85, 0); group.userData = { product, index: startIndex + i };
        const hanger = new THREE.Mesh(new THREE.TorusGeometry(.58, .035, 8, 24, Math.PI), mats.chrome); hanger.rotation.z = Math.PI; hanger.position.y = 1.9; group.add(hanger);
        const garmentMat = new THREE.MeshStandardMaterial({ color: [0xede8dd, 0x211e1c, 0x8f2630, 0xb8a58b, 0x44484b][(startIndex + i) % 5], roughness: .82, side: THREE.DoubleSide });
        const garment = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 3.5), garmentMat); garment.position.y = -.1; garment.castShadow = true; garment.userData = group.userData; group.add(garment); interactive.push(garment);
        if (product.image) new THREE.TextureLoader().load(product.image, (texture) => { texture.colorSpace = THREE.SRGBColorSpace; garmentMat.map = texture; garmentMat.color.set(0xffffff); garmentMat.needsUpdate = true; }, undefined, () => {});
        rack.add(group);
      });
    }
    const midpoint = Math.ceil(products.length / 2);
    buildRack(8.5, -5, 0, products.slice(0, midpoint), 0);
    buildRack(-4, -17.5, Math.PI / 2, products.slice(midpoint), midpoint);

    const hemi = new THREE.HemisphereLight(0xbcd7e5, 0x4a3426, 1.1); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffead2, 3.2); sun.position.set(14, 15, 4); sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536); sun.shadow.camera.left = -24; sun.shadow.camera.right = 24; sun.shadow.camera.top = 24; sun.shadow.camera.bottom = -24; scene.add(sun);
    const red = new THREE.PointLight(0xcf1832, 38, 16, 2); red.position.set(-12, 3, 8); scene.add(red);
    const rackLight = new THREE.SpotLight(0xfff1d2, 45, 24, .55, .6, 1.5); rackLight.position.set(7, 10, 1); rackLight.target.position.set(8, 1, -6); scene.add(rackLight, rackLight.target);

    const panel = root.querySelector('[data-pi-panel]');
    const title = root.querySelector('[data-pi-product-title]');
    const price = root.querySelector('[data-pi-product-price]');
    const index = root.querySelector('[data-pi-product-index]');
    const status = root.querySelector('[data-pi-product-status]');
    const add = root.querySelector('[data-pi-add]');
    const details = root.querySelector('[data-pi-details]');

    function inspect(mesh) {
      if (!mesh?.userData.product) return;
      selected = mesh;
      const p = mesh.userData.product;
      title.textContent = p.title;
      price.textContent = p.price;
      index.textContent = `OBJECT ${String(mesh.userData.index + 1).padStart(2, '0')}`;
      status.textContent = p.available === 'true' ? 'AVAILABLE / READY TO SHIP' : 'CURRENTLY UNAVAILABLE';
      add.disabled = p.available !== 'true';
      add.textContent = p.available === 'true' ? 'ADD TO BAG' : 'SOLD OUT';
      details.href = p.url;
      panel.classList.add('is-visible');
      if (window.gsap) window.gsap.to(mesh.parent.scale, { x: 1.08, y: 1.08, z: 1.08, duration: .35, ease: 'power2.out' });
    }
    root.querySelector('[data-pi-close]').addEventListener('click', () => { panel.classList.remove('is-visible'); if (selected && window.gsap) window.gsap.to(selected.parent.scale, { x: 1, y: 1, z: 1, duration: .25 }); selected = null; });
    add.addEventListener('click', async () => {
      if (!selected) return;
      add.disabled = true; add.textContent = 'ADDING…';
      try {
        const response = await fetch(`${window.Shopify?.routes?.root || '/'}cart/add.js`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ items: [{ id: Number(selected.userData.product.variantId), quantity: 1 }] }) });
        if (!response.ok) throw new Error('Cart request failed');
        add.textContent = 'IN THE BAG ✓'; status.textContent = 'ADDED / CONTINUE EXPLORING';
      } catch (error) { add.disabled = false; add.textContent = 'TRY AGAIN'; status.textContent = 'COULD NOT ADD — VIEW DETAILS'; }
    });

    function tweenZone(next) {
      zoneIndex = (next + zones.length) % zones.length;
      const z = zones[zoneIndex];
      root.querySelectorAll('[data-pi-zone]').forEach((button) => button.classList.toggle('is-active', button.dataset.piZone === z.id));
      const values = { x: z.pos[0], y: z.pos[1], z: z.pos[2], lx: z.look[0], ly: z.look[1], lz: z.look[2], yaw: 0, pitch: 0 };
      if (window.gsap) window.gsap.to(cameraState, { ...values, duration: 1.25, ease: 'power3.inOut' }); else Object.assign(cameraState, values);
    }
    root.querySelectorAll('[data-pi-zone]').forEach((button, i) => button.addEventListener('click', () => tweenZone(i)));
    let wheelLock = false;
    canvas.addEventListener('wheel', (event) => { event.preventDefault(); if (wheelLock) return; wheelLock = true; tweenZone(zoneIndex + (event.deltaY > 0 ? 1 : -1)); setTimeout(() => { wheelLock = false; }, 850); }, { passive: false });

    function setPointer(event) { const r = canvas.getBoundingClientRect(); pointer.x = ((event.clientX - r.left) / r.width) * 2 - 1; pointer.y = -((event.clientY - r.top) / r.height) * 2 + 1; }
    canvas.addEventListener('pointerdown', (event) => { drag = true; dragged = false; downX = lastX = event.clientX; downY = lastY = event.clientY; setPointer(event); canvas.setPointerCapture(event.pointerId); holdTimer = setTimeout(() => { if (!dragged && hovered) location.assign(hovered.userData.product.url); }, 650); });
    canvas.addEventListener('pointermove', (event) => {
      setPointer(event); if (!drag) return;
      const dx = event.clientX - lastX; const dy = event.clientY - lastY;
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 7) { dragged = true; clearTimeout(holdTimer); }
      cameraState.yaw = THREE.MathUtils.clamp(cameraState.yaw - dx * .0028, -.58, .58);
      cameraState.pitch = THREE.MathUtils.clamp(cameraState.pitch + dy * .0021, -.24, .25);
      lastX = event.clientX; lastY = event.clientY;
    });
    canvas.addEventListener('pointerup', () => { clearTimeout(holdTimer); if (!dragged && hovered) inspect(hovered); drag = false; });
    canvas.addEventListener('pointercancel', () => { clearTimeout(holdTimer); drag = false; });

    function resize() { const w = root.clientWidth; const h = root.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    new ResizeObserver(resize).observe(root); resize();
    camera.position.set(cameraState.x, cameraState.y, cameraState.z);
    loadbar.style.width = '100%';
    setTimeout(() => { root.classList.add('is-ready'); root.dataset.ready = 'true'; loader.setAttribute('aria-hidden', 'true'); }, 280);

    function render() {
      const time = clock.getElapsedTime();
      interactive.forEach((mesh, i) => { mesh.parent.rotation.y = Math.sin(time * .85 + i) * .025; });
      camera.position.set(cameraState.x, cameraState.y, cameraState.z);
      camera.lookAt(cameraState.lx + cameraState.yaw * 12, cameraState.ly - cameraState.pitch * 8, cameraState.lz);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(interactive, false)[0]?.object || null;
      if (hit !== hovered) {
        if (hovered?.material) { hovered.material.emissive?.setHex(0); hovered.material.emissiveIntensity = 0; }
        hovered = hit;
        if (hovered?.material) { hovered.material.emissive?.setHex(0xd9ff00); hovered.material.emissiveIntensity = .13; }
        root.classList.toggle('is-hovering', Boolean(hovered));
      }
      renderer.render(scene, camera);
      requestAnimationFrame(render);
    }
    render();
  } catch (error) {
    console.error('Phillipa Imani loft failed to initialize', error);
    root.dataset.ready = 'failed'; root.classList.add('has-failed'); loader.style.display = 'none';
  }
}

function startLofts() { LOFTS.forEach(initLoft); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startLofts); else startLofts();
document.addEventListener('shopify:section:load', (event) => event.target.querySelectorAll('[data-pi-loft]').forEach(initLoft));
