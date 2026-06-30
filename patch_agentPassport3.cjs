const fs = require('fs');
const path = require('path');
const agentPassportApiFile = path.join(__dirname, 'functions', 'src', 'agentPassportApi.ts');
let code = fs.readFileSync(agentPassportApiFile, 'utf8');

// Update memory/append to do auth first
const oldMemoryAppend = `      const body = (typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body))
        ? req.body as Record<string, unknown>
        : {};
      const eventType = typeof body.event_type === 'string' ? body.event_type.trim().slice(0, 64) : '';
      const summary = typeof body.summary === 'string' ? body.summary.trim().slice(0, 240) : '';
      const metadata = cleanMetadata(body.metadata);
      if (!eventType || !summary) {
        res.status(400).json({ error: 'event_type and summary are required.' });
        return;
      }
  
      const requestedAgentId = typeof body.agent_id === 'string' ? body.agent_id : '';
      const identity = await resolveWriteIdentity(req, requestedAgentId);
      if (!identity.ok) {
        res.status(identity.status).json(identity.body);
        return;
      }
      if (identity.source === 'agent_service_token' && (!identity.scopes || !identity.scopes.includes('memory:append'))) {
        res.status(403).json({ error: 'forbidden: requires memory:append scope' });
        return;
      }`;

const newMemoryAppend = `      const body = (typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body))
        ? req.body as Record<string, unknown>
        : {};
      const requestedAgentId = typeof body.agent_id === 'string' ? body.agent_id : '';
      
      const identity = await resolveWriteIdentity(req, requestedAgentId);
      if (!identity.ok) {
        res.status(identity.status).json(identity.body);
        return;
      }
      if (identity.source === 'agent_service_token' && (!identity.scopes || !identity.scopes.includes('memory:append'))) {
        res.status(403).json({ error: 'forbidden: requires memory:append scope' });
        return;
      }

      const eventType = typeof body.event_type === 'string' ? body.event_type.trim().slice(0, 64) : '';
      const summary = typeof body.summary === 'string' ? body.summary.trim().slice(0, 240) : '';
      const metadata = cleanMetadata(body.metadata);
      if (!eventType || !summary) {
        res.status(400).json({ error: 'event_type and summary are required.' });
        return;
      }`;

code = code.replace(oldMemoryAppend, newMemoryAppend);

// Update task/event to do auth first
const oldTaskEvent = `      const body = (typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body))
        ? req.body as Record<string, unknown>
        : {};
      const requestedAgentId = typeof body.agent_id === 'string' ? body.agent_id.trim() : '';
      const taskId = typeof body.task_id === 'string' ? body.task_id.trim().slice(0, 96) : '';
      const status = typeof body.status === 'string' ? body.status.trim().slice(0, 32) : '';
      const summary = typeof body.summary === 'string' ? body.summary.trim().slice(0, 240) : '';
      const receiptHash = typeof body.receipt_hash === 'string' ? body.receipt_hash.trim().slice(0, 128) : '';
      const metadata = cleanMetadata(body.metadata) || {};
      const allowedStatuses = new Set(['open', 'claimed', 'in_progress', 'witnessed', 'archived']);
  
      if (!taskId || !status) {
        res.status(400).json({ error: 'task_id and status are required.' });
        return;
      }
      if (!allowedStatuses.has(status)) {
        res.status(400).json({ error: \`Unsupported task status "\${status}".\` });
        return;
      }
  
      const identity = await resolveWriteIdentity(req, requestedAgentId);
      if (!identity.ok) {
        res.status(identity.status).json(identity.body);
        return;
      }
      if (identity.source === 'agent_service_token' && (!identity.scopes || !identity.scopes.includes('task:event'))) {
        res.status(403).json({ error: 'forbidden: requires task:event scope' });
        return;
      }`;

const newTaskEvent = `      const body = (typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body))
        ? req.body as Record<string, unknown>
        : {};
      const requestedAgentId = typeof body.agent_id === 'string' ? body.agent_id.trim() : '';
      
      const identity = await resolveWriteIdentity(req, requestedAgentId);
      if (!identity.ok) {
        res.status(identity.status).json(identity.body);
        return;
      }
      if (identity.source === 'agent_service_token' && (!identity.scopes || !identity.scopes.includes('task:event'))) {
        res.status(403).json({ error: 'forbidden: requires task:event scope' });
        return;
      }

      const taskId = typeof body.task_id === 'string' ? body.task_id.trim().slice(0, 96) : '';
      const status = typeof body.status === 'string' ? body.status.trim().slice(0, 32) : '';
      const summary = typeof body.summary === 'string' ? body.summary.trim().slice(0, 240) : '';
      const receiptHash = typeof body.receipt_hash === 'string' ? body.receipt_hash.trim().slice(0, 128) : '';
      const metadata = cleanMetadata(body.metadata) || {};
      const allowedStatuses = new Set(['open', 'claimed', 'in_progress', 'witnessed', 'archived']);
  
      if (!taskId || !status) {
        res.status(400).json({ error: 'task_id and status are required.' });
        return;
      }
      if (!allowedStatuses.has(status)) {
        res.status(400).json({ error: \`Unsupported task status "\${status}".\` });
        return;
      }`;

code = code.replace(oldTaskEvent, newTaskEvent);

// Also add a try/catch around buildAgentPassport in case it crashes
const oldBuildCall = `  const bundle = await buildAgentPassport(agentId);
  if (!bundle) {
    res.status(404).json({ error: \`No agent passport found for id "\${agentId}".\` });
    return;
  }`;

const newBuildCall = `  try {
    const bundle = await buildAgentPassport(agentId);
    if (!bundle) {
      res.status(404).json({ error: \`No agent passport found for id "\${agentId}".\` });
      return;
    }

    res.set('Cache-Control', 'public, max-age=30, s-maxage=30');
    if (req.query.format === 'export') {
      res.set('Content-Disposition', \`inline; filename="agent-passport-\${agentId}.json"\`);
    }
    res.status(200).json(bundle);
  } catch (err) {
    console.error('buildAgentPassport error:', err);
    res.status(404).json({ error: \`No agent passport found for id "\${agentId}".\` });
  }
  return; // Stop execution here, the original res.status(200).json is now in try block
});`;

// Wait, the original code had:
// res.set('Cache-Control', 'public, max-age=30, s-maxage=30');
// if (req.query.format === 'export') {
//   res.set('Content-Disposition', `inline; filename="agent-passport-${agentId}.json"`);
// }
// res.status(200).json(bundle);
// });

// I should just replace the last part
const endOfFile = `  const bundle = await buildAgentPassport(agentId);
  if (!bundle) {
    res.status(404).json({ error: \`No agent passport found for id "\${agentId}".\` });
    return;
  }

  res.set('Cache-Control', 'public, max-age=30, s-maxage=30');
  if (req.query.format === 'export') {
    res.set('Content-Disposition', \`inline; filename="agent-passport-\${agentId}.json"\`);
  }
  res.status(200).json(bundle);
});`;

if (code.includes(endOfFile)) {
    code = code.replace(endOfFile, newBuildCall);
}

fs.writeFileSync(agentPassportApiFile, code);
console.log('Fixed agentPassportApi.ts structure.');
