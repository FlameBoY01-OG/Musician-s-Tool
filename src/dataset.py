import os
import glob
import numpy as np
import torch
from torch.utils.data import Dataset
import random

class MUSDBDataset(Dataset):
    def __init__(self, data_dir='data/processed', target='vocals', split='train', split_ratio=0.9, seed=42):
        self.data_dir = data_dir
        self.target = target
        
        mix_files = sorted(glob.glob(os.path.join(data_dir, '*_mix.npy')))
        
        # Extract track names
        track_names = list(set(["_".join(os.path.basename(f).split('_')[:-2]) for f in mix_files]))
        track_names.sort()
        
        random.seed(seed)
        random.shuffle(track_names)
        
        split_idx = int(len(track_names) * split_ratio)
        if split == 'train':
            selected_tracks = set(track_names[:split_idx])
        elif split == 'val':
            selected_tracks = set(track_names[split_idx:])
        else:
            selected_tracks = set(track_names)
            
        self.files = []
        for f in mix_files:
            t_name = "_".join(os.path.basename(f).split('_')[:-2])
            if t_name in selected_tracks:
                self.files.append(f)
                
    def __len__(self):
        return len(self.files)
        
    def __getitem__(self, idx):
        mix_path = self.files[idx]
        target_path = mix_path.replace('_mix.npy', f'_{self.target}.npy')
        
        mix_mag = np.load(mix_path)
        target_mask = np.load(target_path)
        
        return torch.from_numpy(mix_mag).float(), torch.from_numpy(target_mask).float()
