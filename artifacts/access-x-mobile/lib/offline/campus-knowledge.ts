/**
 * G Sense Offline Campus Knowledge Base
 *
 * Provides localized, zero-network spatial knowledge extracted from
 * campus environmental memory for buildings, elevators, accessible ramps,
 * and key destinations.
 */

export interface CampusLocation {
  id: string;
  name: string;
  block: string;
  floor: number;
  hasElevator: boolean;
  accessibleEntrance: boolean;
  stairFreeRoute: string;
  description: string;
  nearbyHazards?: string[];
}

export const CAMPUS_LOCATIONS: CampusLocation[] = [
  {
    id: 'library',
    name: 'Main Campus Library',
    block: 'Block A / Concourse',
    floor: 1,
    hasElevator: true,
    accessibleEntrance: true,
    stairFreeRoute: 'Use the east concourse toward the Library entrance. It is longer but stays completely level and step-free.',
    description: 'Ground floor facility with automatic sliding doors and audio beacon at the front reception.',
    nearbyHazards: ['Crowded corridor during class changes', 'Heavy manual interior doors in west wing'],
  },
  {
    id: 'block-a-corridor',
    name: 'Block A Main Corridor',
    block: 'Block A',
    floor: 1,
    hasElevator: true,
    accessibleEntrance: true,
    stairFreeRoute: 'Follow the tactile tactile paving along the right wall. The corridor connects directly to the central atrium.',
    description: 'Central connector hall. Connects east concourse to west classrooms.',
    nearbyHazards: ['Temporary furniture placement near room 104', 'Fire hose cabinet projection on north wall'],
  },
  {
    id: 'elevator-block-a',
    name: 'Block A Central Elevator',
    block: 'Block A',
    floor: 1,
    hasElevator: true,
    accessibleEntrance: true,
    stairFreeRoute: 'Located 15 meters past Room 102 on the left side of the main corridor.',
    description: 'Equipped with Braille buttons, voice announcements, and wide door clearance for wheelchairs.',
  },
  {
    id: 'computer-lab',
    name: 'Accessible Computer Workstation Lab',
    block: 'Block B',
    floor: 1,
    hasElevator: true,
    accessibleEntrance: true,
    stairFreeRoute: 'Enter via Block B ramp, straight through double doors.',
    description: 'Low-glare lighting, screen-reader equipped terminals, wide aisles between desk rows.',
    nearbyHazards: ['Trailing cables near auxiliary desk clusters', 'Movable swivel chairs'],
  },
  {
    id: 'canteen',
    name: 'Student Dining Hall & Canteen',
    block: 'Block C',
    floor: 1,
    hasElevator: false,
    accessibleEntrance: true,
    stairFreeRoute: 'Level path from central courtyard directly into cafeteria.',
    description: 'Open layout dining area with order counter on the left.',
    nearbyHazards: ['High ambient noise level', 'Moving carts and chairs in pathways'],
  },
  {
    id: 'accessible-restroom',
    name: 'Universal Accessible Restroom',
    block: 'Block A',
    floor: 1,
    hasElevator: true,
    accessibleEntrance: true,
    stairFreeRoute: 'Turn right at the junction opposite the Library entrance. Second door on the right.',
    description: 'Outward opening automated door with push-pad activation, grab bars on both sides.',
  },
];

/**
 * Searches local campus knowledge for destinations, landmarks, or questions.
 */
export function queryCampusKnowledge(query: string): CampusLocation | null {
  const normalized = query.toLowerCase();

  if (normalized.includes('elevator') || normalized.includes('lift')) {
    return CAMPUS_LOCATIONS.find((loc) => loc.id === 'elevator-block-a') || null;
  }
  if (normalized.includes('library') || normalized.includes('book') || normalized.includes('study')) {
    return CAMPUS_LOCATIONS.find((loc) => loc.id === 'library') || null;
  }
  if (normalized.includes('lab') || normalized.includes('computer') || normalized.includes('workstation')) {
    return CAMPUS_LOCATIONS.find((loc) => loc.id === 'computer-lab') || null;
  }
  if (normalized.includes('restroom') || normalized.includes('toilet') || normalized.includes('bathroom')) {
    return CAMPUS_LOCATIONS.find((loc) => loc.id === 'accessible-restroom') || null;
  }
  if (normalized.includes('canteen') || normalized.includes('cafeteria') || normalized.includes('food')) {
    return CAMPUS_LOCATIONS.find((loc) => loc.id === 'canteen') || null;
  }

  return CAMPUS_LOCATIONS.find((loc) =>
    normalized.includes(loc.name.toLowerCase()) || normalized.includes(loc.block.toLowerCase())
  ) || null;
}
