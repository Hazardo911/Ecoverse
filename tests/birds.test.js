import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { birdUnlocked, birdRoute, createBirdFlock } from "../js/birds.js";

async function loadBirdRig() {
  const bytes = await readFile(
    new URL("../public/assets/woodland/bird.glb", import.meta.url),
  );
  assert.ok(bytes.length < 1_000_000);
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  assert.deepEqual(json.animations.map((a) => a.name).sort(), [
    "Flight",
    "Perch",
  ]);
  assert.ok(json.skins.length > 0);
  assert.ok(json.images.length >= 2);
  assert.ok(json.images.every((i) => i.bufferView !== undefined && !i.uri));
  // Texture decoding needs a browser. Keep the actual exported rig and animation
  // data, using default materials for this headless animation/ownership test.
  for (const mesh of json.meshes)
    for (const p of mesh.primitives) delete p.material;
  delete json.materials;
  delete json.images;
  delete json.textures;
  const binary = bytes.subarray(28 + jsonLength);
  json.buffers = [
    {
      byteLength: binary.length,
      uri: "data:application/octet-stream;base64," + binary.toString("base64"),
    },
  ];
  globalThis.ProgressEvent ??= class {
    constructor(type, options) {
      this.type = type;
      Object.assign(this, options);
    }
  };
  return new GLTFLoader().parseAsync(JSON.stringify(json), "");
}

test("bird routes are closed, finite and respect earned wildlife counts", () => {
  assert.equal(birdUnlocked(0, 1, 0), false);
  assert.equal(birdUnlocked(0, 0, 1), true);
  assert.equal(birdUnlocked(1, 1, 1), false);
  assert.equal(birdUnlocked(0, 0.66, null), false);
  assert.equal(birdUnlocked(0, 0.67, null), true);
  for (let i = 0; i < 5; i++) {
    const route = birdRoute(i);
    assert.ok(route.getPointAt(0).distanceTo(route.getPointAt(1)) < 0.00001);
    for (let t = 0; t <= 1; t += 0.05)
      assert.ok(route.getPointAt(t).toArray().every(Number.isFinite));
  }
});

test("exported bird animates with independent skeletons and safe perch/glide transitions", async () => {
  const asset = await loadBirdRig();
  const perch = new THREE.Vector3(-4, 0.4, 2);
  const flock = createBirdFlock(asset, { perches: [perch] });
  let first, second;
  flock.birds[0].model.traverse((o) => {
    if (o.isSkinnedMesh) first = o;
  });
  flock.birds[1].model.traverse((o) => {
    if (o.isSkinnedMesh) second = o;
  });
  assert.ok(first && second);
  assert.notEqual(first.skeleton, second.skeleton);
  assert.notEqual(first.skeleton.bones[0], second.skeleton.bones[0]);
  const before = first.skeleton.bones.map((b) => b.quaternion.clone());
  flock.update(0, 0.05, 1, 1);
  assert.equal(flock.birds.filter((b) => b.root.visible).length, 1);
  flock.update(0.1, 0.05, 1, 1);
  assert.ok(
    first.skeleton.bones.some((b, i) => b.quaternion.angleTo(before[i]) > 0.01),
  );
  for (const t of [10, 30, 32, 34, 36, 40, 42, 44, 48, 80]) {
    flock.update(t, 0.016, 1, 5);
    assert.ok(
      flock.birds.every((b) =>
        b.root.position.toArray().every(Number.isFinite),
      ),
    );
    if (t === 36)
      assert.ok(flock.birds[0].root.position.distanceTo(perch) < 0.00001);
  }
  flock.dispose();
  assert.ok(flock.birds.every((b) => b.mixer.stats.actions.inUse === 0));
});

test("reduced motion keeps unlocked birds still on a perch", async () => {
  const asset = await loadBirdRig(),
    perch = new THREE.Vector3(1, 0.5, 2);
  const flock = createBirdFlock(asset, { reduced: true, perches: [perch] });
  flock.update(1, 0.05, 1, 1);
  const before = flock.birds[0].root.position.clone();
  flock.update(20, 0.05, 1, 1);
  assert.deepEqual(flock.birds[0].root.position.toArray(), before.toArray());
  assert.deepEqual(before.toArray(), perch.toArray());
  flock.dispose();
});
