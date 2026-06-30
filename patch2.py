import sys

with open(r'd:\Hearth\prosper2\frontend\src\world\WorldActionSheet.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

insert = '''export function sendToCommons(obj) {
  const existing = JSON.parse(sessionStorage.getItem('hearth_commons_session_prompts') || '[]');
  const newPrompt = {
    id: `local-${Date.now()}`,
    prompt_text: `Review and process world object: ${obj.title} (${obj.id})`,
    author_type: 'human',
    author_id: 'local_user',
    target_type: 'open',
    status: 'proposed',
    boundary: 'local_only',
    source_route: '/world',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_local_session: true,
    object_ref: {
      id: obj.id,
      title: obj.title,
      purpose: obj.purpose,
      source: obj.source,
      freshness: obj.freshness
    }
  };
  sessionStorage.setItem('hearth_commons_session_prompts', JSON.stringify([newPrompt, ...existing]));
  window.location.href = `/commons?source=world&object=${obj.id}`;
}
'''
if 'export function sendToCommons' not in text:
    text = text.replace('export function openWorldActionSheet', insert + '\nexport function openWorldActionSheet')
    with open(r'd:\Hearth\prosper2\frontend\src\world\WorldActionSheet.jsx', 'w', encoding='utf-8') as f:
        f.write(text)
