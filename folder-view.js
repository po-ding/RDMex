// ============== folder-view.js ==============
// 폴더 뷰/리스트 뷰 전환 및 렌더링 스크립트

// 전역 변수: 현재 보기 모드와 마지막으로 불러온 토렌트 목록
let currentViewMode = 'list';
let lastFetchedTorrents = [];

/**
 * 보기 모드를 'list'와 'tree' 간에 전환하고, 아이콘을 업데이트한 후 목록을 다시 렌더링합니다.
 */
function toggleTorrentView() {
    currentViewMode = currentViewMode === 'list' ? 'tree' : 'list';
    const iconEl = document.getElementById('viewModeIcon');
    const icon = iconEl.querySelector('i');
    
    if (currentViewMode === 'tree') {
        icon.classList.remove('fa-folder');
        icon.classList.add('fa-list');
        iconEl.title = "리스트 뷰로 전환";
    } else {
        icon.classList.remove('fa-list');
        icon.classList.add('fa-folder');
        iconEl.title = "폴더 뷰로 전환";
    }
    renderTorrents(); // 보기 모드에 맞게 다시 렌더링
}

/**
 * 현재 보기 모드에 따라 적절한 렌더링 함수를 호출합니다.
 */
function renderTorrents() {
    if (currentViewMode === 'tree') {
        displayTorrentsAsTree(lastFetchedTorrents);
    } else {
        displayTorrentsAsList(lastFetchedTorrents);
    }
}

/**
 * 개별 토렌트 항목의 전체 HTML 코드를 생성합니다.
 * @param {object} t - 토렌트 객체
 * @returns {string} - 토렌트 항목의 HTML 문자열
 */
function renderTorrentItemHTML(t) {
    const buttonClasses = "w-9 h-9 flex items-center justify-center text-base rounded-lg";
    let potplayerButtonHTML = isMobile() ?
        `<button class="${buttonClasses} btn-link" title="새 탭에서 영상 열기" onclick="openVideoStream('${t.id}', this)"><i class="fas fa-video"></i></button>` :
        `<button class="${buttonClasses} btn-potplayer" title="PC 팟플레이어로 재생" onclick="playInPotplayer('${t.id}', this)"><i class="fas fa-play"></i></button>`;

    const commonActions = `<button class="${buttonClasses} btn-hide" title="목록에서 숨기기" onclick="hideTorrentFromList(this)"><i class="fas fa-eye-slash"></i></button> <button class="${buttonClasses} btn-delete" title="RD 계정에서 영구 삭제" onclick="deleteTorrent('${t.id}', this)"><i class="fas fa-trash"></i></button>`;
    const downloadedPrefixActions = potplayerButtonHTML + `<button class="${buttonClasses} btn-stream" title="웹 브라우저로 스트리밍" onclick="streamFirstVideo('${t.id}', this)"><i class="fas fa-tv"></i></button> <button class="${buttonClasses} btn-rdpage" title="RD 페이지에서 보기" onclick="openRdDownloaderPage('${t.id}', this)"><i class="fas fa-external-link-alt"></i></button> <button class="${buttonClasses} btn-download" title="다운로드/링크 보기" onclick="getTorrentInfo('${t.id}', this)"><i class="fas fa-download"></i></button> <button class="${buttonClasses} btn-link" title="링크 복사 (파일 1개) / RD 페이지 열기 (2개 이상)" onclick="copyLinks('${t.id}', this)"><i class="fas fa-link"></i></button>`;
    const progressBarColor = 'bg-blue-600';

    const formattedDate = new Date(t.added).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

    return `<div class="torrent-item border-b border-gray-200 p-3 hover:bg-gray-200 transition duration-200"> 
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
            <div>${t.status === "waiting_files_selection" ? `<button onclick="selectFiles('${t.id}')" class="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700"><i class="fas fa-check-square mr-1"></i>파일 선택</button>` : ""}</div> 
            <div class="flex gap-2 flex-wrap items-center"> ${t.status === "downloaded" ? downloadedPrefixActions + commonActions : commonActions} </div> 
        </div> 
    </div>`;
}

/**
 * 토렌트 목록을 기본 리스트 형태로 표시합니다.
 * @param {Array} torrents - 토렌트 객체 배열
 */
function displayTorrentsAsList(torrents) {
    const listEl = document.getElementById("torrentList");
    if (torrents && torrents.length > 0) {
        listEl.innerHTML = torrents.map(t => renderTorrentItemHTML(t)).join("");
    } else {
        listEl.innerHTML = '<p class="text-gray-500 text-center py-8">활성 토렌트가 없습니다.</p>';
    }
}

/**
 * 토렌트 목록을 파일 이름 기반으로 그룹화하여 폴더(트리) 형태로 표시합니다.
 * @param {Array} torrents - 토렌트 객체 배열
 */
function displayTorrentsAsTree(torrents) {
    const listEl = document.getElementById("torrentList");
    if (!torrents || torrents.length === 0) {
        listEl.innerHTML = '<p class="text-gray-500 text-center py-8">활성 토렌트가 없습니다.</p>';
        return;
    }

    const groups = {};
    const singles = [];

    // 시리즈/시즌/년도/회차 패턴을 감지하는 정규식
    const seriesPattern = /(.+?)[. \t]+S(\d{1,2})E(\d{1,3})|(.+?)[. \t]+(\d{4})[. \t]+|(.+?)[. \t]+(\d{1,3})회/i;

    torrents.forEach(t => {
        const match = t.filename.match(seriesPattern);
        let groupKey = null;

        if (match) {
            // 가장 연관성 높은 키를 찾습니다 (SxxExx > yyyy > xx회 순)
            const keyCandidates = [match[1], match[4], match[6]];
            const bestKey = keyCandidates.find(key => key !== undefined);
            if (bestKey) {
                 groupKey = bestKey.replace(/[._]/g, ' ').trim();
            }
        }
        
        if (groupKey) {
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(t);
        } else {
            singles.push(t);
        }
    });

    let html = '';
    // 2개 이상인 항목만 그룹으로 묶고, 나머지는 단일 항목으로 처리
    Object.keys(groups).sort().forEach(key => {
        const items = groups[key];
        if (items.length > 1) {
            const totalSize = items.reduce((sum, item) => sum + item.bytes, 0);
            html += `<details class="bg-gray-100 rounded-lg mb-2">
                <summary class="p-3 cursor-pointer font-semibold text-gray-800 flex justify-between items-center hover:bg-gray-200 rounded-t-lg">
                    <div><i class="fas fa-folder-open text-yellow-500 mr-3"></i>${key}</div>
                    <div class="text-sm font-normal text-gray-600">${items.length}개 / ${formatSize(totalSize)}</div>
                </summary>
                <div class="p-2 border-t border-gray-300">${items.map(t => renderTorrentItemHTML(t)).join('')}</div>
            </details>`;
        } else {
            singles.push(...items); // 1개짜리 그룹은 단일 항목으로 편입
        }
    });

    // 단일 항목들을 이름순으로 정렬하여 렌더링
    singles.sort((a,b) => a.filename.localeCompare(b.filename));
    singles.forEach(t => {
        html += renderTorrentItemHTML(t);
    });

    listEl.innerHTML = html;
}