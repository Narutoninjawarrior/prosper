/**
 * @file test-work-pack.ts
 * @description Hardened unit tests for PhysicalWorkPackV1 (Operational Work Card) validation rules.
 */

import { 
  PhysicalWorkPackV1, 
  validatePhysicalWorkPack,
  StopConditionV1
} from '../frontend/src/lib/physicalWorkPack';

const sampleStopConditions: StopConditionV1[] = [
  { condition_id: 'abort_battery', description: 'Battery low', required_response: 'Return to dock' }
];

const baseConstructionPack: PhysicalWorkPackV1 = {
  id: 'wcard-construction-001',
  version: 'v1.0.0',
  facility_reference: {
    facility_id: 'facility-example-cottage',
    facility_title: 'Example Cottage Plan'
  },
  target_assets: ['wall-frame-east'],
  task: {
    description: 'Install timber wall framing for eastern bedroom wall',
    task_class: 'install'
  },
  proposed_operator: {
    type: 'human',
    required_role_or_qualification: 'Carpenter Apprentice'
  },
  spatial_boundary: {
    facility_zone: 'Bedroom / Zone 2',
    coordinates: 'Local Grid [10.4, -5.2]'
  },
  resource_requirements: {
    materials: ['Timber studs 2x4 (x15)', 'Screws 3" (x100)'],
    tools: ['Miter Saw', 'Impact Driver', 'Tape Measure'],
    estimated_labor_hours: 6
  },
  constraints: {
    safety_limits: ['Wear eye protection', 'Secure workpieces during cuts'],
    stop_conditions: sampleStopConditions
  },
  dependencies: ['Foundation curing completed'],
  approvals: {},
  status: 'DRAFT',
  truth_boundary: 'DRAFT/PROPOSED local planning draft only. Not live execution command.',
  domain_extensions: {
    construction: {
      building_code_reference: 'Verified Code Section',
      structural_inspection_required: true
    }
  }
};

const baseRoboticPack: PhysicalWorkPackV1 = {
  id: 'wcard-robotic-002',
  version: 'v1.0.0',
  facility_reference: {
    facility_id: 'facility-example-biosphere',
    facility_title: 'Example Biosphere Chamber'
  },
  target_assets: ['cacao-humidity-sensor-04'],
  task: {
    description: 'Inspect cacao tree humidity sensor',
    task_class: 'inspection'
  },
  proposed_operator: {
    type: 'robot',
    required_role_or_qualification: 'Autonomous Inspection Swarm Agent'
  },
  spatial_boundary: {
    facility_zone: 'Cacao Conservatory / Node B',
    coordinates: 'Local Grid [2.1, 4.8]'
  },
  resource_requirements: {
    materials: [],
    tools: ['Swarm Drone Model A'],
    estimated_labor_hours: 0.5
  },
  constraints: {
    safety_limits: ['Keep altitude below 2.5m', 'Maintain 0.5m clearance from leaves'],
    stop_conditions: sampleStopConditions
  },
  dependencies: [],
  approvals: {
    reviewed_by: 'reviewer_01',
    reviewed_at: '2026-07-01',
    authorized_by: 'authorizer_01',
    authorized_at: '2026-07-01'
  },
  status: 'AUTHORIZED',
  truth_boundary: 'AUTHORIZED local planning draft.',
  domain_extensions: {
    biological: {
      species: 'Theobroma cacao',
      cultivar: 'Criollo',
      health_metric_target: 'Relative Humidity 70-85%'
    },
    robotic: {
      command_vocabulary: ['NAV_TO', 'MEASURE_HUMIDITY', 'RETURN_TO_DOCK'],
      max_payload_kg: 0.2,
      safe_state_mode: 'AUTO_LAND_IMMEDIATE'
    }
  }
};

