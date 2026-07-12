import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box } from '@react-three/drei';
import { UploadCloud, Download, Check, AlertCircle } from 'lucide-react';
import * as THREE from 'three';
import { 
  solveGlobalPositions, 
  calculatePathLength, 
  calculateJointTorque, 
  getTendonPathPoints 
} from '../lib/tendonKinematics';
import type { GuidePoint, WrappingObstacle } from '../lib/tendonKinematics';
import { checkPerimeterViolation } from '../lib/PerimeterLinter';

const TENDON_CONFIGS: Record<string, { guides: GuidePoint[], wrap: WrappingObstacle[] }> = {
  'LOBSTER_CRAWLER_SMALL': {
    guides: [
      { linkId: 'base', localOffset: [0, 0, 0] },
      { linkId: 'link1', localOffset: [0.5, 0.05, 0] },
      { linkId: 'link2', localOffset: [0.4, 0, 0] }
    ],
    wrap: [
      { type: 'cylinder', linkId: 'link1', radius: 0.12, center: [0, 0, 0] }
    ]
  },
  'CRAYFISH_CRAWLER_MEDIUM': {
    guides: [
      { linkId: 'base', localOffset: [-0.1, 0, 0] },
      { linkId: 'link1', localOffset: [0.6, 0.08, 0] },
      { linkId: 'link2', localOffset: [0.5, 0, 0] }
    ],
    wrap: [
      { type: 'cylinder', linkId: 'link1', radius: 0.18, center: [0, 0, 0] },
      { type: 'cylinder', linkId: 'link2', radius: 0.12, center: [0, 0, 0] }
    ]
  },
  'SOFT_GRIPPER_CART': {
    guides: [],
    wrap: []
  },
  'ROW_SCOUT_MINI': {
    guides: [
      { linkId: 'base', localOffset: [0, 0, 0] },
      { linkId: 'link1', localOffset: [0.3, 0.04, 0] },
      { linkId: 'link2', localOffset: [0.2, 0, 0] }
    ],
    wrap: [
      { type: 'cylinder', linkId: 'link1', radius: 0.08, center: [0, 0, 0] }
    ]
  }
};

const DEFAULT_TENDON_CONFIG = {
  guides: [
    { linkId: 'base' as const, localOffset: [0, 0, 0] as [number, number, number] },
    { linkId: 'link1' as const, localOffset: [0.4, 0.05, 0] as [number, number, number] },
    { linkId: 'link2' as const, localOffset: [0.3, 0, 0] as [number, number, number] }
  ],
  wrap: [
    { type: 'cylinder' as const, linkId: 'link1' as const, radius: 0.1, center: [0, 0, 0] as [number, number, number] }
  ]
};

interface RoboticsPassport {
  asset_id: string;
  morphology_class: string;
  actuator_joint_count: number;
  maximum_tensile_newtons: number;
  footprint_length_m: number;
  footprint_width_m: number;
  maximum_reach_m: number;
  tool_class?: string;
  tendon_count?: number;
  battery_class?: string;
  notes?: string;
}

const PRESETS: Record<string, RoboticsPassport> = {
  'LOBSTER_CRAWLER_SMALL': {
    asset_id: 'PRESET-LOBSTER-01',
    morphology_class: 'LOBSTER_CRAWLER_SMALL',
    actuator_joint_count: 8,
    maximum_tensile_newtons: 450,
    footprint_length_m: 0.8,
    footprint_width_m: 0.6,
    maximum_reach_m: 0.5,
    tool_class: 'PRECISION_NIPPER',
    tendon_count: 16
  },
  'CRAYFISH_CRAWLER_MEDIUM': {
    asset_id: 'PRESET-CRAYFISH-01',
    morphology_class: 'CRAYFISH_CRAWLER_MEDIUM',
    actuator_joint_count: 12,
    maximum_tensile_newtons: 800,
    footprint_length_m: 1.2,
    footprint_width_m: 0.9,
    maximum_reach_m: 0.8,
    tool_class: 'HEAVY_CLAW',
    tendon_count: 24
  },
  'SOFT_GRIPPER_CART': {
    asset_id: 'PRESET-GRIPPER-01',
    morphology_class: 'SOFT_GRIPPER_CART',
    actuator_joint_count: 4,
    maximum_tensile_newtons: 200,
    footprint_length_m: 1.5,
    footprint_width_m: 1.0,
    maximum_reach_m: 1.2,
    tool_class: 'PNEUMATIC_SUCTION',
    tendon_count: 0
  },
  'ROW_SCOUT_MINI': {
    asset_id: 'PRESET-SCOUT-01',
    morphology_class: 'ROW_SCOUT_MINI',
    actuator_joint_count: 6,
    maximum_tensile_newtons: 150,
    footprint_length_m: 0.5,
    footprint_width_m: 0.4,
    maximum_reach_m: 0.2,
    tool_class: 'OPTICAL_ARRAY',
    tendon_count: 4
  }
};

