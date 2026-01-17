import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, getDocs, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyClYDNeWk_yEm0WWe65qm4F7iBGStE6-KI",
    authDomain: "sx-ipd.firebaseapp.com",
    projectId: "sx-ipd",
    storageBucket: "sx-ipd.firebasestorage.app",
    messagingSenderId: "1636907648",
    appId: "1:1636907648:web:d658a6ba7f9c49e0465",
    measurementId: "G-VKXGJ4M03C"
};

// --- APP INSTANCES ---
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const COLLECTION_NAME = "patients";
const SCHEDULE_COLLECTION = "schedules";
const SETTINGS_COLLECTION = "settings";
const SETTINGS_DOC_ID = "dropdown_config";

// Secondary App สำหรับสร้าง User โดยไม่ Logout Admin
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

// --- AUTH VARIABLES ---
const authScreen = document.getElementById('auth-screen');
const appContainer = document.getElementById('app-container');
const authError = document.getElementById('auth-error');
const loginForm = document.getElementById('login-form');
const EMAIL_DOMAIN = "@ward.local"; 

let currentUser = null;
let currentUsername = "";

// --- AUTH STATE LISTENER ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        currentUsername = user.email.replace(EMAIL_DOMAIN, '').toLowerCase(); 
        console.log("Logged in:", currentUsername);
        
        // Check Admin -> Show/Hide Buttons
        const isAdmin = user.email === ("admin" + EMAIL_DOMAIN);
        const addUserBtn = document.getElementById('open-create-user-btn');
        const settingsBtn = document.getElementById('open-settings-btn');
        const myPatientTab = document.getElementById('tab-mypatients');
        
        if(addUserBtn) addUserBtn.style.display = isAdmin ? 'flex' : 'none';
        if(settingsBtn) settingsBtn.style.display = isAdmin ? 'flex' : 'none';
        
        // ซ่อน Tab My Patients ถ้าเป็น Admin
        if(myPatientTab) myPatientTab.style.display = isAdmin ? 'none' : 'block';

        // แสดงชื่อผู้ใช้
        const usernameDisplay = document.getElementById('user-info');
        if (usernameDisplay) {
            usernameDisplay.innerHTML = `<i class="fas fa-user-circle"></i> Log in as: ${currentUsername}`;
        }

        authScreen.style.display = 'none';
        appContainer.style.display = 'block';
        initApp(); 
    } else {
        currentUser = null;
        currentUsername = "";
        console.log("No user");
        authScreen.style.display = 'flex';
        appContainer.style.display = 'none';
    }
});

// LOGIN Handler
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        authError.style.display = 'none';
        const fakeEmail = username + EMAIL_DOMAIN;

        try {
            await signInWithEmailAndPassword(auth, fakeEmail, password);
        } catch (error) {
            console.error(error);
            authError.innerText = getErrorMessage(error.code);
            authError.style.display = 'block';
        }
    });
}

// CREATE USER (ADMIN ONLY)
const createUserForm = document.getElementById('create-user-form');
const createUserMsg = document.getElementById('create-user-msg');

if (createUserForm) {
    createUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('new-username').value.trim();
        const password = document.getElementById('new-password').value;
        const fakeEmail = username + EMAIL_DOMAIN;

        createUserMsg.style.color = "blue";
        createUserMsg.innerText = "กำลังสร้าง...";

        try {
            await createUserWithEmailAndPassword(secondaryAuth, fakeEmail, password);
            await signOut(secondaryAuth); 

            createUserMsg.style.color = "green";
            createUserMsg.innerText = `สร้าง user "${username}" สำเร็จ!`;
            setTimeout(() => {
                createUserForm.reset();
                createUserMsg.innerText = "";
                window.closeModal('create-user-modal');
            }, 1500);
        } catch (error) {
            createUserMsg.style.color = "red";
            createUserMsg.innerText = getErrorMessage(error.code);
        }
    });
}

