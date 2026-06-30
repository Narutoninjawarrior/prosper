const fs = require('fs');
let code = fs.readFileSync('functions/src/agentPassportApi.ts', 'utf8');

code = code.replace(
`    const body = (typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body))
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
    }`,
`    const body = (typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body))
      ? req.body as Record<string, unknown>
      : {};
    const requestedAgentId = typeof body.agent_id === 'string' ? body.agent_id : '';
    const identity = await resolveWriteIdentity(req, requestedAgentId);
    if (!identity.ok) {
      res.status(identity.status).json(identity.body);
      return;
    }

    const eventType = typeof body.event_type === 'string' ? body.event_type.trim().slice(0, 64) : '';
    const summary = typeof body.summary === 'string' ? body.summary.trim().slice(0, 240) : '';
    const metadata = cleanMetadata(body.metadata);
    if (!eventType || !summary) {
      res.status(400).json({ error: 'event_type and summary are required.' });
      return;
    }

    if (identity.source === 'agent_service_token' && (!identity.scopes || !identity.scopes.includes('memory:append'))) {
      res.status(403).json({ error: 'forbidden: requires memory:append scope' });
      return;
    }`
);

code = code.replace(
`    const body = (typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body))
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
    }`,
`    const body = (typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body))
      ? req.body as Record<string, unknown>
      : {};
    const requestedAgentId = typeof body.agent_id === 'string' ? body.agent_id.trim() : '';
    
    const identity = await resolveWriteIdentity(req, requestedAgentId);
    if (!identity.ok) {
      res.status(identity.status).json(identity.body);
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
    }`
);

fs.writeFileSync('functions/src/agentPassportApi.ts', code);
