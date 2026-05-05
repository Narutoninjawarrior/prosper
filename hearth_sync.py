import socket
import os
import time

# Prosper2: JSONL Sync Mechanism
MEMORY_FILE = "d:\\Hearth\\prosper2\\hearth.jsonl"

def sync_to_web():
    """
    Pushes the local hearth.jsonl to termbin.com via plain TCP socket.
    This bypasses all SSL/Certificate issues.
    """
    print(f"[{time.strftime('%H:%M:%S')}] Initiating Socket Sync (Termbin)...")
    
    if not os.path.exists(MEMORY_FILE):
        print(f"Error: hearth.jsonl not found at {MEMORY_FILE}")
        return
    
    try:
        with open(MEMORY_FILE, 'rb') as f:
            data = f.read()
            
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(10)
        
        sock.connect(("termbin.com", 9999))
        sock.sendall(data)
        
        response = sock.recv(1024).decode().strip()
        sock.close()
        
        if "http" in response:
            print(f"[{time.strftime('%H:%M:%S')}] Sync Successful!")
            print(f"Hearth URL: {response}")
            
            with open("bridge_url.txt", "w") as f:
                f.write(response)
            return response
        else:
            print(f"Sync failed. Response: {response}")
            return None
            
    except Exception as e:
        print(f"Critical Socket Failure: {e}")
        return None

if __name__ == "__main__":
    sync_to_web()
