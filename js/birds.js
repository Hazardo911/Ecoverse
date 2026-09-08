import * as THREE from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";

export function birdUnlocked(index, growth, wildlifeLimit) {
  return wildlifeLimit === null ? growth > 0.66 : index < wildlifeLimit;
}

// Smooth, closed routes with separate phases prevent a synchronized carousel.
export function birdRoute(index) {
  const radius = 7 + index * 0.65;
  return new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-radius, 11 + index * 0.3, -4),
      new THREE.Vector3(-3, 12 + index * 0.25, -12),
      new THREE.Vector3(radius, 10.8 + index * 0.3, -8),
      new THREE.Vector3(radius + 1, 11.5 + index * 0.25, 3),
      new THREE.Vector3(0, 10.5 + index * 0.3, 7),
      new THREE.Vector3(-radius - 1, 11.8 + index * 0.25, 3),
    ],
    true,
    "centripetal",
  );
}

export function createBirdFlock(
  asset,
  { count = 5, reduced = false, perches = [] } = {},
) {
  const birds = [];
  const clip =
    asset.animations.find((a) => /fly|flight|flap/i.test(a.name)) ||
    asset.animations[0];
  if (!clip) throw new Error("The bird model must include a flight animation.");
  for (let index = 0; index < count; index++) {
    const model = clone(asset.scene),
      root = new THREE.Group();
    const bounds = new THREE.Box3().setFromObject(model),
      size = bounds.getSize(new THREE.Vector3());
    const scale = (0.8 + index * 0.04) / Math.max(size.x, size.y, size.z, 0.01);
    model.scale.multiplyScalar(scale);
    const pivot = new THREE.Group();
    pivot.add(model);
    root.add(pivot);
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.frustumCulled = false;
        o.material.side = THREE.DoubleSide;
        o.material.alphaTest = 0.4;
        o.material.transparent = false;
        o.material.depthWrite = true;
      }
    });
    root.userData = {
      kind: "bird",
      title: "Yellow-billed shrike",
      description:
        "Watch this feathered visitor flap, glide, and rest on fallen branches. Wildlife is unlocked by your recorded eco actions.",
    };
    const mixer = new THREE.AnimationMixer(model),
      action = mixer.clipAction(clip);
    const perchClip = asset.animations.find((a) => /perch/i.test(a.name));
    const perchAction = perchClip ? mixer.clipAction(perchClip) : null;
    if (perchAction) {
      perchAction.play();
      perchAction.setEffectiveWeight(0);
    }
    action.play();
    mixer.setTime(index * 0.137);
    const route = birdRoute(index);
    birds.push({
      root,
      model,
      pivot,
      mixer,
      action,
      perchAction,
      route,
      index,
    });
  }
  const forward = new THREE.Vector3(),
    ahead = new THREE.Vector3();
  return {
    birds,
    update(time, delta, growth, wildlifeLimit) {
      for (const bird of birds) {
        const { root, pivot, mixer, action, perchAction, route, index } = bird;
        root.visible = birdUnlocked(index, growth, wildlifeLimit);
        if (!root.visible) continue;
        const t = reduced ? 0 : time;
        const progress = (t / (27 + index * 2.3) + index * 0.19) % 1;
        route.getPointAt(progress, root.position);
        route.getTangentAt(progress, forward);
        route.getTangentAt((progress + 0.012) % 1, ahead);
        let rest = 0;
        const perch = perches[index % perches.length];
        const phase = (t + index * 7) % 48,
          cycleStart = t - phase;
        if (perch && perchAction && (reduced || (phase >= 30 && phase < 44))) {
          if (reduced || (phase >= 34 && phase < 40)) {
            root.position.copy(perch);
            forward.set(0, 0, 1);
            rest = 1;
          } else {
            const landing = phase < 34,
              u = (phase - (landing ? 30 : 40)) / 4;
            const endpoint = route.getPointAt(
              ((cycleStart + (landing ? 30 : 44)) / (27 + index * 2.3) +
                index * 0.19) %
                1,
            );
            const flightDirection = route.getTangentAt(
              ((cycleStart + (landing ? 30 : 44)) / (27 + index * 2.3) +
                index * 0.19) %
                1,
            );
            const arc = landing
              ? new THREE.CubicBezierCurve3(
                  endpoint,
                  endpoint.clone().addScaledVector(flightDirection, 2),
                  perch.clone().add(new THREE.Vector3(0, 2, -2)),
                  perch,
                )
              : new THREE.CubicBezierCurve3(
                  perch,
                  perch.clone().add(new THREE.Vector3(0, 2, 2)),
                  endpoint.clone().addScaledVector(flightDirection, -2),
                  endpoint,
                );
            arc.getPoint(u, root.position);
            arc.getTangent(u, forward);
            rest = landing
              ? THREE.MathUtils.smoothstep(u, 0.7, 1)
              : 1 - THREE.MathUtils.smoothstep(u, 0, 0.3);
          }
          ahead.copy(forward);
        }
        action.setEffectiveWeight(1 - rest);
        perchAction?.setEffectiveWeight(rest);
        root.rotation.set(0, Math.atan2(forward.x, forward.z), 0);
        pivot.rotation.z = THREE.MathUtils.clamp(
          (forward.x * ahead.z - forward.z * ahead.x) * -5,
          -0.35,
          0.35,
        );
        pivot.rotation.x = -Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1));
        // Briefly hold an extended-wing pose between flapping runs.
        const glide =
          !reduced && rest === 0 && phase < 30 && (t + index * 2.1) % 12 > 9.5;
        action.paused = reduced || glide;
        if (glide) action.time = clip.duration * 0.5;
        mixer.update(
          reduced ? 0 : Math.min(Math.max(delta, 0), 0.05) * (1 + index * 0.07),
        );
      }
    },
    dispose() {
      for (const { mixer, model, root } of birds) {
        mixer.stopAllAction();
        mixer.uncacheRoot(model);
        root.removeFromParent();
        model.traverse((o) => o.skeleton?.dispose());
      }
    },
  };
}
