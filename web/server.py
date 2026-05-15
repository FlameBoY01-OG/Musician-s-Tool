import os
import uuid
import json
import threading
from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename
import sys

# Ensure src is in the path if running from web/
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.separate import separate

# Configure Flask to serve the Vite React build
dist_folder = os.path.join(os.path.dirname(__file__), 'dist')
app = Flask(__name__, static_folder=os.path.join(dist_folder, 'assets'), template_folder=dist_folder)

app.config['UPLOAD_FOLDER'] = os.path.join(app.root_path, 'uploads')
app.config['RESULTS_FOLDER'] = os.path.join(app.root_path, 'results')
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['RESULTS_FOLDER'], exist_ok=True)

# Simple in-memory job store
jobs = {}

def process_audio(job_id, filepath):
    try:
        out_dir = os.path.join(app.config['RESULTS_FOLDER'], job_id)
        os.makedirs(out_dir, exist_ok=True)
        # Call the ML separate function
        vocals, acc = separate(filepath, out_dir=out_dir)
        jobs[job_id]['status'] = 'completed'
        jobs[job_id]['results'] = {
            'vocals': f'/api/audio/{job_id}/vocals.wav',
            'accompaniment': f'/api/audio/{job_id}/accompaniment.wav'
        }
    except Exception as e:
        jobs[job_id]['status'] = 'failed'
        jobs[job_id]['error'] = str(e)

@app.route('/api/is-ready')
def is_ready():
    model_exists = os.path.exists(os.path.join(app.root_path, '..', 'checkpoints', 'best_model.pth'))
    eval_exists = os.path.exists(os.path.join(app.root_path, '..', 'logs', 'evaluation_results.json'))
    return jsonify({'ready': model_exists and eval_exists})

@app.route('/api/upload', methods=['POST'])
def upload_file():
    model_exists = os.path.exists(os.path.join(app.root_path, '..', 'checkpoints', 'best_model.pth'))
    eval_exists = os.path.exists(os.path.join(app.root_path, '..', 'logs', 'evaluation_results.json'))
    if not (model_exists and eval_exists):
        return jsonify({'error': 'Model is currently training or evaluating. Please wait.'}), 403

    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    filename = secure_filename(file.filename)
    job_id = str(uuid.uuid4())
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], f"{job_id}_{filename}")
    file.save(filepath)
    
    jobs[job_id] = {'status': 'processing'}
    
    # Start background thread
    thread = threading.Thread(target=process_audio, args=(job_id, filepath))
    thread.start()
    
    return jsonify({'job_id': job_id, 'status': 'processing'})

@app.route('/api/status/<job_id>')
def get_status(job_id):
    if job_id not in jobs:
        return jsonify({'error': 'Job not found'}), 404
    return jsonify(jobs[job_id])

@app.route('/api/results/<job_id>')
def get_results(job_id):
    if job_id not in jobs:
        return jsonify({'error': 'Job not found'}), 404
    if jobs[job_id]['status'] != 'completed':
        return jsonify({'error': 'Job not completed'}), 400
    return jsonify(jobs[job_id]['results'])

@app.route('/api/system-status')
def system_status():
    status = {
        'preprocessing': {'status': 'not_started'},
        'training': [],
        'evaluation': None
    }
    
    pre_file = os.path.join(app.root_path, '..', 'logs', 'preprocess_status.json')
    if os.path.exists(pre_file):
        with open(pre_file, 'r') as f:
            status['preprocessing'] = json.load(f)
            
    hist_file = os.path.join(app.root_path, '..', 'logs', 'train', 'history.json')
    if os.path.exists(hist_file):
        with open(hist_file, 'r') as f:
            status['training'] = json.load(f)
            
    eval_file = os.path.join(app.root_path, '..', 'logs', 'evaluation_results.json')
    if os.path.exists(eval_file):
        with open(eval_file, 'r') as f:
            status['evaluation'] = json.load(f).get('average', None)
            
    return jsonify(status)

@app.route('/api/audio/<job_id>/<filename>')
def serve_audio(job_id, filename):
    return send_from_directory(os.path.join(app.config['RESULTS_FOLDER'], job_id), filename)

# Catch-all route to serve the React application
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    if path != "" and os.path.exists(os.path.join(app.template_folder, path)):
        return send_from_directory(app.template_folder, path)
    else:
        return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000)
