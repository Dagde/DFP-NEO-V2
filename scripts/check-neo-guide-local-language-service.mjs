const DEFAULT_SERVICE_URL = 'http://127.0.0.1:8765';

function serviceBaseUrl() {
  const raw = String(process.env.NEO_GUIDE_LOCAL_LANGUAGE_SERVICE_URL || DEFAULT_SERVICE_URL).trim();
  return raw.replace(/\/+$/, '');
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function sampleRequest() {
  return {
    question: 'how do I auth a flight from the dfp tile?',
    pageContext: {
      page: 'DFP',
      activeTab: 'Timeline',
      selectedRecordLabel: 'BGF12',
      selectedRecordId: '',
      userPermissions: ['dfp.view', 'duty-pilot.view'],
    },
    conversation: null,
    deterministicAnswer: {
      intent: 'HOW_TO',
      confidence: 'low',
      answer: 'Opens the main DFP timeline.',
      topFunctionId: 'function.curated.dfp.open',
      topFunctionName: 'Open the DFP schedule',
      needsClarification: true,
    },
  };
}

async function main() {
  const baseUrl = serviceBaseUrl();
  console.log(`Checking NEO Guide local language service at ${baseUrl}`);

  let healthResponse;
  try {
    healthResponse = await fetch(`${baseUrl}/health`);
  } catch {
    console.error('FAIL: service is not reachable.');
    console.error('Start it with: npm run neo-guide:local-language-service');
    process.exit(1);
  }

  const health = await readJson(healthResponse);
  if (!healthResponse.ok || !health?.ok) {
    console.error('FAIL: service health check did not pass.');
    console.error(JSON.stringify(health, null, 2));
    process.exit(1);
  }
  console.log(`PASS: service is running. Model configured as ${health.modelName} via ${health.modelUrlHost}.`);

  const interpretResponse = await fetch(`${baseUrl}/interpret`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sampleRequest()),
  });
  const interpretation = await readJson(interpretResponse);

  if (!interpretResponse.ok) {
    console.error('FAIL: service is running, but the local model did not return a valid interpretation.');
    console.error(JSON.stringify(interpretation, null, 2));
    console.error('Check that the local Granite-compatible runtime is running and reachable at NEO_GUIDE_LLAMACPP_URL.');
    process.exit(1);
  }

  if (!interpretation || typeof interpretation.confidence !== 'number') {
    console.error('FAIL: local model response was not valid NEO Guide interpretation JSON.');
    console.error(JSON.stringify(interpretation, null, 2));
    process.exit(1);
  }

  console.log('PASS: local model returned valid interpretation JSON.');
  console.log(JSON.stringify(interpretation, null, 2));
}

main().catch((error) => {
  console.error(`FAIL: ${error?.message || error}`);
  process.exit(1);
});
