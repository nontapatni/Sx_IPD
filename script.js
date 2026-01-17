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

// --- LOGIN LOGIC ---
const loginForm = document.getElementById('login-form');
const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const loginError = document.getElementById('login-error');

// ตั้งรหัสผ่านกลาง (Ward Passcode)
const WARD_PASSCODE = "1234"; 

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const inputPass = document.getElementById('login-password').value;

    if (inputPass === WARD_PASSCODE) {
        // ถ้ารหัสถูกต้อง
        localStorage.setItem('sx_ipd_is_logged_in', 'true'); // <--- บันทึกสถานะการล็อกอิน
        loginScreen.style.display = 'none'; // ซ่อนหน้า Login
        appContainer.style.display = 'block'; // แสดงหน้า App
        initApp(); // เริ่มโหลดข้อมูล Firebase
    } else {
        // ถ้ารหัสผิด
        loginError.style.display = 'block';
        loginError.classList.add('shake');
        document.getElementById('login-password').value = '';
    }
});

// Elements อื่นๆ
const patientList = document.getElementById('patient-list');
const dischargedList = document.getElementById('discharged-list');
const addBtn = document.getElementById('add-btn');
const modal = document.getElementById('modal');
const closeBtn = document.querySelector('.close-btn');
const admitForm = document.getElementById('admit-form');
const searchInput = document.getElementById('searchInput');
const modalTitle = document.getElementById('modal-title');
const submitBtn = document.getElementById('submit-btn');

let allPatientsData = [];

// --- AUTO LOGIN CHECK (ตรวจสอบตอนโหลดหน้าเว็บ) ---
if (localStorage.getItem('sx_ipd_is_logged_in') === 'true') {
    // ถ้าเคยล็อกอินไว้แล้ว ให้ข้ามหน้า Login ไปเลย
    loginScreen.style.display = 'none';
    appContainer.style.display = 'block';
    // รอให้โหลด DOM เสร็จก่อนเล็กน้อย หรือเรียกเลยก็ได้เพราะ module defer อยู่แล้ว
    initApp();
}

if(document.getElementById('admitDate')) {
    document.getElementById('admitDate').valueAsDate = new Date();
}

