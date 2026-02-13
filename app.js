// ==================== STATE ====================
const state = {
    currentFolder: 'root',
    files: [],
    selectedFile: null,
    view: 'grid',
    searchQuery: '',
    isDarkMode: true
};

const API_BASE = 'http://localhost:3000/api';

// ==================== DOM ELEMENTS ====================
const navItems = document.querySelectorAll('.nav-item');
const themeToggle = document.getElementById('themeToggle');
const uploadBtn = document.getElementById('uploadBtn');
const createFolderBtn = document.getElementById('createFolderBtn');
const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const filesGrid = document.getElementById('filesGrid');
const searchInput = document.getElementById('searchInput');
const contextMenu = document.getElementById('contextMenu');
const modal = document.getElementById('modal');
const closeModal = document.getElementById('closeModal');
const toastContainer = document.getElementById('toastContainer');
const menuBtn = document.getElementById('menuBtn');
const dropdownMenu = document.getElementById('dropdownMenu');
const sections = document.querySelectorAll('.section');
const viewToggle = document.getElementById('viewToggle');
const storageFill = document.getElementById('storageFill');

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadInitialData();
    applyTheme();
});

function initializeEventListeners() {
    // Navigation
    navItems.forEach(item => {
        item.addEventListener('click', handleNavigation);
    });

    // Theme
    themeToggle.addEventListener('click', toggleTheme);

    // File operations
    uploadBtn.addEventListener('click', () => fileInput.click());
    createFolderBtn.addEventListener('click', showCreateFolderDialog);
    fileInput.addEventListener('change', handleFileUpload);

    // Dropzone
    dropzone.addEventListener('dragover', handleDragOver);
    dropzone.addEventListener('dragleave', handleDragLeave);
    dropzone.addEventListener('drop', handleDrop);

    // Search
    searchInput.addEventListener('input', handleSearch);

    // View toggle
    viewToggle.addEventListener('click', toggleView);

    // Menu
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('active');
    });

    document.addEventListener('click', () => {
        dropdownMenu.classList.remove('active');
    });

    // Dropdown actions
    dropdownMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', handleMenuAction);
    });

    // Context menu
    document.addEventListener('contextmenu', handleContextMenu);
    contextMenu.querySelectorAll('.context-item').forEach(item => {
        item.addEventListener('click', handleContextAction);
    });

    // Modal
    closeModal.addEventListener('click', closeModalDialog);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModalDialog();
    });
}

// ==================== NAVIGATION ====================
function handleNavigation(e) {
    const section = e.currentTarget.getAttribute('data-section');
    
    navItems.forEach(item => item.classList.remove('active'));
    e.currentTarget.classList.add('active');
    
    sections.forEach(sec => sec.classList.remove('active'));
    document.getElementById(`${section}-section`).classList.add('active');
    
    if (section === 'files') {
        loadFiles();
    } else if (section === 'dashboard') {
        updateDashboard();
    }
}

// ==================== FILE OPERATIONS ====================
async function loadInitialData() {
    await loadFiles();
    updateDashboard();
}

async function loadFiles() {
    try {
        const response = await fetch(`${API_BASE}/files`);
        const data = await response.json();
        state.files = data.files || [];
        renderFiles();
        updateRecentFiles();
    } catch (error) {
        console.error('Error loading files:', error);
        showToast('Failed to load files', 'error');
    }
}

async function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('folder', state.currentFolder);
    
    try {
        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            showToast(`Uploaded ${files.length} file(s) successfully`, 'success');
            await loadFiles();
        } else {
            showToast('Upload failed', 'error');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showToast('Upload failed', 'error');
    } finally {
        fileInput.value = '';
    }
}

async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    dropzone.classList.remove('active');
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('folder', state.currentFolder);
    
    try {
        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            showToast(`Uploaded ${files.length} file(s)`, 'success');
            await loadFiles();
        }
    } catch (error) {
        showToast('Upload failed', 'error');
    }
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add('active');
}

function handleDragLeave(e) {
    if (e.target === dropzone) {
        dropzone.classList.remove('active');
    }
}

async function showCreateFolderDialog() {
    openModal('Create Folder', `
        <input type="text" id="folderName" placeholder="Folder name" style="width: 100%; padding: 10px; margin: 10px 0;">
    `, `
        <button class="btn-secondary" id="cancelBtn">Cancel</button>
        <button class="btn-primary" id="confirmBtn">Create</button>
    `);
    
    document.getElementById('confirmBtn').addEventListener('click', async () => {
        const name = document.getElementById('folderName').value.trim();
        if (!name) {
            showToast('Please enter a folder name', 'warning');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/folders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, parent: state.currentFolder })
            });
            
            if (response.ok) {
                showToast('Folder created successfully', 'success');
                closeModalDialog();
                await loadFiles();
            }
        } catch (error) {
            showToast('Failed to create folder', 'error');
        }
    });
    
    document.getElementById('cancelBtn').addEventListener('click', closeModalDialog);
}

// ==================== RENDERING ====================
function renderFiles() {
    const filtered = state.files.filter(file => 
        file.name.toLowerCase().includes(state.searchQuery.toLowerCase())
    );
    
    filesGrid.innerHTML = '';
    
    if (filtered.length === 0) {
        filesGrid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;"><i class="fas fa-inbox"></i><p>No files</p></div>';
        return;
    }
    
    filtered.forEach(file => {
        const card = createFileCard(file);
        filesGrid.appendChild(card);
    });
}

