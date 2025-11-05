// ============== folder-view.js ==============
// (Persistent Virtual Folders Edition - Final Version with all fixes and features)

/**
 * 새 창을 열고, 그 안에 모든 UI와 로직(저장, 불러오기 등)을 주입합니다.
 */
function openFolderViewInNewWindow() {
    if (lastFetchedTorrents.length === 0) {
        showToast("먼저 토렌트 목록을 새로고침 해주세요.", "warning");
        return;
    }

    const newWindow = window.open("", "_blank");

    if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
        showToast("팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.", "error");
        addLog("새 창 열기 실패: 브라우저가 팝업을 차단했습니다.", "error");
        return;
    }

    const initialViewHTML = generateAutomaticFolderViewHTML(lastFetchedTorrents);

    const newWindowContent = `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>토렌트 가상 폴더 뷰</title>
            <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet" />
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" />
            <style>
                body { background-color: #f3f4f6; }
                .btn-potplayer { background-color: #4b3279; color: white; } .btn-potplayer:hover { background-color: #5d3f99; }
                .btn-stream { background-color: #8B5CF6; color: white; } .btn-stream:hover { background-color: #7C3AED; }
                .btn-rdpage { background-color: #3B82F6; color: white; } .btn-rdpage:hover { background-color: #2563EB; }
                .btn-download { background-color: #10B981; color: white; } .btn-download:hover { background-color: #059669; }
                .btn-link { background-color: #6B7280; color: white; } .btn-link:hover { background-color: #4B5563; }
                .btn-hide { background-color: #9CA3AF; color: white; } .btn-hide:hover { background-color: #6B7280; }
                .btn-delete { background-color: #EF4444; color: white; } .btn-delete:hover { background-color: #DC2626; }
                details summary::-webkit-details-marker { display: none; }
                details > summary { list-style: none; }
                /* ★★★ [수정됨] 버튼을 화면 우측 중간에 고정 ★★★ */
                .fixed-controls {
                    position: fixed;
                    top: 50%;
                    right: 1.5rem;
                    transform: translateY(-50%);
                    z-index: 50;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.75rem;
                }
            </style>
        </head>
        <body>
            <div class="container mx-auto max-w-5xl p-4 pb-32">
                <div class="flex justify-between items-center mb-4 border-b pb-2">
                    <h1 class="text-2xl font-bold text-gray-800">토렌트 가상 폴더 뷰 (${lastFetchedTorrents.length}개)</h1>
                    <div class="flex gap-2 items-center">
                        <button id="loadBtn" class="px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 flex items-center" title="저장된 폴더 구조 불러오기">
                            <i class="fas fa-upload mr-2"></i>불러오기
                        </button>
                        <button id="saveBtn" class="px-3 py-1 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 flex items-center" title="현재 폴더 구조 저장하기">
                            <i class="fas fa-save mr-2"></i>저장
                        </button>
                    </div>
                </div>
                <div id="folderViewContainer">${initialViewHTML}</div>
            </div>

            <div class="fixed-controls">
                 <button id="createFolderBtn" class="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 flex items-center shadow-lg transition-transform hover:scale-105" title="선택한 항목으로 가상 폴더 만들기">
                    <i class="fas fa-folder-plus mr-2"></i>가상 폴더 만들기
                </button>
                <button id="cancelFolderBtn" class="px-4 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 hidden shadow-lg" title="취소">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <script>
                let isFolderCreationMode = false;
                let hasUnsavedChanges = false;
                const LAYOUT_STORAGE_KEY = 'rdmex_virtual_folder_layout';
                const opener = window.opener;

                window.addEventListener('beforeunload', (e) => {
                    if (hasUnsavedChanges) {
                        e.preventDefault();
                        e.returnValue = '';
                    }
                });

                function saveLayout() {
                    const container = document.getElementById('folderViewContainer');
                    const layout = [];
                    // ★★★ [수정됨] childNodes 대신 children을 사용하여 오류 방지 ★★★
                    for (const node of container.children) {
                        if (node.tagName === 'DETAILS') {
                            const folder = {
                                type: 'folder',
                                name: node.querySelector('summary > div').textContent.trim(),
                                items: Array.from(node.querySelectorAll('.torrent-item-container')).map(item => item.dataset.id)
                            };
                            layout.push(folder);
                        } else if (node.classList.contains('torrent-item-container')) {
                            layout.push({ type: 'single', id: node.dataset.id });
                        }
                    }

                    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
                    hasUnsavedChanges = false;
                    opener.showToast("폴더 구조가 브라우저에 저장되었습니다.", "success");
                }

                function loadLayout() {
                    if (hasUnsavedChanges && !confirm("저장되지 않은 변경사항이 있습니다. 정말로 불러오시겠습니까?")) return;

                    const savedLayoutJSON = localStorage.getItem(LAYOUT_STORAGE_KEY);
                    if (!savedLayoutJSON) {
                        opener.showToast("저장된 폴더 구조가 없습니다.", "info");
                        return;
                    }

                    const savedLayout = JSON.parse(savedLayoutJSON);
                    const container = document.getElementById('folderViewContainer');
                    container.innerHTML = '';

                    const torrentsMap = new Map(opener.lastFetchedTorrents.map(t => [t.id, t]));
                    const usedIds = new Set();

                    savedLayout.forEach(entry => {
                        if (entry.type === 'folder') {
                            const folderContent = document.createElement('div');
                            folderContent.className = 'p-2 border-t border-gray-300';
                            let totalSize = 0;
                            let liveItemsCount = 0;

                            entry.items.forEach(id => {
                                if (torrentsMap.has(id)) {
                                    const torrent = torrentsMap.get(id);
                                    folderContent.innerHTML += opener.renderTorrentItemHTML(torrent, true);
                                    totalSize += torrent.bytes;
                                    liveItemsCount++;
                                    usedIds.add(id);
                                }
                            });

                            if (liveItemsCount > 0) {
                                const details = document.createElement('details');
                                details.className = 'bg-gray-100 rounded-lg mb-2';
                                details.innerHTML = \`<summary class="p-3 cursor-pointer font-semibold text-gray-800 flex justify-between items-center hover:bg-gray-200 rounded-t-lg">
                                        <div><i class="fas fa-folder text-yellow-500 mr-3"></i>\${entry.name}</div>
                                        <div class="text-sm font-normal text-gray-600">\${liveItemsCount}개 / \${opener.formatSize(totalSize)}</div>
                                    </summary>\`;
                                details.appendChild(folderContent);
                                container.appendChild(details);
                            }
                        } else if (entry.type === 'single' && torrentsMap.has(entry.id)) {
                            container.innerHTML += opener.renderTorrentItemHTML(torrentsMap.get(entry.id), true);
                            usedIds.add(entry.id);
                        }
                    });
                    
                    const uncategorizedItems = opener.lastFetchedTorrents.filter(t => !usedIds.has(t.id));
                    if (uncategorizedItems.length > 0) {
                         container.innerHTML += opener.generateMonthlyGroupHTML(uncategorizedItems, true);
                    }
                    
                    hasUnsavedChanges = false;
                    opener.showToast("저장된 폴더 구조를 불러왔습니다.", "success");
                }
                
                function toggleFolderCreationMode() {
                    isFolderCreationMode = !isFolderCreationMode;
                    const container = document.getElementById('folderViewContainer');
                    const items = container.querySelectorAll('.torrent-item');
                    const createBtn = document.getElementById('createFolderBtn');
                    const cancelBtn = document.getElementById('cancelFolderBtn');
                    if (isFolderCreationMode) {
                        items.forEach(item => item.querySelector('.folder-checkbox').classList.remove('hidden'));
                        createBtn.innerHTML = '<i class="fas fa-check mr-2"></i>선택 완료';
                        cancelBtn.classList.remove('hidden');
                    } else {
                        items.forEach(item => {
                            const checkbox = item.querySelector('.folder-checkbox');
                            checkbox.classList.add('hidden');
                            checkbox.checked = false;
                        });
                        createBtn.innerHTML = '<i class="fas fa-folder-plus mr-2"></i>가상 폴더 만들기';
                        cancelBtn.classList.add('hidden');
                    }
                }

                function createVirtualFolder() {
                    const container = document.getElementById('folderViewContainer');
                    const selectedItems = container.querySelectorAll('.folder-checkbox:checked');
                    if (selectedItems.length === 0) {
                        alert("먼저 하나 이상의 항목을 선택해주세요.");
                        return;
                    }
                    const folderName = prompt("생성할 가상 폴더의 이름을 입력하세요:", "새 폴더");
                    if (!folderName) return;
                    const folderContent = document.createElement('div');
                    folderContent.className = 'p-2 border-t border-gray-300';
                    let totalSize = 0;
                    selectedItems.forEach(checkbox => {
                        const itemContainer = checkbox.closest('.torrent-item-container');
                        folderContent.appendChild(itemContainer);
                        totalSize += parseFloat(itemContainer.dataset.bytes || 0);
                    });
                    const details = document.createElement('details');
                    details.className = 'bg-gray-100 rounded-lg mb-2';
                    details.innerHTML = \`<summary class="p-3 cursor-pointer font-semibold text-gray-800 flex justify-between items-center hover:bg-gray-200 rounded-t-lg">
                            <div><i class="fas fa-folder text-yellow-500 mr-3"></i>\${folderName}</div>
                            <div class="text-sm font-normal text-gray-600">\${selectedItems.length}개 / \${opener.formatSize(totalSize)}</div>
                        </summary>\`;
                    details.appendChild(folderContent);
                    container.prepend(details);
                    toggleFolderCreationMode();
                    hasUnsavedChanges = true;
                }
                
                document.getElementById('saveBtn').addEventListener('click', saveLayout);
                document.getElementById('loadBtn').addEventListener('click', loadLayout);
                document.getElementById('createFolderBtn').addEventListener('click', () => {
                    if (isFolderCreationMode) createVirtualFolder();
                    else toggleFolderCreationMode();
                });
                document.getElementById('cancelFolderBtn').addEventListener('click', toggleFolderCreationMode);
            <\/script>
        </body>
        </html>
    `;
    
    newWindow.document.write(newWindowContent);
    newWindow.document.close();
}

