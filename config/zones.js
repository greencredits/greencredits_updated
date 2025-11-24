// Zone configuration for Gonda
export const ZONE_CONFIG = {
  'Zone 1 - North Gonda': {
    areas: ['Station Road', 'Civil Lines', 'Railway Colony', 'Nehru Nagar', 'Gandhi Nagar'],
    keywords: ['station', 'civil lines', 'railway', 'nehru', 'gandhi nagar', 'north']
  },
  'Zone 2 - South Gonda': {
    areas: ['Colonelganj', 'Mankapur', 'Katra', 'Shahar Kotwali'],
    keywords: ['colonelganj', 'mankapur', 'katra', 'kotwali', 'south']
  },
  'Zone 3 - East Gonda': {
    areas: ['Paraspur', 'Itiathok', 'Wazirganj Road', 'Tarabganj'],
    keywords: ['paraspur', 'itiathok', 'wazirganj', 'tarabganj', 'east']
  },
  'Zone 4 - West Gonda': {
    areas: ['Bahraich Road', 'Wazirganj', 'Jhilahi', 'Nawabganj Road'],
    keywords: ['bahraich', 'jhilahi', 'nawabganj', 'west']
  },
  'Zone 5 - Central Gonda': {
    areas: ['City Center', 'Sadar Bazaar', 'Collectorate', 'Old City'],
    keywords: ['city center', 'sadar', 'collectorate', 'old city', 'center', 'central']
  }
};

// Auto-detect zone from address
export function detectZone(address) {
  if (!address) return 'Zone 5 - Central Gonda';
  
  const addressLower = address.toLowerCase();
  
  for (const [zoneName, config] of Object.entries(ZONE_CONFIG)) {
    for (const keyword of config.keywords) {
      if (addressLower.includes(keyword)) {
        return zoneName;
      }
    }
  }
  
  return 'Zone 5 - Central Gonda'; // Default
}

// Auto-detect zone from GPS coordinates
export function detectZoneFromCoordinates(lat, lng) {
  if (!lat || !lng) return null;
  
  // Gonda approximate boundaries
  if (lat > 27.15) return 'Zone 1 - North Gonda';
  if (lat < 27.10) return 'Zone 2 - South Gonda';
  if (lng > 81.98) return 'Zone 3 - East Gonda';
  if (lng < 81.95) return 'Zone 4 - West Gonda';
  
  return 'Zone 5 - Central Gonda';
}
