import { NextRequest, NextResponse } from "next/server";

// ─── Test Key Rotation System ────────────────────────────────────────────────
// Bu endpoint API key rotation sistemini test edir və bütün provider-ləri yoxlayır

// Key rotation helper functions (əsas route.ts-dən kopyalanıb)
function getAllKeysForProvider(provider: string): string[] {
  const keys: string[] = [];
  
  switch (provider) {
    case "groq":
      if (process.env.GROQ_API_KEY?.startsWith("gsk_")) keys.push(process.env.GROQ_API_KEY);
      if (process.env.GROQ_API_KEY_2?.startsWith("gsk_")) keys.push(process.env.GROQ_API_KEY_2);
      if (process.env.GROQ_API_KEY_3?.startsWith("gsk_")) keys.push(process.env.GROQ_API_KEY_3);
      break;
    case "gemini":
      if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
      if (process.env.GEMINI_API_KEY_2) keys.push(process.env.GEMINI_API_KEY_2);
      if (process.env.GEMINI_API_KEY_3) keys.push(process.env.GEMINI_API_KEY_3);
      break;
    case "openrouter":
      if (process.env.OPENROUTER_API_KEY) keys.push(process.env.OPENROUTER_API_KEY);
      if (process.env.OPENROUTER_API_KEY_2) keys.push(process.env.OPENROUTER_API_KEY_2);
      break;
    case "mistral":
      if (process.env.MISTRAL_API_KEY) keys.push(process.env.MISTRAL_API_KEY);
      if (process.env.MISTRAL_API_KEY_2) keys.push(process.env.MISTRAL_API_KEY_2);
      break;
    case "cerebras":
      if (process.env.CEREBRAS_API_KEY) keys.push(process.env.CEREBRAS_API_KEY);
      if (process.env.CEREBRAS_API_KEY_2) keys.push(process.env.CEREBRAS_API_KEY_2);
      break;
    case "huggingface":
      if (process.env.HUGGINGFACE_API_KEY) keys.push(process.env.HUGGINGFACE_API_KEY);
      if (process.env.HUGGINGFACE_API_KEY_2) keys.push(process.env.HUGGINGFACE_API_KEY_2);
      break;
  }
  
  return keys;
}

// Request-scope key rotation tracker
const keyRotationIndex = new Map<string, number>();

function getNextKeyForProvider(provider: string): { key: string; keyNumber: number; totalKeys: number } | null {
  const keys = getAllKeysForProvider(provider);
  if (keys.length === 0) return null;
  
  const currentIndex = keyRotationIndex.get(provider) || 0;
  const key = keys[currentIndex % keys.length];
  const keyNumber = (currentIndex % keys.length) + 1;
  keyRotationIndex.set(provider, currentIndex + 1);
  
  return {
    key: key.slice(0, 10) + "..." + key.slice(-4), // Mask key (güvənlik üçün)
    keyNumber,
    totalKeys: keys.length
  };
}

// Test a single provider API
async function testProviderAPI(provider: string, key: string): Promise<{ success: boolean; responseTime: number; error?: string }> {
  const startTime = Date.now();
  
  try {
    switch (provider) {
      case "groq":
        const groqRes = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { "Authorization": `Bearer ${key}` },
          signal: AbortSignal.timeout(5000)
        });
        return { success: groqRes.ok, responseTime: Date.now() - startTime };
        
      case "gemini":
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
          signal: AbortSignal.timeout(5000)
        });
        return { success: geminiRes.ok, responseTime: Date.now() - startTime };
        
      case "openrouter":
        const orRes = await fetch("https://openrouter.ai/api/v1/models", {
          headers: { "Authorization": `Bearer ${key}` },
          signal: AbortSignal.timeout(5000)
        });
        return { success: orRes.ok, responseTime: Date.now() - startTime };
        
      default:
        return { success: false, responseTime: 0, error: "Provider test not implemented" };
    }
  } catch (error: any) {
    return { 
      success: false, 
      responseTime: Date.now() - startTime, 
      error: error.message || "Unknown error" 
    };
  }
}

