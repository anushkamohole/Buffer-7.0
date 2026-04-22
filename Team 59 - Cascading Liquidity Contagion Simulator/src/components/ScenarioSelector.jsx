import { SCENARIOS } from '../engine/Scenarios';

export default function ScenarioSelector({ currentScenario, onSelect }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {SCENARIOS.map(s => {
        const isActive = currentScenario === s.id;
        return (
          <button
            key={s.id}
            className={`scenario-btn ${isActive ? 'active' : ''}`}
            onClick={() => onSelect(s.id)}
            title={s.description}
          >
            {s.icon} {s.name}
            {isActive && <span className="scenario-dot" />}
          </button>
        );
      })}
    </div>
  );
}
