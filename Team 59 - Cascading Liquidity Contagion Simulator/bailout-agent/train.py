import torch
import torch.nn as nn
import torch.optim as optim
from environment import FinancialContagionEnv
import numpy as np
import os

class PolicyNetwork(nn.Module):
    def __init__(self, obs_dim, action_dim):
        super(PolicyNetwork, self).__init__()
        self.fc = nn.Sequential(
            nn.Linear(obs_dim, 128),
            nn.ReLU(),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, action_dim),
            nn.Softmax(dim=-1)
        )

    def forward(self, x):
        return self.fc(x)

def train():
    env = FinancialContagionEnv(nodes=10)
    obs_dim = env.observation_space.shape[0]
    action_dim = env.action_space.shape[0]
    
    model = PolicyNetwork(obs_dim, action_dim)
    optimizer = optim.Adam(model.parameters(), lr=1e-3)
    
    print("Starting Training...")
    
    for episode in range(100):
        obs, _ = env.reset()
        done = False
        total_reward = 0
        
        while not done:
            obs_tensor = torch.FloatTensor(obs).unsqueeze(0)
            action_probs = model(obs_tensor)
            
            # Simple policy gradient / REINFORCE logic
            action = action_probs.detach().numpy().flatten()
            
            next_obs, reward, terminated, truncated, _ = env.step(action)
            done = terminated or truncated
            
            # Optimization step (simplified for placeholder)
            loss = -torch.log(action_probs).mean() * reward
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            
            obs = next_obs
            total_reward += reward
            
        if episode % 10 == 0:
            print(f"Episode {episode} | Total Reward: {total_reward:.2f}")

    # Export to ONNX
    print("Exporting model to ONNX...")
    dummy_input = torch.randn(1, obs_dim)
    torch.onnx.export(model, dummy_input, "bailout_policy.onnx", 
                      input_names=['observation'], 
                      output_names=['action_probs'],
                      dynamic_axes={'observation': {0: 'batch_size'}})
    print("Model saved to bailout_policy.onnx")

if __name__ == "__main__":
    train()
