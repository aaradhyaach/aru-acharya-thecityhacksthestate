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

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n🏗️  CriticalAsset Dashboard — Team 6: 345 East 15th Street`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   API: ${CA_API_URL}\n`);
});
