# Loft Interactive

An isometric 3D shoppable-room Shopify theme — drag to look around a warm, low-poly loft, click a piece of furniture, shop it. Built as an original implementation inspired by the *genre* of interactive-room commerce experiences (e.g. Plain Jane Interactive) — no code or assets from any existing product were copied; this is a from-scratch scaffold in this repo's own style.

## How it works

- **No build step.** `layout/theme.liquid` and the sections are plain Shopify Liquid. `assets/loft-scene.js` is a native ES module that imports Three.js and GSAP straight from a pinned CDN URL (unpkg / jsDelivr) at runtime — nothing to compile. Swap to a bundled/vendored copy later if you want zero third-party runtime requests (see "Hardening" below).
- **Progressive enhancement, not a gate.** `sections/loft-interactive.liquid` always server-renders a real, accessible product grid (`.loft__fallback-grid`) from actual Liquid product data. `loft-scene.js` only hides that grid and mounts the WebGL canvas if the device has WebGL *and* the viewport is ≥700px. Small phones and no-JS/no-WebGL visitors always get a working, real product grid — nobody is blocked from buying because a 3D scene didn't load.
- **Merchant-configurable hotspots.** Each "Hotspot" block in the section schema is a real product picker plus a `spot` (sofa / shelf / table / rack / plant) — no code changes needed to swap which product sits where. Hotspot data (title, price, image, variant ID, availability) is emitted as a `<script type="application/json">` tag from Liquid, so the JS never has to guess — it's real store data.
- **Real checkout, not a mockup.** Clicking a hotspot opens a panel wired to Shopify's `/cart/add.js` AJAX Cart API. Adding to cart is a real cart mutation.

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
