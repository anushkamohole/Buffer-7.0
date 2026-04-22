import gymnasium as gym
from gymnasium import spaces
import numpy as np

class FinancialContagionEnv(gym.Env):
    """
    Gymnasium environment for optimizing bailout strategies.
    State: Current capital of all banks, systemic instability score.
    Action: Amount of liquidity to inject into each bank (bailout fund allocation).
    Reward: Negative of total systemic loss (maximize survival/minimize loss).
    """
    def __init__(self, nodes=10, total_bailout_fund=100.0):
        super(FinancialContagionEnv, self).__init__()
        self.n = nodes
        self.total_bailout_fund = total_bailout_fund
        
        # Action space: % of bailout fund allocated to each bank (normalized to 1)
        self.action_space = spaces.Box(low=0, high=1, shape=(self.n,), dtype=np.float32)
        
        # Observation space: [current_capital_normalized, exposure_density, sis]
        # For simplicity, we use (n banks * 2 metrics) + 1 (SIS)
        self.observation_space = spaces.Box(low=-1, high=10, shape=(self.n * 2 + 1,), dtype=np.float32)

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        
        # Initialize bank network (synthetic for training)
        self.capitals = np.random.uniform(5, 50, size=self.n)
        self.liabilities = np.random.uniform(0, 10, size=(self.n, self.n))
        np.fill_diagonal(self.liabilities, 0)
        
        # Initial systemic instability (mock)
        self.sis = 0.4
        
        state = self._get_obs()
        return state, {}

    def _get_obs(self):
        # Concatenate normalized capitals and other metrics
        normalized_capitals = self.capitals / 50.0
        exposure_density = np.sum(self.liabilities, axis=1) / 100.0
        return np.concatenate([normalized_capitals, exposure_density, [self.sis]]).astype(np.float32)

    def step(self, action):
        # 1. Normalize actions to sum to total_bailout_fund
        allocation = action / (np.sum(action) + 1e-9)
        injection = allocation * self.total_bailout_fund
        
        # 2. Apply Bailout
        self.capitals += injection
        
        # 3. Simulate Shock (e.g., node 0 loses capital)
        self.capitals[0] -= 40.0
        
        # 4. Simple Contagion Step (Mock for Python environment)
        # In practice, this would call the WASM core or the Rust logic
        losses = np.zeros(self.n)
        for i in range(self.n):
            if self.capitals[i] < 0:
                # Distribute losses to creditors
                for j in range(self.n):
                    impact = (self.liabilities[j, i] / (np.sum(self.liabilities[:, i]) + 1e-9)) * abs(self.capitals[i])
                    losses[j] += impact
        
        self.capitals -= losses
        
        # 5. Calculate Reward
        total_systemic_loss = np.sum(np.maximum(0, losses))
        defaults = np.sum(self.capitals < 0)
        
        reward = -(total_systemic_loss * 0.5 + defaults * 10.0)
        
        terminated = defaults > (self.n // 2) or np.all(losses < 0.1)
        truncated = False
        
        self.sis = np.clip(defaults / self.n, 0, 1)
        
        return self._get_obs(), reward, terminated, truncated, {}

    def render(self):
        print(f"Systemic Risk SIS: {self.sis:.2f} | Survival: {np.sum(self.capitals > 0)}/{self.n}")
