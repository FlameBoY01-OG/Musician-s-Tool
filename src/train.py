import argparse
import os
import json
import torch
import torch.optim as optim
from torch.utils.data import DataLoader
from tqdm import tqdm
from src.dataset import MUSDBDataset
from src.model import UNet
from src.loss import SpectrogramL1Loss

def train(args):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    os.makedirs('checkpoints', exist_ok=True)
    os.makedirs('logs/train', exist_ok=True)
    
    train_dataset = MUSDBDataset(target=args.target, split='train')
    val_dataset = MUSDBDataset(target=args.target, split='val')
    
    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True, num_workers=min(4, os.cpu_count()))
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size, shuffle=False, num_workers=min(4, os.cpu_count()))
    
    if len(train_dataset) == 0:
        print("No training data found. Please run preprocess.py first.")
        return
        
    sample_mix, _ = train_dataset[0]
    in_channels = sample_mix.shape[0]
    model = UNet(in_channels=in_channels, out_channels=in_channels).to(device)
    
    criterion = SpectrogramL1Loss()
    optimizer = optim.Adam(model.parameters(), lr=0.001, weight_decay=1e-5)
    
    # We want ReduceLROnPlateau but depending on torch version might not have verbose. Standard has it.
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5)
    
    start_epoch = 0
    best_val_loss = float('inf')
    history = []
    
    if args.resume:
        if os.path.exists('checkpoints/best_model.pth'):
            checkpoint = torch.load('checkpoints/best_model.pth', map_location=device)
            model.load_state_dict(checkpoint['model_state_dict'])
            optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
            start_epoch = checkpoint['epoch']
            best_val_loss = checkpoint['best_val_loss']
            print(f"Resumed from epoch {start_epoch}")
            if os.path.exists('logs/train/history.json'):
                with open('logs/train/history.json', 'r') as f:
                    history = json.load(f)
                    
    for epoch in range(start_epoch, args.epochs):
        model.train()
        train_loss = 0.0
        
        pbar = tqdm(train_loader, desc=f"Epoch {epoch+1}/{args.epochs}")
        for mix, target_mask in pbar:
            mix, target_mask = mix.to(device), target_mask.to(device)
            
            optimizer.zero_grad()
            est_mask = model(mix)
            loss = criterion(est_mask, mix, target_mask)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item() * mix.size(0)
            pbar.set_postfix({'loss': loss.item()})
            
        train_loss /= len(train_loader.dataset)
        
        # Validation
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for mix, target_mask in val_loader:
                mix, target_mask = mix.to(device), target_mask.to(device)
                est_mask = model(mix)
                loss = criterion(est_mask, mix, target_mask)
                val_loss += loss.item() * mix.size(0)
        
        if len(val_loader.dataset) > 0:
            val_loss /= len(val_loader.dataset)
        else:
            val_loss = 0.0
            
        scheduler.step(val_loss)
        
        print(f"Epoch {epoch+1}: Train Loss = {train_loss:.4f}, Val Loss = {val_loss:.4f}")
        
        if val_loss < best_val_loss and len(val_loader.dataset) > 0:
            best_val_loss = val_loss
            torch.save({
                'epoch': epoch + 1,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'best_val_loss': best_val_loss
            }, 'checkpoints/best_model.pth')
            print("Saved best model.")
            
        lr = optimizer.param_groups[0]['lr']
        history.append({
            'epoch': epoch + 1,
            'train_loss': train_loss,
            'val_loss': val_loss,
            'learning_rate': lr
        })
        with open('logs/train/history.json', 'w') as f:
            json.dump(history, f, indent=4)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--batch-size', type=int, default=8)
    parser.add_argument('--epochs', type=int, default=50)
    parser.add_argument('--target', type=str, default='vocals')
    parser.add_argument('--resume', action='store_true')
    args = parser.parse_args()
    train(args)
