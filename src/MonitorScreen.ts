import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { CSS3DObject } from "three/examples/jsm/renderers/CSS3DRenderer.js";

type Props = {
  url?: string;
  screenSize?: { w: number; h: number };
  padding?: number;
  // Deprecated: scale is no longer used directly; we derive exact scale from the mesh bounds
  scale?: number;
  isMobile?: boolean;
  baseScreenWidth?: number;
  baseScreenHeight?: number;
};

export default function MonitorScreen({
  url = "https://os.henryheffernan.com",
  screenSize = { w: 1280, h: 1024 },
  padding = 24,
  scale = 0.0013,
  isMobile = false,
  baseScreenWidth = 1280,
  baseScreenHeight = 1024,
}: Props) {
  const { scene, size: canvasSize } = useThree();
  const cssObjectRef = useRef<CSS3DObject | null>(null);
  // Temp vectors/quaternions to avoid allocations in frame loop
  const _box = useRef(new THREE.Box3());
  const _size = useRef(new THREE.Vector3());
  const _center = useRef(new THREE.Vector3());
  const _quat = useRef(new THREE.Quaternion());

  // Dynamic screen size based on window dimensions
  const responsiveScreenSize = React.useMemo(() => {
    const { width: windowWidth, height: windowHeight } = canvasSize;

    const widthScaleFactor = windowWidth / 1920; // Base reference width
    const heightScaleFactor = windowHeight / 1080; // Base reference height

    // Use the smaller scale factor to maintain aspect ratio
    const scaleFactor = Math.min(widthScaleFactor, heightScaleFactor);

    // Apply constraints to prevent extreme scaling
    const constrainedScaleFactor = Math.max(0.3, Math.min(2.0, scaleFactor));

    let calculatedWidth, calculatedHeight;

    if (isMobile) {
      // Mobile: start with smaller base dimensions and scale appropriately
      const mobileBaseWidth = Math.min(800, baseScreenWidth * 0.6);
      const mobileBaseHeight = Math.min(600, baseScreenHeight * 0.6);

      calculatedWidth = Math.floor(mobileBaseWidth * constrainedScaleFactor);
      calculatedHeight = Math.floor(mobileBaseHeight * constrainedScaleFactor);

      // Additional mobile constraints for performance
      calculatedWidth = Math.max(400, Math.min(1000, calculatedWidth));
      calculatedHeight = Math.max(300, Math.min(800, calculatedHeight));
    } else {
      // Desktop/tablet: scale based on window size more aggressively
      calculatedWidth = Math.floor(baseScreenWidth * constrainedScaleFactor);
      calculatedHeight = Math.floor(baseScreenHeight * constrainedScaleFactor);

      // Desktop constraints
      calculatedWidth = Math.max(600, Math.min(2560, calculatedWidth));
      calculatedHeight = Math.max(480, Math.min(1600, calculatedHeight));
    }

    return { w: calculatedWidth, h: calculatedHeight };
  }, [canvasSize.width, canvasSize.height, isMobile, baseScreenWidth, baseScreenHeight]);

  // Responsive padding based on window size and device
  const responsivePadding = React.useMemo(() => {
    const basePadding = isMobile ? 12 : padding;
    const windowScaleFactor = Math.min(canvasSize.width, canvasSize.height) / (isMobile ? 400 : 800);
    const scaledPadding = Math.floor(basePadding * Math.max(0.5, Math.min(1.5, windowScaleFactor)));
    return Math.max(4, Math.min(48, scaledPadding));
  }, [isMobile, padding, canvasSize.width, canvasSize.height]);

  // Create iframe & CSS3DObject
  useEffect(() => {
    const container = document.createElement("div");
    container.style.width = `${responsiveScreenSize.w}px`;
    container.style.height = `${responsiveScreenSize.h}px`;
    container.style.background = "#1d2e2f";
    container.style.borderRadius = isMobile ? "8px" : "12px";

    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.id = "computer-screen";
    iframe.title = "Ecoquest";
    iframe.setAttribute("frameBorder", "0");
    iframe.style.width = `${responsiveScreenSize.w}px`;
    iframe.style.height = `${responsiveScreenSize.h}px`;
    iframe.style.padding = `${responsivePadding}px`;
    iframe.style.boxSizing = "border-box";

    // Mobile optimizations
    if (isMobile) {
      iframe.setAttribute("loading", "lazy");
      iframe.style.transformOrigin = "center";
    }

    container.appendChild(iframe);

    const cssObj = new CSS3DObject(container);
    cssObjectRef.current = cssObj;
    scene.add(cssObj);

    return () => {
      if (cssObj.parent) cssObj.parent.remove(cssObj);
    };
  }, [scene, url, responsiveScreenSize.w, responsiveScreenSize.h, responsivePadding, isMobile]);

  // Keep aligned every frame: position, rotation, and scale derived from Object_19's world bounds
  useFrame(() => {
    const cssObj = cssObjectRef.current;
    const mesh = scene.getObjectByName("Object_19") as THREE.Mesh | undefined;
    if (!cssObj || !mesh) return;

    // Compute world-space bounding box and center (includes parent scaling)
    _box.current.setFromObject(mesh);
    _box.current.getSize(_size.current);
    _box.current.getCenter(_center.current);

    // Copy world position
    cssObj.position.copy(_center.current);

    // Copy world rotation
    mesh.getWorldQuaternion(_quat.current);
    cssObj.quaternion.copy(_quat.current);

    // Exact pixel-to-world scaling: width/height of mesh plane divided by iframe pixel size
    const sx = _size.current.x / Math.max(1, responsiveScreenSize.w);
    const sy = _size.current.y / Math.max(1, responsiveScreenSize.h);
    cssObj.scale.set(sx + 0.0004, sy + 0.0004, 1);
  });

  return null;
}
