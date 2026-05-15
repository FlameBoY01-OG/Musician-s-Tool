document.addEventListener('DOMContentLoaded', async () => {
    if (typeof JOB_ID === 'undefined') return;

    const playerContainer = document.getElementById('playerContainer');
    const loadingResults = document.getElementById('loadingResults');
    const btnPlayPause = document.getElementById('btnPlayPause');
    
    let audioContext;
    let sources = {};
    let gainNodes = {};
    let buffers = {};
    let isPlaying = false;
    let startTime = 0;
    let pausedAt = 0;

    try {
        const response = await fetch(`/api/results/${JOB_ID}`);
        if (!response.ok) throw new Error("Failed to load results");
        const urls = await response.json();
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Fetch and decode audio
        for (const [stem, url] of Object.entries(urls)) {
            const res = await fetch(url);
            const arrayBuffer = await res.arrayBuffer();
            buffers[stem] = await audioContext.decodeAudioData(arrayBuffer);
            
            // Setup gain node
            gainNodes[stem] = audioContext.createGain();
            gainNodes[stem].connect(audioContext.destination);
            
            // Draw waveform
            if(window.drawWaveform) {
               window.drawWaveform(`canvas${stem.charAt(0).toUpperCase() + stem.slice(1)}`, buffers[stem]);
            }
        }
        
        loadingResults.classList.add('hidden');
        playerContainer.classList.remove('hidden');
        setupControls();
        
    } catch (err) {
        console.error(err);
        loadingResults.innerHTML = `<p style="color:#ef4444">Error loading audio stems.</p>`;
    }

    function setupControls() {
        btnPlayPause.addEventListener('click', togglePlay);
        
        document.querySelectorAll('.btn-mute').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target.dataset.target;
                e.target.classList.toggle('active');
                updateVolumes();
            });
        });

        document.querySelectorAll('.btn-solo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.classList.toggle('active');
                updateVolumes();
            });
        });

        document.querySelectorAll('.vol-slider').forEach(slider => {
            slider.addEventListener('input', updateVolumes);
        });
    }
    
    function updateVolumes() {
        const anySolo = Array.from(document.querySelectorAll('.btn-solo')).some(b => b.classList.contains('active'));
        
        for (const stem in gainNodes) {
            const muteBtn = document.querySelector(`.btn-mute[data-target="${stem}"]`);
            const soloBtn = document.querySelector(`.btn-solo[data-target="${stem}"]`);
            const slider = document.querySelector(`.vol-slider[data-target="${stem}"]`);
            
            let vol = parseFloat(slider.value);
            
            if (muteBtn.classList.contains('active')) {
                vol = 0;
            }
            if (anySolo && !soloBtn.classList.contains('active')) {
                vol = 0;
            }
            
            gainNodes[stem].gain.value = vol;
        }
    }

    function togglePlay() {
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    }

    function play() {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        for (const stem in buffers) {
            sources[stem] = audioContext.createBufferSource();
            sources[stem].buffer = buffers[stem];
            sources[stem].connect(gainNodes[stem]);
            sources[stem].start(0, pausedAt);
        }
        
        startTime = audioContext.currentTime - pausedAt;
        isPlaying = true;
        btnPlayPause.textContent = 'Pause';
    }

    function pause() {
        for (const stem in sources) {
            if (sources[stem]) {
                sources[stem].stop();
                sources[stem].disconnect();
            }
        }
        pausedAt = audioContext.currentTime - startTime;
        isPlaying = false;
        btnPlayPause.textContent = 'Play';
    }
});