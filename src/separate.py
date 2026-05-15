import argparse
import os
import torch
import numpy as np
import soundfile as sf
import datetime
from src.model import UNet
from src.utils import compute_stft, compute_istft, load_audio

def separate(audio_path, model_path='checkpoints/best_model.pth', out_dir=None, target='vocals'):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    
    if out_dir is None:
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        out_dir = os.path.join('web/results', timestamp)
    os.makedirs(out_dir, exist_ok=True)
    
    print(f"Loading audio from {audio_path}...")
    audio, sr = load_audio(audio_path, sr=44100)
    
    n_fft = 4096
    hop_length = 1024
    stft_matrix = compute_stft(audio, n_fft=n_fft, hop_length=hop_length)
    mix_mag = np.abs(stft_matrix)
    mix_phase = np.angle(stft_matrix)
    
    mix_mag_norm = np.log1p(mix_mag)
    
    in_channels = mix_mag_norm.shape[0]
    model = UNet(in_channels=in_channels, out_channels=in_channels).to(device)
    if os.path.exists(model_path):
        checkpoint = torch.load(model_path, map_location=device)
        model.load_state_dict(checkpoint['model_state_dict'])
    else:
        print("Warning: No trained model found, using random weights.")
    
    model.eval()
    
    num_frames = mix_mag_norm.shape[2]
    pad_frames = (64 - (num_frames % 64)) % 64
    if pad_frames > 0:
        mix_mag_norm = np.pad(mix_mag_norm, ((0, 0), (0, 0), (0, pad_frames)), mode='constant')
        
    chunk_frames = 256 # process in small chunks to avoid OOM
    est_masks = []
    
    with torch.no_grad():
        for i in range(0, mix_mag_norm.shape[2], chunk_frames):
            chunk = mix_mag_norm[:, :, i:i+chunk_frames]
            chunk_tensor = torch.from_numpy(chunk).float().unsqueeze(0).to(device)
            mask_tensor = model(chunk_tensor)
            mask = mask_tensor.squeeze(0).cpu().numpy()
            est_masks.append(mask)
            
    est_mask = np.concatenate(est_masks, axis=2)
    if pad_frames > 0:
        est_mask = est_mask[:, :, :-pad_frames]
        
    est_mag = est_mask * mix_mag
    est_stft = est_mag * np.exp(1j * mix_phase)
    
    est_audio = compute_istft(est_stft, hop_length=hop_length, length=audio.shape[1])
    acc_audio = audio - est_audio # Residual for accompaniment
    
    vocals_path = os.path.join(out_dir, 'vocals.wav')
    acc_path = os.path.join(out_dir, 'accompaniment.wav')
    
    sf.write(vocals_path, est_audio.T, sr)
    sf.write(acc_path, acc_audio.T, sr)
    
    print(f"Saved results to {out_dir}")
    return vocals_path, acc_path

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('input', type=str, help='Input audio file')
    parser.add_argument('--model', type=str, default='checkpoints/best_model.pth')
    parser.add_argument('--out-dir', type=str, default=None)
    args = parser.parse_args()
    separate(args.input, args.model, args.out_dir)
