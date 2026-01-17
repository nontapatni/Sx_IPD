import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-analytics.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

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
const SCHEDULE_COLLECTION = "schedules";

// --- LOGIN LOGIC ---
const loginForm = document.getElementById('login-form');
const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const loginError = document.getElementById('login-error');
const WARD_PASSCODE = "1234"; 

if (loginForm) {
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
}

// --- UI Logic: Tabs & Modals ---
window.switchTab = (tabName) => {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');

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
const dutyList = document.getElementById('duty-list');
const addBtn = document.getElementById('add-btn');
const modal = document.getElementById('modal');
const admitForm = document.getElementById('admit-form');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sort-patients'); // New Sort
const exportBtn = document.getElementById('export-patient-btn'); // New Export
const modalTitle = document.getElementById('modal-title');
const submitBtn = document.getElementById('submit-btn');

const addDutyBtn = document.getElementById('add-duty-btn');
const dutyModal = document.getElementById('duty-modal');
const dutyForm = document.getElementById('duty-form');

const importExcelBtn = document.getElementById('import-excel-btn');
const excelInput = document.getElementById('excel-file');

let allPatientsData = [];
let allDutiesData = [];
let editingDutyId = null;

// Check Auto Login
if (localStorage.getItem('sx_ipd_is_logged_in') === 'true') {
    if(loginScreen) loginScreen.style.display = 'none';
    if(appContainer) appContainer.style.display = 'block';
    initApp();
}

if(document.getElementById('admitDate')) {
    document.getElementById('admitDate').valueAsDate = new Date();
}
if(document.getElementById('duty-date')) {
    document.getElementById('duty-date').valueAsDate = new Date();
}

// ------------------------------------------------------------------
// 1. App Initialization
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

    // 1.2 Listener for Schedules
    const qSchedule = query(collection(db, SCHEDULE_COLLECTION), orderBy("date"));
    onSnapshot(qSchedule, (snapshot) => {
        allDutiesData = [];
        const duties = [];
        snapshot.forEach(doc => {
            const d = { id: doc.id, ...doc.data() };
            duties.push(d);
            allDutiesData.push(d);
        });
        renderSchedule(duties);
    });
}