function renderTorrentItemHTML(t, isNewWindow = false) {
    const onclickPrefix = isNewWindow ? "window.opener." : "";
    const buttonClasses = "w-9 h-9 flex items-center justify-center text-base rounded-lg";
    let potplayerButtonHTML = `<button class="${buttonClasses} btn-potplayer" title="PC 팟플레이어로 재생" onclick="${onclickPrefix}playInPotplayer('${t.id}', this)"><i class="fas fa-play"></i></button>`;
    if (isMobile()) {
        potplayerButtonHTML = `<button class="${buttonClasses} btn-link" title="새 탭에서 영상 열기" onclick="${onclickPrefix}openVideoStream('${t.id}', this)"><i class="fas fa-video"></i></button>`;
    }
    const commonActions = `<button class="${buttonClasses} btn-hide" title="목록에서 숨기기" onclick="${onclickPrefix}hideTorrentFromList(this)"><i class="fas fa-eye-slash"></i></button> <button class="${buttonClasses} btn-delete" title="RD 계정에서 영구 삭제" onclick="${onclickPrefix}deleteTorrent('${t.id}', this)"><i class="fas fa-trash"></i></button>`;
    const downloadedPrefixActions = potplayerButtonHTML + `<button class="${buttonClasses} btn-stream" title="웹 브라우저로 스트리밍" onclick="${onclickPrefix}streamFirstVideo('${t.id}', this)"><i class="fas fa-tv"></i></button> <button class="${buttonClasses} btn-rdpage" title="RD 페이지에서 보기" onclick="${onclickPrefix}openRdDownloaderPage('${t.id}', this)"><i class="fas fa-external-link-alt"></i></button> <button class="${buttonClasses} btn-download" title="다운로드/링크 보기" onclick="${onclickPrefix}getTorrentInfo('${t.id}', this)"><i class="fas fa-download"></i></button> <button class="${buttonClasses} btn-link" title="링크 복사 (파일 1개) / RD 페이지 열기 (2개 이상)" onclick="${onclickPrefix}copyLinks('${t.id}', this)"><i class="fas fa-link"></i></button>`;
    const progressBarColor = 'bg-blue-600';
    const formattedDate = new Date(t.added).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

    return `<div class="torrent-item-container" data-id="${t.id}" data-bytes="${t.bytes}">
        <div class="torrent-item border-b border-gray-200 p-3 hover:bg-gray-200 transition duration-200 flex items-center">
            <input type="checkbox" class="folder-checkbox hidden w-5 h-5 mr-4 cursor-pointer">
            <div class="flex-grow">
                <div class="flex justify-between items-start mb-2"> 
                    <h3 class="font-semibold text-gray-800 flex-1 mr-4 overflow-hidden text-ellipsis whitespace-nowrap min-w-0" title="${t.filename}">${t.filename || "Unknown"}</h3> 
                    <span class="px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${getStatusClass(t.status)}">${getStatusText(t.status)}</span> 
                </div> 
                <div class="flex justify-between items-center text-sm text-gray-600 mb-3">
                    <div class="flex items-center gap-x-4">
                        <span><i class="fas fa-hdd mr-1 text-gray-400"></i> ${formatSize(t.bytes)}</span>
                        <span><i class="fas fa-arrow-down mr-1 text-green-500"></i> ${formatSize(t.speed || 0)}/s</span>
                    </div>
                    <div class="text-right whitespace-nowrap"><i class="fas fa-clock mr-1 text-gray-400"></i><span>${formattedDate}</span></div>
                </div>
                ${t.progress >= 0 ? `<div class="w-full bg-gray-300 rounded-full h-2.5 mb-3"><div class="${progressBarColor} h-2.5 rounded-full" style="width: ${t.progress}%"></div></div>` : ""} 
                <div class="flex justify-between items-center mt-2"> 
                    <div>${t.status === "waiting_files_selection" ? `<button onclick="${onclickPrefix}selectFiles('${t.id}')" class="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700"><i class="fas fa-check-square mr-1"></i>파일 선택</button>` : ""}</div> 
                    <div class="flex gap-2 flex-wrap items-center"> ${t.status === "downloaded" ? downloadedPrefixActions + commonActions : commonActions} </div> 
                </div>
            </div>
        </div>
    </div>`;
}

