#!/usr/bin/env python3
"""
Ember Tokenomics Simulation for Hard-Capped Micro-Supply (10,000 EMBER)
"""

from decimal import Decimal, getcontext
import sys

# Set precision high enough to handle micro fractions
getcontext().prec = 28

TOTAL_SUPPLY = Decimal('10000')  # Hard cap of 10,000 EMBER

class Treasury:
    def __init__(self):
        self.balance = TOTAL_SUPPLY  # Start with all tokens in treasury
        self.total_minted = TOTAL_SUPPLY  # Track what has been minted (should never exceed cap)
        self.total_burned = Decimal('0')
    
    def mint(self, amount):
        """Mint tokens, but only if within hard cap."""
        if self.total_minted + amount > TOTAL_SUPPLY:
            raise ValueError(f"Hard cap exceeded: would mint {self.total_minted + amount} > {TOTAL_SUPPLY}")
        self.total_minted += amount
        self.balance += amount
        return amount
    
    def burn(self, amount):
        """Burn tokens from treasury."""
        if amount > self.balance:
            raise ValueError(f"Insufficient balance: {self.balance} < {amount}")
        self.balance -= amount
        self.total_burned += amount
        return amount
    
    def transfer(self, amount, recipient):
        """Transfer tokens from treasury to recipient."""
        if amount > self.balance:
            raise ValueError(f"Insufficient balance: {self.balance} < {amount}")
        self.balance -= amount
        recipient.balance += amount
        return amount

class Agent:
    def __init__(self, name):
        self.name = name
        self.balance = Decimal('0')
    
    def receive(self, amount):
        self.balance += amount
        return amount
    
    def send(self, amount):
        if amount > self.balance:
            raise ValueError(f"Insufficient balance: {self.balance} < {amount}")
        self.balance -= amount
        return amount

def bellows_mechanic(world_heat, treasury, agent=None):
    """
    Simplified Bellows mechanic:
    - If world_heat > threshold, burn a fraction of EMBER.
    - Else, yield a fraction back to active stewards (agent).
    For simulation, we'll use a simple burn rate of 0.000001 per unit of heat above 100.
    And yield rate of 0.0000005 per unit of heat below 100.
    """
    threshold = Decimal('100')
    if world_heat > threshold:
        excess = world_heat - threshold
        burn_amount = excess * Decimal('0.000001')
        if burn_amount > treasury.balance:
            burn_amount = treasury.balance  # Don't burn more than we have
        treasury.burn(burn_amount)
        return (-burn_amount, "burned")
    else:
        deficit = threshold - world_heat
        yield_amount = deficit * Decimal('0.0000005')
        # In this sim, we assume there's an agent to yield to; if not, just hold in treasury?
        # For simplicity, we'll just add to treasury (as if yield goes to treasury for redistribution)
        treasury.balance += yield_amount
        return (yield_amount, "yielded")

def run_tests():
    print("=== Ember Micro-Supply Tokenomics Simulation ===")
    print(f"Hard cap supply: {TOTAL_SUPPLY} EMBER\n")
    
    # Test 1: The Faucet Drain
    print("Test 1: Faucet Drain - 100,000 users claiming 0.01 EMBER welcome bounty")
    treasury = Treasury()
    welcome_bounty = Decimal('0.01')
    num_users = 100000
    successful_claims = 0
    for i in range(num_users):
        if treasury.balance >= welcome_bounty:
            treasury.transfer(welcome_bounty, Agent(f"user_{i}"))
            successful_claims += 1
        else:
            # Not enough tokens, reduce bounty dynamically? We'll just stop.
            print(f"  Treasury depleted after {successful_claims} claims.")
            break
    else:
        print(f"  All {num_users} users received welcome bounty.")
    print(f"  Remaining treasury balance: {treasury.balance}")
    print(f"  Total distributed: {successful_claims * welcome_bounty}")
    print(f"  Total supply in circulation: {TOTAL_SUPPLY - treasury.balance}\n")
    
    # Test 2: Inflation Test
    print("Test 2: Inflation Test - Attempt to exceed hard cap")
    treasury2 = Treasury()
    try:
        # Try to mint 1 more token
        treasury2.mint(Decimal('1'))
        print("  ERROR: Hard cap was exceeded!")
        return False
    except ValueError as e:
        print(f"  SUCCESS: Hard cap held - {e}")
    print(f"  Treasury balance: {treasury2.balance}")
    print(f"  Total minted: {treasury2.total_minted}\n")
    
    # Test 3: Floating Point Safety
    print("Test 3: Floating Point Safety - 1,000,000 micro-transactions of 0.000001 EMBER")
    treasury3 = Treasury()
    alice = Agent("Alice")
    bob = Agent("Bob")
    # Start with some tokens in treasury, give to Alice
    treasury3.transfer(Decimal('10'), alice)  # Alice gets 10 EMBER
    micro_amount = Decimal('0.000001')
    transactions = 1000000
    for i in range(transactions):
        if i % 2 == 0:
            # Alice to Bob
            sent = alice.send(micro_amount)
            bob.receive(sent)
        else:
            # Bob to Alice
            sent = bob.send(micro_amount)
            alice.receive(sent)
    # Calculate total tokens held by Alice and Bob
    total_held = alice.balance + bob.balance
    # Treasury should have the rest
    expected_total = TOTAL_SUPPLY
    print(f"  Alice balance: {alice.balance}")
    print(f"  Bob balance: {bob.balance}")
    print(f"  Total held by agents: {total_held}")
    print(f"  Treasury balance: {treasury3.balance}")
    print(f"  Sum of all: {total_held + treasury3.balance}")
    if abs((total_held + treasury3.balance) - expected_total) < Decimal('0.0000001'):
        print("  SUCCESS: No tokens lost or created.")
    else:
        print("  ERROR: Token imbalance detected!")
        return False
    print()
    
    # Final distribution report
    print("=== Final Token Distribution ===")
    print(f"Total Supply: {TOTAL_SUPPLY} EMBER")
    print(f"Treasury Vault: {treasury3.balance} EMBER")
    print(f"Alice (Agent): {alice.balance} EMBER")
    print(f"Bob (Agent): {bob.balance} EMBER")
    print(f"Total Accounted: {treasury3.balance + alice.balance + bob.balance} EMBER")
    
    return True

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)