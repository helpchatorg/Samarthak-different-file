const accounts = [ ["1020304050", "Admin@786"], ["9876543210", "Login@Secure"] ];
let config = { libName: "", totalSeats: 0, upi: "", mobile: "", address: "", pin: "", shifts: [], signature: null };
let db = {}; let students = []; let selectedSeat = null; let photoData = null; let sigData = null;
let cropper = null;
let currentFeeStudentId = null;
let loggedInStudent = null;
let historyFilter = 'all';

let attendances = []; 
let currentCamTask = ""; 
let isModelsLoaded = false;
let currentReportStudent = null;

// Local storage functions ko khali kar diya gaya hai
function saveToLocal() {
    // Local storage mein data save karne wala logic hata diya gaya hai
}

function loadFromLocal() {
    // Local storage se data load karne wala logic hata diya gaya hai
}

async function loadModels() {
    if (isModelsLoaded) return;
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    isModelsLoaded = true;
}

async function openLiveCamera(task) {
    currentCamTask = task;
    document.getElementById('cam-overlay').style.display = 'flex';
    document.getElementById('capture-btn').style.display = 'none';
    document.getElementById('cam-status').innerText = "Loading AI Models...";
    await loadModels();
    const video = document.getElementById('live-video');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        video.srcObject = stream;
        detectHuman();
    } catch (e) {
        alert("Camera access denied or not available.");
        closeLiveCamera();
    }
}

async function detectHuman() {
    const video = document.getElementById('live-video');
    const status = document.getElementById('cam-status');
    const btn = document.getElementById('capture-btn');
    const interval = setInterval(async () => {
        if (!video.srcObject) { clearInterval(interval); return; }
        const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions());
        if (detections) {
            status.innerText = "Real Human Detected! Ready to capture.";
            status.style.background = "#22c55e";
            btn.style.display = "block";
        } else {
            status.innerText = "Scanning... Position your face clearly.";
            status.style.background = "rgba(37,99,235,0.8)";
            btn.style.display = "none";
        }
    }, 1000);
}

function captureFinalPhoto() {
    const video = document.getElementById('live-video');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    const data = canvas.toDataURL('image/jpeg', 0.7);
    if (currentCamTask === 'registration') {
        photoData = data;
        const prev = document.getElementById('photo-preview-img');
        prev.src = data; prev.style.display = 'block';
        hideError('err-photo');
    } else if (currentCamTask === 'attendance') {
        saveAttendance(data);
    }
    closeLiveCamera();
}

function saveAttendance(img) {
    const todayStr = new Date().toISOString().split('T')[0];
    const alreadyDone = attendances.find(a => a.regNo === loggedInStudent.regNo && a.date.startsWith(todayStr));
    if (alreadyDone) { alert("Attendance already marked for today!"); } else {
        const log = { regNo: loggedInStudent.regNo, name: loggedInStudent.name, date: new Date().toISOString(), photo: img };
        attendances.push(log); saveToLocal(); renderStudentDashboard(); alert("Attendance Marked Successfully!");
    }
}

function closeLiveCamera() {
    const video = document.getElementById('live-video');
    if (video.srcObject) { video.srcObject.getTracks().forEach(track => track.stop()); video.srcObject = null; }
    document.getElementById('cam-overlay').style.display = 'none';
}

window.onload = loadFromLocal;

function hideError(id) { document.getElementById(id).style.display = 'none'; }

function setHistoryFilter(type, el) {
    historyFilter = type;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    const title = document.getElementById('history-title');
    title.innerText = (type === 'attendance') ? "Daily Student Attendance Records" : "Registered Records";
    renderHistory();
}

function toggleLoginType(type) {
    document.getElementById('login-main-err').style.display = 'none';
    if(type === 'student') {
        document.getElementById('admin-form').style.display = 'none';
        document.getElementById('student-form').style.display = 'block';
        document.getElementById('login-type-label').innerText = "Student Dashboard";
    } else {
        document.getElementById('admin-form').style.display = 'block';
        document.getElementById('student-form').style.display = 'none';
        document.getElementById('login-type-label').innerText = "Admin Dashboard";
    }
}

