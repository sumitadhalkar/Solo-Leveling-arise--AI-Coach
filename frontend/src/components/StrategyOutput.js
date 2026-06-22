export default function StrategyOutput({ strategy }) {
  if (strategy.parse_error) {
    return (
      <div className="strategy">
        <div className="strategy-section">
          <h3>Raw Response</h3>
          <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontSize: 12 }}>
            {strategy.raw_response}
          </pre>
        </div>
      </div>
    );
  }

  const {
    recommended_team,
    why,
    rotation,
    artifacts_advice,
    mistakes_to_avoid,
    expected_clear_rate,
    battle_power_assessment,
  } = strategy;

  return (
    <div className="strategy">

      <div className="strategy-section">
        <h3>Recommended Team</h3>
        <div className="team-chips">
          {(recommended_team?.hunters || []).map((name) => (
            <span className="team-chip" key={name}>{name}</span>
          ))}
        </div>
        {recommended_team?.reasoning && (
          <p className="strategy-text">{recommended_team.reasoning}</p>
        )}
      </div>

      {why && (
        <div className="strategy-section">
          <h3>Why This Works</h3>
          <p className="strategy-text">{why}</p>
        </div>
      )}

      {rotation?.steps?.length > 0 && (
        <div className="strategy-section">
          <h3>Rotation</h3>
          <ul className="rotation-steps">
            {rotation.steps.map((step, i) => (
              <li key={i}>
                <span className="step-num">{i + 1}</span>
                <span className="strategy-text">{step.replace(/^\d+\.\s*/, '')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {artifacts_advice && (
        <div className="strategy-section">
          <h3>Artifacts &amp; Gear</h3>
          <p className="strategy-text">{artifacts_advice}</p>
        </div>
      )}

      {mistakes_to_avoid?.length > 0 && (
        <div className="strategy-section">
          <h3>Common Mistakes to Avoid</h3>
          <ul className="mistakes-list">
            {mistakes_to_avoid.map((m, i) => (
              <li key={i} className="strategy-text">{m}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="strategy-section">
        <h3>Assessment</h3>
        <div className="meta-row">
          {expected_clear_rate && (
            <div className="meta-item">
              <label>Expected Clear Rate</label>
              <div className="value">{expected_clear_rate}</div>
            </div>
          )}
          {battle_power_assessment && (
            <div className="meta-item" style={{ flex: 1 }}>
              <label>Battle Power</label>
              <div className="desc">{battle_power_assessment}</div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