export default function RoboticAssetPassport() {
  const [passport, setPassport] = useState<RoboticsPassport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [activePrintSheet, setActivePrintSheet] = useState<'review' | 'assembly' | 'checklist' | 'build-packet' | null>(null);
  
  // Perimeter limits
  const [zoneLength, setZoneLength] = useState<number>(5.0);
  const [zoneWidth, setZoneWidth] = useState<number>(3.0);
  
  // Path task definitions
  const [pathLength, setPathLength] = useState<number>(4.0);
  const [pathWidth, setPathWidth] = useState<number>(1.0);
  const [turnRadius, setTurnRadius] = useState<number>(0.5);

  // Joint simulation state (radians)
  const [joint1Angle, setJoint1Angle] = useState<number>(0.2);
  const [joint2Angle, setJoint2Angle] = useState<number>(-0.4);
  const [tendonTension, setTendonTension] = useState<number>(150);
  const [showReachEnvelope, setShowReachEnvelope] = useState<boolean>(true);
  const [fabricationNotes, setFabricationNotes] = useState<string>('');
  
  const [frameMaterialNotes, setFrameMaterialNotes] = useState<string>('');
  const [cableRoutingNotes, setCableRoutingNotes] = useState<string>('');
  const [assemblyNotes, setAssemblyNotes] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        const required = ['asset_id', 'morphology_class', 'actuator_joint_count', 'maximum_tensile_newtons', 'footprint_length_m', 'footprint_width_m', 'maximum_reach_m'];
        for (const req of required) {
          if (json[req] === undefined) {
            throw new Error(`Missing required field: ${req}`);
          }
        }
        
        setPassport(json as RoboticsPassport);
        setSelectedPreset('');
        setError(null);
        setSaveMessage(null);
      } catch (err: any) {
        setError(`Failed to parse morphology JSON: ${err.message}`);
        setPassport(null);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const loadPreset = (presetName: string) => {
    if (PRESETS[presetName]) {
      setPassport(PRESETS[presetName]);
      setSelectedPreset(presetName);
      setError(null);
      setSaveMessage(null);
    }
  };

  const getValidatorStatus = () => {
    if (!passport) return null;
    
    // Check robot vs zone
    if (passport.footprint_length_m > zoneLength || passport.footprint_width_m > zoneWidth) {
      return { valid: false, message: 'INVALID: Footprint exceeds zone boundary.' };
    }
    
    // Check task path vs zone
    if (pathLength > zoneLength || pathWidth > zoneWidth) {
      return { valid: false, message: 'INVALID: Task path width exceeds zone width.' };
    }
    
    // Check turn radius vs zone
    if (turnRadius > zoneLength / 2 || turnRadius > zoneWidth / 2) {
      return { valid: false, message: 'INVALID: Turn radius exceeds available zone depth.' };
    }
    
    // Check robot reach vs path/zone context
    // This is a proxy for "if the robot reach extends beyond safe constraints when on this path"
    // This is a proxy for "if the robot reach extends beyond safe constraints when on this path"
    // If the path forces the robot too close to zone edges given its reach
    if ((pathWidth / 2 + passport.maximum_reach_m) > (zoneWidth / 2)) {
      return { valid: false, message: 'INVALID: Robot reach exceeds path-safe boundary.' };
    }
    
    return { valid: true, message: 'VALID: Task path fits within zone.' };
  };

  const validatorStatus = getValidatorStatus();

  // Retrieval of active configurations
  const tendonConfig = passport ? (TENDON_CONFIGS[passport.morphology_class] || DEFAULT_TENDON_CONFIG) : DEFAULT_TENDON_CONFIG;

  const J1: [number, number, number] = [0, 0.25, 0];
  const L1 = 1.0;
  const L2 = 0.8;

  // Joint 2 position
  const rotateZ = (x: number, y: number, z: number, angleRad: number): [number, number, number] => {
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    return [
      x * cos - y * sin,
      x * sin + y * cos,
      z
    ];
  };
  const J2_local: [number, number, number] = [L1, 0, 0];
  const J2_rot = rotateZ(J2_local[0], J2_local[1], J2_local[2], joint1Angle);
  const J2: [number, number, number] = [
    J1[0] + J2_rot[0],
    J1[1] + J2_rot[1],
    J1[2] + J2_rot[2]
  ];

  const EE_local: [number, number, number] = [L2, 0, 0];
  const EE_rot = rotateZ(EE_local[0], EE_local[1], EE_local[2], joint1Angle + joint2Angle);
  const EE: [number, number, number] = [
    J2[0] + EE_rot[0],
    J2[1] + EE_rot[1],
    J2[2] + EE_rot[2]
  ];

  // Global guide points
  const joint1AngleDeg = joint1Angle * (180 / Math.PI);
  const joint2AngleDeg = joint2Angle * (180 / Math.PI);
  const jointAngles = { joint1: joint1AngleDeg, joint2: joint2AngleDeg };

  const globalGuides = passport 
    ? solveGlobalPositions(tendonConfig.guides, jointAngles)
    : [];

  // Tendon path length with wrapping
  const tendonPathLength = passport 
    ? calculatePathLength(globalGuides, tendonConfig.wrap, jointAngles)
    : 0;

  // Torque output
  const shoulderTorque = calculateJointTorque(tendonTension, joint1AngleDeg, 0.12);
  const elbowTorque = calculateJointTorque(tendonTension, joint2AngleDeg, 0.08);

  // Clearance warning states
  const currentReachX = Math.abs(EE[0]);
  const isClearanceWarning = passport && (currentReachX > (zoneWidth / 2 - 0.2)) && (currentReachX <= zoneWidth / 2);
  const isClearanceCritical = passport && (currentReachX > (zoneWidth / 2));

  // Run spatial boundary checker
  const reachPoints: [number, number, number][] = passport ? [J1, J2, EE, ...globalGuides] : [];
  const perimeterCheck = checkPerimeterViolation(reachPoints, zoneWidth, zoneLength);
  const isBoundaryViolation = !!(passport && !perimeterCheck.valid);

  // Generate Reach Envelope points
  const generateReachEnvelope = (): [number, number, number][] => {
    if (!passport) return [];
    const points: [number, number, number][] = [];
    const steps1 = 20;
    const steps2 = 20;
    
    for (let i = 0; i <= steps1; i++) {
      const a1 = (i / steps1) * Math.PI - (Math.PI / 2);
      const j2_r = rotateZ(L1, 0, 0, a1);
      const j2_p = [J1[0] + j2_r[0], J1[1] + j2_r[1], J1[2] + j2_r[2]];
      
      for (let j = 0; j <= steps2; j++) {
        const a2 = (j / steps2) * (Math.PI * 1.5) - (Math.PI * 0.75);
        const ee_r = rotateZ(L2, 0, 0, a1 + a2);
        const ee_p = [j2_p[0] + ee_r[0], j2_p[1] + ee_r[1], j2_p[2] + ee_r[2]];
        points.push(ee_p as [number, number, number]);
      }
    }
    return points;
  };

  const reachEnvelopePoints = showReachEnvelope ? generateReachEnvelope() : [];
  const envelopePerimeterCheck = showReachEnvelope ? checkPerimeterViolation(reachEnvelopePoints, zoneWidth, zoneLength) : { valid: true };
  const envelopeClipped = showReachEnvelope && !envelopePerimeterCheck.valid;
  const activeBoundaryPoints = showReachEnvelope && reachEnvelopePoints.length > 0 ? reachEnvelopePoints : reachPoints;
  const requiredZoneWidth = passport
    ? Math.max(
        passport.footprint_width_m,
        pathWidth + passport.maximum_reach_m * 2,
        activeBoundaryPoints.length > 0 ? Math.max(...activeBoundaryPoints.map(point => Math.abs(point[0]))) * 2 : 0
      ) + 0.2
    : zoneWidth;
  const requiredZoneLength = passport
    ? Math.max(
        passport.footprint_length_m,
        pathLength,
        turnRadius * 2,
        activeBoundaryPoints.length > 0 ? Math.max(...activeBoundaryPoints.map(point => Math.abs(point[2]))) * 2 : 0
      ) + 0.2
    : zoneLength;

  // Generate tendon path coordinates
  const getFullTendonPath = (): [number, number, number][] => {
    if (globalGuides.length < 2) return [];
    const pathPts: [number, number, number][] = [];
    
    for (let i = 0; i < globalGuides.length - 1; i++) {
      const p1 = globalGuides[i];
      const p2 = globalGuides[i+1];
      
      let activeObs: WrappingObstacle | null = null;
      for (const obs of tendonConfig.wrap) {
        if (obs.linkId === 'link1' && i === 0) activeObs = obs;
        else if (obs.linkId === 'link2' && i === 1) activeObs = obs;
      }
      
      if (activeObs) {
        const obsCenter: [number, number, number] = activeObs.linkId === 'link1' ? J1 : J2;
        const segmentPts = getTendonPathPoints(p1, p2, obsCenter, activeObs.radius, true);
        if (i > 0) {
          pathPts.push(...segmentPts.slice(1));
        } else {
          pathPts.push(...segmentPts);
        }
      } else {
        if (i > 0) {
          pathPts.push(p2);
        } else {
          pathPts.push(p1, p2);
        }
      }
    }
    return pathPts;
  };

  const tendonPathPoints = getFullTendonPath();

  const handleFitZoneToConstraints = () => {
    if (!passport) return;
    setZoneWidth(parseFloat(requiredZoneWidth.toFixed(1)));
    setZoneLength(parseFloat(requiredZoneLength.toFixed(1)));
  };

  const getConstraintGuidance = () => {
    if (!passport) return null;

    if (isBoundaryViolation) {
      return {
        tone: 'warning',
        title: 'Current reach envelope is outside the configured zone.',
        body: `Increase the zone boundary or reduce the active reach envelope before fabrication exports unlock. A fitted zone of ${requiredZoneLength.toFixed(1)}m x ${requiredZoneWidth.toFixed(1)}m clears the current geometry.`
      };
    }

    if (!validatorStatus?.valid) {
      if (validatorStatus?.message.includes('Footprint exceeds zone boundary')) {
        return {
          tone: 'warning',
          title: 'Current footprint is larger than the configured zone.',
          body: `Increase the zone to at least ${requiredZoneLength.toFixed(1)}m x ${requiredZoneWidth.toFixed(1)}m or reduce the morphology footprint before continuing.`
        };
      }

      if (validatorStatus?.message.includes('Task path width exceeds zone width')) {
        return {
          tone: 'warning',
          title: 'Task path dimensions exceed the current zone.',
          body: `Shorten the path or widen the zone. A fitted zone of ${requiredZoneLength.toFixed(1)}m x ${requiredZoneWidth.toFixed(1)}m satisfies the current path settings.`
        };
      }

      if (validatorStatus?.message.includes('Turn radius exceeds available zone depth')) {
        return {
          tone: 'warning',
          title: 'Turn radius is too large for the current zone.',
          body: `Reduce the turn radius or expand the zone depth. A fitted zone of ${requiredZoneLength.toFixed(1)}m x ${requiredZoneWidth.toFixed(1)}m supports the current turn.`
        };
      }

      if (validatorStatus?.message.includes('Robot reach exceeds path-safe boundary')) {
        return {
          tone: 'warning',
          title: 'Reach and path width exceed the safe working boundary.',
          body: `Widen the zone or tighten the task path before fabrication handoff. A fitted zone of ${requiredZoneLength.toFixed(1)}m x ${requiredZoneWidth.toFixed(1)}m clears the current reach margin.`
        };
      }
    }

    return {
      tone: 'ready',
      title: 'Geometry passes the current local checks.',
      body: 'The morphology is eligible for registration, print review, and fabrication-facing exports.'
    };
  };

  const constraintGuidance = getConstraintGuidance();

  useEffect(() => {
    if (!activePrintSheet) return;

    const handleAfterPrint = () => setActivePrintSheet(null);
    window.addEventListener('afterprint', handleAfterPrint);

    const timeoutId = window.setTimeout(() => {
      window.print();
    }, 80);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [activePrintSheet]);

  const handlePrintSheet = (sheet: 'review' | 'assembly' | 'checklist' | 'build-packet') => {
    if (!validatorStatus?.valid || isBoundaryViolation) return;
    setActivePrintSheet(sheet);
  };

  const handleRegister = () => {
    if (!passport) return;
    
    try {
      const existingStr = localStorage.getItem('robotics_assets');
      const existing = existingStr ? JSON.parse(existingStr) : [];
      
      const filtered = existing.filter((a: any) => a.asset_id !== passport.asset_id);
      filtered.push(passport);
      
      localStorage.setItem('robotics_assets', JSON.stringify(filtered));
      setSaveMessage(`Successfully registered asset: ${passport.asset_id}`);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setError('Failed to save to local storage.');
    }
  };

  const handleExportMorphologyPacket = () => {
    if (!passport || isBoundaryViolation || !validatorStatus?.valid) return;
    
    const payload = {
      generated_at: new Date().toISOString(),
      local_truth_boundary: 'Schematic preview only. No autonomous actuation or real-time motor driving.',
      morphology_record: passport,
      task_path: {
        path_length_m: pathLength,
        path_width_m: pathWidth,
        turn_radius_m: turnRadius
      },
      validation_result: validatorStatus?.message,
      perimeter_result: perimeterCheck.message,
      reach_envelope_enabled: showReachEnvelope
    };
    
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `morphology_packet_${passport.asset_id}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportSchematicSnapshot = () => {
    if (!passport || isBoundaryViolation || !validatorStatus?.valid) return;
    
    const payload = {
      asset_id: passport.asset_id,
      morphology_class: passport.morphology_class,
      footprint: {
        length_m: passport.footprint_length_m,
        width_m: passport.footprint_width_m
      },
      reach: {
        maximum_reach_m: passport.maximum_reach_m
      },
      path_task: {
        path_length_m: pathLength,
        path_width_m: pathWidth,
        turn_radius_m: turnRadius
      },
      validation_status: validatorStatus?.message,
      perimeter_status: perimeterCheck.message
    };
    
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `schematic_snapshot_${passport.asset_id}.json`);
    document.body.appendChild(link);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportFabricationPacket = () => {
    if (!passport || isBoundaryViolation || !validatorStatus?.valid) return;
    
    const payload = {
      generated_at: new Date().toISOString(),
      local_truth_boundary: 'Browser schematic only. Dimensions and routing require physical verification before fabrication.',
      asset_id: passport.asset_id,
      morphology_class: passport.morphology_class,
      actuator_joint_count: passport.actuator_joint_count,
      tendon_count: passport.tendon_count ?? 0,
      tool_class: passport.tool_class ?? 'NONE',
      maximum_tensile_newtons: passport.maximum_tensile_newtons,
      footprint_length_m: passport.footprint_length_m,
      footprint_width_m: passport.footprint_width_m,
      maximum_reach_m: passport.maximum_reach_m,
      path_length_m: pathLength,
      path_width_m: pathWidth,
      turn_radius_m: turnRadius,
      validation_status: validatorStatus?.message,
      perimeter_status: perimeterCheck.message,
      preset_template: selectedPreset || 'CUSTOM',
      fabrication_notes: fabricationNotes
    };
    
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `fabrication_packet_${passport.asset_id}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportOperatorHandoffPacket = () => {
    if (!passport || isBoundaryViolation || !validatorStatus?.valid) return;
    
    const payload = {
      generated_at: new Date().toISOString(),
      local_truth_boundary: 'Browser schematic only. Dimensions, clearances, and routing require physical verification before fabrication or actuation.',
      asset_id: passport.asset_id,
      preset_template: selectedPreset || 'CUSTOM',
      morphology_record: passport,
      task_path: {
        path_length_m: pathLength,
        path_width_m: pathWidth,
        turn_radius_m: turnRadius
      },
      validation_ledger: {
        task_path_validation: validatorStatus?.message,
        perimeter_validation: perimeterCheck.message,
        reach_envelope_status: !envelopeClipped ? 'PASS' : 'CLIPPED',
        tendon_path_length_m: tendonPathLength,
        shoulder_torque_nm: shoulderTorque,
        elbow_torque_nm: elbowTorque,
        fabrication_export_eligibility: (validatorStatus?.valid && !isBoundaryViolation) ? 'ELIGIBLE' : 'BLOCKED',
        summary: (validatorStatus?.valid && !isBoundaryViolation) ? 'Current morphology passes local geometry checks for fabrication handoff.' : 'Current morphology is blocked from fabrication handoff until geometry constraints are resolved.'
      },
      tendon_routing_ledger: {
        configuration_source: selectedPreset || 'CUSTOM',
        guide_point_count: !passport?.tendon_count ? 0 : (tendonConfig?.guides?.length || 0),
        wrap_object_count: !passport?.tendon_count ? 0 : (tendonConfig?.wrap?.length || 0),
        guide_links_used: !passport?.tendon_count ? 'NONE' : (Array.from(new Set(tendonConfig?.guides?.map((g: any) => g.linkId) || [])).join(', ') || 'NONE'),
        wrap_links_used: !passport?.tendon_count ? 'NONE' : (Array.from(new Set(tendonConfig?.wrap?.map((w: any) => w.linkId) || [])).join(', ') || 'NONE'),
        routing_mode: !passport?.tendon_count ? 'NONE' : ((tendonConfig?.wrap?.length || 0) === 0 ? 'DIRECT' : (tendonConfig?.wrap?.length === 1 ? 'WRAPPED_SINGLE_STAGE' : 'WRAPPED_MULTI_STAGE')),
        current_tendon_path_length_m: !passport?.tendon_count ? 0 : tendonPathLength,
        tension_input_newtons: tendonTension,
        shoulder_torque_nm: !passport?.tendon_count ? 0 : shoulderTorque,
        elbow_torque_nm: !passport?.tendon_count ? 0 : elbowTorque,
        summary: !passport?.tendon_count ? 'No tendon routing is defined for this morphology.' : ((tendonConfig?.wrap?.length || 0) === 0 ? 'Current tendon route is direct and low-complexity.' : ((tendonConfig?.wrap?.length || 0) === 1 ? 'Current tendon route includes one wrapped stage. Verify pulley clearance physically.' : 'Current tendon route includes multiple wrapped stages. Verify routing order and anchor clearance physically.'))
      },
      fabrication_readiness: {
        morphology_class: passport.morphology_class,
        actuator_joint_count: passport.actuator_joint_count,
        tendon_count: passport.tendon_count ?? 0,
        maximum_tensile_newtons: passport.maximum_tensile_newtons,
        footprint: `${passport.footprint_length_m}m x ${passport.footprint_width_m}m`,
        reach: `${passport.maximum_reach_m} m`,
        current_validation_state: (validatorStatus?.valid && !isBoundaryViolation) ? 'VALID FOR FABRICATION' : 'INVALID',
        summary: 'Browser schematic only. Dimensions and routing require physical verification before fabrication.'
      },
      fabrication_notes: fabricationNotes
    };
    
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `operator_handoff_${passport.asset_id}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportFabricationAssumptions = () => {
    if (!passport || isBoundaryViolation || !validatorStatus?.valid) return;
    
    const wrapCount = tendonConfig?.wrap?.length || 0;
    const jointCount = passport.actuator_joint_count;
    const tendonCount = passport.tendon_count ?? 0;
    
    const assumedFrame = "ALUMINUM_EXTRUSION_OR_PRINTED_PETG";
    const assumedJoints = jointCount > 4 ? "HIGH_TORQUE_SERVOS_OR_STEPPERS" : "STANDARD_HOBBY_SERVOS";
    const assumedTendons = tendonCount === 0 ? "NONE_DIRECT_DRIVE" : (tendonCount > 4 ? "BRAIDED_UHMWPE_HIGH_TENSION" : "NYLON_MONOFILAMENT");
    const assumedPulleys = tendonCount === 0 ? "NOT_APPLICABLE" : (wrapCount > 0 ? "BEARING_MOUNTED_IDLERS" : "PTFE_TUBE_GUIDES");
    const assumedEndEffector = passport.tool_class === 'NONE' ? "BARE_TOOL_PLATE" : `CUSTOM_MOUNT_${passport.tool_class}`;
    const assumedParts = jointCount * 3 + tendonCount * 2 + 5;
    const assumedFasteners = jointCount > 4 ? "HIGH_COMPLEXITY_M3_M4_MIX" : "LOW_COMPLEXITY_UNIFORM_M3";
    const assumedRisk = tendonCount > 0 ? (wrapCount > 0 ? "HIGH_ROUTING_RISK" : "MEDIUM_TENSION_RISK") : "LOW_ASSEMBLY_RISK";

    const payload = {
      generated_at: new Date().toISOString(),
      asset_id: passport.asset_id,
      preset_template: selectedPreset || 'CUSTOM',
      assumptions: {
        frame_material: assumedFrame,
        joint_type: assumedJoints,
        tendon_cable_type: assumedTendons,
        pulley_guide_strategy: assumedPulleys,
        end_effector_mount: assumedEndEffector,
        estimated_printed_part_count: assumedParts,
        estimated_fastener_complexity: assumedFasteners,
        bench_assembly_risk: assumedRisk
      },
      operator_notes: {
        frame_material_notes: frameMaterialNotes,
        cable_routing_notes: cableRoutingNotes,
        assembly_notes: assemblyNotes
      },
      truth_boundary: "Fabrication assumptions only. Material choice, tolerances, and assembly fit require physical verification."
    };
    
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `fabrication_assumptions_${passport.asset_id}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPartsCutSheet = () => {
    if (!passport || isBoundaryViolation || !validatorStatus?.valid) return;

    const payload = {
      generated_at: new Date().toISOString(),
      asset_id: passport.asset_id,
      preset_template: selectedPreset || 'CUSTOM',
      parts_sheet: {
        frame_rails_count: estimatedFrameRails,
        frame_rail_length_m: estimatedFrameRailLength,
        joint_housing_count: estimatedJointHousings,
        tendon_anchor_count: estimatedTendonAnchors,
        pulley_or_idler_count: estimatedPulleyCount,
        guide_bushing_count: estimatedGuideBushings,
        end_effector_mount_count: 1,
        estimated_tendon_line_length_m: estimatedTendonLineLength,
        estimated_fastener_family: assumedFasteners,
        bench_assembly_sequence: benchAssemblySequence,
        assembly_risk: assumedRisk
      },
      fabrication_notes: {
        fabrication_notes: fabricationNotes,
        frame_material_notes: frameMaterialNotes,
        cable_routing_notes: cableRoutingNotes,
        assembly_notes: assemblyNotes
      },
      truth_boundary: 'Fabrication planning only. Cut lengths, hole placement, and fit require physical measurement before build.'
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `parts_cut_sheet_${passport.asset_id}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const assumptionWrapCount = tendonConfig?.wrap?.length || 0;
  const assumptionJointCount = passport?.actuator_joint_count || 0;
  const assumptionTendonCount = passport?.tendon_count ?? 0;
  const assumedFrame = "ALUMINUM_EXTRUSION_OR_PRINTED_PETG";
  const assumedJoints = assumptionJointCount > 4 ? "HIGH_TORQUE_SERVOS_OR_STEPPERS" : "STANDARD_HOBBY_SERVOS";
  const assumedTendons = assumptionTendonCount === 0 ? "NONE_DIRECT_DRIVE" : (assumptionTendonCount > 4 ? "BRAIDED_UHMWPE_HIGH_TENSION" : "NYLON_MONOFILAMENT");
  const assumedPulleys = assumptionTendonCount === 0 ? "NOT_APPLICABLE" : (assumptionWrapCount > 0 ? "BEARING_MOUNTED_IDLERS" : "PTFE_TUBE_GUIDES");
  const assumedEndEffector = (!passport || passport.tool_class === 'NONE') ? "BARE_TOOL_PLATE" : `CUSTOM_MOUNT_${passport.tool_class}`;
  const assumedParts = assumptionJointCount * 3 + assumptionTendonCount * 2 + 5;
  const assumedFasteners = assumptionJointCount > 4 ? "HIGH_COMPLEXITY_M3_M4_MIX" : "LOW_COMPLEXITY_UNIFORM_M3";
  const assumedRisk = assumptionTendonCount > 0 ? (assumptionWrapCount > 0 ? "HIGH_ROUTING_RISK" : "MEDIUM_TENSION_RISK") : "LOW_ASSEMBLY_RISK";
  const estimatedFrameRails = Math.max(4, assumptionJointCount > 0 ? 4 + Math.ceil(assumptionJointCount / 2) : 4);
  const estimatedFrameRailLength = passport ? Number(((passport.footprint_length_m * 2) + (passport.footprint_width_m * 2)).toFixed(2)) : 0;
  const estimatedJointHousings = assumptionJointCount;
  const estimatedTendonAnchors = assumptionTendonCount === 0 ? 0 : assumptionTendonCount * 2;
  const estimatedPulleyCount = assumptionWrapCount > 0 ? assumptionWrapCount * 2 : 0;
  const estimatedGuideBushings = tendonConfig?.guides?.length || 0;
  const estimatedTendonLineLength = assumptionTendonCount === 0 ? 0 : Number((tendonPathLength * Math.max(1, assumptionTendonCount)).toFixed(2));
  const benchAssemblySequence = assumptionTendonCount === 0
    ? 'FRAME -> JOINTS -> TOOL MOUNT'
    : (assumptionWrapCount > 0
      ? 'FRAME -> JOINTS -> GUIDES/PULLEYS -> TENDON ROUTING -> TOOL MOUNT'
      : 'FRAME -> JOINTS -> GUIDES -> TENDON ROUTING -> TOOL MOUNT');

  const isGeometryValid = validatorStatus?.valid ?? false;
  const isPerimeterValid = !isBoundaryViolation;
  const hasMorphology = passport !== null;
  const hasTendonNotes = fabricationNotes.toLowerCase().includes('tendon') || fabricationNotes.toLowerCase().includes('routing') || cableRoutingNotes.trim().length > 0;
  const hasAssumptionsNotes = frameMaterialNotes.trim().length > 0 || assemblyNotes.trim().length > 0;
  
  const preflightStatus = {
    geometry: {
      status: isGeometryValid ? 'PASS' : 'BLOCKED',
      message: isGeometryValid ? 'Geometry clears current zone constraints.' : 'Geometry validation failed. Adjust dimensions.',
    },
    perimeter: {
      status: isPerimeterValid ? 'PASS' : 'BLOCKED',
      message: isPerimeterValid ? 'No perimeter violations detected.' : 'Current geometry violates the defined zone.',
    },
    morphology: {
      status: hasMorphology ? 'PASS' : 'BLOCKED',
      message: hasMorphology ? 'Morphology identity loaded.' : 'No morphology data available.',
    },
    tendonRouting: {
      status: !hasMorphology ? 'BLOCKED' : (hasTendonNotes ? 'PASS' : 'OPTIONAL'),
      message: hasTendonNotes ? 'Tendon routing notes recorded.' : 'No tendon routing notes recorded. Add them if this build needs pulley, wrap, or tension guidance.',
    },
    fabricationAssumptions: {
      status: !hasMorphology ? 'BLOCKED' : (hasAssumptionsNotes ? 'PASS' : 'OPTIONAL'),
      message: hasAssumptionsNotes ? 'Fabrication assumptions recorded.' : 'Operator notes are empty. Add assumptions if this handoff needs material or assembly context.',
    },
    isReady: isGeometryValid && isPerimeterValid && hasMorphology
  };

  const handleExportCombinedFabricationPacket = () => {
    if (!passport || !preflightStatus.isReady) return;

    const payload = {
      generated_at: new Date().toISOString(),
      local_truth_boundary: 'Browser schematic only. Dimensions, clearances, routing, and fit require physical verification before fabrication or actuation.',
      asset_id: passport.asset_id,
      preset_template: selectedPreset || 'CUSTOM',
      preflight: preflightStatus,
      morphology_record: passport,
      validation_summary: {
        task_path_validation: validatorStatus?.message,
        perimeter_validation: perimeterCheck.message,
        reach_envelope_status: !envelopeClipped ? 'PASS' : 'CLIPPED',
        tendon_path_length_m: tendonPathLength,
        shoulder_torque_nm: shoulderTorque,
        elbow_torque_nm: elbowTorque,
        summary: (validatorStatus?.valid && !isBoundaryViolation) ? 'Current morphology passes local geometry checks for fabrication handoff.' : 'Current morphology is blocked from fabrication handoff until geometry constraints are resolved.'
      },
      routing_summary: {
        configuration_source: selectedPreset || 'CUSTOM',
        guide_point_count: !passport?.tendon_count ? 0 : (tendonConfig?.guides?.length || 0),
        wrap_object_count: !passport?.tendon_count ? 0 : (tendonConfig?.wrap?.length || 0),
        guide_links_used: !passport?.tendon_count ? 'NONE' : (Array.from(new Set(tendonConfig?.guides?.map((g: any) => g.linkId) || [])).join(', ') || 'NONE'),
        wrap_links_used: !passport?.tendon_count ? 'NONE' : (Array.from(new Set(tendonConfig?.wrap?.map((w: any) => w.linkId) || [])).join(', ') || 'NONE'),
        routing_mode: !passport?.tendon_count ? 'NONE' : ((tendonConfig?.wrap?.length || 0) === 0 ? 'DIRECT' : (tendonConfig?.wrap?.length === 1 ? 'WRAPPED_SINGLE_STAGE' : 'WRAPPED_MULTI_STAGE')),
        current_tendon_path_length_m: !passport?.tendon_count ? 0 : tendonPathLength,
        tension_input_newtons: tendonTension,
        shoulder_torque_nm: !passport?.tendon_count ? 0 : shoulderTorque,
        elbow_torque_nm: !passport?.tendon_count ? 0 : elbowTorque,
        summary: !passport?.tendon_count ? 'No tendon routing is defined for this morphology.' : ((tendonConfig?.wrap?.length || 0) === 0 ? 'Current tendon route is direct and low-complexity.' : ((tendonConfig?.wrap?.length || 0) === 1 ? 'Current tendon route includes one wrapped stage. Verify pulley clearance physically.' : 'Current tendon route includes multiple wrapped stages. Verify routing order and anchor clearance physically.'))
      },
      fabrication_assumptions: {
        frame_material: assumedFrame,
        joint_type: assumedJoints,
        tendon_cable_type: assumedTendons,
        pulley_guide_strategy: assumedPulleys,
        end_effector_mount: assumedEndEffector,
        estimated_printed_part_count: assumedParts,
        estimated_fastener_complexity: assumedFasteners,
        bench_assembly_risk: assumedRisk
      },
      parts_assembly: {
        frame_rails_count: estimatedFrameRails,
        frame_rail_length_m: estimatedFrameRailLength,
        joint_housing_count: estimatedJointHousings,
        tendon_anchor_count: estimatedTendonAnchors,
        pulley_or_idler_count: estimatedPulleyCount,
        guide_bushing_count: estimatedGuideBushings,
        end_effector_mount_count: 1,
        estimated_tendon_line_length_m: estimatedTendonLineLength,
        estimated_fastener_family: assumedFasteners,
        bench_assembly_sequence: benchAssemblySequence
      },
      operator_notes: {
        fabrication_notes: fabricationNotes,
        frame_material_notes: frameMaterialNotes,
        cable_routing_notes: cableRoutingNotes,
        assembly_notes: assemblyNotes
      }
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `combined_fabrication_packet_${passport.asset_id}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto p-4">
      
      <div className="flex justify-between items-end border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-200 tracking-wider uppercase">Robotic Asset Passport</h2>
          <p className="text-xs text-slate-500 font-mono">Local morphology ingest and perimeter linting MVP.</p>
        </div>
        
        <div className="flex gap-4">
          <div className="flex bg-slate-900 border border-slate-800 rounded overflow-hidden shadow-md">
             {Object.keys(PRESETS).map(presetKey => (
                <button 
                  key={presetKey} 
                  onClick={() => loadPreset(presetKey)}
                  className={`px-3 py-2 text-[10px] font-mono tracking-wider font-bold transition-colors ${selectedPreset === presetKey ? 'bg-indigo-900/50 text-indigo-300' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
                >
                  {presetKey.replace(/_/g, ' ')}
                </button>
             ))}
          </div>
          
          <div className="relative">
            <input 
              type="file" 
              accept=".json" 
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title="Load Robot Morphology JSON"
            />
            <div className="px-4 py-2 rounded font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center justify-between border border-slate-700 pointer-events-none gap-2 text-sm shadow-md h-full">
              <UploadCloud size={16} /> Load JSON
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-900 text-red-400 p-4 rounded text-sm font-mono flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      
      {saveMessage && (
        <div className="bg-emerald-950/50 border border-emerald-900 text-emerald-400 p-4 rounded text-sm font-mono flex items-center gap-2">
          <Check size={16} /> {saveMessage}
        </div>
      )}

      {passport ? (
        <>
        {constraintGuidance && (
          <div className={`border rounded-xl overflow-hidden ${constraintGuidance.tone === 'ready' ? 'border-emerald-900/50 bg-emerald-950/20' : 'border-amber-900/50 bg-amber-950/20'}`}>
            <div className="p-4 font-mono text-xs flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                {constraintGuidance.tone === 'ready' ? <Check size={16} className="mt-0.5 text-emerald-400" /> : <AlertCircle size={16} className="mt-0.5 text-amber-400" />}
                <div className="flex flex-col gap-1">
                  <span className={`font-bold uppercase tracking-widest ${constraintGuidance.tone === 'ready' ? 'text-emerald-300' : 'text-amber-300'}`}>Operator Guidance</span>
                  <span className={`${constraintGuidance.tone === 'ready' ? 'text-emerald-100' : 'text-amber-100'}`}>{constraintGuidance.title}</span>
                  <span className={`${constraintGuidance.tone === 'ready' ? 'text-emerald-200/80' : 'text-amber-200/80'}`}>{constraintGuidance.body}</span>
                </div>
              </div>

              {(isBoundaryViolation || !validatorStatus?.valid) && (
                <button
                  onClick={handleFitZoneToConstraints}
                  className="px-3 py-2 rounded border border-amber-800/60 bg-amber-900/30 text-amber-200 font-bold tracking-wider hover:bg-amber-900/45 transition-colors"
                >
                  Fit Zone To Current Constraints
                </button>
              )}
            </div>
          </div>
        )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
          
          <div className="border border-slate-900 bg-slate-950/60 rounded-xl overflow-hidden flex flex-col">
            <div className="p-6 font-mono text-xs text-slate-300 flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2">
                <span className="font-bold text-slate-100 uppercase tracking-widest">Metadata Registry</span>
                <span className="bg-indigo-900/50 text-indigo-300 px-2 py-1 rounded border border-indigo-800/50 text-[10px] tracking-wider">STATE: PROTOTYPE_STAGED</span>
              </div>
              
              <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Asset ID</span><span className="text-slate-200">{passport.asset_id}</span></div>
                <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Morphology</span><span className="text-slate-200">{passport.morphology_class}</span></div>
                <div>
                  <span className="block text-[10px] text-slate-500 uppercase tracking-widest">Joint Count</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-slate-200">{passport.actuator_joint_count}</span>
                    {passport.actuator_joint_count <= 8 ? (
                      <span className="bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800/50 text-[8px] font-bold tracking-wider">SAFE // LOW TORQUE</span>
                    ) : passport.actuator_joint_count <= 12 ? (
                      <span className="bg-indigo-950 text-indigo-400 px-2 py-0.5 rounded border border-indigo-800/50 text-[8px] font-bold tracking-wider">NOMINAL // HIGH PRECISION</span>
                    ) : (
                      <span className="bg-amber-950 text-amber-400 px-2 py-0.5 rounded border border-amber-800/50 text-[8px] font-bold tracking-wider">HEAVY DUTY // MULTI-AXIS</span>
                    )}
                  </div>
                </div>
                <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Max Tensile</span><span className="text-slate-200">{passport.maximum_tensile_newtons} N</span></div>
                <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Footprint L</span><span className="text-slate-200">{passport.footprint_length_m} m</span></div>
                <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Footprint W</span><span className="text-slate-200">{passport.footprint_width_m} m</span></div>
                <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Max Reach</span><span className="text-emerald-400">{passport.maximum_reach_m} m</span></div>
                {passport.tool_class && <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Tool Class</span><span className="text-slate-200">{passport.tool_class}</span></div>}
                {passport.tendon_count !== undefined && <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Tendon Count</span><span className="text-slate-200">{passport.tendon_count}</span></div>}
              </div>
              
              <div className="mt-2 pt-4 border-t border-slate-800 flex justify-between">
                <button 
                  onClick={handleRegister} 
                  disabled={isBoundaryViolation}
                  className={`px-4 py-2 rounded font-bold tracking-wider transition-colors ${
                    isBoundaryViolation 
                      ? 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                      : 'bg-indigo-900/40 hover:bg-indigo-900/60 border border-indigo-800 text-indigo-300'
                  }`}
                >
                  Register Robotic Asset
                </button>
              </div>
            </div>
            
            <div className="p-6 font-mono text-xs flex flex-col gap-4 border-t border-slate-900 bg-[#07090f]">
               <span className="font-bold text-slate-100 uppercase tracking-widest border-b border-slate-800 pb-2">Path Task Editor</span>
               
               <div className="grid grid-cols-3 gap-4 mb-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-widest mb-1">Path Length (m)</label>
                    <input type="number" step="0.1" value={pathLength} onChange={e => setPathLength(parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-300 focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-widest mb-1">Path Width (m)</label>
                    <input type="number" step="0.1" value={pathWidth} onChange={e => setPathWidth(parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-300 focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-widest mb-1">Turn Radius (m)</label>
                    <input type="number" step="0.1" value={turnRadius} onChange={e => setTurnRadius(parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-300 focus:border-indigo-500 outline-none" />
                  </div>
               </div>

               <span className="font-bold text-slate-100 uppercase tracking-widest border-b border-slate-800 pb-2 mt-2">Tendon & Joint Simulation</span>
               
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="flex justify-between text-[10px] text-slate-500 uppercase tracking-widest mb-1">
                     <span>Shoulder Angle</span>
                     <span className="text-slate-350">{((joint1Angle * 180) / Math.PI).toFixed(0)}°</span>
                   </label>
                   <input 
                     type="range" 
                     min="-90" 
                     max="90" 
                     value={Math.round((joint1Angle * 180) / Math.PI)} 
                     onChange={e => setJoint1Angle((parseFloat(e.target.value) * Math.PI) / 180)} 
                     className="w-full accent-indigo-550 bg-slate-800 rounded-lg appearance-none cursor-pointer h-2" 
                   />
                 </div>
                 
                 <div>
                   <label className="flex justify-between text-[10px] text-slate-500 uppercase tracking-widest mb-1">
                     <span>Elbow Angle</span>
                     <span className="text-slate-350">{((joint2Angle * 180) / Math.PI).toFixed(0)}°</span>
                   </label>
                   <input 
                     type="range" 
                     min="-90" 
                     max="90" 
                     value={Math.round((joint2Angle * 180) / Math.PI)} 
                     onChange={e => setJoint2Angle((parseFloat(e.target.value) * Math.PI) / 180)} 
                     className="w-full accent-indigo-550 bg-slate-800 rounded-lg appearance-none cursor-pointer h-2" 
                   />
                 </div>
                 
                 <div className="col-span-2">
                   <label className="flex justify-between text-[10px] text-slate-500 uppercase tracking-widest mb-1">
                     <span>Tendon Tension (N)</span>
                     <span className="text-slate-350">{tendonTension} N</span>
                   </label>
                   <input 
                     type="range" 
                     min="0" 
                     max={passport.maximum_tensile_newtons} 
                     value={tendonTension} 
                     onChange={e => setTendonTension(parseInt(e.target.value) || 0)} 
                     className="w-full accent-indigo-550 bg-slate-800 rounded-lg appearance-none cursor-pointer h-2" 
                   />
                 </div>
               </div>

               <div className="mt-2 p-3 bg-slate-900/40 border border-slate-850 rounded flex flex-col gap-2">
                 <div className="flex justify-between items-center text-[10px]">
                   <span className="text-slate-500 uppercase tracking-widest">Tendon Path Length</span>
                   <span className="font-bold text-slate-200">{tendonPathLength.toFixed(3)} m</span>
                 </div>
                 <div className="flex justify-between items-center text-[10px]">
                   <span className="text-slate-500 uppercase tracking-widest">Shoulder Joint Torque</span>
                   <span className="font-bold text-slate-200">{shoulderTorque.toFixed(2)} Nm</span>
                 </div>
                 <div className="flex justify-between items-center text-[10px]">
                   <span className="text-slate-500 uppercase tracking-widest">Elbow Joint Torque</span>
                   <span className="font-bold text-slate-200">{elbowTorque.toFixed(2)} Nm</span>
                 </div>
               </div>

                <span className="font-bold text-slate-100 uppercase tracking-widest border-b border-slate-800 pb-2 mt-4 block">Reach Envelope Configurator</span>
                <div className="mt-2 flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-[10px] text-slate-300 uppercase tracking-widest cursor-pointer">
                    <input type="checkbox" checked={showReachEnvelope} onChange={e => setShowReachEnvelope(e.target.checked)} className="accent-indigo-500" />
                    Show Reach Envelope
                  </label>
                  
                  {showReachEnvelope && (
                    <div className="p-2 border border-slate-800 rounded bg-slate-900/50">
                      {envelopeClipped ? (
                        <span className="text-red-400 font-bold text-[10px] tracking-widest uppercase flex items-center gap-2">
                          <AlertCircle size={12} /> Reach envelope intersects configured boundary.
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-bold text-[10px] tracking-widest uppercase flex items-center gap-2">
                          <Check size={12} /> Reach envelope active
                        </span>
                      )}
                    </div>
                  )}
                </div>
             </div>
          </div>

          <div className="border border-slate-900 bg-slate-950/60 rounded-xl overflow-hidden flex flex-col">
            <div className="h-64 bg-[#050505] relative border-b border-slate-900">
              <Canvas camera={{ position: [5, 5, 5], fov: 45 }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} />
                <OrbitControls />
                <gridHelper args={[10, 10, '#333', '#111']} />
                
                {/* Task Path Area */}
                <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[pathWidth, pathLength]} />
                  <meshStandardMaterial color="#f59e0b" transparent opacity={0.1} side={2} />
                </mesh>
                <lineSegments position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <edgesGeometry args={[new THREE.PlaneGeometry(pathWidth, pathLength)]} />
                  <lineBasicMaterial color="#f59e0b" />
                </lineSegments>
                
                {/* Robot Footprint Box */}
                <Box args={[passport.footprint_width_m, 0.5, passport.footprint_length_m]} position={[0, 0.25, 0]}>
                  <meshStandardMaterial color="#4f46e5" wireframe />
                </Box>
                
                {/* Robot Reach Envelope */}
                <mesh position={[0, 0.25, 0]}>
                  <cylinderGeometry args={[passport.maximum_reach_m, passport.maximum_reach_m, 0.5, 32]} />
                  <meshStandardMaterial color="#10b981" transparent opacity={0.08} wireframe={false} />
                </mesh>
                <mesh position={[0, 0.25, 0]}>
                  <cylinderGeometry args={[passport.maximum_reach_m, passport.maximum_reach_m, 0.5, 32]} />
                  <meshStandardMaterial color="#10b981" wireframe />
                </mesh>

                {/* Robotic Arm Links */}
                <mesh position={[0, 0.125, 0]}>
                  <cylinderGeometry args={[0.08, 0.08, 0.25, 16]} />
                  <meshStandardMaterial color="#334155" />
                </mesh>

                {/* Joint 1 (Shoulder) axis */}
                <mesh position={J1} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.06, 0.06, 0.15, 16]} />
                  <meshStandardMaterial color="#475569" />
                </mesh>

                {/* Link 1 (Shoulder to Elbow) */}
                <mesh position={[J1[0] + J2_rot[0]/2, J1[1] + J2_rot[1]/2, J1[2] + J2_rot[2]/2]} rotation={[0, 0, joint1Angle]}>
                  <boxGeometry args={[L1, 0.05, 0.05]} />
                  <meshStandardMaterial color="#4f46e5" />
                </mesh>

                {/* Joint 2 (Elbow) axis */}
                <mesh position={J2} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.05, 0.05, 0.12, 16]} />
                  <meshStandardMaterial color="#475569" />
                </mesh>

                {/* Link 2 (Elbow to End Effector) */}
                <mesh position={[J2[0] + EE_rot[0]/2, J2[1] + EE_rot[1]/2, J2[2] + EE_rot[2]/2]} rotation={[0, 0, joint1Angle + joint2Angle]}>
                  <boxGeometry args={[L2, 0.035, 0.035]} />
                  <meshStandardMaterial color="#3b82f6" />
                </mesh>

                {/* End Effector */}
                <mesh position={EE}>
                  <sphereGeometry args={[0.04, 16, 16]} />
                  <meshStandardMaterial color="#f43f5e" />
                </mesh>

                {/* Joint Pulleys */}
                {tendonConfig.wrap.map((obs, idx) => {
                  const obsPos = obs.linkId === 'link1' ? J1 : J2;
                  return (
                    <mesh key={idx} position={obsPos} rotation={[Math.PI / 2, 0, 0]}>
                      <cylinderGeometry args={[obs.radius, obs.radius, 0.08, 32]} />
                      <meshStandardMaterial color="#475569" transparent opacity={0.3} wireframe />
                    </mesh>
                  );
                })}

                {/* Guide Bushings */}
                {globalGuides.map((g, idx) => (
                  <mesh key={idx} position={g}>
                    <sphereGeometry args={[0.02, 8, 8]} />
                    <meshStandardMaterial color="#818cf8" emissive="#4f46e5" emissiveIntensity={0.5} />
                  </mesh>
                ))}

                {/* Tendon Path Line */}
                {tendonPathPoints.length > 1 && (
                  <line>
                    <bufferGeometry attach="geometry">
                      <float32BufferAttribute
                        attach="attributes-position"
                        args={[new Float32Array(tendonPathPoints.flat()), 3]}
                      />
                    </bufferGeometry>
                    <lineBasicMaterial attach="material" color="#6366f1" linewidth={3} depthWrite={false} />
                  </line>
                )}

                {/* Reach Envelope Cloud */}
                {showReachEnvelope && reachEnvelopePoints.length > 0 && (
                  <points>
                    <bufferGeometry attach="geometry">
                      <float32BufferAttribute
                        attach="attributes-position"
                        args={[new Float32Array(reachEnvelopePoints.flat()), 3]}
                      />
                    </bufferGeometry>
                    <pointsMaterial attach="material" color={envelopeClipped ? "#ef4444" : "#14b8a6"} size={0.03} transparent opacity={0.4} />
                  </points>
                )}

                {/* Safety Clearance Ribbon Boundary */}
                <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[zoneWidth / 2 - 0.03, zoneWidth / 2 + 0.03, 64]} />
                  <meshStandardMaterial 
                    color={isBoundaryViolation ? "#ef4444" : isClearanceCritical ? "#ef4444" : isClearanceWarning ? "#f59e0b" : "#10b981"} 
                    transparent 
                    opacity={0.8} 
                    side={2}
                  />
                </mesh>
              </Canvas>
              <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                 <div className="text-[9px] text-slate-500 font-mono tracking-widest uppercase bg-black/50 px-2 py-1 rounded">3D Schematic Preview</div>
                 <div className="text-[9px] text-amber-500 font-mono tracking-widest uppercase bg-black/50 px-2 py-1 rounded">Path Overlay</div>
              </div>
            </div>

            <div className={`px-4 py-2 font-mono text-[10px] border-b border-slate-900 transition-colors ${
              isBoundaryViolation
                ? 'bg-red-950/60 text-red-400'
                : 'bg-emerald-950/30 text-emerald-400'
            }`}>
              {perimeterCheck.message}
            </div>
            
            <div className="p-6 font-mono text-xs flex flex-col gap-4">
              <span className="font-bold text-slate-100 uppercase tracking-widest border-b border-slate-800 pb-2">Perimeter Validator</span>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-widest mb-1">Zone Length (m)</label>
                  <input type="number" step="0.1" value={zoneLength} onChange={e => setZoneLength(parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-300 focus:border-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-widest mb-1">Zone Width (m)</label>
                  <input type="number" step="0.1" value={zoneWidth} onChange={e => setZoneWidth(parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-300 focus:border-indigo-500 outline-none" />
                </div>
              </div>
              
              <div className={`p-3 rounded border font-bold flex items-center gap-2 ${validatorStatus?.valid && !isBoundaryViolation ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400' : 'bg-red-950/30 border-red-900/50 text-red-400'}`}>
                {validatorStatus?.valid && !isBoundaryViolation ? <Check size={16} /> : <AlertCircle size={16} />}
                {isBoundaryViolation ? perimeterCheck.message : validatorStatus?.message}
              </div>
              
            </div>
          </div>
        </div>

        <div className="border border-slate-900 bg-slate-950/60 rounded-xl overflow-hidden mt-6 print:hidden">
          <div className="p-6 font-mono text-xs flex flex-col gap-4">
            <span className="font-bold text-slate-100 uppercase tracking-widest border-b border-slate-800 pb-2">Morphology Inspection Summary</span>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Asset ID</span><span className="text-slate-200">{passport.asset_id}</span></div>
              <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Morphology Class</span><span className="text-slate-200">{passport.morphology_class}</span></div>
              <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Preset Template</span><span className="text-slate-200">{selectedPreset || 'CUSTOM'}</span></div>
              <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Actuator Joint Count</span><span className="text-slate-200">{passport.actuator_joint_count}</span></div>
              
              <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Maximum Tensile</span><span className="text-slate-200">{passport.maximum_tensile_newtons} N</span></div>
              <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Footprint Length</span><span className="text-slate-200">{passport.footprint_length_m} m</span></div>
              <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Footprint Width</span><span className="text-slate-200">{passport.footprint_width_m} m</span></div>
              <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Maximum Reach</span><span className="text-slate-200">{passport.maximum_reach_m} m</span></div>
              
              <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Path Length</span><span className="text-slate-200">{pathLength} m</span></div>
              <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Path Width</span><span className="text-slate-200">{pathWidth} m</span></div>
              <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Turn Radius</span><span className="text-slate-200">{turnRadius} m</span></div>
              <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Validation Status</span><span className={validatorStatus?.valid ? "text-emerald-400" : "text-red-400"}>{validatorStatus?.message}</span></div>
              
              <div className="col-span-4"><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Perimeter Status</span><span className={!isBoundaryViolation ? "text-emerald-400" : "text-red-400"}>{perimeterCheck.message}</span></div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-800 flex justify-end gap-4">
              <button onClick={handleExportSchematicSnapshot} disabled={!validatorStatus?.valid || isBoundaryViolation} className={`px-4 py-2 rounded font-bold tracking-wider flex items-center gap-2 transition-colors ${validatorStatus?.valid && !isBoundaryViolation ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700' : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'}`}>
                <Download size={14} /> Export Schematic Snapshot
              </button>
              <button onClick={handleExportMorphologyPacket} disabled={!validatorStatus?.valid || isBoundaryViolation} className={`px-4 py-2 rounded font-bold tracking-wider flex items-center gap-2 transition-colors ${validatorStatus?.valid && !isBoundaryViolation ? 'bg-indigo-900/40 hover:bg-indigo-900/60 border border-indigo-800 text-indigo-300' : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'}`}>
                <Download size={14} /> Export Morphology Packet
              </button>
            </div>
          </div>
        </div>

        <div className="border border-slate-900 bg-slate-950/60 rounded-xl overflow-hidden mt-6 print:hidden">
          <div className="p-6 font-mono text-xs flex flex-col gap-4">
            <span className="font-bold text-slate-100 uppercase tracking-widest border-b border-slate-800 pb-2">Fabrication Readiness</span>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Morphology Class</span><span className="text-slate-200">{passport.morphology_class}</span></div>
              <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Joint Count</span><span className="text-slate-200">{passport.actuator_joint_count}</span></div>
              <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Tendon Count</span><span className="text-slate-200">{passport.tendon_count ?? 0}</span></div>
              <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Max Tensile Load</span><span className="text-slate-200">{passport.maximum_tensile_newtons} N</span></div>
              
              <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Footprint</span><span className="text-slate-200">{passport.footprint_length_m}m x {passport.footprint_width_m}m</span></div>
              <div><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Reach</span><span className="text-slate-200">{passport.maximum_reach_m} m</span></div>
              <div className="col-span-2"><span className="block text-[10px] text-slate-500 uppercase tracking-widest">Current Validation State</span><span className={validatorStatus?.valid && !isBoundaryViolation ? "text-emerald-400" : "text-red-400"}>{validatorStatus?.valid && !isBoundaryViolation ? "VALID FOR FABRICATION" : "INVALID"}</span></div>
            </div>

            <div className="mt-2">
              <label className="block text-[10px] text-slate-500 uppercase tracking-widest mb-1">Fabrication Notes</label>
              <textarea 
                value={fabricationNotes}
                onChange={e => setFabricationNotes(e.target.value)}
                className="w-full h-24 bg-slate-900 border border-slate-700 rounded p-2 text-slate-300 focus:border-indigo-500 outline-none resize-none"
                placeholder="Enter routing considerations, anchor point preferences, or structural reinforcement notes here..."
              />
            </div>
            
            <div className="text-[10px] text-amber-500/80 italic mt-2">
              Browser schematic only. Dimensions and routing require physical verification before fabrication.
            </div>
          </div>
        </div>

        <div className="border border-slate-900 bg-slate-950/60 rounded-xl overflow-hidden mt-6 mb-8 print:hidden">
          <div className="p-6 font-mono text-xs flex flex-col gap-4">
            <span className="font-bold text-slate-100 uppercase tracking-widest border-b border-slate-800 pb-2">Validation Ledger</span>
            
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Task Path Validation</span>
                <span className={`font-bold ${validatorStatus?.valid ? 'text-emerald-400' : 'text-red-400'}`}>{validatorStatus?.valid ? 'PASS' : 'FAIL'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Perimeter Validation</span>
                <span className={`font-bold ${!isBoundaryViolation ? 'text-emerald-400' : 'text-red-400'}`}>{!isBoundaryViolation ? 'PASS' : 'FAIL'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Reach Envelope Status</span>
                <span className={`font-bold ${!envelopeClipped ? 'text-emerald-400' : 'text-red-400'}`}>{!envelopeClipped ? 'PASS' : 'CLIPPED'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Tendon Path Length</span>
                <span className="font-bold text-slate-300">{tendonPathLength.toFixed(3)} m</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Shoulder Torque</span>
                <span className="font-bold text-slate-300">{shoulderTorque.toFixed(2)} Nm</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Elbow Torque</span>
                <span className="font-bold text-slate-300">{elbowTorque.toFixed(2)} Nm</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Fabrication Export Eligibility</span>
                <span className={`font-bold ${validatorStatus?.valid && !isBoundaryViolation ? 'text-emerald-400' : 'text-red-400'}`}>{validatorStatus?.valid && !isBoundaryViolation ? 'ELIGIBLE' : 'BLOCKED'}</span>
              </div>
            </div>
            
            <div className={`mt-2 p-3 rounded border font-bold text-[10px] tracking-widest uppercase flex items-center gap-2 ${validatorStatus?.valid && !isBoundaryViolation ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400' : 'bg-red-950/30 border-red-900/50 text-red-400'}`}>
              {validatorStatus?.valid && !isBoundaryViolation 
                ? 'Current morphology passes local geometry checks for fabrication handoff.'
                : 'Current morphology is blocked from fabrication handoff until geometry constraints are resolved.'}
            </div>
          </div>
        </div>

        <div className="border border-slate-900 bg-slate-950/60 rounded-xl overflow-hidden mt-6 mb-8 print:hidden">
          <div className="p-6 font-mono text-xs flex flex-col gap-4">
            <span className="font-bold text-slate-100 uppercase tracking-widest border-b border-slate-800 pb-2">Tendon Routing Ledger</span>
            
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Preset / Configuration Source</span>
                <span className="font-bold text-slate-300">{selectedPreset || 'CUSTOM'}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Guide Point Count</span>
                <span className="font-bold text-slate-300">{!passport?.tendon_count ? 0 : (tendonConfig?.guides?.length || 0)}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Wrap Object Count</span>
                <span className="font-bold text-slate-300">{!passport?.tendon_count ? 0 : (tendonConfig?.wrap?.length || 0)}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Guide Links Used</span>
                <span className="font-bold text-slate-300">{!passport?.tendon_count ? 'NONE' : (Array.from(new Set(tendonConfig?.guides?.map((g: any) => g.linkId) || [])).join(', ') || 'NONE')}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Wrap Links Used</span>
                <span className="font-bold text-slate-300">{!passport?.tendon_count ? 'NONE' : (Array.from(new Set(tendonConfig?.wrap?.map((w: any) => w.linkId) || [])).join(', ') || 'NONE')}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Routing Mode</span>
                <span className="font-bold text-slate-300">
                  {!passport?.tendon_count ? 'NONE' : ((tendonConfig?.wrap?.length || 0) === 0 ? 'DIRECT' : (tendonConfig?.wrap?.length === 1 ? 'WRAPPED_SINGLE_STAGE' : 'WRAPPED_MULTI_STAGE'))}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Current Tendon Path Length</span>
                <span className="font-bold text-slate-300">{!passport?.tendon_count ? '0.000 m' : `${tendonPathLength.toFixed(3)} m`}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Tension Input</span>
                <span className="font-bold text-slate-300">{tendonTension} N</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Shoulder Torque</span>
                <span className="font-bold text-slate-300">{!passport?.tendon_count ? '0.00' : shoulderTorque.toFixed(2)} Nm</span>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Elbow Torque</span>
                <span className="font-bold text-slate-300">{!passport?.tendon_count ? '0.00' : elbowTorque.toFixed(2)} Nm</span>
              </div>
            </div>
            
            <div className={`mt-2 p-3 rounded border font-bold text-[10px] tracking-widest uppercase flex items-center gap-2 bg-slate-900/50 border-slate-800 text-slate-400`}>
              {!passport?.tendon_count 
                ? 'No tendon routing is defined for this morphology.'
                : ((tendonConfig?.wrap?.length || 0) === 0 
                  ? 'Current tendon route is direct and low-complexity.'
                  : ((tendonConfig?.wrap?.length || 0) === 1
                    ? 'Current tendon route includes one wrapped stage. Verify pulley clearance physically.'
                    : 'Current tendon route includes multiple wrapped stages. Verify routing order and anchor clearance physically.'))}
            </div>
          </div>
        </div>

        <div className="border border-slate-900 bg-slate-950/60 rounded-xl overflow-hidden mt-6 mb-8 print:hidden">
          <div className="p-6 font-mono text-xs flex flex-col gap-6">
            <span className="font-bold text-slate-100 uppercase tracking-widest border-b border-slate-800 pb-2">Unified Fabrication Work Order</span>
            
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 p-4 rounded bg-slate-900/50 border border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-800/50 pb-1 mb-2">1. Validation Status</span>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Geometry</span>
                  <span className={`font-bold ${preflightStatus.geometry.status === 'PASS' ? 'text-emerald-400' : 'text-red-400'}`}>{preflightStatus.geometry.status}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Perimeter</span>
                  <span className={`font-bold ${preflightStatus.perimeter.status === 'PASS' ? 'text-emerald-400' : 'text-red-400'}`}>{preflightStatus.perimeter.status}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Readiness</span>
                  <span className={`font-bold ${preflightStatus.isReady ? 'text-emerald-400' : 'text-red-400'}`}>{preflightStatus.isReady ? 'READY' : 'BLOCKED'}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 p-4 rounded bg-slate-900/50 border border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-800/50 pb-1 mb-2">2. Review Artifacts</span>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Review Summary — human-readable inspection artifact</span>
                  <button onClick={() => handlePrintSheet('review')} disabled={!preflightStatus.isReady} className={`px-3 py-1 rounded font-bold tracking-wider flex items-center gap-2 transition-colors ${preflightStatus.isReady ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700' : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'}`}>
                    <Download size={12} /> Print
                  </button>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Fabrication Checklist — confirm-before-build sequence</span>
                  <button onClick={() => handlePrintSheet('checklist')} disabled={!preflightStatus.isReady} className={`px-3 py-1 rounded font-bold tracking-wider flex items-center gap-2 transition-colors ${preflightStatus.isReady ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700' : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'}`}>
                    <Download size={12} /> Print
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 p-4 rounded bg-slate-900/50 border border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-800/50 pb-1 mb-2">3. Bench Artifacts</span>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Bench Build Packet — carry to the fabrication bench</span>
                  <button onClick={() => handlePrintSheet('build-packet')} disabled={!preflightStatus.isReady} className={`px-3 py-1 rounded font-bold tracking-wider flex items-center gap-2 transition-colors ${preflightStatus.isReady ? 'bg-emerald-900/40 hover:bg-emerald-900/60 border border-emerald-800 text-emerald-300' : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'}`}>
                    <Download size={12} /> Print
                  </button>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Assembly Sheet — bench parts & sequence</span>
                  <button onClick={() => handlePrintSheet('assembly')} disabled={!preflightStatus.isReady} className={`px-3 py-1 rounded font-bold tracking-wider flex items-center gap-2 transition-colors ${preflightStatus.isReady ? 'bg-emerald-900/40 hover:bg-emerald-900/60 border border-emerald-800 text-emerald-300' : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'}`}>
                    <Download size={12} /> Print
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 p-4 rounded bg-slate-900/50 border border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-800/50 pb-1 mb-2">4. JSON Handoff Artifacts</span>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Operator Handoff Packet — human-operator ledger</span>
                  <button onClick={handleExportOperatorHandoffPacket} disabled={!preflightStatus.isReady} className={`px-3 py-1 rounded font-bold tracking-wider flex items-center gap-2 transition-colors ${preflightStatus.isReady ? 'bg-indigo-900/40 hover:bg-indigo-900/60 border border-indigo-800 text-indigo-300' : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'}`}>
                    <Download size={12} /> Export JSON
                  </button>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Fabrication Summary JSON — legacy machine-readable format</span>
                  <button onClick={handleExportFabricationPacket} disabled={!preflightStatus.isReady} className={`px-3 py-1 rounded font-bold tracking-wider flex items-center gap-2 transition-colors ${preflightStatus.isReady ? 'bg-indigo-900/40 hover:bg-indigo-900/60 border border-indigo-800 text-indigo-300' : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'}`}>
                    <Download size={12} /> Export JSON
                  </button>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Fabrication Assumptions JSON — material & risk parameters</span>
                  <button onClick={handleExportFabricationAssumptions} disabled={!preflightStatus.isReady} className={`px-3 py-1 rounded font-bold tracking-wider flex items-center gap-2 transition-colors ${preflightStatus.isReady ? 'bg-amber-900/40 hover:bg-amber-900/60 border border-amber-800 text-amber-300' : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'}`}>
                    <Download size={12} /> Export JSON
                  </button>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Parts Cut Sheet JSON — inventory limits</span>
                  <button onClick={handleExportPartsCutSheet} disabled={!preflightStatus.isReady} className={`px-3 py-1 rounded font-bold tracking-wider flex items-center gap-2 transition-colors ${preflightStatus.isReady ? 'bg-amber-900/40 hover:bg-amber-900/60 border border-amber-800 text-amber-300' : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'}`}>
                    <Download size={12} /> Export JSON
                  </button>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Build Packet JSON — canonical machine-readable fabrication handoff</span>
                  <button onClick={handleExportCombinedFabricationPacket} disabled={!preflightStatus.isReady} className={`px-3 py-1 rounded font-bold tracking-wider flex items-center gap-2 transition-colors ${preflightStatus.isReady ? 'bg-fuchsia-900/40 hover:bg-fuchsia-900/60 border border-fuchsia-800 text-fuchsia-300' : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'}`}>
                    <Download size={12} /> Export JSON
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 text-[10px] text-amber-500/80 italic text-center font-bold">
              5. Physical Verification Boundary: Browser schematic only. Dimensions, clearances, routing, and fit require physical verification before fabrication or actuation.
            </div>
          </div>
        </div>

        <div className={`${activePrintSheet === 'review' ? 'hidden print:block' : 'hidden'} border border-slate-900 bg-slate-950/60 rounded-xl overflow-hidden mt-6 mb-8`}>
          <div className="p-6 font-mono text-xs flex flex-col gap-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="font-bold text-slate-100 uppercase tracking-widest">Review Summary</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-800/50 pb-1">Morphology Identity</span>
                <div className="flex justify-between"><span className="text-slate-400">Asset ID</span><span className="font-bold text-slate-200">{passport.asset_id}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Preset Template</span><span className="font-bold text-slate-200">{selectedPreset || 'CUSTOM'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Morphology Class</span><span className="font-bold text-slate-200">{passport.morphology_class}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Joint Count</span><span className="font-bold text-slate-200">{passport.actuator_joint_count}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Tendon Count</span><span className="font-bold text-slate-200">{passport.tendon_count ?? 0}</span></div>
              </div>
              
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-800/50 pb-1">Fabrication Readiness</span>
                <div className="flex justify-between"><span className="text-slate-400">Max Tensile Load</span><span className="font-bold text-slate-200">{passport.maximum_tensile_newtons} N</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Footprint</span><span className="font-bold text-slate-200">{passport.footprint_length_m}m x {passport.footprint_width_m}m</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Reach</span><span className="font-bold text-slate-200">{passport.maximum_reach_m} m</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Export Eligibility</span><span className={`font-bold ${validatorStatus?.valid && !isBoundaryViolation ? 'text-emerald-400' : 'text-red-400'}`}>{validatorStatus?.valid && !isBoundaryViolation ? 'ELIGIBLE' : 'BLOCKED'}</span></div>
              </div>
              
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-800/50 pb-1">Task Path & Validation</span>
                <div className="flex justify-between"><span className="text-slate-400">Path Dimensions</span><span className="font-bold text-slate-200">{pathLength.toFixed(1)}m x {pathWidth.toFixed(1)}m</span></div>
                <div className="text-[10px] leading-relaxed mt-1 p-2 rounded bg-slate-900/50 border border-slate-800/50 flex-1">
                  <span className={`block font-bold mb-1 ${validatorStatus?.valid && !isBoundaryViolation ? 'text-emerald-400' : 'text-red-400'}`}>{validatorStatus?.valid && !isBoundaryViolation ? 'PASSES GEOMETRY CHECKS' : 'BLOCKED BY CONSTRAINTS'}</span>
                  <span className="text-slate-400">{validatorStatus?.valid && !isBoundaryViolation ? 'Current morphology passes local geometry checks for fabrication handoff.' : 'Current morphology is blocked from fabrication handoff until geometry constraints are resolved.'}</span>
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-800/50 pb-1">Tendon Routing Summary</span>
                <div className="flex justify-between"><span className="text-slate-400">Routing Mode</span><span className="font-bold text-slate-200">{!passport?.tendon_count ? 'NONE' : ((tendonConfig?.wrap?.length || 0) === 0 ? 'DIRECT' : (tendonConfig?.wrap?.length === 1 ? 'WRAPPED_SINGLE_STAGE' : 'WRAPPED_MULTI_STAGE'))}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Guide Links</span><span className="font-bold text-slate-200 truncate ml-4 text-right max-w-[200px]">{!passport?.tendon_count ? 'NONE' : (Array.from(new Set(tendonConfig?.guides?.map((g: any) => g.linkId) || [])).join(', ') || 'NONE')}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Wrap Links</span><span className="font-bold text-slate-200 truncate ml-4 text-right max-w-[200px]">{!passport?.tendon_count ? 'NONE' : (Array.from(new Set(tendonConfig?.wrap?.map((w: any) => w.linkId) || [])).join(', ') || 'NONE')}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Path / Torques</span><span className="font-bold text-slate-200">{!passport?.tendon_count ? '0m / 0Nm / 0Nm' : `${tendonPathLength.toFixed(2)}m / ${shoulderTorque.toFixed(1)}Nm / ${elbowTorque.toFixed(1)}Nm`}</span></div>
                <div className="text-[10px] leading-relaxed mt-1 p-2 rounded bg-slate-900/50 border border-slate-800/50 flex-1">
                  <span className="text-slate-400">
                    {!passport?.tendon_count 
                    ? 'No tendon routing is defined for this morphology.'
                    : ((tendonConfig?.wrap?.length || 0) === 0 
                      ? 'Current tendon route is direct and low-complexity.'
                      : ((tendonConfig?.wrap?.length || 0) === 1
                        ? 'Current tendon route includes one wrapped stage. Verify pulley clearance physically.'
                        : 'Current tendon route includes multiple wrapped stages. Verify routing order and anchor clearance physically.'))}
                  </span>
                </div>
              </div>
            </div>
            
            {fabricationNotes && (
              <div className="flex flex-col gap-2 mt-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-800/50 pb-1">Fabrication Notes</span>
                <div className="text-slate-300 whitespace-pre-wrap leading-relaxed p-3 rounded bg-slate-900/30 border border-slate-800/50">{fabricationNotes}</div>
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-slate-800 text-[10px] text-amber-500/80 italic text-center font-bold">
              Browser schematic only. Dimensions, clearances, and routing require physical verification before fabrication or actuation.
            </div>
          </div>
        </div>

        <div className="border border-slate-900 bg-slate-950/60 rounded-xl overflow-hidden mt-6 mb-8 print:hidden">
          <div className="p-6 font-mono text-xs flex flex-col gap-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="font-bold text-slate-100 uppercase tracking-widest">Fabrication Planning</span>

            </div>

            <div className="text-[10px] text-slate-500 leading-relaxed">
              Supporting bench data for the work order: material assumptions, operator notes, and parts/assembly estimates that inform fabrication without replacing physical measurement.
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Frame Material</span>
                <span className="font-bold text-slate-300">{assumedFrame}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Joint Type</span>
                <span className="font-bold text-slate-300">{assumedJoints}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Tendon / Cable Type</span>
                <span className="font-bold text-slate-300">{assumedTendons}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Pulley / Guide Strategy</span>
                <span className="font-bold text-slate-300">{assumedPulleys}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">End Effector Mount</span>
                <span className="font-bold text-slate-300">{assumedEndEffector}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Est. Printed Part Count</span>
                <span className="font-bold text-slate-300">{assumedParts}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Est. Fastener Complexity</span>
                <span className="font-bold text-slate-300">{assumedFasteners}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Bench Assembly Risk</span>
                <span className="font-bold text-slate-300">{assumedRisk}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 print:hidden">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-slate-500 uppercase tracking-widest">Frame Material Notes</label>
                <textarea 
                  value={frameMaterialNotes}
                  onChange={e => setFrameMaterialNotes(e.target.value)}
                  className="w-full h-20 bg-slate-900 border border-slate-700 rounded p-2 text-slate-300 focus:border-indigo-500 outline-none resize-none"
                  placeholder="Infill density, core strength..."
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-slate-500 uppercase tracking-widest">Cable Routing Notes</label>
                <textarea 
                  value={cableRoutingNotes}
                  onChange={e => setCableRoutingNotes(e.target.value)}
                  className="w-full h-20 bg-slate-900 border border-slate-700 rounded p-2 text-slate-300 focus:border-indigo-500 outline-none resize-none"
                  placeholder="Tensioning mechanism, chafing risks..."
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-slate-500 uppercase tracking-widest">Assembly Notes</label>
                <textarea 
                  value={assemblyNotes}
                  onChange={e => setAssemblyNotes(e.target.value)}
                  className="w-full h-20 bg-slate-900 border border-slate-700 rounded p-2 text-slate-300 focus:border-indigo-500 outline-none resize-none"
                  placeholder="Build order, fastener torques..."
                />
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-800">
              <span className="font-bold text-slate-100 uppercase tracking-widest border-b border-slate-800 pb-2 block">Parts & Assembly Sheet</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Frame Rails Count</span>
                <span className="font-bold text-slate-300">{estimatedFrameRails}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Frame Rail Length</span>
                <span className="font-bold text-slate-300">{estimatedFrameRailLength.toFixed(2)} m</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Joint Housings</span>
                <span className="font-bold text-slate-300">{estimatedJointHousings}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Tendon Anchors</span>
                <span className="font-bold text-slate-300">{estimatedTendonAnchors}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Pulley / Idler Count</span>
                <span className="font-bold text-slate-300">{estimatedPulleyCount}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Guide Bushings</span>
                <span className="font-bold text-slate-300">{estimatedGuideBushings}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">End Effector Mounts</span>
                <span className="font-bold text-slate-300">1</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Est. Tendon Line Length</span>
                <span className="font-bold text-slate-300">{estimatedTendonLineLength.toFixed(2)} m</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Fastener Family</span>
                <span className="font-bold text-slate-300">{assumedFasteners}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Assembly Sequence</span>
                <span className="font-bold text-slate-300 text-right ml-4">{benchAssemblySequence}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50 md:col-span-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Assembly Risk</span>
                <span className="font-bold text-slate-300">{assumedRisk}</span>
              </div>
            </div>

            <div className="mt-2 p-3 rounded border border-slate-800/50 bg-slate-900/30 text-[10px] text-slate-400 leading-relaxed">
              This sheet is a bench-build planning aid derived from the current morphology, routing, and assumptions state. Cut lengths, hole placement, and fit still need physical measurement at assembly time.
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 text-[10px] text-amber-500/80 italic text-center font-bold">
              Fabrication assumptions only. Material choice, tolerances, assembly fit, cut lengths, and hole placement require physical verification before build.
            </div>
          </div>
        </div>

        <div className={`${activePrintSheet === 'assembly' ? 'hidden print:block' : 'hidden'} border border-slate-900 bg-slate-950/60 rounded-xl overflow-hidden mt-6 mb-8`}>
          <div className="p-6 font-mono text-xs flex flex-col gap-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="font-bold text-slate-100 uppercase tracking-widest">Assembly Sheet</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest">{passport.asset_id}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex justify-between"><span className="text-slate-400">Preset Template</span><span className="font-bold text-slate-200">{selectedPreset || 'CUSTOM'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Morphology Class</span><span className="font-bold text-slate-200">{passport.morphology_class}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Frame Material</span><span className="font-bold text-slate-200">{assumedFrame}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Joint Type</span><span className="font-bold text-slate-200">{assumedJoints}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Frame Rails Count</span><span className="font-bold text-slate-200">{estimatedFrameRails}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Frame Rail Length</span><span className="font-bold text-slate-200">{estimatedFrameRailLength.toFixed(2)} m</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Joint Housings</span><span className="font-bold text-slate-200">{estimatedJointHousings}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Tendon Anchors</span><span className="font-bold text-slate-200">{estimatedTendonAnchors}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Pulley / Idler Count</span><span className="font-bold text-slate-200">{estimatedPulleyCount}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Guide Bushings</span><span className="font-bold text-slate-200">{estimatedGuideBushings}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Est. Tendon Line Length</span><span className="font-bold text-slate-200">{estimatedTendonLineLength.toFixed(2)} m</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Assembly Risk</span><span className="font-bold text-slate-200">{assumedRisk}</span></div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="p-3 rounded bg-slate-900/30 border border-slate-800/50">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Assembly Sequence</div>
                <div className="text-slate-200">{benchAssemblySequence}</div>
              </div>
              {assemblyNotes && (
                <div className="p-3 rounded bg-slate-900/30 border border-slate-800/50">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Assembly Notes</div>
                  <div className="text-slate-200 whitespace-pre-wrap">{assemblyNotes}</div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 text-[10px] text-amber-500/80 italic text-center font-bold">
              Fabrication planning only. Cut lengths, hole placement, and fit require physical measurement before build.
            </div>
          </div>
        </div>

        <div className={`${activePrintSheet === 'checklist' ? 'hidden print:block' : 'hidden'} border border-slate-900 bg-slate-950/60 rounded-xl overflow-hidden mt-6 mb-8`}>
          <div className="p-6 font-mono text-xs flex flex-col gap-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="font-bold text-slate-100 uppercase tracking-widest">Print-Ready Fabrication Checklist</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest">{passport.asset_id}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex justify-between"><span className="text-slate-400">Preset Template</span><span className="font-bold text-slate-200">{selectedPreset || 'CUSTOM'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Morphology Class</span><span className="font-bold text-slate-200">{passport.morphology_class}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Current Zone</span><span className="font-bold text-slate-200">{zoneLength.toFixed(1)}m x {zoneWidth.toFixed(1)}m</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Fitted Recovery Zone</span><span className="font-bold text-slate-200">{requiredZoneLength.toFixed(1)}m x {requiredZoneWidth.toFixed(1)}m</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Task Path</span><span className="font-bold text-slate-200">{pathLength.toFixed(1)}m x {pathWidth.toFixed(1)}m</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Turn Radius</span><span className="font-bold text-slate-200">{turnRadius.toFixed(1)}m</span></div>
            </div>

            <div className="p-4 rounded border border-emerald-900/50 bg-emerald-950/20">
              <div className="text-[10px] text-emerald-300 uppercase tracking-widest mb-2">Release Status</div>
              <div className="text-emerald-100 font-bold mb-1">Geometry passes the current local checks.</div>
              <div className="text-emerald-200/80">The morphology is eligible for registration, print review, and fabrication-facing exports.</div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="p-3 rounded bg-slate-900/30 border border-slate-800/50">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Recovery Action</div>
                <div className="text-slate-200">If a later edit blocks fabrication, use <span className="font-bold">Fit Zone To Current Constraints</span> to recover the zone boundary to {requiredZoneLength.toFixed(1)}m x {requiredZoneWidth.toFixed(1)}m.</div>
              </div>
              <div className="p-3 rounded bg-slate-900/30 border border-slate-800/50">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Fabrication Notes</div>
                <div className="text-slate-200 whitespace-pre-wrap">{fabricationNotes || 'No fabrication notes recorded.'}</div>
              </div>
              <div className="p-3 rounded bg-slate-900/30 border border-slate-800/50">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Operator Notes</div>
                <div className="text-slate-200 whitespace-pre-wrap">
                  Frame: {frameMaterialNotes || 'None recorded.'}
                  {'\n'}Routing: {cableRoutingNotes || 'None recorded.'}
                  {'\n'}Assembly: {assemblyNotes || 'None recorded.'}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 text-[10px] text-amber-500/80 italic text-center font-bold">
              Browser schematic only. Dimensions, clearances, and routing require physical verification before fabrication or actuation.
            </div>
          </div>
        </div>
        <div className={`${activePrintSheet === 'build-packet' ? 'hidden print:block' : 'hidden'} border border-slate-900 bg-slate-950/60 rounded-xl overflow-hidden mt-6 mb-8`}>
          <div className="p-6 font-mono text-xs flex flex-col gap-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="font-bold text-slate-100 uppercase tracking-widest">Bench Build Packet</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest">{passport.asset_id}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-800/50 pb-1">Morphology Identity</span>
                <div className="flex justify-between"><span className="text-slate-400">Preset Template</span><span className="font-bold text-slate-200">{selectedPreset || 'CUSTOM'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Morphology Class</span><span className="font-bold text-slate-200">{passport.morphology_class}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Joint Count</span><span className="font-bold text-slate-200">{passport.actuator_joint_count}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Tendon Count</span><span className="font-bold text-slate-200">{passport.tendon_count ?? 0}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Max Tensile Load</span><span className="font-bold text-slate-200">{passport.maximum_tensile_newtons} N</span></div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-800/50 pb-1">Preflight Status</span>
                <div className="flex justify-between"><span className="text-slate-400">Geometry</span><span className="font-bold text-emerald-400">{preflightStatus.geometry.status}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Perimeter</span><span className="font-bold text-emerald-400">{preflightStatus.perimeter.status}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Fabrication Assumptions</span><span className={`font-bold ${preflightStatus.fabricationAssumptions.status === 'PASS' ? 'text-emerald-400' : 'text-slate-400'}`}>{preflightStatus.fabricationAssumptions.status}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Tendon Routing</span><span className={`font-bold ${preflightStatus.tendonRouting.status === 'PASS' ? 'text-emerald-400' : 'text-slate-400'}`}>{preflightStatus.tendonRouting.status}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Readiness</span><span className="font-bold text-emerald-400">{preflightStatus.isReady ? 'READY' : 'BLOCKED'}</span></div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-800/50 pb-1">Routing & Path</span>
                <div className="flex justify-between"><span className="text-slate-400">Routing Mode</span><span className="font-bold text-slate-200">{!passport?.tendon_count ? 'NONE' : ((tendonConfig?.wrap?.length || 0) === 0 ? 'DIRECT' : (tendonConfig?.wrap?.length === 1 ? 'WRAPPED_SINGLE_STAGE' : 'WRAPPED_MULTI_STAGE'))}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Wrap Links</span><span className="font-bold text-slate-200 truncate ml-4 text-right">{!passport?.tendon_count ? 'NONE' : (Array.from(new Set(tendonConfig?.wrap?.map((w: any) => w.linkId) || [])).join(', ') || 'NONE')}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Path / Torques</span><span className="font-bold text-slate-200">{!passport?.tendon_count ? '0m / 0Nm / 0Nm' : `${tendonPathLength.toFixed(2)}m / ${shoulderTorque.toFixed(1)}Nm / ${elbowTorque.toFixed(1)}Nm`}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Task Path</span><span className="font-bold text-slate-200">{pathLength.toFixed(1)}m x {pathWidth.toFixed(1)}m</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Reach Envelope</span><span className="font-bold text-slate-200">{!envelopeClipped ? 'PASS' : 'CLIPPED'}</span></div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-800/50 pb-1">Fabrication Assumptions</span>
                <div className="flex justify-between"><span className="text-slate-400">Frame Material</span><span className="font-bold text-slate-200">{assumedFrame}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Joint Type</span><span className="font-bold text-slate-200">{assumedJoints}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Tendon Type</span><span className="font-bold text-slate-200">{assumedTendons}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Pulley Strategy</span><span className="font-bold text-slate-200">{assumedPulleys}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">End Effector Mount</span><span className="font-bold text-slate-200">{assumedEndEffector}</span></div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-800/50 pb-1">Parts & Assembly</span>
                <div className="flex justify-between"><span className="text-slate-400">Frame Rails / Length</span><span className="font-bold text-slate-200">{estimatedFrameRails} / {estimatedFrameRailLength.toFixed(2)} m</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Joint Housings</span><span className="font-bold text-slate-200">{estimatedJointHousings}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Tendon Anchors</span><span className="font-bold text-slate-200">{estimatedTendonAnchors}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Pulley Count</span><span className="font-bold text-slate-200">{estimatedPulleyCount}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Assembly Risk</span><span className="font-bold text-slate-200">{assumedRisk}</span></div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="p-3 rounded bg-slate-900/30 border border-slate-800/50">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Assembly Sequence</div>
                <div className="text-slate-200">{benchAssemblySequence}</div>
              </div>
              <div className="p-3 rounded bg-slate-900/30 border border-slate-800/50">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Operator Notes</div>
                <div className="text-slate-200 whitespace-pre-wrap">
                  General: {fabricationNotes || 'None recorded.'}
                  {'\n'}Frame: {frameMaterialNotes || 'None recorded.'}
                  {'\n'}Routing: {cableRoutingNotes || 'None recorded.'}
                  {'\n'}Assembly: {assemblyNotes || 'None recorded.'}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 text-[10px] text-amber-500/80 italic text-center font-bold">
              Browser schematic only. Dimensions, clearances, routing, and fit require physical verification before fabrication or actuation.
            </div>
          </div>
        </div>
        </>
      ) : (
        <div className="flex-1 min-h-[300px] flex items-center justify-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/30">
          <div className="text-slate-500 font-mono text-sm flex flex-col items-center gap-3">
            <UploadCloud size={32} className="opacity-50" />
            Load a valid JSON morphology passport or select a local template preset to begin.
          </div>
        </div>
      )}
    </div>
  );
}