function formatAppDate(dateStr) {
    if(!dateStr) return "";
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatAppTime(dateStr) {
    if(!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function getFullMonthName(monthYearStr) {
    if(!monthYearStr) return "";
    const [year, month] = monthYearStr.split('-');
    return new Date(year, month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

function togglePasswordVisibility(id) {
    const input = document.getElementById(id);
    const toggle = input.nextElementSibling;
    input.type = input.type === "password" ? "text" : "password";
    toggle.innerText = input.type === "password" ? "SHOW" : "HIDE";
}

function handleLogin() {
    const id = document.getElementById('adminId').value, pass = document.getElementById('adminPass').value;
    document.querySelectorAll('.error-msg').forEach(e => e.style.display = 'none');
    if(id.length !== 10) return document.getElementById('err-login-id').style.display = 'block';
    if(!pass) return document.getElementById('err-login-pass').style.display = 'block';
    if(accounts.find(acc => acc[0] === id && acc[1] === pass)) {
        document.getElementById('login-sec').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        document.getElementById('admin-bottom-nav').style.display = 'flex';
        switchTab('owner-sec', document.querySelector('.nav-item'));
        renderAdminAttendance();
    } else { document.getElementById('login-main-err').style.display = 'block'; }
}

function handleStudentLogin() {
    const regSuffix = document.getElementById('stuReg').value, mobile = document.getElementById('stuMobile').value, fullReg = "REG" + regSuffix;
    if(regSuffix.length !== 10) { document.getElementById('err-stu-reg').style.display = 'block'; return; }
    if(mobile.length !== 10) { document.getElementById('err-stu-mob').style.display = 'block'; return; }
    const found = students.find(s => s.regNo === fullReg && s.mobile === mobile);
    if(found) {
        loggedInStudent = found; document.getElementById('login-sec').style.display = 'none';
        document.getElementById('main-app').style.display = 'block'; document.getElementById('admin-bottom-nav').style.display = 'none';
        renderStudentDashboard(); switchTab('student-dash-sec');
    } else { document.getElementById('login-main-err').style.display = 'block'; }
}

function renderStudentDashboard() {
    const s = loggedInStudent;
    document.getElementById('stu-display-photo').src = s.photo || '';
    document.getElementById('stu-display-name').innerText = s.name;
    document.getElementById('stu-display-reg').innerText = "REGISTRATION: " + s.regNo;
    document.getElementById('stu-display-mobile').innerText = "Mobile: " + s.mobile;
    document.getElementById('stu-display-email').innerText = "Email: " + s.email;
    document.getElementById('stu-display-seat').innerText = "No. " + s.seat;
    document.getElementById('stu-display-shift').innerText = s.shiftName;
    document.getElementById('stu-display-regdate').innerText = formatAppDate(s.date);
    const todayStr = new Date().toISOString().split('T')[0];
    const done = attendances.find(a => a.regNo === s.regNo && a.date.startsWith(todayStr));
    const btnAtt = document.getElementById('btn-attendance'), statusAtt = document.getElementById('attendance-status');
    let dueDate = new Date(s.date);
    if(s.feeHistory && s.feeHistory.length > 0) {
        const lastFee = [...s.feeHistory].sort((a,b) => new Date(b.month) - new Date(a.month))[0];
        dueDate = new Date(lastFee.month + "-01"); dueDate.setMonth(dueDate.getMonth() + 1); dueDate.setDate(new Date(s.date).getDate());
    } else { dueDate.setDate(dueDate.getDate() + 30); }
    document.getElementById('stu-display-due').innerText = formatAppDate(dueDate);
    const now = new Date(), currentTimeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    const currentShiftObj = config.shifts.find(sh => sh.id === s.shift);
    let isShiftOver = false; if(currentShiftObj && currentShiftObj.end) isShiftOver = currentTimeStr > currentShiftObj.end;
    const isFeePending = now > dueDate;
    if(isFeePending) {
        btnAtt.disabled = true; btnAtt.style.background = "#94a3b8"; btnAtt.innerText = "Fees Due - Attendance Locked";
        statusAtt.innerHTML = `<span style="color:#ef4444">⚠ Please pay your fees to mark attendance.</span>`;
    } else if(done) {
        btnAtt.disabled = true; btnAtt.style.background = "#94a3b8"; btnAtt.innerText = "Today's Attendance Marked";
        statusAtt.innerHTML = `<span style="color:#22c55e">✓ Done at ${formatAppTime(done.date)}</span>`;
    } else if (isShiftOver) {
        btnAtt.disabled = true; btnAtt.style.background = "#ef4444"; btnAtt.innerText = "Shift Ended - Attendance Closed";
        statusAtt.innerHTML = `<span style="color:#ef4444">⚠ ABSENT (Shift Over)</span>`;
    } else {
        btnAtt.disabled = false; btnAtt.style.background = "#22c55e"; btnAtt.innerText = "Mark My Attendance (Live Photo)";
        statusAtt.innerHTML = "";
    }
    const tbody = document.getElementById('stu-fee-tbody'); tbody.innerHTML = '';
    if(s.feeHistory) {
        s.feeHistory.forEach((f, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${getFullMonthName(f.month)}</td><td>₹${f.amount}</td><td>${f.mode}</td><td>${f.txnId}</td><td><button class="btn-dl-h" onclick="downloadSpecificMonthStudent(${idx})">PDF</button></td>`;
            tbody.appendChild(tr);
        });
    }
    const attBody = document.getElementById('stu-attendance-tbody'); attBody.innerHTML = '';
    const myAtts = attendances.filter(a => a.regNo === s.regNo).reverse();
    myAtts.forEach(a => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${formatAppDate(a.date)}</td><td>${formatAppTime(a.date)}</td><td><span style="color:#22c55e; font-weight:bold;">PRESENT</span></td>`;
        attBody.appendChild(tr);
    });
}

function openReportModal(student) {
    currentReportStudent = student; document.getElementById('report-month-input').value = new Date().toISOString().slice(0, 7);
    document.getElementById('month-modal').style.display = 'flex';
}

function closeMonthModal() { document.getElementById('month-modal').style.display = 'none'; currentReportStudent = null; }

function confirmDownloadReport() {
    const selectedMonth = document.getElementById('report-month-input').value;
    if(!selectedMonth) return alert("Please select a month!");
    downloadAttendanceReport(currentReportStudent, selectedMonth); closeMonthModal();
}

function downloadAttendanceReport(student, monthYear) {
    if(!student || !monthYear) return; const { jsPDF } = window.jspdf; const doc = new jsPDF();
    doc.setFontSize(20); doc.text("Attendance Report", 105, 20, { align: "center" });
    doc.setFontSize(12); doc.text(`Library: ${config.libName}`, 105, 28, { align: "center" });
    doc.text(`Month: ${getFullMonthName(monthYear)}`, 105, 34, { align: "center" });
    doc.text(`Name: ${student.name} | Reg: ${student.regNo}`, 20, 45);
    const [year, month] = monthYear.split('-').map(Number), lastDay = new Date(year, month, 0).getDate(), today = new Date();
    const currentYear = today.getFullYear(), currentMonth = today.getMonth() + 1, currentDay = today.getDate(), regDate = new Date(student.date);
    regDate.setHours(0, 0, 0, 0);
    let rows = [];
    for (let day = 1; day <= lastDay; day++) {
        const currentDateObj = new Date(year, month - 1, day), dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const displayDate = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
        if (currentDateObj < regDate) continue;
        if (year > currentYear || (year === currentYear && month > currentMonth) || (year === currentYear && month === currentMonth && day > currentDay)) continue;
        const record = attendances.find(a => a.regNo === student.regNo && a.date.startsWith(dateStr));
        if (record) { rows.push([displayDate, formatAppTime(record.date), "PRESENT"]); } else {
            const shiftObj = config.shifts.find(s => s.id === student.shift);
            const nowTime = today.getHours().toString().padStart(2, '0') + ":" + today.getMinutes().toString().padStart(2, '0');
            if(year === currentYear && month === currentMonth && day === currentDay) { if(shiftObj && shiftObj.end && nowTime <= shiftObj.end) continue; }
            rows.push([displayDate, "--:--", "ABSENT"]);
        }
    }
    if (rows.length === 0) { doc.setFontSize(10); doc.setTextColor(150); doc.text("No records found after registration for this period.", 105, 60, { align: "center" }); } else {
        doc.autoTable({ startY: 50, head: [['Date', 'Time', 'Status']], body: rows.reverse(), headStyles: { fillColor: [37, 99, 235] },
            didParseCell: function(data) { if (data.section === 'body' && data.column.index === 2) { if (data.cell.raw === 'ABSENT') { data.cell.styles.textColor = [239, 68, 68]; data.cell.styles.fontStyle = 'bold'; } else { data.cell.styles.textColor = [34, 197, 94]; } } }
        });
    }
    doc.save(`${student.name}_Attendance_${monthYear}.pdf`);
}

function renderAdminAttendance() {
    const historyBody = document.getElementById('historyBody'); if(historyFilter !== 'attendance') return;
    historyBody.innerHTML = `<div class="fee-history-wrapper"><table class="fee-history-table"><thead><tr><th>Student</th><th>Reg No</th><th>Date & Time</th><th>Photo</th><th>Report</th></tr></thead><tbody id="admin-attendance-tbody-inner"></tbody></table></div>`;
    const tbody = document.getElementById('admin-attendance-tbody-inner'), todayStr = new Date().toISOString().split('T')[0], now = new Date(), currentTimeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    attendances.slice().reverse().forEach(a => {
        const stu = students.find(s => s.regNo === a.regNo); const tr = document.createElement('tr');
        tr.innerHTML = `<td>${a.name}</td><td>${a.regNo}</td><td>${formatAppDate(a.date)} ${formatAppTime(a.date)}</td><td><img src="${a.photo}" onclick="zoomPhoto('${a.photo}')" style="width:40px; height:40px; border-radius:5px; object-fit:cover; cursor:zoom-in;"></td><td><button class="btn-dl-h" onclick='openReportModal(${JSON.stringify(stu)})'>PDF</button></td>`;
        tbody.appendChild(tr);
    });
    students.forEach(s => {
        const done = attendances.find(a => a.regNo === s.regNo && a.date.startsWith(todayStr)), currentShiftObj = config.shifts.find(sh => sh.id === s.shift);
        if(!done && currentShiftObj && currentShiftObj.end && currentTimeStr > currentShiftObj.end) {
            const tr = document.createElement('tr'); tr.style.background = "#fff1f1";
            tr.innerHTML = `<td>${s.name}</td><td>${s.regNo}</td><td>${formatAppDate(now)} <span style="color:#ef4444; font-weight:bold;">(ABSENT)</span></td><td style="color:#ef4444; font-size:0.7rem; font-weight:bold;">SHIFT EXPIRED</td><td><button class="btn-dl-h" onclick='openReportModal(${JSON.stringify(s)})'>PDF</button></td>`;
            tbody.appendChild(tr);
        }
    });
}

function zoomPhoto(src) { const overlay = document.getElementById('zoom-overlay'), img = document.getElementById('zoomed-img'); img.src = src; overlay.style.display = 'flex'; }

function downloadSpecificMonthStudent(idx) { generatePDF(loggedInStudent, idx); }

function logout() {
    loggedInStudent = null; document.getElementById('main-app').style.display = 'none'; document.getElementById('login-sec').style.display = 'flex';
    document.getElementById('stuReg').value = ''; document.getElementById('stuMobile').value = ''; document.getElementById('admin-bottom-nav').style.display = 'none'; toggleLoginType('admin');
}

function logoutAdmin() {
    document.getElementById('main-app').style.display = 'none'; document.getElementById('login-sec').style.display = 'flex';
    document.getElementById('adminId').value = ''; document.getElementById('adminPass').value = ''; document.getElementById('admin-bottom-nav').style.display = 'none'; toggleLoginType('admin');
}

function initCrop(input, type) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            if (cropper) cropper.destroy();
            const box = document.getElementById(`${type}-crop-box`), img = document.getElementById(`${type}-crop-image`);
            img.src = e.target.result; box.style.display = 'flex'; document.getElementById(`${type}-preview-img`).style.display = 'none';
            cropper = new Cropper(img, { aspectRatio: (type === 'sig') ? 5/2 : 1, viewMode: 1 });
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function applyCrop(type) {
    if (!cropper) return; const canvas = (type === 'photo') ? cropper.getCroppedCanvas({width:300,height:300}) : cropper.getCroppedCanvas({width:750,height:300});
    let finalData = canvas.toDataURL(); if(type === 'photo') photoData = finalData; else sigData = finalData;
    const prev = document.getElementById(`${type}-preview-img`); prev.src = finalData; prev.style.display = 'block';
    document.getElementById(`${type}-crop-box`).style.display = 'none'; cropper.destroy(); cropper = null;
}

function cancelCrop(type) {
    if (cropper) cropper.destroy(); cropper = null; document.getElementById(`${type}-crop-box`).style.display = 'none';
    document.getElementById(`${type}Input`).value = ''; document.getElementById(`${type}-preview-img`).style.display = 'none';
    if (type === 'photo') photoData = null; else sigData = null;
}

function renderShiftList() {
    const list = document.getElementById('shiftList'); list.innerHTML = config.shifts.length ? '' : '<p style="font-size:0.8rem; color:#94a3b8">Add shift plans to start.</p>';
    config.shifts.forEach((s, idx) => {
        const div = document.createElement('div'); div.className = 'shift-item';
        div.innerHTML = `<div><strong>${s.name}</strong><br><small>${s.start} - ${s.end} | ₹${s.price}</small></div><div class="shift-controls"><button class="btn-edit-s" onclick="editShift('${s.id}')">Edit</button><button class="btn-del-s" onclick="removeShift(${idx})">Remove</button></div>`;
        list.appendChild(div);
    });
}

function editShift(sid) {
    const s = config.shifts.find(x => x.id === sid);
    if(s) {
        document.getElementById('editShiftId').value = s.id; document.getElementById('newShiftName').value = s.name;
        document.getElementById('newShiftStart').value = s.start; document.getElementById('newShiftEnd').value = s.end;
        document.getElementById('newShiftPrice').value = s.price; document.getElementById('addShiftBtn').innerText = "Update Shift";
    }
}

function addNewShift() {
    const name = document.getElementById('newShiftName').value.trim(), start = document.getElementById('newShiftStart').value, end = document.getElementById('newShiftEnd').value, price = document.getElementById('newShiftPrice').value, editId = document.getElementById('editShiftId').value;
    if(!name || !price || !start || !end) return alert("Shift details missing!");
    if(editId) {
        const idx = config.shifts.findIndex(x => x.id === editId); config.shifts[idx] = { ...config.shifts[idx], name, start, end, price: parseInt(price) };
        document.getElementById('editShiftId').value = ''; document.getElementById('addShiftBtn').innerText = "Update Shift";
    } else { const newId = 's' + Date.now(); config.shifts.push({ id: newId, name, start, end, price: parseInt(price) }); db[newId] = []; }
    document.getElementById('newShiftName').value = ''; document.getElementById('newShiftStart').value = ''; document.getElementById('newShiftEnd').value = ''; document.getElementById('newShiftPrice').value = '';
    document.getElementById('err-shift-setup').style.display = 'none'; renderShiftList(); saveToLocal();
}

function removeShift(idx) { config.shifts.splice(idx, 1); renderShiftList(); saveToLocal(); }

function saveOwnerSettings() {
    document.querySelectorAll('.error-msg').forEach(e => e.style.display = 'none');
    const name = document.getElementById('libName').value.trim(), seats = document.getElementById('totalSeatsConfig').value, upi = document.getElementById('ownerUPI').value.trim(), mobile = document.getElementById('ownerMobile').value.trim(), addr = document.getElementById('ownerAddress').value.trim(), pin = document.getElementById('ownerPin').value.trim();
    let err = false;
    if(!name) { document.getElementById('err-libName').style.display='block'; err=true; }
    if(!/^\d{10}$/.test(mobile)) { document.getElementById('err-ownerMobile').style.display='block'; err=true; }
    if(!seats || seats <= 0) { document.getElementById('err-totalSeats').style.display='block'; err=true; }
    if(!/^[\w.-]+@[\w.-]+$/.test(upi)) { document.getElementById('err-ownerUPI').style.display='block'; err=true; }
    if(!addr) { document.getElementById('err-ownerAddress').style.display='block'; err=true; }
    if(!/^\d{6}$/.test(pin)) { document.getElementById('err-ownerPin').style.display='block'; err=true; }
    if(!sigData) { document.getElementById('err-sig').style.display='block'; err=true; }
    if(config.shifts.length === 0) { document.getElementById('err-shift-setup').style.display='block'; err=true; }
    if(err) return;
    config = {...config, libName: name, totalSeats: parseInt(seats), upi, mobile, address: addr, pin: pin, signature: sigData};
    document.getElementById('displayLibName').innerText = config.libName; document.getElementById('displayUPI').innerText = "Pay to: " + config.upi; document.getElementById('feeDisplayUPI').innerText = "Pay to: " + config.upi;
    const dropdown = document.getElementById('shift'); dropdown.innerHTML = '<option value="">-- Choose a Shift --</option>';
    config.shifts.forEach(s => { if(!db[s.id]) db[s.id] = []; const timeRange = s.start && s.end ? ` (${s.start}-${s.end})` : ""; dropdown.add(new Option(`${s.name}${timeRange} (₹${s.price})`, s.id)); });
    saveToLocal(); alert("System Configured Successfully!"); switchTab('booking-sec', document.querySelectorAll('.nav-item')[1]);
}

function proceedToSeats() {
    document.querySelectorAll('.error-msg').forEach(e => e.style.display = 'none'); let err = false;
    if(!document.getElementById('name').value.trim()) { document.getElementById('err-name').style.display='block'; err=true; }
    if(!document.getElementById('fname').value.trim()) { document.getElementById('err-fname').style.display='block'; err=true; }
    if(!/^\d{10}$/.test(document.getElementById('mobile').value)) { document.getElementById('err-mobile').style.display='block'; err=true; }
    if(!/^\S+@\S+\.\S+$/.test(document.getElementById('email').value)) { document.getElementById('err-email').style.display='block'; err=true; }
    if(!document.getElementById('dob').value) { document.getElementById('err-dob').style.display='block'; err=true; }
    if(!photoData) { document.getElementById('err-photo').style.display='block'; err=true; }
    if(!document.getElementById('shift').value) { document.getElementById('err-shift-select').style.display='block'; err=true; }
    if(err) return;
    document.getElementById('student-details-step').style.display = 'none'; document.getElementById('seat-selection-step').style.display = 'block'; document.getElementById('gridPanel').style.display = 'block'; initGrid();
}

function backToDetails() { document.getElementById('student-details-step').style.display = 'block'; document.getElementById('seat-selection-step').style.display = 'none'; document.getElementById('gridPanel').style.display = 'none'; }

function initGrid() {
    const grid = document.getElementById('seatGrid'); grid.innerHTML = ''; const sid = document.getElementById('shift').value, editId = document.getElementById('editId').value;
    if(!sid) return; const selectedShiftObj = config.shifts.find(x => x.id === sid);
    for (let i = 1; i <= config.totalSeats; i++) {
        const seat = document.createElement('div'); seat.className = 'seat';
        let booked = students.some(s => { if(s.id === editId) return false; if(s.seat !== i) return false; const otherShift = config.shifts.find(sh => sh.id === s.shift); return (otherShift && selectedShiftObj.start < otherShift.end && selectedShiftObj.end > otherShift.start); });
        if (booked) { seat.classList.add('booked'); seat.innerText = 'X'; } else { 
            seat.innerText = i; seat.onclick = () => { document.querySelectorAll('.seat').forEach(s => s.classList.remove('selected')); seat.classList.add('selected'); selectedSeat = i; document.getElementById('seatDisplay').value = "Seat No: " + i; hideError('err-seat'); };
        }
        if(selectedSeat === i) seat.classList.add('selected'); grid.appendChild(seat);
    }
}

function checkOtherApp(type) {
    if(type === 'main') { const val = document.getElementById('payApp').value; document.getElementById('otherAppNameArea').style.display = (val === 'Other') ? 'block' : 'none'; }
    else { const val = document.getElementById('feePayApp').value; document.getElementById('feeOtherAppNameArea').style.display = (val === 'Other') ? 'block' : 'none'; }
}

function toggleQR(type) {
    if(type === 'main') {
        const method = document.getElementById('payMethod').value, qrArea = document.getElementById('qrArea'), onlineArea = document.getElementById('onlineDetailsArea'), sid = document.getElementById('shift').value;
        if (method === "Online") { onlineArea.style.display = 'block'; if(config.upi && sid) { const s = config.shifts.find(x => x.id === sid), link = `upi://pay?pa=${config.upi}&pn=${config.libName}&am=${s.price}&cu=INR`; document.getElementById('qrImg').src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(link)}`; qrArea.style.display = 'block'; } }
        else { qrArea.style.display = 'none'; onlineArea.style.display = 'none'; }
    } else {
        const method = document.getElementById('feePayMode').value, onlineArea = document.getElementById('feeOnlineDetails'), qrArea = document.getElementById('feeQrArea'), amount = document.getElementById('feeAmount').value;
        if (method === "Online") { onlineArea.style.display = 'block'; if(config.upi && amount > 0) { const link = `upi://pay?pa=${config.upi}&pn=${config.libName}&am=${amount}&cu=INR`; document.getElementById('feeQrImg').src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(link)}`; qrArea.style.display = 'block'; } else { qrArea.style.display = 'none'; } }
        else { onlineArea.style.display = 'none'; qrArea.style.display = 'none'; }
    }
}

function validateAndBook() {
    document.querySelectorAll('.error-msg').forEach(e => e.style.display = 'none'); let err = false;
    if (!selectedSeat) { document.getElementById('err-seat').style.display = 'block'; err = true; }
    const sid = document.getElementById('shift').value, editId = document.getElementById('editId').value, selectedShiftObj = config.shifts.find(x => x.id === sid);
    const conflict = students.some(s => { if (s.id === editId) return false; if (s.seat !== selectedSeat) return false; const otherShift = config.shifts.find(sh => sh.id === s.shift); return (otherShift && selectedShiftObj.start < otherShift.end && selectedShiftObj.end > otherShift.start); });
    if (conflict) { alert("Error: This seat is already booked by another student in a conflicting time shift."); return; }
    const method = document.getElementById('payMethod').value; let pApp = document.getElementById('payApp').value, tId = document.getElementById('txnId').value.trim();
    if(method === "Online") { if(pApp === "Other") { pApp = document.getElementById('otherAppName').value.trim(); if(!pApp) { document.getElementById('err-otherApp').style.display = 'block'; err = true; } } if(!tId) { document.getElementById('err-txnId').style.display = 'block'; err = true; } }
    if(err) return;
    const sInfo = config.shifts.find(x => x.id === sid); let existingFeeHistory = [], originalDate = new Date().toISOString(), regNo = 'REG' + Math.floor(1000000000 + Math.random() * 9000000000).toString().slice(0,10);
    let finalMode = method, finalApp = (method === "Online" ? pApp : "N/A"), finalTxn = (method === "Online" ? tId : "N/A");
    if(editId) { const oldRecord = students.find(x => x.id === editId); if(oldRecord) { existingFeeHistory = oldRecord.feeHistory || []; originalDate = oldRecord.date; regNo = oldRecord.regNo; finalMode = oldRecord.mode; finalApp = oldRecord.payApp; finalTxn = oldRecord.txnId; } }
    else { const currentMonth = new Date().toISOString().slice(0, 7); existingFeeHistory = [{ month: currentMonth, entryDate: new Date().toISOString(), amount: sInfo.price, mode: method, payApp: method === "Online" ? pApp : "Cash", txnId: method === "Online" ? tId : "N/A", status: "PAID", seatAtTime: selectedSeat, shiftAtTime: sInfo.name }]; }
    const data = { id: editId || regNo, regNo: regNo, date: originalDate, name: document.getElementById('name').value, fname: document.getElementById('fname').value, mobile: document.getElementById('mobile').value, email: document.getElementById('email').value, dob: document.getElementById('dob').value, shift: sid, shiftName: sInfo.name, mode: finalMode, payApp: finalApp, txnId: finalTxn, seat: selectedSeat, amount: sInfo.price, photo: photoData, feeHistory: existingFeeHistory };
    if(editId) { const old = students.find(x => x.id === editId); db[old.shift] = db[old.shift].filter(n => n !== old.seat); students = students.filter(x => x.id !== editId); }
    db[sid].push(selectedSeat); students.push(data); saveToLocal(); alert("Record Saved Successfully!"); resetForm();
}

function generatePDF(data, feeEntryIndex = -1) {
    const { jsPDF } = window.jspdf; const doc = new jsPDF(); let d = new Date(data.date);
    let currentApp = data.payApp, currentTxn = data.txnId, currentMode = data.mode, currentAmount = data.amount, currentSeat = data.seat, currentShift = data.shiftName, paymentMonth = getFullMonthName(new Date(data.date).toISOString().slice(0, 7));
    if(feeEntryIndex !== -1 && data.feeHistory && data.feeHistory[feeEntryIndex]) { const selectedFee = data.feeHistory[feeEntryIndex], feeMonthDate = new Date(selectedFee.month + "-01"); d = new Date(feeMonthDate); d.setMonth(d.getMonth() + 1); d.setDate(new Date(data.date).getDate()); currentApp = selectedFee.payApp; currentTxn = selectedFee.txnId; currentMode = selectedFee.mode; currentAmount = selectedFee.amount; paymentMonth = getFullMonthName(selectedFee.month); if(selectedFee.seatAtTime) currentSeat = selectedFee.seatAtTime; if(selectedFee.shiftAtTime) currentShift = selectedFee.shiftAtTime; }
    else if(data.feeHistory && data.feeHistory.length > 0) { const firstFee = data.feeHistory[0], feeMonthDate = new Date(firstFee.month + "-01"); d = new Date(firstFee.month + "-01"); d.setMonth(d.getMonth() + 1); d.setDate(new Date(data.date).getDate()); currentApp = firstFee.payApp; currentTxn = firstFee.txnId; currentMode = firstFee.mode; currentAmount = firstFee.amount; paymentMonth = getFullMonthName(firstFee.month); if(firstFee.seatAtTime) currentSeat = firstFee.seatAtTime; if(firstFee.shiftAtTime) currentShift = firstFee.shiftAtTime; }
    else d.setDate(d.getDate() + 30);
    const dueDateStr = formatAppDate(d); doc.setFontSize(22); doc.setTextColor(37, 99, 235); doc.text(config.libName.toUpperCase(), 105, 20, {align:"center"});
    doc.setFontSize(9); doc.setTextColor(100); doc.text(`${config.address} - ${config.pin}`, 105, 26, {align:"center"}); doc.text("OFFICIAL REGISTRATION RECEIPT", 105, 32, {align:"center"}); doc.line(20, 35, 190, 35);
    if(data.photo) { try { doc.addImage(data.photo, 'JPEG', 150, 45, 35, 35); } catch(e) {} }
    doc.setFontSize(12); doc.setTextColor(0); doc.text(`Registration No: ${data.regNo}`, 20, 50); doc.text(`Name: ${data.name}`, 20, 60); doc.text(`Guardian: ${data.fname}`, 20, 70); doc.text(`Mobile: ${data.mobile}`, 20, 80); doc.text(`Date of Birth: ${formatAppDate(data.dob)}`, 20, 90); doc.text(`Seat Number: ${currentSeat}`, 20, 100); doc.text(`Shift Plan: ${currentShift}`, 20, 110); doc.setFont("helvetica", "bold"); doc.text(`Payment for Month: ${paymentMonth}`, 20, 120); doc.setFont("helvetica", "normal"); doc.text(`Fee Paid: INR ${currentAmount} (${currentMode})`, 20, 130);
    if(currentMode === "Online") { doc.setFontSize(10); doc.text(`App: ${currentApp} | Txn ID: ${currentTxn}`, 20, 138); }
    doc.setFontSize(12); doc.text(`Registration Date: ${formatAppDate(data.date)}`, 20, 146); doc.setFont("helvetica", "bold"); doc.setTextColor(239, 68, 68); doc.text(`NEXT FEE DUE DATE: ${dueDateStr}`, 20, 154);
    doc.setTextColor(0); doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text("Authorized Signature:", 150, 165); if(config.signature) { try { doc.addImage(config.signature, 'PNG', 150, 168, 40, 20); } catch(e) {} }
    doc.setDrawColor(239, 68, 68); doc.circle(40, 185, 20); doc.setFontSize(7); doc.setTextColor(239, 68, 68); doc.text("PAID & VERIFIED", 40, 180, {align:"center"}); doc.text(config.libName, 40, 185, {align:"center"}); doc.text(`Ph: ${config.mobile}`, 40, 190, {align:"center"}); doc.save(`${data.name}_Receipt.pdf`);
}

function renderHistory() {
    const body = document.getElementById('historyBody'), query = document.getElementById('searchInput').value.toLowerCase();
    if(historyFilter === 'attendance') { renderAdminAttendance(); return; }
    body.innerHTML = ''; const today = new Date();
    const filtered = students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(query) || s.regNo.toLowerCase().includes(query) || s.mobile.includes(query);
        let dueDate = new Date(s.date); if(s.feeHistory && s.feeHistory.length > 0) { const lastFee = [...s.feeHistory].sort((a,b) => new Date(b.month) - new Date(a.month))[0]; const lastMonth = new Date(lastFee.month + "-01"); dueDate = new Date(lastMonth); dueDate.setMonth(dueDate.getMonth() + 1); dueDate.setDate(new Date(s.date).getDate()); } else dueDate.setDate(dueDate.getDate() + 30);
        const isPaid = today < dueDate; if(historyFilter === 'paid') return matchesSearch && isPaid; if(historyFilter === 'pending') return matchesSearch && !isPaid; return matchesSearch;
    });
    if(!filtered.length) { body.innerHTML = '<p style="text-align:center; margin-top:50px; color:#94a3b8">No records found matching your selection.</p>'; return; }
    filtered.slice().reverse().forEach(s => {
        let dueDate = new Date(s.date); if(s.feeHistory && s.feeHistory.length > 0) { const lastFee = [...s.feeHistory].sort((a,b) => new Date(b.month) - new Date(a.month))[0]; const lastMonth = new Date(lastFee.month + "-01"); dueDate = new Date(lastMonth); dueDate.setMonth(dueDate.getMonth() + 1); dueDate.setDate(new Date(s.date).getDate()); } else dueDate.setDate(dueDate.getDate() + 30);
        const dueDateStr = formatAppDate(dueDate); let statusColor = (today < dueDate) ? "#22c55e" : "#ef4444", statusText = (today < dueDate) ? "FEE STATUS: PAID" : "FEE STATUS: PENDING";
        const card = document.createElement('div'); card.className = 'history-card'; card.style.borderLeft = `6px solid ${statusColor}`;
        card.innerHTML = `<div style="display:flex; gap:10px; align-items:center;">${s.photo ? `<img src="${s.photo}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">` : ''}<div style="flex:1"><p><strong>${s.name}</strong> <span style="float:right; color:#64748b; font-size:0.7rem;">Reg: ${s.regNo}</span></p><p style="font-size:0.8rem; margin:2px 0;">Seat: ${s.seat} | ${s.shiftName}</p><p style="font-size:0.7rem; font-weight:bold; color:${statusColor}; margin-top:4px;">● ${statusText}</p><p style="font-size:0.7rem; color:#475569;">Reg Date: ${formatAppDate(s.date)}</p><p style="font-size:0.7rem; color:#475569;">Next Due Date: <strong>${dueDateStr}</strong></p></div></div><div class="card-actions"><button class="btn-fee-h" onclick="openFeePanel('${s.id}')">Manage Fees</button><button class="btn-att-h" onclick='openReportModal(${JSON.stringify(s)})'>Attendance Report</button><button class="btn-edit-h" onclick="editRecord('${s.id}')">Edit</button><button class="btn-del-h" onclick="deleteRecord('${s.id}')">Delete</button></div>`;
        body.appendChild(card);
    });
}

function openFeePanel(id) {
    currentFeeStudentId = id; const s = students.find(x => x.id === id); document.getElementById('fee-panel').style.display = 'block';
    document.getElementById('fee-student-name').innerText = `ID: ${s.regNo} | ${s.name} | Seat: ${s.seat}`; document.getElementById('feeMonth').value = new Date().toISOString().slice(0, 7); document.getElementById('feeAmount').value = s.amount; document.getElementById('feePayMode').value = "Cash"; document.getElementById('editFeeLogIndex').value = ""; document.getElementById('btnFeeSubmit').innerText = "Deposit Fee"; document.getElementById('btnFeeCancel').style.display = "none";
    document.querySelectorAll('.error-msg').forEach(e => e.style.display = 'none'); toggleQR('fee'); renderFeeLogs(); document.getElementById('fee-panel').scrollIntoView({ behavior: 'smooth' });
}

function saveNewMonthlyFee() {
    document.querySelectorAll('.error-msg').forEach(e => e.style.display = 'none');
    const monthValue = document.getElementById('feeMonth').value, amount = document.getElementById('feeAmount').value, mode = document.getElementById('feePayMode').value;
    let app = document.getElementById('feePayApp').value; const txn = document.getElementById('feeTxnId').value.trim(), editIndex = document.getElementById('editFeeLogIndex').value;
    let err = false; if(!monthValue || !amount) return alert("Please fill month and amount!");
    const s = students.find(x => x.id === currentFeeStudentId); if(!s.feeHistory) s.feeHistory = [];
    if(monthValue < s.date.slice(0, 7)) { alert(`Error: Fee entry for months before registration is not allowed!`); return; }
    if(editIndex === "" && s.feeHistory.some(f => f.month === monthValue)) return alert("Error: This month's fee already recorded!");
    if(mode === "Online") { if(app === "Other") { app = document.getElementById('feeOtherAppName').value.trim(); if(!app) { document.getElementById('err-feeOtherApp').style.display = 'block'; err = true; } } if(!txn) { document.getElementById('err-feeTxnId').style.display = 'block'; err = true; } }
    if(err) return;
    const feeData = { month: monthValue, entryDate: new Date().toISOString(), amount: amount, mode: mode, payApp: mode === "Online" ? app : "Cash", txnId: mode === "Online" ? txn : "N/A", status: "PAID", seatAtTime: s.seat, shiftAtTime: s.shiftName };
    if(editIndex !== "") { s.feeHistory[editIndex] = feeData; resetFeeForm(); } else s.feeHistory.push(feeData);
    saveToLocal(); alert("Fee record saved."); renderFeeLogs(); renderHistory();
}

function resetFeeForm() {
    document.getElementById('editFeeLogIndex').value = ""; document.getElementById('btnFeeSubmit').innerText = "Deposit Fee"; document.getElementById('btnFeeCancel').style.display = "none";
    document.getElementById('feeMonth').value = new Date().toISOString().slice(0, 7); document.getElementById('feePayMode').value = "Cash"; document.getElementById('feeTxnId').value = ""; document.getElementById('feeOtherAppName').value = ""; toggleQR('fee'); checkOtherApp('fee');
}

function renderFeeLogs() {
    const s = students.find(x => x.id === currentFeeStudentId), tbody = document.getElementById('feeLogsBody'); tbody.innerHTML = '';
    if(!s.feeHistory || s.feeHistory.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">No history found.</td></tr>'; return; }
    s.feeHistory.forEach((f, index) => {
        const tr = document.createElement('tr'); const actions = (index === 0) ? `<button class="btn-dl-h" onclick="downloadSpecificMonth(${index})">PDF</button> <span style="font-size:0.6rem; color:#94a3b8;">(Locked)</span>` : `<button class="btn-fee-edit" onclick="editFeeEntry(${index})">Edit</button><button class="btn-dl-h" onclick="downloadSpecificMonth(${index})">PDF</button><button class="btn-fee-del" onclick="deleteFeeEntry(${index})">Del</button>`;
        tr.innerHTML = `<td><strong>${getFullMonthName(f.month)}</strong></td><td>${formatAppDate(f.entryDate)}</td><td>₹${f.amount}</td><td>${f.mode === 'Online' ? f.payApp : 'Cash'}</td><td>${f.txnId}</td><td>${actions}</td>`;
        tbody.appendChild(tr);
    });
}

function downloadSpecificMonth(index) { const s = students.find(x => x.id === currentFeeStudentId); if(s) generatePDF(s, index); }

function editFeeEntry(index) {
    if(index === 0) return; const s = students.find(x => x.id === currentFeeStudentId), f = s.feeHistory[index];
    document.getElementById('feeMonth').value = f.month; document.getElementById('feeAmount').value = f.amount; document.getElementById('feePayMode').value = f.mode; document.getElementById('editFeeLogIndex').value = index;
    document.getElementById('btnFeeSubmit').innerText = "Update Entry"; document.getElementById('btnFeeCancel').style.display = "block";
    if(f.mode === "Online") { const apps = ["PhonePe", "Google Pay", "Paytm", "Supermoney", "Navi", "BHIM"]; if(apps.includes(f.payApp)) document.getElementById('feePayApp').value = f.payApp; else { document.getElementById('feePayApp').value = "Other"; document.getElementById('feeOtherAppName').value = f.payApp; } document.getElementById('feeTxnId').value = f.txnId; }
    toggleQR('fee'); checkOtherApp('fee');
}

function deleteFeeEntry(index) { if(index === 0) return; if(!confirm("Delete this fee record?")) return; const s = students.find(x => x.id === currentFeeStudentId); s.feeHistory.splice(index, 1); saveToLocal(); renderFeeLogs(); renderHistory(); }

function editRecord(id) {
    const s = students.find(x => x.id === id); switchTab('booking-sec', document.querySelectorAll('.nav-item')[1]);
    document.getElementById('editId').value = s.id; document.getElementById('name').value = s.name; document.getElementById('fname').value = s.fname; document.getElementById('mobile').value = s.mobile; document.getElementById('email').value = s.email; document.getElementById('shift').value = s.shift; document.getElementById('dob').value = s.dob || '';
    const payMethodSelect = document.getElementById('payMethod'), payAppSelect = document.getElementById('payApp'), txnInput = document.getElementById('txnId'), otherAppInput = document.getElementById('otherAppName');
    payMethodSelect.value = s.mode; payMethodSelect.disabled = true;
    if(s.mode === "Online") { txnInput.value = s.txnId; txnInput.readOnly = true; const apps = ["PhonePe", "Google Pay", "Paytm", "Supermoney", "Navi", "BHIM"]; if(apps.includes(s.payApp)) payAppSelect.value = s.payApp; else { payAppSelect.value = "Other"; otherAppInput.value = s.payApp; otherAppInput.readOnly = true; } payAppSelect.disabled = true; }
    else { payAppSelect.disabled = true; txnInput.readOnly = true; }
    photoData = s.photo; if(photoData) { const prev = document.getElementById('photo-preview-img'); prev.src = photoData; prev.style.display = 'block'; }
    selectedSeat = s.seat; document.getElementById('seatDisplay').value = "Seat No: " + s.seat;
    document.getElementById('formTitle').innerText = "Update Registration"; document.getElementById('cancelEditBtn').style.display = "block"; document.getElementById('mainBtn').innerText = "Confirm to Update";
    updateShift();
}

function deleteRecord(id) { if(!confirm("Erase this record?")) return; const s = students.find(x => x.id === id); db[s.shift] = db[s.shift].filter(n => n !== s.seat); attendances = attendances.filter(a => a.regNo !== s.regNo); students = students.filter(x => x.id !== id); saveToLocal(); renderHistory(); }

function switchTab(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active')); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const target = document.getElementById(id); if(target) target.classList.add('active'); if(el) el.classList.add('active');
    if(id === 'history-sec') renderHistory();
}

function updateShift() {
    const sid = document.getElementById('shift').value; if(!sid) return document.getElementById('priceDisplay').innerText = `Payable: ₹0`;
    const s = config.shifts.find(x => x.id === sid); if(s) { document.getElementById('priceDisplay').innerText = `Payable: ₹${s.price}`; hideError('err-shift-select'); }
    toggleQR('main'); initGrid();
}

function resetForm() {
    document.querySelectorAll('#booking-sec input').forEach(i => { i.value = ''; i.readOnly = false; }); document.querySelectorAll('#booking-sec select').forEach(s => { s.disabled = false; });
    document.getElementById('otherAppName').readOnly = false; document.getElementById('editId').value = ''; photoData = null; selectedSeat = null; document.getElementById('shift').value = ""; document.getElementById('payMethod').value = "Cash"; document.getElementById('photo-preview-img').style.display = "none"; document.getElementById('cancelEditBtn').style.display = "none"; document.getElementById('formTitle').innerText = "Student Information"; document.getElementById('mainBtn').innerText = "Self Confirm Your Registration";
    toggleQR('main'); backToDetails();
}
