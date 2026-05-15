import argparse
import os
import json
import musdb
import numpy as np
import mir_eval
from tqdm import tqdm
from src.separate import separate

def evaluate(args):
    print("Loading MUSDB18 Test Set...")
    db = musdb.DB(root='musdb18', is_wav=False)
    tracks = db.load_mus_tracks(subsets=['test'])
    
    results = {}
    metrics_sum = {'sdr': 0, 'sir': 0, 'sar': 0}
    
    if args.dry_run:
        tracks = tracks[:2]
        
    os.makedirs('logs', exist_ok=True)
    temp_dir = 'logs/eval_temp'
    os.makedirs(temp_dir, exist_ok=True)
    
    for track in tqdm(tracks, desc="Evaluating"):
        temp_in = os.path.join(temp_dir, f"{track.name.replace('/', '_')}.wav")
        import soundfile as sf
        sf.write(temp_in, track.audio, track.rate)
        
        vocals_path, acc_path = separate(temp_in, model_path=args.model, out_dir=temp_dir)
        
        est_vocals, _ = sf.read(vocals_path)
        est_acc, _ = sf.read(acc_path)
        
        ref_vocals = track.targets['vocals'].audio
        ref_acc = track.targets['accompaniment'].audio
        
        min_len = min(est_vocals.shape[0], ref_vocals.shape[0])
        est_vocals = est_vocals[:min_len]
        ref_vocals = ref_vocals[:min_len]
        est_acc = est_acc[:min_len]
        ref_acc = ref_acc[:min_len]
        
        reference_sources = np.stack([ref_vocals.T, ref_acc.T])
        estimated_sources = np.stack([est_vocals.T, est_acc.T])
        
        # Average to mono for mir_eval to run quickly
        reference_sources = np.mean(reference_sources, axis=1)
        estimated_sources = np.mean(estimated_sources, axis=1)
        
        (sdr, sir, sar, perm) = mir_eval.separation.bss_eval_sources(
            reference_sources, estimated_sources, compute_permutation=False
        )
        
        results[track.name] = {
            'vocals_sdr': sdr[0],
            'vocals_sir': sir[0],
            'vocals_sar': sar[0]
        }
        metrics_sum['sdr'] += sdr[0]
        metrics_sum['sir'] += sir[0]
        metrics_sum['sar'] += sar[0]
        
    avg_metrics = {k: v / len(tracks) for k, v in metrics_sum.items()}
    results['average'] = avg_metrics
    
    with open('logs/evaluation_results.json', 'w') as f:
        json.dump(results, f, indent=4)
        
    print("Evaluation Results:")
    print(f"Average SDR: {avg_metrics['sdr']:.2f}")
    print(f"Average SIR: {avg_metrics['sir']:.2f}")
    print(f"Average SAR: {avg_metrics['sar']:.2f}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', type=str, default='checkpoints/best_model.pth')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    evaluate(args)
