document.addEventListener('DOMContentLoaded', () => {
    const ctx = document.getElementById('lossChart').getContext('2d');
    let lossChart;

    const prepStatusText = document.getElementById('prepStatusText');
    const prepProgressBar = document.getElementById('prepProgressBar');
    const trainStatusText = document.getElementById('trainStatusText');
    const evalStatusText = document.getElementById('evalStatusText');
    const evalMetrics = document.getElementById('evalMetrics');

    function fetchSystemStatus() {
        fetch('/api/system-status')
            .then(res => res.json())
            .then(data => {
                updatePreprocessing(data.preprocessing);
                updateTraining(data.training);
                updateEvaluation(data.evaluation);
            })
            .catch(err => console.error("Error fetching system status", err));
    }

    function updatePreprocessing(prep) {
        if (!prep || prep.status === 'not_started') {
            prepStatusText.textContent = "Not started. Run `python run_pipeline.py`";
            prepProgressBar.style.width = "0%";
            return;
        }

        if (prep.status === 'loading') {
            prepStatusText.textContent = prep.current_track || "Loading MUSDB18 dataset into memory... this can take a minute.";
            prepProgressBar.style.width = "5%";
            prepProgressBar.style.background = 'var(--text-muted)';
            return;
        }
        
        const percent = prep.total > 0 ? (prep.current / prep.total) * 100 : 0;
        prepProgressBar.style.width = percent + "%";
        
        if (prep.status === 'completed') {
            prepStatusText.textContent = `Completed! Processed ${prep.total} tracks.`;
            prepProgressBar.style.background = '#10B981'; // Green
        } else {
            prepStatusText.textContent = `Processing: ${prep.current} / ${prep.total} (${Math.round(percent)}%) - ${prep.current_track || ''}`;
            prepProgressBar.style.background = 'var(--accent-color)';
        }
    }

    function updateTraining(history) {
        if (!history || history.length === 0) {
            trainStatusText.textContent = "Not started. Run `python -m src.train` after preprocessing.";
            return;
        }

        const lastEpoch = history[history.length - 1];
        trainStatusText.textContent = `Training in progress... Currently on Epoch ${lastEpoch.epoch}.`;

        const labels = history.map(h => `Epoch ${h.epoch}`);
        const trainLoss = history.map(h => h.train_loss);
        const valLoss = history.map(h => h.val_loss);

        if (lossChart) {
            lossChart.data.labels = labels;
            lossChart.data.datasets[0].data = trainLoss;
            lossChart.data.datasets[1].data = valLoss;
            lossChart.update();
        } else {
            lossChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Train Loss',
                            data: trainLoss,
                            borderColor: '#7C3AED',
                            backgroundColor: 'rgba(124, 58, 237, 0.1)',
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: 'Validation Loss',
                            data: valLoss,
                            borderColor: '#10B981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            fill: true,
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#f3f4f6' } }
                    },
                    scales: {
                        x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                        y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.1)' } }
                    }
                }
            });
        }
    }

    function updateEvaluation(evaluation) {
        if (!evaluation) {
            return;
        }
        
        evalStatusText.classList.add('hidden');
        evalMetrics.classList.remove('hidden');
        
        document.getElementById('metricSDR').textContent = evaluation.sdr ? evaluation.sdr.toFixed(2) : "0.0";
        document.getElementById('metricSIR').textContent = evaluation.sir ? evaluation.sir.toFixed(2) : "0.0";
        document.getElementById('metricSAR').textContent = evaluation.sar ? evaluation.sar.toFixed(2) : "0.0";
    }

    fetchSystemStatus();
    setInterval(fetchSystemStatus, 3000);
});