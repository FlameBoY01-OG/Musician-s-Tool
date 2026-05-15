import argparse
import os
import json
import numpy as np
import musdb
from tqdm import tqdm
from src.utils import compute_stft

def preprocess(args):
    os.makedirs('logs', exist_ok=True)
    status_file = 'logs/preprocess_status.json'
    
    # Immediately write 'loading' so the UI updates
    with open(status_file, 'w') as f:
        json.dump({"status": "loading", "current": 0, "total": 0, "current_track": "Loading MUSDB18 into memory..."}, f)

    print("Loading MUSDB18...")
    db = musdb.DB(root='musdb18', is_wav=False)
    tracks = db.load_mus_tracks(subsets=['train'])
    
    if args.dry_run:
        tracks = tracks[:2]
        print(f"Dry run mode: processing only {len(tracks)} tracks.")
        
    out_dir = 'data/processed'
    os.makedirs(out_dir, exist_ok=True)
    
    n_fft = 4096
    hop_length = 1024
    chunk_frames = 128
    
    # Write 'processing' state now that tracks are loaded
    with open(status_file, 'w') as f:
        json.dump({"status": "processing", "current": 0, "total": len(tracks), "current_track": "Ready to process"}, f)

    for idx, track in enumerate(tqdm(tracks, desc="Processing tracks")):
        with open(status_file, 'w') as f:
            json.dump({"status": "processing", "current": idx + 1, "total": len(tracks), "current_track": track.name}, f)
            
        # track.audio is (samples, channels). We transpose to (channels, samples)
        mix_audio = track.audio.T
        if args.mono:
            mix_audio = np.mean(mix_audio, axis=0, keepdims=True)
            
        mix_stft = compute_stft(mix_audio, n_fft=n_fft, hop_length=hop_length)
        mix_mag = np.abs(mix_stft)
        
        # log1p normalization
        mix_mag_norm = np.log1p(mix_mag)
        
        # Get targets
        targets = ['vocals', 'drums', 'bass', 'other']
        masks = {}
        for target in targets:
            tgt_audio = track.targets[target].audio.T
            if args.mono:
                tgt_audio = np.mean(tgt_audio, axis=0, keepdims=True)
            tgt_stft = compute_stft(tgt_audio, n_fft=n_fft, hop_length=hop_length)
            tgt_mag = np.abs(tgt_stft)
            
            # compute soft mask
            mask = tgt_mag / (mix_mag + 1e-8)
            mask = np.clip(mask, 0, 1)
            masks[target] = mask
        
        # Chunking
        num_frames = mix_mag_norm.shape[2]
        for i in range(0, num_frames - chunk_frames + 1, chunk_frames):
            chunk_idx = i // chunk_frames
            out_prefix = os.path.join(out_dir, f"{track.name.replace(' ', '_')}_{chunk_idx:04d}")
            
            mix_chunk = mix_mag_norm[:, :, i:i+chunk_frames]
            np.save(f"{out_prefix}_mix.npy", mix_chunk)
            
            for target in targets:
                mask_chunk = masks[target][:, :, i:i+chunk_frames]
                np.save(f"{out_prefix}_{target}.npy", mask_chunk)

    # Mark as completed
    with open(status_file, 'w') as f:
        json.dump({"status": "completed", "current": len(tracks), "total": len(tracks)}, f)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true', help='Process only 2 tracks for quick testing')
    parser.add_argument('--mono', action='store_true', help='Convert audio to mono before processing')
    args = parser.parse_args()
    preprocess(args)
