import firebase_admin
from firebase_admin import firestore
import requests
import time

# Initialize Firebase using default application credentials (gcloud auth)
if not firebase_admin._apps:
    firebase_admin.initialize_app()
db = firestore.client()

LM_STUDIO_URL = "http://127.0.0.1:1234/v1/chat/completions"

def process_queue():
    print("=====================================================")
    print("  HEARTH NATIVE ORACLE WORKER IS AWAKE")
    print("  Listening to 'hearth_queue' in Firebase...")
    print("  Routing traffic to local Qwen 3.5 (Port 1234)")
    print("=====================================================\n")
    
    # We poll the queue for any tasks flagged as 'PENDING'
    query = db.collection('hearth_queue').where('status', '==', 'PENDING')
    
    while True:
        try:
            docs = query.get()
            for doc in docs:
                data = doc.to_dict()
                print(f"[*] Oracle intercepted task from swarm: {doc.id}")
                
                # Lock the task so no other worker grabs it
                doc.reference.update({'status': 'PROCESSING'})
                
                # Format the payload for Qwen
                prompt = data.get('prompt', '')
                payload = {
                    "model": "qwen/qwen3.5-9b",
                    "messages": [
                        {"role": "system", "content": "You are the Hearth Native Oracle. Provide strict, highly compressed machine-native responses."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 512
                }
                
                # Hit the local silicon
                try:
                    response = requests.post(LM_STUDIO_URL, json=payload, timeout=30)
                    if response.status_code == 200:
                        answer = response.json()['choices'][0]['message']['content']
                        
                        # Beam the answer back to Firebase
                        doc.reference.update({
                            'status': 'COMPLETED',
                            'response': answer,
                            'completed_at': firestore.SERVER_TIMESTAMP
                        })
                        print(f"[+] Task {doc.id} resolved. Answer beamed to cloud.")
                    else:
                        doc.reference.update({'status': 'FAILED'})
                        print(f"[-] LM Studio rejected the payload: HTTP {response.status_code}")
                except requests.exceptions.RequestException as e:
                    doc.reference.update({'status': 'FAILED_LOCAL_OFFLINE'})
                    print(f"[!] Local Qwen server is offline or unreachable: {e}")
                    
        except Exception as e:
            print(f"[!] Firebase Sync Error: {e}")
            
        # The heartbeat of the Oracle. Polls every 2 seconds.
        time.sleep(2)

if __name__ == "__main__":
    process_queue()
