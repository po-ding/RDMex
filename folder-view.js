// ============== folder-view.js ==============
// 새 창 폴더 뷰 및 가상 폴더 생성/관리 스크립트

/**
 * 새 창을 열고, 팝업 차단 시 사용자에게 안내합니다.
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
            <title>토렌트 폴더 뷰</title>
            <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet" />
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" />
            <style>
                body { background-color: #f3f4f6; padding: 1.5rem; }
                .btn-potplayer { background-color: #4b3279; color: white; } .btn-potplayer:hover { background-color: #5d3f99; }
                .btn-stream { background-color: #8B5CF6; color: white; } .btn-stream:hover { background-color: #7C3AED; }
                .btn-rdpage { background-color: #3B82F6; color: white; } .btn-rdpage:hover { background-color: #2563EB; }
                .btn-download { background-color: #10B981; color: white; } .btn-download:hover { background-color: #059669; }
                .btn-link { background-color: #6B7280; color: white; } .btn-link:hover { background-color: #4B5563; }
                .btn-hide { background-color: #9CA3AF; color: white; } .btn-hide:hover { background-color: #6B7280; }
                .btn-delete { background-color: #EF4444; color: white; } .btn-delete:hover { background-color: #DC2626; }
                details summary::-webkit-details-marker { display: none; }
                details > summary { list-style: none; }
            </style>
        </head>
        <body>
            <div class="container mx-auto max-w-5xl">
                <div class="flex justify-between items-center mb-4 border-b pb-2">
                    <h1 class="text-2xl font-bold text-gray-800">토렌트 폴더 뷰 (${lastFetchedTorrents.length}개)</h1>
                    <div class="flex gap-2 items-center">
                         <button id="createFolderBtn" class="px-3 py-1 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 flex items-center" title="선택한 항목으로 가상 폴더 만들기">
                            <i class="fas fa-folder-plus mr-2"></i>가상 폴더 만들기
                        </button>
                        <button id="cancelFolderBtn" class="px-3 py-1 bg-gray-500 text-white text-sm font-semibold rounded-lg hover:bg-gray-600 hidden" title="취소">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div id="folderViewContainer">${initialViewHTML}</div>
            </div>

            <script>
                // 새 창 내에서 동작할 스크립트
                let isFolderCreationMode = false;

                function toggleFolderCreationMode() {
                    const container = document.getElementById('folderViewContainer');
                    const items = container.querySelectorAll('.torrent-item');
                    const createBtn = document.getElementById('createFolderBtn');
                    const cancelBtn = document.getElementById('cancelFolderBtn');
                    isFolderCreationMode = !isFolderCreationMode;

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
                    details.open = true;
                    details.innerHTML = \`<summary class="p-3 cursor-pointer font-semibold text-gray-800 flex justify-between items-center hover:bg-gray-200 rounded-t-lg">
                            <div><i class="fas fa-folder text-yellow-500 mr-3"></i>\${folderName}</div>
                            <div class="text-sm font-normal text-gray-600">\${selectedItems.length}개 / \${window.opener.formatSize(totalSize)}</div>
                        </summary>\`;
                    details.appendChild(folderContent);
                    container.prepend(details);
                    toggleFolderCreationMode();
                }

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

/**
 * 개별 토렌트 항목 HTML 생성 (isNewWindow 파라미터로 동작 분기)
 */
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

    return `<div class="torrent-item-container" data-bytes="${t.bytes}">
        <div class="torrent-item border-b border-gray-200 p-3 hover:bg-gray-200 transition duration-200 flex items-center">
            <input type="checkbox" class="folder-checkbox hidden w-5 h-5 mr-4 cursor-pointer">
            <div class="flex-grow">
                <div class="flex justify-between items-start mb-2"> 
                    <h3 class="font-semibold text-gray-800 flex-1 mr-4 overflow-hidden text-ellipsis whitespace-nowrap min-w-0" title="${t.filename}">${t.filename || "Unknown"}</h3> 
                    <span class="px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${window.opener ? window.opener.getStatusClass(t.status) : getStatusClass(t.status)}">${window.opener ? window.opener.getStatusText(t.status) : getStatusText(t.status)}</span> 
                </div> 
                <div class="flex justify-between items-center text-sm text-gray-600 mb-3">
                    <div class="flex items-center gap-x-4">
                        <span><i class="fas fa-hdd mr-1 text-gray-400"></i> ${window.opener ? window.opener.formatSize(t.bytes) : formatSize(t.bytes)}</span>
                        <span><i class="fas fa-arrow-down mr-1 text-green-500"></i> ${window.opener ? window.opener.formatSize(t.speed || 0) : formatSize(t.speed || 0)}/s</span>
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
 * 자동 그룹화된 폴더 뷰 HTML 생성
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
            html += `<details open class="bg-gray-100 rounded-lg mb-2">
                <summary class="p-3 cursor-pointer font-semibold text-gray-800 flex justify-between items-center hover:bg-gray-200 rounded-t-lg">
                    <div><i class="fas fa-folder-open text-yellow-500 mr-3"></i>${key}</div>
                    <div class="text-sm font-normal text-gray-600">${items.length}개 / ${formatSize(totalSize)}</div>
                </summary>
                <div class="p-2 border-t border-gray-300">${items.map(t => renderTorrentItemHTML(t, true)).join('')}</div>
            </details>`;
        } else {
            singles.push(...items);
        }
    });
    singles.sort((a,b) => a.filename.localeCompare(b.filename));
    singles.forEach(t => {
        html += renderTorrentItemHTML(t, true);
    });

    return html;
}