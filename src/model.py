import torch
import torch.nn as nn
import torch.nn.functional as F

class DoubleConv(nn.Module):
    def __init__(self, in_channels, out_channels):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, 3, padding=1),
            nn.BatchNorm2d(out_channels),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(out_channels, out_channels, 3, padding=1),
            nn.BatchNorm2d(out_channels),
            nn.LeakyReLU(0.2, inplace=True)
        )

    def forward(self, x):
        return self.conv(x)

class UNet(nn.Module):
    def __init__(self, in_channels=2, out_channels=2):
        super().__init__()
        
        self.enc1 = DoubleConv(in_channels, 16)
        self.enc2 = DoubleConv(16, 32)
        self.enc3 = DoubleConv(32, 64)
        self.enc4 = DoubleConv(64, 128)
        self.enc5 = DoubleConv(128, 256)
        self.enc6 = DoubleConv(256, 512)
        
        self.pool = nn.MaxPool2d(2, 2)
        
        self.bottleneck = DoubleConv(512, 1024)
        
        self.up6 = nn.ConvTranspose2d(1024, 512, 2, stride=2)
        self.dec6 = DoubleConv(1024, 512)
        
        self.up5 = nn.ConvTranspose2d(512, 256, 2, stride=2)
        self.dec5 = DoubleConv(512, 256)
        
        self.up4 = nn.ConvTranspose2d(256, 128, 2, stride=2)
        self.dec4 = DoubleConv(256, 128)
        
        self.up3 = nn.ConvTranspose2d(128, 64, 2, stride=2)
        self.dec3 = DoubleConv(128, 64)
        
        self.up2 = nn.ConvTranspose2d(64, 32, 2, stride=2)
        self.dec2 = DoubleConv(64, 32)
        
        self.up1 = nn.ConvTranspose2d(32, 16, 2, stride=2)
        self.dec1 = DoubleConv(32, 16)
        
        self.final_conv = nn.Conv2d(16, out_channels, 1)
        self.sigmoid = nn.Sigmoid()
        
    def forward(self, x):
        # Encoder
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool(e1))
        e3 = self.enc3(self.pool(e2))
        e4 = self.enc4(self.pool(e3))
        e5 = self.enc5(self.pool(e4))
        e6 = self.enc6(self.pool(e5))
        
        b = self.bottleneck(self.pool(e6))
        
        # Decoder with skip connections
        def skip_cat(up_x, skip_x):
            diffY = skip_x.size()[2] - up_x.size()[2]
            diffX = skip_x.size()[3] - up_x.size()[3]
            up_x = F.pad(up_x, [diffX // 2, diffX - diffX // 2, diffY // 2, diffY - diffY // 2])
            return torch.cat([skip_x, up_x], dim=1)
            
        d6 = self.dec6(skip_cat(self.up6(b), e6))
        d5 = self.dec5(skip_cat(self.up5(d6), e5))
        d4 = self.dec4(skip_cat(self.up4(d5), e4))
        d3 = self.dec3(skip_cat(self.up3(d4), e3))
        d2 = self.dec2(skip_cat(self.up2(d3), e2))
        d1 = self.dec1(skip_cat(self.up1(d2), e1))
        
        out = self.sigmoid(self.final_conv(d1))
        return out
