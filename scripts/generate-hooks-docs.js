#!/usr/bin/env node
/**
 * Generate AGENTS.md documentation from TypeScript types
 *
 * This script extracts hook types, environment variables, and generates
 * comprehensive documentation that gets embedded in the comux binary.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Read the hooks.ts file to extract types
const hooksFile = join(projectRoot, 'src/utils/hooks.ts');
const hooksContent = readFileSync(hooksFile, 'utf-8');

// Extract hook types
const hookTypesMatch = hooksContent.match(/export type HookType =\s*\|([\s\S]*?);/);
const hookTypes = hookTypesMatch
  ? hookTypesMatch[1]
      .split('|')
      .map(t => t.trim().replace(/['"]/g, ''))
      .filter(Boolean)
  : [];

console.log(`📋 Found ${hookTypes.length} hook types`);

// Generate AGENTS.md content
const agentsMd = `# comux Hooks System - Agent Reference

**Auto-generated documentation for AI agents**

This document contains everything an AI agent needs to create, modify, and understand comux hooks. It is automatically generated from the comux source code and embedded in the binary.

## What You're Working On

You are editing hooks for **comux**, a tmux pane manager that creates AI-powered development workflows. Each pane runs in its own git worktree with an AI agent.

## Your Goal

Create executable bash scripts in \`.comux-hooks/\` that run automatically at key lifecycle events.

## Quick Start

1. **Create a hook file**: \`touch .comux-hooks/worktree_created\`
2. **Make it executable**: \`chmod +x .comux-hooks/worktree_created\`
3. **Add shebang**: Start with \`#!/bin/bash\`
4. **Use environment variables**: Access \`$COMUX_ROOT\`, \`$COMUX_WORKTREE_PATH\`, etc.
5. **Test it**: Set env vars manually and run the script

## Hook Execution Model

- **Non-blocking**: Hooks run in background (detached processes)
- **Silent failures**: Hook errors are logged but don't stop comux
- **Environment-based**: All context passed via environment variables
- **Version controlled**: Hooks in \`.comux-hooks/\` are shared with team
- **Priority resolution**: \`.comux-hooks/\` → \`.comux/hooks/\` → \`~/.comux/hooks/\`

## Available Hooks

${generateHooksTable()}

## Environment Variables

### Always Available
\`\`\`bash
COMUX_ROOT="/path/to/project"           # Project root directory
COMUX_SERVER_PORT="3142"                # HTTP server port
\`\`\`

### Pane Context (most hooks)
\`\`\`bash
COMUX_PANE_ID="comux-1234567890"         # comux pane identifier
COMUX_SLUG="fix-auth-bug"               # Branch/worktree name
COMUX_PROMPT="Fix authentication bug"   # User's prompt
COMUX_AGENT="claude"                    # Agent type (registry id, e.g. claude, codex, opencode)
COMUX_TMUX_PANE_ID="%38"                # tmux pane ID
\`\`\`

### Worktree Context
\`\`\`bash
COMUX_WORKTREE_PATH="/path/.comux/worktrees/fix-auth-bug"
COMUX_BRANCH="fix-auth-bug"             # Same as slug
\`\`\`

### Merge Context
\`\`\`bash
COMUX_TARGET_BRANCH="main"              # Branch being merged into
\`\`\`

## HTTP Callback API

Interactive hooks (\`run_test\` and \`run_dev\`) can update comux UI via HTTP.

### Update Test Status
\`\`\`bash
curl -X PUT "http://localhost:$COMUX_SERVER_PORT/api/panes/$COMUX_PANE_ID/test" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "running", "output": "optional test output"}'

# Status values: "running" | "passed" | "failed"
\`\`\`

### Update Dev Server
\`\`\`bash
curl -X PUT "http://localhost:$COMUX_SERVER_PORT/api/panes/$COMUX_PANE_ID/dev" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "running", "url": "http://localhost:3000"}'

# Status values: "running" | "stopped"
# url: Can be localhost or tunnel URL (ngrok, cloudflared, etc.)
\`\`\`

## Common Patterns

### Pattern 1: Install Dependencies
\`\`\`bash
#!/bin/bash
# .comux-hooks/worktree_created

cd "$COMUX_WORKTREE_PATH"

if [ -f "pnpm-lock.yaml" ]; then
  pnpm install --prefer-offline &
elif [ -f "package-lock.json" ]; then
  npm install &
elif [ -f "yarn.lock" ]; then
  yarn install &
elif [ -f "Gemfile" ]; then
  bundle install &
elif [ -f "requirements.txt" ]; then
  pip install -r requirements.txt &
elif [ -f "Cargo.toml" ]; then
  cargo build &
fi
\`\`\`

### Pattern 2: Copy Configuration
\`\`\`bash
#!/bin/bash
# .comux-hooks/worktree_created

# Copy environment file
if [ -f "$COMUX_ROOT/.env.local" ]; then
  cp "$COMUX_ROOT/.env.local" "$COMUX_WORKTREE_PATH/.env.local"
fi

# Copy other config files
for file in .env.development .npmrc .yarnrc; do
  if [ -f "$COMUX_ROOT/$file" ]; then
    cp "$COMUX_ROOT/$file" "$COMUX_WORKTREE_PATH/$file"
  fi
done
\`\`\`

### Pattern 3: Run Tests with Status Updates
\`\`\`bash
#!/bin/bash
# .comux-hooks/run_test

set -e
cd "$COMUX_WORKTREE_PATH"
API="http://localhost:$COMUX_SERVER_PORT/api/panes/$COMUX_PANE_ID/test"

# Update: starting
curl -s -X PUT "$API" -H "Content-Type: application/json" \\
  -d '{"status": "running"}' > /dev/null

# Run tests and capture output
OUTPUT_FILE="/tmp/comux-test-$COMUX_PANE_ID.txt"
if pnpm test > "$OUTPUT_FILE" 2>&1; then
  STATUS="passed"
else
  STATUS="failed"
fi

# Get output (truncate if too long)
OUTPUT=$(head -c 5000 "$OUTPUT_FILE")

# Update: complete
curl -s -X PUT "$API" -H "Content-Type: application/json" \\
  -d "$(jq -n --arg status "$STATUS" --arg output "$OUTPUT" \\
    '{status: $status, output: $output}')" > /dev/null

rm -f "$OUTPUT_FILE"
\`\`\`

### Pattern 4: Dev Server with Tunnel
\`\`\`bash
#!/bin/bash
# .comux-hooks/run_dev

set -e
cd "$COMUX_WORKTREE_PATH"
API="http://localhost:$COMUX_SERVER_PORT/api/panes/$COMUX_PANE_ID/dev"

# Start dev server in background
LOG_FILE="/tmp/comux-dev-$COMUX_PANE_ID.log"
pnpm dev > "$LOG_FILE" 2>&1 &
DEV_PID=$!

# Wait for server to start
sleep 5

# Detect port from logs
PORT=$(grep -oP 'localhost:\\K\\d+' "$LOG_FILE" | head -1)
[ -z "$PORT" ] && PORT=3000

# Optional: Create tunnel with cloudflared
if command -v cloudflared &> /dev/null; then
  TUNNEL=$(cloudflared tunnel --url "http://localhost:$PORT" 2>&1 | \\
    grep -oP 'https://[a-z0-9-]+\\.trycloudflare\\.com' | head -1)
  URL="\\\${TUNNEL:-http://localhost:$PORT}"
else
  URL="http://localhost:$PORT"
fi

# Report status
curl -s -X PUT "$API" -H "Content-Type: application/json" \\
  -d "{\\"status\\": \\"running\\", \\"url\\": \\"$URL\\"}" > /dev/null

echo "[Hook] Dev server running at $URL (PID: $DEV_PID)"
\`\`\`

### Pattern 5: Post-Merge Deployment
\`\`\`bash
#!/bin/bash
# .comux-hooks/post_merge

set -e
cd "$COMUX_ROOT"

# Only deploy from main/master
if [ "$COMUX_TARGET_BRANCH" != "main" ] && [ "$COMUX_TARGET_BRANCH" != "master" ]; then
  exit 0
fi

# Push to remote
git push origin "$COMUX_TARGET_BRANCH"

# Trigger deployment (example: Vercel)
if [ -n "$VERCEL_TOKEN" ]; then
  curl -s -X POST "https://api.vercel.com/v1/deployments" \\
    -H "Authorization: Bearer $VERCEL_TOKEN" \\
    -H "Content-Type: application/json" \\
    -d '{"name": "my-project"}' > /dev/null
fi

# Close GitHub issue if prompt contains #123
ISSUE=$(echo "$COMUX_PROMPT" | grep -oP '#\\K\\d+' | head -1)
if [ -n "$ISSUE" ] && command -v gh &> /dev/null; then
  gh issue close "$ISSUE" \\
    -c "Resolved in $COMUX_SLUG, merged to $COMUX_TARGET_BRANCH" \\
    2>/dev/null || true
fi
\`\`\`

## Best Practices

1. **Always start with shebang**: \`#!/bin/bash\`
2. **Set error handling**: \`set -e\` (exit on error)
3. **Make executable**: \`chmod +x .comux-hooks/hook_name\`
4. **Background long operations**: Append \`&\` to avoid blocking
5. **Check for required tools**: \`command -v tool &> /dev/null\`
6. **Log for debugging**: \`echo "[Hook] message" >> "$COMUX_ROOT/.comux/hooks.log"\`
7. **Handle missing vars gracefully**: \`[ -z "$VAR" ] && exit 0\`
8. **Use silent curl**: \`curl -s\` to avoid noise in logs
9. **Clean up temp files**: Remove files in \`/tmp/\`
10. **Test before committing**: Run hooks manually with mock env vars

## Testing Hooks

### Manual Testing
\`\`\`bash
# 1. Set environment variables
export COMUX_ROOT="$(pwd)"
export COMUX_PANE_ID="test-pane"
export COMUX_SLUG="test-branch"
export COMUX_WORKTREE_PATH="$(pwd)"
export COMUX_SERVER_PORT="3142"
export COMUX_AGENT="claude"
export COMUX_PROMPT="Test prompt"

# 2. Run hook directly
./.comux-hooks/worktree_created

# 3. Check exit code
echo $?  # Should be 0 for success
\`\`\`

### Syntax Check
\`\`\`bash
# Check for syntax errors without running
bash -n ./.comux-hooks/worktree_created
\`\`\`

### Shellcheck (if available)
\`\`\`bash
shellcheck ./.comux-hooks/worktree_created
\`\`\`

## Project Context Analysis

Before creating hooks, analyze these files in the project:

### Package Manager Detection
\`\`\`bash
# Check which package manager is used
if [ -f "pnpm-lock.yaml" ]; then
  # Use: pnpm install, pnpm test, pnpm dev
elif [ -f "package-lock.json" ]; then
  # Use: npm install, npm test, npm run dev
elif [ -f "yarn.lock" ]; then
  # Use: yarn install, yarn test, yarn dev
fi
\`\`\`

### Test Command Discovery
\`\`\`bash
# Read package.json to find test command
cat package.json | grep '"test"'
# Or with jq:
jq -r '.scripts.test' package.json
\`\`\`

### Dev Command Discovery
\`\`\`bash
# Read package.json to find dev command
cat package.json | grep '"dev"'
# Or with jq:
jq -r '.scripts.dev' package.json
\`\`\`

### Environment Variables
\`\`\`bash
# Check for .env files to copy
ls -la | grep '\\.env'
\`\`\`

### Build System
\`\`\`bash
# Detect build system
if [ -f "vite.config.ts" ]; then
  # Vite project
elif [ -f "next.config.js" ]; then
  # Next.js project
elif [ -f "nuxt.config.ts" ]; then
  # Nuxt project
fi
\`\`\`

## Common Mistakes to Avoid

❌ **Blocking operations**: \`sleep 60\` (blocks comux)
✅ **Background long tasks**: \`slow_operation &\`

❌ **Hardcoded paths**: \`/Users/me/project\`
✅ **Use variables**: \`"$COMUX_ROOT"\`

❌ **Assuming tools exist**: \`pnpm install\`
✅ **Check first**: \`command -v pnpm && pnpm install\`

❌ **No error handling**: Script fails silently
✅ **Set error mode**: \`set -e\` or check exit codes

❌ **Forgetting executable bit**: Hook won't run
✅ **Make executable**: \`chmod +x\`

❌ **Noisy output**: Clutters comux logs
✅ **Silent operations**: \`curl -s\`, \`> /dev/null 2>&1\`

❌ **Not testing**: Deploy and hope
✅ **Test manually**: Run with mock env vars first

## Debugging

If a hook isn't working:

1. **Check if file exists**: \`ls -la .comux-hooks/\`
2. **Check permissions**: Should show \`x\` in \`rwxr-xr-x\`
3. **Check syntax**: \`bash -n .comux-hooks/hook_name\`
4. **Test manually**: Set env vars and run
5. **Check logs**: comux logs to stderr with \`[Hooks]\` prefix
6. **Simplify**: Remove complex parts, test basic version
7. **Check tool availability**: \`command -v required_tool\`

### Debug Mode
\`\`\`bash
#!/bin/bash
# Add to top of hook for debugging
set -x  # Print each command before executing
set -e  # Exit on error

# Your hook logic here
\`\`\`

## Summary Checklist

When creating a new hook:

- [ ] Create file in \`.comux-hooks/\`
- [ ] Add shebang: \`#!/bin/bash\`
- [ ] Make executable: \`chmod +x\`
- [ ] Add \`set -e\` for error handling
- [ ] Use environment variables (never hardcode paths)
- [ ] Background long operations with \`&\`
- [ ] Check for required tools before using
- [ ] Test manually with mock env vars
- [ ] Add comments explaining what it does
- [ ] Commit to version control

## Getting Help

- **Full documentation**: See \`HOOKS.md\` in project root
- **Claude-specific tips**: See \`CLAUDE.md\` in \`.comux-hooks/\`
- **Examples**: Check \`.comux-hooks/examples/\` directory
- **comux API**: See \`API.md\` for REST endpoints

---

*This documentation was auto-generated from comux source code.*
*Version: ${new Date().toISOString().split('T')[0]}*
`;

// Write the generated markdown
const outputPath = join(projectRoot, 'src/utils/generated-agents-doc.ts');
const tsContent = `/**
 * Auto-generated AGENTS.md content
 * DO NOT EDIT MANUALLY - run 'pnpm generate:hooks-docs' to regenerate
 */

