"""
AstraNova Cloud Storage - Python Flask Backend
A lightweight alternative to Node.js backend
Install: pip install flask flask-cors python-multipart
Run: python app.py
"""

from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import os
import json
import uuid
from pathlib import Path
from datetime import datetime
import mimetypes
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'rar', 'mp3', 'mp4', 'avi', 'mov', 'webp', 'js', 'html', 'css', 'json', 'py', 'cpp', 'java'}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS or True

def get_file_type(filename):
    ext = os.path.splitext(filename)[1].lower()
    types = {
        '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image', '.webp': 'image',
        '.mp4': 'video', '.avi': 'video', '.mkv': 'video', '.mov': 'video', '.wmv': 'video',
        '.mp3': 'audio', '.wav': 'audio', '.flac': 'audio', '.aac': 'audio', '.m4a': 'audio',
        '.pdf': 'document', '.doc': 'document', '.docx': 'document', '.txt': 'document',
        '.js': 'code', '.ts': 'code', '.py': 'code', '.html': 'code', '.css': 'code',
        '.zip': 'archive', '.rar': 'archive', '.7z': 'archive', '.tar': 'archive',
    }
    return types.get(ext, 'default')

def scan_directory(directory):
    files = []
    try:
        for item in os.listdir(directory):
            if item.startswith('.'):
                continue
            full_path = os.path.join(directory, item)
            stat = os.stat(full_path)
            files.append({
                'id': item,
                'name': item,
                'type': 'folder' if os.path.isdir(full_path) else get_file_type(item),
                'size': stat.st_size if os.path.isfile(full_path) else 0,
                'created': datetime.fromtimestamp(stat.st_ctime).isoformat(),
                'modified': datetime.fromtimestamp(stat.st_mtime).isoformat()
            })
    except Exception as e:
        print(f"Error scanning directory: {e}")
    return files

# ==================== API ROUTES ====================

@app.route('/api/files', methods=['GET'])
def get_files():
    """Get all files"""
    try:
        files = scan_directory(UPLOAD_FOLDER)
        return jsonify({'files': files})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/upload', methods=['POST'])
def upload_files():
    """Upload files"""
    if 'files' not in request.files:
        return jsonify({'error': 'No files part'}), 400
    
    files_data = request.files.getlist('files')
    uploaded = []
    
    for file in files_data:
        if file and file.filename:
            filename = secure_filename(file.filename)
            unique_filename = str(uuid.uuid4()) + os.path.splitext(filename)[1]
            filepath = os.path.join(UPLOAD_FOLDER, unique_filename)
            file.save(filepath)
            
            uploaded.append({
                'id': unique_filename,
                'name': filename,
                'type': get_file_type(filename),
                'size': os.path.getsize(filepath),
                'created': datetime.now().isoformat(),
                'modified': datetime.now().isoformat()
            })
    
    return jsonify({'success': True, 'files': uploaded})

@app.route('/api/download/<file_id>', methods=['GET'])
def download_file(file_id):
    """Download a file"""
    filepath = os.path.join(UPLOAD_FOLDER, file_id)
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
    
    files = scan_directory(UPLOAD_FOLDER)
    file_info = next((f for f in files if f['id'] == file_id), None)
    
    return send_file(filepath, as_attachment=True, download_name=file_info['name'] if file_info else file_id)

@app.route('/api/folders', methods=['POST'])
def create_folder():
    """Create a new folder"""
    data = request.get_json()
    name = data.get('name', '').strip()
    
    if not name:
        return jsonify({'error': 'Invalid folder name'}), 400
    
    folder_path = os.path.join(UPLOAD_FOLDER, name)
    
    if os.path.exists(folder_path):
        return jsonify({'error': 'Folder already exists'}), 400
    
    os.makedirs(folder_path, exist_ok=True)
    
    return jsonify({
        'success': True,
        'folder': {
            'id': name,
            'name': name,
            'type': 'folder',
            'size': 0,
            'created': datetime.now().isoformat(),
            'modified': datetime.now().isoformat()
        }
    })

@app.route('/api/files/<file_id>', methods=['DELETE'])
def delete_file(file_id):
    """Delete a file or folder"""
    filepath = os.path.join(UPLOAD_FOLDER, file_id)
    
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
    
    try:
        if os.path.isdir(filepath):
            import shutil
            shutil.rmtree(filepath)
        else:
            os.remove(filepath)
        return jsonify({'success': True, 'message': 'File deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/files/<file_id>/rename', methods=['PUT'])
def rename_file(file_id):
    """Rename a file"""
    data = request.get_json()
    new_name = data.get('name', '').strip()
    
    if not new_name:
        return jsonify({'error': 'Invalid name'}), 400
    
    old_path = os.path.join(UPLOAD_FOLDER, file_id)
    new_path = os.path.join(UPLOAD_FOLDER, new_name)
    
    if not os.path.exists(old_path):
        return jsonify({'error': 'File not found'}), 404
    
    if os.path.exists(new_path):
        return jsonify({'error': 'Name already exists'}), 400
    
    try:
        os.rename(old_path, new_path)
        return jsonify({'success': True, 'message': 'File renamed successfully', 'newId': new_name})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/files/<file_id>/info', methods=['GET'])
def get_file_info(file_id):
    """Get file information"""
    filepath = os.path.join(UPLOAD_FOLDER, file_id)
    
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
    
    stat = os.stat(filepath)
    return jsonify({
        'id': file_id,
        'name': file_id,
        'type': 'folder' if os.path.isdir(filepath) else get_file_type(file_id),
        'size': stat.st_size if os.path.isfile(filepath) else 0,
        'created': datetime.fromtimestamp(stat.st_ctime).isoformat(),
        'modified': datetime.fromtimestamp(stat.st_mtime).isoformat()
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'Server is running'})

@app.route('/')
def serve_frontend():
    """Serve the frontend"""
    return send_from_directory(os.path.dirname(__file__), 'index.html')

if __name__ == '__main__':
    print("🚀 AstraNova Cloud Server running at http://localhost:3000")
    print(f"📂 Files stored in: {UPLOAD_FOLDER}")
    print("🌐 Frontend available at http://localhost:3000")
    app.run(debug=False, port=3000, host='localhost')
