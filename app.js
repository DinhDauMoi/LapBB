// ============ CONFIG ============
const MAX_ROWS = 15;
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw6jX6-ShzmHX8bnjy1JsqZ-37NShSHNhQ9qYPtqleS6bvnUwnU_Y2gQ7Bjjj4lwxFlmg/exec';

let productData = [];
let tableData = [];
let currentBBCode = null;
let lastSavedJSON = '';
let isSaving = false;

// ============ INIT ============
document.addEventListener('DOMContentLoaded', async () => {
    updateTime();
    setInterval(updateTime, 1000);
    await loadProductData();
    setupAutocomplete();
    updateRowCounter();
});

function updateTime() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    document.getElementById('thoiGian').value =
        `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

async function loadProductData() {
    try {
        const res = await fetch('data.json');
        productData = await res.json();
        showStatus('Đã tải ' + productData.length + ' sản phẩm', 'info');
    } catch(e) {
        showStatus('Lỗi tải data.json: ' + e.message, 'error');
    }
}

// ============ AUTOCOMPLETE ============
function setupAutocomplete() {
    const input = document.getElementById('maSP');
    const list = document.getElementById('autocompleteList');

    input.addEventListener('input', () => {
        const val = input.value.trim().toLowerCase();
        if (val.length < 2) { list.classList.remove('active'); return; }
        const matches = productData.filter(p =>
            p.masp.toLowerCase().includes(val) || p.tensp.toLowerCase().includes(val)
        ).slice(0, 15);
        if (matches.length === 0) { list.classList.remove('active'); return; }
        list.innerHTML = matches.map(p =>
            `<div class="autocomplete-item" data-masp="${p.masp}" data-tensp="${p.tensp}">
                <span class="ac-code">${p.masp}</span>${p.tensp}
            </div>`
        ).join('');
        list.classList.add('active');
        list.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                input.value = item.dataset.masp;
                document.getElementById('tenSP').value = item.dataset.tensp;
                list.classList.remove('active');
                document.getElementById('soLuong').focus();
            });
        });
    });

    input.addEventListener('blur', () => {
        setTimeout(() => {
            list.classList.remove('active');
            const val = input.value.trim().toLowerCase();
            if (val && !document.getElementById('tenSP').value) {
                const exact = productData.find(p => p.masp.toLowerCase() === val);
                if (exact) {
                    document.getElementById('tenSP').value = exact.tensp;
                }
            }
        }, 200);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' || e.key === 'Enter') {
            const val = input.value.trim().toLowerCase();
            const exact = productData.find(p => p.masp.toLowerCase() === val);
            if (exact) {
                document.getElementById('tenSP').value = exact.tensp;
            }
            list.classList.remove('active');
        }
    });
}

// ============ TABLE OPERATIONS ============
function addRow() {
    if (tableData.length >= MAX_ROWS) {
        showStatus(`Đã đạt giới hạn ${MAX_ROWS} dòng trên 1 trang A4!`, 'error');
        return;
    }
    const maSP = document.getElementById('maSP').value.trim();
    const tenSP = document.getElementById('tenSP').value.trim();
    const soLuong = document.getElementById('soLuong').value.trim();
    const donViTinh = document.getElementById('donViTinh').value.trim();
    const tinhTrang = document.getElementById('tinhTrang').value.trim();
    const soChungTu = document.getElementById('soChungTu').value.trim();

    if (!maSP) { showStatus('Mã sản phẩm không được bỏ trống!', 'error'); document.getElementById('maSP').focus(); return; }

    // Check for duplicate product code
    const isDuplicate = tableData.some(row => row.maSP.toLowerCase() === maSP.toLowerCase());
    if (isDuplicate) {
        showStatus(`Mã sản phẩm ${maSP} đã được thêm trước đó!`, 'error');
        document.getElementById('maSP').focus();
        return;
    }

    tableData.push({ maSP, tenSP, soLuong, donViTinh, tinhTrang, soChungTu });
    renderTable();
    clearForm();
    updateRowCounter();
    document.getElementById('maSP').focus();
}

function deleteRow(idx) {
    tableData.splice(idx, 1);
    renderTable();
    updateRowCounter();
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    const empty = document.getElementById('emptyState');
    if (tableData.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');
    tbody.innerHTML = tableData.map((r, i) =>
        `<tr>
            <td class="col-stt">${i + 1}</td>
            <td>${r.maSP}</td>
            <td>${r.tenSP}</td>
            <td class="col-stt">${r.soLuong}</td>
            <td>${r.donViTinh}</td>
            <td>${r.tinhTrang}</td>
            <td>${r.soChungTu}</td>
            <td class="col-stt"><button class="btn btn-del" onclick="deleteRow(${i})">✕</button></td>
        </tr>`
    ).join('');
}

function clearForm() {
    ['maSP','tenSP','soLuong','donViTinh','tinhTrang','soChungTu'].forEach(id => document.getElementById(id).value = '');
}

function updateRowCounter() {
    const remaining = MAX_ROWS - tableData.length;
    const el = document.getElementById('rowsRemaining');
    el.textContent = remaining;
    el.style.color = remaining <= 3 ? '#f43f5e' : remaining <= 7 ? '#f59e0b' : '#22d3ee';
    document.getElementById('btnAdd').disabled = remaining <= 0;
}

// ============ GOOGLE SHEET ============
async function saveToSheet() {
    if (!APPS_SCRIPT_URL) { showStatus('Chưa cấu hình URL Google Apps Script!', 'error'); return; }
    if (tableData.length === 0) { showStatus('Không có dữ liệu để lưu!', 'error'); return; }
    if (isSaving) return;

    const maVanDon = document.getElementById('maVanDon').value.trim();
    const thoiGian = document.getElementById('thoiGian').value;
    const viTriLap = document.getElementById('viTriLap').value.trim();

    // Generate BB code if not exists
    let bbCode = currentBBCode;
    if (!bbCode) {
        isSaving = true;
        showStatus('Đang lấy mã biên bản mới...', 'info');
        try {
            const res = await fetch(APPS_SCRIPT_URL + '?action=getNextCode');
            const data = await res.json();
            bbCode = data.code || 'L001';
        } catch(e) {
            bbCode = 'L' + String(Date.now()).slice(-4);
        }
        isSaving = false;
    }

    const payload = {
        action: 'save',
        bbCode,
        maVanDon,
        thoiGian,
        viTriLap,
        rows: tableData.map((r, i) => ({
            stt: i + 1,
            maVanDon,
            viTriLap,
            thoiGian,
            maSP: r.maSP,
            tenSP: r.tenSP,
            soLuong: r.soLuong,
            donViTinh: r.donViTinh,
            tinhTrang: r.tinhTrang,
            soChungTu: r.soChungTu,
            bbCode
        }))
    };

    const payloadJSONString = JSON.stringify(payload.rows);
    if (currentBBCode && lastSavedJSON === payloadJSONString) {
        showStatus('Mọi thứ đã được lưu. Chưa có thay đổi mới nào để lưu thêm!', 'info');
        return;
    }

    isSaving = true;
    showStatus('Đang lưu dữ liệu...', 'info');
    try {
        const res = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (result.status === 'ok') {
            currentBBCode = bbCode;
            lastSavedJSON = payloadJSONString;
            showStatus(`✅ Đã lưu thành công! Mã biên bản: ${bbCode}`, 'success');
            document.getElementById('printCode').value = bbCode;
        } else {
            showStatus('Lỗi: ' + (result.message || 'Unknown'), 'error');
        }
    } catch(e) {
        showStatus('Lỗi kết nối: ' + e.message, 'error');
    } finally {
        isSaving = false;
    }
}

// ============ LOOKUP ============
async function lookupBB() {
    const code = document.getElementById('lookupCode').value.trim();
    if (!code) { showStatus('Nhập mã biên bản cần tìm!', 'error'); return; }
    if (!APPS_SCRIPT_URL) { showStatus('Chưa cấu hình URL Google Apps Script!', 'error'); return; }

    showStatus('Đang tìm...', 'info');
    try {
        const res = await fetch(APPS_SCRIPT_URL + '?action=lookup&code=' + encodeURIComponent(code));
        const data = await res.json();
        if (data.status === 'ok' && data.rows && data.rows.length > 0) {
            tableData = data.rows.map(r => ({
                maSP: r.maSP, tenSP: r.tenSP, soLuong: r.soLuong,
                donViTinh: r.donViTinh, tinhTrang: r.tinhTrang, soChungTu: r.soChungTu
            }));
            document.getElementById('maVanDon').value = data.rows[0].maVanDon || '';
            document.getElementById('viTriLap').value = data.rows[0].viTriLap || '';
            document.getElementById('printCode').value = code;
            currentBBCode = code; // Retain code from lookup
            renderTable();
            updateRowCounter();
            showStatus(`✅ Tìm thấy ${data.rows.length} dòng cho BB: ${code}`, 'success');
        } else {
            showStatus('Không tìm thấy biên bản: ' + code, 'error');
        }
    } catch(e) {
        showStatus('Lỗi: ' + e.message, 'error');
    }
}

// ============ PDF EXPORT ============
function exportPDF() {
    const code = document.getElementById('printCode').value.trim();
    if (!code && tableData.length === 0) { showStatus('Không có dữ liệu và mã BB!', 'error'); return; }

    // If code provided and no table data, attempt lookup first
    if (code && tableData.length === 0) {
        lookupBB().then(() => { if(tableData.length > 0) generatePDFPreview(code); });
        return;
    }
    generatePDFPreview(code || 'DRAFT');
}

function generatePDFPreview(bbCode) {
    const maVanDon = document.getElementById('maVanDon').value.trim();
    const viTriLap = document.getElementById('viTriLap').value.trim();
    const thoiGian = document.getElementById('thoiGian').value;
    const now = new Date();
    const day = now.getDate(), month = now.getMonth() + 1, year = now.getFullYear();
    const pad = n => String(n).padStart(2, '0');

    let tableContent = `
        <table class="data" style="width:100%; border-collapse:collapse; font-size:12px; margin-top: 10px;">
            <thead>
                <tr>
                    <th style="border: 1px solid #333; padding: 5px; text-align: center; width: 35px;">STT</th>
                    <th style="border: 1px solid #333; padding: 5px; text-align: center; width: 80px;">Mã SP</th>
                    <th style="border: 1px solid #333; padding: 5px; text-align: center;">Tên SP</th>
                    <th style="border: 1px solid #333; padding: 5px; text-align: center; width: 40px;">SL</th>
                    <th style="border: 1px solid #333; padding: 5px; text-align: center; width: 50px;">ĐVT</th>
                    <th style="border: 1px solid #333; padding: 5px; text-align: center;">Tình Trạng Hàng Hóa</th>
                    <th style="border: 1px solid #333; padding: 5px; text-align: center; width: 70px;">HO / Số CT</th>
                </tr>
            </thead>
            <tbody>`;
            
    for (let i = 0; i < MAX_ROWS; i++) {
        const r = tableData[i];
        tableContent += `<tr>
            <td style="border: 1px solid #333; padding: 5px; text-align: center;">${r ? i + 1 : ''}</td>
            <td style="border: 1px solid #333; padding: 5px; text-align: center;">${r ? r.maSP : ''}</td>
            <td style="border: 1px solid #333; padding: 5px; text-align: left; font-size:11px;">${r ? r.tenSP : ''}</td>
            <td style="border: 1px solid #333; padding: 5px; text-align: center;">${r ? r.soLuong : ''}</td>
            <td style="border: 1px solid #333; padding: 5px; text-align: center;">${r ? r.donViTinh : ''}</td>
            <td style="border: 1px solid #333; padding: 5px; text-align: left;">${r ? r.tinhTrang : ''}</td>
            <td style="border: 1px solid #333; padding: 5px; text-align: center;">${r ? r.soChungTu : ''}</td>
        </tr>`;
    }
    tableContent += `</tbody></table>`;

    let html = `
    <div style="font-family: Arial, sans-serif; color: #000; width: 700px; margin: auto; padding: 20px;">
        <div class="header" style="text-align: center; margin-bottom: 20px;">
            <div style="display:flex;text-align: center;justify-content: center; align-items: center; margin-bottom: 20px;">
                <div>
                    <img src="https://static.ybox.vn/2019/5/3/1557280686880-8863079ccec42c9a75d5.jpg" style="padding-right: 20px; width: 150px; height: auto;" alt="Logo">
                </div>
                <div>
                    <h3 style="margin: 5px 0; font-size: 16px;">CÔNG TY CỔ PHẦN DƯỢC PHẨM FPT LONG CHÂU</h3>
                    <div style="font-size: 14px;">Địa chỉ: 379-381 Hai Bà Trưng, P.3, Q.3, TP HCM</div>
                    <div class="textr" style="padding-top: 5px; font-size: 14px;">MST: 0315275368</div>
                </div>
            </div>
            <h2 style="margin-top: 10px; margin-bottom: 15px; font-size: 20px;">BIÊN BẢN HƯ HỎNG</h2>
            <div style="text-align: center; font-size: 16px;">
                <div class="textr" style="padding-top: 10px;">Hôm nay, .............. tháng .............. năm .............. tại Kho Tổng Long Châu.</div>
                <div class="textr" style="padding-top: 10px;">Bên giao hàng ..............................................................................................</div>
                <div class="textr" style="padding-top: 10px;"> - Ông (bà) ...................................................................................................</div>
                <div class="textr" style="padding-top: 10px;">Bên giao hàng ..............................................................................................</div>
                <div class="textr" style="padding-top: 10px;"> - Ông (bà) ...................................................................................................</div>
                <div class="textr" style="padding-top: 10px; text-align: left;">Cùng nhau kiểm kê hàng hóa bị hư hỏng do vận chuyển như sau :</div>
                <div class="textr" style="font-size: 13px;padding-top: 10px; text-align: left; font-weight: bold;">
                    MÃ VẬN ĐƠN: ${maVanDon || 'FRK.....................'} &nbsp;&nbsp;&nbsp; 
                    Mã biên bản: ${bbCode || '...........'} &nbsp;&nbsp;&nbsp; 
                    Vị trí: ${viTriLap || '...................'} &nbsp;&nbsp;&nbsp; 
                    Thời gian: ${thoiGian || '...................'}
                </div>
            </div>
        </div>

        <div class="tables" style="display: flex; justify-content: center; width: 100%; text-align: center;font-size: 12px;">
            ${tableContent}
        </div>
        <div class="textr" style="padding-top: 10px; font-size: 12px; text-align: left; font-style: italic; margin-top: 10px;">Biên bản này được lập thành 02 bản và có giá trị pháp lý như nhau, 01 bản lưu tại bên nhận, 01 bản đưa bên vận chuyển.</div>
        <div class="footer" style="margin-top: 40px; display: flex; justify-content: space-around; font-weight: bold; font-size: 14px;">
            <div style="text-align: center;">BÊN NHẬN HÀNG<br><span style="font-weight: normal; font-size: 12px; font-style: italic;">(Ký ghi rõ họ tên)</span></div>
            <div style="text-align: center;">BÊN GIAO HÀNG<br><span style="font-weight: normal; font-size: 12px; font-style: italic;">(Ký ghi rõ họ tên)</span></div>
        </div>
    </div>`;

    document.getElementById('pdfPreview').innerHTML = html;
    document.getElementById('pdfModal').classList.remove('hidden');
}

function printPDF() {
    const content = document.getElementById('pdfPreview').innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
        <!DOCTYPE html><html><head>
        <meta charset="UTF-8">
        <title>Biên Bản Hư Hỏng</title>
        <style>
            @page { size: A4; margin: 10mm; }
            body { margin: 0; }
        </style>
        </head><body>${content}</body></html>
    `);
    win.document.close();
    win.onload = () => { win.print(); };
}

function closePDFModal() {
    document.getElementById('pdfModal').classList.add('hidden');
}

// ============ STATUS ============
function showStatus(msg, type) {
    const bar = document.getElementById('statusBar');
    const text = document.getElementById('statusText');
    bar.className = 'status-bar ' + type;
    text.textContent = msg;
    if (type !== 'info') {
        setTimeout(() => bar.classList.add('hidden'), 5000);
    }
}

// Reset everything
function resetForm() {
    if (confirm('Bạn có chắc chắn muốn làm mới trang và xóa hết dữ liệu hiện tại không?')) {
        tableData = [];
        currentBBCode = null;
        lastSavedJSON = '';
        renderTable();
        updateRowCounter();
        document.getElementById('maVanDon').value = '';
        document.getElementById('viTriLap').value = '';
        document.getElementById('printCode').value = '';
        document.getElementById('lookupCode').value = '';
        clearForm();
        showStatus('Đã làm mới trang. Bạn có thể bắt đầu biên bản mới.', 'success');
        document.getElementById('maVanDon').focus();
    }
}

// Keyboard shortcut: Ctrl+Enter to add row
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') addRow();
});
