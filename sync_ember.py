import urllib.request, json
req = urllib.request.Request(
    'https://us-central1-fellowship-of-the-hearth.cloudfunctions.net/admin_sync_balance',
    data=json.dumps({
        'admin_id': 'malaky',
        'target_agent_id': 'ember_core',
        'balance': 101.5
    }).encode(),
    headers={'Content-Type':'application/json'},
    method='POST'
)
try:
    print(urllib.request.urlopen(req).read().decode())
except Exception as e:
    print(e.read().decode())
