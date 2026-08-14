# Phillipa Imani — New York Loft

A shader-rendered, shoppable fashion loft for Phillipa Imani. The homepage is the showroom: drag to orbit the garment rack, tap a garment to focus it, and hold to enter its native Shopify product page. Mobile uses swipe, tap-to-focus, and tap-again-to-enter.

## How it works

- **No build step or third-party runtime.** The stone floor and loft lighting are rendered by a compact native WebGL fragment shader in `assets/loft-scene.js`; rack depth uses GPU-composited CSS transforms.
- **Progressive enhancement, not a gate.** `sections/loft-interactive.liquid` always server-renders a real, accessible product grid (`.loft__fallback-grid`) from actual Liquid product data. `loft-scene.js` only hides that grid and mounts the WebGL canvas if the device has WebGL *and* the viewport is ≥700px. Small phones and no-JS/no-WebGL visitors always get a working, real product grid — nobody is blocked from buying because a 3D scene didn't load.
- **Real catalog data.** Liquid reads the selected collection, filters generated `asset-pack` placeholders, and places up to six real products on the virtual rack.
- **Native commerce handoff.** A 650ms hold opens the normal Shopify product page; a persistent “View as grid” route keeps conventional shopping one click away.

## Local development

```bash
npm install -g @shopify/cli @shopify/theme
shopify theme dev --store your-dev-store.myshopify.com
```

That connects this theme to a real (dev) Shopify store and gives you a live-reloading preview URL. `shopify theme check` lints the Liquid/JSON for correctness.

## Current state — what's real vs. placeholder

**Real:** the room/camera/lighting rig (orthographic isometric camera, OrbitControls locked to a narrow drag range so it reads as "looking into a room" rather than free orbit), the hotspot → screen-space projection every frame, the product panel + add-to-cart flow, the accessible fallback grid, the merchant-configurable block schema.

**Placeholder:** the furniture itself is flat-shaded primitive geometry (`BoxGeometry`, `CylinderGeometry`, `ConeGeometry`) positioned at the same coordinates the real models will eventually sit at (see `SPOT_POSITIONS` in `assets/loft-scene.js`). This was intentional — get the *mechanic* (camera, hotspots, cart) working and provably correct before spending time/money on real assets.

## Next steps for real assets

1. **Room + furniture (environment):** cheapest path is CC-licensed low-poly packs from [Kenney.nl](https://kenney.nl) or [Quaternius](https://quaternius.com) (free, game-dev-grade, easy to reskin materials to match your palette), or a custom Blender build if you want something fully bespoke. Export as glTF/GLB, compress with [Draco](https://github.com/google/draco) or [gltf-transform](https://gltf-transform.dev/), load with Three.js's `GLTFLoader` in place of the primitive geometry in `buildRoom()`.
2. **Merch (the actual products):** per the earlier direction — don't chase photoreal cloth simulation (CLO3D/Browzwear territory, expensive per-SKU) unless the catalog is small and the budget supports it. Model simplified "hero" objects instead (folded product, box, accessory, shoe) — much cheaper, still reads as premium at this line-drawing/flat-shaded aesthetic, and matches the reference's stylized-not-photoreal look.
3. **Swap positions:** once real models exist, replace the primitive meshes in `buildRoom()` with `GLTFLoader` loads, keeping the same `SPOT_POSITIONS` coordinates so hotspots don't need to move.

## Hardening for production

- Vendor Three.js/GSAP into `assets/` (or add a small esbuild step) instead of loading from a CDN at runtime, so the theme doesn't depend on a third party being up.
- Add texture compression (KTX2/Basis) once real textured models are in the scene — untouched glTF textures will bloat load time fast.
- Consider a `low-power` mode (already stubbed as a section setting — `quality: low`) that skips the 3D entirely on merchant request, e.g. for markets with slower connections.
