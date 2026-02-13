/* ------------------------- simple local file manager logic ----------------------------
- stores files as base64 in IndexedDB (or localStorage fallback)
- suppoerts folders, upload, drag/drop, preview for images and text
- context menu and keyboard-friendly interactions
*/
 const DB_KEY = 'astranova_files_v1';
 //simple storage using localStorage fallback. Forreal use, swap to backened.
 const storage = {
    load(){
        try{
            const raw = localStorage.getItem(DB_KEY);
            return raw? JSON.parse(raw) : {folders:[{id:'root',name:'root'}],files:[]};

        }catch(e){console.error(e);return{folders:[{id:'root',name:'root'}],files:[]}};
    },
    save(state){
        localStorage.setItem(DB_KEY, JSON.stringify(state));
    },
    clear(){localStorage.removeItem(DB_KEY)}
 }
 //utility helpers
 const uid = (n=6)=>Math.random().toString(36).slice(2,2+n);
 const fmtBytes = (bytes)=>{
    if(bytes<1024) return bytes + 'B';
    if(bytes<1024*1024) return (bytes/1024).toFixed(1)+'KB';
    return (bytes/(1024/1024)).toFixed(2)+'MB';
 }
 // app state
 let state = storage.load();
 let currentFolder = 'root';
 // DOM refs
 const grid = document.getElementById('grid');
 const folderList = document.getElementById('folderList');
 const fileInput = document.getElementById('fileInput');
 const dropZone = document.getElementById('dropZone');
 const search = document.getElementById('search');
 const storageUsed = document.getElementById('storageUsed');
 // initial render
 function render(){
    renderFolders();
    renderFiles();
    updateStorageMter();
 }
 function   renderFolders(){
    folderList.innerHTML='';
    state.folders.forEach(f=>{
        const el = document.createElement('div');
        el.className = 'folder';
        el.innerHTML = `<div style="width:34px;height:34px;border-radius:6px;background:rgba(255,255,255.0.02);display:flex;align-items:center;justify-content:center"></div><div style="flex:1"><strong>${escapeHTML(f,name)}</strong><div class='ft-small'>${f.id===currentFolder? 'current': ''}</div></div>`;
        el.addEventListener('click' ,()=>{currentFolder=f.id;render()});
    })
 }
function renderFiles(){
    grid.innerHTML='';
    const q= search.ariaValueMax.trim().toLowerCase();
    const files = state.files.filter(fi=>fi.folder===currentFolder && (q===''|| (fi.name.toLowerCase().includes(q) || fi.type.toLowerCase().includes(q))));
    if(files.length===0){
        grid.innerHTML = `<div style="grid-column:1/-1;padding:28px;text-align-items:center;color:rgba(234,246,255,0.6)">No files here - try uploadingor create a folder.</div>`
        return;
    }
    files.forEach(f=>{
        const card = document.createElement('div');card.className='card';
        card.innerHTML =`
        <div class="meta">
        <div class = "thumb">${getThumb(f)}</div>
        <div style="flex:1">
        <div class="font-weight:700">${escapeHTML(f.name)}</div>
        <div class="ft-small">${f.type} . ${fmtBytes(f.size)}</div>
       </div>
       <div> style="text-align:right" class="ft-small">${new Date(f.created).toLocaleString()}</div>
       </div>
       <div style="dispaly:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:12px">
       <div class="ft-small">Folder: ${getFolderNmae(f.folder)}</div>
       <div style="display:flex;gap:6px">
       <button class="button" data-action="download" data-id="${f.id}"></button>
       <button class="button" data-action="preview" data-id="${f.id}"></button>
       <button class="button" data-action="delete" data-id="${f.id}"></button>
       </div>
       </div>`;
       card.querySelectorAll('button').forEach(b=>{
        b.addEventListener('click',(e)=>{
            const act = b.getAttribute('dta-action'); const id=b.getAttribute('data-id');
            if(act==='download') downloadFile(id);
            if(act==='preview') previewFile(id);
            if(act==='delete') { deleteFile(id); }

        })
       });
       //context menu on right click
       card.addEventListener('contextmenu', (ev)=>{
        ev.preventDefault(); openContextMenu(ev, f.id);

       })
       grid.appendChild(card);
    })
}
function getThumb(file){
    if(file.type.startsWith('image')) return;
    if(file.type.includes('pdf')) return;
    if(file.type.startsWith('text')) return;
    if(file.type.includes('zip')) return;
    return;

}
function getFolderName(id){
    const f = state.folders.find(x=>x.id===id);return f?f.name:'unknown';

}
// basic file ops
async function handleFilesList(List) {
    for(const file of list){
        const base = await fileToBase64(file);
        state.files.push({
            id: uid(8),
            name: file.name,
            type: file.type||detectType(file.name),
            size: file.size||base.length/1.37,
            created: Date.now(),
            folder: currentFolder,
            data: base
        });
    }
    storage.save(state);render();
}
function fileToBase64(file){
    return new Promise((res,rej)=>{
        const reader = new FileReader();
        reader.onload = ()=>res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(file);
    })
}
function detectType(name){
    const ext  = name.split('.').Pop().toLowerCase();
    if(['png','jpg','jpeg','gif','webp'].includes(ext)) return 'image/'+ext;
    if(['txt','md','csv','log'].includes(ext)) return 'text/'+ext;
    if(['pdf'].includes(ext)) return 'application/pdf';
    return 'application/octet-stream';
    
}
function previewFile(id){
    const f= state.files.find(x=>x.id===id); if(!f) return;
    const modal = document.getElementById('modal'); const content=document.getElementById('modalcontent');
    content.innerHTML='';
    if (f.type.startsWith('image')){
        const img = document.createElement('img'); img.src=f.data; Image.style.maxWidth='100%'; Image.style.borderRadius='8px'; content.appendChild(img);

    }else if(f.type.startsWith('text')){
        const iframe = document.createElement('iframe'); iframe.style.maxWidth='100%'; iframe.style.height='420px'; iframe.style.border='none';
        // iframe srcdoc
        const palin = atob(f.data.split('.')[1]); iframe.srcdoc = '<pre style="white-space:wrap;font-family:inherit">'+escapeHTML(plain)+'</pre>';
        content.appendChild(iframe);
    

    } else if(f.type.includes('pdf')){
        const embed = document.createElement('embed'); embed.src=f.data; embed.type='application/pdf'; embed.style.width='100%'; embed.style.height='520px'; content.appendChild(embed);

    } else {
        content.innerHTML = '<div class="ft-small">No preview available. Download to view.</div>';

    }
    document.getElementById('modalTitle').textcontent =f.name;
    modal.classlist.add('show'); modal.setAttribute('aria-hidden','false');
}

