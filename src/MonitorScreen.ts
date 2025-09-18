import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { CSS3DObject } from "three/examples/jsm/renderers/CSS3DRenderer.js";

type Props = {
  url?: string;
  screenSize?: { w: number; h: number };
  padding?: number;
};

export default function MonitorScreen({
  url = "https://os.henryheffernan.com",
  screenSize = { w: 1280, h: 1024 },
  padding = 24,
}: Props) {
  const { scene } = useThree();
  const cssObjectRef = useRef<CSS3DObject | null>(null);
  const scaleRef = useRef(0.001);
  const posRef = useRef(new THREE.Vector3());

  // Compute scale & center once, when Object_19 is available
  useEffect(() => {
    const mesh = scene.getObjectByName("Object_19") as THREE.Mesh;

    if (!mesh) {
      console.warn(" Monitor mesh (Object_19 || Object_17) not found in scene.");
      return;
    }

    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // scale factor from Object_19 size
    const scaleX = size.x / screenSize.w;
    const scaleY = size.y / screenSize.h;
    scaleRef.current = Math.min(scaleX, scaleY);

    // base position = center of Object_19
    posRef.current.copy(center);

    //  find Object_17 and compute world-space Y difference
    const mesh17 = scene.getObjectByName("Object_17") as THREE.Mesh;
    if (mesh17) {
      const box17 = new THREE.Box3().setFromObject(mesh17);
      const center17 = new THREE.Vector3();
      box17.getCenter(center17);

      // apply the offset
      const offsetY = center.y - center17.y;
      posRef.current.y -= offsetY;
    }


  }, [scene, screenSize.w, screenSize.h]);

  // Create iframe & CSS3DObject
  useEffect(() => {
    const container = document.createElement("div");
    container.style.width = `${screenSize.w}px`;
    container.style.height = `${screenSize.h}px`;
    container.style.background = "#1d2e2f";
    container.style.borderRadius = "12px";

    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.id = "computer-screen";
    iframe.title = "HeffernanOS";
    iframe.setAttribute("frameBorder", "0");
    iframe.style.width = `${screenSize.w}px`;
    iframe.style.height = `${screenSize.h}px`;
    iframe.style.padding = `${padding}px`;
    iframe.style.boxSizing = "border-box";

    container.appendChild(iframe);

    const cssObj = new CSS3DObject(container);
    cssObjectRef.current = cssObj;
    scene.add(cssObj);

    return () => {
      if (cssObj.parent) cssObj.parent.remove(cssObj);
    };
  }, [scene, url, screenSize.w, screenSize.h, padding]);

  // Keep aligned every frame
  useFrame(() => {
    const cssObj = cssObjectRef.current;
    const mesh = scene.getObjectByName("Object_19") as THREE.Mesh;
    if (cssObj && mesh) {
      cssObj.position.copy(posRef.current);
      cssObj.rotation.copy(mesh.rotation);
      cssObj.scale.set(scaleRef.current, scaleRef.current, scaleRef.current);
    }
  });

  return null;
}