function createFileCard(file) {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.innerHTML = `
        <div class="file-card-icon">
            ${getFileIcon(file.type)}
        </div>
        <div class="file-card-name" title="${file.name}">${file.name}</div>
        <div class="file-card-meta">${formatFileSize(file.size)}</div>
    `;
    
    card.addEventListener('click', () => {
        state.selectedFile = file;
    });
    
    card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        state.selectedFile = file;
        showContextMenu(e.clientX, e.clientY);
    });
    
    card.addEventListener('dblclick', () => {
        if (file.type === 'folder') {
            state.currentFolder = file.id;
            loadFiles();
        } else {
            downloadFile(file);
        }
    });
    
    return card;
}

function getFileIcon(type) {
    const icons = {
        'folder': '📁',
        'image': '🖼',
        'video': '🎬',
        'audio': '🎵',
        'document': '📄',
        'code': '💻',
        'archive': '📦',
        'default': '📋'
    };
    return icons[type] || icons.default;
}

function updateRecentFiles() {
    const recentList = state.files.slice(0, 5);
    const recentSection = document.getElementById('recentList');
    
    recentSection.innerHTML = '';
    recentList.forEach(file => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <div class="file-icon">${getFileIcon(file.type)}</div>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-meta">
                    <span>${formatFileSize(file.size)}</span>
                    <span>${formatDate(file.created)}</span>
                </div>
            </div>
        `;
        recentSection.appendChild(item);
    });
}

function updateDashboard() {
    const totalFiles = state.files.filter(f => f.type !== 'folder').length;
    const totalFolders = state.files.filter(f => f.type === 'folder').length;
    const totalSize = state.files.reduce((sum, f) => sum + (f.size || 0), 0);
    
    document.getElementById('totalFiles').textContent = totalFiles;
    document.getElementById('totalFolders').textContent = totalFolders;
    document.getElementById('dashboardStorage').textContent = formatFileSize(totalSize);
    
    // Update storage bar
    const maxStorage = 5 * 1024 * 1024 * 1024; // 5GB
    const percentage = (totalSize / maxStorage) * 100;
    storageFill.style.width = Math.min(percentage, 100) + '%';
    
    document.getElementById('storageUsed').textContent = formatFileSize(totalSize);
}

// ==================== SEARCH & FILTER ====================
function handleSearch(e) {
    state.searchQuery = e.target.value;
    renderFiles();
}

function toggleView() {
    state.view = state.view === 'grid' ? 'list' : 'grid';
    viewToggle.style.opacity = 0.6;
    setTimeout(() => {
        viewToggle.style.opacity = 1;
    }, 300);
    renderFiles();
}

// ==================== FILE ACTIONS ====================
async function downloadFile(file) {
    try {
        const response = await fetch(`${API_BASE}/download/${file.id}`);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast('Download started', 'success');
    } catch (error) {
        showToast('Download failed', 'error');
    }
}

async function renameFile(file) {
    const newName = prompt('New name:', file.name);
    if (!newName || newName === file.name) return;
    
    try {
        const response = await fetch(`${API_BASE}/files/${file.id}/rename`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
        });
        
        if (response.ok) {
            showToast('Renamed successfully', 'success');
            await loadFiles();
        }
    } catch (error) {
        showToast('Rename failed', 'error');
    }
}

async function deleteFile(file) {
    if (!confirm(`Delete "${file.name}"?`)) return;
    
    try {
        const response = await fetch(`${API_BASE}/files/${file.id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('Deleted successfully', 'success');
            await loadFiles();
        }
    } catch (error) {
        showToast('Delete failed', 'error');
    }
}

// ==================== CONTEXT MENU ====================
function showContextMenu(x, y) {
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';
    contextMenu.classList.add('active');
}

function handleContextAction(e) {
    const action = e.currentTarget.getAttribute('data-action');
    contextMenu.classList.remove('active');
    
    if (!state.selectedFile) return;
    
    switch(action) {
        case 'download':
            downloadFile(state.selectedFile);
            break;
        case 'rename':
            renameFile(state.selectedFile);
            break;
        case 'delete':
            deleteFile(state.selectedFile);
            break;
        case 'share':
            showToast('Sharing feature coming soon', 'warning');
            break;
        case 'move':
            showToast('Move feature coming soon', 'warning');
            break;
    }
}

function handleMenuAction(e) {
    e.preventDefault();
    const action = e.currentTarget.getAttribute('data-action');
    
    switch(action) {
        case 'download-all':
            showToast('Download all coming soon', 'warning');
            break;
        case 'refresh':
            loadFiles();
            showToast('Refreshed', 'success');
            break;
        case 'select-all':
            showToast('Select all coming soon', 'warning');
            break;
    }
    
    dropdownMenu.classList.remove('active');
}

document.addEventListener('click', () => {
    contextMenu.classList.remove('active');
});

// ==================== MODAL ====================
function openModal(title, content, footer = '') {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = content;
    document.getElementById('modalFooter').innerHTML = footer;
    modal.classList.add('active');
}

function closeModalDialog() {
    modal.classList.remove('active');
}

// ==================== THEME ====================
function toggleTheme() {
    state.isDarkMode = !state.isDarkMode;
    applyTheme();
}

function applyTheme() {
    if (state.isDarkMode) {
        document.documentElement.classList.remove('light-mode');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.classList.add('light-mode');
        localStorage.setItem('theme', 'light');
    }
    
    updateThemeIcon();
}

function updateThemeIcon() {
    const icon = themeToggle.querySelector('i');
    if (state.isDarkMode) {
        icon.className = 'fas fa-moon';
    } else {
        icon.className = 'fas fa-sun';
    }
}

// Load saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
    state.isDarkMode = false;
    applyTheme();
}

// ==================== TOAST NOTIFICATIONS ====================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-circle',
        info: 'fas fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="${icons[type]}"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==================== UTILITIES ====================
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(date) {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
}
