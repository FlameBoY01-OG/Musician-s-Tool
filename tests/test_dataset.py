import torch
import numpy as np
from src.dataset import MUSDBDataset

def test_dataset_initialization(tmp_path):
    # Setup dummy data
    data_dir = tmp_path / "processed"
    data_dir.mkdir()
    
    np.save(data_dir / "track1_0000_mix.npy", np.random.rand(2, 2049, 128))
    np.save(data_dir / "track1_0000_vocals.npy", np.random.rand(2, 2049, 128))
    np.save(data_dir / "track2_0000_mix.npy", np.random.rand(2, 2049, 128))
    np.save(data_dir / "track2_0000_vocals.npy", np.random.rand(2, 2049, 128))
    
    dataset = MUSDBDataset(data_dir=str(data_dir), split='all')
    assert len(dataset) == 2
    
    mix, tgt = dataset[0]
    assert mix.shape == (2, 2049, 128)
    assert tgt.shape == (2, 2049, 128)
