"use client";

import { memo, useRef, useEffect, useState, Suspense, useMemo, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sphere, Line, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useAptosStream } from "@/hooks/useAptosStream";
import { useVisibility } from "@/hooks/useVisibility";
import { useNetwork } from "@/contexts/NetworkContext";

// Base validator node locations (16 major data center cities)
const BASE_LOCATIONS = [
  { lat: 37.7749, lon: -122.4194, name: "San Francisco" },
  { lat: 40.7128, lon: -74.006, name: "New York" },
  { lat: 47.6062, lon: -122.3321, name: "Seattle" },
  { lat: 51.5074, lon: -0.1278, name: "London" },
  { lat: 52.52, lon: 13.405, name: "Berlin" },
  { lat: 48.8566, lon: 2.3522, name: "Paris" },
  { lat: 50.1109, lon: 8.6821, name: "Frankfurt" },
  { lat: 35.6762, lon: 139.6503, name: "Tokyo" },
  { lat: 1.3521, lon: 103.8198, name: "Singapore" },
  { lat: 22.3193, lon: 114.1694, name: "Hong Kong" },
  { lat: 37.5665, lon: 126.978, name: "Seoul" },
  { lat: -33.8688, lon: 151.2093, name: "Sydney" },
  { lat: 55.7558, lon: 37.6173, name: "Moscow" },
  { lat: 19.076, lon: 72.8777, name: "Mumbai" },
  { lat: -23.5505, lon: -46.6333, name: "São Paulo" },
  { lat: 25.2048, lon: 55.2708, name: "Dubai" },
];

// Generate validator locations based on network
// Mainnet: 120 validators clustered around major cities
// Testnet: 16 validators (one per city)
function generateValidatorLocations(network: "mainnet" | "testnet") {
  if (network === "testnet") {
    return BASE_LOCATIONS;
  }

  // For mainnet, generate 120 validators clustered around the 16 cities
  const locations: typeof BASE_LOCATIONS = [];
  const validatorsPerCity = Math.floor(120 / BASE_LOCATIONS.length); // ~7-8 per city
  const extraValidators = 120 - (validatorsPerCity * BASE_LOCATIONS.length);

  // Seeded random for consistent positions
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  BASE_LOCATIONS.forEach((city, cityIndex) => {
    // Add extra validator to first few cities to reach 120
    const count = validatorsPerCity + (cityIndex < extraValidators ? 1 : 0);

    for (let i = 0; i < count; i++) {
      // Spread validators within ~3 degrees of the city center
      const seed = cityIndex * 100 + i;
      const latOffset = (seededRandom(seed) - 0.5) * 6;
      const lonOffset = (seededRandom(seed + 50) - 0.5) * 6;

      locations.push({
        lat: city.lat + latOffset,
        lon: city.lon + lonOffset,
        name: `${city.name} ${i + 1}`,
      });
    }
  });

  return locations;
}

// For arc routing, still use the base 16 locations
const NODE_LOCATIONS = BASE_LOCATIONS;

