// src/InteractiveComputer.jsx
import React, { useRef, useState, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Computer } from "./Computer"; 


export default function InteractiveComputer(props) {
  const groupRef = useRef();
  const { camera } = useThree();
  const controlsRef = useRef();

  const [mode, setMode] = useState("idle"); // "idle" | "zoomed"
  const [initialCam] = useState(() => camera.position.clone()); // store initial camera pos

  // Toggle zoom on click
  const handleClick = (e) => {
    e.stopPropagation(); // prevent bubbling
    setMode((prev) => (prev === "idle" ? "zoomed" : "idle"));
  };

  const handlePointerOver = () => {
    document.body.style.cursor = "pointer";
  };
  const handlePointerOut = () => {
    document.body.style.cursor = "default";
  };

  // Escape key resets mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setMode("idle");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Animate camera smoothly
  useFrame(() => {
    if (!groupRef.current || !controlsRef.current) return;

    if (mode === "zoomed") {
      const screen = groupRef.current.getObjectByName("Object_19");
      if (screen) {
        const target = new THREE.Vector3();
        screen.getWorldPosition(target);

        const desiredPos = target.clone().add(new THREE.Vector3(0, 0.5, 2.8));
        camera.lookAt(target)
        camera.position.lerp(desiredPos, 0.05);

        // controlsRef.current.target.lerp(target, 0.05);
        controlsRef.current.update();
      }
    } else {
      camera.position.lerp(initialCam, 0.05);
      controlsRef.current.target.lerp(new THREE.Vector3(0, 0, 0), 0.05);
      controlsRef.current.update();
    }
  });

  return (
    <>
      <group
        ref={groupRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <Computer {...props} />
      </group>
      <OrbitControls ref={controlsRef} enablePan={false} />
    </>
  );
}