let exitCode = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  [FAIL] ${msg}`);
    exitCode = 1;
  } else {
    console.log(`  [PASS] ${msg}`);
  }
}

console.log('Running Hardened PhysicalWorkPackV1 Validation Tests...\n');

// 1. Test DRAFT construction pack passes
{
  console.log('Test 1: Valid DRAFT construction pack passes');
  const errors = validatePhysicalWorkPack(baseConstructionPack);
  assert(errors.length === 0, 'Should return zero errors for a valid draft.');
}

// 2. Test Illegal transitions: REVIEWED status without reviewer ID or timestamp
{
  console.log('Test 2: REVIEWED status requires reviewed_by and reviewed_at');
  const pack1 = { ...baseConstructionPack, status: 'REVIEWED' as const, approvals: { reviewed_at: '2026-07-01' } };
  const errors1 = validatePhysicalWorkPack(pack1);
  assert(errors1.some(e => e.field === 'approvals.reviewed_by'), 'Should fail when reviewed_by is missing.');

  const pack2 = { ...baseConstructionPack, status: 'REVIEWED' as const, approvals: { reviewed_by: 'reviewer_1' } };
  const errors2 = validatePhysicalWorkPack(pack2);
  assert(errors2.some(e => e.field === 'approvals.reviewed_at'), 'Should fail when reviewed_at is missing.');
}

// 3. Test Authorization without Review
{
  console.log('Test 3: AUTHORIZED status requires prior review details');
  const pack = { 
    ...baseConstructionPack, 
    status: 'AUTHORIZED' as const, 
    approvals: { 
      authorized_by: 'authorizer_1', 
      authorized_at: '2026-07-01' 
    } 
  };
  const errors = validatePhysicalWorkPack(pack);
  assert(errors.some(e => e.field === 'approvals.reviewed_by'), 'Should fail when reviewed_by is missing on AUTHORIZED status.');
  assert(errors.some(e => e.field === 'approvals.reviewed_at'), 'Should fail when reviewed_at is missing on AUTHORIZED status.');
}

// 4. Test Missing explicit dates on approvals
{
  console.log('Test 4: Missing explicit dates validation');
  const pack = {
    ...baseRoboticPack,
    approvals: {
      ...baseRoboticPack.approvals,
      authorized_at: '  '
    }
  };
  const errors = validatePhysicalWorkPack(pack);
  assert(errors.some(e => e.field === 'approvals.authorized_at'), 'Should fail when authorized_at is whitespace/empty.');
}

// 5. Test DRAFT containing review/authorization records
{
  console.log('Test 5: DRAFT status containing authorization or review is forbidden');
  const pack1 = { ...baseConstructionPack, approvals: { reviewed_by: 'reviewer_1' } };
  const errors1 = validatePhysicalWorkPack(pack1);
  assert(errors1.some(e => e.field === 'approvals'), 'Should fail when DRAFT has reviewed_by.');

  const pack2 = { ...baseConstructionPack, approvals: { authorized_by: 'authorizer_1' } };
  const errors2 = validatePhysicalWorkPack(pack2);
  assert(errors2.some(e => e.field === 'approvals'), 'Should fail when DRAFT has authorized_by.');
}

// 6. Test Robotic work without safe state or command vocabulary
{
  console.log('Test 6: Robotic work validation checks');
  const pack1 = {
    ...baseRoboticPack,
    domain_extensions: {
      ...baseRoboticPack.domain_extensions,
      robotic: {
        command_vocabulary: [],
        safe_state_mode: 'HOLD_POSITION'
      }
    }
  };
  const errors1 = validatePhysicalWorkPack(pack1);
  assert(errors1.some(e => e.field === 'domain_extensions.robotic.command_vocabulary'), 'Should fail if command vocabulary is empty.');

  const pack2 = {
    ...baseRoboticPack,
    domain_extensions: {
      ...baseRoboticPack.domain_extensions,
      robotic: {
        command_vocabulary: ['NAV_TO'],
        safe_state_mode: '  '
      }
    }
  };
  const errors2 = validatePhysicalWorkPack(pack2);
  assert(errors2.some(e => e.field === 'domain_extensions.robotic.safe_state_mode'), 'Should fail if safe state mode is blank.');
}

// 7. Test Invalid numerical values
{
  console.log('Test 7: Estimated labor hours must be non-negative and finite');
  const pack1 = {
    ...baseConstructionPack,
    resource_requirements: {
      ...baseConstructionPack.resource_requirements,
      estimated_labor_hours: -2.5
    }
  };
  const errors1 = validatePhysicalWorkPack(pack1);
  assert(errors1.some(e => e.field === 'resource_requirements.estimated_labor_hours'), 'Should fail when estimated hours is negative.');

  const pack2 = {
    ...baseConstructionPack,
    resource_requirements: {
      ...baseConstructionPack.resource_requirements,
      estimated_labor_hours: NaN
    }
  };
  const errors2 = validatePhysicalWorkPack(pack2);
  assert(errors2.some(e => e.field === 'resource_requirements.estimated_labor_hours'), 'Should fail when estimated hours is NaN.');
}

// 8. Test Domain-extension serialization
{
  console.log('Test 8: Domain extensions survive JSON roundtrip');
  const serialized = JSON.stringify(baseRoboticPack);
  const parsed: PhysicalWorkPackV1 = JSON.parse(serialized);
  assert(parsed.domain_extensions.biological?.species === 'Theobroma cacao', 'Biological species survives serialization.');
  assert(parsed.domain_extensions.robotic?.safe_state_mode === 'AUTO_LAND_IMMEDIATE', 'Robotic safe state mode survives serialization.');
}

// 9. Test malformed stop condition rejection
{
  console.log('Test 9: Malformed stop conditions fail validation');
  const malformedConditions: StopConditionV1[] = [
    { condition_id: 'abort_low_temp', description: '  ', required_response: 'Activate heater' },
    { condition_id: '  ', description: 'Low pressure', required_response: 'Halt pump' },
    { condition_id: 'abort_overpressure', description: 'Pressure exceeds limit', required_response: '  ' }
  ];
  const pack = {
    ...baseConstructionPack,
    constraints: {
      ...baseConstructionPack.constraints,
      stop_conditions: malformedConditions
    }
  };
  const errors = validatePhysicalWorkPack(pack);
  assert(errors.some(e => e.field === 'constraints.stop_conditions[0].description'), 'Should reject empty stop condition description.');
  assert(errors.some(e => e.field === 'constraints.stop_conditions[1].condition_id'), 'Should reject empty stop condition ID.');
  assert(errors.some(e => e.field === 'constraints.stop_conditions[2].required_response'), 'Should reject empty stop condition response.');
}

// 10. Test Dependency / Prerequisite verification
{
  console.log('Test 10: Prerequisite dependency resolution');
  const packWithReqs = {
    ...baseConstructionPack,
    prerequisite_work_card_ids: ['wcard-001', 'wcard-002']
  };

  // Case 1: No context provided -> should fail
  const errors1 = validatePhysicalWorkPack(packWithReqs);
  assert(errors1.some(e => e.message.includes('not completed (wcard-001)')), 'Should fail when context missing and prerequisites unresolved.');

  // Case 2: Context provided but missing some -> should fail
  const errors2 = validatePhysicalWorkPack(packWithReqs, { completed_work_card_ids: ['wcard-001'] });
  assert(errors2.some(e => e.message.includes('not completed (wcard-002)')), 'Should fail when card references missing prerequisite.');

  // Case 3: Context provided and all satisfied -> should pass
  const errors3 = validatePhysicalWorkPack(packWithReqs, { completed_work_card_ids: ['wcard-001', 'wcard-002', 'wcard-003'] });
  assert(errors3.length === 0, 'Should pass when all prerequisites are satisfied in local context.');
}

console.log(`\nTests completed. Exit code: ${exitCode}`);
process.exit(exitCode);