// Known validator names (testnet + mainnet)
const VALIDATOR_NAMES: Record<string, string> = {
  // ========== TESTNET VALIDATORS ==========
  "0x479ca442491cfd636f84fa8e56fa420c8038587e459e886d16a0b9d3993b16ba": "Aptos Labs",
  "0x286e8af6717ef6b1e361aae8ab28dd6664bf562c2805dd9a53432246ec66566e": "Aptos Labs",
  "0x3c04549114877c55f45649aba48ac0a4ff086ab7bdce3b8cc8d3d9947bc0d99": "Aptos Labs",
  "0x12000330d7cd8a748f46c25e6ce5d236a27e13d0b510d4516ac84ecc5fddd002": "Aptos Labs",
  "0x7a2ddb6af66beb0d9987c6c9010cb9053454f067e16775a8ecf19961195c3d28": "Aptos Labs",
  "0x116176e2af223a8b7f8db80dc52f7a423b4d7f8c0553a1747e92ef58849aff4f": "Aptos Labs",
  "0x676f640c90cb6c45f21be50974531d440309aa4ddad919ae0429039789a3d8a9": "Aptos Labs",
  "0x6bd8f1f3764a1f606e60aec0b1036c64027b83eeabbd17e4518b750831e478c2": "Aptos Labs",
  "0xa4113560d0b18ba38797f2a899c4b27e0c5b0476be5d8f6be68fba8b1861ed0": "Figment",
  "0xa562415be88d9f08ba98fa3f6af9be0e36580c0f8fff5100a50b519e8f4a15c9": "Bison Trails",
  "0x5176f2252762e527e3598c22f1bdb3a1ac0ff0db2d7518cabbc99305330a864a": "Bison Trails",
  "0xeecd6e9fb71f3a67db6321e93deecf7a9d7c3f4fac6cd170deb3e8b183281943": "Bison",
  "0x3e10fc198aaeaeef69b47f5459afddd5de9103c49996fe147fb1ce6bd55a7869": "OKX",
  "0xfd47a2fb988c959839ea2fe4d7169b48536a42bf5e4933790701a08252ba2039": "Moongate",
  "0xb7edb634fd856f3f39059cc5ebb184b3ec242f6bf2181c97e28a07f9ae25d6ba": "Staking Labs",
  "0xa5ed5d5e8c892165b18c2062596e8d1139fbb2cc451d430f787cd707122ce023": "Coinbase",
  "0x4bfdce4c722bf73ab016798870b4ded67c0bbd85db7ff6f8a6427e545e016618": "P2P",
  "0xba8a625321da287fe6aa0f8d4e4bd1c0c6e8b800574cd7b6c569bec3fd6a7a2c": "Staked",
  "0xed07d7561a545196640fc5c11cacf37260369d3ef699bdf0cadbe76f0e1ef30f": "Chorus One",
  "0xba324fd9be494a639ef9017403c438bd84cad2d7be90025f076230a36f734f42": "HashKey",
  "0xb92e93e2ef5ef0aa07871e498fc8340566495d2b1f172e40f37c52a6d8a79c37": "Everstake",

  // ========== MAINNET VALIDATORS ==========
  // Decoded from validator network addresses - ~138 active validators
  "0xeb5d1dfba88204036132b2bf4f4600f20822738e01985401ba45e75c464d1965": "Binance",
  "0x32ad233a939bfbafb8d9056c0ae2eba58828d8baf5582277578ced38477f0f14": "Coinbase Cloud",
  "0xc32f662cd9718f02d8a8e5628f8f642fa27cd9b5f457b406ed734901a4939e34": "Stakely",
  "0x324df1e27c4129a58d73851ae0e9366064dc666a73e747051e203694a4cb257": "RhinoStake",
  "0x3d654d35d558d6381fe6a0484d81c4fed128cd8adc1ca7a1482c297da80ee039": "Pontem Network",
  "0xf16cdebe221b819504c96014b81b0903fd345c3c066415a30ec75148358426dc": "Nodeswift",
  "0xc807d24a6ac70599cc9b72c649eb6b00c34a0e9c704447c44d75fade07213a26": "Republic Crypto",
  "0x6c8a3474cb49202515d121fea0f3217d303e41f6bdc43e615f1cd90855118089": "Metahash",
  "0xb3254509d1cd652d6e1ca06fd37f3d20aaa42f7faeaf297577b85cf92d2f7462": "Validation Cloud",
  "0x1c6a051d9a5ec4cf4200bab21a794d3afe8259d625f6b78aa4d01ab4652327d5": "Everstake",
  "0x649127a4d1b26b4cf936f7b795917dbcb571c59c2926ae473fe4d9df3575790e": "Aptos Labs",
  "0xb87476d8877cfc324a520cef4d0cd6e42e26ec3ce613a8127220e2e444561e16": "Asymmetric",
  "0x371dfdee9fbecaa358683936c5946aa28393067fa60e1e185c4250da461e15cf": "DSRV Labs",
  "0x4cc22e5d2e84794c3c672b0b34145898ee971a4ff042eabae23627547f6dac80": "Provalidator",
  "0xef191e643c2ed2d103de4109a506e020f5dde818cbc1ffe5e4ee36328cd22e9b": "P2P.org",
  "0x209154f6e735562ff13b963b91588039a162fa95f409c068f917f27b762dfff8": "Aptos Labs",
  "0x9a41af5c002f91dc29cb2843ab823e3d6cdaa6cc86e6331646a4f1328609a744": "Kiln",
  "0x3eaf3ebc49555c705c34ec1ffe77404bdb7383b388476c36538b92b7b1b806c9": "Aptos Labs",
  "0xb4a4f1ef8b0702d85547dc444571a473f736e1205a86db36dad13815ad9bbbf6": "Bware Labs",
  "0xa286a9187c86b4a3cef60478e5c61bb45757b795a8e6577ebbf0fa990db574cc": "Staked",
  "0xf05d2fe6618a3cb4258e94f2da24c1ee71ae4e7942b4f8b5836ad5267e59568f": "Blockdaemon",
  "0x8be2ba62bfd783e5fbff57a07acf2a9a95f4d234b3729fbfda9c63f3f42fb78f": "Figment",
  "0xff3e9c10dd3781a1e0750a75ae9e5b04133cd7e8ca18b9936ffcf3b2a2538a49": "Luganodes",
  "0x6099edbe54f242bad50020dfd67646b1e46282999483e7064e70f02f7ea3c15": "Bware Labs",
  "0x2ded75e99c6efbe143a9648a3e88ebf9d0cf249b2af44d510bdd0287e8adcc79": "Vestige",
  "0x9bfd93ebaa1efd65515642942a607eeca53a0188c04c21ced646d2f0b9f551e8": "Asymmetric",
  "0x2537e9d461d311dc6f1dee690f093b4e353f472abc2493c64275a3d5572532cc": "Figment",
  "0x39b844cb561d2a04c800164465e2eb2c2ea520499d718c35492244346da07b5f": "Twinstake",
  "0x7425cde20dc18a8e5e169614c47c0e4435fd1b6c475efdefbdbbb73785d331e3": "Envoys",
  "0x15d241369552ece871a16d865a4e9b96f5e6e6f8c7db5478e89af17845969c02": "Mirny",
  "0x550fe3956e44112599b8410404e0977e74cc5bcb59a11b0706da734cd0f9beb2": "Forest Staking",
  "0xa4a00989d8ecc6d116b2283503f58de94d7fc33fff9e28010868abeb70d7d051": "NodeReal",
  "0x4c7c21084620f9e55f50f292d1803e5fbcf55c6d850b24b5e64efef08d2aa428": "LidLid",
  "0xddf23883328d39d8cbb4fad97f0e4bd45827ea999b66aa2a1cffa76615b9ef01": "Talos Network",
  "0xeb87b07f24f6111b5ab41ef30700ad9da780454bdf257722a100e897076a67f": "Bison Trails",
  "0x9c721c79ee082aafcdd99b1a71a833accdc48dba1a9a1bc5b5f8cc47ff7d49c0": "Bison Trails",
  "0xed84b96729eeaca42cdd0b84c3df69f76c4378a0406595a958cf515cdb024b20": "Bison Trails",
  "0x29f3f84adbd1eba85bbbec33814924fddcdc9f51921d9cade0dd3b3fdf9170cd": "Polkachu",
  "0x52b0fd0daaf4f24ddf389768bf24be0a291aabbbdae4ec7b46bc7ed7df41cbe9": "Nodes Guru",
  "0x30952a7b88b02028e7c6c7209722cc047acaef85d3d303f375d8ea89fc6ba0c6": "Artifact Staking",
  "0x2fd1e866773ea3670cbef6dc6e952ba6fa13130a69fabc98ad234bd834c3bcaf": "Coinbase",
  "0x6be5d9afa759b48140a69c737e9b066270146c7065455d04c2c76842c3e23d4": "Lavender.Five",
  "0xb43fe1ef756cae4fefea16dad049fb0760b7d8593ace12527e302520d934d0d7": "Aptos Labs",
  "0x2784eb9f3b368be1db73256336014a01c02b1b06ab01df7387bb8945ca73045e": "Aptos Labs",
  "0xfc90c3e74dfb562827ef85dea5669beeca7717faee0c3ba520c3ab08f9b53135": "Flipside",
  "0x346361873c235e1a300fd67a2e8b7bd1ea3744001b2e0d1942317c4c8521f5dd": "Figment",
  "0xdb5247f859ce63dbe8940cf8773be722a60dcc594a8be9aca4b76abceb251b8e": "Everstake",
  "0xe2789cdac410113f017fa684bf08fbacd0877612d84464ae6e8474b56e5f21da": "Ankr",
  "0x877d09996086effe241b1a740d46675754c17f8620ee9be42c5c7e322ce1598c": "ZH Staking",
  "0x66fcc9a1275170c140988e8fdc5104fef09568bdd07930f44a290bf55a5550ee": "Juicy Stake",
  "0xa57ed536dea7ae3250790ab12fbb6ca6ae669bf4eac5a12446b8769e534082f8": "Toymak3rz",
  "0xce8294a77912a6802adf093ba15a4f09d2d3c85400d161a0022499de4e2aeb92": "Superfast",
  "0xbea2323e776d126d319e7f15bf41f624b8cfd19c0484e3b60e6d8ecf1810dd16": "SenseiNode",
  "0x63b0a7343c481fe176603e4e30cc5acc521c75d4310ce1b7b657c8168df66c66": "Kiln",
  "0x3edbf3e6444054c2a5a391221c9023882d0b2478576c445923a39b3bd0cde0a3": "Alcove",
  "0x33f0c333f6fcb9d1ef54d54093f0482b31bb0bdcd34bfa446e7416ff930453c0": "Twinstake",
  "0x880cb2b03f4158dc927fe6058c5b968636932d49fa1d2896a86bd849456455c7": "SenseiNode",
  "0x41484099cd0ab3821ddd330a0cb742cafd6a1621ec1b993f65a8c6c5108a114d": "NodeInfra",
  "0x88a47b3046d4a0d329f0f6d5f5e30c516ce5dd6b3df8a6ab1f1a6e5f6d0a9c4e": "Infstones",
  "0xaaa73d8e4c7b9f8da9b2da8e1f7f0c3b1a2a9c8e": "Aptos Labs",
};

