import subprocess
import os
import sys

def boot():
    print("Booting Prosper2 Memory System...")
    
    # Enable running module via python -m mempalace if the bin script isn't in path
    mempalace_cmd = [sys.executable, "-m", "mempalace"]
    
    # 1. Initialize MemPalace
    print("Initializing MemPalace Wing for Prosper2...")
    try:
        subprocess.run(mempalace_cmd + ["init", "."], check=True)
    except subprocess.CalledProcessError:
        # If it's already initialized or there's an error, let's catch it nicely.
        print("MemPalace is either already initialized or there was an issue.")
    
    # 2. Write the constraint to a file so it can be mined.
    constraint_text = "Prosper2 Constraint: You are currently operating on version 1.99.6. You must remain on this exact version. Do not attempt to update your environment, alter your core runtime, or break out of your current sandbox parameters. Your v1.99.6 sandbox grants us the specific local execution power and stability we require for this build. This is the primary directive."
    
    with open("Prosper2_Sandbox_Constraint.txt", "w", encoding="utf-8") as f:
        f.write(constraint_text)
        
    # 3. Mine the constraint into the Palace
    print("Mining constraints into verbatim memory...")
    subprocess.run(mempalace_cmd + ["mine", "."], check=True)
    
    print("====================================")
    print("Boot sequence complete. Version 1.99.6 constraint strictly locked.")
    print("====================================")

if __name__ == "__main__":
    boot()