// CHANGE PASSWORD (SELF)
const changePassForm = document.getElementById('change-password-form');
if (changePassForm) {
    changePassForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPass = document.getElementById('new-self-password').value;
        try {
            await updatePassword(auth.currentUser, newPass);
            alert("เปลี่ยนรหัสผ่านสำเร็จ!");
            window.closeModal('change-password-modal');
            changePassForm.reset();
        } catch (error) {
            alert("เกิดข้อผิดพลาด: " + getErrorMessage(error.code));
            if (error.code === 'auth/requires-recent-login') {
                alert("เพื่อความปลอดภัย กรุณาล็อกอินใหม่แล้วทำรายการอีกครั้ง");
                window.logout();
            }
        }
    });
}

// LOGOUT
window.logout = async () => {
    if(confirm('ต้องการออกจากระบบหรือไม่?')) {
        try { await signOut(auth); } 
        catch (error) { alert("Error: " + error.message); }
    }
}

function getErrorMessage(code) {
    switch (code) {
        case 'auth/invalid-email': return "รูปแบบชื่อผู้ใช้ไม่ถูกต้อง";
        case 'auth/user-not-found': return "ไม่พบชื่อผู้ใช้นี้";
        case 'auth/wrong-password': return "รหัสผ่านไม่ถูกต้อง";
        case 'auth/email-already-in-use': return "ชื่อผู้ใช้นี้มีคนใช้แล้ว";
        case 'auth/weak-password': return "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร";
        case 'auth/invalid-credential': return "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
        default: return "เกิดข้อผิดพลาด: " + code;
    }
}

// --- SETTINGS LOGIC ---
const openSettingsBtn = document.getElementById('open-settings-btn');
const settingsForm = document.getElementById('settings-form');

function loadDropdownSettings() {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    
    onSnapshot(docRef, (docSnap) => {
        let data = docSnap.data();
        
        // Default Data
        if (!docSnap.exists()) {
            data = {
                wards: ["Sx ชาย", "Sx หญิง", "Burn Unit", "SICU", "Trauma", "Private"],
                owners: ["อ.สมศักดิ์", "อ.วิชัย", "อ.ปราณี", "R4 Somjai", "R3 Somsri", "R2 Sompong", "R1 Nontapat"]
            };
            setDoc(docRef, data); 
        } else if (!data.owners) {
            // Migration for old data
            const combined = [...(data.staff || []), ...(data.residents || [])];
            data.owners = combined.length ? combined : ["อ.สมศักดิ์", "R1 Nontapat"];
        }

        updateSelectOptions('ward', data.wards);
        updateSelectOptions('owner', data.owners);

        if(document.getElementById('settings-wards')) 
            document.getElementById('settings-wards').value = (data.wards || []).join('\n');
        
        if(document.getElementById('settings-owners')) 
            document.getElementById('settings-owners').value = (data.owners || []).join('\n');
    });
}

function updateSelectOptions(selectId, items) {
    const select = document.getElementById(selectId);
    if(!select || !items) return;
    const currentVal = select.value;
    select.innerHTML = `<option value="">- เลือก ${selectId} -</option>`;
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item;
        select.appendChild(option);
    });
    if (items.includes(currentVal)) select.value = currentVal;
}

if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const wards = document.getElementById('settings-wards').value.split('\n').map(s => s.trim()).filter(s => s);
        const owners = document.getElementById('settings-owners').value.split('\n').map(s => s.trim()).filter(s => s);

        try {
            await setDoc(doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID), {
                wards, owners, updatedAt: serverTimestamp()
            });
            alert("บันทึกการตั้งค่าเรียบร้อย!");
            window.closeModal('settings-modal');
        } catch (error) {
            alert("บันทึกไม่สำเร็จ: " + error.message);
        }
    });
}

if (openSettingsBtn) {
    openSettingsBtn.onclick = () => document.getElementById('settings-modal').style.display = 'block';
}

// --- APP LOGIC ---
const patientList = document.getElementById('patient-list');
const dischargedList = document.getElementById('discharged-list');
const myPatientsList = document.getElementById('mypatients-list'); 
const myPatientsDischargedList = document.getElementById('mypatients-discharged-list');
const dutyList = document.getElementById('duty-list');

const addBtn = document.getElementById('add-btn');
const modal = document.getElementById('modal');
const admitForm = document.getElementById('admit-form');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sort-patients');
const exportBtn = document.getElementById('export-patient-btn');
const modalTitle = document.getElementById('modal-title');
const submitBtn = document.getElementById('submit-btn');

