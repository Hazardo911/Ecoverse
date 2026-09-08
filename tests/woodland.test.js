import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import * as THREE from "three";
import {
  prepareTree,
  cloneTree,
  addStreamRipples,
} from "../js/woodland-materials.js";

test("woodland GLB is self-contained, textured and within the asset budget", async () => {
  const bytes = await readFile(
    new URL("../public/assets/woodland/tree.glb", import.meta.url),
  );
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.ok(bytes.length < 5_000_000);
  const json = JSON.parse(
    bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
  );
  assert.ok(json.materials.some((m) => /leaves/.test(m.name)));
  assert.ok(json.images.length >= 3);
  assert.ok(json.images.every((i) => !i.uri && Number.isInteger(i.bufferView)));
  assert.ok(json.buffers.every((b) => !b.uri));
  const triangles = json.meshes
    .flatMap((m) => m.primitives)
    .reduce((sum, p) => sum + json.accessors[p.indices].count / 3, 0);
  assert.ok(triangles < 60_000, `${triangles} triangles exceeds budget`);
  for (const file of [
    "ground.jpg",
    "ground-normal.jpg",
    "leaf-alpha.jpg",
    "forest-light.hdr",
    "CREDITS.md",
  ]) {
    assert.ok(
      (
        await stat(
          new URL("../public/assets/woodland/" + file, import.meta.url),
        )
      ).size > 0,
    );
  }
});

test("trees normalize to six metres and clones retain animated cutout shadows", () => {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    name: "island_tree_02_leaves",
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 12, 2), material);
  mesh.position.y = 6;
  root.add(mesh);
  const time = { value: 0 };
  const template = prepareTree(root, time, 4),
    clone = cloneTree(template);
  const bounds = new THREE.Box3().setFromObject(clone);
  assert.equal(bounds.min.y, 0);
  assert.equal(bounds.max.y, 6);
  const clonedMesh = clone.children[0].children[0];
  assert.equal(clonedMesh.geometry, mesh.geometry);
  assert.equal(clonedMesh.customDepthMaterial, mesh.customDepthMaterial);
  assert.equal(material.transparent, false);
  assert.equal(material.alphaTest, 0.45);
  const shader = { uniforms: {}, vertexShader: "#include <begin_vertex>" };
  material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.woodlandTime, time);
  assert.match(shader.vertexShader, /transformed.x/);
});

test("stream shader adds moving normals without removing standard lighting", () => {
  const material = new THREE.MeshStandardMaterial(),
    time = { value: 0 };
  addStreamRipples(material, time);
  const shader = {
    uniforms: {},
    vertexShader: "#include <begin_vertex>",
    fragmentShader: "#include <normal_fragment_maps>",
  };
  material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.woodlandTime, time);
  assert.match(shader.fragmentShader, /#include <normal_fragment_maps>/);
  assert.match(shader.fragmentShader, /normal = normalize/);
});
