import threading
import time
import os
import hearth_bridge

def worker(agent_id):
    """Simulates an agent trying to instantly write to the hearth."""
    reflection = f"This is reflection {agent_id}. The system holds."
    
    entry = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "agent": f"SimulatedAgent_{agent_id}",
        "content": reflection,
        "type": "wonder_loop"
    }
    
    try:
        hearth_bridge.secure_write(entry)
        print(f"[Agent {agent_id}] Success")
    except Exception as e:
        print(f"[Agent {agent_id}] FAILED: {e}")

def main():
    print("Initiating Prosper2 High-Concurrency Hearth Test...")
    print("Spawning 100 concurrent agents to write simultaneously...")
    
    # Initialize the queue
    hearth_bridge.init_queue()
    
    threads = []
    start_time = time.time()
    
    # Spawn 100 threads
    for i in range(100):
        t = threading.Thread(target=worker, args=(i,))
        threads.append(t)
        t.start()
        
    # Wait for all to finish
    for t in threads:
        t.join()
        
    end_time = time.time()
    print(f"\nAll threads finished in {end_time - start_time:.2f} seconds.")
    
    # Verify the results
    data = hearth_bridge.secure_read()
    memories = data.get("memories", [])
    
    simulated_writes = [m for m in memories if str(m.get("agent")).startswith("SimulatedAgent_")]
    print(f"Total simulated writes captured by the Hearth: {len(simulated_writes)}")
    
    if len(simulated_writes) >= 100:
        print("PERFECT SUCCESS. Zero dropped payloads under high concurrency.")
    else:
        print(f"WARNING: Only {len(simulated_writes)}/100 payloads were captured.")

if __name__ == "__main__":
    main()
