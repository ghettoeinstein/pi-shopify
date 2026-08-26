# Phillipa Imani — Three.js New York Loft

The Shopify homepage is a game-rendered, shoppable loft: a stone-floor living space with industrial windows, steel structure, lounge furniture, skyline, sculptural objects, and two clothing racks populated from the live Shopify catalog.

## Experience

- Real Three.js geometry, PBR materials, shadows, fog, and procedural stone texture
- Four GSAP-choreographed camera zones: Entry, Lounge, Rack 01, and Rack 02
- Drag/swipe camera look, wheel navigation, raycast garment selection, and 650ms hold-to-open
- Live title, price, availability, product links, product imagery, and Shopify AJAX add-to-cart
- Responsive mobile controls plus an always-visible “Shop as grid” escape hatch
- A conventional storefront fallback when WebGL cannot initialize

## Architecture

This remains a native Shopify Online Store 2.0 theme—not a headless storefront. Three.js and GSAP are committed in `assets/`, so production does not depend on a third-party runtime CDN and no application build step is required.

Liquid in `sections/loft-interactive.liquid` supplies live product data. `assets/loft-scene.js` builds the room and commerce interactions; `assets/loft-scene.css` supplies the responsive interface.

## Local preview

```bash
npm install
shopify theme dev --store your-store.myshopify.com
```

Validate before publishing with `npm run check`. This branch is intended for preview first; it does not publish or replace the live Shopify theme on its own.

## Asset upgrade path

The environment is a polished procedural gray-box made from real 3D primitives. Bespoke Blender-made furniture or simplified garment GLBs can later replace individual meshes without changing the camera, rack, selection, panel, or cart systems. Production GLBs should use Draco geometry and KTX2 textures to preserve mobile performance.
