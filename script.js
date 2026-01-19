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

// DARK MODE LOGIC
const toggleDarkModeBtn = document.getElementById('toggle-dark-mode');

// ฟังก์ชันเปิด/ปิด และบันทึก
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('sx_ipd_dark_mode', isDark);
    updateDarkModeIcon(isDark);
}

// อัปเดตไอคอนปุ่ม
function updateDarkModeIcon(isDark) {
    if(toggleDarkModeBtn) {
        const icon = toggleDarkModeBtn.querySelector('i');
        if(isDark) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun'); // เปลี่ยนเป็นรูปพระอาทิตย์ตอน Dark Mode
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }
}

// ตรวจสอบค่าเดิมตอนโหลดหน้าเว็บ
if (localStorage.getItem('sx_ipd_dark_mode') === 'true') {
    document.body.classList.add('dark-mode');
    updateDarkModeIcon(true);
}

if(toggleDarkModeBtn) {
    toggleDarkModeBtn.onclick = toggleDarkMode;
}
// --------------------

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
                wards: ["Sx ชาย", "Sx หญิง"],
                owners: ["Phone", "Ice", "Jeng", "Pai", "Sunny", "Title", "Pol"]
            };
            setDoc(docRef, data); 
        } else if (!data.owners) {
            // Migration for old data
            const combined = [...(data.staff || []), ...(data.residents || [])];
            data.owners = combined.length ? combined : ["", ""];
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
    select.innerHTML = `<option value="">- select ${selectId} -</option>`;
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
const newCasesList = document.getElementById('new-cases-list');
const summaryList = document.getElementById('summary-list');
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

const queueOrder = [
        'title',
        'sunny',
        'jeng',
        'pai',
        'phone',
        'pol',
        'ice'
    ];

const wardColorMap = {};
const usedColorIndexes = new Set();

const WARD_COLOR_PALETTE = [
    '#f4a6b8', // rose pink
    '#f6b28e', // peach
    '#f5d76e', // soft yellow
    '#bfe3b4', // soft green
    '#9fe0c3', // mint
    '#9cc9e8', // sky blue
    '#b3c7f9', // periwinkle
    '#c9b6e4', // lavender
    '#e5a9d6', // lilac
    '#f0b7d3', // rose
    '#9fdad7', // aqua
    '#a8e0c6', // seafoam
    '#f2e1a6', // cream
    '#c7b7e2', // violet
    '#b8d1e6', // blue gray
    '#f2b3a3', // coral
    '#a6dfc2', // jade
    '#f7e29c', // butter
    '#d7b9e8', // orchid
    '#a9cfe8'  // ice blue
];

// Helper function to set input value to "Today" (Local Time)
function setInputAsToday(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        el.value = `${year}-${month}-${day}`;
    }
}

// Set initial dates
setInputAsToday('admitDate');
setInputAsToday('duty-date');

