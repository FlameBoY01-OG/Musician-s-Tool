# 🎵 Musician's Tool — Music Source Separation

Musician's Tool is a deep-learning powered application that separates mixed audio tracks into individual stems (e.g., vocals and accompaniment). Built with PyTorch and Flask, it features a U-Net architecture trained on the MUSDB18 dataset and a modern, glassmorphic web interface for easy use.

## ✨ Features

*   **State-of-the-Art Source Separation**: Utilizes a 6-level U-Net model operating on magnitude spectrograms to accurately isolate vocals from complex audio mixtures.
*   **Unified Pipeline script**: Process, train, and evaluate the full dataset sequentially with a single command via `run_pipeline.py`.
*   **Complete ML Pipeline**: End-to-end Python scripts for data preprocessing, training, separation, and objective evaluation (SDR, SIR, SAR) using `mir_eval`.
*   **Modern Web Interface**: A beautifully designed, **React** frontend (built with Vite) featuring:
    *   Drag-and-drop audio uploads (securely locked until the model is fully trained).
    *   Interactive multi-stem audio player with solo, mute, and volume controls.
    *   Live waveform visualizations rendered on HTML5 Canvas.
    *   Real-time **System Dashboard** to dynamically monitor the preprocessing status, the training loss curves, and final evaluation metrics.
*   **RESTful API**: Flask backend providing endpoints for asynchronous audio processing and system status polling.

## 🧠 How It Works (The Principle)

The process of music source separation in this tool relies on transforming audio into visual representations and applying deep learning to "mask out" unwanted sounds. Here is a step-by-step breakdown of the underlying principle:

1.  **Time to Frequency Domain (STFT):** Raw audio waveforms are 1D signals over time, making it hard to distinguish overlapping instruments. We first apply a mathematical operation called the **Short-Time Fourier Transform (STFT)**. This converts the audio into a 2D "Spectrogram" (Time vs. Frequency), representing the loudness (magnitude) of different frequencies at any given moment.
2.  **The U-Net Model:** The spectrogram is treated like an image and fed into our AI model, a **U-Net** architecture. The U-Net has two halves:
    *   **Encoder:** Progressively compresses the spectrogram to understand the broad, high-level features (e.g., "Where are the vocal frequencies?").
    *   **Decoder:** Expands the compressed data back up to the original size, using "skip connections" from the encoder to retain precise local details.
3.  **Soft Masking:** Instead of outputting audio directly, the U-Net predicts a "Soft Mask"—a 2D matrix of values between 0.0 and 1.0. A value near 1.0 means "keep this sound" (e.g., vocals), and near 0.0 means "remove this sound" (e.g., drums).
4.  **Application and Reconstruction:** We multiply this soft mask element-wise against the original mixture's spectrogram. Finally, we apply the **Inverse-STFT (ISTFT)** to convert this masked, frequency-domain data back into a standard, listenable audio waveform.

## 🛠️ Installation

### Prerequisites

*   **Python 3.12** is recommended.
*   A CUDA-compatible GPU is highly recommended for training and fast inference.

### Environment Setup

It is strongly advised to use `conda` to manage dependencies.

```bash
# Create and activate the conda environment
conda create -n musicians-tool python=3.12
conda activate musicians-tool

# Install dependencies
pip install -r requirements.txt
```

*Note: If you encounter issues installing `musdb` or `stempeg`, try `pip install musdb stempeg --no-build-isolation`. If `librosa` fails, try `pip install llvmlite --pre` first.*

### Dataset
The project expects the **MUSDB18** dataset to be located in the `musdb18/` directory at the project root, structured with `train/` and `test/` subdirectories.

## 🚀 Usage

All commands should be run from the root directory of the project with the `musicians-tool` environment activated.

### Start the Web Application First (Recommended)

Launch the Flask server to interact with the model via the UI. If you start this before training, you can watch the progress live on the Dashboard.

```bash
# Set PYTHONPATH to ensure modules are found correctly
PYTHONPATH=. python web/server.py
```
*Open your browser and navigate to **http://127.0.0.1:5000***

### Option A: The Unified Pipeline (Recommended)

You can run preprocessing, training, and evaluation all in one go using the master script. 

```bash
# Run the full pipeline for 50 epochs
python run_pipeline.py --epochs 50 --batch-size 8

# For a quick dry-run test (processes only 2 tracks, trains for 2 epochs)
python run_pipeline.py --dry-run --epochs 2 --batch-size 2
```

### Option B: Step-by-Step Execution

If you prefer to run each step individually:

**1. Preprocessing**
Convert the raw audio from the MUSDB18 train set into STFT magnitude spectrogram chunks.
```bash
python -m src.preprocess
```

**2. Training the Model**
Train the U-Net model on the preprocessed spectrograms (uses a 90/10 internal train/val split).
```bash
python -m src.train --epochs 50 --batch-size 8
```

**3. Evaluation**
Evaluate the trained model against the MUSDB18 test set using standard metrics (SDR, SIR, SAR).
```bash
python -m src.evaluate
```

### CLI Separation (Inference)

Once trained, you can separate custom audio files directly from the command line instead of the Web UI.

```bash
python -m src.separate path/to/your/song.mp3
```
*Separated stems will be saved in `web/results/<timestamp>/`.*


## 🏗️ Project Structure

```text
Musician-s-Tool/
├── run_pipeline.py    # Master script to execute the full pipeline
├── checkpoints/       # Saved model weights
├── data/              # Preprocessed STFT data
├── logs/              # Training history and evaluation logs
├── musdb18/           # Raw MUSDB18 dataset (train/ and test/)
├── src/               # Core ML pipeline (model, train, dataset, etc.)
├── tests/             # Pytest unit tests
└── web/               # Flask backend and static frontend assets
```

## 📝 License
This project is for educational and research purposes. Please adhere to the license terms of the MUSDB18 dataset and any included third-party libraries.