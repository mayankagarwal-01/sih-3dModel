// src/App.jsx
import React, { Suspense, useEffect, useRef, useState, useMemo } from "react";
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

// Enhanced hook for responsive scaling with device detection
function useResponsiveScale(baseScale = 1) {
  const { size, viewport } = useThree();
  const [scale, setScale] = useState(baseScale);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const { width, height } = size;
    const aspectRatio = width / height;
    const smallerDimension = Math.min(width, height);
    
    // Device detection
    const mobile = width <= 768 || (navigator.userAgent.includes('Mobile') && width <= 1024);
    const tablet = width > 768 && width <= 1024 && !mobile;
    
    setIsMobile(mobile);
    setIsTablet(tablet);
    
    let scaleFactor;
    
    if (mobile) {
      // Mobile scaling - more aggressive scaling down
      scaleFactor = Math.max(0.3, smallerDimension / 1200);
      // Adjust for portrait vs landscape
      if (aspectRatio < 1) { // portrait
        scaleFactor *= 0.8;
      }
    } else if (tablet) {
      // Tablet scaling
      scaleFactor = Math.max(0.5, smallerDimension / 1000);
    } else {
      // Desktop scaling
      scaleFactor = Math.min(1.2, Math.max(0.7, smallerDimension / 800));
    }
    
    setScale(baseScale * scaleFactor);
  }, [size, viewport, baseScale]);

  return { scale, isMobile, isTablet };
}

// Hook for responsive camera settings
function useResponsiveCamera() {
  const { size, camera } = useThree();
  const [cameraSettings, setCameraSettings] = useState({ fov: 50, position: [0, 0, 5] });
  
  useEffect(() => {
    const { width, height } = size;
    const aspectRatio = width / height;
    const isMobile = width <= 768;
    const isTablet = width > 768 && width <= 1024;
    
    let fov, position;
    
    if (isMobile) {
      // Wider FOV for mobile to fit more content
      fov = aspectRatio < 1 ? 70 : 60; // portrait vs landscape
      position = aspectRatio < 1 ? [0, 0, 6] : [0, 0, 5.5];
    } else if (isTablet) {
      fov = 55;
      position = [0, 0, 5.2];
    } else {
      fov = 50;
      position = [0, 0, 5];
    }
    
    setCameraSettings({ fov, position });
    
    // Update camera
    camera.fov = fov;
    camera.position.set(...position);
    camera.updateProjectionMatrix();
    
  }, [size, camera]);
  
  return cameraSettings;
}

function SceneContent() {
  const { scale: modelScale, isMobile, isTablet } = useResponsiveScale(0.5);
  const { size } = useThree();
  const cameraSettings = useResponsiveCamera();
  
  // Responsive lighting based on device
  const ambientIntensity = isMobile ? 1.5 : 2;
  const directionalIntensity = isMobile ? 1.5 : 2;
  
  // Enhanced responsive screen scale based on window size
  const screenScale = React.useMemo(() => {
    const { width, height } = size;
    const smallerDimension = Math.min(width, height);
    const aspectRatio = width / height;
    
    let baseScale;
    if (isMobile) {
      baseScale = 0.001;
      // Adjust for very small mobile screens
      if (smallerDimension < 400) baseScale *= 0.8;
      // Adjust for mobile aspect ratio
      if (aspectRatio < 0.7) baseScale *= 0.9; // Very tall screens
    } else if (isTablet) {
      baseScale = 0.0012;
    } else {
      baseScale = 0.0013;
      // Scale up for larger desktop screens
      if (width > 1920) baseScale *= 1.1;
      if (width > 2560) baseScale *= 1.2;
    }
    
    // Additional window-size-based scaling
    const windowScaleFactor = smallerDimension / (isMobile ? 600 : 1000);
    const constrainedWindowFactor = Math.max(0.7, Math.min(1.4, windowScaleFactor));
    
    return baseScale * constrainedWindowFactor;
  }, [size.width, size.height, isMobile, isTablet]);
  
  return (
    <Center>
      {/* Responsive Lights */}
      <ambientLight intensity={ambientIntensity} color={new THREE.Color("#ffffff")} />
      <directionalLight 
        position={[5, 5, 5]} 
        intensity={directionalIntensity} 
      />

      {/* Responsive Model */}
      <Suspense fallback={null}>
        <InteractiveComputer
          scale={modelScale}
          position={[0, 0, 5]}
          rotation={[0, 0, 0]}
          isMobile={isMobile}
          isTablet={isTablet}
          // Adjust how far the camera sits from the screen after fitting it in view (world units)
          zoomOffset={0.5}
          // Slight margin so the screen edges aren't clipped
          zoomMargin={1.05}
        />
      </Suspense>

      {/* CSS3D overlay */}
      <CSSRendererOverlay />

      {/* Responsive Screen */}
      <MonitorScreen
        url="http://localhost:9002"
        position={[0.1, 0.01, 0.11]}
        scale={screenScale}
        isMobile={isMobile}
        baseScreenWidth={1280}
        baseScreenHeight={1024}
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
