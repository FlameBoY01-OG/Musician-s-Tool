import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function Dashboard() {
  const [prep, setPrep] = useState(null);
  const [history, setHistory] = useState([]);
  const [evaluation, setEvaluation] = useState(null);

  useEffect(() => {
    const fetchStatus = () => {
      fetch('/api/system-status')
        .then(res => res.json())
        .then(data => {
          setPrep(data.preprocessing);
          setHistory(data.training || []);
          setEvaluation(data.evaluation);
        })
        .catch(err => console.error(err));
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const getPrepUI = () => {
    if (!prep || prep.status === 'not_started') {
      return { text: "Not started. Run `python run_pipeline.py`", percent: 0, color: 'var(--accent-color)' };
    }
    if (prep.status === 'loading') {
      return { text: prep.current_track || "Loading MUSDB18 dataset into memory...", percent: 5, color: 'var(--text-muted)' };
    }
    const percent = prep.total > 0 ? (prep.current / prep.total) * 100 : 0;
    if (prep.status === 'completed') {
      return { text: `Completed! Processed ${prep.total} tracks.`, percent: 100, color: '#10B981' };
    }
    return { text: `Processing: ${prep.current} / ${prep.total} (${Math.round(percent)}%) - ${prep.current_track || ''}`, percent, color: 'var(--accent-color)' };
  };

  const prepUI = getPrepUI();

  const chartData = {
    labels: history.map(h => `Epoch ${h.epoch}`),
    datasets: [
      {
        label: 'Train Loss',
        data: history.map(h => h.train_loss),
        borderColor: '#7C3AED',
        backgroundColor: 'rgba(124, 58, 237, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Validation Loss',
        data: history.map(h => h.val_loss),
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#f3f4f6' } }
    },
    scales: {
      x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.1)' } },
      y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.1)' } }
    }
  };

  return (
    <>
      <h2 className="text-center">System Dashboard</h2>
      <p className="text-center text-muted">Monitor preprocessing, training, and evaluation metrics.</p>
      
      <div className="dashboard-grid">
        <div className="glass-card">
          <h3>1. Data Preprocessing (Train Set)</h3>
          <p className="text-muted">{prepUI.text}</p>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${prepUI.percent}%`, background: prepUI.color }}></div>
          </div>
          <p style={{ fontSize: '0.8rem', marginTop: '1rem', color: 'var(--text-muted)' }}>Processes the 100 MUSDB18 'train' tracks.</p>
        </div>
        
        <div className="glass-card">
          <h3>2. Model Training (90/10 Split)</h3>
          <p className="text-muted">
            {history.length > 0 ? `Training in progress... Currently on Epoch ${history[history.length - 1].epoch}.` : "Waiting for data..."}
          </p>
          <div style={{ width: '100%', height: '250px' }}>
            {history.length > 0 ? <Line data={chartData} options={chartOptions} /> : null}
          </div>
        </div>

        <div className="glass-card" style={{ gridColumn: '1 / -1' }}>
          <h3>3. Final Evaluation Metrics (Test Set)</h3>
          {!evaluation ? (
            <p className="text-muted">Model has not been evaluated yet. Run `python run_pipeline.py` to train and evaluate.</p>
          ) : (
            <div style={{ marginTop: '1rem' }}>
              <div className="metric-badge">
                <h4>Average SDR</h4>
                <span>{evaluation.sdr ? evaluation.sdr.toFixed(2) : "0.0"}</span>
              </div>
              <div className="metric-badge">
                <h4>Average SIR</h4>
                <span>{evaluation.sir ? evaluation.sir.toFixed(2) : "0.0"}</span>
              </div>
              <div className="metric-badge">
                <h4>Average SAR</h4>
                <span>{evaluation.sar ? evaluation.sar.toFixed(2) : "0.0"}</span>
              </div>
            </div>
          )}
          <p style={{ fontSize: '0.8rem', marginTop: '1rem', color: 'var(--text-muted)' }}>Evaluated on the 50 isolated MUSDB18 'test' tracks.</p>
        </div>
      </div>
    </>
  );
}

export default Dashboard;