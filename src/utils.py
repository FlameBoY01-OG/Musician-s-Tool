import torch
import librosa
import numpy as np
import matplotlib.pyplot as plt
import io
import soundfile as sf

def compute_stft(audio, n_fft=4096, hop_length=1024):
    """
    Computes STFT using librosa.
    audio shape: (channels, samples)
    Returns: complex STFT of shape (channels, freq_bins, frames)
    """
    if audio.ndim == 1:
        audio = np.expand_dims(audio, 0)
    stfts = [librosa.stft(audio[c], n_fft=n_fft, hop_length=hop_length, window='hann') for c in range(audio.shape[0])]
    return np.stack(stfts, axis=0)

def compute_istft(stft_matrix, hop_length=1024, length=None):
    """
    Computes ISTFT using librosa.
    stft_matrix shape: (channels, freq_bins, frames)
    Returns: waveform of shape (channels, samples)
    """
    if stft_matrix.ndim == 2:
        stft_matrix = np.expand_dims(stft_matrix, 0)
    audios = [librosa.istft(stft_matrix[c], hop_length=hop_length, window='hann', length=length) for c in range(stft_matrix.shape[0])]
    return np.stack(audios, axis=0)

def save_audio(path, audio, sr=44100):
    """
    Save audio to file.
    audio shape: (channels, samples)
    """
    sf.write(path, audio.T, sr)

def load_audio(path, sr=44100, mono=False):
    """
    Load audio from file.
    Returns: audio shape (channels, samples), sr
    """
    audio, sr = librosa.load(path, sr=sr, mono=mono)
    if audio.ndim == 1:
        audio = np.expand_dims(audio, 0)
    return audio, sr

def generate_spectrogram_image(audio, sr=44100):
    """
    Generate a base64 or bytes image of the spectrogram for the web visualizer.
    """
    if audio.ndim > 1:
        audio = audio.mean(axis=0) # convert to mono for visualization
    
    S = librosa.feature.melspectrogram(y=audio, sr=sr, n_mels=128)
    S_dB = librosa.power_to_db(S, ref=np.max)
    
    plt.figure(figsize=(10, 4))
    librosa.display.specshow(S_dB, sr=sr, x_axis='time', y_axis='mel', cmap='magma')
    plt.axis('off')
    plt.tight_layout(pad=0)
    
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', pad_inches=0, transparent=True)
    plt.close()
    buf.seek(0)
    return buf.read()
