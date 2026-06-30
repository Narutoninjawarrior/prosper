const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'frontend', 'src', 'CottageAssemblyLine.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// Add the handlePushToCommons function
const pushToCommonsLogic = `
  function handlePushToCommons(batch: SavedBatch) {
    if (!batch.productName) {
      setError('Product name is required to push to Commons.');
      return;
    }

    const isCrystallized = batch.status === 'PUBLISH_READY' || batch.status === 'PUBLIC_WITNESSED' || batch.status === 'CRYSTALLIZE_READY';
    const visibility = isCrystallized ? 'local_artifact' : 'local_draft';
    const summaryPrefix = isCrystallized ? 'Inspect crystallized cottage batch' : 'Review cottage batch draft';
    
    const lines = [
      \`Category: \${batch.category}\`,
      \`pH: \${batch.measuredPhValue || 'N/A'}\`,
      \`Evidence: \${batch.measurementPhotoKey ? 'Present' : 'Missing'}\`,
      batch.envelope ? \`Digest: \${batch.envelope.payloadHash.digestHex}\` : 'Digest: Not yet crystallized',
      batch.envelope?.witness?.receipt ? \`Dev-stub receipt: \${batch.envelope.witness.receipt.receiptId}\` : 'Dev-stub receipt: None'
    ];

    const promptText = \`\${summaryPrefix}: \${batch.productName}\\n\\n\${lines.join('\\n')}\`;
    const commonsId = \`cottage-commons-\${batch.id}\`;

    const newPrompt = {
      id: commonsId,
      prompt_text: promptText,
      author_type: 'human',
      author_id: 'local_operator',
      target_type: 'route',
      target_id: '/commons',
      status: 'proposed',
      boundary: 'local_only',
      visibility: visibility,
      scope: 'local_draft',
      source_route: '/cottage-assembly',
      receipt_hash: batch.envelope?.witness?.receipt?.receiptId || undefined,
      created_at: new Date(batch.updatedAt).toISOString(),
      updated_at: new Date().toISOString(),
      is_local_session: true,
      object_ref: {
        id: batch.id,
        title: batch.productName,
        purpose: 'cottage-batch',
        source: 'cottage-assembly',
        freshness: String(batch.updatedAt)
      }
    };

    const existing = JSON.parse(sessionStorage.getItem('hearth_commons_session_prompts') || '[]');
    // Dedupe by ID
    const filtered = existing.filter(p => p.id !== commonsId);
    sessionStorage.setItem('hearth_commons_session_prompts', JSON.stringify([newPrompt, ...filtered]));

    setMessage(isCrystallized ? 'Local artifact pushed to Commons.' : 'Local draft pushed to Commons.');
    setTimeout(() => {
      window.location.href = \`/commons?source=cottage-assembly&object=\${batch.id}\`;
    }, 800);
  }
`;

// Insert the function before the return statement
code = code.replace(/return \(\s*<div style=\{\{ display: 'flex'/, pushToCommonsLogic + "\n  return (\n    <div style={{ display: 'flex'");

// Add the button to the saved batches
const buttonHtml = `
                      <button onClick={() => handlePushToCommons(batch)} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 4, background: 'rgba(212,168,83,0.1)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)', cursor: 'pointer', fontWeight: 700 }}>
                        Push to Commons
                      </button>
                      <button onClick={() => handleCopyStatus(batch)`;

code = code.replace(/<button onClick=\{\(\) => handleCopyStatus\(batch\)/, buttonHtml);

fs.writeFileSync(filePath, code);
console.log('Added Push to Commons to CottageAssemblyLine.tsx');
