import * as THREE from "three";

export const riverCenter = (z) => 2 + Math.sin(z * 0.16) * 2.4;
const clearings = [
  [-7, 5],
  [-4, 7],
  [0, 8],
  [6, 6],
  [8, 1],
  [-8, -2],
];
export function terrainHeight(x, z) {
  const bank = Math.abs(x - riverCenter(z));
  const rolling =
    0.2 +
    Math.sin(x * 0.21) * Math.cos(z * 0.18) * 0.55 +
    Math.sin(z * 0.51 + x * 0.19) * 0.18 +
    Math.sin(x * 0.8 + z * 0.7) * 0.05;
  return THREE.MathUtils.lerp(
    -0.28,
    rolling,
    THREE.MathUtils.smoothstep(bank, 0.9, 2.8),
  );
}

export function createForestGround(material) {
  const geometry = new THREE.PlaneGeometry(150, 150, 300, 300);
  geometry.rotateX(-Math.PI / 2);
  const p = geometry.attributes.position,
    uv = geometry.attributes.uv;
  const colors = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i);
    p.setY(i, terrainHeight(x, z));
    // Continuous coordinate warping and broad tonal changes soften repeat patterns.
    uv.setXY(
      i,
      uv.getX(i) + Math.sin(z * 0.15) * 0.002,
      uv.getY(i) + Math.sin(x * 0.12) * 0.002,
    );
    const shade = 0.79 + 0.14 * Math.sin(x * 0.19 + Math.cos(z * 0.16));
    colors.push(shade, shade, shade * 0.97);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  material.vertexColors = true;
  const ground = new THREE.Mesh(geometry, material);
  ground.receiveShadow = true;
  return ground;
}

export function surfaceVariants(asset, alpha = null) {
  asset.scene.updateMatrixWorld(true);
  const variants = [];
  asset.scene.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox,
      size = bounds.getSize(new THREE.Vector3());
    geometry.translate(
      -(bounds.min.x + bounds.max.x) / 2,
      -bounds.min.y,
      -(bounds.min.z + bounds.max.z) / 2,
    );
    const material = mesh.material.clone();
    material.color.set(0xffffff);
    material.roughness = 0.95;
    material.metalness = 0;
    material.side = THREE.DoubleSide;
    if (alpha) {
      material.alphaMap = alpha;
      material.alphaTest = 0.45;
      material.transparent = false;
      material.depthWrite = true;
    }
    variants.push({ geometry, material, size });
  });
  return variants;
}

export function scatterSurface(
  variants,
  { count, seed = 91, kind = "fern", mobile = false } = {},
) {
  let state = seed;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const group = new THREE.Group(),
    transform = new THREE.Object3D();
  variants.forEach((variant, index) => {
    const amount = Math.ceil(count / variants.length);
    const batch = new THREE.InstancedMesh(
      variant.geometry,
      variant.material,
      amount,
    );
    for (let i = 0; i < amount; i++) {
      let x, z;
      do {
        x = (random() - 0.5) * 42;
        z = (random() - 0.5) * 38 - 3;
      } while (
        Math.abs(x - riverCenter(z)) < 1.65 ||
        (kind !== "moss" &&
          clearings.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 1.2))
      );
      const dimension =
        kind === "fern"
          ? variant.size.y
          : Math.max(variant.size.x, variant.size.z);
      const target =
        kind === "fern"
          ? 0.45 + random() * 0.7
          : kind === "rock"
            ? 0.35 + random() * 1.1
            : 1.1 + random() * 1.4;
      transform.position.set(
        x,
        terrainHeight(x, z) - (kind === "rock" ? 0.08 : 0.015),
        z,
      );
      transform.rotation.set(0, random() * Math.PI * 2, 0);
      transform.scale.setScalar(target / Math.max(dimension, 0.001));
      transform.updateMatrix();
      batch.setMatrixAt(i, transform.matrix);
    }
    batch.castShadow = !mobile && kind !== "moss";
    batch.receiveShadow = true;
    batch.computeBoundingSphere();
    group.add(batch);
  });
  return group;
}