export async function GET(req: NextRequest) {
  const providers = ["groq", "gemini", "openrouter", "mistral", "cerebras", "huggingface"];
  
  const report: any = {
    timestamp: new Date().toISOString(),
    summary: {
      totalProviders: 0,
      activeProviders: 0,
      totalKeys: 0,
      avgKeysPerProvider: 0
    },
    providers: {} as any,
    rotationTest: [] as any[],
    recommendations: [] as string[]
  };
  
  // Test 1: Check all providers and their keys
  for (const provider of providers) {
    const keys = getAllKeysForProvider(provider);
    const isActive = keys.length > 0;
    
    if (isActive) {
      report.summary.activeProviders++;
      report.summary.totalKeys += keys.length;
    }
    
    report.providers[provider] = {
      active: isActive,
      keyCount: keys.length,
      keys: keys.map((k, i) => ({
        name: `${provider.toUpperCase()}_API_KEY${i > 0 ? '_' + (i + 1) : ''}`,
        masked: k.slice(0, 10) + "..." + k.slice(-4),
        length: k.length
      })),
      status: isActive ? "✅ Active" : "❌ Not configured"
    };
  }
  
  report.summary.totalProviders = providers.length;
  report.summary.avgKeysPerProvider = report.summary.totalKeys / report.summary.activeProviders || 0;
  
  // Test 2: Simulate 10 requests with rotation
  console.log("\n🧪 Starting Key Rotation Test (10 simulated requests)...\n");
  
  for (let i = 1; i <= 10; i++) {
    const requestTest: any = {
      requestNumber: i,
      providers: {} as any
    };
    
    for (const provider of ["groq", "gemini", "openrouter"]) {
      const keyInfo = getNextKeyForProvider(provider);
      if (keyInfo) {
        requestTest.providers[provider] = {
          keyUsed: `Key ${keyInfo.keyNumber}/${keyInfo.totalKeys}`,
          masked: keyInfo.key,
          rotation: keyInfo.keyNumber === 1 && i > 1 ? "🔄 Rotated back to key 1" : ""
        };
        console.log(`  Request ${i}: ${provider} → Key ${keyInfo.keyNumber}/${keyInfo.totalKeys}`);
      }
    }
    
    report.rotationTest.push(requestTest);
  }
  
  // Test 3: API Connectivity Test (only for main providers)
  console.log("\n🌐 Testing API Connectivity...\n");
  
  const connectivityTests: any[] = [];
  
  for (const provider of ["groq", "gemini", "openrouter"]) {
    const keys = getAllKeysForProvider(provider);
    if (keys.length > 0) {
      console.log(`  Testing ${provider} (${keys.length} key${keys.length > 1 ? 's' : ''})...`);
      const testResult = await testProviderAPI(provider, keys[0]);
      connectivityTests.push({
        provider,
        ...testResult,
        status: testResult.success ? "✅ Connected" : "❌ Failed"
      });
      console.log(`    ${testResult.success ? '✅' : '❌'} ${provider}: ${testResult.responseTime}ms`);
    }
  }
  
  report.connectivityTests = connectivityTests;
  
  // Recommendations
  if (report.summary.activeProviders < 3) {
    report.recommendations.push("⚠️ Configure at least 3 providers for better redundancy");
  }
  
  if (report.providers.groq?.keyCount < 2) {
    report.recommendations.push("🔑 Add GROQ_API_KEY_2 and GROQ_API_KEY_3 for 3x throughput");
  }
  
  if (report.providers.gemini?.keyCount < 2) {
    report.recommendations.push("🔑 Add GEMINI_API_KEY_2 for 2x throughput");
  }
  
  if (report.summary.avgKeysPerProvider < 2) {
    report.recommendations.push("📈 Average keys per provider is low. Add more keys to increase throughput.");
  }
  
  if (report.providers.groq?.keyCount >= 3 && report.providers.gemini?.keyCount >= 2) {
    report.recommendations.push("✅ Excellent! Multi-key rotation is properly configured.");
  }
  
  console.log("\n✅ Test completed!\n");
  
  return NextResponse.json(report, { 
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}
