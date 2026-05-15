import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UploadCloud } from 'lucide-react';

function Home() {
  const [isReady, setIsReady] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, uploading, separating, failed
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/is-ready')
      .then(res => res.json())
      .then(data => {
        setIsReady(data.ready);
      })
      .catch(err => console.error("Error checking readiness:", err));
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUpload(e.target.files[0]);
    }
  };

  const handleUpload = (file) => {
    setStatus('uploading');
    setProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = (e.loaded / e.total) * 100;
        setProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        setStatus('separating');
        pollStatus(response.job_id);
      } else {
        setStatus('failed');
        try {
          const res = JSON.parse(xhr.responseText);
          setErrorMsg(res.error || 'Upload failed.');
        } catch {
          setErrorMsg('Upload failed. Please try again.');
        }
      }
    };

    xhr.onerror = () => {
      setStatus('failed');
      setErrorMsg('Network error occurred.');
    };

    xhr.send(formData);
  };

  const pollStatus = (jobId) => {
    const interval = setInterval(() => {
      fetch(`/api/status/${jobId}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'completed') {
            clearInterval(interval);
            navigate(`/separate/${jobId}`);
          } else if (data.status === 'failed') {
            clearInterval(interval);
            setStatus('failed');
            setErrorMsg('Separation failed: ' + (data.error || 'Unknown error'));
          }
        })
        .catch(err => console.error('Error polling status:', err));
    }, 2000);
  };

  return (
    <div className="glass-card text-center">
      <h2>AI-Powered Vocal Remover</h2>
      <p className="text-muted">Upload any audio file to separate vocals and accompaniment.</p>

      {!isReady && (
        <div style={{ padding: '3rem', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px dashed var(--glass-border)', margin: '2rem 0' }}>
          <h3 style={{ color: 'var(--accent-color)' }}>Model Initialization Required</h3>
          <p>The AI model is currently undergoing training and evaluation. Audio separation will be unlocked once this process is complete.</p>
          <Link to="/training" className="btn-primary" style={{ display: 'inline-block', marginTop: '1rem' }}>View Live Dashboard</Link>
        </div>
      )}

      {isReady && status === 'idle' && (
        <div 
          className={`upload-area ${isDragging ? 'dragover' : ''}`}
          onClick={() => fileInputRef.current.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="audio/*" className="hidden" />
          <UploadCloud size={48} color="var(--accent-color)" style={{ marginBottom: '1rem' }} />
          <h3>Drag & Drop Audio File</h3>
          <p>or click to browse</p>
        </div>
      )}

      {status === 'uploading' && (
        <div style={{ margin: '2rem 0' }}>
          <p>Uploading...</p>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      {status === 'separating' && (
        <div style={{ margin: '2rem 0' }}>
          <p>Separating Audio... This may take a few minutes.</p>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: '100%', background: 'var(--text-muted)' }}></div>
          </div>
          <div className="loader" style={{ marginTop: '1rem' }}></div>
        </div>
      )}

      {status === 'failed' && (
        <div style={{ margin: '2rem 0', color: '#ef4444' }}>
          <p>{errorMsg}</p>
          <button className="btn-primary" onClick={() => setStatus('idle')} style={{ marginTop: '1rem' }}>Try Again</button>
        </div>
      )}
    </div>
  );
}

export default Home;