// Tabs Logic
window.switchTab = (tabName) => {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');

    document.getElementById('patients-view').style.display = 'none';
    document.getElementById('mypatients-view').style.display = 'none';
    document.getElementById('schedule-view').style.display = 'none';

    if (tabName === 'patients') {
        document.getElementById('patients-view').style.display = 'block';
    }
    else if (tabName === 'mypatients') {
        document.getElementById('mypatients-view').style.display = 'block';
        renderMyPatients(allPatientsData);
    }
    else if (tabName === 'schedule') {
        document.getElementById('schedule-view').style.display = 'block';
        // ❌ Removed line that hides summary section
    }
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
        renderSummary(allPatientsData);
        renderQueue();

    }, (error) => {
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
        console.error(error);
        if(dutyList) dutyList.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Error loading schedule: ${error.message}</td></tr>`;
    });
}

function renderQueue() {
    const queueList = document.getElementById('queue-list');
    if (!queueList) return;

    queueList.innerHTML = '';
    queueList.style.display = 'flex';
    queueList.style.alignItems = 'center';
    queueList.style.flexWrap = 'wrap'; // กันล้นจอมือถือ

    queueOrder.forEach((name, index) => {
        // badge
        const badge = document.createElement('span');
        badge.textContent = name.charAt(0).toUpperCase() + name.slice(1);
        badge.style.cssText = `
            background-color: #ebf5fb;
            color: #2c3e50;
            padding: 6px 12px;
            border-radius: 20px;
            font-weight: 600;
            display: flex;
            align-items: center;
        `;
        queueList.appendChild(badge);

        // arrow
        if (index < queueOrder.length - 1) {
            const arrow = document.createElement('span');
            arrow.textContent = '→';
            arrow.style.cssText = `
                margin: 0 6px;
                font-size: 18px;
                font-weight: bold;
                color: #7f8c8d;
                display: flex;
                align-items: center;
            `;
            queueList.appendChild(arrow);
        }
    });
}

// --- RENDER SUMMARY ---
function renderSummary(data) {
    if(!summaryList) return;
    summaryList.innerHTML = '';

    const stats = {};
    data.forEach(pt => {
        const owner = pt.owner ? pt.owner.trim() : 'Unassigned';
        if (!stats[owner]) stats[owner] = { total: 0, active: 0 };
        stats[owner].total++;
        if (pt.status !== 'Discharged') stats[owner].active++;
    });

    const sortedStats = Object.entries(stats).sort(([ownerA, a], [ownerB, b]) => {
    // 1. Active มาก -> บน
    if (b.active !== a.active) return b.active - a.active;

    // 2. Total มาก -> บน
    if (b.total !== a.total) return b.total - a.total;

    // 3. Queue (กลับด้าน: คิวแรกอยู่ล่าง)
    const idxA = queueOrder.indexOf(ownerA.toLowerCase());
    const idxB = queueOrder.indexOf(ownerB.toLowerCase());

    // คนที่ไม่อยู่ในคิว -> ล่างสุด
    if (idxA === -1 && idxB === -1) return 0;
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;

    // 🔥 กลับลำดับ
    return idxB - idxA;
    });

    if (sortedStats.length === 0) {
        summaryList.innerHTML = '<tr><td colspan="3" style="text-align:center;">No data available</td></tr>';
        return;
    }

    sortedStats.forEach(([owner, counts]) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${owner}</strong></td>
            <td style="text-align: center; color: #27ae60; font-weight: bold;">${counts.active}</td>
            <td style="text-align: center; color: #7f8c8d;">${counts.total}</td>
        `;
        summaryList.appendChild(row);
    });

    // ⭐ HIGHLIGHT คนสุดท้าย เฉพาะ user ที่ login อยู่
    const rows = summaryList.querySelectorAll('tr');
    if (rows.length > 0 && currentUsername) {
        const lastRow = rows[rows.length - 1];
        const ownerCell = lastRow.querySelector('td');

        const ownerName = ownerCell.textContent.trim().toLowerCase();
        const currentUser = currentUsername.trim().toLowerCase();

        if (ownerName === currentUser) {
            lastRow.style.backgroundColor = '#eafaf1';
            lastRow.style.borderLeft = '4px solid #27ae60';

            ownerCell.innerHTML = `
                <span style="
                    background-color: #27ae60;
                    color: white;
                    padding: 4px 10px;
                    border-radius: 14px;
                    font-weight: bold;
                    display: inline-block;
                    animation: pulse 1.5s infinite;
                ">
                    🔔 You're next (${ownerCell.textContent})
                </span>
            `;
        }
    }
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

    // Multi-Level Sorting Logic (ปรับปรุงใหม่)
    filteredData.sort((a, b) => {
        // เตรียมค่าสำหรับเปรียบเทียบ
        const wardA = (a.ward || '').toLowerCase();
        const wardB = (b.ward || '').toLowerCase();
        
        // Bed แปลงเป็น String เพื่อเทียบ (ถ้าจะเทียบเลขต้องใช้ option numeric: true)
        const bedA = (a.bed || '').toString();
        const bedB = (b.bed || '').toString();

        const ownerA = (a.owner || '').toLowerCase();
        const ownerB = (b.owner || '').toLowerCase();

        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);

        switch (sortValue) {
            case 'ward_bed':
                // เรียง Ward ก่อน
                if (wardA < wardB) return -1;
                if (wardA > wardB) return 1;
                // ถ้า Ward เท่ากัน ให้เรียงตาม Bed (แบบ Numeric: 2 มาก่อน 10)
                return bedA.localeCompare(bedB, undefined, {numeric: true, sensitivity: 'base'});

            case 'bed':
                // เรียงตาม Bed อย่างเดียว
                return bedA.localeCompare(bedB, undefined, {numeric: true, sensitivity: 'base'});

            case 'date_new':
                // วันที่ ใหม่ -> เก่า
                return dateB - dateA;

            case 'date_old':
                // วันที่ เก่า -> ใหม่
                return dateA - dateB;
            
            case 'owner_ward':
                // เรียง Owner ก่อน
                if (ownerA < ownerB) return -1;
                if (ownerA > ownerB) return 1;
                // ถ้า Owner เท่ากัน เรียง Ward
                if (wardA < wardB) return -1;
                if (wardA > wardB) return 1;
                // ถ้า Ward เท่ากันอีก เรียง Bed
                return bedA.localeCompare(bedB, undefined, {numeric: true, sensitivity: 'base'});

            default:
                // Default: Ward -> Bed
                if (wardA < wardB) return -1;
                if (wardA > wardB) return 1;
                return bedA.localeCompare(bedB, undefined, {numeric: true, sensitivity: 'base'});
        }
    });

    patientList.innerHTML = '';
    dischargedList.innerHTML = '';
    if(newCasesList) newCasesList.innerHTML = '';
    
    const activeCases = filteredData.filter(pt => pt.status !== 'Discharged');
    const dischargedCases = filteredData.filter(pt => pt.status === 'Discharged');

    // Active
    if (activeCases.length === 0) {
        patientList.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px;">There is 0 case 🎉</td></tr>';
    } else {
        activeCases.forEach(pt => patientList.appendChild(createPatientRow(pt, true)));
    }

    // Discharged
    if (dischargedCases.length === 0) {
        dischargedList.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#999;">No discharged history</td></tr>';
    } else {
        dischargedCases.forEach(pt => dischargedList.appendChild(createPatientRow(pt, false)));
    }

    // New Cases (Last 24h)
    if (newCasesList) {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        const recentCases = activeCases.filter(pt => {
            if (!pt.createdAt) return false;
            const createdDate = pt.createdAt.toDate ? pt.createdAt.toDate() : new Date(pt.createdAt.seconds * 1000);
            return createdDate >= oneDayAgo;
        });

        if (recentCases.length === 0) {
            newCasesList.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#999;">No new cases in last 24h</td></tr>';
        } else {
            recentCases.forEach(pt => newCasesList.appendChild(createPatientRow(pt, true)));
        }
    }
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
        myPatientsList.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px;">You have 0 case 🎉</td></tr>`;
    } else {
        myActiveCases.forEach(pt => myPatientsList.appendChild(createPatientRow(pt, true)));
    }

    if(myPatientsDischargedList) {
        if (myDischargedCases.length === 0) {
            myPatientsDischargedList.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#999;">No discharged history</td></tr>`;
        } else {
            myDischargedCases.forEach(pt => myPatientsDischargedList.appendChild(createPatientRow(pt, false)));
        }
    }
}