export const AGENTS_MD = \`${agentsMd.replace(/`/g, '\\`')}\`;
`;

writeFileSync(outputPath, tsContent);

console.log('✅ Generated AGENTS.md content');
console.log(`📝 Written to: ${outputPath}`);
console.log(`📦 ${agentsMd.length} characters`);

function generateHooksTable() {
  const hookDescriptions = {
    before_pane_create: ['Before pane creation', 'Validation, notifications, pre-flight checks'],
    pane_created: ['After pane, before worktree', 'Configure tmux settings, prepare environment'],
    worktree_created: ['After full setup', 'Install deps, copy configs, setup git'],
    before_pane_close: ['Before closing', 'Save state, backup uncommitted work'],
    pane_closed: ['After closed', 'Cleanup resources, analytics, notifications'],
    before_worktree_remove: ['Before worktree removal', 'Archive worktree, save artifacts'],
    worktree_removed: ['After worktree removed', 'Cleanup external references'],
    pre_merge: ['Before merge operation', 'Run final tests, create backups'],
    post_merge: ['After successful merge', 'Deploy, close issues, notify team'],
    run_test: ['When tests triggered', 'Run test suite, report status via HTTP'],
    run_dev: ['When dev server triggered', 'Start dev server, create tunnel, report URL'],
  };

  let table = '### Pane Lifecycle Hooks\n\n';
  table += '| Hook | When | Common Use Cases |\n';
  table += '|------|------|------------------|\n';

  const paneHooks = ['before_pane_create', 'pane_created', 'worktree_created', 'before_pane_close', 'pane_closed'];
  paneHooks.forEach(hook => {
    const [when, use] = hookDescriptions[hook] || ['', ''];
    table += `| \`${hook}\` | ${when} | ${use} |\n`;
  });

  table += '\n### Worktree Lifecycle Hooks\n\n';
  table += '| Hook | When | Common Use Cases |\n';
  table += '|------|------|------------------|\n';

  const worktreeHooks = ['before_worktree_remove', 'worktree_removed'];
  worktreeHooks.forEach(hook => {
    const [when, use] = hookDescriptions[hook] || ['', ''];
    table += `| \`${hook}\` | ${when} | ${use} |\n`;
  });

  table += '\n### Merge Lifecycle Hooks\n\n';
  table += '| Hook | When | Common Use Cases |\n';
  table += '|------|------|------------------|\n';

  const mergeHooks = ['pre_merge', 'post_merge'];
  mergeHooks.forEach(hook => {
    const [when, use] = hookDescriptions[hook] || ['', ''];
    table += `| \`${hook}\` | ${when} | ${use} |\n`;
  });

  table += '\n### Interactive Hooks (with HTTP callbacks)\n\n';
  table += '| Hook | When | Common Use Cases |\n';
  table += '|------|------|------------------|\n';

  const interactiveHooks = ['run_test', 'run_dev'];
  interactiveHooks.forEach(hook => {
    const [when, use] = hookDescriptions[hook] || ['', ''];
    table += `| \`${hook}\` | ${when} | ${use} |\n`;
  });

  return table;
}
