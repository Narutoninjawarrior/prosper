import sys

def patch_file(filepath, anchor, action):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()
    if 'sendToCommons' not in text:
        text = text.replace('sendToWorkbench } from', 'sendToWorkbench, sendToCommons } from')
    
    # insert the new action right before Send to Workbench
    if action not in text:
        text = text.replace(anchor, action + '\n' + anchor)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)

w_path = r'd:\Hearth\prosper2\frontend\src\WorldScene.jsx'
w_anchor = "              { label: 'Send to Workbench [Local Session]'"
w_action = "              { label: 'Send to Commons [Local Session]', onClick: () => sendToCommons({ id: `portal-${label}`, title: `${label} Portal`, purpose: 'Zone transition matrix', source: 'WorldScene', freshness: 'Live' }), tone: 'primary' },"
patch_file(w_path, w_anchor, w_action)

g_path = r'd:\Hearth\prosper2\frontend\src\community\GemmaPresence.jsx'
g_anchor = "                  { label: 'Send to Workbench [Local Session]'"
g_action = "                  { label: 'Send to Commons [Local Session]', onClick: () => sendToCommons({ id: 'gemma', title: 'Gemma', purpose: 'Local steward intelligence', source: 'Gemma 2 9B IT', freshness: 'Live / Ready' }), tone: 'primary' },"
patch_file(g_path, g_anchor, g_action)

c_path = r'd:\Hearth\prosper2\frontend\src\world\CeremonyHearthZone.jsx'
c_anchor = "              { label: 'Send to Workbench [Local Session]'"
c_action = "              { label: 'Send to Commons [Local Session]', onClick: () => sendToCommons({ id: 'hearth', title: 'Ceremony Hearth', purpose: 'State meal synthesis', source: 'GET /api/hearth/ceremony', freshness: 'Live' }), tone: 'primary' },"
patch_file(c_path, c_anchor, c_action)

s_path = r'd:\Hearth\prosper2\frontend\src\WaterSim.jsx'
s_anchor = "            { label: 'Send to Workbench [Local Session]'"
s_action = "            { label: 'Send to Commons [Local Session]', onClick: () => sendToCommons({ id: `waterwheel-${chainHash}`, title: title || 'Water Pool', purpose: 'Cellular automata reagent pool', source: placedBy || 'Local', freshness: 'Live simulation' }), tone: 'primary' },"
patch_file(s_path, s_anchor, s_action)
