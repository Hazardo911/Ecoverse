import * as THREE from "three";
import gsap from "gsap";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { createBirdFlock } from "./birds.js";
import { createButterflies } from "./butterflies.js";
import {
  riverCenter,
  terrainHeight,
  createForestGround,
  surfaceVariants,
  scatterSurface,
} from "./forest-floor.js";
import {
  addStreamRipples,
  prepareTree,
  cloneTree,
} from "./woodland-materials.js";
import { ecosystemGrowth, phase, treeGrowth } from "./ecosystem-growth.js";

// One reusable ecosystem renderer. Growth is presentation state, never a points ledger.
export function createWorld(
  canvas,
  {
    growth = 1,
    treeLimit = null,
    wildlifeLimit = null,
    story = false,
    onSelect = () => {},
  } = {},
) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = innerWidth < 760;
  const fallback = () => {
    canvas.dataset.sceneStatus = "fallback";
    canvas.parentElement.classList.add("scene-fallback");
    return null;
  };
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !mobile,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch {
    return fallback();
  }
  // Dense scanned foliage is unsuitable for a software rasterizer. Preserve the
  // accessible product instead of blocking forms while the CPU compiles the scene.
  const gl = renderer.getContext(),
    debug = gl.getExtension("WEBGL_debug_renderer_info");
  if (
    debug &&
    /swiftshader|llvmpipe|software rasterizer/i.test(
      gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),
    )
  ) {
    renderer.dispose();
    renderer.forceContextLoss();
    return fallback();
  }
  const lowQuality = mobile || localStorage.getItem("eco-quality") === "low";
  renderer.setPixelRatio(
    Math.min(devicePixelRatio, lowQuality || reduced ? 1 : 1.75),
  );
  renderer.setClearColor(0xbacbd0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = !lowQuality && !reduced;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbacbd0);
  scene.fog = new THREE.FogExp2(0xbacbd0, 0.016);
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 160);
  const hemi = new THREE.HemisphereLight(0xdcefff, 0x625540, 1.35);
  scene.add(hemi);
  const sunlight = new THREE.DirectionalLight(0xffdda2, 2.8);
  sunlight.position.set(-12, 24, 8);
  sunlight.castShadow = !lowQuality && !reduced;
  sunlight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunlight.shadow.camera, {
    left: -24,
    right: 24,
    top: 24,
    bottom: -24,
    near: 1,
    far: 80,
  });
  sunlight.shadow.normalBias = 0.06;
  scene.add(sunlight);
  const world = new THREE.Group();
  scene.add(world);
  const material = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
  const soil = material(0xffffff);
  const dormantSoil = new THREE.Color(0x675744),
    livingSoil = new THREE.Color(0xffffff);
  let disposed = false;
  const textures = [];
  const loader = new THREE.TextureLoader();
  function surfaceTexture(path, repeat, color = false) {
    const texture = loader.load(path, (t) => {
      if (disposed) t.dispose();
    });
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(...repeat);
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (color) texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    return texture;
  }
  soil.map = surfaceTexture("/assets/woodland/moss-ground.jpg", [55, 55], true);
  soil.normalMap = surfaceTexture(
    "/assets/woodland/moss-ground-normal.jpg",
    [55, 55],
  );
  soil.normalScale.set(0.65, 0.65);
  soil.roughnessMap = surfaceTexture(
    "/assets/woodland/moss-ground-rough.jpg",
    [55, 55],
  );
  let environmentTarget;
  new HDRLoader().load(
    "/assets/woodland/forest-light.hdr",
    (hdr) => {
      if (disposed) {
        hdr.dispose();
        return;
      }
      const pmrem = new THREE.PMREMGenerator(renderer);
      environmentTarget = pmrem.fromEquirectangular(hdr);
      scene.environment = environmentTarget.texture;
      hdr.dispose();
      pmrem.dispose();
    },
    undefined,
    () => {
      /* Hemisphere and sun remain a complete lighting fallback. */
    },
  );
  scene.environmentIntensity = 0.55;
  const riverX = riverCenter,
    heightAt = terrainHeight;
  const terrain = createForestGround(soil);
  world.add(terrain);
  let seed = 742;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const trees = [],
    pickables = [],
    treeLODs = [];
  const windTime = { value: 0 };
  let treeTemplate = null;
  let detailedTreeTemplate = null;
  const assetNote = document.createElement("p");
  assetNote.className = "woodland-loading";
  assetNote.setAttribute("role", "status");
  assetNote.textContent = "Preparing your woodland…";
  canvas.parentElement.append(assetNote);
  const seedMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 8),
    material(0x94794e),
  );
  seedMesh.position.set(-1, 0.14, -2);
  seedMesh.scale.z = 0.65;
  world.add(seedMesh);
  function tree(x, z, size, index) {
    const group = new THREE.Group();
    group.position.set(x, heightAt(x, z), z);
    group.userData = {
      kind: "tree",
      title: index === 0 ? "The heartwood tree" : "Native woodland",
      description: "Each approved action adds growth to your forest.",
    };
    group.rotation.y = rand() * Math.PI * 2;
    world.add(group);
    trees.push({
      group,
      size,
      index,
      groundY: group.position.y,
    });
    pickables.push(group);
  }
  tree(-1, -2, 1.65, 0);
  for (let i = 1; i < (mobile ? 23 : 46); i++) {
    const a = rand() * Math.PI * 2,
      r = 3 + rand() * 7.5;
    const x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    if (Math.abs(x - riverX(z)) < 2.2) continue;
    tree(x, z, 0.4 + rand() * 0.75, i);
  }
  const backdrop = new THREE.Group();
  scene.add(backdrop);
  const ready = new GLTFLoader()
    .loadAsync("/assets/woodland/tree.glb")
    .then(async (gltf) => {
      const alpha = await loader.loadAsync("/assets/woodland/leaf-alpha.jpg");
      alpha.flipY = false;
      textures.push(alpha);
      gltf.scene.traverse((o) => {
        if (o.isMesh && /leaves/i.test(o.material.name)) {
          alpha.offset.copy(o.material.map.offset);
          alpha.repeat.copy(o.material.map.repeat);
          alpha.rotation = o.material.map.rotation;
          o.material.alphaMap = alpha;
        }
      });
      if (disposed) {
        disposeObject(gltf.scene);
        alpha.dispose();
        return;
      }
      treeTemplate = prepareTree(
        gltf.scene,
        windTime,
        Math.min(8, renderer.capabilities.getMaxAnisotropy()),
      );
      trees.forEach(({ group }) => {
        const lod = new THREE.LOD();
        lod.addLevel(cloneTree(treeTemplate), 0);
        group.add(lod);
        treeLODs.push(lod);
      });
      if (!mobile)
        new GLTFLoader()
          .loadAsync("/assets/woodland/tree-detailed.glb")
          .then((detail) => {
            if (disposed) {
              disposeObject(detail.scene);
              return;
            }
            detail.scene.traverse((o) => {
              if (o.isMesh && /leaves/i.test(o.material.name))
                o.material.alphaMap = alpha;
            });
            detailedTreeTemplate = prepareTree(
              detail.scene,
              windTime,
              Math.min(8, renderer.capabilities.getMaxAnisotropy()),
            );
            treeLODs.forEach((lod) => {
              lod.levels[0].distance = 32;
              lod.addLevel(cloneTree(detailedTreeTemplate), 0);
            });
          })
          .catch(() => {
            /* The standard model stays visible if the detail tier fails. */
          });
      // The distant habitat is scenery; earned trees remain in the foreground plot.
      for (let i = 0; i < (mobile ? 10 : 18); i++) {
        const tree = cloneTree(treeTemplate);
        const angle = Math.PI + (i / (mobile ? 10 : 18)) * Math.PI;
        const x = Math.cos(angle) * (25 + rand() * 16),
          z = -18 - rand() * 25;
        tree.position.set(x, heightAt(x, z), z);
        tree.scale.multiplyScalar(1.1 + rand() * 0.8);
        tree.userData.matureScale = tree.scale.clone();
        tree.userData.groundY = tree.position.y;
        tree.userData.growthOrder = i / (mobile ? 10 : 18);
        tree.rotation.y = rand() * 6.28;
        tree.traverse((o) => {
          if (o.isMesh) o.castShadow = false;
        });
        backdrop.add(tree);
      }
      refreshTreeDecorations();
      canvas.dataset.sceneStatus = "ready";
      assetNote.remove();
    })
    .catch(() => {
      if (disposed) return;
      canvas.dataset.sceneStatus = "error";
      assetNote.textContent =
        "Tree assets could not load. Refresh to try again; your progress is safe.";
    });
  function disposeObject(object) {
    object.traverse((o) => {
      o.geometry?.dispose();
      o.customDepthMaterial?.dispose();
      if (o.material)
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
          m.dispose();
        }
    });
  }
  // A recessed, meandering stream continues into the woodland horizon.
  const vertices = [],
    indices = [];
  for (let i = 0; i <= 50; i++) {
    const z = -70 + i * 2.8,
      x = riverX(z);
    vertices.push(x - 1.3, -0.1, z, x + 1.3, -0.1, z);
    if (i < 50) {
      const k = i * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const waterGeo = new THREE.BufferGeometry();
  waterGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  waterGeo.setIndex(indices);
  waterGeo.computeVertexNormals();
  const river = new THREE.Mesh(
    waterGeo,
    material(0x718e82, {
      metalness: 0.2,
      roughness: 0.16,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    }),
  );
  river.userData = {
    kind: "river",
    title: "The waterway",
    description: "Your water-saving actions are counted in Impact.",
  };
  world.add(river);
  addStreamRipples(river.material, windTime);
  pickables.push(river);
  const birdPerches = [];
  const deadwood = material(0xb4a795, {
    map: surfaceTexture("/assets/woodland/bark.jpg", [1, 2], true),
    normalMap: surfaceTexture("/assets/woodland/bark-normal.jpg", [1, 2]),
  });
  for (let i = 0; i < 7; i++) {
    const x = -9 + rand() * 8,
      z = -7 + rand() * 16;
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.19, 1.5 + rand() * 1.6, 12),
      deadwood,
    );
    log.position.set(x, heightAt(x, z) + 0.15, z);
    log.rotation.set(Math.PI / 2, 0, rand() * Math.PI);
    log.castShadow = log.receiveShadow = true;
    world.add(log);
    birdPerches.push(log.position.clone().add(new THREE.Vector3(0, 0.18, 0)));
  }
  const floorAssets = [],
    understory = new THREE.Group();
  scene.add(understory);
  let fernTemplate = null;
  const floorReady = Promise.allSettled(
    ["fern", "rocks", "moss"].map(async (kind) => {
      const asset = await new GLTFLoader().loadAsync(
        `/assets/woodland/${kind}.glb`,
      );
      if (disposed) {
        disposeObject(asset.scene);
        return;
      }
      floorAssets.push(asset);
      let alpha = null;
      if (kind !== "rocks") {
        alpha = await loader.loadAsync(`/assets/woodland/${kind}-alpha.png`);
        alpha.flipY = false;
        textures.push(alpha);
        if (disposed) {
          alpha.dispose();
          return;
        }
      }
      const variants = surfaceVariants(asset, alpha);
      const group = scatterSurface(variants, {
        kind: kind === "rocks" ? "rock" : kind,
        count:
          kind === "fern"
            ? mobile
              ? 70
              : 160
            : kind === "moss"
              ? mobile
                ? 100
                : 220
              : 28,
        seed: kind === "fern" ? 812 : kind === "moss" ? 624 : 171,
        mobile,
      });
      group.userData.ecosystemLayer = kind;
      if (kind === "fern") {
        const v = variants[0];
        fernTemplate = new THREE.Mesh(v.geometry, v.material);
        fernTemplate.scale.setScalar(0.85 / Math.max(v.size.y, 0.001));
        understory.add(group);
        refreshTreeDecorations();
      } else world.add(group);
    }),
  ).then((results) => {
    if (disposed) return;
    canvas.dataset.floorStatus = results.every((r) => r.status === "fulfilled")
      ? "ready"
      : "partial";
  });
  // Background is atmospheric woodland, never a floating disc or polygon mountains.
  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xc0d7be,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
  });
  for (let i = 0; i < 8; i++) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6), cloudMat);
    cloud.position.set((rand() - 0.5) * 55, 13 + rand() * 5, -15 - rand() * 20);
    cloud.scale.set(8, 1, 2);
    scene.add(cloud);
  }
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0xffe6af }),
  );
  sun.position.set(-13, 16, -32);
  scene.add(sun);
  let flock = null,
    birdAsset = null;
  const birdsReady = new GLTFLoader()
    .loadAsync("/assets/woodland/bird.glb")
    .then((asset) => {
      if (disposed) {
        disposeObject(asset.scene);
        return;
      }
      birdAsset = asset;
      flock = createBirdFlock(asset, { reduced, perches: birdPerches });
      flock.birds.forEach(({ root }) => {
        root.visible = false;
        scene.add(root);
        pickables.push(root);
      });
      canvas.dataset.birdStatus = "ready";
    })
    .catch(() => {
      if (disposed) return;
      canvas.dataset.birdStatus = "error";
      const note = document.createElement("p");
      note.className = "woodland-loading bird-load-error";
      note.setAttribute("role", "status");
      note.textContent =
        "Birds could not load. Refresh to try again; wildlife unlocks are saved.";
      canvas.parentElement.append(note);
    });
  let pollinators = null,
    butterflyAsset = null;
  const butterfliesReady = new GLTFLoader()
    .loadAsync("/assets/woodland/butterfly.glb")
    .then((asset) => {
      if (disposed) {
        disposeObject(asset.scene);
        return;
      }
      butterflyAsset = asset;
      pollinators = createButterflies(asset, { reduced });
      pollinators.insects.forEach(({ root }) => {
        root.visible = false;
        scene.add(root);
        pickables.push(root);
      });
      canvas.dataset.butterflyStatus = "ready";
    })
    .catch(() => {
      if (!disposed) canvas.dataset.butterflyStatus = "error";
    });
  const pointCount = mobile ? 60 : 150,
    positions = new Float32Array(pointCount * 3);
  for (let i = 0; i < pointCount; i++) {
    positions[i * 3] = (rand() - 0.5) * 23;
    positions[i * 3 + 1] = rand() * 7;
    positions[i * 3 + 2] = (rand() - 0.5) * 20;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const fireflies = new THREE.Points(
    particleGeo,
    new THREE.PointsMaterial({
      color: 0xe2ff92,
      size: 0.065,
      transparent: true,
      opacity: 0.6,
    }),
  );
  scene.add(fireflies);
  const controls = { growth, travel: 0, night: 0 };
  const storyPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(2.2, 1.15, 5.4),
    new THREE.Vector3(6.5, 2.5, 10),
    new THREE.Vector3(11, 5.4, 17),
    new THREE.Vector3(5.5, 8.6, 18.5),
    new THREE.Vector3(-3.5, 10.8, 21),
  ]);
  const storyTargetPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1, 0.22, -2),
    new THREE.Vector3(-1, 1.1, -2),
    new THREE.Vector3(0, 2.2, -3),
    new THREE.Vector3(1.5, 3.2, -6),
    new THREE.Vector3(0, 3.8, -8),
  ]);
  const storyCamera = new THREE.Vector3(),
    storyTarget = new THREE.Vector3();
  let atmosphere = "day";
  const pointer = new THREE.Vector2();
  function move(e) {
    const r = canvas.getBoundingClientRect();
    pointer.set(
      (e.clientX - r.left) / r.width - 0.5,
      (e.clientY - r.top) / r.height - 0.5,
    );
  }
  const raycaster = new THREE.Raycaster();
  function select(e) {
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      ),
      camera,
    );
    const hit = raycaster.intersectObjects(
      pickables.filter((o) => o.visible),
      true,
    )[0];
    if (hit) {
      let object = hit.object;
      while (!object.userData.kind && object.parent) object = object.parent;
      onSelect(object.userData);
    }
  }
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("click", select);
  const resize = () => {
    const r = canvas.parentElement.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas.parentElement);
  resize();
  let frame,
    visible = true;
  const intersection = new IntersectionObserver(
    ([entry]) => (visible = entry.isIntersecting),
  );
  intersection.observe(canvas);
  const clock = new THREE.Clock();
  let lastTime = 0,
    lastFrame = -Infinity;
  function render() {
    frame = requestAnimationFrame(render);
    if (!visible || document.hidden) return;
    const now = performance.now();
    if (now - lastFrame < (reduced ? 300 : lowQuality ? 1000 / 24 : 1000 / 40))
      return;
    lastFrame = now;
    const t = reduced ? 0 : clock.getElapsedTime(),
      g = controls.growth,
      stages = ecosystemGrowth(g);
    const delta = Math.min(0.05, Math.max(0, t - lastTime));
    lastTime = t;
    flock?.update(t, delta, stages.wildlife, wildlifeLimit);
    pollinators?.update(t, delta, stages.wildlife, wildlifeLimit);
    understory.visible = stages.understory > 0.002;
    backdrop.visible = stages.background > 0.002;
    for (const holder of [understory, world])
      holder.traverse((object) => {
        if (!object.isInstancedMesh || !object.userData.fullCount) return;
        const amount =
          object.userData.ecosystemLayer === "moss"
            ? stages.moss
            : object.userData.ecosystemLayer === "fern"
              ? stages.understory
              : 1;
        object.count = Math.max(0, Math.floor(object.userData.fullCount * amount));
      });
    backdrop.children.forEach((object) => {
      const amount = phase(
        stages.background,
        object.userData.growthOrder * 0.45,
        0.55 + object.userData.growthOrder * 0.45,
      );
      const scale = object.userData.matureScale;
      if (!scale) return;
      object.scale.set(scale.x * (0.12 + amount * 0.88), scale.y * amount, scale.z * (0.12 + amount * 0.88));
      object.position.y = object.userData.groundY - (1 - amount) * 1.4;
    });
    windTime.value = t;
    if (story) {
      storyPath.getPointAt(controls.travel, storyCamera);
      storyTargetPath.getPointAt(controls.travel, storyTarget);
      camera.position.copy(storyCamera);
      camera.position.x += reduced ? 0 : pointer.x * 0.28;
      camera.lookAt(storyTarget);
    } else {
      camera.position.set(13 - controls.travel * 7 + (reduced ? 0 : pointer.x * 0.65), 6.5 - controls.travel * 2, 22 - controls.travel * 7);
      camera.lookAt(0, 3, -3);
    }
    seedMesh.visible = stages.seed > 0.01;
    seedMesh.scale.set(1, 1 + (1 - stages.seed) * 0.45, 0.65);
    seedMesh.position.y = 0.14 + (1 - stages.seed) * 0.08;
    soil.color.lerpColors(dormantSoil, livingSoil, stages.soil);
    scene.fog.density = THREE.MathUtils.lerp(0.028, 0.016, stages.atmosphere);
    trees.forEach(({ group, index, size, groundY }, i) => {
      const amount = treeGrowth(g, index, trees.length);
      group.visible = amount.visible && (treeLimit === null || i < treeLimit);
      group.scale.set(amount.width * size, amount.height * size, amount.width * size);
      group.position.y = groundY - (1 - amount.height) * 0.9;
      group.rotation.z = Math.sin(t * 0.7 + index) * 0.008 * amount.maturity;
    });
    river.visible = stages.water > 0.002;
    river.material.opacity = stages.water * 0.85;
    fireflies.visible = stages.wildlife > 0.6 && atmosphere === "night";
    fireflies.material.opacity = atmosphere === "night" ? 0.95 : 0.3;
    fireflies.rotation.y = t * 0.025;
    renderer.render(scene, camera);
  }
  render();
  const decorations = new THREE.Group();
  scene.add(decorations);
  function refreshTreeDecorations() {
    decorations.children
      .filter((o) => o.userData.treeDecoration || o.userData.fernDecoration)
      .forEach((group) => {
        if (group.children.length) return;
        const template = group.userData.fernDecoration
          ? fernTemplate
          : treeTemplate;
        if (!template) return;
        const model = cloneTree(template);
        if (group.userData.treeDecoration) model.scale.multiplyScalar(0.55);
        group.add(model);
      });
  }
  const clearDecorations = () => {
    decorations.children.forEach((o) => {
      gsap.killTweensOf(o.scale);
      if (!o.userData.treeDecoration && !o.userData.fernDecoration)
        disposeObject(o);
    });
    decorations.clear();
  };
  return {
    controls,
    ready,
    birdsReady,
    floorReady,
    butterfliesReady,
    setDecorations(placements) {
      clearDecorations();
      const slots = [
        [-7, 5],
        [-4, 7],
        [0, 8],
        [6, 6],
        [8, 1],
        [-8, -2],
      ];
      for (const item of placements) {
        const group = new THREE.Group(),
          [x, z] = slots[item.slot];
        group.position.set(x, heightAt(x, z), z);
        const mat = new THREE.MeshStandardMaterial({
          color: item.color,
          roughness: 0.7,
        });
        const mesh = (geometry, material, px, py, pz) => {
          const o = new THREE.Mesh(geometry, material);
          o.position.set(px, py, pz);
          o.castShadow = true;
          group.add(o);
          return o;
        };
        if (item.kind === "tree") {
          group.userData.treeDecoration = true;
          group.rotation.y = item.slot * 1.7;
        } else if (item.kind === "fern") {
          group.userData.fernDecoration = true;
        } else if (item.kind === "pond") {
          const pool = mesh(
            new THREE.CircleGeometry(1.15, 32),
            new THREE.MeshStandardMaterial({
              color: item.color,
              metalness: 0.45,
              roughness: 0.2,
              side: THREE.DoubleSide,
            }),
            0,
            0.06,
            0,
          );
          pool.rotation.x = -Math.PI / 2;
          for (let i = 0; i < 10; i++)
            mesh(
              new THREE.DodecahedronGeometry(0.2, 0),
              new THREE.MeshStandardMaterial({ color: 0x8a9586 }),
              Math.cos(i * 0.628) * 1.1,
              0.08,
              Math.sin(i * 0.628) * 1.1,
            );
        } else if (item.kind === "lantern") {
          mesh(
            new THREE.CylinderGeometry(0.08, 0.12, 1.4, 6),
            new THREE.MeshStandardMaterial({ color: 0x584d32 }),
            0,
            0.7,
            0,
          );
          mesh(
            new THREE.OctahedronGeometry(0.35),
            new THREE.MeshStandardMaterial({
              color: item.color,
              emissive: item.color,
              emissiveIntensity: 1.8,
            }),
            0,
            1.55,
            0,
          );
          const light = new THREE.PointLight(item.color, 2, 5);
          light.position.y = 1.5;
          group.add(light);
        } else
          for (let i = 0; i < 12; i++) {
            const a = i * 2.4,
              r = 0.2 + (i % 4) * 0.22;
            {
              mesh(
                new THREE.CylinderGeometry(0.015, 0.02, 0.5, 4),
                new THREE.MeshStandardMaterial({ color: 0x4e7535 }),
                Math.cos(a) * r,
                0.25,
                Math.sin(a) * r,
              );
              mesh(
                new THREE.IcosahedronGeometry(0.14, 0),
                mat.clone(),
                Math.cos(a) * r,
                0.52,
                Math.sin(a) * r,
              );
            }
          }
        mat.dispose();
        decorations.add(group);
        if (!reduced)
          gsap.from(group.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.8 });
      }
      refreshTreeDecorations();
    },
    setGrowth(v) {
      controls.growth = THREE.MathUtils.clamp(v, 0, 1);
    },
    setProgress(state) {
      treeLimit = state.treesUnlocked;
      wildlifeLimit = state.wildlifeUnlocked;
      controls.growth = THREE.MathUtils.clamp(state.visualGrowth, 0, 1);
    },
    setTime(mode) {
      atmosphere = mode;
      const night = mode === "night",
        sunset = mode === "sunset",
        duration = reduced ? 0 : 1.4;
      const bg = new THREE.Color(
        night ? 0x060f20 : sunset ? 0xb49b87 : 0xbacbd0,
      );
      scene.background ??= new THREE.Color(0x102e2b);
      gsap.to(scene.background, { r: bg.r, g: bg.g, b: bg.b, duration });
      gsap.to(scene.fog.color, { r: bg.r, g: bg.g, b: bg.b, duration });
      gsap.to(hemi, { intensity: night ? 0.6 : 1.35, duration });
      gsap.to(scene, {
        environmentIntensity: night ? 0.07 : sunset ? 0.3 : 0.55,
        duration,
      });
      gsap.to(sunlight, { intensity: night ? 0.35 : 2.8, duration });
      const tint = new THREE.Color(
        sunset ? 0xff9966 : night ? 0x9cbcff : 0xffdda2,
      );
      gsap.to(sunlight.color, { r: tint.r, g: tint.g, b: tint.b, duration });
      sun.material.color.set(night ? 0xcddfff : 0xffe6af);
      gsap.to(sunlight.position, { x: sunset ? 15 : -10, duration });
    },
    destroy() {
      disposed = true;
      flock?.dispose();
      pollinators?.dispose();
      if (butterflyAsset) disposeObject(butterflyAsset.scene);
      floorAssets.forEach((a) => disposeObject(a.scene));
      if (birdAsset) disposeObject(birdAsset.scene);
      canvas.parentElement.querySelector(".bird-load-error")?.remove();
      assetNote.remove();
      textures.forEach((t) => t.dispose());
      decorations.children.forEach((o) => gsap.killTweensOf(o.scale));
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("click", select);
      gsap.killTweensOf([
        scene,
        scene.background,
        scene.fog.color,
        hemi,
        sunlight,
        sunlight.color,
        sunlight.position,
      ]);
      disposeObject(scene);
      if (treeTemplate) disposeObject(treeTemplate);
      if (detailedTreeTemplate) disposeObject(detailedTreeTemplate);
      environmentTarget?.dispose();
      renderer.dispose();
    },
  };
}