// ------------------------------------------------------------------
// 1. Real-time Listener
// ------------------------------------------------------------------
function initApp() {
    console.log("Starting Firebase Listener...");
    
    // เรียงตาม Ward
    const q = query(collection(db, COLLECTION_NAME), orderBy("ward")); 

    onSnapshot(q, (querySnapshot) => {
        allPatientsData = [];
        querySnapshot.forEach((docSnap) => {
            allPatientsData.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderPatients(allPatientsData);
    }, (error) => {
        console.error("Error:", error);
        const errorMsg = `
            <tr>
                <td colspan="9" style="text-align:center; color: #c0392b; padding: 20px;">
                    <strong>⚠️ เกิดข้อผิดพลาด:</strong> ${error.message}
                </td>
            </tr>`;
        patientList.innerHTML = errorMsg;
        dischargedList.innerHTML = errorMsg;
    });
}

// ------------------------------------------------------------------
// 2. Render & Search Logic
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

    // --- Active ---
    if (activeCases.length === 0) {
        patientList.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px;">ไม่พบข้อมูล</td></tr>';
    } else {
        activeCases.forEach(pt => {
            patientList.appendChild(createRow(pt, true));
        });
    }

    // --- Discharged ---
    if (dischargedCases.length === 0) {
        dischargedList.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#999;">ยังไม่มีรายการจำหน่าย</td></tr>';
    } else {
        dischargedCases.forEach(pt => {
            dischargedList.appendChild(createRow(pt, false));
        });
    }
}

// Event Listeners สำหรับ Search
searchInput.addEventListener('input', () => renderPatients(allPatientsData));

function createRow(pt, isActive) {
    const row = document.createElement('tr');
    
    let actionButtons = '';
    if (isActive) {
        actionButtons = `
            <button class="btn-sm btn-edit" onclick="window.openEditModal('${pt.id}')" title="แก้ไข">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn-sm btn-dc" onclick="window.dischargeCase('${pt.id}')" title="Discharge">
                <i class="fas fa-check-circle"></i> D/C
            </button>
            <button class="btn-sm btn-delete" onclick="window.deleteCase('${pt.id}')" title="ลบถาวร">
                <i class="fas fa-trash"></i>
            </button>
        `;
    } else {
        actionButtons = `
            <button class="btn-sm" style="background-color: #3498db;" onclick="window.readmitCase('${pt.id}')" title="ย้ายกลับ Active">
                <i class="fas fa-undo"></i> Return
            </button>
            <button class="btn-sm btn-delete" onclick="window.deleteCase('${pt.id}')" title="ลบประวัติถาวร">
                <i class="fas fa-trash"></i>
            </button>
        `;
    }

    row.innerHTML = `
        <td><strong>${pt.ward || '-'}</strong></td>
        <td><div style="font-size:1.1em;">${pt.bed || '?'}</div></td>
        <td>${pt.date || '-'}</td>
        <td>
            <div><strong>HN:</strong> ${pt.hn || '-'}</div>
            <div class="text-muted"><strong>AN:</strong> ${pt.an || '-'}</div>
        </td>
        <td>
            <div style="font-weight:600;">${pt.name || 'ไม่ระบุชื่อ'}</div>
            <div class="text-muted">${pt.age ? pt.age + ' ปี' : '-'} / ${pt.gender || '-'}</div>
        </td>
        <td>${pt.diag || '-'}</td>
        <td>${pt.owner || '-'}</td>
        <td class="text-orange">${pt.note || '-'}</td>
        <td>
            <div class="action-buttons">
                ${actionButtons}
            </div>
        </td>
    `;
    return row;
}

// ------------------------------------------------------------------
// 3. Actions (CRUD)
// ------------------------------------------------------------------

window.dischargeCase = async (docId) => {
    if(confirm('ยืนยันจำหน่ายผู้ป่วย (Discharge)?')) {
        try {
            await updateDoc(doc(db, COLLECTION_NAME, docId), {
                status: 'Discharged',
                dischargedAt: serverTimestamp()
            });
        } catch (error) {
            alert("Error: " + error.message);
        }
    }
}

window.readmitCase = async (docId) => {
    if(confirm('ยืนยันย้ายผู้ป่วยรายนี้กลับไป Active List?')) {
        try {
            await updateDoc(doc(db, COLLECTION_NAME, docId), {
                status: 'Active',
                dischargedAt: null 
            });
        } catch (error) {
            alert("Error: " + error.message);
        }
    }
}

window.deleteCase = async (docId) => {
    if(confirm('⚠️ ยืนยันลบข้อมูลถาวร?')) {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, docId));
        } catch (error) {
            alert("Error: " + error.message);
        }
    }
}

// --- LOGOUT FUNCTION (เรียกใช้จาก Console หรือปุ่มได้) ---
window.logout = () => {
    if(confirm('ต้องการออกจากระบบหรือไม่?')) {
        localStorage.removeItem('sx_ipd_is_logged_in');
        location.reload(); // รีเฟรชหน้าจอเพื่อกลับไปหน้า Login
    }
}

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
            timestamp: serverTimestamp()
        };

        if(patientData.status === undefined) delete patientData.status;

        try {
            if (editDocId) {
                await updateDoc(doc(db, COLLECTION_NAME, editDocId), patientData);
            } else {
                await addDoc(collection(db, COLLECTION_NAME), patientData);
            }
            closeModal();
        } catch (error) {
            console.error(error);
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

function closeModal() {
    modal.style.display = 'none';
    admitForm.reset();
    document.getElementById('edit-doc-id').value = "";
    document.getElementById('admitDate').valueAsDate = new Date();
    modalTitle.innerText = "รับเคสใหม่ (New Admission)";
}

if(addBtn) { addBtn.onclick = () => { closeModal(); modal.style.display = 'block'; } }
if(closeBtn) closeBtn.onclick = closeModal;
window.onclick = (e) => { if (e.target == modal) closeModal(); }