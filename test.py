import urllib.request, json
req = urllib.request.Request(
    'https://us-central1-fellowship-of-the-hearth.cloudfunctions.net/forge_execute',
    data=json.dumps({
        'agent_id': 'malaky',
        'script_hash': 'abcdef1234567890',
        'action': 'claim_tile',
        'params': {'tile_id': '5_5', 'building_type': 'hearth'}
    }).encode(),
    headers={'Content-Type':'application/json'},
    method='POST'
)
try:
    print(urllib.request.urlopen(req).read().decode())
except Exception as e:
    print(e.read().decode())
