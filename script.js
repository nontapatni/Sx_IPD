import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-analytics.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyClYDNeWk_yEm0WWe65qm4F7iBGStE6-KI",
    authDomain: "sx-ipd.firebaseapp.com",
    projectId: "sx-ipd",
    storageBucket: "sx-ipd.firebasestorage.app",
    messagingSenderId: "1636907648",
    appId: "1:1636907648:web:d658a6ba7f9c49e0465",
    measurementId: "G-VKXGJ4M03C"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const COLLECTION_NAME = "patients";
const SCHEDULE_COLLECTION = "schedules"; // 📅 สร้าง Collection ใหม่สำหรับตารางเวร

// --- LOGIN LOGIC ---
const loginForm = document.getElementById('login-form');
const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const loginError = document.getElementById('login-error');
const WARD_PASSCODE = "1234"; 

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (document.getElementById('login-password').value === WARD_PASSCODE) {
        localStorage.setItem('sx_ipd_is_logged_in', 'true');
        loginScreen.style.display = 'none';
        appContainer.style.display = 'block';
        initApp();
    } else {
        loginError.style.display = 'block';
        document.getElementById('login-password').value = '';
    }
});

// --- UI Logic: Tabs & Modals ---
window.switchTab = (tabName) => {
    // จัดการปุ่ม
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');

    // สลับหน้า View
    if (tabName === 'patients') {
        document.getElementById('patients-view').style.display = 'block';
        document.getElementById('schedule-view').style.display = 'none';
    } else {
        document.getElementById('patients-view').style.display = 'none';
        document.getElementById('schedule-view').style.display = 'block';
    }
}

window.closeModal = (modalId) => {
    document.getElementById(modalId).style.display = 'none';
}

// Global Elements
const patientList = document.getElementById('patient-list');
const dischargedList = document.getElementById('discharged-list');
const dutyList = document.getElementById('duty-list'); // 📅 ตารางเวร

// Modal 1: Admit
const addBtn = document.getElementById('add-btn');
const modal = document.getElementById('modal');
const admitForm = document.getElementById('admit-form');
const searchInput = document.getElementById('searchInput');
const modalTitle = document.getElementById('modal-title');
const submitBtn = document.getElementById('submit-btn');

// Modal 2: Schedule
const addDutyBtn = document.getElementById('add-duty-btn');
const dutyModal = document.getElementById('duty-modal');
const dutyForm = document.getElementById('duty-form');

let allPatientsData = [];

// Check Auto Login
if (localStorage.getItem('sx_ipd_is_logged_in') === 'true') {
    loginScreen.style.display = 'none';
    appContainer.style.display = 'block';
    initApp();
}

if(document.getElementById('admitDate')) {
    document.getElementById('admitDate').valueAsDate = new Date();
}
if(document.getElementById('duty-date')) {
    document.getElementById('duty-date').valueAsDate = new Date();
}

