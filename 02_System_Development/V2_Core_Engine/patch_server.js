const fs = require('fs');

const serverFile = '/Users/alex/Documents/08_MyCrew_Anti/02_System_Development/V2_Core_Engine/01_아리_엔진/server.js';
let content = fs.readFileSync(serverFile, 'utf8');

// 1. Add missing imports
if (!content.includes('runPlanMasterLoop')) {
    content = content.replace(
        "import { runDebugLoop } from './ai-engine/loops/debugLoop.js';",
        "import { runDebugLoop, recoverZombieDebugTasks } from './ai-engine/loops/debugLoop.js';\nimport { runPlanMasterLoop } from './ai-engine/loops/planMasterLoop.js';"
    );
    content = content.replace(
        "import { runQALoop } from './ai-engine/loops/qaLoop.js';",
        "import { runQALoop, recoverZombieQATasks } from './ai-engine/loops/qaLoop.js';"
    );
}

// 2. Refactor /plan-master/analyze
const analyzeStart = "app.post('/api/projects/:id/plan-master/analyze', async (req, res) => {";
const analyzeEndPattern = "res.json({ status: parsedResult.needs_clarification ? 'needs_clarification' : 'success', ...parsedResult });\n  } catch (err) {\n    console.error('[API /api/projects/:id/plan-master/analyze] Error:', err.message);\n    res.status(500).json({ error: err.message });\n  }\n});";

const analyzeIdx1 = content.indexOf(analyzeStart);
const analyzeIdx2 = content.indexOf(analyzeEndPattern, analyzeIdx1);

if (analyzeIdx1 !== -1 && analyzeIdx2 !== -1) {
    const analyzeReplacement = `app.post('/api/projects/:id/plan-master/analyze', async (req, res) => {
  const { id: projectId } = req.params;
  const { requirements, deadline, taskId } = req.body;
  try {
    const safeReq = requirements || '';
    broadcastLog('info', \`[Plan Master] 스코프 분석 시작 (요구사항: \${safeReq.substring(0, 30)}...)\`, 'system', null, 'DASHBOARD', projectId);
    
    // [Phase 45-B] God Route 비동기 위임 (202 Accepted 즉시 반환)
    runPlanMasterLoop(projectId, taskId, safeReq, deadline, io).catch(err => {
      console.error('[Plan Master Loop Error]', err);
    });

    res.status(202).json({ status: 'accepted', message: 'Plan Master 분석 파이프라인이 시작되었습니다.' });
  } catch (err) {
    console.error('[API /api/projects/:id/plan-master/analyze] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});`;
    
    content = content.substring(0, analyzeIdx1) + analyzeReplacement + content.substring(analyzeIdx2 + analyzeEndPattern.length);
}

// 3. Refactor /plan-master/generate-roadmaps
const roadmapStart = "app.post('/api/projects/:id/plan-master/generate-roadmaps', async (req, res) => {";
const roadmapEndPattern = "res.json({ status: 'success', mvp_tasks, future_scope, message: finalMessage });\n  } catch (err) {\n    console.error('[API /api/projects/:id/plan-master/generate-roadmaps] Error:', err.message);\n    res.status(500).json({ error: err.message });\n  }\n});";

const rdIdx1 = content.indexOf(roadmapStart);
const rdIdx2 = content.indexOf(roadmapEndPattern, rdIdx1);

if (rdIdx1 !== -1 && rdIdx2 !== -1) {
    const rdReplacement = `app.post('/api/projects/:id/plan-master/generate-roadmaps', async (req, res) => {
  const { id: projectId } = req.params;
  try {
    res.status(202).json({ status: 'accepted', message: 'Roadmap generation is handled by the async loop.' });
  } catch (err) {
    console.error('[API /api/projects/:id/plan-master/generate-roadmaps] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});`;
    
    content = content.substring(0, rdIdx1) + rdReplacement + content.substring(rdIdx2 + roadmapEndPattern.length);
}

fs.writeFileSync(serverFile, content, 'utf8');
console.log('Successfully updated server.js');
