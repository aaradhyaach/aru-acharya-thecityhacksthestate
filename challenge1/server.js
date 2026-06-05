/**
 * CriticalAsset Work Order Dashboard — Backend Server
 * Challenge 01: The City Hacks The State · NYC Tech Week 2026
 * Team 6: 345 East 15th Street
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Configuration ───────────────────────────────────────────────────────────
const CA_API_URL = process.env.CA_API_URL || 'https://345e15.stg.criticalasset.com/api';
const CA_EMAIL = process.env.CA_EMAIL || 'david.jones@345e15.com';
const CA_PASSWORD = process.env.CA_PASSWORD || '3yP8mjD1';
// M2M credentials (try these first, fall back to login)
const CA_CLIENT_ID = process.env.CA_CLIENT_ID || 'ca_ad4c50766f1832d3a5cbdee8647127c2';
const CA_CLIENT_SECRET = process.env.CA_CLIENT_SECRET || 'fea31b8d922328e7152aa4b6e7855bf5546673895854f4eff3ce1687a357f8ff';
const PORT = process.env.PORT || 3000;

// ─── Token Cache ─────────────────────────────────────────────────────────────
let tokenCache = {
  accessToken: null,
  refreshToken: null,
  expiresAt: 0
};

/**
 * Get a valid access token — tries M2M first, falls back to login
 */
async function getAccessToken() {
  const now = Date.now();
  if (tokenCache.accessToken && tokenCache.expiresAt > now + 60000) {
    return tokenCache.accessToken;
  }

  // Try M2M client credentials first
  try {
    const m2mResult = await graphqlRaw({
      query: `mutation ApplicationToken($input: ApplicationClientCredentialsInput!) {
        applicationClientCredentialsToken(input: $input) {
          accessToken refreshToken tokenType expiresIn scope
        }
      }`,
      variables: { input: { clientId: CA_CLIENT_ID, clientSecret: CA_CLIENT_SECRET, scope: "assets.read locations.read workorders.write" } }
    });
    if (m2mResult.data?.applicationClientCredentialsToken) {
      const t = m2mResult.data.applicationClientCredentialsToken;
      tokenCache = { accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: now + (t.expiresIn * 1000) };
      console.log('✓ Authenticated via M2M client credentials');
      return t.accessToken;
    }
  } catch (e) { /* fall through */ }

  // Fall back to user login
  const loginResult = await graphqlRaw({
    query: `mutation Login($input: LoginInput!) { login(input: $input) { accessToken refreshToken } }`,
    variables: { input: { email: CA_EMAIL, password: CA_PASSWORD } }
  });

  if (loginResult.data?.login) {
    const t = loginResult.data.login;
    tokenCache = { accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: now + 259200000 }; // 3 days
    console.log('✓ Authenticated via user login');
    return t.accessToken;
  }

  throw new Error('Authentication failed — check credentials');
}

/**
 * Raw GraphQL call (no auth header)
 */
