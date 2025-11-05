// ============== app.js (All-in-One Final Version) ==============
const API_BASE = "https://api.real-debrid.com/rest/1.0";
let refreshTimer = null;
let fastRefreshCount = 0;
let slowRefreshCount = 0;
let lastFetchedTorrents = [];

// =======================================================================
//                           보조 함수들
// =======================================================================
function addLog(message, type = "info") { const logEl = document.getElementById("statusLog"); const time = new Date().toLocaleTimeString(); const iconClass = type === "error" ? "fa-times-circle text-red-500" : type === "success" ? "fa-check-circle text-green-500" : type === "warning" ? "fa-exclamation-triangle text-yellow-500" : "fa-info-circle text-blue-500"; const initialMsg = document.getElementById("initialLogMessage"); if (initialMsg) initialMsg.remove(); const entry = document.createElement("div"); entry.className = `mb-2 p-2 border-l-4 ${type === "error" ? "border-red-400 bg-red-50" : type === "success" ? "border-green-400 bg-green-50" : type === "warning" ? "border-yellow-400 bg-yellow-50" : "border-blue-400 bg-blue-50"}`; entry.innerHTML = `<span class="text-xs text-gray-500">[${time}]</span> <i class="fas ${iconClass} ml-2 mr-2"></i> <span>${message}</span>`; logEl.appendChild(entry); logEl.scrollTop = logEl.scrollHeight; }
function showToast(message, type = "info") { const container = document.getElementById("toastContainer"); const toast = document.createElement("div"); const iconClass = type === "success" ? "fa-check-circle" : type === "error" ? "fa-exclamation-circle" : type === "warning" ? "fa-exclamation-triangle" : "fa-info-circle"; const bgColor = type === "success" ? "bg-green-500" : type === "error" ? "bg-red-600" : type === "warning" ? "bg-yellow-500" : "bg-blue-500"; toast.className = `fade-in px-6 py-4 rounded-lg text-white mb-4 shadow-lg ${bgColor}`; toast.innerHTML = `<div class="flex items-center"><i class="fas ${iconClass} mr-3"></i><span class="font-semibold">${message}</span></div>`; container.appendChild(toast); setTimeout(() => { toast.style.opacity = "0"; setTimeout(() => toast.remove(), 300); }, 5000); }
function setLoading(button, isLoading) { if (!button) return; const originalText = button.dataset.originalText || button.innerHTML; if (isLoading) { button.dataset.originalText = originalText; button.disabled = true; button.classList.add("opacity-75", "cursor-not-allowed"); button.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`; } else { if (button.dataset.originalText) { button.innerHTML = button.dataset.originalText; delete button.dataset.originalText; } button.disabled = false; button.classList.remove("opacity-75", "cursor-not-allowed"); } }
function getStatusClass(status) { return { waiting_files_selection: "bg-yellow-100 text-yellow-800", queued: "bg-gray-200 text-gray-800", downloading: "bg-blue-100 text-blue-800", downloaded: "bg-green-100 text-green-800", error: "bg-red-100 text-red-800", dead: "bg-red-200 text-red-900" }[status] || "bg-gray-100 text-gray-800"; }
function getStatusText(status) { return { waiting_files_selection: "파일 선택 대기", queued: "대기 중", downloading: "다운로드 중", downloaded: "완료", error: "오류", dead: "데드 토렌트" }[status] || status; }
function formatSize(bytes) { if (bytes === 0) return "0 B"; const k = 1024; const sizes = ["B", "KB", "MB", "GB", "TB"]; const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]; }
function isMobile() { return ('ontouchstart' in window || navigator.maxTouchPoints > 0) && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }

// =======================================================================
//                     메인 화면 기능 함수들
// =======================================================================
function displayFileName(file) { const dropZoneContent = document.getElementById("dropZoneContent"); if (file) { dropZoneContent.innerHTML = `<div class="text-center"><i class="fas fa-check-circle text-green-500 mr-2"></i> <strong>${file.name}</strong> (${formatSize(file.size)})</div>`; } else { dropZoneContent.innerHTML = `<i class="fas fa-cloud-upload-alt text-4xl text-gray-400"></i><p class="mt-2 text-sm text-gray-600">.torrent 파일을 드롭하거나 클릭하여 추가</p>`; } }
function handleFileSelectionChange() { const fileInput = document.getElementById('torrentFile'); const directUploadButton = document.getElementById('directUploadButton'); const file = fileInput.files.length > 0 ? fileInput.files[0] : null; displayFileName(file); if (file) { directUploadButton.disabled = false; directUploadButton.classList.remove('opacity-50', 'cursor-not-allowed'); } else { directUploadButton.disabled = true; directUploadButton.classList.add('opacity-50', 'cursor-not-allowed'); } }
function fileToMagnet(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = function(e) { try { const torrentDataString = e.target.result; const decoded = Bencode.decode(torrentDataString); if (!decoded.info) throw new Error("토렌트 파일에 'info' 메타데이터가 없습니다."); const infoBencoded = Bencode.encode(decoded.info); const sha1 = new SHA1(); sha1.update(infoBencoded); const infoHash = sha1.digest(); let binaryHashString = ''; for (let i = 0; i < infoHash.length; i++) { binaryHashString += String.fromCharCode(infoHash[i]); } const infoHashBase32 = Base32.encode(binaryHashString).replace(/=/g, '').toLowerCase(); const magnetURI = `magnet:?xt=urn:btih:${infoHashBase32}&dn=${encodeURIComponent(decoded.info.name || '')}`; resolve(magnetURI); } catch (error) { const errorMessage = (error instanceof Error) ? error.message : error; reject(new Error(errorMessage)); } }; reader.onerror = () => reject(new Error("파일을 읽는 중 오류가 발생했습니다.")); reader.readAsBinaryString(file); }); }
async function handleConvertUpload(button) { const magnetInput = document.getElementById("magnetInput"); const fileInput = document.getElementById('torrentFile'); setLoading(button, true); try { if (fileInput.files.length > 0) { await convertAndUploadAsMagnet(fileInput.files[0]); showToast(`'${fileInput.files[0].name}' 파일이 RD에 성공적으로 추가되었습니다.`, "success"); fileInput.value = ''; handleFileSelectionChange(); } else if (magnetInput.value.trim().split('\n').map(l => l.trim()).filter(l => l.startsWith('magnet:?')).length > 0) { await uploadMagnetLinks(magnetInput.value); magnetInput.value = ''; magnetInput.dispatchEvent(new Event('blur')); } else { showToast("추가할 마그넷 링크 또는 .torrent 파일이 없습니다.", "warning"); } } catch (error) { showToast(`처리 실패: ${error.message}`, "error"); addLog(error.message, "error"); } finally { setLoading(button, false); } }
async function handleDirectUpload(button) { const fileInput = document.getElementById('torrentFile'); if (fileInput.files.length === 0) { showToast(".torrent 파일을 먼저 선택해주세요.", "warning"); return; } const file = fileInput.files[0]; setLoading(button, true); try { await uploadTorrentFileDirectly(file); showToast(`'${file.name}' 파일이 RD에 성공적으로 추가되었습니다.`, "success"); fileInput.value = ''; handleFileSelectionChange(); } catch (error) { showToast(`파일 직접 전송 실패: ${error.message}`, "error"); addLog(error.message, "error"); } finally { setLoading(button, false); } }
async function convertAndUploadAsMagnet(file) { const trackerInput = document.getElementById("trackerInput"); const magnetURI = await fileToMagnet(file); const trackers = trackerInput.value.trim().split("\n").filter(Boolean); const trackerString = trackers.map(tr => `&tr=${encodeURIComponent(tr.trim())}`).join(""); const finalMagnet = magnetURI + trackerString; const response = await makeApiCall("/torrents/addMagnet", { method: "POST", headers: { "Content-Type": "application/x-form-urlencoded" }, body: `magnet=${encodeURIComponent(finalMagnet)}` }); if (!response || !response.id) throw new Error("API 응답에서 토렌트 ID를 받지 못했습니다."); await waitForAndSelectFiles(response.id); setTimeout(() => startOrResetRefreshCycle(), 1500); }
async function uploadMagnetLinks(magnetData) { const trackerInput = document.getElementById("trackerInput"); const magnets = magnetData.trim().split('\n').map(line => line.trim()).filter(line => line.startsWith('magnet:?')); let successCount = 0, errorCount = 0; const trackers = trackerInput.value.trim().split("\n").filter(Boolean); const trackerString = trackers.map(tr => `&tr=${encodeURIComponent(tr.trim())}`).join(""); for (const [index, magnet] of magnets.entries()) { try { const finalMagnet = magnet + trackerString; const response = await makeApiCall("/torrents/addMagnet", { method: "POST", headers: { "Content-Type": "application/x-form-urlencoded" }, body: `magnet=${encodeURIComponent(finalMagnet)}` }); if (response && response.id) { await waitForAndSelectFiles(response.id); successCount++; } else { throw new Error("API 응답에서 토렌트 ID를 받지 못했습니다."); } } catch (e) { errorCount++; addLog(`[${index + 1}/${magnets.length}] 처리 중 오류 발생: ${e.message}`, "error"); } } if (successCount > 0) showToast(`총 ${successCount}개 항목의 다운로드를 성공적으로 시작했습니다.`, "success"); if (errorCount > 0) showToast(`${errorCount}개 항목 추가에 실패했습니다. 로그를 확인하세요.`, "error"); setTimeout(() => startOrResetRefreshCycle(), 1500); }
async function uploadTorrentFileDirectly(file) { const fileData = await file.arrayBuffer(); const response = await makeApiCall("/torrents/addTorrent", { method: "PUT", body: fileData }); if (!response || !response.id) throw new Error("API 응답에서 토렌트 ID를 받지 못했습니다."); await waitForAndSelectFiles(response.id); setTimeout(() => startOrResetRefreshCycle(), 1500); }
async function waitForAndSelectFiles(torrentId) { for (let i = 0; i < 15; i++) { const info = await makeApiCall(`/torrents/info/${torrentId}`); if (info.status === 'waiting_files_selection') { await makeApiCall(`/torrents/selectFiles/${torrentId}`, { method: "POST", headers: { "Content-Type": "application/x-form-urlencoded" }, body: "files=all" }); return; } if (['downloading', 'downloaded', 'queued', 'error', 'dead'].includes(info.status)) return; await new Promise(resolve => setTimeout(resolve, 2000)); } }
function getToken() { return localStorage.getItem("rdToken"); }
function saveToken() { const token = document.getElementById("apiToken").value.trim(); if (token) { localStorage.setItem("rdToken", token); showToast("API 토큰이 저장되었습니다", "success"); testConnection(); } else { showToast("토큰을 입력해주세요", "warning"); } }
async function makeApiCall(endpoint, options = {}) { const token = getToken(); if (!token) throw new Error("API 토큰이 설정되지 않았습니다."); const url = `${API_BASE}${endpoint}`; const headers = { Authorization: `Bearer ${token}`, ...(options.headers || {}) }; const finalOptions = { ...options, headers }; try { const response = await fetch(url, finalOptions); if (response.status === 204) return null; const data = await response.json(); if (!response.ok) { const errorDetails = data && data.error ? `${data.error_code || ''} - ${data.error}` : response.statusText; throw new Error(`API 오류: ${response.status} - ${errorDetails}`); } return data; } catch (error) { addLog(`API 호출 실패: ${error.message}`, "error"); throw error; } }
function scheduledRefresh() { if (fastRefreshCount > 0) { refreshTorrents(); fastRefreshCount--; if (fastRefreshCount === 0) { clearInterval(refreshTimer); if (slowRefreshCount > 0) { refreshTimer = setInterval(scheduledRefresh, 300000); } } } else if (slowRefreshCount > 0) { refreshTorrents(); slowRefreshCount--; if (slowRefreshCount === 0) { clearInterval(refreshTimer); refreshTimer = null; } } else { if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; } } }
function startOrResetRefreshCycle() { if (refreshTimer) clearInterval(refreshTimer); fastRefreshCount = 5; slowRefreshCount = 11; scheduledRefresh(); refreshTimer = setInterval(scheduledRefresh, 60000); }
async function fetchBestTrackers() { const trackerInput = document.getElementById("trackerInput"); const statusIcon = document.getElementById("trackerStatusIcon"); const updateTimeEl = document.getElementById("trackerUpdateTime"); const curatedTrackers = [ 'udp://tracker.opentrackr.org:1337/announce', 'udp://open.stealth.si:80/announce', 'udp://exodus.desync.com:6969/announce', 'udp://tracker.torrent.eu.org:451/announce', 'udp://tracker.cyberia.is:6969/announce', 'udp://tracker.openbittrent.com:80/announce', 'udp://tracker.zer0day.to:1337/announce', 'udp://p4p.arenabg.com:1337/announce', 'udp://tracker.leechers-paradise.org:6969/announce', 'udp://9.rarbg.to:2710/announce' ]; const externalTrackerUrls = [ 'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt' ]; statusIcon.innerHTML = '<i class="fas fa-spinner loading text-purple-500"></i>'; try { const responses = await Promise.all(externalTrackerUrls.map(url => fetch(url))); for (const response of responses) { if (!response.ok) throw new Error(`서버 응답 오류: ${response.status} for ${response.url}`); } const externalTexts = await Promise.all(responses.map(res => res.text())); const combinedTrackers = curatedTrackers.concat(externalTexts.join('\n').split('\n')); const uniqueTrackers = [...new Set(combinedTrackers.map(l => l.trim()).filter(Boolean))]; if (uniqueTrackers.length > 0) { trackerInput.value = uniqueTrackers.join('\n'); statusIcon.innerHTML = '<i class="fas fa-check-circle text-green-500" title="최신 트래커 로딩 완료"></i>'; const now = new Date(); const formattedTime = now.toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); updateTimeEl.innerHTML = `${uniqueTrackers.length}개<br class="md:hidden"> ${formattedTime}`; } else { throw new Error('불러온 트래커 목록이 비어있습니다.'); } } catch (error) { statusIcon.innerHTML = '<i class="fas fa-times-circle text-red-500" title="트래커 로딩 실패"></i>'; addLog(`트래커 로딩 실패: ${error.message}`, 'error'); updateTimeEl.textContent = '업데이트 실패'; } }

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

async function refreshTorrents() {
    try {
        addLog("토렌트 목록을 불러오는 중...");
        const torrents = await makeApiCall("/torrents?limit=1000");
        lastFetchedTorrents = torrents;
        const totalBytes = torrents.reduce((sum, torrent) => sum + torrent.bytes, 0);
        document.getElementById('apiListSize').innerHTML = `📚 ${formatSize(totalBytes)}`;
        const listEl = document.getElementById("torrentList");
        if (torrents && torrents.length > 0) {
            listEl.innerHTML = torrents.map(t => renderTorrentItemHTML(t, false)).join("");
        } else {
            listEl.innerHTML = '<p class="text-gray-500 text-center py-8">활성 토렌트가 없습니다.</p>';
        }
    } catch (e) {
        showToast("토렌트 목록 로드 실패: " + e.message, "error");
        document.getElementById("torrentList").innerHTML = `<p class="text-red-500 text-center py-8">${e.message}</p>`;
    }
}

function hideTorrentFromList(buttonElement) { const torrentItem = buttonElement.closest('.torrent-item-container'); if (torrentItem) { torrentItem.style.display = 'none'; const targetWindow = window.opener || window; targetWindow.addLog("항목을 현재 목록에서 숨겼습니다.", "info"); targetWindow.showToast("목록에서 숨김 처리되었습니다.", "info"); } }
async function deleteTorrent(id, buttonElement) { const targetWindow = window.opener || window; if (!confirm("이 토렌트를 Real-Debrid 계정에서 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return; const torrentItem = buttonElement.closest('.torrent-item-container'); setLoading(buttonElement, true); try { await makeApiCall(`/torrents/delete/${id}`, { method: "DELETE" }); targetWindow.showToast("토렌트가 RD 계정에서 삭제되었습니다", "success"); targetWindow.addLog(`ID ${id}: RD 계정에서 영구적으로 삭제되었습니다.`, 'success'); if (torrentItem) torrentItem.remove(); } catch (e) { targetWindow.showToast("삭제 실패: " + e.message, "error"); targetWindow.addLog(`ID ${id} 삭제 실패: ${e.message}`, 'error'); setLoading(buttonElement, false); } }
async function streamFirstVideo(torrentId, button) { setLoading(button, true); const targetWindow = window.opener || window; try { const info = await makeApiCall(`/torrents/info/${torrentId}`); const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv']; let firstVideoLink = null; if (info && info.files) { const videoFile = info.files.find(file => videoExtensions.some(ext => file.path.toLowerCase().endsWith(ext)) && file.selected === 1); if (videoFile) { firstVideoLink = info.links[videoFile.id - 1]; } } if (!firstVideoLink) { throw new Error("스트리밍 가능한 비디오 파일을 찾지 못했습니다."); } const unrestrictInfo = await makeApiCall(`/unrestrict/link`, { method: 'POST', headers: { 'Content-Type': 'application/x-form-urlencoded' }, body: `link=${encodeURIComponent(firstVideoLink)}` }); if (unrestrictInfo && unrestrictInfo.id) { const streamingUrl = `https://real-debrid.com/streaming-${unrestrictInfo.id}`; window.open(streamingUrl, '_blank'); } else { throw new Error("스트리밍 링크를 생성하지 못했습니다."); } } catch (error) { targetWindow.showToast(`웹 스트리밍 실패: ${error.message}`, "error"); } finally { setLoading(button, false); } }
async function openVideoStream(torrentId, button) { setLoading(button, true); const targetWindow = window.opener || window; try { const info = await makeApiCall(`/torrents/info/${torrentId}`); const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv']; let videoRdLink = null; if (info && info.files) { const videoFile = info.files.find(file => videoExtensions.some(ext => file.path.toLowerCase().endsWith(ext)) && file.selected === 1); if (videoFile) { videoRdLink = info.links[videoFile.id - 1]; } } if (!videoRdLink) { throw new Error("재생 가능한 비디오 파일을 찾지 못했습니다."); } const unrestrictInfo = await makeApiCall(`/unrestrict/link`, { method: 'POST', headers: { 'Content-Type': 'application/x-form-urlencoded' }, body: `link=${encodeURIComponent(videoRdLink)}` }); if (unrestrictInfo && unrestrictInfo.download) { window.open(unrestrictInfo.download, '_blank'); } else { throw new Error("실제 스트리밍 링크를 생성하지 못했습니다."); } } catch (error) { targetWindow.showToast(`영상 열기 실패: ${error.message}`, "error"); } finally { setLoading(button, false); } }
async function playInPotplayer(torrentId, button) { setLoading(button, true); const targetWindow = window.opener || window; try { const info = await makeApiCall(`/torrents/info/${torrentId}`); const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv']; let videoRdLink = null; if (info && info.files) { const videoFile = info.files.find(file => videoExtensions.some(ext => file.path.toLowerCase().endsWith(ext)) && file.selected === 1); if (videoFile) { videoRdLink = info.links[videoFile.id - 1]; } } if (!videoRdLink) { throw new Error("재생 가능한 비디오 파일을 찾지 못했습니다."); } const unrestrictInfo = await makeApiCall(`/unrestrict/link`, { method: 'POST', headers: { 'Content-Type': 'application/x-form-urlencoded' }, body: `link=${encodeURIComponent(videoRdLink)}` }); if (unrestrictInfo && unrestrictInfo.download) { window.location.href = 'potplayer://' + unrestrictInfo.download; } else { throw new Error("실제 스트리밍 링크를 생성하지 못했습니다."); } } catch (error) { targetWindow.showToast(`팟플레이어 재생 실패: ${error.message}`, "error"); } finally { setLoading(button, false); } }
async function deleteCompleted() { if (!confirm("완료된 모든 토렌트를 Real-Debrid 계정에서 영구적으로 삭제하시겠습니까?")) return; try { const torrents = await makeApiCall("/torrents?limit=1000"); const completed = torrents.filter(t => t.status === 'downloaded'); if (completed.length === 0) { showToast("삭제할 완료된 토렌트가 없습니다.", "info"); return; } let deletedCount = 0; for (const torrent of completed) { await makeApiCall(`/torrents/delete/${torrent.id}`, { method: "DELETE" }); deletedCount++; } showToast(`${deletedCount}개의 완료된 토렌트가 삭제되었습니다.`, "success"); await refreshTorrents(); } catch (error) { showToast("완료된 토렌트 삭제 중 오류 발생.", "error"); } }
async function selectFiles(id) { try { await makeApiCall(`/torrents/selectFiles/${id}`, { method: "POST", headers: { "Content-Type": "application/x-form-urlencoded" }, body: "files=all" }); showToast("모든 파일이 선택되어 다운로드가 시작됩니다.", "success"); await refreshTorrents(); } catch (e) { showToast("파일 선택 실패: " + e.message, "error"); } }
async function openRdDownloaderPage(torrentId, button) { setLoading(button, true); try { const info = await makeApiCall(`/torrents/info/${torrentId}`); if (info && info.links && info.links.length > 0) { const validLinks = info.links.filter(Boolean); if (validLinks.length > 0) { window.open(`https://real-debrid.com/downloader?links=${encodeURIComponent(validLinks.join('\n'))}`, '_blank'); } else { throw new Error("유효한 파일 링크가 없습니다."); } } else { throw new Error("파일 정보를 찾을 수 없습니다."); } } catch (error) { showToast(`RD 페이지 열기 실패: ${error.message}`, "error"); } finally { setLoading(button, false); } }
async function unrestrictAndGetLinks(torrentId) { const info = await makeApiCall(`/torrents/info/${torrentId}`); if (!info || !info.links || info.links.length === 0) { throw new Error("처리할 파일 링크를 찾을 수 없습니다."); } const unrestrictPromises = info.links.map(link => makeApiCall('/unrestrict/link', { method: 'POST', headers: { 'Content-Type': 'application/x-form-urlencoded' }, body: `link=${encodeURIComponent(link)}` })); const results = await Promise.all(unrestrictPromises); return results.filter(r => r && r.download).map(r => r.download); }
async function copyLinks(torrentId, button) { setLoading(button, true); try { const downloadableLinks = await unrestrictAndGetLinks(torrentId); if (downloadableLinks.length === 1) { await navigator.clipboard.writeText(downloadableLinks[0]); showToast("1개 파일의 링크가 클립보드에 복사되었습니다.", 'success'); } else if (downloadableLinks.length > 1) { showToast(`${downloadableLinks.length}개 파일이 있어 RD 페이지로 이동합니다.`, "info"); await openRdDownloaderPage(torrentId, button); } else { throw new Error("유효한 다운로드 링크를 생성하지 못했습니다."); } } catch (error) { showToast(`링크 처리 실패: ${error.message}`, "error"); } finally { if (!button.disabled) { setLoading(button, false); } } }
async function getTorrentInfo(torrentId, button) { const MIN_FILE_SIZE_BYTES = 500 * 1024 * 1024; setLoading(button, true); const targetWindow = window.opener || window; targetWindow.showToast("다운로드 링크를 생성 중입니다...", "info"); try { const info = await makeApiCall(`/torrents/info/${torrentId}`); if (!info || !info.files || info.files.length === 0) { throw new Error("다운로드할 파일 정보를 찾을 수 없습니다."); } const filesWithLinks = info.files.map((file, index) => ({...file, privateLink: info.links[index]})); const filesToProcess = filesWithLinks.filter(file => file.bytes >= MIN_FILE_SIZE_BYTES); const hiddenFilesCount = filesWithLinks.length - filesToProcess.length; if (filesToProcess.length === 0) { throw new Error(`모든 파일이 ${formatSize(MIN_FILE_SIZE_BYTES)} 미만이라 처리할 파일이 없습니다.`); } const unrestrictPromises = filesToProcess.map(file => makeApiCall('/unrestrict/link', { method: 'POST', headers: { 'Content-Type': 'application/x-form-urlencoded' }, body: `link=${encodeURIComponent(file.privateLink)}`}).then(result => ({ ...file, ...result })).catch(err => { return { ...file, error: true }; })); const filesWithRealLinks = (await Promise.all(unrestrictPromises)).filter(f => f && f.download && !f.error); if (filesWithRealLinks.length === 0) { throw new Error("모든 유효 파일의 링크를 생성하지 못했습니다."); } const fileListHTML = filesWithRealLinks.map(file => { const isStreamable = file.streamingLink && /\.(mkv|mp4|avi|mov|wmv|flv)$/i.test(file.path); return `<li class="p-2 my-1 border border-gray-200 rounded-md flex justify-between items-center text-sm hover:bg-gray-50 transition-colors"><span class="flex-1 mr-2 break-all text-gray-800"><i class="fas ${isStreamable ? 'fa-file-video' : 'fa-file-alt'} mr-2 text-gray-500"></i>${file.path} <span class="text-gray-500">(${formatSize(file.bytes)})</span></span><div class="flex-shrink-0 flex items-center gap-2"><button onclick="navigator.clipboard.writeText('${file.download}'); window.opener.showToast('링크가 복사되었습니다.', 'success');" class="px-3 py-1 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600 whitespace-nowrap"><i class="fas fa-copy mr-1"></i>링크 복사</button>${isStreamable ? `<a href="${file.streamingLink}" target="_blank" class="px-3 py-1 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 whitespace-nowrap"><i class="fas fa-play mr-1"></i>스트리밍</a>` : ''}<a href="${file.download}" target="_blank" class="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 whitespace-nowrap"><i class="fas fa-download mr-1"></i>다운로드</a></div></li>`; }).join(''); const modalHTML = `<div id="nativeDownloaderModal" class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 fade-in" onclick="this.remove()"><div class="bg-white rounded-lg shadow-2xl p-6 max-w-4xl w-full max-h-[90vh] flex flex-col" onclick="event.stopPropagation()"><div class="flex justify-between items-center mb-4 border-b border-gray-200 pb-3"><h3 class="text-xl font-semibold text-gray-800 flex-shrink-1 mr-4 overflow-hidden text-ellipsis whitespace-nowrap" title="${info.filename}">${info.filename}</h3><button onclick="document.getElementById('nativeDownloaderModal').remove()" class="text-gray-500 hover:text-gray-800 text-2xl font-bold">&times;</button></div><div id="file-list-container" class="overflow-y-auto flex-grow pr-2">${hiddenFilesCount > 0 ? `<p class="text-sm text-gray-600 mb-3 p-2 bg-gray-100 rounded-md text-center"><i class="fas fa-info-circle mr-2 text-gray-500"></i>${hiddenFilesCount}개의 저용량 파일(${formatSize(MIN_FILE_SIZE_BYTES)} 미만)이 목록에서 자동으로 제외되었습니다.</p>` : ''}<ul class="space-y-1">${fileListHTML}</ul></div><div class="mt-4 pt-4 border-t border-gray-200 flex justify-end"><button onclick="document.getElementById('nativeDownloaderModal').remove()" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">닫기</button></div></div></div>`; document.body.insertAdjacentHTML('beforeend', modalHTML); targetWindow.showToast("링크 생성 완료!", "success"); } catch (error) { targetWindow.showToast(`링크 생성 중 오류: ${error.message}`, "error"); targetWindow.showToast("자동 링크 생성에 실패하여 RD 페이지를 엽니다.", "info"); openRdDownloaderPage(torrentId, button); } finally { setLoading(button, false); } }
async function testConnection() { const apiCombinedStatusEl = document.getElementById('apiCombinedStatus'); apiCombinedStatusEl.innerHTML = `<span class="font-bold text-yellow-500">확인 중...</span>`; try { const user = await makeApiCall("/user"); showToast(`연결 성공! 사용자: ${user.username}`, "success"); if (user.type === 'premium' && user.expiration) { const expirationDate = new Date(user.expiration); const now = new Date(); const diffDays = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24)); const formattedExpiration = expirationDate.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); let dDayText = `D-${diffDays}`; let colorClass = 'text-green-600'; if (diffDays <= 0) { dDayText = '만료'; colorClass = 'text-red-600'; } else if (diffDays <= 7) { colorClass = 'text-yellow-600'; showToast(`프리미엄 만료일이 ${diffDays}일 남았습니다.`, 'warning'); } apiCombinedStatusEl.innerHTML = `<span class="font-semibold ${colorClass}">${formattedExpiration} (<span class="font-black">${dDayText}</span>)</span>, <span class="font-bold text-blue-600">${user.points}P</span>`; } else { apiCombinedStatusEl.innerHTML = `<span class="font-bold text-red-600">프리미엄 아님</span>`; } } catch (e) { showToast(`연결 실패: ${e.message}`, "error"); apiCombinedStatusEl.innerHTML = `<span class="font-bold text-red-500" title="${e.message}">연결 실패</span>`; } }

function initializeApp(){
    const savedToken = localStorage.getItem("rdToken") || "";
    document.getElementById("apiToken").value = savedToken;
    if (savedToken) { testConnection(); } else { document.getElementById('apiCombinedStatus').innerHTML = `<span class="font-bold text-gray-500">토큰 없음</span>`; }
    fetchBestTrackers();
    startOrResetRefreshCycle();
    const dropZone = document.getElementById("dropZone");
    const fileInput = document.getElementById("torrentFile");
    fileInput.addEventListener("change", handleFileSelectionChange);
    dropZone.addEventListener("click", () => fileInput.click());
    ["dragover", "dragleave", "drop"].forEach(eventName => { dropZone.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }); });
    ["dragenter", "dragover"].forEach(eventName => { dropZone.addEventListener(eventName, () => dropZone.classList.add("border-blue-400", "bg-blue-50")); });
    ["dragleave", "drop"].forEach(eventName => { dropZone.addEventListener(eventName, () => dropZone.classList.remove("border-blue-400", "bg-blue-50")); });
    dropZone.addEventListener("drop", event => { const files = event.dataTransfer.files; if (files.length > 0 && files[0].name.endsWith(".torrent")) { fileInput.files = files; handleFileSelectionChange(); } else { showToast("유효한 .torrent 파일이 아닙니다", "error"); } });
    const magnetInput = document.getElementById('magnetInput');
    const magnetPlaceholder = document.getElementById('magnetPlaceholder');
    magnetInput.addEventListener('input', () => { magnetPlaceholder.style.opacity = magnetInput.value !== '' ? '0' : '1'; });
    magnetInput.addEventListener('focus', () => magnetPlaceholder.style.opacity = '0');
    magnetInput.addEventListener('blur', () => { if (magnetInput.value === '') magnetPlaceholder.style.opacity = '1'; });
}

document.addEventListener("DOMContentLoaded", initializeApp);

// =======================================================================
//                     새 창(폴더 뷰) 관련 함수들
// =======================================================================
function openFolderViewInNewWindow() {
    if (lastFetchedTorrents.length === 0) {
        showToast("먼저 토렌트 목록을 새로고침 해주세요.", "warning");
        return;
    }
    const newWindow = window.open("", "_blank");
    if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
        showToast("팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.", "error");
        return;
    }
    newWindow.document.write(`
        <!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>로딩 중...</title></head><body></body></html>
    `);
    newWindow.document.close();
    
    // 새 창의 로딩이 끝난 후 스크립트 실행
    newWindow.onload = () => {
        newWindow.document.title = "토렌트 가상 폴더 뷰";
        newWindow.document.body.innerHTML = `
            <head>
                <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet" />
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" />
                <style>
                    body { background-color: #f3f4f6; } .btn-potplayer { background-color: #4b3279; color: white; } .btn-potplayer:hover { background-color: #5d3f99; } .btn-stream { background-color: #8B5CF6; color: white; } .btn-stream:hover { background-color: #7C3AED; } .btn-rdpage { background-color: #3B82F6; color: white; } .btn-rdpage:hover { background-color: #2563EB; } .btn-download { background-color: #10B981; color: white; } .btn-download:hover { background-color: #059669; } .btn-link { background-color: #6B7280; color: white; } .btn-link:hover { background-color: #4B5563; } .btn-hide { background-color: #9CA3AF; color: white; } .btn-hide:hover { background-color: #6B7280; } .btn-delete { background-color: #EF4444; color: white; } .btn-delete:hover { background-color: #DC2626; } details summary::-webkit-details-marker { display: none; } details > summary { list-style: none; }
                    .fixed-controls { position: fixed; top: 50%; right: 1.5rem; transform: translateY(-50%); z-index: 50; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
                </style>
            </head>
            <body>
                <div class="container mx-auto max-w-5xl p-4 pb-32">
                    <div class="flex justify-between items-center mb-4 border-b pb-2">
                        <h1 class="text-2xl font-bold text-gray-800"></h1>
                        <div class="flex gap-2 items-center">
                            <button id="loadBtn" class="px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 flex items-center" title="저장된 폴더 구조 불러오기"><i class="fas fa-upload mr-2"></i>불러오기</button>
                            <button id="saveBtn" class="px-3 py-1 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 flex items-center" title="현재 폴더 구조 저장하기"><i class="fas fa-save mr-2"></i>저장</button>
                        </div>
                    </div>
                    <div id="folderViewContainer"></div>
                </div>
                <div class="fixed-controls">
                     <button id="createFolderBtn" class="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 flex items-center shadow-lg transition-transform hover:scale-105" title="선택한 항목으로 가상 폴더 만들기"><i class="fas fa-folder-plus mr-2"></i>가상 폴더 만들기</button>
                     <button id="cancelFolderBtn" class="px-4 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 hidden shadow-lg" title="취소"><i class="fas fa-times"></i></button>
                </div>
            </body>
        `;

        const opener = window.opener;
        const document = newWindow.document;
        let isFolderCreationMode = false, hasUnsavedChanges = false;
        const LAYOUT_STORAGE_KEY = 'rdmex_virtual_folder_layout';
        const folderViewContainer = document.getElementById('folderViewContainer');
        const h1 = document.querySelector('h1');

        newWindow.addEventListener('beforeunload', (e) => { if (hasUnsavedChanges) { e.preventDefault(); e.returnValue = ''; } });

        function saveLayout() { /* ... 로직은 동일 ... */ }
        function loadLayout() { /* ... 로직은 동일 ... */ }
        function toggleFolderCreationMode() { /* ... 로직은 동일 ... */ }
        function createVirtualFolder() { /* ... 로직은 동일 ... */ }

        // 여기에 함수 본문들을 붙여넣습니다 (가독성을 위해 생략)
        function saveLayout() { const layout = []; for (const node of folderViewContainer.children) { if (node.tagName === 'DETAILS') { layout.push({ type: 'folder', name: node.querySelector('summary > div').textContent.trim(), items: Array.from(node.querySelectorAll('.torrent-item-container')).map(item => item.dataset.id) }); } else if (node.classList.contains('torrent-item-container')) { layout.push({ type: 'single', id: node.dataset.id }); } } localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout)); hasUnsavedChanges = false; opener.showToast("폴더 구조가 브라우저에 저장되었습니다.", "success"); }
        function loadLayout() { if (hasUnsavedChanges && !confirm("저장되지 않은 변경사항이 있습니다. 정말로 불러오시겠습니까?")) return; const savedLayoutJSON = localStorage.getItem(LAYOUT_STORAGE_KEY); if (!savedLayoutJSON) { opener.showToast("저장된 폴더 구조가 없습니다.", "info"); return; } const savedLayout = JSON.parse(savedLayoutJSON); folderViewContainer.innerHTML = ''; const torrentsMap = new Map(opener.lastFetchedTorrents.map(t => [t.id, t])); const usedIds = new Set(); savedLayout.forEach(entry => { if (entry.type === 'folder') { const folderContent = document.createElement('div'); folderContent.className = 'p-2 border-t border-gray-300'; let totalSize = 0, liveItemsCount = 0; entry.items.forEach(id => { if (torrentsMap.has(id)) { const torrent = torrentsMap.get(id); folderContent.innerHTML += opener.renderTorrentItemHTML(torrent, true); totalSize += torrent.bytes; liveItemsCount++; usedIds.add(id); } }); if (liveItemsCount > 0) { const details = document.createElement('details'); details.className = 'bg-gray-100 rounded-lg mb-2'; details.innerHTML = `<summary class="p-3 cursor-pointer font-semibold text-gray-800 flex justify-between items-center hover:bg-gray-200 rounded-t-lg"><div><i class="fas fa-folder text-yellow-500 mr-3"></i>${entry.name}</div><div class="text-sm font-normal text-gray-600">${liveItemsCount}개 / ${opener.formatSize(totalSize)}</div></summary>`; details.appendChild(folderContent); folderViewContainer.appendChild(details); } } else if (entry.type === 'single' && torrentsMap.has(entry.id)) { folderViewContainer.innerHTML += opener.renderTorrentItemHTML(torrentsMap.get(entry.id), true); usedIds.add(entry.id); } }); const uncategorizedItems = opener.lastFetchedTorrents.filter(t => !usedIds.has(t.id)); if (uncategorizedItems.length > 0) { folderViewContainer.innerHTML += opener.generateMonthlyGroupHTML(uncategorizedItems, true); } hasUnsavedChanges = false; opener.showToast("저장된 폴더 구조를 불러왔습니다.", "success"); }
        function toggleFolderCreationMode() { isFolderCreationMode = !isFolderCreationMode; const items = folderViewContainer.querySelectorAll('.torrent-item'); const createBtn = document.getElementById('createFolderBtn'); const cancelBtn = document.getElementById('cancelFolderBtn'); if (isFolderCreationMode) { items.forEach(item => item.querySelector('.folder-checkbox').classList.remove('hidden')); createBtn.innerHTML = '<i class="fas fa-check mr-2"></i>선택 완료'; cancelBtn.classList.remove('hidden'); } else { items.forEach(item => { const checkbox = item.querySelector('.folder-checkbox'); checkbox.classList.add('hidden'); checkbox.checked = false; }); createBtn.innerHTML = '<i class="fas fa-folder-plus mr-2"></i>가상 폴더 만들기'; cancelBtn.classList.add('hidden'); } }
        function createVirtualFolder() { const selectedItems = folderViewContainer.querySelectorAll('.folder-checkbox:checked'); if (selectedItems.length === 0) { alert("먼저 하나 이상의 항목을 선택해주세요."); return; } const folderName = prompt("생성할 가상 폴더의 이름을 입력하세요:", "새 폴더"); if (!folderName) return; const folderContent = document.createElement('div'); folderContent.className = 'p-2 border-t border-gray-300'; let totalSize = 0; selectedItems.forEach(checkbox => { const itemContainer = checkbox.closest('.torrent-item-container'); folderContent.appendChild(itemContainer); totalSize += parseFloat(itemContainer.dataset.bytes || 0); }); const details = document.createElement('details'); details.className = 'bg-gray-100 rounded-lg mb-2'; details.innerHTML = `<summary class="p-3 cursor-pointer font-semibold text-gray-800 flex justify-between items-center hover:bg-gray-200 rounded-t-lg"><div><i class="fas fa-folder text-yellow-500 mr-3"></i>${folderName}</div><div class="text-sm font-normal text-gray-600">${selectedItems.length}개 / ${opener.formatSize(totalSize)}</div></summary>`; details.appendChild(folderContent); folderViewContainer.prepend(details); toggleFolderCreationMode(); hasUnsavedChanges = true; }

        document.getElementById('saveBtn').addEventListener('click', saveLayout);
        document.getElementById('loadBtn').addEventListener('click', loadLayout);
        document.getElementById('createFolderBtn').addEventListener('click', () => { if (isFolderCreationMode) createVirtualFolder(); else toggleFolderCreationMode(); });
        document.getElementById('cancelFolderBtn').addEventListener('click', toggleFolderCreationMode);

        h1.textContent = `토렌트 가상 폴더 뷰 (${opener.lastFetchedTorrents.length}개)`;
        folderViewContainer.innerHTML = opener.generateAutomaticFolderViewHTML(opener.lastFetchedTorrents, true);
    };
}

