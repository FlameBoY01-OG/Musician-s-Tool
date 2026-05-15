import torch
from src.model import UNet

def test_unet_shape():
    model = UNet(in_channels=2, out_channels=2)
    # Batch size 1, 2 channels, 256 freq bins, 128 frames
    x = torch.randn(1, 2, 256, 128)
    out = model(x)
    
    assert out.shape == (1, 2, 256, 128)
    assert out.min() >= 0.0 and out.max() <= 1.0