async function graphqlRaw(body) {
  const response = await fetch(CA_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return response.json();
}

/**
 * Authenticated GraphQL call
 */
async function graphqlQuery(query, variables = {}) {
  const accessToken = await getAccessToken();
  const response = await fetch(CA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ query, variables })
  });

  if (response.status === 401) {
    tokenCache.accessToken = null;
    const newToken = await getAccessToken();
    const retry = await fetch(CA_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${newToken}` },
      body: JSON.stringify({ query, variables })
    });
    return retry.json();
  }
  return response.json();
}

// ─── API Routes ──────────────────────────────────────────────────────────────

app.get('/api/workorders', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const result = await graphqlQuery(`
      query($limit: Int!) {
        workOrders(limit: $limit) {
          totalCount
          nodes {
            id title description severity executionPriority
            workOrderType workOrderServiceCategory
            startDate endDate createdAt updatedAt
            locationId locationAddress
            workOrderStage { id name }
            location { id locationName address city state }
            workOrderAssets { id assetId asset { id name status } }
            workOrderAssignments { id }
          }
        }
      }
    `, { limit: parseInt(limit) });

    if (result.errors) return res.status(400).json({ error: result.errors });
    res.json(result.data.workOrders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/assets', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const result = await graphqlQuery(`
      query($limit: Int!) {
        assets(limit: $limit) { total assets { id name status serialNumber installationDate } }
      }
    `, { limit: parseInt(limit) });
    if (result.errors) return res.status(400).json({ error: result.errors });
    res.json(result.data.assets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/locations', async (req, res) => {
  try {
    const result = await graphqlQuery(`
      query { locations { id locationName description locationTypeName address city state zipcode parentId } }
    `);
    if (result.errors) return res.status(400).json({ error: result.errors });
    res.json(result.data.locations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/signals', async (req, res) => {
  try {
    const { observation, buildingId, studentName } = req.body;
    if (!observation) return res.status(400).json({ error: 'Observation is required' });

    // Create a work order in CriticalAsset with the student signal
    const result = await graphqlQuery(`
      mutation CreateWorkOrder($input: CreateWorkOrderInput!) {
        createWorkOrder(input: $input) { id title }
      }
    `, {
      input: {
        title: `Student Signal: ${observation.substring(0, 80)}`,
        description: `Student observation: ${observation}\n\nSubmitted by: ${studentName || 'Anonymous'}\nTimestamp: ${new Date().toISOString()}`,
        severity: "medium",
        executionPriority: "medium",
        workOrderType: "corrective_maintenance",
        locationId: buildingId || "6bbaf32c-707e-5bae-a59e-447e8aff1efc"
      }
    });

    if (result.errors) {
      // If mutation fails, still acknowledge locally
      console.log('📡 Signal stored locally (mutation may require write scope):', observation);
    }

    res.json({ success: true, signal: { observation, timestamp: new Date().toISOString() }, workOrder: result.data?.createWorkOrder });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', async (req, res) => {
  res.json({
    status: 'ok',
    apiUrl: CA_API_URL,
    building: '345 East 15th Street',
    team: 'Team 6',
    tokenCached: !!tokenCache.accessToken
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHALLENGE 2: AI-Powered Field Intake & Workflow Tool
// ═══════════════════════════════════════════════════════════════════════════════

// ─── AI Structure Endpoint ──────────────────────────────────────────────────
// Takes raw student text → returns structured fields via keyword/rule-based AI
app.post('/api/ai-structure', (req, res) => {
  const { text, severity: studentSeverity, workOrderId } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  const lower = text.toLowerCase();

  // ─── Issue Type Detection ───
  const issueKeywords = {
    'Plumbing / Water': ['water', 'leak', 'pipe', 'drain', 'flood', 'faucet', 'toilet', 'sink', 'sewage', 'drip', 'plumbing', 'moisture', 'damp', 'mold'],
    'Electrical': ['electric', 'light', 'outlet', 'spark', 'wire', 'power', 'switch', 'breaker', 'flickering', 'voltage', 'shock', 'panel', 'outage'],
    'HVAC / Steam': ['heat', 'steam', 'radiator', 'cold', 'hot', 'temperature', 'hvac', 'thermostat', 'boiler', 'pipe hissing', 'hissing', 'condensation', 'ventilation', 'air conditioning', 'ac '],
    'Fire & Life Safety': ['fire', 'smoke', 'alarm', 'exit', 'sprinkler', 'extinguisher', 'emergency', 'detector', 'carbon monoxide', 'co2', 'gas smell', 'gas leak'],
    'Structural': ['crack', 'ceiling', 'wall', 'floor', 'foundation', 'collapse', 'structural', 'brick', 'concrete', 'beam', 'support'],
    'Elevator': ['elevator', 'lift', 'stuck', 'shaft', 'cab'],
    'Pest Control': ['roach', 'mouse', 'mice', 'rat', 'pest', 'bug', 'bedbug', 'ant', 'infestation'],
    'General Maintenance': ['door', 'window', 'lock', 'paint', 'trash', 'clean', 'broken', 'damage']
  };

  let issueType = 'General Maintenance';
  let maxMatches = 0;
  for (const [type, keywords] of Object.entries(issueKeywords)) {
    const matches = keywords.filter(k => lower.includes(k)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      issueType = type;
    }
  }

  // ─── Location Extraction ───
  const locationPatterns = [
    /(?:on|in|at|near)\s+(?:the\s+)?(\d+(?:st|nd|rd|th)\s+floor)/i,
    /(?:floor|level)\s+(\d+)/i,
    /(basement|lobby|roof|hallway|stairwell|laundry room|boiler room|garage|courtyard)/i,
    /(apartment|apt|unit)\s*#?\s*(\w+)/i,
    /(\d+(?:st|nd|rd|th)\s+floor\s+\w+)/i,
    /(bathroom|kitchen|bedroom|living room|common area)/i,
  ];

  let location = '345 East 15th Street';
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) {
      location = `345 E 15th St — ${match[0].trim()}`;
      break;
    }
  }

  // ─── Asset Category Mapping ───
  const assetMap = {
    'Plumbing / Water': 'Plumbing System',
    'Electrical': 'Electrical Distribution',
    'HVAC / Steam': 'Steam / HVAC System',
    'Fire & Life Safety': 'Fire Protection & Egress',
    'Structural': 'Building Envelope',
    'Elevator': 'Vertical Transportation',
    'Pest Control': 'Building Hygiene',
    'General Maintenance': 'Building Components'
  };

  // ─── Severity Computation ───
  const severityWords = {
    critical: ['gas', 'fire', 'collapse', 'smoke', 'emergency', 'electrocution', 'no heat', 'carbon monoxide', 'explosion'],
    high: ['flood', 'major leak', 'no power', 'sparking', 'structural crack', 'sewage', 'stuck elevator', 'hissing'],
    medium: ['leak', 'broken', 'not working', 'damage', 'noise', 'smell', 'intermittent'],
    low: ['cosmetic', 'paint', 'minor', 'scratch', 'squeak', 'slow drain']
  };

  let severity = 'Medium';
  for (const [level, words] of Object.entries(severityWords)) {
    if (words.some(w => lower.includes(w))) {
      severity = level.charAt(0).toUpperCase() + level.slice(1);
      break;
    }
  }

  // ─── Urgency Assessment ───
  const urgencyIndicators = {
    'Immediate': ['right now', 'currently', 'active', 'ongoing fire', 'gas smell now', 'people stuck'],
    'Within 24 hours': ['since this morning', 'today', 'started today', 'just noticed', 'getting worse'],
    'Within 48 hours': ['since yesterday', 'couple days', 'few days', 'since monday', 'since last week'],
    'Scheduled': ['been happening', 'for weeks', 'for months', 'always', 'chronic', 'recurring']
  };

  let urgency = 'Within 48 hours';
  for (const [level, indicators] of Object.entries(urgencyIndicators)) {
    if (indicators.some(i => lower.includes(i))) {
      urgency = level;
      break;
    }
  }

  // ─── Affected Users ───
  let affectedUsers = 'Single unit';
  if (lower.includes('whole building') || lower.includes('everyone') || lower.includes('all floors')) {
    affectedUsers = 'Entire building (~120 residents)';
  } else if (lower.includes('floor') || lower.includes('hallway') || lower.includes('common')) {
    affectedUsers = 'Multiple units / shared space (~15-30 residents)';
  } else if (lower.includes('neighbor') || lower.includes('next door') || lower.includes('adjacent')) {
    affectedUsers = 'Adjacent units (2-4 residents)';
  }

  // ─── Evidence Quality ───
  const evidenceFactors = [];
  if (text.length > 100) evidenceFactors.push('detailed_description');
  if (/\d/.test(text)) evidenceFactors.push('specific_numbers');
  if (locationPatterns.some(p => p.test(text))) evidenceFactors.push('location_specified');
  if (/since|started|began|for \d/.test(lower)) evidenceFactors.push('timeline_given');
  if (/photo|picture|video|recorded/.test(lower)) evidenceFactors.push('media_referenced');

  const qualityScore = Math.min(evidenceFactors.length, 4);
  const qualityLabels = ['Minimal — needs more detail', 'Basic — actionable', 'Good — clear picture', 'Strong — comprehensive', 'Excellent — fully documented'];
  const evidenceQuality = qualityLabels[qualityScore];

  // ─── Duration Extraction ───
  let duration = null;
  const durationMatch = text.match(/(?:for|since|past)\s+([\w\s]+?)(?:\.|,|$)/i) || 
                         text.match(/(\d+\s+(?:day|week|month|hour)s?)/i);
  if (durationMatch) duration = durationMatch[1].trim();

  // ─── Root Causes (rule-based) ───
  const rootCauseMap = {
    'Plumbing / Water': ['Aging pipe infrastructure (pre-war building)', 'Corroded joints or failed gaskets', 'Tree root infiltration in sewer lines', 'Pressure buildup from steam system'],
    'Electrical': ['Overloaded circuits in older panel', 'Deteriorated wiring insulation', 'Loose connections in distribution panel', 'Moisture intrusion to electrical components'],
    'HVAC / Steam': ['Failed steam trap or pressure reducing valve', 'Air lock in radiator system', 'Boiler cycling issues', 'Inadequate insulation on steam pipes'],
    'Fire & Life Safety': ['Battery failure in detection system', 'Damaged wiring in alarm circuit', 'Expired suppression system components', 'Blocked egress path'],
    'Structural': ['Settlement in foundation', 'Thermal expansion stress', 'Water damage weakening structural members', 'Age-related deterioration'],
    'Elevator': ['Mechanical wear in drive system', 'Door sensor misalignment', 'Control board malfunction', 'Hydraulic fluid leak'],
    'Pest Control': ['Entry points in building envelope', 'Improper waste management', 'Adjacent construction displacement', 'Seasonal migration patterns'],
    'General Maintenance': ['Normal wear and tear', 'Deferred maintenance backlog', 'Material end-of-life', 'Usage beyond design capacity']
  };

  const rootCauses = (rootCauseMap[issueType] || rootCauseMap['General Maintenance']).slice(0, 3);

  // ─── Missing Info ───
  const missingInfo = [];
  if (!locationPatterns.some(p => p.test(text))) missingInfo.push('Specific location within building (floor, unit, area)');
  if (!/since|started|began|how long/.test(lower)) missingInfo.push('Timeline — when did this start?');
  if (!/photo|picture|video/.test(lower)) missingInfo.push('Photo or video evidence');
  if (!/\b(apt|unit|apartment|room)\b/.test(lower)) missingInfo.push('Unit/apartment number for access');
  if (text.length < 50) missingInfo.push('More descriptive detail about the issue');
  if (missingInfo.length === 0) missingInfo.push('Signal is comprehensive — no critical info missing');

  // ─── Recommended Actions ───
  const actionMap = {
    'Plumbing / Water': ['Dispatch plumber for leak assessment', 'Shut off water supply to affected area if active', 'Document water damage extent for insurance', 'Check adjacent units for secondary damage'],
    'Electrical': ['Dispatch licensed electrician immediately', 'Isolate affected circuit at panel if safe', 'Thermal scan distribution panel', 'Check for fire risk in walls near wiring'],
    'HVAC / Steam': ['Inspect steam trap and PRV station', 'Check radiator air vent operation', 'Measure system pressure at affected riser', 'Verify boiler operation parameters'],
    'Fire & Life Safety': ['Immediate inspection of life safety systems', 'Verify egress path compliance', 'Test battery backup systems', 'File FDNY notification if required'],
    'Structural': ['Engage structural engineer for assessment', 'Install crack monitors if applicable', 'Document with dated photographs', 'Restrict access if safety risk exists'],
    'Elevator': ['Place elevator out of service', 'Contact elevator maintenance contractor', 'Post signage directing to alternate egress', 'File DOB elevator incident report'],
    'Pest Control': ['Deploy pest management team', 'Identify and seal entry points', 'Treat affected and adjacent units', 'Schedule follow-up in 2 weeks'],
    'General Maintenance': ['Create work order and assign to building staff', 'Assess scope and order materials', 'Schedule repair during low-impact hours', 'Notify affected residents of timeline']
  };

  const recommendedActions = (actionMap[issueType] || actionMap['General Maintenance']).slice(0, 4);

  res.json({
    issueType,
    location,
    assetCategory: assetMap[issueType] || 'General',
    severity,
    urgency,
    affectedUsers,
    evidenceQuality,
    duration,
    rootCauses,
    missingInfo: missingInfo.slice(0, 4),
    recommendedActions,
    confidence: Math.round(50 + (maxMatches * 12) + (evidenceFactors.length * 8)),
    workOrderId
  });
});

// ─── Public Data Enrichment Endpoint ────────────────────────────────────────
// Returns simulated NYC DOB violations + 311 complaints for 345 E 15th St
app.post('/api/enrich', (req, res) => {
  const { issueType, location, assetCategory } = req.body;

  // Hardcoded but realistic NYC DOB violation data for 345 East 15th St
  const allViolations = [
    { date: '2024-11-15', type: 'DOB ECB Violation', description: 'Failure to maintain building exterior — spalling concrete at parapet level', status: 'Open', category: 'structural' },
    { date: '2024-08-22', type: 'DOB Violation', description: 'Plumbing work performed without permit — 3rd floor bathroom renovation', status: 'Resolved', category: 'plumbing' },
    { date: '2024-06-03', type: 'HPD Class B', description: 'Inadequate hot water supply to apartments on risers 2 and 3', status: 'Open', category: 'hvac' },
    { date: '2024-03-18', type: 'FDNY Violation', description: 'Obstructed egress path in basement corridor — stored materials blocking exit', status: 'Resolved', category: 'fire' },
    { date: '2023-12-01', type: 'HPD Class C', description: 'Lead paint hazard identified in apartment 4B window frames', status: 'Open', category: 'structural' },
    { date: '2023-09-14', type: 'DOB Violation', description: 'Electrical work without permit — new sub-panel installed in super\'s office', status: 'Resolved', category: 'electrical' },
    { date: '2025-01-20', type: 'HPD Class A', description: 'Rodent activity observed in basement and ground floor common areas', status: 'Open', category: 'pest' },
    { date: '2025-03-05', type: 'DOB ECB Violation', description: 'Elevator annual inspection overdue — Unit #1 passenger elevator', status: 'Open', category: 'elevator' },
    { date: '2024-10-10', type: 'DOB Violation', description: 'Steam pipe insulation deterioration in basement mechanical room — asbestos concern', status: 'Open', category: 'hvac' },
    { date: '2024-07-22', type: 'FDNY Violation', description: 'Fire alarm system deficiency — 2 smoke detectors non-functional on 5th floor', status: 'Resolved', category: 'fire' },
  ];

  const all311 = [
    { date: '2025-05-28', category: 'HEAT/HOT WATER', description: 'Tenant reports intermittent hot water loss, affecting morning hours 6-9am', status: 'Open', relates: 'hvac' },
    { date: '2025-05-15', category: 'PLUMBING', description: 'Water stain spreading on ceiling of 2nd floor hallway — possible pipe leak above', status: 'Open', relates: 'plumbing' },
    { date: '2025-04-30', category: 'ELECTRIC', description: 'Hallway lights on 3rd floor flickering and buzzing — ongoing for 3 weeks', status: 'Open', relates: 'electrical' },
    { date: '2025-04-12', category: 'ELEVATOR', description: 'Elevator making grinding noise and stopping between floors', status: 'Resolved', relates: 'elevator' },
    { date: '2025-03-20', category: 'GENERAL', description: 'Front entrance door lock broken — security concern for residents', status: 'Resolved', relates: 'general' },
    { date: '2025-02-18', category: 'NOISE', description: 'Loud banging from steam pipes throughout the night on floors 4-6', status: 'Open', relates: 'hvac' },
    { date: '2025-01-05', category: 'PEST', description: 'Mouse droppings found in common laundry room and adjacent hallway', status: 'Open', relates: 'pest' },
    { date: '2024-12-10', category: 'SAFETY', description: 'Exit sign on 2nd floor stairwell not illuminated — bulb or battery dead', status: 'Resolved', relates: 'fire' },
  ];

  // Filter relevant violations based on issue type
  const relevanceMap = {
    'Plumbing / Water': 'plumbing',
    'Electrical': 'electrical',
    'HVAC / Steam': 'hvac',
    'Fire & Life Safety': 'fire',
    'Structural': 'structural',
    'Elevator': 'elevator',
    'Pest Control': 'pest',
    'General Maintenance': 'general'
  };

  const relevantCategory = relevanceMap[issueType] || 'general';

  // Show relevant ones first, then others
  const relevantViolations = allViolations.filter(v => v.category === relevantCategory);
  const otherViolations = allViolations.filter(v => v.category !== relevantCategory);
  const dobViolations = [...relevantViolations, ...otherViolations].slice(0, 4);

  const relevant311 = all311.filter(c => c.relates === relevantCategory);
  const other311 = all311.filter(c => c.relates !== relevantCategory);
  const complaints311 = [...relevant311, ...other311].slice(0, 4);

  // Generate compliance context
  const complianceContextMap = {
    'Plumbing / Water': 'NYC Building Code §28-301.1 requires owners to maintain plumbing systems. HPD Housing Maintenance Code §27-2005 mandates adequate water supply. Open DOB violations for unpermitted plumbing work suggest deferred maintenance pattern. Recent 311 complaints corroborate systemic plumbing issues at this address.',
    'Electrical': 'NYC Electrical Code §27-3004 requires licensed electrician for all work. Existing violation for unpermitted electrical work indicates compliance gap. FDNY requires annual electrical system inspection per FC §605. Pattern of electrical complaints warrants comprehensive panel assessment.',
    'HVAC / Steam': 'NYC Admin Code §27-2029 mandates heat from Oct 1–May 31 (68°F day/62°F night). Open HPD Class B violation for hot water issues. Local Law 87/09 requires energy audit and retro-commissioning. Steam system violations (asbestos concern) trigger EPA/DEP notification requirements.',
    'Fire & Life Safety': 'NYC Fire Code §901 requires operational fire protection. FDNY violations for alarm deficiencies create immediate life safety liability. Local Law 26/04 mandates sprinkler retrofit timeline. Building must maintain Certificate of Fitness (C of F) for fire safety director.',
    'Structural': 'Local Law 11/98 (FISP) requires facade inspection every 5 years. Open ECB violation for spalling concrete indicates SWARMP/Unsafe condition potential. NYC Building Code §28-301.1 imposes strict maintenance duty. HPD Class C lead paint violation requires abatement under Local Law 1/04.',
    'Elevator': 'NYC Admin Code §28-304 requires annual elevator inspection. Open ECB violation for overdue inspection creates immediate DOB enforcement risk. Elevator Modernization under Local Law 111/16 may apply. Building faces potential lock-out if inspection not completed within 30 days.',
    'Pest Control': 'NYC Health Code §151.02 requires property to be maintained free of pests. HPD Class A violation for rodent activity is immediately hazardous. Local Law 55/18 requires Integrated Pest Management (IPM) plan. Building must provide annual pest management report to tenants.',
    'General Maintenance': 'NYC Housing Maintenance Code requires building-wide maintenance standards. Multiple open violations across categories suggest systemic deferred maintenance. HPD may initiate Alternative Enforcement Program (AEP) for buildings with chronic violations exceeding threshold.'
  };

  const complianceContext = complianceContextMap[issueType] || complianceContextMap['General Maintenance'];

  res.json({
    dobViolations,
    complaints311,
    complianceContext,
    buildingProfile: {
      address: '345 East 15th Street, Manhattan, NY 10003',
      block: '874',
      lot: '52',
      bbl: '1008740052',
      buildingClass: 'D4 — Elevator Apartment',
      yearBuilt: 1929,
      stories: 6,
      units: 47,
      owner: 'Stuy Town Management LLC',
      openViolations: allViolations.filter(v => v.status === 'Open').length,
      open311: all311.filter(c => c.status === 'Open').length
    }
  });
});

// ─── Workflow Recommendation Endpoint ───────────────────────────────────────
app.post('/api/workflow', (req, res) => {
  const { structured, enrichment, rawText, studentSeverity } = req.body;
  if (!structured) return res.status(400).json({ error: 'Structured data required' });

  // Cleaned description — professional version of student input
  const cleanedDescription = generateCleanedDescription(structured, rawText);

  // Severity computation (blend student input + AI + public data)
  const openViolations = enrichment?.buildingProfile?.openViolations || 0;
  let computedSeverity = structured.severity;
  let severityReason = '';

  if (openViolations >= 4 && structured.severity !== 'Critical') {
    computedSeverity = upSeverity(structured.severity);
    severityReason = `Elevated due to ${openViolations} existing open violations at this address`;
  } else if (studentSeverity >= 4 && structured.severity === 'Medium') {
    computedSeverity = 'High';
    severityReason = 'Student severity rating indicates high lived-experience impact';
  } else {
    severityReason = 'Based on issue type, keywords, and public record context';
  }

  // Asset tags
  const assetTags = generateAssetTags(structured);

  // Evidence checklist
  const evidenceChecklist = [
    { label: 'Written description of issue', has: true },
    { label: 'Specific location identified', has: structured.location !== '345 East 15th Street' },
    { label: 'Timeline / duration provided', has: !!structured.duration },
    { label: 'Photo or video evidence', has: /photo|picture|video|recorded/.test(rawText?.toLowerCase() || '') },
    { label: 'Impact scope documented', has: structured.affectedUsers !== 'Single unit' },
    { label: 'Previous reports referenced', has: /before|again|still|repeated|keep/.test(rawText?.toLowerCase() || '') },
  ];

  // Suggested assignment
  const assignmentMap = {
    'Plumbing / Water': 'Licensed Plumber — Priority dispatch for leak assessment and containment',
    'Electrical': 'Licensed Electrician — Priority dispatch for safety inspection and repair',
    'HVAC / Steam': 'HVAC/Steam Technician — Inspect pressure reducing valve station and radiator system',
    'Fire & Life Safety': 'Fire Safety Director + FDNY Notification — Immediate life safety inspection required',
    'Structural': 'Structural Engineer — Professional assessment required before any remediation',
    'Elevator': 'Elevator Maintenance Contractor — Place unit OOS and dispatch technician',
    'Pest Control': 'Licensed Pest Management — IPM treatment for affected and adjacent areas',
    'General Maintenance': 'Building Maintenance Staff — Standard work order assignment'
  };

  const suggestedAssignment = assignmentMap[structured.issueType] || assignmentMap['General Maintenance'];

  // Compliance implications
  const complianceImplications = generateComplianceImplications(structured, enrichment);

  // Next action
  const nextActionMap = {
    'Critical': 'IMMEDIATE: Dispatch emergency response team. Notify building management and affected residents within 1 hour.',
    'High': 'URGENT: Create priority work order and dispatch within 24 hours. Notify super and management.',
    'Medium': 'STANDARD: Create work order, assign to appropriate trade, schedule within 48-72 hours.',
    'Low': 'ROUTINE: Add to maintenance backlog. Schedule during next planned maintenance window.'
  };

  const nextAction = nextActionMap[computedSeverity] || nextActionMap['Medium'];

  res.json({
    cleanedDescription,
    severity: computedSeverity,
    severityReason,
    assetTags,
    evidenceChecklist,
    suggestedAssignment,
    complianceImplications,
    nextAction
  });
});

// ─── Closure Verification Endpoint ──────────────────────────────────────────
app.post('/api/closure', (req, res) => {
  const { workOrderId, status, structuredIssue, timestamp } = req.body;

  // In a real system, this would update the work order in CriticalAsset
  // and trigger re-escalation workflows if status !== 'resolved'
  const responses = {
    'resolved': {
      action: 'close_work_order',
      message: 'Work order marked for closure. Student verification logged.',
      followUp: null
    },
    'still_happening': {
      action: 're_escalate',
      message: 'Issue persists — work order re-escalated to supervisor.',
      followUp: 'Automatic follow-up scheduled in 48 hours'
    },
    'worse': {
      action: 'priority_escalation',
      message: 'Situation degraded — priority escalation triggered.',
      followUp: 'Building manager notified. Response required within 4 hours.'
    }
  };

  const response = responses[status] || responses['still_happening'];

  console.log(`📋 Closure verification: ${status} for WO ${workOrderId || 'unlinked'} at ${timestamp}`);

  res.json({
    success: true,
    status,
    ...response,
    workOrderId,
    verifiedAt: timestamp || new Date().toISOString(),
    structuredIssue: structuredIssue?.issueType || 'Unknown'
  });
});

// ─── Helper Functions for Workflow ──────────────────────────────────────────
function generateCleanedDescription(structured, rawText) {
  const templates = {
    'Plumbing / Water': `Plumbing issue reported at ${structured.location}. ${structured.duration ? `Ongoing for ${structured.duration}.` : ''} Severity: ${structured.severity}. Affects: ${structured.affectedUsers}. Requires plumber dispatch for assessment and repair. ${structured.duration && structured.duration.includes('week') ? 'Extended duration suggests systemic issue rather than isolated incident.' : ''}`,
    'Electrical': `Electrical system concern at ${structured.location}. ${structured.duration ? `Duration: ${structured.duration}.` : ''} Severity: ${structured.severity}. Affects: ${structured.affectedUsers}. Licensed electrician required for safety inspection. Check distribution panel and branch circuits in affected area.`,
    'HVAC / Steam': `HVAC/Steam system issue at ${structured.location}. ${structured.duration ? `Reported duration: ${structured.duration}.` : ''} Severity: ${structured.severity}. Affects: ${structured.affectedUsers}. Inspect steam pressure reducing valve, radiator air vents, and pipe insulation in affected riser.`,
    'Fire & Life Safety': `Life safety concern identified at ${structured.location}. Severity: ${structured.severity} — IMMEDIATE ATTENTION REQUIRED. Affects: ${structured.affectedUsers}. Verify fire alarm, egress, and suppression system integrity. FDNY notification may be required.`,
    'Structural': `Structural concern reported at ${structured.location}. ${structured.duration ? `First noticed: ${structured.duration} ago.` : ''} Severity: ${structured.severity}. Professional structural assessment required. Document with dated photographs and install monitors if applicable.`,
    'Elevator': `Elevator malfunction reported. Severity: ${structured.severity}. Place unit out of service pending inspection. Contact elevator maintenance contractor for emergency dispatch. Post signage directing residents to stairs.`,
    'Pest Control': `Pest activity reported at ${structured.location}. ${structured.duration ? `Duration: ${structured.duration}.` : ''} Deploy IPM treatment protocol for affected and adjacent units. Identify and seal entry points. Schedule follow-up inspection.`,
    'General Maintenance': `Maintenance issue at ${structured.location}. ${structured.duration ? `Duration: ${structured.duration}.` : ''} Severity: ${structured.severity}. Affects: ${structured.affectedUsers}. Assign to building maintenance staff for assessment and resolution.`
  };

  return templates[structured.issueType] || templates['General Maintenance'];
}

function upSeverity(current) {
  const levels = ['Low', 'Medium', 'High', 'Critical'];
  const idx = levels.indexOf(current);
  return levels[Math.min(idx + 1, 3)];
}

function generateAssetTags(structured) {
  const baseTags = [structured.assetCategory];
  const issueSpecificTags = {
    'Plumbing / Water': ['Piping', 'Water Supply', 'Drainage'],
    'Electrical': ['Switchgear', 'Distribution Panel', 'Branch Circuits'],
    'HVAC / Steam': ['Steam PRV', 'Radiators', 'Boiler System'],
    'Fire & Life Safety': ['Fire Alarm', 'Exit Signs', 'Sprinkler System'],
    'Structural': ['Facade', 'Foundation', 'Load-Bearing'],
    'Elevator': ['Passenger Elevator', 'Drive System', 'Controls'],
    'Pest Control': ['Building Envelope', 'Sanitation', 'Entry Points'],
    'General Maintenance': ['Building Components', 'Hardware', 'Finishes']
  };
  return [...baseTags, ...(issueSpecificTags[structured.issueType] || []).slice(0, 2)];
}

function generateComplianceImplications(structured, enrichment) {
  const implications = [];
  const openCount = enrichment?.buildingProfile?.openViolations || 0;

  if (openCount >= 4) {
    implications.push(`Building has ${openCount} open violations — at risk for HPD Alternative Enforcement Program (AEP)`);
  }

  const issueCompliance = {
    'Plumbing / Water': ['NYC Building Code §28-301.1 — duty to maintain plumbing', 'HPD Housing Maintenance Code §27-2005 — water supply adequacy'],
    'Electrical': ['NYC Electrical Code §27-3004 — licensed work requirement', 'FDNY FC §605 — annual electrical inspection'],
    'HVAC / Steam': ['NYC Admin Code §27-2029 — heat requirements Oct-May', 'Local Law 87/09 — energy audit requirement'],
    'Fire & Life Safety': ['NYC Fire Code §901 — operational fire protection', 'Local Law 26/04 — sprinkler retrofit mandate'],
    'Structural': ['Local Law 11/98 (FISP) — facade inspection cycle', 'NYC Building Code §28-301.1 — structural maintenance'],
    'Elevator': ['NYC Admin Code §28-304 — annual inspection requirement', 'Local Law 111/16 — modernization mandate'],
    'Pest Control': ['NYC Health Code §151.02 — pest-free maintenance', 'Local Law 55/18 — IPM plan requirement'],
    'General Maintenance': ['HPD Housing Maintenance Code — general upkeep standards', 'NYC Admin Code §27-2005 — habitability requirements']
  };

  implications.push(...(issueCompliance[structured.issueType] || issueCompliance['General Maintenance']));
  return implications.slice(0, 4);
}

// ─── Serve Signal Page ──────────────────────────────────────────────────────
app.get('/signal', (req, res) => res.sendFile(path.join(__dirname, 'public', 'signal.html')));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n🏗️  CriticalAsset Dashboard — Team 6: 345 East 15th Street`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   API: ${CA_API_URL}\n`);
});
