import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';

export default function RealmPortal({ realm, position, rotation = [0, 0, 0] }) {
  const groupRef = useRef();
  const ringRef = useRef();
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = clock.elapsedTime * 0.5;
      ringRef.current.rotation.x = Math.sin(clock.elapsedTime) * 0.1;
    }
    if (groupRef.current) {
      // Gentle float
      groupRef.current.position.y = position[1] + Math.sin(clock.elapsedTime * 2) * 0.1;
    }
  });

  const handleEnter = () => {
    // Navigate via standard window location to trigger full route change
    window.location.href = realm.path;
  };

  return (
    <group 
      position={position} 
      rotation={rotation} 
      ref={groupRef}
      onPointerOver={() => {
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
      onClick={(e) => {
        e.stopPropagation();
        handleEnter();
      }}
    >
      {/* Outer Rotating Portal Ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2, 0.05, 16, 100]} />
        <meshStandardMaterial 
          color={realm.color} 
          emissive={realm.color} 
          emissiveIntensity={hovered ? 1.5 : 0.5} 
          wireframe={!hovered}
        />
      </mesh>
      
      {/* Floating Glowing Core */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshStandardMaterial 
          color={realm.color} 
          emissive={realm.color} 
          emissiveIntensity={hovered ? 2 : 0.8} 
        />
        <pointLight color={realm.color} intensity={hovered ? 2 : 1} distance={8} />
      </mesh>

      {/* Title Label */}
      <Text
        position={[0, 3, 0]}
        fontSize={0.5}
        color={hovered ? '#ffffff' : realm.color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#000000"
        font={undefined}
      >
        {realm.label}
      </Text>
      
      {/* Description (Only shows on hover) */}
      {hovered && (
        <Text
          position={[0, -2.5, 0]}
          fontSize={0.25}
          color="#d1d5db"
          anchorX="center"
          anchorY="middle"
          maxWidth={4}
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {realm.description}
        </Text>
      )}
    </group>
  );
}
