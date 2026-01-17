import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-analytics.js";
// เพิ่ม updateDoc เข้ามา
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

// Elements
const patientList = document.getElementById('patient-list');
const addBtn = document.getElementById('add-btn');
const modal = document.getElementById('modal');
const closeBtn = document.querySelector('.close-btn');
const admitForm = document.getElementById('admit-form');
const searchInput = document.getElementById('searchInput');
const modalTitle = document.getElementById('modal-title');
const submitBtn = document.getElementById('submit-btn');

// เก็บข้อมูลทั้งหมดไว้ในตัวแปรนี้ เพื่อให้ Search กรองได้โดยไม่ต้องโหลดจาก Server ใหม่
let allPatientsData = [];

// Default Date
if(document.getElementById('admitDate')) {
    document.getElementById('admitDate').valueAsDate = new Date();
}

// ------------------------------------------------------------------
// 1. Real-time Listener & Data Handling
// ------------------------------------------------------------------
const q = query(collection(db, COLLECTION_NAME), orderBy("bed"));

onSnapshot(q, (querySnapshot) => {
    allPatientsData = []; // ล้างข้อมูลเก่า
    querySnapshot.forEach((docSnap) => {
        allPatientsData.push({
            id: docSnap.id, // เก็บ ID ไว้ใช้อ้างอิงตอน Edit/Delete
            ...docSnap.data()
        });
    });
    // เรียกแสดงผลทันที (ส่งข้อมูลทั้งหมดไปแสดง)
    renderPatients(allPatientsData);
}, (error) => {
    console.error("Error:", error);
});

// ฟังก์ชันวาดตาราง (แยกออกมาเพื่อให้ Search เรียกใช้ได้)
function renderPatients(data) {
    patientList.innerHTML = '';
    
    if (data.length === 0) {
        patientList.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">ไม่พบข้อมูล</td></tr>';
        return;
    }

    data.forEach((pt) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <strong style="font-size:1.2em;">${pt.bed || '?'}</strong>
                <div class="status-badge">${pt.status || 'Active'}</div>
            </td>
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
                    <button class="btn-sm btn-edit" onclick="window.openEditModal('${pt.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-sm btn-delete" onclick="window.deleteCase('${pt.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        patientList.appendChild(row);
    });
}

// ------------------------------------------------------------------
// 2. Search Functionality
// ------------------------------------------------------------------
searchInput.addEventListener('input', (e) => {
    const keyword = e.target.value.toLowerCase().trim();
    
    // กรองข้อมูลใน Memory
    const filteredData = allPatientsData.filter(pt => {
        const searchStr = `${pt.hn} ${pt.an} ${pt.name} ${pt.bed} ${pt.diag}`.toLowerCase();
        return searchStr.includes(keyword);
    });

    renderPatients(filteredData);
});

// ------------------------------------------------------------------
// 3. Add & Edit Logic
// ------------------------------------------------------------------
if(admitForm) {
    admitForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        submitBtn.innerText = "กำลังบันทึก...";
        submitBtn.disabled = true;

        const editDocId = document.getElementById('edit-doc-id').value; // เช็คว่ามี ID ไหม
        
        // เตรียมข้อมูล (ใช้ || null เพื่อให้ field ที่ว่างไม่ error)
        const patientData = {
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
            status: "Active",
            timestamp: serverTimestamp()
        };

        try {
            if (editDocId) {
                // --- กรณีแก้ไข (Update) ---
                await updateDoc(doc(db, COLLECTION_NAME, editDocId), patientData);
            } else {
                // --- กรณีเพิ่มใหม่ (Add) ---
                await addDoc(collection(db, COLLECTION_NAME), patientData);
            }
            closeModal();
        } catch (error) {
            console.error("Error:", error);
            alert("บันทึกไม่สำเร็จ: " + error.message);
        } finally {
            submitBtn.innerText = "บันทึกข้อมูล";
            submitBtn.disabled = false;
        }
    });
}

// ฟังก์ชันเปิด Modal สำหรับ Edit
window.openEditModal = (id) => {
    const pt = allPatientsData.find(p => p.id === id);
    if (!pt) return;

    // เปลี่ยน Title Modal
    modalTitle.innerText = "แก้ไขข้อมูลผู้ป่วย (Edit)";
    document.getElementById('edit-doc-id').value = id; // ฝัง ID ไว้
    
    // กรอกข้อมูลเดิมลงไป
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

// ------------------------------------------------------------------
// 4. Delete & Utility Functions
// ------------------------------------------------------------------
window.deleteCase = async (docId) => {
    if(confirm('ยืนยันลบเคสนี้?')) {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, docId));
        } catch (error) {
            alert("ลบไม่สำเร็จ: " + error.message);
        }
    }
}

function closeModal() {
    modal.style.display = 'none';
    admitForm.reset();
    document.getElementById('edit-doc-id').value = ""; // ล้าง ID
    document.getElementById('admitDate').valueAsDate = new Date();
    modalTitle.innerText = "รับเคสใหม่ (New Admission)"; // คืนค่า Title เดิม
}

// Event Listeners สำหรับ Modal
if(addBtn) {
    addBtn.onclick = () => {
        closeModal(); // ล้างค่าก่อนเปิด เพื่อให้แน่ใจว่าเป็นโหมด Add
        modal.style.display = 'block';
    }
}
if(closeBtn) closeBtn.onclick = closeModal;
window.onclick = (e) => {
    if (e.target == modal) closeModal();
}