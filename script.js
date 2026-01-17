// 1. นำเข้า Firebase SDK จาก CDN (เพื่อให้รันบน Browser ได้เลยไม่ต้องลง Node.js)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-analytics.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

// 2. การตั้งค่า Firebase ของคุณ (ใส่ให้แล้ว)
const firebaseConfig = {
    apiKey: "AIzaSyClYDNeWk_yEm0WWe65qm4F7iBGStE6-KI",
    authDomain: "sx-ipd.firebaseapp.com",
    projectId: "sx-ipd",
    storageBucket: "sx-ipd.firebasestorage.app",
    messagingSenderId: "1636907648",
    appId: "1:1636907648:web:d658a6ba7f9c49e0465", // (ผมเดาว่าตกเลขไปนิดนึงตอน copy แต่ใส่ตามที่คุณให้มาครับ)
    measurementId: "G-VKXGJ4M03C"
};

// เริ่มต้นใช้งาน Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app); // เปิด Analytics ตามที่ขอ
const db = getFirestore(app); // เรียกใช้ Database
const COLLECTION_NAME = "patients"; // ชื่อตารางเก็บข้อมูล

// Select Elements (ตัวแปรเชื่อมกับหน้าจอ)
const patientList = document.getElementById('patient-list');
const addBtn = document.getElementById('add-btn');
const modal = document.getElementById('modal');
const closeBtn = document.querySelector('.close-btn');
const admitForm = document.getElementById('admit-form');

// ตั้งค่า Default วันที่ให้เป็นวันปัจจุบัน
if(document.getElementById('admitDate')) {
    document.getElementById('admitDate').valueAsDate = new Date();
}

// ------------------------------------------------------------------
// 3. ฟังก์ชัน Real-time Listener (หัวใจสำคัญ: ดึงข้อมูลและคอยฟังการเปลี่ยนแปลง)
// ------------------------------------------------------------------
const q = query(collection(db, COLLECTION_NAME), orderBy("bed")); // ดึงข้อมูลโดยเรียงตามเตียง

// onSnapshot คือตัวที่ทำให้มัน Real-time (ทำงานเองทุกครั้งที่มีใครแก้ข้อมูล)
onSnapshot(q, (querySnapshot) => {
    patientList.innerHTML = ''; // ล้างตารางเก่าก่อนวาดใหม่
    
    if (querySnapshot.empty) {
        patientList.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">ยังไม่มีเคสในวอร์ด (No Active Case)</td></tr>';
        return;
    }

    querySnapshot.forEach((docSnap) => {
        const pt = docSnap.data();
        const docId = docSnap.id; // ID ของเอกสาร (ใช้สำหรับอ้างอิงตอนลบ)

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <strong style="font-size:1.2em;">${pt.bed}</strong>
                <div class="status-badge">${pt.status || 'Active'}</div>
            </td>
            <td>${pt.date}</td>
            <td>
                <div><strong>HN:</strong> ${pt.hn}</div>
                <div class="text-muted"><strong>AN:</strong> ${pt.an}</div>
            </td>
            <td>
                <div style="font-weight:600;">${pt.name}</div>
                <div class="text-muted">${pt.age} ปี / ${pt.gender}</div>
            </td>
            <td>${pt.diag}</td>
            <td>${pt.owner}</td>
            <td class="text-orange">${pt.note || '-'}</td>
            <td>
                <button class="btn btn-danger" onclick="window.deleteCase('${docId}')">D/C</button>
            </td>
        `;
        patientList.appendChild(row);
    });
}, (error) => {
    console.error("Error getting documents: ", error);
    // แจ้งเตือนถ้าลืมเปิดโหมด Test ใน Database
    if(error.code === 'permission-denied') {
        alert("Permission Denied: อย่าลืมไปตั้งค่า Firestore Rules ให้เป็น Test Mode ก่อนนะครับ");
    }
});

// ------------------------------------------------------------------
// 4. ฟังก์ชันเพิ่มข้อมูล (Add Data) เมื่อกดปุ่มบันทึกใน Modal
// ------------------------------------------------------------------
if(admitForm) {
    admitForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // ทำปุ่ม Loading กันคนกดรัว
        const submitBtn = admitForm.querySelector('button[type="submit"]');
        const oldText = submitBtn.innerText;
        submitBtn.innerText = "กำลังบันทึก...";
        submitBtn.disabled = true;

        try {
            // เตรียมข้อมูลจากฟอร์ม
            const newPatient = {
                bed: document.getElementById('bed').value,
                date: document.getElementById('admitDate').value,
                hn: document.getElementById('hn').value,
                an: document.getElementById('an').value,
                name: document.getElementById('name').value,
                age: document.getElementById('age').value,
                gender: document.getElementById('gender').value,
                diag: document.getElementById('diag').value,
                owner: document.getElementById('owner').value,
                note: document.getElementById('note').value,
                status: "Active",
                timestamp: serverTimestamp() // บันทึกเวลาที่ Server เพื่อความแม่นยำ
            };

            // ส่งข้อมูลขึ้น Firebase Cloud
            await addDoc(collection(db, COLLECTION_NAME), newPatient);
            
            // ปิด Modal และเคลียร์ค่า
            modal.style.display = 'none';
            admitForm.reset();
            document.getElementById('admitDate').valueAsDate = new Date();

        } catch (error) {
            console.error("Error adding document: ", error);
            alert("เกิดข้อผิดพลาด: " + error.message);
        } finally {
            submitBtn.innerText = oldText;
            submitBtn.disabled = false;
        }
    });
}

// ------------------------------------------------------------------
// 5. ฟังก์ชันลบข้อมูล (Discharge)
// ------------------------------------------------------------------
// ต้องประกาศเป็น window.xxx เพื่อให้ปุ่มใน HTML เรียกใช้ได้
window.deleteCase = async (docId) => {
    if(confirm('ยืนยันจำหน่ายคนไข้ (Discharge) ออกจากวอร์ด? \nข้อมูลจะถูกลบออกจากระบบ')) {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, docId));
            // ไม่ต้องสั่ง render ใหม่ เพราะ onSnapshot ข้างบนจะรู้เองว่าข้อมูลหายไป
        } catch (error) {
            console.error("Error removing document: ", error);
            alert("ลบข้อมูลไม่สำเร็จ: " + error.message);
        }
    }
}

// ------------------------------------------------------------------
// 6. จัดการการเปิด-ปิด Modal
// ------------------------------------------------------------------
if(addBtn) addBtn.onclick = () => modal.style.display = 'block';
if(closeBtn) closeBtn.onclick = () => modal.style.display = 'none';
window.onclick = (e) => {
    if (e.target == modal) modal.style.display = 'none';
}

console.log("Sx IPD App initialized with Firebase!");