# Woodland assets

## Bird

`bird.glb`: Yellow-billed shrike by pistachio, CC0 1.0.
Source: https://opengameart.org/content/bird-yellow-billed-shrike
Download: https://opengameart.org/sites/default/files/bird_yellow_billed_shrike.zip
Source includes a feather-textured mesh and rig, but no animation clips.
ECOVERSE adds the Flight and Perch animations using `scripts/export-bird.py`,
converts legacy materials, and exports with Blender 4.4.3. Textures reduced to
1024px and converted to WebP with glTF Transform 4.5.0; geometry is preserved.
The converted model is approximately 672 KB and served locally.

## Butterfly

`butterfly.glb`: Butterfly (animated) by Čestmír Dammer (CDmir), with the
OpenGameArt release by TinyWorlds. CC0. Source license credits photo
documentation by Rick Hoppmann for the diffuse UV texture.
Source: https://opengameart.org/content/butterfly-animated
Download: https://opengameart.org/sites/default/files/Butterfly.zip
Converted with `scripts/export-butterfly.py` using Blender 4.4.3; existing
Flying and sitting clips retained. Mesh validation and legacy material conversion
applied. WebP conversion/resampling with glTF Transform 4.5.0; about 85 KB.

## Forest floor and detail tier

- Fern 02: https://polyhaven.com/a/fern_02
  `fern.glb`, `fern-alpha.png`: four scanned fern variations with opacity mask.
- Rock Moss Set 01: https://polyhaven.com/a/rock_moss_set_01
  `rocks.glb`: six scanned moss-covered rock variations.
- Moss 01: https://polyhaven.com/a/moss_01
  `moss.glb`, `moss-alpha.png`: ground-cover model variations with opacity mask.
- Forest Leaves 02: https://polyhaven.com/a/forest_leaves_02
  `moss-ground.jpg`, `moss-ground-normal.jpg`, `moss-ground-rough.jpg`: 1K maps.
  These replace the previous Forest Floor maps in the current renderer.
- `tree-detailed.glb`: a less-simplified Island Tree 02 derivative, loaded only on
  desktop and used for nearby earned trees. glTF Transform simplify ratio .09,
  error .006, 1K WebP textures, no geometry codec required; about 6.7 MB.

All Poly Haven additions are CC0. Plant/rock source meshes are preserved as
distinct variations (`--join false --flatten false --instance false`), with
WebP textures and conservative simplification (.7 ratio, .002 error).

## Original woodland assets

Source assets by Poly Haven contributors, distributed under CC0 1.0:
https://polyhaven.com/license
https://creativecommons.org/publicdomain/zero/1.0/

- Island Tree 02: https://polyhaven.com/a/island_tree_02
  Download manifest: https://api.polyhaven.com/files/island_tree_02
  `tree.glb` is a locally simplified derivative of the 1K glTF asset, with
  WebP textures. `leaf-alpha.jpg` is its original 1K leaf opacity map.
  Optimization: glTF Transform CLI 4.5.0, `optimize --compress false
  --texture-compress webp --texture-size 1024 --simplify-ratio 0.035
  --simplify-error 0.02`.
- Forest Floor: https://polyhaven.com/a/forest_floor
  `ground.jpg`, `ground-normal.jpg`: original 1K diffuse/OpenGL normal maps.
- Bark Brown 02: https://polyhaven.com/a/bark_brown_02
  `bark.jpg`, `bark-normal.jpg`: original 1K diffuse/OpenGL normal maps.
- Forest Slope: https://polyhaven.com/a/forest_slope
  `forest-light.hdr`: original 1K HDR environment lighting.

These files are served locally. No external asset service, account, API key,
or database is required at runtime. Decorative tree names are game labels;
the shared woodland model is not a botanical identification model.
