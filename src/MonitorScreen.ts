import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { CSS3DObject } from "three/examples/jsm/renderers/CSS3DRenderer.js";

/**
 * MonitorScreen Props
 * - url: iframe URL to show
 * - screenSize: virtual pixel size (w,h) to match your original TS constants
 * - padding: iframe padding to simulate bezel
 * - position/rotation: where to place CSS object and GL planes (in world units)
 *
 * NOTE: This component directly mutates the three.js scene (adds meshes & a CSS3DObject).
 * react-three-fiber will still render GL objects normally; CSS object is added manually
 * (similar to your IframeScreen.jsx approach).
 */
type Props = {
  url?: string;
  screenSize?: { w: number; h: number };
  padding?: number;
  position?: THREE.Vector3 | [number, number, number];
  rotation?: THREE.Euler | [number, number, number];
  scale?: number;
};

export default function MonitorScreen({
  url = "https://os.henryheffernan.com",
  screenSize = { w: 1280, h: 1024 },
  padding = 32,
  position = [0, 0, 0],
  rotation = [-3 * THREE.MathUtils.DEG2RAD, 0, 0],
  scale = 0.00125,
}: Props) {
  const { scene, camera } = useThree();
  const cssObjectRef = useRef<CSS3DObject | null>(null);
  const dimmingMeshRef = useRef<THREE.Mesh | null>(null);
  const glOcclusionPlaneRef = useRef<THREE.Mesh | null>(null);
  const textureLayerRefs = useRef<THREE.Mesh[]>([]);
  const videoTexturesRef = useRef<Record<string, THREE.VideoTexture | undefined>>(
    {}
  );
  const cleanupFunctionsRef = useRef<(() => void)[]>([]);

  // Derived sizes
  const screenW = screenSize.w;
  const screenH = screenSize.h;

  // Helper function to convert position/rotation to Vector3/Euler
  const getPosition = (): THREE.Vector3 => {
    if (Array.isArray(position)) {
      return new THREE.Vector3(position[0], position[1], position[2]);
    }
    return position.clone();
  };

  const getRotation = (): THREE.Euler => {
    if (Array.isArray(rotation)) {
      return new THREE.Euler(rotation[0], rotation[1], rotation[2]);
    }
    return rotation.clone();
  };

  // Create iframe DOM element wrapped in CSS3DObject
  useEffect(() => {
    const container = document.createElement("div");
    container.style.width = `${screenW}px`;
    container.style.height = `${screenH}px`;
    container.style.background = "#1d2e2f";
    container.style.opacity = "1";
    container.style.pointerEvents = "auto";
    container.style.clipPath = "inset(0px round 12px)";
    container.style.borderRadius = "12px";

    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.title = "HeffernanOS";
    iframe.id = "computer-screen";
    iframe.setAttribute("frameBorder", "0");
    iframe.style.width = `${screenW}px`;
    iframe.style.height = `${screenH}px`;
    iframe.style.padding = `${padding}px`;
    iframe.style.boxSizing = "border-box";
    iframe.style.pointerEvents = "auto";
    iframe.style.overflow = "hidden";
    iframe.style.background = 'transparent'
    // clip to rounded rectangle to mimic bezel
    iframe.style.clipPath = "inset(0px round 12px)";
    iframe.style.borderRadius = "12px";

    container.appendChild(iframe);

    const cssObj = new CSS3DObject(container);

    // position, rotation, scale (match to GL mesh)
    const pos = getPosition();
    const rot = getRotation();
    
    cssObj.position.copy(pos);
    cssObj.rotation.copy(rot);
    cssObj.scale.set(scale, scale, scale);

    cssObjectRef.current = cssObj;
    scene.add(cssObj);

    // Forward DOM events from iframe to the document by listening for postMessage events
    const onMessage = (ev: MessageEvent) => {
      // Expect the inner iframe to post messages like { type: 'mousemove', clientX, clientY } etc.
      // We'll re-dispatch these as custom events on the iframe element with adjusted coordinates
      if (!ev.data || typeof ev.data.type !== "string") return;
      
      try {
        const evt = new CustomEvent(ev.data.type, { bubbles: true });
        // attach some useful props if present
        (evt as any).inComputer = true;
        
        if (ev.data.type === "mousemove") {
          // map virtual coordinates to actual DOM rect
          const rect = iframe.getBoundingClientRect();
          const widthRatio = rect.width / screenW;
          const heightRatio = rect.height / screenH;
          (evt as any).clientX = Math.round(ev.data.clientX * widthRatio + rect.left);
          (evt as any).clientY = Math.round(ev.data.clientY * heightRatio + rect.top);
        } else if (ev.data.type === "keydown" || ev.data.type === "keyup") {
          (evt as any).key = ev.data.key;
        }
        
        iframe.dispatchEvent(evt);
      } catch (error) {
        console.warn("Error dispatching custom event:", error);
      }
    };
    
    window.addEventListener("message", onMessage);

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (cssObj.parent) {
        cssObj.parent.remove(cssObj);
      }
      // Properly dispose of DOM elements
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };

    cleanupFunctionsRef.current.push(cleanup);

    return cleanup;
  }, [scene, url, screenW, screenH, padding, scale]);

  // Helper: create a plane mesh given width & height
  const createPlaneMesh = (
    w: number,
    h: number,
    material: THREE.Material,
    pos?: THREE.Vector3,
    rot?: THREE.Euler
  ) => {
    const geo = new THREE.PlaneGeometry(w, h);
    const mesh = new THREE.Mesh(geo, material);
    if (pos) mesh.position.copy(pos);
    if (rot) mesh.rotation.copy(rot);
    return mesh;
  };

  // Create GL layers: occlusion plane (invisible) to occlude CSS, texture layers, and dimmer plane
  useEffect(() => {
    const pos = getPosition();
    const rot = getRotation();

    // Basic occlusion plane (transparent lambert with NoBlending so CSS3D sits behind it)
    const occlusionMaterial = new THREE.MeshLambertMaterial({
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.NoBlending,
    });
    
    const occlusionMesh = createPlaneMesh(screenW, screenH, occlusionMaterial, pos, rot);
    scene.add(occlusionMesh);
    glOcclusionPlaneRef.current = occlusionMesh;

    // Texture layers (smudge/shadow/video overlays)
    const layers: {
      map?: THREE.Texture;
      blending: THREE.Blending;
      opacity: number;
      offsetZ: number;
    }[] = [
      // smudge (placeholder: white-ish low alpha)
      { blending: THREE.AdditiveBlending, opacity: 0.08, offsetZ: 0.03 },
      // inner shadow (darker)
      { blending: THREE.NormalBlending, opacity: 0.6, offsetZ: 0.01 },
      // video layer 1 (will be replaced when video found)
      { blending: THREE.AdditiveBlending, opacity: 0.5, offsetZ: 0.02 },
      // video layer 2
      { blending: THREE.AdditiveBlending, opacity: 0.12, offsetZ: 0.035 },
    ];

    // create each mesh and place slightly in front (z offset) of the occlusion plane
    const createdTextureMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < layers.length; i++) {
      const lm = layers[i];
      const mat = new THREE.MeshBasicMaterial({
        map: lm.map || null,
        transparent: false,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: lm.blending,
      });
      
      const mesh = createPlaneMesh(screenW, screenH, mat);
      
      // offset in local Z - apply rotation to the offset vector
      const offsetVector = new THREE.Vector3(0, 0, lm.offsetZ ?? 0.02);
      offsetVector.applyEuler(rot);
      
      const meshPos = pos.clone().add(offsetVector);
      mesh.position.copy(meshPos);
      mesh.rotation.copy(rot);
      
      scene.add(mesh);
      createdTextureMeshes.push(mesh);
    }
    textureLayerRefs.current = createdTextureMeshes;

    // perspective dimmer
    const dimMat = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      color: 0x000000,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      
    });
    
    const dimPlane = createPlaneMesh(screenW, screenH, dimMat);
    
    // position slightly in frontmost of texture layers
    const dimOffset = new THREE.Vector3(0, 0, 0.04);
    dimOffset.applyEuler(rot);
    const dimPos = pos.clone().add(dimOffset);
    
    dimPlane.position.copy(dimPos);
    dimPlane.rotation.copy(rot);
    dimmingMeshRef.current = dimPlane;
    scene.add(dimPlane);

    const cleanup = () => {
      // cleanup
      if (occlusionMesh.parent) scene.remove(occlusionMesh);
      occlusionMesh.geometry?.dispose();
      if (occlusionMesh.material) {
        if (Array.isArray(occlusionMesh.material)) {
          occlusionMesh.material.forEach(mat => mat.dispose());
        } else {
          occlusionMesh.material.dispose();
        }
      }

      createdTextureMeshes.forEach((m) => {
        if (m.parent) scene.remove(m);
        m.geometry?.dispose();
        if (m.material) {
          if (Array.isArray(m.material)) {
            m.material.forEach(mat => mat.dispose());
          } else {
            m.material.dispose();
          }
        }
      });

      if (dimPlane.parent) scene.remove(dimPlane);
      dimPlane.geometry?.dispose();
      if (dimPlane.material) {
        if (Array.isArray(dimPlane.material)) {
          dimPlane.material.forEach(mat => mat.dispose());
        } else {
          dimPlane.material.dispose();
        }
      }
    };

    cleanupFunctionsRef.current.push(cleanup);
    return cleanup;
  }, [scene, screenW, screenH]);

  // Poll for video elements and create VideoTexture objects, assign to the texture layers
  useEffect(() => {
    let mounted = true;
    const videoIds = ["video-1", "video-2"];
    const attemptInterval = 150; // ms
    const maxAttempts = 200; // give up after some tries
    let attempts = 0;

    const interval = window.setInterval(() => {
      if (!mounted) return;
      
      attempts++;
      let foundNewVideo = false;
      
      for (const vid of videoIds) {
        if (!videoTexturesRef.current[vid]) {
          const el = document.getElementById(vid) as HTMLVideoElement | null;
          if (el && el instanceof HTMLVideoElement) {
            const vTex = new THREE.VideoTexture(el);
            vTex.minFilter = THREE.LinearFilter;
            vTex.magFilter = THREE.LinearFilter;
            vTex.format = THREE.RGBFormat;
            videoTexturesRef.current[vid] = vTex;
            foundNewVideo = true;
          }
        }
      }

      // if we have at least one video texture, assign to one of the texture layers
      const layers = textureLayerRefs.current;
      if (layers.length && foundNewVideo) {
        if (videoTexturesRef.current["video-1"] && layers[2]) {
          const mat = layers[2].material as THREE.MeshBasicMaterial;
          if (mat) {
            mat.map = videoTexturesRef.current["video-1"]!;
            mat.needsUpdate = true;
          }
        }
        if (videoTexturesRef.current["video-2"] && layers[3]) {
          const mat = layers[3].material as THREE.MeshBasicMaterial;
          if (mat) {
            mat.map = videoTexturesRef.current["video-2"]!;
            mat.needsUpdate = true;
          }
        }
      }

      const hasAllVideos = videoIds.every(id => videoTexturesRef.current[id]);
      if (hasAllVideos || attempts > maxAttempts) {
        clearInterval(interval);
      }
    }, attemptInterval);

    return () => {
      mounted = false;
      clearInterval(interval);
      // Clean up video textures
      Object.values(videoTexturesRef.current).forEach(texture => {
        if (texture) {
          texture.dispose();
        }
      });
      videoTexturesRef.current = {};
    };
  }, []);

  // update loop: adjust dimmer opacity by camera distance and view dot (like original)
  useFrame(() => {
    const dimMesh = dimmingMeshRef.current;
    const occlusionMesh = glOcclusionPlaneRef.current;
    if (!dimMesh || !occlusionMesh) return;

    // plane normal in local space - assuming monitor faces +Z in world (adjust as necessary)
    const planeNormal = new THREE.Vector3(0, 0, 1);
    const rot = getRotation();
    planeNormal.applyEuler(rot);
    
    // compute view vector from monitor to camera
    const camPos = camera.position.clone();
    const screenPos = occlusionMesh.position.clone();
    const viewVec = camPos.clone().sub(screenPos).normalize();

    const dot = Math.max(0, viewVec.dot(planeNormal));

    const distance = camPos.distanceTo(screenPos);
    // avoid divide by zero
    const opacityFactor = 1 / Math.max(distance / 10000, 0.0001);
    const DIM_FACTOR = 0.7;
    const newOpacity = Math.max(
      0,
      Math.min(1, (1 - opacityFactor) * DIM_FACTOR + (1 - dot) * DIM_FACTOR)
    );

    const material = dimMesh.material as THREE.MeshBasicMaterial;
    if (material) {
      material.opacity = newOpacity;
    }
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupFunctionsRef.current.forEach(cleanup => cleanup());
      cleanupFunctionsRef.current = [];
    };
  }, []);

  // This component does not render react-managed mesh elements; it performs scene-side additions.
  return null;
}