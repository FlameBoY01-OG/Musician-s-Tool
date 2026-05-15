import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';

function Waveform({ stem, audioBuffer }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!audioBuffer || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;
    
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;
    
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    
    ctx.beginPath();
    ctx.moveTo(0, amp);
    
    for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
            const datum = data[(i * step) + j]; 
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        
        ctx.lineTo(i, (1 + min) * amp);
        ctx.lineTo(i, (1 + max) * amp);
    }
    
    ctx.strokeStyle = '#7C3AED';
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [audioBuffer]);

  return <canvas ref={canvasRef} className="waveform" />;
}

function Separate() {
  const { jobId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [buffers, setBuffers] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Audio state refs
  const audioCtxRef = useRef(null);
  const gainNodesRef = useRef({});
  const sourcesRef = useRef({});
  const startTimeRef = useRef(0);
  const pausedAtRef = useRef(0);

  // Controls state
  const [controls, setControls] = useState({
    vocals: { mute: false, solo: false, vol: 1 },
    accompaniment: { mute: false, solo: false, vol: 1 }
  });

  useEffect(() => {
    const loadAudio = async () => {
      try {
        const response = await fetch(`/api/results/${jobId}`);
        if (!response.ok) throw new Error("Failed to load results");
        const urls = await response.json();
        
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = ctx;
        
        const loadedBuffers = {};
        for (const [stem, url] of Object.entries(urls)) {
            const res = await fetch(url);
            const arrayBuffer = await res.arrayBuffer();
            loadedBuffers[stem] = await ctx.decodeAudioData(arrayBuffer);
            
            // Setup gain node
            const gainNode = ctx.createGain();
            gainNode.connect(ctx.destination);
            gainNodesRef.current[stem] = gainNode;
        }
        
        setBuffers(loadedBuffers);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError('Error loading audio stems.');
        setLoading(false);
      }
    };
    
    loadAudio();
    
    return () => {
      // Cleanup
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, [jobId]);

  useEffect(() => {
    // Update gain nodes when controls change
    const anySolo = Object.values(controls).some(c => c.solo);
    
    for (const stem in gainNodesRef.current) {
      if (!controls[stem]) continue;
      let vol = controls[stem].vol;
      
      if (controls[stem].mute) {
        vol = 0;
      }
      if (anySolo && !controls[stem].solo) {
        vol = 0;
      }
      
      gainNodesRef.current[stem].gain.value = vol;
    }
  }, [controls]);

  const togglePlay = () => {
    if (isPlaying) pause();
    else play();
  };

  const play = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    if (ctx.state === 'suspended') {
        ctx.resume();
    }
    
    for (const stem in buffers) {
        const source = ctx.createBufferSource();
        source.buffer = buffers[stem];
        source.connect(gainNodesRef.current[stem]);
        source.start(0, pausedAtRef.current);
        sourcesRef.current[stem] = source;
        
        // Handle end
        source.onended = () => {
            // Very simple end detection
            setIsPlaying(false);
            pausedAtRef.current = 0;
        };
    }
    
    startTimeRef.current = ctx.currentTime - pausedAtRef.current;
    setIsPlaying(true);
  };

  const pause = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    for (const stem in sourcesRef.current) {
        if (sourcesRef.current[stem]) {
            sourcesRef.current[stem].onended = null;
            sourcesRef.current[stem].stop();
            sourcesRef.current[stem].disconnect();
        }
    }
    pausedAtRef.current = ctx.currentTime - startTimeRef.current;
    setIsPlaying(false);
  };

  const updateControl = (stem, field, value) => {
    setControls(prev => ({
      ...prev,
      [stem]: { ...prev[stem], [field]: value }
    }));
  };

  return (
    <div className="glass-card">
      <h2 className="text-center">Separation Results</h2>
      
      {loading ? (
        <div className="text-center">
          <p>Loading stems...</p>
          <div className="loader"></div>
        </div>
      ) : error ? (
        <div className="text-center text-red-500">
          <p style={{ color: '#ef4444' }}>{error}</p>
        </div>
      ) : (
        <div className="player-container">
          {['vocals', 'accompaniment'].map(stem => (
            <div key={stem} className="stem-track">
              <div className="stem-header">
                <h3 style={{ textTransform: 'capitalize' }}>{stem}</h3>
                <div className="stem-controls">
                  <button 
                    className={controls[stem].mute ? 'active' : ''} 
                    onClick={() => updateControl(stem, 'mute', !controls[stem].mute)}
                  >Mute</button>
                  <button 
                    className={controls[stem].solo ? 'active' : ''} 
                    onClick={() => updateControl(stem, 'solo', !controls[stem].solo)}
                  >Solo</button>
                  <input 
                    type="range" 
                    className="vol-slider" 
                    min="0" max="1" step="0.01" 
                    value={controls[stem].vol} 
                    onChange={e => updateControl(stem, 'vol', parseFloat(e.target.value))} 
                  />
                </div>
              </div>
              <Waveform stem={stem} audioBuffer={buffers[stem]} />
            </div>
          ))}

          <div className="text-center" style={{ marginTop: '2rem' }}>
            <button className="btn-primary" onClick={togglePlay} style={{ padding: '1rem 2rem', fontSize: '1.2rem' }}>
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Separate;