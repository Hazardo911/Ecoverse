import * as THREE from "three";

// Keep the same displacement in the visible and shadow passes.
export function addLeafWind(material, time) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.woodlandTime = time;
    shader.vertexShader =
      `uniform float woodlandTime;\n${shader.vertexShader}`.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
       float sway = sin(woodlandTime * 1.15 + position.y * 1.7 + position.x * .8);
       transformed.x += sway * .035 * max(position.y, 0.0);
       transformed.z += cos(woodlandTime + position.z * 1.5) * .016 * max(position.y, 0.0);`,
      );
  };
  material.customProgramCacheKey = () => "woodland-leaf-wind-v1";
}

export function addStreamRipples(material, time) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.woodlandTime = time;
    shader.vertexShader =
      `varying vec3 streamPosition;\n${shader.vertexShader}`.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nstreamPosition = position;",
      );
    shader.fragmentShader =
      `uniform float woodlandTime;\nvarying vec3 streamPosition;\n${shader.fragmentShader}`.replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
       vec2 ripple = vec2(sin(streamPosition.z * 8.0 - woodlandTime * 1.3 + sin(streamPosition.x * 5.0)),
                          cos(streamPosition.x * 11.0 + streamPosition.z * 3.0 + woodlandTime * .8));
       normal = normalize(normal + vec3(ripple * .075, 0.0));`,
      );
  };
  material.customProgramCacheKey = () => "woodland-stream-v1";
}

export function prepareTree(root, time, anisotropy) {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const wrapper = new THREE.Group();
  const scale = 6 / Math.max(size.y, 0.01);
  root.position.sub(
    new THREE.Vector3(
      (bounds.min.x + bounds.max.x) / 2,
      bounds.min.y,
      (bounds.min.z + bounds.max.z) / 2,
    ),
  );
  wrapper.add(root);
  wrapper.scale.setScalar(scale);
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    const m = o.material;
    m.roughness = 0.92;
    m.metalness = 0;
    if (m.map) m.map.anisotropy = anisotropy;
    if (/leaves/i.test(m.name)) {
      m.side = THREE.DoubleSide;
      m.transparent = false;
      m.alphaTest = 0.45;
      m.depthWrite = true;
      m.color.set(0xffffff);
      addLeafWind(m, time);
      o.customDepthMaterial = new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking,
        map: m.map,
        alphaMap: m.alphaMap,
        alphaTest: 0.45,
        side: THREE.DoubleSide,
      });
      addLeafWind(o.customDepthMaterial, time);
    }
  });
  return wrapper;
}

// Object3D.clone shares geometry/materials but does not copy custom shadow materials.
export function cloneTree(template) {
  const clone = template.clone(true);
  const originals = [];
  template.traverse((o) => originals.push(o));
  let index = 0;
  clone.traverse((o) => {
    o.customDepthMaterial = originals[index++].customDepthMaterial;
  });
  return clone;
}