// ------------------------------------------------------------------
// 2. Patient Logic (Sort & Filter & Export)
// ------------------------------------------------------------------
function renderPatients(data) {
    if(!patientList) return;
    const keyword = searchInput.value.toLowerCase().trim();
    const sortValue = sortSelect.value; // รับค่าจาก Dropdown

    // 2.1 Filter (Search)
    let filteredData = data.filter(pt => {
        const searchStr = `${pt.ward} ${pt.hn} ${pt.an} ${pt.name} ${pt.bed} ${pt.diag}`.toLowerCase();
        return searchStr.includes(keyword);
    });

    // 2.2 Sorting Logic (Client-side)
    filteredData.sort((a, b) => {
        if (sortValue === 'bed') {
            // เรียงเตียงแบบตัวเลข (เช่น 2 มาก่อน 10)
            return (a.bed || '').localeCompare((b.bed || ''), undefined, {numeric: true, sensitivity: 'base'});
        } else if (sortValue === 'date') {
            // เรียงวันที่ (ใหม่ -> เก่า หรือ เก่า -> ใหม่ แล้วแต่ชอบ)
            return new Date(a.date || 0) - new Date(b.date || 0);
        } else {
            // Default: เรียง Ward (String)
            return (a.ward || '').localeCompare(b.ward || '');
        }
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

// Event Listeners for Search & Sort
if(searchInput) searchInput.addEventListener('input', () => renderPatients(allPatientsData));
if(sortSelect) sortSelect.addEventListener('change', () => renderPatients(allPatientsData));

// Export Excel Function
if(exportBtn) {
    exportBtn.onclick = () => {
        if (allPatientsData.length === 0) {
            alert("ไม่มีข้อมูลให้ Export");
            return;
        }

        // เตรียมข้อมูลสำหรับ Excel (เลือกเฉพาะฟิลด์ที่ต้องการ)
        const exportData = allPatientsData.map(pt => ({
            Status: pt.status || 'Active',
            Ward: pt.ward,
            Bed: pt.bed,
            Date: pt.date,
            HN: pt.hn,
            AN: pt.an,
            Name: pt.name,
            Age: pt.age,
            Gender: pt.gender,
            Diagnosis: pt.diag,
            Owner: pt.owner,
            Note: pt.note,
            Created_At: pt.createdAt ? new Date(pt.createdAt.seconds * 1000).toLocaleString() : '-',
            Updated_At: pt.updatedAt ? new Date(pt.updatedAt.seconds * 1000).toLocaleString() : '-'
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Patients");
        
        // Save File
        XLSX.writeFile(workbook, "Sx_IPD_Patients.xlsx");
    }
}

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
// 3. Schedule Logic
// ------------------------------------------------------------------
function renderSchedule(duties) {
    if(!dutyList) return;
    dutyList.innerHTML = '';
    if (duties.length === 0) {
        dutyList.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">ยังไม่มีตารางเวร</td></tr>';
        return;
    }

    duties.forEach(duty => {
        const row = document.createElement('tr');
        let dateStr = duty.date;
        try {
            const dateObj = new Date(duty.date);
            if (!isNaN(dateObj)) {
                dateStr = dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'numeric' });
            }
        } catch(e) {}
        
        const todayStr = new Date().toISOString().split('T')[0];
        const isToday = duty.date === todayStr;
        if(isToday) row.style.backgroundColor = "#e8f8f5";

        row.innerHTML = `
            <td>
                <strong>${dateStr}</strong> 
                ${isToday ? '<span style="color:green; font-size:0.8em;">(Today)</span>' : ''}
            </td>
            <td>${duty.ward || '-'}</td>
            <td>${duty.er || '-'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-sm btn-edit" onclick="window.editDuty('${duty.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-sm btn-delete" onclick="window.deleteDuty('${duty.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        dutyList.appendChild(row);
    });
}

// Edit Duty Logic
window.editDuty = (id) => {
    const duty = allDutiesData.find(d => d.id === id);
    if(!duty) return;
    editingDutyId = id;
    document.getElementById('duty-date').value = duty.date;
    document.getElementById('duty-ward').value = duty.ward;
    document.getElementById('duty-er').value = duty.er;
    if(dutyModal) dutyModal.style.display = 'block';
}

if(dutyForm) {
    dutyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dutyData = {
            date: document.getElementById('duty-date').value,
            ward: document.getElementById('duty-ward').value,
            er: document.getElementById('duty-er').value,
            timestamp: serverTimestamp() // บันทึกเวลาแก้ไข
        };
        try {
            if (editingDutyId) {
                await updateDoc(doc(db, SCHEDULE_COLLECTION, editingDutyId), dutyData);
            } else {
                await addDoc(collection(db, SCHEDULE_COLLECTION), dutyData);
            }
            window.closeModal('duty-modal');
            dutyForm.reset();
            editingDutyId = null;
            document.getElementById('duty-date').valueAsDate = new Date();
        } catch (error) {
            alert("Error saving duty: " + error.message);
        }
    });
}

if(addDutyBtn) {
    addDutyBtn.onclick = () => { 
        dutyForm.reset(); 
        editingDutyId = null;
        document.getElementById('duty-date').valueAsDate = new Date();
        dutyModal.style.display = 'block'; 
    };
}

// Import Excel Logic
if (importExcelBtn && excelInput) {
    importExcelBtn.onclick = () => excelInput.click();
    
    excelInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if(!file) return;

        if(!confirm('⚠️ คำเตือน: การ Import จะ "ลบข้อมูลตารางเวรเก่าทั้งหมด" \nและแทนที่ด้วยข้อมูลจากไฟล์ Excel\n\nยืนยันหรือไม่?')) {
            excelInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { cellDates: true, defval: "" }); 
                
                const snapshot = await getDocs(collection(db, SCHEDULE_COLLECTION));
                const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
                await Promise.all(deletePromises);

                let count = 0;
                for(const row of jsonData) {
                    const keys = Object.keys(row);
                    const dateKey = keys.find(k => k.trim().toLowerCase() === 'date');
                    const wardKey = keys.find(k => k.trim().toLowerCase() === 'ward');
                    const erKey = keys.find(k => k.trim().toLowerCase() === 'er');

                    if (!dateKey) continue;

                    let dateStr = "";
                    const rawDate = row[dateKey];

                    if (rawDate instanceof Date) {
                        const year = rawDate.getFullYear();
                        const month = String(rawDate.getMonth() + 1).padStart(2, '0');
                        const day = String(rawDate.getDate()).padStart(2, '0');
                        dateStr = `${year}-${month}-${day}`;
                    } else if (typeof rawDate === 'string') {
                        dateStr = rawDate.trim();
                    } else if (typeof rawDate === 'number') {
                         const jsDate = new Date((rawDate - (25567 + 1)) * 86400 * 1000);
                         const year = jsDate.getFullYear();
                         const month = String(jsDate.getMonth() + 1).padStart(2, '0');
                         const day = String(jsDate.getDate()).padStart(2, '0');
                         dateStr = `${year}-${month}-${day}`;
                    }

                    if (dateStr) {
                        await addDoc(collection(db, SCHEDULE_COLLECTION), {
                            date: dateStr,
                            ward: wardKey ? row[wardKey] : "",
                            er: erKey ? row[erKey] : "",
                            timestamp: serverTimestamp() // บันทึกเวลา Import
                        });
                        count++;
                    }
                }
                
                alert(`✅ ล้างข้อมูลเก่าและ Import ใหม่สำเร็จจำนวน ${count} วัน!`);
                excelInput.value = ''; 
            } catch (error) {
                console.error(error);
                alert("เกิดข้อผิดพลาดในการอ่านไฟล์ Excel: " + error.message);
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

window.deleteDuty = async (docId) => {
    if(confirm('ลบรายการเวรนี้?')) {
        await deleteDoc(doc(db, SCHEDULE_COLLECTION, docId));
    }
}

// ------------------------------------------------------------------
// 4. Shared Actions
// ------------------------------------------------------------------
window.dischargeCase = async (docId) => updateDoc(doc(db, COLLECTION_NAME, docId), { status: 'Discharged', dischargedAt: serverTimestamp(), updatedAt: serverTimestamp() });
window.readmitCase = async (docId) => updateDoc(doc(db, COLLECTION_NAME, docId), { status: 'Active', dischargedAt: null, updatedAt: serverTimestamp() });
window.deleteCase = async (docId) => { if(confirm('⚠️ ยืนยันลบข้อมูลถาวร?')) await deleteDoc(doc(db, COLLECTION_NAME, docId)); };
window.logout = () => { if(confirm('ต้องการออกจากระบบหรือไม่?')) { localStorage.removeItem('sx_ipd_is_logged_in'); location.reload(); } };

if(admitForm) {
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
            // บันทึกเวลา
            updatedAt: serverTimestamp()
        };
        
        // ถ้าเป็นเคสใหม่ ให้เพิ่ม createdAt
        if (!editDocId) {
            patientData.createdAt = serverTimestamp();
        }

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
}

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

if(addBtn) { 
    addBtn.onclick = () => { 
        admitForm.reset(); 
        document.getElementById('edit-doc-id').value = ""; 
        document.getElementById('admitDate').valueAsDate = new Date();
        modalTitle.innerText = "รับเคสใหม่ (New Admission)";
        modal.style.display = 'block'; 
    };
}
if(addDutyBtn) addDutyBtn.onclick = () => { 
    dutyForm.reset(); 
    editingDutyId = null;
    document.getElementById('duty-date').valueAsDate = new Date();
    dutyModal.style.display = 'block'; 
};

window.onclick = (e) => {
    if (e.target == modal) window.closeModal('modal');
    if (e.target == dutyModal) window.closeModal('duty-modal');
}