// Get validator display name
function getValidatorName(address: string): string {
  if (!address) return "Unknown";
  const name = VALIDATOR_NAMES[address.toLowerCase()] || VALIDATOR_NAMES[address];
  if (name) return name;
  // Fallback to truncated address
  return truncateAddress(address);
}

// Map validator address to a location deterministically
function addressToLocationIndex(address: string): number {
  const hex = address.startsWith('0x') ? address.slice(2, 10) : address.slice(0, 8);
  return parseInt(hex, 16) % NODE_LOCATIONS.length;
}

function getValidatorLocation(address: string) {
  return NODE_LOCATIONS[addressToLocationIndex(address)];
}

// Truncate address for display
function truncateAddress(address: string): string {
  if (!address || address.length < 12) return address || '0x???';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Types for real-time validator data
interface ValidatorArc {
  id: number;
  fromAddress: string;
  from: { lat: number; lon: number; name: string };
  to: { lat: number; lon: number; name: string };
  progress: number;
  opacity: number;
  blockHeight: number;
  txCount: number;
  timestamp: number;
}

interface ActivityFeedItem {
  id: number;
  blockHeight: number;
  proposerAddress: string;
  proposerName: string;
  proposerCity: string;
  txCount: number;
  timestamp: number;
  opacity: number;
}

// Convert lat/lon to 3D position
function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// Generate smooth arc points with proper curve
function generateArcPoints(start: THREE.Vector3, end: THREE.Vector3, segments: number = 64): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const startNorm = start.clone().normalize();
  const endNorm = end.clone().normalize();
  const angle = startNorm.angleTo(endNorm);
  const maxHeight = Math.min(0.4, angle * 0.25);

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = new THREE.Vector3().lerpVectors(startNorm, endNorm, t).normalize();
    // Smooth sine curve for arc height
    const arcHeight = Math.sin(t * Math.PI) * maxHeight;
    point.multiplyScalar(1.02 + arcHeight);
    points.push(point);
  }
  return points;
}