function generateMonthlyGroupHTML(items, isNewWindow) {
    if (!items || items.length === 0) return '';
    const monthlyGroups = {};
    items.forEach(item => {
        const date = new Date(item.added);
        const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        if (!monthlyGroups[key]) monthlyGroups[key] = [];
        monthlyGroups[key].push(item);
    });
    let monthlyHTML = '';
    const renderFunc = isNewWindow ? window.opener.renderTorrentItemHTML : renderTorrentItemHTML;
    const formatSizeFunc = isNewWindow ? window.opener.formatSize : formatSize;
    Object.keys(monthlyGroups).sort().reverse().forEach(key => {
        const [year, month] = key.split('-');
        const itemsInMonth = monthlyGroups[key];
        const totalSize = itemsInMonth.reduce((sum, item) => sum + item.bytes, 0);
        monthlyHTML += `<details class="bg-gray-100 rounded-lg mb-2"><summary class="p-3 cursor-pointer font-semibold text-gray-800 flex justify-between items-center hover:bg-gray-200 rounded-t-lg"><div><i class="fas fa-calendar-alt text-blue-500 mr-3"></i>${year}년 ${parseInt(month, 10)}월</div><div class="text-sm font-normal text-gray-600">${itemsInMonth.length}개 / ${formatSizeFunc(totalSize)}</div></summary><div class="p-2 border-t border-gray-300">${itemsInMonth.map(t => renderFunc(t, isNewWindow)).join('')}</div></details>`;
    });
    return monthlyHTML;
}

