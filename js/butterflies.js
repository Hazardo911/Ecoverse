import * as THREE from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { terrainHeight, riverCenter } from "./forest-floor.js";

export const butterflyUnlocked = (index, growth, wildlifeLimit) =>
  wildlifeLimit === null ? growth > 0.76 : index + 5 < wildlifeLimit;

export function butterflyPosition(time, index, target = new THREE.Vector3()) {
  const angle = index * 2.39996;
  let x =
    Math.cos(angle) * (3 + index * 0.6) + Math.sin(time * 0.47 + index) * 1.1;
  const z =
    Math.sin(angle) * (3 + index * 0.6) + Math.cos(time * 0.31 + index) * 0.8;
  // Keep pollinators above the planted banks, away from the stream bed.
  if (Math.abs(x - riverCenter(z)) < 2) x = riverCenter(z) - 2.2;
  return target.set(
    x,
    terrainHeight(x, z) +
      0.85 +
      Math.sin(time * 1.3 + index) * 0.22 +
      Math.sin(time * 0.37) * 0.2,
    z,
  );
}

export function createButterflies(asset, { reduced = false, count = 7 } = {}) {
  const clip = asset.animations.find((a) => /flying/i.test(a.name));
  if (!clip) throw new Error("Butterfly flight animation is missing.");
  const insects = [];
  for (let index = 0; index < count; index++) {
    const model = clone(asset.scene),
      root = new THREE.Group();
    const bounds = new THREE.Box3().setFromObject(model),
      size = bounds.getSize(new THREE.Vector3());
    const scale =
      (0.3 + index * 0.012) / Math.max(size.x, size.y, size.z, 0.01);
    model.scale.multiplyScalar(scale);
    model.position.addScaledVector(
      bounds.getCenter(new THREE.Vector3()),
      -scale,
    );
    root.add(model);
    model.traverse((o) => {
      if (o.isMesh) {
        o.material.side = THREE.DoubleSide;
        o.material.alphaTest = 0.45;
        o.material.transparent = false;
        o.material.depthWrite = true;
        o.castShadow = true;
        o.frustumCulled = false;
      }
    });
    const mixer = new THREE.AnimationMixer(model),
      action = mixer.clipAction(clip);
    action.play();
    mixer.setTime(index * 0.047);
    root.userData = {
      kind: "butterfly",
      title: "Monarch butterfly",
      description:
        "Patterned wings and a small, wandering flight path bring pollinators to the woodland floor.",
    };
    insects.push({ root, model, mixer, action, index });
  }
  const next = new THREE.Vector3();
  return {
    insects,
    update(time, delta, growth, wildlifeLimit) {
      for (const { root, mixer, index } of insects) {
        root.visible = butterflyUnlocked(index, growth, wildlifeLimit);
        if (!root.visible) continue;
        const t = reduced ? 0 : time;
        butterflyPosition(t, index, root.position);
        butterflyPosition(t + 0.025, index, next);
        root.rotation.set(
          Math.sin(t * 2 + index) * 0.1,
          Math.atan2(next.x - root.position.x, next.z - root.position.z),
          Math.sin(t * 1.7 + index) * 0.12,
        );
        if (!reduced)
          mixer.update(
            Math.min(Math.max(delta, 0), 0.05) * (1.2 + index * 0.045),
          );
      }
    },
    dispose() {
      insects.forEach(({ root, model, mixer }) => {
        mixer.stopAllAction();
        mixer.uncacheRoot(model);
        model.traverse((o) => o.skeleton?.dispose());
        root.removeFromParent();
      });
    },
  };
}
