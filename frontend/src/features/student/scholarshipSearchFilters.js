import { REGIONS } from '../../data/locationData.js';

const REGION_OPTIONS = [
  { value: 'Ilocos Region', label: 'Region I — Ilocos Region', aliases: ['region i', 'region 1'] },
  { value: 'Cagayan Valley', label: 'Region II — Cagayan Valley', aliases: ['region ii', 'region 2'] },
  { value: 'Central Luzon', label: 'Region III — Central Luzon', aliases: ['region iii', 'region 3'] },
  {
    value: 'CALABARZON',
    label: 'Region IV-A — CALABARZON',
    aliases: ['region iv-a', 'region 4-a', 'region iva', 'region iv-a (calabarzon)']
  },
  {
    value: 'MIMAROPA',
    label: 'MIMAROPA — Southwestern Tagalog Region',
    aliases: ['mimaropa region', 'southwestern tagalog region', 'region iv-b', 'region 4-b']
  },
  {
    value: 'Bicol Region',
    label: 'Region V — Bicol Region',
    aliases: ['region v', 'region 5', 'region v (bicol region)']
  },
  { value: 'Western Visayas', label: 'Region VI — Western Visayas', aliases: ['region vi', 'region 6'] },
  { value: 'Central Visayas', label: 'Region VII — Central Visayas', aliases: ['region vii', 'region 7'] },
  { value: 'Eastern Visayas', label: 'Region VIII — Eastern Visayas', aliases: ['region viii', 'region 8'] },
  { value: 'Zamboanga Peninsula', label: 'Region IX — Zamboanga Peninsula', aliases: ['region ix', 'region 9'] },
  { value: 'Northern Mindanao', label: 'Region X — Northern Mindanao', aliases: ['region x', 'region 10'] },
  { value: 'Davao Region', label: 'Region XI — Davao Region', aliases: ['region xi', 'region 11'] },
  { value: 'SOCCSKSARGEN', label: 'Region XII — SOCCSKSARGEN', aliases: ['region xii', 'region 12'] },
  { value: 'Caraga', label: 'Region XIII — Caraga', aliases: ['region xiii', 'region 13'] },
  { value: 'National Capital Region', label: 'NCR — National Capital Region', aliases: ['ncr'] },
  { value: 'Cordillera Administrative Region', label: 'CAR — Cordillera Administrative Region', aliases: ['car'] },
  {
    value: 'Bangsamoro Autonomous Region in Muslim Mindanao',
    label: 'BARMM — Bangsamoro Autonomous Region in Muslim Mindanao',
    aliases: ['barmm']
  }
];

export const SCHOLARSHIP_SEARCH_REGIONS = REGION_OPTIONS.map((region) => ({
  value: region.value,
  label: region.label,
  aliases: [region.value.toLowerCase(), ...region.aliases]
}));

if (
  SCHOLARSHIP_SEARCH_REGIONS.length !== REGIONS.length ||
  SCHOLARSHIP_SEARCH_REGIONS.some((region) => !REGIONS.includes(region.value))
) {
  throw new Error('Scholarship search regions must use the shared region list.');
}

const DEGREE_FILTER_LEVELS = {
  Undergraduate: ['undergraduate', 'college'],
  'Senior High School': ['senior high school'],
  Postgraduate: ['postgraduate', 'graduate studies']
};

const FLAG_TAG_NAMES = {
  isIP: ['indigenous peoples (ip)', 'ip', 'indigenous peoples'],
  isPWD: ['person with disability (pwd)', 'pwd', 'pwd status'],
  isSoloParentDependent: ['solo parent dependent', 'solo parent child'],
  isOrphan: ['orphan status', 'orphan'],
  isFarmerFisherfolkChild: [
    'child of farmer / fisherfolk',
    'farmer / fisherfolk child',
    'farmer/fisherfolk child'
  ],
  isDisasterAffected: ['disaster-affected family', 'disaster affected'],
  isWorkingStudent: ['working student'],
  is4PsBeneficiary: ['4ps beneficiary', '4ps']
};

export const parseGrantAmount = (value) => {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  const match = String(value || '').replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
};

