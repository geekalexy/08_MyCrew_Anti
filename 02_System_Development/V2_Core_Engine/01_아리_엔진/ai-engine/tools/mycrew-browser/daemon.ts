import { chromium, Browser, Page } from 'playwright';
import * as readline from 'readline';

let browser: Browser | null = null;
let page: Page | null = null;
let elementMap = new Map<string, any>();

async function startBrowser() {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
}

async function extractAOM(page: Page) {
    const client = await page.context().newCDPSession(page);
    const { nodes } = await client.send('Accessibility.getFullAXTree');
    const nodeMap = new Map();
    for (const n of nodes) {
        nodeMap.set(n.nodeId, {
            role: n.role?.value,
            name: n.name?.value,
            children: [],
            childIds: n.childIds || []
        });
    }
    let snapshot = null;
    if (nodes.length > 0) {
        for (const n of nodes) {
            const mapped = nodeMap.get(n.nodeId);
            for (const cid of mapped.childIds) {
                const child = nodeMap.get(cid);
                if (child) {
                    mapped.children.push(child);
                }
            }
        }
        snapshot = nodeMap.get(nodes[0].nodeId);
    }
    let idCounter = 1;
    elementMap.clear();

    const result: any[] = [];
    async function traverse(node: any) {
        if (!node) return;
        
        // Dual-Track 검증 (isVisible / boundingBox) 시뮬레이션 및 요소 추출
        if (node.role && node.name) {
            let isValid = false;
            let bounds = null;
            try {
                // 정확히 1개 매칭되는 경우만 필터링하거나 first()를 씀
                const locator = page!.getByRole(node.role, { name: node.name, exact: true }).first();
                const isVisible = await locator.isVisible({ timeout: 50 }).catch(() => false);
                if (isVisible) {
                    const box = await locator.boundingBox({ timeout: 50 }).catch(() => null);
                    if (box && box.width > 0 && box.height > 0) {
                        isValid = true;
                        bounds = box;
                    }
                }
            } catch(e) {
                // Ignore
            }

            if (isValid) {
                const eid = `@E${idCounter++}`;
                elementMap.set(eid, node);
                result.push({ id: eid, role: node.role, name: node.name, box: bounds });
            }
        }
        
        if (node.children) {
            for (const child of node.children) {
                await traverse(child);
            }
        }
    }
    await traverse(snapshot);
    return result;
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

const DAEMON_UUID = process.env.DAEMON_UUID;

rl.on('line', async (line) => {
    if (!line.trim()) return;
    try {
        const payload = JSON.parse(line);
        
        if (payload.uuid !== DAEMON_UUID) {
            console.log(JSON.stringify({ error: 'Invalid UUID' }));
            return;
        }

        if (!browser) {
            await startBrowser();
        }

        const cmd = payload.command;
        if (cmd.startsWith('BROWSE ')) {
            const url = cmd.substring(7).trim();
            await page?.goto(url);
            const aom = await extractAOM(page!);
            console.log(JSON.stringify({ status: 'success', aom }));
        } else if (cmd.startsWith('CLICK ')) {
            const eid = cmd.substring(6).trim();
            const el = elementMap.get(eid);
            if (el) {
                await page?.getByRole(el.role, { name: el.name }).first().click();
                const aom = await extractAOM(page!);
                console.log(JSON.stringify({ status: 'success', aom }));
            } else {
                console.log(JSON.stringify({ error: `Element ${eid} not found` }));
            }
        } else {
            console.log(JSON.stringify({ error: `Unknown command: ${cmd}` }));
        }
    } catch (e: any) {
        console.log(JSON.stringify({ error: e.message }));
    }
});

// 시작 시 준비 완료 신호
console.log(JSON.stringify({ status: 'ready', message: 'Daemon is listening for NDJSON on stdin' }));
