const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Storage configuration
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const folder = req.body.folder || 'root';
        const folderPath = path.join(uploadsDir, folder);
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }
        cb(null, folderPath);
    },
    filename: (req, file, cb) => {
        const uniqueFilename = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueFilename);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
    fileFilter: (req, file, cb) => {
        cb(null, true);
    }
});

// In-memory database for file metadata
const fileStore = new Map();

// Utility functions
function getFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const types = {
        // Images
        '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image', '.webp': 'image',
        // Video
        '.mp4': 'video', '.avi': 'video', '.mkv': 'video', '.mov': 'video', '.wmv': 'video',
        // Audio
        '.mp3': 'audio', '.wav': 'audio', '.flac': 'audio', '.aac': 'audio', '.m4a': 'audio',
        // Document
        '.pdf': 'document', '.doc': 'document', '.docx': 'document', '.txt': 'document', '.rtf': 'document', '.xlsx': 'document', '.xls': 'document',
        // Code
        '.js': 'code', '.ts': 'code', '.py': 'code', '.java': 'code', '.cpp': 'code', '.html': 'code', '.css': 'code', '.json': 'code',
        // Archive
        '.zip': 'archive', '.rar': 'archive', '.7z': 'archive', '.tar': 'archive', '.gz': 'archive'
    };
    return types[ext] || 'default';
}

function getFileSize(filepath) {
    try {
        const stats = fs.statSync(filepath);
        return stats.size;
    } catch (e) {
        return 0;
    }
}

function scanDirectory(dirPath) {
    const files = [];
    try {
        const items = fs.readdirSync(dirPath);
        items.forEach(item => {
            const fullPath = path.join(dirPath, item);
            const stats = fs.statSync(fullPath);
            
            files.push({
                id: item,
                name: item,
                type: stats.isDirectory() ? 'folder' : getFileType(item),
                size: stats.size || 0,
                created: stats.birthtime,
                modified: stats.mtime
            });
        });
    } catch (e) {
        console.error('Error scanning directory:', e);
    }
    return files;
}

// ==================== API ROUTES ====================

// Get all files
app.get('/api/files', (req, res) => {
    try {
        const files = scanDirectory(uploadsDir);
        res.json({ files });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch files' });
    }
});

// Upload files
app.post('/api/upload', upload.array('files'), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const uploadedFiles = req.files.map(file => ({
            id: file.filename,
            name: req.body.originalNames ? JSON.parse(req.body.originalNames)[req.files.indexOf(file)] : file.originalname,
            type: getFileType(file.originalname),
            size: file.size,
            created: new Date(),
            modified: new Date()
        }));

        res.json({ 
            success: true,
            files: uploadedFiles,
            message: `Successfully uploaded ${uploadedFiles.length} file(s)`
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Download file
app.get('/api/download/:fileId', (req, res) => {
    try {
        const fileId = req.params.fileId;
        const files = scanDirectory(uploadsDir);
        const file = files.find(f => f.id === fileId);

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        const filePath = path.join(uploadsDir, fileId);
        res.download(filePath, file.name);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Download failed' });
    }
});

// Create folder
app.post('/api/folders', (req, res) => {
    try {
        const { name, parent } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Invalid folder name' });
        }

        const folderPath = path.join(uploadsDir, parent, name);
        
        if (fs.existsSync(folderPath)) {
            return res.status(400).json({ error: 'Folder already exists' });
        }

        fs.mkdirSync(folderPath, { recursive: true });

        res.json({
            success: true,
            folder: {
                id: name,
                name,
                type: 'folder',
                size: 0,
                created: new Date(),
                modified: new Date()
            }
        });
    } catch (error) {
        console.error('Folder creation error:', error);
        res.status(500).json({ error: 'Failed to create folder' });
    }
});

// Delete file
app.delete('/api/files/:fileId', (req, res) => {
    try {
        const fileId = req.params.fileId;
        const filePath = path.join(uploadsDir, fileId);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        if (fs.statSync(filePath).isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(filePath);
        }

        res.json({ success: true, message: 'File deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// Rename file
app.put('/api/files/:fileId/rename', (req, res) => {
    try {
        const { fileId } = req.params;
        const { name } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Invalid name' });
        }

        const oldPath = path.join(uploadsDir, fileId);
        const newPath = path.join(uploadsDir, name);

        if (!fs.existsSync(oldPath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Check for name collision
        if (fs.existsSync(newPath)) {
            return res.status(400).json({ error: 'Name already exists' });
        }

        fs.renameSync(oldPath, newPath);

        res.json({ 
            success: true,
            message: 'File renamed successfully',
            newId: name
        });
    } catch (error) {
        console.error('Rename error:', error);
        res.status(500).json({ error: 'Failed to rename file' });
    }
});

// Get file info
app.get('/api/files/:fileId/info', (req, res) => {
    try {
        const { fileId } = req.params;
        const filePath = path.join(uploadsDir, fileId);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const stats = fs.statSync(filePath);
        
        res.json({
            id: fileId,
            name: fileId,
            type: stats.isDirectory() ? 'folder' : getFileType(fileId),
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to get file info' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running' });
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 AstraNova Cloud Server running at http://localhost:${PORT}`);
    console.log(`📂 Files stored in: ${uploadsDir}`);
    console.log(`🌐 Frontend available at http://localhost:${PORT}`);
});
