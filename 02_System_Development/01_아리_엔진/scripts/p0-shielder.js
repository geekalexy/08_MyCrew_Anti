import fs from 'fs';
import path from 'path';

console.log('🛡️ [P0-Shielder] Checking codebase for fatal anti-patterns...');

const rootDirs = [
    path.join(process.cwd(), '02_System_Development/01_아리_엔진/ai-engine'),
    path.join(process.cwd(), '02_System_Development/01_아리_엔진/routes'),
    path.join(process.cwd(), '02_System_Development/01_아리_엔진/adapters')
];

const RULES = [
    {
        name: 'Legacy SDK Usage',
        pattern: /@google\/generative-ai/g,
        message: '구형 @google/generative-ai SDK 사용이 감지되었습니다. @google/genai 로 통일하세요.'
    },
    {
        name: 'Hardcoded Hallucinated Model',
        pattern: /['"]gemini-(1\.5|2\.0)-/g,
        message: '하드코딩된 구형/환각 모델명이 발견되었습니다. modelRegistry.js의 MODEL 상수와 keyProvider를 사용하세요.'
    },
    {
        name: 'Direct API Key Access',
        pattern: /process\.env\.GEMINI_API_KEY/g,
        message: 'process.env.GEMINI_API_KEY 직접 호출이 감지되었습니다! keyProvider.getKey(\'GEMINI_API_KEY\') 를 사용하세요.'
    }
];

let hasError = false;

function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            scanDirectory(fullPath);
        } else if (fullPath.endsWith('.js')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            let fileHasError = false;

            RULES.forEach(rule => {
                const matches = content.match(rule.pattern);
                if (matches) {
                    if (!fileHasError) {
                        console.error(`\n❌ [P0 위반] 파일: ${fullPath}`);
                        fileHasError = true;
                        hasError = true;
                    }
                    console.error(`   - ${rule.name}: ${rule.message} (발견 횟수: ${matches.length})`);
                }
            });
        }
    }
}

rootDirs.forEach(scanDirectory);

if (hasError) {
    console.error('\n🚫 P0-Shielder 검증 실패! 코드를 수정해야 Commit 할 수 있습니다.');
    process.exit(1);
} else {
    console.log('✅ P0-Shielder 검증 통과 (안전한 코드입니다)');
    process.exit(0);
}
