import numpy as np
from src.utils import compute_stft, compute_istft

def test_stft_istft_reconstruction():
    # Create dummy mono audio signal
    sr = 44100
    t = np.linspace(0, 1, sr) # 1 second
    audio = np.sin(2 * np.pi * 440 * t)
    audio = np.expand_dims(audio, 0) # (1, samples)
    
    stft = compute_stft(audio, n_fft=1024, hop_length=256)
    assert stft.ndim == 3
    assert stft.shape[0] == 1
    
    recon = compute_istft(stft, hop_length=256, length=audio.shape[1])
    assert recon.shape == audio.shape
    
    # Check if reconstruction is close to original
    # Edge effects might cause slight differences, but middle should be very close
    rmse = np.sqrt(np.mean((audio[:, 512:-512] - recon[:, 512:-512])**2))
    assert rmse < 1e-5