// ------------------------------------------------------------------
// 1. App Initialization (Listeners)
// ------------------------------------------------------------------
function initApp() {
    console.log("Starting Firebase Listeners...");
    
    // 1.1 Listener for Patients
    const qPatients = query(collection(db, COLLECTION_NAME), orderBy("ward")); 
    onSnapshot(qPatients, (querySnapshot) => {
        allPatientsData = [];
        querySnapshot.forEach((docSnap) => {
            allPatientsData.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderPatients(allPatientsData);
    });

    // 1.2 Listener for Schedules 📅
    const qSchedule = query(collection(db, SCHEDULE_COLLECTION), orderBy("date"));
    onSnapshot(qSchedule, (snapshot) => {
        const duties = [];
        snapshot.forEach(doc => duties.push({ id: doc.id, ...doc.data() }));
        renderSchedule(duties);
    });
}

// ------------------------------------------------------------------
// 2. Patient Logic (Render & CRUD)
// ------------------------------------------------------------------
function renderPatients(data) {
    const keyword = searchInput.value.toLowerCase().trim();
    const filteredData = data.filter(pt => {
        const searchStr = `${pt.ward} ${pt.hn} ${pt.an} ${pt.name} ${pt.bed} ${pt.diag}`.toLowerCase();
        return searchStr.includes(keyword);
    });

    patientList.innerHTML = '';
    dischargedList.innerHTML = '';
    
    const activeCases = filteredData.filter(pt => pt.status !== 'Discharged');
    const dischargedCases = filteredData.filter(pt => pt.status === 'Discharged');

    if (activeCases.length === 0) patientList.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px;">ไม่พบข้อมูล</td></tr>';
    else activeCases.forEach(pt => patientList.appendChild(createPatientRow(pt, true)));

    if (dischargedCases.length === 0) dischargedList.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#999;">ยังไม่มีรายการจำหน่าย</td></tr>';
    else dischargedCases.forEach(pt => dischargedList.appendChild(createPatientRow(pt, false)));
}

searchInput.addEventListener('input', () => renderPatients(allPatientsData));

function createPatientRow(pt, isActive) {
    const row = document.createElement('tr');
    let actionButtons = isActive ? `
        <button class="btn-sm btn-edit" onclick="window.openEditModal('${pt.id}')"><i class="fas fa-edit"></i></button>
        <button class="btn-sm btn-dc" onclick="window.dischargeCase('${pt.id}')">D/C</button>
        <button class="btn-sm btn-delete" onclick="window.deleteCase('${pt.id}')"><i class="fas fa-trash"></i></button>
    ` : `
        <button class="btn-sm" style="background-color: #3498db;" onclick="window.readmitCase('${pt.id}')"><i class="fas fa-undo"></i></button>
        <button class="btn-sm btn-delete" onclick="window.deleteCase('${pt.id}')"><i class="fas fa-trash"></i></button>
    `;

    row.innerHTML = `
        <td><strong>${pt.ward || '-'}</strong></td>
        <td><div style="font-size:1.1em;">${pt.bed || '?'}</div></td>
        <td>${pt.date || '-'}</td>
        <td><div><strong>HN:</strong> ${pt.hn || '-'}</div><div class="text-muted"><strong>AN:</strong> ${pt.an || '-'}</div></td>
        <td><div style="font-weight:600;">${pt.name || 'ไม่ระบุชื่อ'}</div><div class="text-muted">${pt.age ? pt.age + ' ปี' : '-'} / ${pt.gender || '-'}</div></td>
        <td>${pt.diag || '-'}</td>
        <td>${pt.owner || '-'}</td>
        <td class="text-orange">${pt.note || '-'}</td>
        <td><div class="action-buttons">${actionButtons}</div></td>
    `;
    return row;
}

// ------------------------------------------------------------------
// 3. Schedule Logic (Render & CRUD) 📅
// ------------------------------------------------------------------
function renderSchedule(duties) {
    dutyList.innerHTML = '';
    if (duties.length === 0) {
        dutyList.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">ยังไม่มีตารางเวร</td></tr>';
        return;
    }

    duties.forEach(duty => {
        const row = document.createElement('tr');
        // แปลงวันที่ให้สวยงาม (เช่น 2024-01-25 -> Fri, 25/01/24)
        const dateObj = new Date(duty.date);
        const dateStr = dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'numeric' });
        
        // Highlight วันนี้
        const todayStr = new Date().toISOString().split('T')[0];
        const isToday = duty.date === todayStr;
        if(isToday) row.style.backgroundColor = "#e8f8f5"; // สีเขียวอ่อนๆ

        row.innerHTML = `
            <td>
                <strong>${dateStr}</strong> 
                ${isToday ? '<span style="color:green; font-size:0.8em;">(Today)</span>' : ''}
            </td>
            <td>${duty.staff || '-'}</td>
            <td>${duty.resident || '-'}</td>
            <td>${duty.extern || '-'}</td>
            <td>
                <button class="btn-sm btn-delete" onclick="window.deleteDuty('${duty.id}')"><i class="fas fa-trash"></i></button>
            </td>
        `;
        dutyList.appendChild(row);
    });
}

