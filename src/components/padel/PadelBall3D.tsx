'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type PadelBall3DProps = {
  className?: string;
};

const BALL_MODEL_PATH = '/models/haahaa.glb';
const BALL_DISPLAY_DIAMETER = 3.05;

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }
  material.dispose();
}

function disposeScene(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      disposeMaterial(mesh.material);
    }
  });
}

function fitModelToBall(model: THREE.Object3D) {
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z);

  if (maxAxis <= 0) return;

  model.position.sub(center);
  model.scale.setScalar(BALL_DISPLAY_DIAMETER / maxAxis);
}

function prepareModel(model: THREE.Object3D) {
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      material.side = THREE.DoubleSide;
      material.needsUpdate = true;
    });
  });
}

export function PadelBall3D({ className = '' }: PadelBall3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.18, 6);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.width = '100%';
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    let disposed = false;
    const loader = new GLTFLoader();
    loader.load(
      BALL_MODEL_PATH,
      (gltf) => {
        if (disposed) {
          disposeScene(gltf.scene);
          return;
        }

        const model = gltf.scene;
        prepareModel(model);
        fitModelToBall(model);
        group.add(model);

        if (reduceMotion) {
          renderer.render(scene, camera);
        }
      },
      undefined,
      () => {
        if (reduceMotion) {
          renderer.render(scene, camera);
        }
      },
    );

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(2.15, 36, 36),
      new THREE.MeshBasicMaterial({
        color: 0xf6efe4,
        opacity: 0.075,
        transparent: true,
        side: THREE.BackSide,
      }),
    );
    group.add(halo);

    const particleCount = 80;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      const radius = 2.4 + Math.random() * 2.2;
      const angle = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 4;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        color: 0xf6efe4,
        size: 0.018,
        transparent: true,
        opacity: 0.44,
      }),
    );
    scene.add(particles);

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    const burgundyLight = new THREE.PointLight(0x801917, 11, 8);
    burgundyLight.position.set(-3.2, -1.2, 2.8);
    scene.add(burgundyLight);

    const goldLight = new THREE.PointLight(0xd4bb72, 10, 7);
    goldLight.position.set(2.2, 2.4, 2.6);
    scene.add(goldLight);

    const pointer = { x: 0, y: 0 };
    const easedPointer = { x: 0, y: 0 };
    const startedAt = performance.now();
    let frame = 0;

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      if (reduceMotion) {
        renderer.render(scene, camera);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };

    const handlePointerLeave = () => {
      pointer.x = 0;
      pointer.y = 0;
    };

    const render = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      easedPointer.x += (pointer.x - easedPointer.x) * 0.045;
      easedPointer.y += (pointer.y - easedPointer.y) * 0.045;

      group.rotation.y = elapsed * 0.22 + easedPointer.x * 0.35;
      group.rotation.x = 0.12 + Math.sin(elapsed * 0.55) * 0.06 + easedPointer.y * 0.18;
      group.rotation.z = Math.sin(elapsed * 0.35) * 0.035;
      halo.scale.setScalar(1 + Math.sin(elapsed * 1.25) * 0.025);
      particles.rotation.y = -elapsed * 0.035;
      particles.rotation.x = Math.sin(elapsed * 0.2) * 0.05;

      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    mount.addEventListener('pointermove', handlePointerMove, { passive: true });
    mount.addEventListener('pointerleave', handlePointerLeave);

    resize();
    if (!reduceMotion) {
      render();
    }

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      mount.removeEventListener('pointermove', handlePointerMove);
      mount.removeEventListener('pointerleave', handlePointerLeave);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      disposeScene(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      role="img"
      aria-label="Animated white padel tournament ball"
      className={`h-full min-h-[320px] w-full ${className}`}
    />
  );
}
