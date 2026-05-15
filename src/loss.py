import torch
import torch.nn as nn

class SpectrogramL1Loss(nn.Module):
    def __init__(self):
        super().__init__()
        self.l1 = nn.L1Loss()
        
    def forward(self, est_mask, mix_mag, target_mask):
        """
        est_mask: Predicted soft mask [0, 1]
        mix_mag: Mixture spectrogram (normalized)
        target_mask: Ground truth soft mask
        """
        est_mag = est_mask * mix_mag
        target_mag = target_mask * mix_mag
        return self.l1(est_mag, target_mag)

class SpectrogramMSELoss(nn.Module):
    def __init__(self):
        super().__init__()
        self.mse = nn.MSELoss()
        
    def forward(self, est_mask, mix_mag, target_mask):
        est_mag = est_mask * mix_mag
        target_mag = target_mask * mix_mag
        return self.mse(est_mag, target_mag)
