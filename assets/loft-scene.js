/**
 * Loft Interactive — isometric 3D room scene with shoppable hotspots.
 *
 * Progressive enhancement: the section always renders a real, accessible
 * product grid server-side (Liquid). This script only replaces that grid
 * with the 3D scene when the device can actually handle it — small
 * viewports and no-WebGL environments keep the plain grid.
 *
 * No build step: Three.js and GSAP load as ES modules straight from a CDN,
 * pinned to exact versions. Swap to a bundled/vendored copy later if you
 * want zero third-party runtime requests.
 */

const THREE_VERSION = "0.169.0";
const GSAP_VERSION = "3.12.5";

const MIN_VIEWPORT_WIDTH = 700;

// Where each named "spot" (set by merchants in the theme editor) sits in
// the room. Tune these to match whatever room model replaces the
// placeholder geometry below.
const SPOT_POSITIONS = {
  sofa: { x: -1.6, y: 0.55, z: 0.6 },
  shelf: { x: 2.1, y: 1.3, z: -1.2 },
  table: { x: 0, y: 0.45, z: 1.4 },
  rack: { x: 2.0, y: 0.9, z: 1.0 },
  plant: { x: -2.2, y: 0.7, z: -1.0 },
};

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
  } catch (e) {
    return false;
  }
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

async function loadLibs() {
  const [THREE, { OrbitControls }, gsapModule] = await Promise.all([
    import(/* @vite-ignore */ `https://unpkg.com/three@${THREE_VERSION}/build/three.module.js`),
    import(/* @vite-ignore */ `https://unpkg.com/three@${THREE_VERSION}/examples/jsm/controls/OrbitControls.js`),
    import(/* @vite-ignore */ `https://cdn.jsdelivr.net/npm/gsap@${GSAP_VERSION}/index.js`),
  ]);
  return { THREE, OrbitControls, gsap: gsapModule.gsap };
}

function buildRoom(THREE) {
  const group = new THREE.Group();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a1f1a, roughness: 0.95 })
  );
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1c1512, roughness: 1 });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), wallMat);
  backWall.position.set(0, 2, -3.5);
  group.add(backWall);

  const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(7, 4), wallMat);
  sideWall.rotation.y = Math.PI / 2;
  sideWall.position.set(-3.5, 2, 0);
  group.add(sideWall);

  // Placeholder furniture — swap each of these for real low-poly models
  // (glTF via GLTFLoader) once assets are ready. Positions intentionally
  // match SPOT_POSITIONS so hotspots read as "sitting on" something.
  const furniture = [
    { spot: "sofa", geo: new THREE.BoxGeometry(2, 0.7, 0.9), color: 0xd9603b },
    { spot: "shelf", geo: new THREE.BoxGeometry(0.9, 1.8, 0.35), color: 0x8a6a4f },
    { spot: "table", geo: new THREE.CylinderGeometry(0.5, 0.5, 0.4, 24), color: 0xc9a876 },
    { spot: "rack", geo: new THREE.BoxGeometry(0.15, 1.4, 0.9), color: 0x6b7280 },
    { spot: "plant", geo: new THREE.ConeGeometry(0.5, 1.1, 10), color: 0x4f7a3f },
  ];

  furniture.forEach(({ spot, geo, color }) => {
    const pos = SPOT_POSITIONS[spot];
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
    mesh.position.set(pos.x, pos.y / 2 + 0.02, pos.z);
    mesh.userData.spot = spot;
    group.add(mesh);
  });

  return group;
}

class LoftScene {
  constructor(root) {
    this.root = root;
    this.stage = root.querySelector("[data-loft-stage]");
    this.canvas = root.querySelector("[data-loft-canvas]");
    this.panel = root.querySelector("[data-loft-panel]");
    this.panelBody = root.querySelector("[data-loft-panel-body]");
    this.panelClose = root.querySelector("[data-loft-panel-close]");
    this.fallback = root.querySelector("[data-loft-fallback]");

    const dataEl = root.querySelector("[data-loft-hotspots]");
    this.hotspots = dataEl ? JSON.parse(dataEl.textContent || "[]") : [];

    this.markers = [];
  }

  shouldUse3D() {
    return supportsWebGL() && window.innerWidth >= MIN_VIEWPORT_WIDTH && this.hotspots.length > 0;
  }

