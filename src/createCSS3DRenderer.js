// src/createCSS3DRenderer.js
import { CSS3DRenderer } from "three/examples/jsm/renderers/CSS3DRenderer.js";

export function createCSS3DRenderer(scene, camera, container) {
  const renderer = new CSS3DRenderer();
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.top = "0px";
  container.appendChild(renderer.domElement);

  return renderer;
}
