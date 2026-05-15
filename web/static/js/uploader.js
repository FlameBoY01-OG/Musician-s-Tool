document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('uploadArea');
    const notReadyMessage = document.getElementById('notReadyMessage');
    const fileInput = document.getElementById('fileInput');
    const progressSection = document.getElementById('progressSection');
    const progressBar = document.getElementById('progressBar');
    const statusText = document.getElementById('statusText');
    const processingLoader = document.getElementById('processingLoader');

    if(!uploadArea) return;

    // Check if the system is fully trained and ready
    fetch('/api/is-ready')
        .then(res => res.json())
        .then(data => {
            if (!data.ready) {
                uploadArea.classList.add('hidden');
                if (notReadyMessage) notReadyMessage.classList.remove('hidden');
            }
        })
        .catch(err => console.error("Error checking system readiness:", err));

    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleUpload(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleUpload(e.target.files[0]);
        }
    });

    function handleUpload(file) {
        uploadArea.classList.add('hidden');
        progressSection.classList.remove('hidden');
        statusText.textContent = 'Uploading...';
        progressBar.style.width = '0%';

        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload', true);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = (e.loaded / e.total) * 100;
                progressBar.style.width = percent + '%';
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                statusText.textContent = 'Separating Audio... This may take a few minutes.';
                progressBar.style.width = '100%';
                progressBar.style.background = 'var(--text-muted)';
                processingLoader.classList.remove('hidden');
                pollStatus(response.job_id);
            } else {
                statusText.textContent = 'Upload failed. Please try again.';
                progressBar.style.background = '#ef4444';
            }
        };

        xhr.send(formData);
    }

    function pollStatus(jobId) {
        const interval = setInterval(() => {
            fetch(`/api/status/${jobId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'completed') {
                        clearInterval(interval);
                        window.location.href = `/separate/${jobId}`;
                    } else if (data.status === 'failed') {
                        clearInterval(interval);
                        statusText.textContent = 'Separation failed: ' + (data.error || 'Unknown error');
                        processingLoader.classList.add('hidden');
                    }
                })
                .catch(err => console.error('Error polling status:', err));
        }, 2000);
    }
});