  async init() {
    if (!this.shouldUse3D()) return; // fallback grid stays visible, nothing else to do

    const { THREE, OrbitControls, gsap } = await loadLibs();
    this.THREE = THREE;
    this.gsap = gsap;

    this.stage.removeAttribute("aria-hidden");
    this.fallback.hidden = true;

    const rect = this.stage.getBoundingClientRect();
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(rect.width, rect.height);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;

    const aspect = rect.width / rect.height;
    const frustum = 4.4;
    const camera = new THREE.OrthographicCamera(
      (-frustum * aspect) / 2, (frustum * aspect) / 2,
      frustum / 2, -frustum / 2,
      0.1, 50
    );
    camera.position.set(6, 5, 6);
    camera.lookAt(0, 0.6, 0);
    this.camera = camera;

    scene.add(new THREE.AmbientLight(0xffe3cc, 0.55));
    const key = new THREE.DirectionalLight(0xffb27a, 1.1);
    key.position.set(4, 6, 3);
    scene.add(key);
    const rim = new THREE.PointLight(0xff5a2e, 1.4, 10);
    rim.position.set(-2, 1.5, -1);
    scene.add(rim);

    scene.add(buildRoom(THREE));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minPolarAngle = Math.PI / 3.4;
    controls.maxPolarAngle = Math.PI / 2.3;
    controls.minAzimuthAngle = -0.6;
    controls.maxAzimuthAngle = 0.6;
    controls.target.set(0, 0.6, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    this.controls = controls;

    this.buildMarkers();
    this.bindEvents();

    if (!prefersReducedMotion()) {
      gsap.from(camera.position, { x: 9, z: 9, duration: 1.6, ease: "power3.out" });
    }

    this.animate();
  }

  buildMarkers() {
    this.hotspots.forEach((hotspot) => {
      const pos = SPOT_POSITIONS[hotspot.spot];
      if (!pos) return;

      const marker = document.createElement("button");
      marker.type = "button";
      marker.className = "loft__marker";
      marker.setAttribute("aria-label", `Shop ${hotspot.label}`);
      marker.innerHTML = `<span></span>`;
      marker.addEventListener("click", () => this.openPanel(hotspot));
      this.stage.appendChild(marker);

      this.markers.push({
        el: marker,
        worldPos: new this.THREE.Vector3(pos.x, pos.y + 0.35, pos.z),
      });
    });
  }

  updateMarkers() {
    const rect = this.stage.getBoundingClientRect();
    this.markers.forEach(({ el, worldPos }) => {
      const projected = worldPos.clone().project(this.camera);
      const x = (projected.x * 0.5 + 0.5) * rect.width;
      const y = (-projected.y * 0.5 + 0.5) * rect.height;
      el.style.transform = `translate(${x}px, ${y}px)`;
    });
  }

  openPanel(hotspot) {
    this.panelBody.innerHTML = `
      <img src="${hotspot.image || ""}" alt="" loading="lazy">
      <h3>${hotspot.title}</h3>
      <p class="loft__panel-price">${hotspot.price}</p>
      <button type="button" class="loft__add-to-cart" data-variant-id="${hotspot.variantId}" ${hotspot.available ? "" : "disabled"}>
        ${hotspot.available ? "Add to cart" : "Sold out"}
      </button>
      <a href="${hotspot.url}" class="loft__view-link">View full details</a>
    `;
    this.panel.hidden = false;

    const addBtn = this.panelBody.querySelector("[data-variant-id]");
    if (addBtn && hotspot.available) {
      addBtn.addEventListener("click", () => this.addToCart(hotspot.variantId, addBtn));
    }
  }

  async addToCart(variantId, button) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Adding…";
    try {
      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }] }),
      });
      if (!res.ok) throw new Error("Add to cart failed");
      button.textContent = "Added ✓";
      document.dispatchEvent(new CustomEvent("loft:cart-updated"));
    } catch (err) {
      button.textContent = "Try again";
    } finally {
      setTimeout(() => {
        button.disabled = false;
        button.textContent = original;
      }, 1800);
    }
  }

  bindEvents() {
    this.panelClose.addEventListener("click", () => {
      this.panel.hidden = true;
    });

    window.addEventListener("resize", () => this.onResize());
  }

  onResize() {
    if (!this.renderer) return;
    const rect = this.stage.getBoundingClientRect();
    this.renderer.setSize(rect.width, rect.height);
    const aspect = rect.width / rect.height;
    const frustum = 4.4;
    this.camera.left = (-frustum * aspect) / 2;
    this.camera.right = (frustum * aspect) / 2;
    this.camera.top = frustum / 2;
    this.camera.bottom = -frustum / 2;
    this.camera.updateProjectionMatrix();
  }

  animate() {
    this.controls.update();
    this.updateMarkers();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.animate());
  }
}

function init() {
  document.querySelectorAll("[data-loft]").forEach((root) => {
    new LoftScene(root).init();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