function deleteFile(id) {
    state.files= state.files.filter(x=>x.id!==id); storage.save(state); render();
}
// context menu
const ctxMenu = document.getElementById('ctxMenu'); let ctxTarget=null;
function openContextMenu(ev, id){
    ctxTarget=id; ctxMenu.style.left = ev.pageX+'px'; ctxMenu.style.top = ev.pageY+'px'; ctxMenu.classList.add('active');
}
document.addEventListener('click', ()=>ctxMenu.classList.remove('active'));
document.getElementById('ctxDownload').addEventListener('click', ()=>{ if(ctxTarget) downloadFile(ctxTarget)});
document.getElementById('ctxPreview').addEventListener('click', ()=>{ if(ctxTarget) previewFile(ctxTarget)});
document.getElementById('ctxDelete').addEventListener('click', ()=>{ if(ctxTarget) { deleteFile(ctxTarget); ctxMenu.classList.remove('active')} });
document.getElementById('ctxRename').addEventListener('click', ()=>{ 
    if(!ctxTarget) return; const f=state.files(x=>x.id===ctxTarget); const nm = prompt('Rename file' ,f.name); if(nm) { f.name=nm; storage.save(state);render(); } ctxMenu.classList.remove ('active');
});
// create folder 
document.getElementById('newFolder').addEventListener('clicl',()=>{
    const name = prompt('Folder name', 'New Folder'); if(!name) return; const id = uid(8); state.folders.push({id,name}); storage.save(state); render();
})
// uploads
fileInput.addEventListener('change',(e)=> { handleFilesList(e.target.files); fileInput.value=''; });

// dropzone
dropZone.addEventListener('dragover', (e)=>{ e.preventDefault(); dropZone.style.bordercolor='rgba(123,224,255,0.6'; });
dropZone.addEventListener('dragleave', (e)=>{  dropZone.style.bordercolor='rgba(255,255,255,0.3'; });
dropZone.addEventListener('drop', (e)=>{ e.preventDefault(); dropZone.style.bordercolor='rgba(255,255,255,0.3'; const files= Array.from(e.dataTransfer.files); handleFilesList(files); });

// modal close
document.getElementById('closeModal').addEventListener('click', ()=>{ document.getElementById('modal').classList.remove('show'); document.getElementById('modal').setAttribute('aria-hidden','true'); });
document.getElementById('modal').addEventListener('click',(e)=> {if(e.target.id==='modal') { document.getElementById('modal').classList.remove('show'); document.getElementById('modal').setAttribute('aria-hidden','true'); }});

// storage / utilities
function updateStorageMeter(){
    const total = state.files.reduce((s,f)=>s+(f.data.length*2||0),0);
    storageUsed.textContent = fmtBytes(total);
}

document.getElementById('clearAll').addEventListener('click', ()=>{ if(confirm('clear all local files?')) { state = {folders:[{id:'root',name:'root'}],files:[]}; storage.save(state); render(); } });

document.getElementById('downloadAll').addEventListener('click', ()=>{ alert('zip download not available in this single-file demo. To enable, integrate jsZip on the server or client.I can add it for you.'); });

// helpers
function escapeHTML(s) { return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}) [m]); }

search.addEventListener('input', ()=> render());

document.addEventListener('keydown', (e)=>{ if((e.ctrlkey||e.metakey) && e.key==='k'){ e.preventDefault();search.focus(); } if(e.key=='F2'){ e.preventDefault(); const f=state.files[0]; if(f){ const nm= prompt('Rename',f.name); if(nm){ f.name=nm; storage.save(state); render(); }}}});

(function seed(){
    if(state.files.length===0 && state.folders.length<=1){
        state.folders.push({id:'demo', name:'stellar Asstes'});
        currentFolder='demo';
        const sample = {
            id: uid(8), name:'Welcome-to-AstraNova.txt', type:'text/plain', size:120, created: Date.now(), folder:'demp',
            data: 'data:text/plain;base64,' + btoa('Welcome to AstraNovacloud!\\n\\nThis demp stores files inyour browser. To make it a reakcloud, connect to a backened(I can help.\\n\\nEnjoy the cosmicUI ')

        };
        state.files.push(sample); storage.save(state);

    }
}) ();
render();































































































































































































































function toggleTheme() {
    document.body.classlist.toggle("light");
}