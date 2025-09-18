// src/App.jsx
import React, { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Center } from "@react-three/drei";
import InteractiveComputer from "./InteractiveComputer";
import MonitorScreen from "./MonitorScreen";
import { createCSS3DRenderer } from "./createCSS3DRenderer";
import * as THREE from "three"

function CSSRendererOverlay() {
  const { scene, camera } = useThree();
  const cssRendererRef = useRef(null);

  useEffect(() => {
    const container = document.getElementById("css-container");
    cssRendererRef.current = createCSS3DRenderer(scene, camera, container);

    return () => {
      if (cssRendererRef.current?.domElement?.parentNode) {
        cssRendererRef.current.domElement.parentNode.removeChild(
          cssRendererRef.current.domElement
        );
      }
    };
  }, [scene, camera]);

  useFrame(() => {
    if (cssRendererRef.current) {
      cssRendererRef.current.render(scene, camera);
    }
  });

  return null;
}

// Hook for responsive scaling (for model only)
function useResponsiveScale(baseScale = 1, minFactor = 0.5, maxFactor = 1.5) {
  const { size } = useThree();
  const [scale, setScale] = useState(baseScale);

  useEffect(() => {
    const { width, height } = size;
    // Use smaller dimension as reference
    const refSize = Math.min(width, height);
    const factor = refSize / 1000; // adjust denominator for sensitivity
    setScale(Math.min(Math.max(baseScale * factor, minFactor), maxFactor));
  }, [size, baseScale, minFactor, maxFactor]);

  return scale;
}

function SceneContent() {
  const modelScale = useResponsiveScale(0.5, 0.3, 1.2); // only the computer is responsive
  return (
    <Center>
      {/* Lights */}
      <ambientLight intensity={2} color={new THREE.Color("#008cb3") } />
      <directionalLight position={[5, 5, 5]} intensity={2} castShadow />

      {/* Model */}
      <Suspense fallback={null}>
        <InteractiveComputer
          scale={modelScale}
          position={[0, 0, 5]}
          rotation={[0, 0, 0]}
        />
      </Suspense>

      {/* CSS3D overlay */}
      <CSSRendererOverlay />

      {/* Screen stays fixed scale */}
      <MonitorScreen
        url="https://os.henryheffernan.com"
        position={[0.1, 0.01, 0.11]}
        scale={0.0013} // stays constant
      />
    </Center>
  );
}

export default function App() {
  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      {/* Container for CSS3DRenderer */}
      <div
        id="css-container"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 1
        }}
      ></div>

      {/* Three.js Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 0, 5], fov: 50, near: 0.1, far: 1000 }}
        gl={{
          alpha: false,
          clearColor: 0x000000
        }}
      >
        <SceneContent />
      </Canvas>
    </div>
  );
}