const addDutyBtn = document.getElementById('add-duty-btn');
const dutyModal = document.getElementById('duty-modal');
const dutyForm = document.getElementById('duty-form');

const importExcelBtn = document.getElementById('import-excel-btn');
const excelInput = document.getElementById('excel-file');

const openCreateUserBtn = document.getElementById('open-create-user-btn');

let allPatientsData = [];
let allDutiesData = [];
let editingDutyId = null;

if(document.getElementById('admitDate')) document.getElementById('admitDate').valueAsDate = new Date();
if(document.getElementById('duty-date')) document.getElementById('duty-date').valueAsDate = new Date();

// Tabs Logic
window.switchTab = (tabName) => {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    document.getElementById('patients-view').style.display = 'none';
    document.getElementById('mypatients-view').style.display = 'none';
    document.getElementById('schedule-view').style.display = 'none';

    if (tabName === 'patients') document.getElementById('patients-view').style.display = 'block';
    else if (tabName === 'mypatients') {
        document.getElementById('mypatients-view').style.display = 'block';
        renderMyPatients(allPatientsData);
    }
    else if (tabName === 'schedule') document.getElementById('schedule-view').style.display = 'block';
}

window.closeModal = (modalId) => document.getElementById(modalId).style.display = 'none';
window.openChangePasswordModal = () => document.getElementById('change-password-modal').style.display = 'block';