function generateAutomaticFolderViewHTML(torrents, isNewWindow) {
    const getGroupKey = (filename) => {
        let cleanName = filename.replace(/[._]/g, ' ');
        const patterns = [/S\d{1,2}E\d{1,3}/i, /E\d{1,3}/i, /\d{1,3}회/, /\d{1,3}화/, /\d{4}p/, /\b(19|20)\d{2}\b/, /BluRay|WEBRip|HDTV|x264|H264|x265|HEVC/i];
        let title = cleanName; let foundPattern = false;
        for (const pattern of patterns) { const match = title.match(pattern); if (match && match.index > 0) { title = title.substring(0, match.index); foundPattern = true; break; } }
        const dateMatch = title.match(/\b\d{6}\b\s*$/);
        if(!foundPattern && dateMatch && dateMatch.index > 0) { title = title.substring(0, dateMatch.index); }
        return title.replace(/[-]/g, ' ').trim();
    };
    const groups = {}, singles = [];
    torrents.forEach(t => { const groupKey = getGroupKey(t.filename); if (groupKey) { if (!groups[groupKey]) groups[groupKey] = []; groups[groupKey].push(t); } else { singles.push(t); } });
    let html = '';
    const renderFunc = isNewWindow ? window.opener.renderTorrentItemHTML : renderTorrentItemHTML;
    const formatSizeFunc = isNewWindow ? window.opener.formatSize : formatSize;
    Object.keys(groups).sort().forEach(key => {
        const items = groups[key];
        if (items.length > 1) {
            const totalSize = items.reduce((sum, item) => sum + item.bytes, 0);
            html += `<details class="bg-gray-100 rounded-lg mb-2"><summary class="p-3 cursor-pointer font-semibold text-gray-800 flex justify-between items-center hover:bg-gray-200 rounded-t-lg"><div><i class="fas fa-folder text-yellow-500 mr-3"></i>${key}</div><div class="text-sm font-normal text-gray-600">${items.length}개 / ${formatSizeFunc(totalSize)}</div></summary><div class="p-2 border-t border-gray-300">${items.map(t => renderFunc(t, isNewWindow)).join('')}</div></details>`;
        } else {
            singles.push(...items);
        }
    });
    html += generateMonthlyGroupHTML(singles, isNewWindow);
    return html;
}