import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function Waveform({ audioBuffer }) {
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

const formatTime = (time) => {
  if (isNaN(time)) return "0:00";
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

function Separate() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [buffers, setBuffers] = useState({});
  const [playingStems, setPlayingStems] = useState({ vocals: false, accompaniment: false });
  const [progress, setProgress] = useState({ vocals: 0, accompaniment: 0 });
  
  // Audio state refs
  const audioCtxRef = useRef(null);
  const gainNodesRef = useRef({});
  const sourcesRef = useRef({});
  const startTimeRef = useRef({ vocals: 0, accompaniment: 0 });
  const pausedAtRef = useRef({ vocals: 0, accompaniment: 0 });
  const animationRef = useRef({ vocals: null, accompaniment: null });

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
            
            // Initialize with current controls state
            let initialVol = controls[stem] ? controls[stem].vol : 1;
            if (controls[stem] && controls[stem].mute) initialVol = 0;
            gainNode.gain.value = initialVol;
            
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
        const animRefs = animationRef.current;
        Object.keys(animRefs).forEach(key => cancelAnimationFrame(animRefs[key]));
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

  const playStem = (stem, startTime = pausedAtRef.current[stem] || 0) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    if (ctx.state === 'suspended') {
        ctx.resume();
    }
    
    if (sourcesRef.current[stem]) {
        sourcesRef.current[stem].onended = null;
        try { sourcesRef.current[stem].stop(); } catch (err) { console.debug('Stop ignored', err); }
        sourcesRef.current[stem].disconnect();
    }
    cancelAnimationFrame(animationRef.current[stem]);

    const source = ctx.createBufferSource();
    source.buffer = buffers[stem];
    source.connect(gainNodesRef.current[stem]);
    source.start(0, startTime);
    sourcesRef.current[stem] = source;
    
    // Handle end
    source.onended = () => {
        setPlayingStems(prev => ({ ...prev, [stem]: false }));
        pausedAtRef.current[stem] = 0;
        setProgress(prev => ({ ...prev, [stem]: 0 }));
        cancelAnimationFrame(animationRef.current[stem]);
    };
    
    startTimeRef.current[stem] = ctx.currentTime - startTime;
    pausedAtRef.current[stem] = startTime;
    setPlayingStems(prev => ({ ...prev, [stem]: true }));
    
    const updateProgress = () => {
        if (audioCtxRef.current) {
            const currentProgress = audioCtxRef.current.currentTime - startTimeRef.current[stem];
            if (currentProgress <= buffers[stem].duration) {
                setProgress(prev => ({ ...prev, [stem]: currentProgress }));
                animationRef.current[stem] = requestAnimationFrame(updateProgress);
            }
        }
    };
    animationRef.current[stem] = requestAnimationFrame(updateProgress);
  };

  const pauseStem = (stem) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    if (sourcesRef.current[stem]) {
        sourcesRef.current[stem].onended = null;
        try { sourcesRef.current[stem].stop(); } catch (err) { console.debug('Stop ignored', err); }
        sourcesRef.current[stem].disconnect();
    }
    cancelAnimationFrame(animationRef.current[stem]);
    
    pausedAtRef.current[stem] = ctx.currentTime - startTimeRef.current[stem];
    setPlayingStems(prev => ({ ...prev, [stem]: false }));
  };

  const togglePlayStem = (stem) => {
    if (playingStems[stem]) pauseStem(stem);
    else playStem(stem);
  };

  const handleSeek = (stem, time) => {
    setProgress(prev => ({ ...prev, [stem]: time }));
    pausedAtRef.current[stem] = time;
    if (playingStems[stem]) {
        playStem(stem, time);
    }
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
              <div className="stem-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button 
                    className="btn-primary" 
                    onClick={() => togglePlayStem(stem)}
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    {playingStems[stem] ? 'Pause' : 'Play'}
                  </button>
                  <h3 style={{ textTransform: 'capitalize', margin: 0 }}>{stem}</h3>
                </div>
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
                    title="Volume"
                  />
                </div>
              </div>
              <Waveform audioBuffer={buffers[stem]} />
              
              {/* Progress Slider */}
              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{formatTime(progress[stem])}</span>
                <input 
                  type="range" 
                  min="0" 
                  max={buffers[stem]?.duration || 100} 
                  step="0.01" 
                  value={progress[stem] || 0}
                  onChange={(e) => handleSeek(stem, parseFloat(e.target.value))}
                  style={{ flex: 1, cursor: 'pointer' }}
                  title="Seek"
                />
                <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{formatTime(buffers[stem]?.duration || 0)}</span>
              </div>
            </div>
          ))}
          
          <div className="text-center" style={{ marginTop: '2rem' }}>
            <button className="btn-primary" onClick={() => navigate('/')} style={{ padding: '0.8rem 1.5rem', fontSize: '1.1rem' }}>
              Separate Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Separate;