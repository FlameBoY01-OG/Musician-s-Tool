import argparse
import sys
from src.preprocess import preprocess
from src.train import train
from src.evaluate import evaluate

def main():
    parser = argparse.ArgumentParser(description="Run the full Musician's Tool pipeline sequentially.")
    parser.add_argument('--epochs', type=int, default=50, help='Number of epochs to train')
    parser.add_argument('--batch-size', type=int, default=8, help='Batch size for training')
    parser.add_argument('--target', type=str, default='vocals', help='Target stem to separate')
    parser.add_argument('--dry-run', action='store_true', help='Run a quick test on 2 tracks for all steps')
    parser.add_argument('--mono', action='store_true', help='Process audio in mono (preprocessing)')
    parser.add_argument('--resume', action='store_true', help='Resume training from checkpoint')
    
    args = parser.parse_args()
    
    print("\n" + "="*50)
    print("🚀 STEP 1: PREPROCESSING DATA")
    print("="*50)
    preprocess(args)
    
    print("\n" + "="*50)
    print("🧠 STEP 2: TRAINING U-NET MODEL")
    print("="*50)
    train(args)
    
    print("\n" + "="*50)
    print("📊 STEP 3: EVALUATING MODEL")
    print("="*50)
    # Ensure evaluate knows where the model is
    args.model = 'checkpoints/best_model.pth'
    evaluate(args)
    
    print("\n✅ PIPELINE COMPLETE!")
    print("The web UI is now fully unlocked for audio separation.")

if __name__ == '__main__':
    main()