if(searchInput) searchInput.addEventListener('input', () => renderPatients(allPatientsData));
if(sortSelect) sortSelect.addEventListener('change', () => renderPatients(allPatientsData));

if(exportBtn) {
    exportBtn.onclick = () => {
        if (allPatientsData.length === 0) { alert("No data to Export"); return; }
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

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function getWardColor(wardName) {
    if (!wardName) return '#eee';

    const name = wardName.toLowerCase().trim();

    // --- สีพิเศษ (fix ตามความหมาย) ---
    if (name.includes('ชาย')) return '#d6eaf8';
    if (name.includes('หญิง')) return '#fadbd8';
    if (name.includes('icu')) return '#fcf3cf';
    if (name.includes('vip') || name.includes('พิเศษ')) return '#d5f5e3';

    // เคย assign แล้ว → ใช้สีเดิม
    if (wardColorMap[name]) return wardColorMap[name];

    // 🔢 คำนวณ index จาก hash
    const baseIndex = hashString(name) % WARD_COLOR_PALETTE.length;

    // 🔁 ถ้าชน → ขยับไปเรื่อย ๆ จนกว่าจะเจอสีว่าง
    let index = baseIndex;
    let guard = 0;

    while (usedColorIndexes.has(index) && guard < WARD_COLOR_PALETTE.length) {
        index = (index + 1) % WARD_COLOR_PALETTE.length;
        guard++;
    }

    usedColorIndexes.add(index);
    const color = WARD_COLOR_PALETTE[index];
    wardColorMap[name] = color;

    return color;
}

function createPatientRow(pt, isActive) {
    const row = document.createElement('tr');
    row.style.cursor = 'pointer';
    row.title = 'Click to copy patient info';

    row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;

        copyPatientRow(pt);

        row.classList.add('row-copied');
        setTimeout(() => row.classList.remove('row-copied'), 600); 
    });


    let actionButtons = isActive ? `
        <button class="btn-sm btn-edit" onclick="window.openEditModal('${pt.id}')"><i class="fas fa-edit"></i></button>
        <button class="btn-sm btn-dc" onclick="window.dischargeCase('${pt.id}')">D/C</button>
        <button class="btn-sm btn-delete" onclick="window.deleteCase('${pt.id}')"><i class="fas fa-trash"></i></button>
    ` : `
        <button class="btn-sm btn-edit" onclick="window.openEditModal('${pt.id}')"><i class="fas fa-edit"></i></button>
        <button class="btn-sm" style="background-color: #3498db;" onclick="window.readmitCase('${pt.id}')"><i class="fas fa-undo"></i></button>
        <button class="btn-sm btn-delete" onclick="window.deleteCase('${pt.id}')"><i class="fas fa-trash"></i></button>
    `;

    let displayOwner = pt.owner || '-';
    if (currentUsername && displayOwner.toLowerCase().includes(currentUsername)) {
         const highlightStyle = "font-weight: bold; color: #2980b9; background-color: #d6eaf8; padding: 2px 6px; border-radius: 4px; display: inline-block;";
         displayOwner = `<span style="${highlightStyle}">${displayOwner}</span>`;
    }

    // Apply Ward Color Badge
    const wardBg = getWardColor(pt.ward);
    const wardBadge = `<span style="background-color: ${wardBg}; color: #2c3e50; padding: 4px 8px; border-radius: 6px; font-weight: bold; display: inline-block; min-width: 60px; text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">${pt.ward || '-'}</span>`;


    row.innerHTML = `
        <td>${wardBadge}</td>
        <td><div style="font-size:1.1em;">${pt.bed || '?'}</div></td>
        <td>${pt.date || '-'}</td>
        <td><div><strong>HN:</strong> ${pt.hn || '-'}</div><div class="text-muted"><strong>AN:</strong> ${pt.an || '-'}</div></td>
        <td><div style="font-weight:600;">${pt.name || 'ไม่ระบุชื่อ'}</div><div class="text-muted">${pt.age ? pt.age + ' ปี' : '-'} / ${pt.gender || '-'}</div></td>
        <td>${pt.diag || '-'}</td>
        <td>${displayOwner}</td>
        <td class="text-orange">${pt.note || '-'}</td>
        <td><div class="action-buttons">${actionButtons}</div></td>
    `;
    return row;
}