/**
 * ★★★ [신규] 월별 그룹 HTML을 생성하는 재사용 가능한 함수
 */
function generateMonthlyGroupHTML(items, isNewWindow) {
    if (!items || items.length === 0) return '';
    
    const monthlyGroups = {};
    items.forEach(item => {
        const date = new Date(item.added);
        const key = \`${date.getFullYear()}-\${(date.getMonth() + 1).toString().padStart(2, '0')}\`; // "YYYY-MM"
        if (!monthlyGroups[key]) monthlyGroups[key] = [];
        monthlyGroups[key].push(item);
    });

    let monthlyHTML = '';
    Object.keys(monthlyGroups).sort().reverse().forEach(key => {
        const [year, month] = key.split('-');
        const itemsInMonth = monthlyGroups[key];
        const totalSize = itemsInMonth.reduce((sum, item) => sum + item.bytes, 0);
        monthlyHTML += \`<details class="bg-gray-100 rounded-lg mb-2">
            <summary class="p-3 cursor-pointer font-semibold text-gray-800 flex justify-between items-center hover:bg-gray-200 rounded-t-lg">
                <div><i class="fas fa-calendar-alt text-blue-500 mr-3"></i>\${year}년 \${parseInt(month, 10)}월</div>
                <div class="text-sm font-normal text-gray-600">\${itemsInMonth.length}개 / \${formatSize(totalSize)}</div>
            </summary>
            <div class="p-2 border-t border-gray-300">\${itemsInMonth.map(t => renderTorrentItemHTML(t, isNewWindow)).join('')}</div>
        </details>\`;
    });
    return monthlyHTML;
}


/**
 * 자동 그룹화된 폴더 뷰 HTML 생성 (월별 그룹화 포함)
 */
function generateAutomaticFolderViewHTML(torrents) {
    const getGroupKey = (filename) => {
        let cleanName = filename.replace(/[._]/g, ' ');
        const patterns = [/S\d{1,2}E\d{1,3}/i, /E\d{1,3}/i, /\d{1,3}회/, /\d{1,3}화/, /\d{4}p/, /\b(19|20)\d{2}\b/, /BluRay|WEBRip|HDTV|x264|H264|x265|HEVC/i];
        let title = cleanName;
        let foundPattern = false;
        for (const pattern of patterns) {
            const match = title.match(pattern);
            if (match && match.index > 0) {
                title = title.substring(0, match.index);
                foundPattern = true;
                break;
            }
        }
        const dateMatch = title.match(/\b\d{6}\b\s*$/);
        if(!foundPattern && dateMatch && dateMatch.index > 0) {
            title = title.substring(0, dateMatch.index);
        }
        return title.replace(/[-]/g, ' ').trim();
    };

    const groups = {};
    const singles = [];
    torrents.forEach(t => {
        const groupKey = getGroupKey(t.filename);
        if (groupKey) {
            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(t);
        } else {
            singles.push(t);
        }
    });

    let html = '';
    Object.keys(groups).sort().forEach(key => {
        const items = groups[key];
        if (items.length > 1) {
            const totalSize = items.reduce((sum, item) => sum + item.bytes, 0);
            html += \`<details class="bg-gray-100 rounded-lg mb-2">
                <summary class="p-3 cursor-pointer font-semibold text-gray-800 flex justify-between items-center hover:bg-gray-200 rounded-t-lg">
                    <div><i class="fas fa-folder text-yellow-500 mr-3"></i>\${key}</div>
                    <div class="text-sm font-normal text-gray-600">\${items.length}개 / \${formatSize(totalSize)}</div>
                </summary>
                <div class="p-2 border-t border-gray-300">\${items.map(t => renderTorrentItemHTML(t, true)).join('')}</div>
            </details>\`;
        } else {
            singles.push(...items);
        }
    });
    
    // ★★★ [수정됨] 단일 항목들을 월별로 그룹화하여 HTML에 추가
    html += generateMonthlyGroupHTML(singles, true);

    return html;
}