import React from 'react';

function About() {
  return (
    <div className="glass-card">
      <h2>About The Project</h2>
      <p><strong>Musician's Tool</strong> is a deep-learning powered web application that separates music into stems (vocals and accompaniment).</p>
      
      <h3 style={{ color: 'var(--accent-color)', marginTop: '2rem' }}>Architecture</h3>
      <ul>
        <li><strong>Dataset:</strong> MUSDB18 (150 tracks total).</li>
        <li><strong>Preprocessing:</strong> Audio is converted to Short-Time Fourier Transform (STFT) magnitude spectrograms using a 4096-bin FFT and 1024-sample hop length.</li>
        <li><strong>Model:</strong> A U-Net architecture with 6 levels of encoder/decoder pairs and skip connections, estimating a soft mask for the target stem.</li>
        <li><strong>Reconstruction:</strong> The soft mask is applied to the mixture magnitude spectrogram. Inverse STFT is performed using the original mixture phase.</li>
        <li><strong>Frontend:</strong> Rebuilt using React, Vite, and React Router.</li>
      </ul>
    </div>
  );
}

export default About;