function renderSchedule(duties) {
    if(!dutyList) return;
    dutyList.innerHTML = '';
    if (duties.length === 0) { dutyList.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Loading schedule...</td></tr>'; return; }

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

        let displayWard = duty.ward || '-';
        let displayEr = duty.er || '-';
        const highlightStyle = "font-weight: bold; color: #e67e22; background-color: #fff3cd; padding: 2px 6px; border-radius: 4px; display: inline-block;";

        if (currentUsername && displayWard.toLowerCase().includes(currentUsername)) {
             displayWard = `<span style="${highlightStyle}">${displayWard}</span>`;
        }
        if (currentUsername && displayEr.toLowerCase().includes(currentUsername)) {
             displayEr = `<span style="${highlightStyle}">${displayEr}</span>`;
        }

        row.innerHTML = `
            <td><strong>${dateStr}</strong> ${isToday ? '<span style="color:green; font-size:0.8em;">(Today)</span>' : ''}</td>
            <td>${displayWard}</td>
            <td>${displayEr}</td>
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
            setInputAsToday('duty-date');
        } catch (error) { alert("Error: " + error.message); }
    });
}

if(addDutyBtn) {
    addDutyBtn.onclick = () => { 
        dutyForm.reset(); 
        editingDutyId = null;
        setInputAsToday('duty-date');
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
                    // ✅ FIXED: Date calculation +12h offset logic
                    if (rawDate instanceof Date) {
                         const adjustedDate = new Date(rawDate.getTime() + (12 * 60 * 60 * 1000));
                         dateStr = adjustedDate.toISOString().split('T')[0];
                    } else if (typeof rawDate === 'string') {
                        dateStr = rawDate.trim();
                    } else if (typeof rawDate === 'number') {
                         const jsDate = new Date(Math.round((rawDate - 25569) * 86400 * 1000) + (12 * 60 * 60 * 1000));
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
window.deleteCase = async (docId) => { if(confirm('⚠️ Permanently delete?')) await deleteDoc(doc(db, COLLECTION_NAME, docId)); };

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
    document.getElementById('modal-title').innerText = "Edit Pt Info";
    modal.style.display = 'block';
}

if(addBtn) { 
    addBtn.onclick = () => { 
        admitForm.reset(); 
        document.getElementById('edit-doc-id').value = ""; 
        // ตั้งค่าวันที่เป็นวันนี้เมื่อเปิด Modal
        setInputAsToday('admitDate');
        document.getElementById('modal-title').innerText = "New case"; 
        modal.style.display = 'block'; 
    };
}
if(addDutyBtn) addDutyBtn.onclick = () => { 
    dutyForm.reset(); 
    editingDutyId = null; 
    // ตั้งค่าวันที่เป็นวันนี้เมื่อเปิด Modal ลงเวร
    setInputAsToday('duty-date');
    dutyModal.style.display = 'block'; 
};
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

function copyPatientRow(pt) {
    const ward = pt.ward || '-';
    const bed = pt.bed || '-';
    const hn = pt.hn || '-';
    const name = pt.name || '-';

    const text = `${ward}-${bed} HN:${hn} ${name}`;

    navigator.clipboard.writeText(text)
        .then(() => {
            console.log('Copied:', text);
        })
        .catch(err => {
            console.error('Copy failed', err);
        });
}
