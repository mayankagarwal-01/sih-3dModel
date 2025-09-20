// src/InteractiveComputer.jsx
import React, { useRef, useState, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Computer } from "./Computer"; 
import MonitorScreen from "./MonitorScreen";


export default function InteractiveComputer(props) {
  const { isMobile = false, isTablet = false, zoomOffset = 0.5, zoomMargin = 1.05, ...restProps } = props;
  const groupRef = useRef();
  const { camera, size } = useThree();
  const controlsRef = useRef();

  const [mode, setMode] = useState("idle"); // "idle" | "zoomed"
  const [initialCam] = useState(() => camera.position.clone()); // store initial camera pos
  const [lastTouchTime, setLastTouchTime] = useState(0);
  const [touchStarted, setTouchStarted] = useState(false);

  // temp objects to avoid allocations
  const _box = useRef(new THREE.Box3());
  const _center = useRef(new THREE.Vector3());
  const _size = useRef(new THREE.Vector3());
  const _quat = useRef(new THREE.Quaternion());
  const _normal = useRef(new THREE.Vector3());
  const _desired = useRef(new THREE.Vector3());

  // Enhanced click/touch handling for mobile
  const handleClick = (e) => {
    e.stopPropagation();
    
    // Handle touch double-tap for mobile
    if (isMobile && e.type === 'touchend') {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastTouchTime;
      
      if (timeDiff < 300 && timeDiff > 0) {
        // Double tap detected
        setMode((prev) => (prev === "idle" ? "zoomed" : "idle"));
      }
      setLastTouchTime(currentTime);
    } else if (!isMobile) {
      // Regular click for desktop
      setMode((prev) => (prev === "idle" ? "zoomed" : "idle"));
    }
  };
  
  const handleTouchStart = (e) => {
    setTouchStarted(true);
    e.stopPropagation();
  };
  
  const handleTouchEnd = (e) => {
    if (touchStarted) {
      handleClick(e);
      setTouchStarted(false);
    }
  };

  const handlePointerOver = () => {
    if (!isMobile) {
      document.body.style.cursor = "pointer";
    }
  };
  
  const handlePointerOut = () => {
    if (!isMobile) {
      document.body.style.cursor = "default";
    }
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
        // Compute world center and extents of the screen
        _box.current.setFromObject(screen);
        _box.current.getCenter(_center.current);
        _box.current.getSize(_size.current);

        // Compute screen world normal from its local +Z
        screen.getWorldQuaternion(_quat.current);
        _normal.current.set(0, 0, 1).applyQuaternion(_quat.current).normalize();

        // Compute required camera distance to fit the entire screen in view
        const fovV = THREE.MathUtils.degToRad(camera.fov);
        const fovH = 2 * Math.atan(Math.tan(fovV / 2) * camera.aspect);
        const halfH = _size.current.y / 2;
        const halfW = _size.current.x / 2;
        const distV = halfH / Math.tan(fovV / 2);
        const distH = halfW / Math.tan(fovH / 2);
        const fitDist = Math.max(distV, distH) * (zoomMargin ?? 1.05);

        // Desired position is along the screen normal by (fit + offset)
        _desired.current.copy(_center.current).add(_normal.current.multiplyScalar(fitDist + zoomOffset));

        // Ease camera position and controls target
        camera.position.lerp(_desired.current, 0.08);
        controlsRef.current.target.lerp(_center.current, 0.1);
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
        onClick={!isMobile ? handleClick : undefined}
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <Computer {...restProps} />
      </group>
      <OrbitControls
        ref={controlsRef}
        enablePan={isMobile ? false : true} // Disable pan on mobile to prevent conflicts
        enableZoom={isMobile ? false : false} // Keep zoom disabled
        enableRotate={true}
        // More restrictive controls for mobile
        minPolarAngle={isMobile ? Math.PI / 2 - Math.PI / 36 : Math.PI / 2 - Math.PI / 18} // 85° vs 80°
        maxPolarAngle={Math.PI / 2} // 90° (exactly horizontal, never below)
        minAzimuthAngle={isMobile ? -Math.PI / 36 : -Math.PI / 18} // -5° vs -10°
        maxAzimuthAngle={isMobile ? Math.PI / 36 : Math.PI / 18} // +5° vs +10°
        // Touch settings for mobile
        touches={{
          ONE: isMobile ? THREE.TOUCH.ROTATE : THREE.TOUCH.ROTATE,
          TWO: isMobile ? THREE.TOUCH.DOLLY_ROTATE : THREE.TOUCH.DOLLY_PAN
        }}
        rotateSpeed={isMobile ? 0.5 : 1} // Slower rotation on mobile
        dampingFactor={isMobile ? 0.1 : 0.05} // More damping on mobile for smoother feel
        enableDamping={true}
        onChange={(e) => {
          // fires every time user changes controls
          const z = e.target.object.position.z;
          if (z < 3) {
            controlsRef.current.enabled = false;
          } else {
            controlsRef.current.enabled = true;
          }
        }}
      />
    </>
  );
}