// Flying arc with tadpole-style particles (inspired by 3d-earth)
function ProposalArc({ arc, onComplete }: { arc: ValidatorArc; onComplete: (id: number) => void }) {
  const progressRef = useRef(0);
  const trailRef = useRef<THREE.Points>(null);
  const completedRef = useRef(false);

  const { points, curve } = useMemo(() => {
    const start = latLonToVector3(arc.from.lat, arc.from.lon, 1);
    const end = latLonToVector3(arc.to.lat, arc.to.lon, 1);
    const pts = generateArcPoints(start, end, 80);
    return {
      points: pts,
      curve: new THREE.CatmullRomCurve3(pts)
    };
  }, [arc.from, arc.to]);

  // Colors from 3d-earth - orange/gold gradient
  const arcColor = "#f3ae76";
  const trailStartColor = new THREE.Color("#ff7714");
  const trailEndColor = new THREE.Color("#ec8f43");

  // Create tadpole trail geometry
  const { trailGeometry, trailMaterial } = useMemo(() => {
    const trailLength = 20; // Number of particles in trail
    const positions = new Float32Array(trailLength * 3);
    const colors = new Float32Array(trailLength * 3);
    const sizes = new Float32Array(trailLength);

    // Initialize with start position
    const startPos = points[0];
    for (let i = 0; i < trailLength; i++) {
      positions[i * 3] = startPos.x;
      positions[i * 3 + 1] = startPos.y;
      positions[i * 3 + 2] = startPos.z;

      // Gradient color from bright to dim
      const t = i / trailLength;
      const color = trailStartColor.clone().lerp(trailEndColor, t);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      // Size decreases along trail (tadpole effect)
      sizes[i] = (1 - t * 0.8) * 0.025;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.025,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { trailGeometry: geometry, trailMaterial: material };
  }, [points]);

  useFrame((_, delta) => {
    if (completedRef.current) return;

    progressRef.current += delta * 1.8; // Speed of travel

    if (progressRef.current >= 1) {
      completedRef.current = true;
      onComplete(arc.id);
      return;
    }

    // Update trail positions (tadpole follows the curve)
    if (trailRef.current) {
      const positions = trailRef.current.geometry.attributes.position.array as Float32Array;
      const trailLength = positions.length / 3;

      for (let i = 0; i < trailLength; i++) {
        // Each particle is slightly behind the previous
        const particleProgress = Math.max(0, progressRef.current - (i * 0.015));
        const pos = curve.getPoint(Math.min(particleProgress, 1));
        positions[i * 3] = pos.x;
        positions[i * 3 + 1] = pos.y;
        positions[i * 3 + 2] = pos.z;
      }

      trailRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Static arc path - subtle base line */}
      <Line
        points={points}
        color={arcColor}
        lineWidth={1}
        transparent
        opacity={0.3}
      />

      {/* Animated tadpole trail */}
      <points ref={trailRef} geometry={trailGeometry} material={trailMaterial} />
    </group>
  );
}

// Validator node with contrasting orange/gold color and optional label
function ValidatorNode({ lat, lon, name, small = false, showLabel = false }: { lat: number; lon: number; name: string; small?: boolean; showLabel?: boolean }) {
  const position = useMemo(() => latLonToVector3(lat, lon, 1.01), [lat, lon]);
  const waveRef = useRef<THREE.Mesh>(null);
  const scaleRef = useRef(Math.random() * 2); // Random start for variety

  // Orient the node to face outward from globe center
  const orientation = useMemo(() => {
    const normal = position.clone().normalize();
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    return quaternion;
  }, [position]);

  // Sizes - orange/gold for contrast against cyan borders
  const dotSize = small ? 0.008 : 0.015;
  const waveSize = small ? 0.02 : 0.04;

  // Animate pulsing wave
  useFrame((_, delta) => {
    if (waveRef.current) {
      scaleRef.current += delta * 0.6;
      if (scaleRef.current > 2.5) scaleRef.current = 1;

      const scale = scaleRef.current;
      waveRef.current.scale.set(scale, scale, 1);

      // Fade out as it expands
      const material = waveRef.current.material as THREE.MeshBasicMaterial;
      if (scale <= 1.5) {
        material.opacity = (scale - 1) * 0.6;
      } else {
        material.opacity = Math.max(0, 0.6 - (scale - 1.5) * 0.6);
      }
    }
  });

  return (
    <group position={position} quaternion={orientation}>
      {/* Pulsing wave ring - orange glow */}
      <mesh ref={waveRef}>
        <ringGeometry args={[waveSize * 0.7, waveSize, 20]} />
        <meshBasicMaterial
          color="#FF8C00"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Outer glow */}
      <mesh>
        <circleGeometry args={[dotSize * 2.5, 16]} />
        <meshBasicMaterial
          color="#FF6B00"
          transparent
          opacity={0.25}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Core bright dot - bright orange/gold */}
      <mesh>
        <circleGeometry args={[dotSize, 16]} />
        <meshBasicMaterial
          color="#FFD700"
          transparent
          opacity={1}
          depthWrite={false}
        />
      </mesh>

      {/* Inner bright center */}
      <mesh>
        <circleGeometry args={[dotSize * 0.5, 12]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// City label that floats above the globe
function CityLabel({ lat, lon, name }: { lat: number; lon: number; name: string }) {
  const position = useMemo(() => latLonToVector3(lat, lon, 1.08), [lat, lon]);

  // Create a sprite texture for the label
  const { texture, aspectRatio } = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;

    // Transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Text settings
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Text shadow/glow
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(name, canvas.width / 2, canvas.height / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;

    return { texture: tex, aspectRatio: canvas.width / canvas.height };
  }, [name]);

  const scale = 0.08;

  return (
    <sprite position={position} scale={[scale * aspectRatio, scale, 1]}>
      <spriteMaterial
        map={texture}
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </sprite>
  );
}

// Globe surface with texture - using drei's useTexture for better loading
function GlobeSurfaceTextured() {
  // Try to use the 3d-earth texture if available, fallback to earth-night.jpg
  const texture = useTexture('/earth.jpg');

  useEffect(() => {
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 16;
    }
  }, [texture]);

  return (
    <>
      {/* Main earth sphere */}
      <Sphere args={[1, 64, 64]}>
        <meshBasicMaterial map={texture} />
      </Sphere>
      {/* Particle halo effect around globe */}
      <ParticleHalo />
    </>
  );
}

// Particle halo effect - spread out around globe
function ParticleHalo() {
  const pointsRef = useRef<THREE.Points>(null);

  const { geometry, material } = useMemo(() => {
    // Create scattered particles in a shell around the globe
    const particleCount = 2000;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      // Random position on a sphere shell between radius 1.05 and 1.25
      const radius = 1.05 + Math.random() * 0.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      // Blue-cyan color with some variation
      const color = new THREE.Color().setHSL(0.55 + Math.random() * 0.1, 0.8, 0.6);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      // Varying sizes
      sizes[i] = 0.003 + Math.random() * 0.005;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      size: 0.008,
      vertexColors: true,
      transparent: true,
      opacity: 0.15,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { geometry: geo, material: mat };
  }, []);

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

// Fallback globe surface (dark with grid lines)
function GlobeSurfaceFallback() {
  return (
    <group>
      {/* Dark sphere base */}
      <Sphere args={[1, 64, 64]}>
        <meshBasicMaterial color="#0a0a1a" />
      </Sphere>
      {/* Grid lines for visual interest */}
      <Sphere args={[1.001, 32, 32]}>
        <meshBasicMaterial color="#1a2a3a" wireframe transparent opacity={0.3} />
      </Sphere>
    </group>
  );
}

// Globe with earth texture - with fallback
function GlobeSurface() {
  return (
    <Suspense fallback={<GlobeSurfaceFallback />}>
      <GlobeSurfaceTextured />
    </Suspense>
  );
}

// Subtle atmosphere glow - thin edge highlight only
function GlowingAtmosphere() {
  // Very subtle edge glow - just a thin rim light
  const edgeShader = useMemo(() => ({
    uniforms: {
      glowColor: { value: new THREE.Color('#4FC3F7') },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPositionNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      varying vec3 vNormal;
      varying vec3 vPositionNormal;
      void main() {
        float intensity = pow(0.5 - dot(vNormal, vPositionNormal), 4.0);
        gl_FragColor = vec4(glowColor, intensity * 0.3);
      }
    `
  }), []);

  return (
    <>
      {/* Very thin edge glow only */}
      <mesh scale={1.015}>
        <sphereGeometry args={[1, 48, 48]} />
        <shaderMaterial
          {...edgeShader}
          transparent
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}


// Create a beautiful star texture with cross flare
function createStarTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const cx = 64, cy = 64;

  // Clear with transparency
  ctx.clearRect(0, 0, 128, 128);

  // Outer soft glow - wider and more visible
  const outerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 64);
  outerGlow.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
  outerGlow.addColorStop(0.05, 'rgba(255, 255, 255, 0.4)');
  outerGlow.addColorStop(0.15, 'rgba(220, 240, 255, 0.25)');
  outerGlow.addColorStop(0.35, 'rgba(180, 210, 255, 0.1)');
  outerGlow.addColorStop(0.6, 'rgba(150, 180, 255, 0.03)');
  outerGlow.addColorStop(1, 'rgba(100, 150, 255, 0)');
  ctx.fillStyle = outerGlow;
  ctx.fillRect(0, 0, 128, 128);

  // Core bright center - super bright
  const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16);
  coreGlow.addColorStop(0, 'rgba(255, 255, 255, 1)');
  coreGlow.addColorStop(0.15, 'rgba(255, 255, 255, 1)');
  coreGlow.addColorStop(0.4, 'rgba(255, 255, 255, 0.8)');
  coreGlow.addColorStop(0.7, 'rgba(240, 250, 255, 0.3)');
  coreGlow.addColorStop(1, 'rgba(200, 230, 255, 0)');
  ctx.fillStyle = coreGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, 16, 0, Math.PI * 2);
  ctx.fill();

  // Prominent 4-point star flare
  ctx.globalCompositeOperation = 'lighter';

  // Horizontal flare
  const flareH = ctx.createLinearGradient(cx - 50, cy, cx + 50, cy);
  flareH.addColorStop(0, 'rgba(200, 230, 255, 0)');
  flareH.addColorStop(0.3, 'rgba(220, 240, 255, 0.2)');
  flareH.addColorStop(0.45, 'rgba(255, 255, 255, 0.5)');
  flareH.addColorStop(0.5, 'rgba(255, 255, 255, 0.7)');
  flareH.addColorStop(0.55, 'rgba(255, 255, 255, 0.5)');
  flareH.addColorStop(0.7, 'rgba(220, 240, 255, 0.2)');
  flareH.addColorStop(1, 'rgba(200, 230, 255, 0)');
  ctx.fillStyle = flareH;
  ctx.fillRect(cx - 50, cy - 3, 100, 6);

  // Vertical flare
  const flareV = ctx.createLinearGradient(cx, cy - 50, cx, cy + 50);
  flareV.addColorStop(0, 'rgba(200, 230, 255, 0)');
  flareV.addColorStop(0.3, 'rgba(220, 240, 255, 0.2)');
  flareV.addColorStop(0.45, 'rgba(255, 255, 255, 0.5)');
  flareV.addColorStop(0.5, 'rgba(255, 255, 255, 0.7)');
  flareV.addColorStop(0.55, 'rgba(255, 255, 255, 0.5)');
  flareV.addColorStop(0.7, 'rgba(220, 240, 255, 0.2)');
  flareV.addColorStop(1, 'rgba(200, 230, 255, 0)');
  ctx.fillStyle = flareV;
  ctx.fillRect(cx - 3, cy - 50, 6, 100);

  // Diagonal flares for extra sparkle
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = flareH;
  ctx.fillRect(-35, -2, 70, 4);
  ctx.fillStyle = flareV;
  ctx.fillRect(-2, -35, 4, 70);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Create a soft dot for small background stars with subtle sparkle
function createSmallStarTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const cx = 32, cy = 32;

  ctx.clearRect(0, 0, 64, 64);

  // Soft outer glow
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.1, 'rgba(255, 255, 255, 0.9)');
  gradient.addColorStop(0.25, 'rgba(240, 250, 255, 0.5)');
  gradient.addColorStop(0.5, 'rgba(200, 225, 255, 0.15)');
  gradient.addColorStop(1, 'rgba(150, 180, 255, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  // Tiny cross for subtle sparkle
  ctx.globalCompositeOperation = 'lighter';
  const sparkleGrad = ctx.createLinearGradient(cx - 16, cy, cx + 16, cy);
  sparkleGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  sparkleGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.2)');
  sparkleGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
  sparkleGrad.addColorStop(0.6, 'rgba(255, 255, 255, 0.2)');
  sparkleGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sparkleGrad;
  ctx.fillRect(cx - 16, cy - 1, 32, 2);
  ctx.fillRect(cx - 1, cy - 16, 2, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Globe glow/shadow for contrast against background
function GlobeGlow() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Clear
    ctx.clearRect(0, 0, 512, 512);

    // Large soft glow
    const gradient = ctx.createRadialGradient(256, 256, 50, 256, 256, 256);
    gradient.addColorStop(0, 'rgba(60, 140, 220, 0.35)');
    gradient.addColorStop(0.2, 'rgba(40, 100, 180, 0.25)');
    gradient.addColorStop(0.4, 'rgba(30, 70, 140, 0.15)');
    gradient.addColorStop(0.7, 'rgba(20, 50, 100, 0.05)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  return (
    <sprite scale={[5, 5, 1]} position={[0, 0, -0.3]}>
      <spriteMaterial
        map={texture}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </sprite>
  );
}

// Beautiful layered starfield with twinkling
function TwinklingStars() {
  const brightStarsRef = useRef<THREE.Points>(null);
  const dimStarsRef = useRef<THREE.Points>(null);
  const twinkleDataRef = useRef<{ phase: number; speed: number; baseSize: number; baseColor: [number, number, number] }[]>([]);

  // Bright foreground stars with flares
  const { brightGeometry, brightMaterial } = useMemo(() => {
    const starCount = 200;
    const vertices: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    const starTexture = createStarTexture();

    twinkleDataRef.current = [];

    for (let i = 0; i < starCount; i++) {
      const radius = 60 + Math.random() * 300;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      vertices.push(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );

      // Color variation for bright stars
      const colorChoice = Math.random();
      let color: THREE.Color;
      if (colorChoice < 0.4) {
        color = new THREE.Color(0xffffff); // Pure white
      } else if (colorChoice < 0.6) {
        color = new THREE.Color(0xcce5ff); // Blue-white
      } else if (colorChoice < 0.75) {
        color = new THREE.Color(0xfff8e7); // Warm white
      } else if (colorChoice < 0.9) {
        color = new THREE.Color(0xaaccff); // Light blue
      } else {
        color = new THREE.Color(0xffd700); // Golden (rare)
      }
      colors.push(color.r, color.g, color.b);

      const baseSize = 5 + Math.random() * 10;
      sizes.push(baseSize);

      twinkleDataRef.current.push({
        phase: Math.random() * Math.PI * 2,
        speed: 1 + Math.random() * 3,
        baseSize,
        baseColor: [color.r, color.g, color.b]
      });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      size: 8,
      map: starTexture,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { brightGeometry: geo, brightMaterial: mat };
  }, []);

  // Dim background stars - lots of tiny dots with subtle twinkle
  const dimTwinkleRef = useRef<{ phase: number; speed: number; baseSize: number }[]>([]);
  const { dimGeometry, dimMaterial } = useMemo(() => {
    const starCount = 2500;
    const vertices: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    const smallStarTexture = createSmallStarTexture();

    dimTwinkleRef.current = [];

    for (let i = 0; i < starCount; i++) {
      const radius = 80 + Math.random() * 500;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      vertices.push(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );

      // Mostly white/blue-white with subtle variation
      const brightness = 0.6 + Math.random() * 0.4;
      const hue = Math.random() < 0.8
        ? 0.55 + Math.random() * 0.15  // Blue-white
        : Math.random() < 0.5
          ? 0.08 + Math.random() * 0.05  // Warm white/yellow
          : 0.0;  // Pure white
      const color = new THREE.Color().setHSL(
        hue,
        0.05 + Math.random() * 0.15,
        brightness
      );
      colors.push(color.r, color.g, color.b);

      const baseSize = 1 + Math.random() * 2.5;
      sizes.push(baseSize);

      dimTwinkleRef.current.push({
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.8,
        baseSize
      });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      size: 3,
      map: smallStarTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { dimGeometry: geo, dimMaterial: mat };
  }, []);

  // Animate twinkling for all stars
  useFrame((state) => {
    const time = state.clock.elapsedTime;

    // Bright stars - dramatic sparkle
    if (brightStarsRef.current && brightGeometry.attributes.size) {
      const sizes = brightGeometry.attributes.size.array as Float32Array;
      const colors = brightGeometry.attributes.color.array as Float32Array;

      for (let i = 0; i < twinkleDataRef.current.length; i++) {
        const data = twinkleDataRef.current[i];
        // Multiple sine waves for more organic twinkling
        const wave1 = Math.sin(time * data.speed + data.phase);
        const wave2 = Math.sin(time * data.speed * 1.7 + data.phase * 0.5);
        const wave3 = Math.sin(time * data.speed * 0.3 + data.phase * 2);

        // Combine waves with power for sharper sparkle peaks
        const combined = (wave1 + wave2 * 0.5 + wave3 * 0.3) / 1.8;
        const sparkle = Math.pow((combined + 1) * 0.5, 0.7);

        // Size varies dramatically (0.3 to 1.5x base size)
        sizes[i] = data.baseSize * (0.3 + sparkle * 1.2);

        // Brightness pulses with the twinkle - use base colors
        const brightness = 0.5 + sparkle * 0.5;
        const idx = i * 3;
        colors[idx] = Math.min(1, data.baseColor[0] * brightness);
        colors[idx + 1] = Math.min(1, data.baseColor[1] * brightness);
        colors[idx + 2] = Math.min(1, data.baseColor[2] * brightness);
      }
      brightGeometry.attributes.size.needsUpdate = true;
      brightGeometry.attributes.color.needsUpdate = true;
    }

    // Dim stars - subtle shimmer
    if (dimStarsRef.current && dimGeometry.attributes.size) {
      const dimSizes = dimGeometry.attributes.size.array as Float32Array;

      // Only update every few frames for performance
      if (Math.floor(time * 10) % 2 === 0) {
        for (let i = 0; i < dimTwinkleRef.current.length; i++) {
          const data = dimTwinkleRef.current[i];
          const shimmer = (Math.sin(time * data.speed + data.phase) + 1) * 0.5;
          // Subtle size variation (0.7 to 1.3x)
          dimSizes[i] = data.baseSize * (0.7 + shimmer * 0.6);
        }
        dimGeometry.attributes.size.needsUpdate = true;
      }
    }
  });

  return (
    <group>
      {/* Dim background layer */}
      <points ref={dimStarsRef} geometry={dimGeometry} material={dimMaterial} />
      {/* Bright twinkling foreground layer */}
      <points ref={brightStarsRef} geometry={brightGeometry} material={brightMaterial} />
    </group>
  );
}

// Clean scene with all effects
function GlobeScene({ arcs, onArcComplete, network }: { arcs: ValidatorArc[]; onArcComplete: (id: number) => void; network: "mainnet" | "testnet" }) {
  const groupRef = useRef<THREE.Group>(null);

  // Generate validator locations based on network
  const validatorLocations = useMemo(() => generateValidatorLocations(network), [network]);

  // Auto-rotation - faster spin
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15;
    }
  });

  return (
    <>
      {/* Lighting - ambient + directional for depth */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 3, 5]} intensity={0.8} color="#ffffff" />
      <pointLight position={[-5, -3, -5]} intensity={0.3} color="#6B5BFF" />

      {/* Twinkling stars background */}
      <TwinklingStars />

      {/* Globe glow for contrast against dark background */}
      <GlobeGlow />

      <group ref={groupRef}>
        {/* Globe with glowing atmosphere */}
        <GlobeSurface />
        <GlowingAtmosphere />

        {/* City labels for major data centers */}
        {BASE_LOCATIONS.map((city, i) => (
          <CityLabel
            key={`label-${i}`}
            lat={city.lat}
            lon={city.lon}
            name={city.name}
          />
        ))}

        {/* Validator nodes - different count based on network */}
        {validatorLocations.map((node, i) => (
          <ValidatorNode
            key={`${network}-${i}`}
            lat={node.lat}
            lon={node.lon}
            name={node.name}
            small={network === "mainnet"}
          />
        ))}

        {/* Active arcs */}
        {arcs.map((arc) => (
          <ProposalArc key={arc.id} arc={arc} onComplete={onArcComplete} />
        ))}
      </group>

      <OrbitControls
        enableZoom={true}
        enablePan={false}
        rotateSpeed={0.5}
        zoomSpeed={0.5}
        minDistance={1.8}
        maxDistance={4}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  );
}

function Loader() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );
}

// Activity feed overlay - fixed height rows to prevent shifting
function ActivityFeed({ items, fullscreen = false }: { items: ActivityFeedItem[]; fullscreen?: boolean }) {
  // Always show 6 slots to prevent height changes
  const slots = 6;
  const rowHeight = fullscreen ? 24 : 18; // Fixed row height in pixels
  const headerHeight = fullscreen ? 32 : 24;

  return (
    <div className={`absolute pointer-events-none ${
      fullscreen ? 'bottom-16 right-4 w-72' : 'bottom-10 right-2 w-56'
    }`}>
      {/* Feed container with subtle glass effect */}
      <div className="bg-black/70 backdrop-blur-sm rounded-lg border border-white/10 overflow-hidden">
        {/* Header */}
        <div
          className={`border-b border-white/10 ${fullscreen ? 'px-3' : 'px-2'}`}
          style={{ height: headerHeight, display: 'flex', alignItems: 'center' }}
        >
          <div className={`font-medium text-gray-300 ${fullscreen ? 'text-xs' : 'text-[10px]'}`}>
            Recent Blocks
          </div>
        </div>
        {/* Feed items - fixed height container */}
        <div style={{ minHeight: slots * rowHeight, height: slots * rowHeight }}>
          {Array.from({ length: slots }).map((_, idx) => {
            const item = items[idx];
            // Show item if it exists, otherwise show empty placeholder row
            const hasItem = item && item.opacity > 0.01;
            return (
              <div
                key={idx}
                className={`flex items-center justify-between border-b border-white/5 last:border-0 ${
                  fullscreen ? 'px-3' : 'px-2'
                }`}
                style={{
                  height: rowHeight,
                  opacity: hasItem ? item.opacity : 0,
                  transition: 'opacity 0.15s ease-out',
                  visibility: hasItem ? 'visible' : 'hidden'
                }}
              >
                {hasItem ? (
                  <>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`font-mono text-gray-500 ${fullscreen ? 'text-xs' : 'text-[9px]'}`}>
                        #{item.blockHeight.toLocaleString()}
                      </span>
                      <span className={`text-emerald-400 truncate ${fullscreen ? 'text-xs' : 'text-[9px]'}`}>
                        {item.proposerName}
                      </span>
                    </div>
                    <span className={`font-mono text-amber-400/80 flex-shrink-0 ${fullscreen ? 'text-xs' : 'text-[9px]'}`}>
                      {item.txCount} tx
                    </span>
                  </>
                ) : (
                  // Empty placeholder - maintains row height without visible content
                  <div className="flex items-center gap-2 min-w-0 w-full opacity-0">
                    <span className={`font-mono ${fullscreen ? 'text-xs' : 'text-[9px]'}`}>#000,000,000</span>
                    <span className={`${fullscreen ? 'text-xs' : 'text-[9px]'}`}>Placeholder</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface GlobeVisualizerProps {
  fullscreen?: boolean;
}

export const GlobeVisualizer = memo(function GlobeVisualizer({ fullscreen = false }: GlobeVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [arcs, setArcs] = useState<ValidatorArc[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const arcIdRef = useRef(0);
  const feedIdRef = useRef(0);
  const lastBlockRef = useRef(0);

  const { stats, connected } = useAptosStream();
  const { network } = useNetwork();
  const isVisible = useVisibility(containerRef);

  // Reset state when network changes
  useEffect(() => {
    setArcs([]);
    setActivityFeed([]);
    lastBlockRef.current = 0;
    feedIdRef.current = 0;
    arcIdRef.current = 0;
  }, [network]);

  // Generate demo arcs when not connected
  useEffect(() => {
    if (connected || !isVisible) return;

    const interval = setInterval(() => {
      const fromIdx = Math.floor(Math.random() * NODE_LOCATIONS.length);
      const from = NODE_LOCATIONS[fromIdx];

      // Pick 1-2 destinations for broadcast effect
      const numArcs = Math.random() > 0.5 ? 2 : 1;
      const newArcs: ValidatorArc[] = [];

      for (let i = 0; i < numArcs; i++) {
        let toIdx = Math.floor(Math.random() * NODE_LOCATIONS.length);
        while (toIdx === fromIdx) {
          toIdx = Math.floor(Math.random() * NODE_LOCATIONS.length);
        }
        const to = NODE_LOCATIONS[toIdx];

        newArcs.push({
          id: arcIdRef.current++,
          fromAddress: `0x${Math.random().toString(16).slice(2, 10)}`,
          from: { lat: from.lat, lon: from.lon, name: from.name },
          to: { lat: to.lat, lon: to.lon, name: to.name },
          progress: 0,
          opacity: 1,
          blockHeight: 0,
          txCount: Math.floor(Math.random() * 40) + 5,
          timestamp: Date.now(),
        });
      }

      setArcs((prev) => [...prev, ...newArcs].slice(-8));
    }, 1500);

    return () => clearInterval(interval);
  }, [connected, isVisible]);

  // Add arcs on new blocks using REAL proposer data
  useEffect(() => {
    if (!stats.recentBlocks?.length || !isVisible) return;

    // Get the NEWEST block (first in array, sorted descending by height)
    const latestBlock = stats.recentBlocks[0];
    if (!latestBlock || latestBlock.blockHeight === lastBlockRef.current) return;

    lastBlockRef.current = latestBlock.blockHeight;

    // Get proposer address (use real data if available)
    const proposerAddress = latestBlock.proposer || `0x${Math.random().toString(16).slice(2, 18)}`;
    const fromLocation = getValidatorLocation(proposerAddress);
    const txCount = latestBlock.txCount || 1;

    // Create 1-3 arcs per block (broadcast simulation)
    const numArcs = Math.min(3, Math.max(1, Math.floor(txCount / 15)));
    const newArcs: ValidatorArc[] = [];
    const fromIdx = addressToLocationIndex(proposerAddress);

    for (let i = 0; i < numArcs; i++) {
      let destIdx = Math.floor(Math.random() * NODE_LOCATIONS.length);
      while (destIdx === fromIdx) {
        destIdx = Math.floor(Math.random() * NODE_LOCATIONS.length);
      }
      const toLocation = NODE_LOCATIONS[destIdx];

      newArcs.push({
        id: arcIdRef.current++,
        fromAddress: proposerAddress,
        from: { lat: fromLocation.lat, lon: fromLocation.lon, name: fromLocation.name },
        to: { lat: toLocation.lat, lon: toLocation.lon, name: toLocation.name },
        progress: 0,
        opacity: 1,
        blockHeight: latestBlock.blockHeight,
        txCount: txCount,
        timestamp: Date.now(),
      });
    }

    setArcs((prev) => [...prev, ...newArcs].slice(-10));

    // Add to activity feed - show more items
    setActivityFeed((prev) => [{
      id: feedIdRef.current++,
      blockHeight: latestBlock.blockHeight,
      proposerAddress,
      proposerName: getValidatorName(proposerAddress),
      proposerCity: fromLocation.name,
      txCount,
      timestamp: Date.now(),
      opacity: 1,
    }, ...prev].slice(0, 8));

  }, [stats.recentBlocks, isVisible]);

  // Remove completed arcs
  const handleArcComplete = useCallback((id: number) => {
    setArcs((prev) => prev.filter((arc) => arc.id !== id));
  }, []);

  // Fade out activity feed items - faster cycle
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setActivityFeed((prev) =>
        prev
          .map((item) => {
            const age = (Date.now() - item.timestamp) / 1000;
            // Stay full for 5s, then fade over 4s (total 9s visible)
            const newOpacity = age < 5 ? 1 : Math.max(0, 1 - (age - 5) / 4);
            return { ...item, opacity: newOpacity };
          })
          .filter((item) => item.opacity > 0.05)
      );
    }, 100);

    return () => clearInterval(interval);
  }, [isVisible]);

  // Validator counts by network
  const validatorCount = network === "mainnet" ? 120 : 16;

  // Adjust camera for fullscreen mode - zoom out more on mobile
  const cameraPosition: [number, number, number] = fullscreen ? [0, 0, 4.2] : [0, 0.2, 4.0];

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden h-full ${fullscreen ? '' : 'rounded-xl min-h-[400px]'}`}
      style={{
        background: "radial-gradient(ellipse at 50% 50%, #0a1628 0%, #050a12 40%, #020408 100%)",
      }}
    >
      <Suspense fallback={<Loader />}>
        <Canvas
          camera={{ position: cameraPosition, fov: 45 }}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
          style={{ touchAction: "none" }}
          dpr={[1, 2]}
        >
          <GlobeScene arcs={arcs} onArcComplete={handleArcComplete} network={network} />
        </Canvas>
      </Suspense>

      {/* Live badge - no network name since we have buttons in header */}
      <div className={`absolute pointer-events-none ${fullscreen ? 'top-4 right-4' : 'top-3 right-3'}`}>
        <div
          className={`flex items-center gap-2 rounded-full ${
            fullscreen ? 'text-sm px-3 py-1.5' : 'text-[10px] px-2 py-0.5'
          } ${
            connected
              ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
              : "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30"
          }`}
        >
          <span className={`rounded-full ${fullscreen ? 'w-2 h-2' : 'w-1.5 h-1.5'} ${connected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
          {connected ? "LIVE" : "DEMO"}
        </div>
      </div>

      {/* Aptos logo + Stats overlay */}
      <div className={`absolute pointer-events-none ${fullscreen ? 'top-4 left-4' : 'top-3 left-3'}`}>
        {/* Aptos logo */}
        <div className={`flex items-center gap-2 ${fullscreen ? 'mb-3' : 'mb-2'}`}>
          <img
            src="/aptos-logo.svg"
            alt="Aptos"
            className={`${fullscreen ? 'w-6 h-6' : 'w-4 h-4'} opacity-80`}
          />
          <span className={`font-medium text-white/80 ${fullscreen ? 'text-sm' : 'text-xs'}`}>
            Aptos Network
          </span>
        </div>
        {/* Stats */}
        <div className={`text-gray-500 font-mono uppercase tracking-wider ${fullscreen ? 'text-xs' : 'text-[10px]'}`}>Validators</div>
        <div className={`font-mono text-emerald-400 tabular-nums ${fullscreen ? 'text-xl mb-2' : 'text-sm mb-1'}`}>
          {validatorCount}
        </div>
        <div className={`text-gray-500 font-mono uppercase tracking-wider ${fullscreen ? 'text-xs' : 'text-[10px]'}`}>Block</div>
        <div className={`font-mono text-gray-300 tabular-nums ${fullscreen ? 'text-xl' : 'text-sm'}`}>
          #{stats.recentBlocks?.[0]?.blockHeight?.toLocaleString() || "—"}
        </div>
      </div>

      {/* Bottom bar - legend + instructions combined */}
      <div className={`absolute left-0 right-0 pointer-events-none ${fullscreen ? 'bottom-4 px-4' : 'bottom-3 px-3'}`}>
        <div className={`flex items-center justify-between ${fullscreen ? 'text-xs' : 'text-[10px]'}`}>
          {/* Legend - left side */}
          <div className="flex items-center gap-4 text-gray-400">
            <div className="flex items-center gap-1.5">
              <div className={`rounded-full bg-amber-400 ${fullscreen ? 'w-2 h-2' : 'w-1.5 h-1.5'}`} />
              <span>Validators</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`bg-orange-400 rounded-full ${fullscreen ? 'w-4 h-0.5' : 'w-3 h-0.5'}`} />
              <span>Broadcasts</span>
            </div>
          </div>
          {/* Instructions - right side */}
          <div className="text-gray-600">
            Drag • Scroll to zoom
          </div>
        </div>
      </div>

      {/* Real-time activity feed */}
      <ActivityFeed items={activityFeed} fullscreen={fullscreen} />
    </div>
  );
});
