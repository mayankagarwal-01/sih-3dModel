// src/App.jsx
import React, { Suspense, useEffect, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Center } from "@react-three/drei";
import InteractiveComputer from "./InteractiveComputer";
import MonitorScreen from "./MonitorScreen"


import { createCSS3DRenderer } from "./createCSS3DRenderer";

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

          zIndex: 1 // makes sure CSS overlay doesn’t block interactions unless you want it
        }}
      >
      </div>


      {/* Three.js Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 0, 5], fov: 50, near: 0.1, far: 1000 }}
        gl={{ 
    alpha: false,
    clearColor: 0x000000 
  }}

      >
        <Center>
          {/* Lights */}
          <ambientLight intensity={2} color={"#ff0000ff"} />
          <directionalLight position={[5, 5, 5]} intensity={2} castShadow />

          {/* Model */}
          <Suspense fallback={null}>
            <InteractiveComputer scale={0.5} position={[0, 0, 5]} rotation={[0, 0, 0]} />
          </Suspense>

          {/* Add CSS3D overlay + Iframe */}
          <CSSRendererOverlay />
          <MonitorScreen url="https://os.henryheffernan.com" position={[0.1,0.2,0]} scale={0.0015} />
        </Center>
      </Canvas>
    </div>
  );
}