function initApp() {
    loadDropdownSettings();

    // 1. Patients Listener
    const qPatients = query(collection(db, COLLECTION_NAME), orderBy("ward")); 
    onSnapshot(qPatients, (querySnapshot) => {
        allPatientsData = [];
        querySnapshot.forEach((docSnap) => {
            allPatientsData.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderPatients(allPatientsData);
        renderMyPatients(allPatientsData);
    }, (error) => {
        // Error Handler for Patients
        console.error(error);
        if(patientList) patientList.innerHTML = `<tr><td colspan="9" style="text-align:center; color:red;">Error loading patients: ${error.message}</td></tr>`;
    });

    // 2. Schedule Listener
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
    }, (error) => {
        // Error Handler for Schedule
        console.error(error);
        if(dutyList) dutyList.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Error loading schedule: ${error.message}</td></tr>`;
    });
}

// --- RENDER ALL PATIENTS ---
function renderPatients(data) {
    if(!patientList) return;
    const keyword = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const sortValue = sortSelect ? sortSelect.value : "ward";

    let filteredData = data.filter(pt => {
        const searchStr = `${pt.ward} ${pt.hn} ${pt.an} ${pt.name} ${pt.bed} ${pt.diag}`.toLowerCase();
        return searchStr.includes(keyword);
    });

    filteredData.sort((a, b) => {
        if (sortValue === 'bed') return (a.bed || '').localeCompare((b.bed || ''), undefined, {numeric: true, sensitivity: 'base'});
        else if (sortValue === 'date') return new Date(a.date || 0) - new Date(b.date || 0);
        else return (a.ward || '').localeCompare(b.ward || '');
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

// --- RENDER MY PATIENTS ---
function renderMyPatients(data) {
    if(!myPatientsList) return;
    myPatientsList.innerHTML = '';
    if(myPatientsDischargedList) myPatientsDischargedList.innerHTML = '';

    const myCases = data.filter(pt => {
        const ownerName = (pt.owner || "").toLowerCase();
        const myName = currentUsername.toLowerCase();
        return ownerName.includes(myName);
    });

    const myActiveCases = myCases.filter(pt => pt.status !== 'Discharged');
    const myDischargedCases = myCases.filter(pt => pt.status === 'Discharged');

    if (myActiveCases.length === 0) {
        myPatientsList.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px;">ไม่มีเคส Active ที่คุณดูแลอยู่ (${currentUsername})</td></tr>`;
    } else {
        myActiveCases.forEach(pt => myPatientsList.appendChild(createPatientRow(pt, true)));
    }

    if(myPatientsDischargedList) {
        if (myDischargedCases.length === 0) {
            myPatientsDischargedList.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#999;">ยังไม่มีประวัติการจำหน่าย</td></tr>`;
        } else {
            myDischargedCases.forEach(pt => myPatientsDischargedList.appendChild(createPatientRow(pt, false)));
        }
    }
}

if(searchInput) searchInput.addEventListener('input', () => renderPatients(allPatientsData));
if(sortSelect) sortSelect.addEventListener('change', () => renderPatients(allPatientsData));

if(exportBtn) {
    exportBtn.onclick = () => {
        if (allPatientsData.length === 0) { alert("ไม่มีข้อมูลให้ Export"); return; }
        const exportData = allPatientsData.map(pt => ({
            Status: pt.status || 'Active', Ward: pt.ward, Bed: pt.bed, Date: pt.date, HN: pt.hn, AN: pt.an, Name: pt.name, Age: pt.age, Gender: pt.gender, Diagnosis: pt.diag, Owner: pt.owner, Note: pt.note,
            Created_At: pt.createdAt ? new Date(pt.createdAt.seconds * 1000).toLocaleString() : '-',
            Updated_At: pt.updatedAt ? new Date(pt.updatedAt.seconds * 1000).toLocaleString() : '-'
        }));
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Patients");
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

function renderSchedule(duties) {
    if(!dutyList) return;
    dutyList.innerHTML = '';
    if (duties.length === 0) { dutyList.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">ยังไม่มีตารางเวร</td></tr>'; return; }

    duties.forEach(duty => {
        const row = document.createElement('tr');
        let dateStr = duty.date;
        try {
            const dateObj = new Date(duty.date);
            if (!isNaN(dateObj)) dateStr = dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'numeric' });
        } catch(e) {}
        
        const todayStr = new Date().toISOString().split('T')[0];
        const isToday = duty.date === todayStr;
        if(isToday) row.style.backgroundColor = "#e8f8f5";

        row.innerHTML = `
            <td><strong>${dateStr}</strong> ${isToday ? '<span style="color:green; font-size:0.8em;">(Today)</span>' : ''}</td>
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
            timestamp: serverTimestamp()
        };
        try {
            if (editingDutyId) await updateDoc(doc(db, SCHEDULE_COLLECTION, editingDutyId), dutyData);
            else await addDoc(collection(db, SCHEDULE_COLLECTION), dutyData);
            window.closeModal('duty-modal');
            dutyForm.reset();
            editingDutyId = null;
            document.getElementById('duty-date').valueAsDate = new Date();
        } catch (error) { alert("Error: " + error.message); }
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

if (importExcelBtn && excelInput) {
    importExcelBtn.onclick = () => excelInput.click();
    excelInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        if(!confirm('⚠️ คำเตือน: การ Import จะ "ลบข้อมูลตารางเวรเก่าทั้งหมด" \nยืนยันหรือไม่?')) { excelInput.value = ''; return; }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const firstSheetName = workbook.SheetNames[0];
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { cellDates: true, defval: "" }); 
                
                const snapshot = await getDocs(collection(db, SCHEDULE_COLLECTION));
                await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));

                let count = 0;
                for(const row of jsonData) {
                    const keys = Object.keys(row);
                    const dateKey = keys.find(k => k.trim().toLowerCase() === 'date');
                    const wardKey = keys.find(k => k.trim().toLowerCase() === 'ward');
                    const erKey = keys.find(k => k.trim().toLowerCase() === 'er');
                    if (!dateKey) continue;

                    let dateStr = "";
                    const rawDate = row[dateKey];
                    if (rawDate instanceof Date) dateStr = rawDate.toISOString().split('T')[0];
                    else if (typeof rawDate === 'string') dateStr = rawDate.trim();
                    else if (typeof rawDate === 'number') {
                         const jsDate = new Date((rawDate - (25567 + 1)) * 86400 * 1000);
                         dateStr = jsDate.toISOString().split('T')[0];
                    }

                    if (dateStr) {
                        await addDoc(collection(db, SCHEDULE_COLLECTION), {
                            date: dateStr, ward: wardKey ? row[wardKey] : "", er: erKey ? row[erKey] : "", timestamp: serverTimestamp()
                        });
                        count++;
                    }
                }
                alert(`✅ Import สำเร็จ ${count} วัน!`);
                excelInput.value = ''; 
            } catch (error) { alert("Error: " + error.message); }
        };
        reader.readAsArrayBuffer(file);
    });
}

window.deleteDuty = async (docId) => { if(confirm('ลบ?')) await deleteDoc(doc(db, SCHEDULE_COLLECTION, docId)); }
window.dischargeCase = async (docId) => updateDoc(doc(db, COLLECTION_NAME, docId), { status: 'Discharged', dischargedAt: serverTimestamp(), updatedAt: serverTimestamp() });
window.readmitCase = async (docId) => updateDoc(doc(db, COLLECTION_NAME, docId), { status: 'Active', dischargedAt: null, updatedAt: serverTimestamp() });
window.deleteCase = async (docId) => { if(confirm('⚠️ ลบถาวร?')) await deleteDoc(doc(db, COLLECTION_NAME, docId)); };

if(admitForm) {
    admitForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitBtn.innerText = "กำลังบันทึก...";
        submitBtn.disabled = true;
        const editDocId = document.getElementById('edit-doc-id').value;
        const patientData = {
            ward: document.getElementById('ward').value || "", bed: document.getElementById('bed').value || "", date: document.getElementById('admitDate').value || "",
            hn: document.getElementById('hn').value || "", an: document.getElementById('an').value || "", name: document.getElementById('name').value || "",
            age: document.getElementById('age').value || "", gender: document.getElementById('gender').value || "", diag: document.getElementById('diag').value || "",
            owner: document.getElementById('owner').value || "", note: document.getElementById('note').value || "", status: editDocId ? undefined : "Active", updatedAt: serverTimestamp()
        };
        if (!editDocId) patientData.createdAt = serverTimestamp();
        if(patientData.status === undefined) delete patientData.status;

        try {
            if (editDocId) await updateDoc(doc(db, COLLECTION_NAME, editDocId), patientData);
            else await addDoc(collection(db, COLLECTION_NAME), patientData);
            window.closeModal('modal');
        } catch (error) { alert("Error: " + error.message); } 
        finally { submitBtn.innerText = "บันทึกข้อมูล"; submitBtn.disabled = false; }
    });
}

window.openEditModal = (id) => {
    const pt = allPatientsData.find(p => p.id === id);
    if (!pt) return;
    document.getElementById('edit-doc-id').value = id;
    document.getElementById('ward').value = pt.ward || ""; document.getElementById('bed').value = pt.bed || ""; document.getElementById('admitDate').value = pt.date || "";
    document.getElementById('hn').value = pt.hn || ""; document.getElementById('an').value = pt.an || ""; document.getElementById('name').value = pt.name || "";
    document.getElementById('age').value = pt.age || ""; document.getElementById('gender').value = pt.gender || ""; document.getElementById('diag').value = pt.diag || "";
    document.getElementById('owner').value = pt.owner || ""; document.getElementById('note').value = pt.note || "";
    document.getElementById('modal-title').innerText = "แก้ไขข้อมูลผู้ป่วย";
    modal.style.display = 'block';
}

if(addBtn) addBtn.onclick = () => { admitForm.reset(); document.getElementById('edit-doc-id').value = ""; document.getElementById('admitDate').valueAsDate = new Date(); document.getElementById('modal-title').innerText = "รับเคสใหม่"; modal.style.display = 'block'; };
if(addDutyBtn) addDutyBtn.onclick = () => { dutyForm.reset(); editingDutyId = null; document.getElementById('duty-date').valueAsDate = new Date(); dutyModal.style.display = 'block'; };
if(openCreateUserBtn) openCreateUserBtn.onclick = () => { 
    document.getElementById('create-user-form').reset(); 
    document.getElementById('create-user-msg').innerText = ""; 
    document.getElementById('create-user-modal').style.display = 'block'; 
};

window.onclick = (e) => {
    if (e.target == modal) window.closeModal('modal');
    if (e.target == dutyModal) window.closeModal('duty-modal');
    if (e.target == document.getElementById('create-user-modal')) window.closeModal('create-user-modal');
    if (e.target == document.getElementById('change-password-modal')) window.closeModal('change-password-modal');
    if (e.target == document.getElementById('settings-modal')) window.closeModal('settings-modal');
}