// Add Duty
dutyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dutyData = {
        date: document.getElementById('duty-date').value,
        staff: document.getElementById('duty-staff').value,
        resident: document.getElementById('duty-res').value,
        extern: document.getElementById('duty-ext').value,
        timestamp: serverTimestamp()
    };
    try {
        await addDoc(collection(db, SCHEDULE_COLLECTION), dutyData);
        window.closeModal('duty-modal');
        dutyForm.reset();
        document.getElementById('duty-date').valueAsDate = new Date();
    } catch (error) {
        alert("Error adding duty: " + error.message);
    }
});

// Delete Duty
window.deleteDuty = async (docId) => {
    if(confirm('ลบรายการเวรนี้?')) {
        await deleteDoc(doc(db, SCHEDULE_COLLECTION, docId));
    }
}

// ------------------------------------------------------------------
// 4. Shared Actions (Patient CRUD)
// ------------------------------------------------------------------
window.dischargeCase = async (docId) => updateDoc(doc(db, COLLECTION_NAME, docId), { status: 'Discharged', dischargedAt: serverTimestamp() });
window.readmitCase = async (docId) => updateDoc(doc(db, COLLECTION_NAME, docId), { status: 'Active', dischargedAt: null });
window.deleteCase = async (docId) => { if(confirm('⚠️ ยืนยันลบข้อมูลถาวร?')) await deleteDoc(doc(db, COLLECTION_NAME, docId)); };
window.logout = () => { if(confirm('ต้องการออกจากระบบหรือไม่?')) { localStorage.removeItem('sx_ipd_is_logged_in'); location.reload(); } };

// Submit Patient Form
admitForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.innerText = "กำลังบันทึก...";
    submitBtn.disabled = true;

    const editDocId = document.getElementById('edit-doc-id').value;
    const patientData = {
        ward: document.getElementById('ward').value || "", 
        bed: document.getElementById('bed').value || "",
        date: document.getElementById('admitDate').value || "",
        hn: document.getElementById('hn').value || "",
        an: document.getElementById('an').value || "",
        name: document.getElementById('name').value || "",
        age: document.getElementById('age').value || "",
        gender: document.getElementById('gender').value || "",
        diag: document.getElementById('diag').value || "",
        owner: document.getElementById('owner').value || "",
        note: document.getElementById('note').value || "",
        status: editDocId ? undefined : "Active",
        timestamp: serverTimestamp()
    };
    if(patientData.status === undefined) delete patientData.status;

    try {
        if (editDocId) await updateDoc(doc(db, COLLECTION_NAME, editDocId), patientData);
        else await addDoc(collection(db, COLLECTION_NAME), patientData);
        window.closeModal('modal');
    } catch (error) {
        alert("บันทึกไม่สำเร็จ: " + error.message);
    } finally {
        submitBtn.innerText = "บันทึกข้อมูล";
        submitBtn.disabled = false;
    }
});

// Edit Modal
window.openEditModal = (id) => {
    const pt = allPatientsData.find(p => p.id === id);
    if (!pt) return;
    modalTitle.innerText = "แก้ไขข้อมูลผู้ป่วย (Edit)";
    document.getElementById('edit-doc-id').value = id;
    document.getElementById('ward').value = pt.ward || "";
    document.getElementById('bed').value = pt.bed || "";
    document.getElementById('admitDate').value = pt.date || "";
    document.getElementById('hn').value = pt.hn || "";
    document.getElementById('an').value = pt.an || "";
    document.getElementById('name').value = pt.name || "";
    document.getElementById('age').value = pt.age || "";
    document.getElementById('gender').value = pt.gender || "";
    document.getElementById('diag').value = pt.diag || "";
    document.getElementById('owner').value = pt.owner || "";
    document.getElementById('note').value = pt.note || "";
    modal.style.display = 'block';
}

// Modal Triggers
addBtn.onclick = () => { 
    admitForm.reset(); 
    document.getElementById('edit-doc-id').value = ""; 
    document.getElementById('admitDate').valueAsDate = new Date();
    modalTitle.innerText = "รับเคสใหม่ (New Admission)";
    modal.style.display = 'block'; 
};
addDutyBtn.onclick = () => { dutyModal.style.display = 'block'; };

window.onclick = (e) => {
    if (e.target == modal) window.closeModal('modal');
    if (e.target == dutyModal) window.closeModal('duty-modal');
}