const normalizeRegionText = (value) => String(value || '').trim().toLowerCase();

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const placeMatchesTarget = (place, target) => {
  if (place === target) return true;
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(target)}(?:$|[^a-z0-9])`).test(place);
};

const targetsForRegion = (selectedRegion) => {
  const selected = normalizeRegionText(selectedRegion);
  const region = SCHOLARSHIP_SEARCH_REGIONS.find((item) =>
    item.value.toLowerCase() === selected ||
    item.label.toLowerCase() === selected ||
    item.aliases.includes(selected)
  );

  return region ? region.aliases : [selected];
};

export const locationMatchesRegion = (geographicLocation, selectedRegion) => {
  if (!selectedRegion || selectedRegion === 'All') return true;
  if (!geographicLocation) return false;

  if (typeof geographicLocation === 'string') {
    const normalized = geographicLocation.trim().toLowerCase();
    if (normalized === 'nationwide' || normalized === 'national') return true;
    return targetsForRegion(selectedRegion).some((target) => placeMatchesTarget(normalized, target));
  }

  if (geographicLocation.scope === 'Nationwide') return true;

  const places = [
    ...(geographicLocation.regions || []),
    ...(geographicLocation.provinces || []),
    ...(geographicLocation.municipalities || [])
  ].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);

  const targets = targetsForRegion(selectedRegion);
  return places.some((place) => targets.some((target) => placeMatchesTarget(place, target)));
};

export const levelMatchesDegree = (academicLevel, selectedDegree) => {
  if (!selectedDegree || selectedDegree === 'All') return true;
  const normalized = String(academicLevel || '').trim().toLowerCase();
  const accepted = DEGREE_FILTER_LEVELS[selectedDegree] || [selectedDegree.toLowerCase()];
  return accepted.includes(normalized);
};

export const scholarshipMatchesFlags = (specialTags, selectedFlags) => {
  if (!Array.isArray(selectedFlags) || selectedFlags.length === 0) return true;

  const tagNames = (specialTags || [])
    .map((tag) => String(tag?.tagName || '').trim().toLowerCase())
    .filter(Boolean);

  return selectedFlags.some((flag) => {
    const names = FLAG_TAG_NAMES[flag] || [String(flag).toLowerCase()];
    return tagNames.some((tagName) => names.includes(tagName));
  });
};

const minimumScore = (value) => {
  const score = Number(value);
  return Number.isFinite(score) ? score : 0;
};

export const applyScholarshipSearch = (scholarships, criteria = {}) => {
  const items = Array.isArray(scholarships) ? scholarships : [];
  const selectedRegion = criteria.selectedRegion || 'All';
  const selectedDegree = criteria.selectedDegree || 'All';
  const selectedFlags = Array.isArray(criteria.selectedFlags) ? criteria.selectedFlags : [];
  const minMatchScore = minimumScore(criteria.minMatchScore);
  const sortBy = criteria.sortBy || 'match';

  return items
    .filter((item) => {
      const matchesRegion = locationMatchesRegion(item?.geographicLocation, selectedRegion);
      const matchesDegree = levelMatchesDegree(item?.degreeLevel, selectedDegree);
      const score = Number(item?.totalScore ?? item?.matchScore ?? 0);
      const matchesScore = (Number.isFinite(score) ? score : 0) >= minMatchScore;
      const matchesFlags = scholarshipMatchesFlags(item?.specialTags, selectedFlags);
      return matchesRegion && matchesDegree && matchesScore && matchesFlags;
    })
    .sort((a, b) => {
      const scoreA = Number(a.totalScore ?? a.matchScore ?? 0);
      const scoreB = Number(b.totalScore ?? b.matchScore ?? 0);

      if (sortBy === 'match') return scoreB - scoreA;
      if (sortBy === 'amount') return parseGrantAmount(b.amount) - parseGrantAmount(a.amount);
      if (sortBy === 'deadline') {
        const timeA = new Date(a.deadline).getTime();
        const timeB = new Date(b.deadline).getTime();
        return (Number.isNaN(timeA) ? Infinity : timeA) - (Number.isNaN(timeB) ? Infinity : timeB);
      }
      return 0;
    });
};
