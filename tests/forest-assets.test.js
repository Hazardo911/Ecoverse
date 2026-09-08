import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  createButterflies,
  butterflyUnlocked,
  butterflyPosition,
} from "../js/butterflies.js";
import {
  createForestGround,
  terrainHeight,
  riverCenter,
  surfaceVariants,
  scatterSurface,
} from "../js/forest-floor.js";

async function assetData(name) {
  const data = await readFile(
    new URL("../public/assets/woodland/" + name + ".glb", import.meta.url),
  );
  const length = data.readUInt32LE(12);
  const json = JSON.parse(data.subarray(20, 20 + length));
  return { data, json, binary: data.subarray(28 + length) };
}
async function rigOnly(name) {
  const { json, binary } = await assetData(name);
  for (const m of json.meshes) for (const p of m.primitives) delete p.material;
  delete json.materials;
  delete json.images;
  delete json.textures;
  json.buffers = [
    {
      byteLength: binary.length,
      uri: "data:application/octet-stream;base64," + binary.toString("base64"),
    },
  ];
  globalThis.ProgressEvent ??= class {
    constructor(type, args) {
      this.type = type;
      Object.assign(this, args);
    }
  };
  return new GLTFLoader().parseAsync(JSON.stringify(json), "");
}

test("butterfly asset contains a functioning independently cloned wing rig", async () => {
  const { json, data } = await assetData("butterfly");
  assert.ok(data.length < 250000);
  assert.ok(json.animations.some((a) => a.name === "Flying"));
  assert.ok(json.images.every((i) => !i.uri && Number.isInteger(i.bufferView)));
  const asset = await rigOnly("butterfly");
  const swarm = createButterflies(asset);
  let mesh;
  swarm.insects[0].model.traverse((o) => {
    if (o.isSkinnedMesh) mesh = o;
  });
  assert.ok(mesh);
  const before = mesh.skeleton.bones.map((b) => b.quaternion.clone());
  swarm.update(0.1, 0.05, 1, 6);
  swarm.update(0.2, 0.05, 1, 6);
  assert.equal(swarm.insects.filter((b) => b.root.visible).length, 1);
  assert.ok(
    mesh.skeleton.bones.some((b, i) => b.quaternion.angleTo(before[i]) > 0.01),
  );
  swarm.dispose();
  const still = createButterflies(asset, { reduced: true });
  still.update(1, 0.05, 1, 6);
  const point = still.insects[0].root.position.clone();
  still.update(10, 0.05, 1, 6);
  assert.deepEqual(still.insects[0].root.position.toArray(), point.toArray());
  still.dispose();
});

test("butterflies preserve unlock thresholds and stay above planted banks", () => {
  assert.equal(butterflyUnlocked(0, 1, 5), false);
  assert.equal(butterflyUnlocked(0, 0, 6), true);
  assert.equal(butterflyUnlocked(1, 1, 6), false);
  for (let i = 0; i < 7; i++)
    for (let t = 0; t < 60; t += 0.5) {
      const p = butterflyPosition(t, i);
      assert.ok(p.y > terrainHeight(p.x, p.z) + 0.4);
      assert.ok(Math.abs(p.x - riverCenter(p.z)) >= 2);
    }
});

test("forest floor models retain distinct variations and modest size budgets", async () => {
  for (const [name, max] of [
    ["fern", 500000],
    ["moss", 300000],
    ["rocks", 2000000],
    ["tree-detailed", 8000000],
  ]) {
    const { data, json } = await assetData(name);
    assert.ok(data.length < max);
    assert.ok(json.meshes.length > 0);
    assert.ok(json.images.every((i) => !i.uri));
    if (name === "fern") assert.ok(json.meshes.length >= 4);
  }
  for (const name of [
    "moss-ground.jpg",
    "moss-ground-normal.jpg",
    "moss-ground-rough.jpg",
    "fern-alpha.png",
    "moss-alpha.png",
  ])
    assert.ok(
      (
        await stat(
          new URL("../public/assets/woodland/" + name, import.meta.url),
        )
      ).size > 0,
    );
});

test("contoured ground and scanned scatter share the same height function", async () => {
  const ground = createForestGround(new THREE.MeshStandardMaterial());
  const p = ground.geometry.attributes.position;
  for (let i = 0; i < p.count; i += 251)
    assert.ok(
      Math.abs(p.getY(i) - terrainHeight(p.getX(i), p.getZ(i))) < 0.00001,
    );
  const fern = await rigOnly("fern"),
    variants = surfaceVariants(fern);
  const scatter = scatterSurface(variants, { count: 20 });
  const matrix = new THREE.Matrix4(),
    position = new THREE.Vector3();
  scatter.children.forEach((batch) => {
    for (let i = 0; i < batch.count; i++) {
      batch.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix);
      assert.ok(
        Math.abs(position.y - (terrainHeight(position.x, position.z) - 0.015)) <
          0.00001,
      );
      assert.ok(Math.abs(position.x - riverCenter(position.z)) >= 1.6499);
    }
  });
});
