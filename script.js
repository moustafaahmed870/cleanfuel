// تهيئة Firebase
let db;
let stations = [];

// متغيرات الخريطة
let map;
let markers = [];
let shouldFitBounds = true;
let isSearching = false;
let currentSearchGovernorate = '';

// تهيئة Firebase
function initializeFirebase() {
    try {
        const firebaseConfig = {
            apiKey: "AIzaSyCwVQ5vHdBVjeF-0TfCbJqEE06NYCH3CQw",
            authDomain: "cleanfuel-3d673.firebaseapp.com",
            projectId: "cleanfuel-3d673",
            storageBucket: "cleanfuel-3d673.firebasestorage.app",
            messagingSenderId: "870161182484",
            appId: "1:870161182484:web:9fcda12160b6e3bac99c01",
            measurementId: "G-WGDD1XWFY0"
        };
        
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('✅ Firebase مهيأ في الصفحة الرئيسية');
        }
        
        db = firebase.firestore();
        console.log('✅ Firestore جاهز في الصفحة الرئيسية');
        return true;
        
    } catch (error) {
        console.error('❌ خطأ في تهيئة Firebase:', error);
        showAlert('خطأ في الاتصال بقاعدة البيانات', 'danger');
        return false;
    }
}

// تحميل البيانات من Firebase
async function loadStationsFromFirebase() {
    try {
        console.log('جاري تحميل المحطات من Firebase...');
        
        const snapshot = await db.collection('stations').get();
        stations = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log('✅ تم تحميل المحطات من Firebase:', stations.length);
        
        // إذا لم توجد بيانات، إضافة بيانات أولية
        if (stations.length === 0) {
            console.log('لا توجد بيانات، جاري إضافة بيانات أولية...');
            await addInitialStations();
            return;
        }
        
        updateStats();
        displayStationsInList(stations);
        displayStationsOnMap(stations);
        
    } catch (error) {
        console.error('❌ خطأ في تحميل البيانات:', error);
        showAlert('حدث خطأ في تحميل البيانات', 'danger');
    }
}

// إضافة بيانات أولية إذا كانت قاعدة البيانات فارغة
async function addInitialStations() {
    const initialStations = [
        {
            name: "تعاونيات البنزين - القاهرة",
            governorate: "القاهرة",
            address: "شارع النصر، مدينة نصر",
            googleMapsLink: "https://maps.google.com/?q=30.0444,31.2357",
            lat: 30.0444,
            lng: 31.2357,
            verified: true,
            addedDate: new Date().toISOString()
        },
        {
            name: "محطة الجيزة الرئيسية",
            governorate: "الجيزة",
            address: "شارع الهرم، أمام جامعة القاهرة",
            googleMapsLink: "https://maps.google.com/?q=30.0131,31.2089",
            lat: 30.0131,
            lng: 31.2089,
            verified: true,
            addedDate: new Date().toISOString()
        },
        {
            name: "إدكو للوقود",
            governorate: "الإسكندرية",
            address: "طريق الحرية، سيدي جابر",
            googleMapsLink: "https://maps.google.com/?q=31.2001,29.9187",
            lat: 31.2001,
            lng: 29.9187,
            verified: true,
            addedDate: new Date().toISOString()
        }
    ];
    
    try {
        const batch = db.batch();
        initialStations.forEach(station => {
            const docRef = db.collection('stations').doc();
            batch.set(docRef, station);
        });
        
        await batch.commit();
        console.log('✅ تم إضافة البيانات الأولية');
        
        // إعادة تحميل البيانات
        await loadStationsFromFirebase();
        
    } catch (error) {
        console.error('❌ خطأ في إضافة البيانات الأولية:', error);
    }
}

// تحديث الإحصائيات
function updateStats() {
    document.getElementById('totalStations').textContent = stations.length;
    document.getElementById('stationCount').textContent = stations.length;
    
    // عدد المحافظات الفريدة
    const uniqueGovernorates = new Set(stations.map(station => station.governorate));
    document.getElementById('governoratesCount').textContent = Math.max(uniqueGovernorates.size, 1);
    
    // عدد المحطات الموثوقة
    const verifiedCount = stations.filter(station => station.verified === true).length;
    document.getElementById('verifiedCount').textContent = verifiedCount;
}

// عرض المحطات على الخريطة
function displayStationsOnMap(stationsArray) {
    // إزالة العلامات القديمة
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    // إضافة علامات جديدة
    stationsArray.forEach(station => {
        if (station.lat && station.lng) {
            const marker = L.marker([station.lat, station.lng])
                .addTo(map)
                .bindPopup(`
                    <div style="text-align: right; max-width: 250px;">
                        <b style="color: #2c7a5e; font-size: 14px;">${station.name}</b><br>
                        <div style="margin: 8px 0; font-size: 12px;">
                            <i class="fas fa-map-marker-alt" style="color: #666;"></i> ${station.address}<br>
                            <i class="fas fa-city" style="color: #666;"></i> ${station.governorate}<br>
                            ${station.verified ? '<i class="fas fa-check-circle" style="color: #2c7a5e;"></i> محطة موثوقة<br>' : ''}
                        </div>
                        <a href="${station.googleMapsLink}" target="_blank" style="background: #4285F4; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-top: 5px; text-decoration: none; display: inline-block; font-size: 12px;">
                            <i class="fas fa-external-link-alt"></i> افتح في Google Maps
                        </a>
                    </div>
                `);
            
            markers.push(marker);
            
            // عند النقر على علامة
            marker.on('click', () => {
                highlightStationInList(station.id);
            });
        }
    });
    
    // ضبط عرض الخريطة
    if (shouldFitBounds && stationsArray.length > 0 && stationsArray.some(s => s.lat)) {
        const validStations = stationsArray.filter(s => s.lat && s.lng);
        if (validStations.length > 0) {
            const markerGroup = L.featureGroup(markers);
            map.fitBounds(markerGroup.getBounds().pad(0.2));
        } else if (stationsArray.length === 0) {
            map.setView([30.0444, 31.2357], 7);
        }
    }
}

// عرض المحطات في القائمة
function displayStationsInList(stationsArray) {
    const stationsList = document.getElementById('stationsList');
    
    stationsList.innerHTML = '';
    
    if (stationsArray.length === 0) {
        stationsList.innerHTML = `
            <li style="text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-search" style="font-size: 2rem; color: #ddd; margin-bottom: 15px;"></i>
                <p>لا توجد محطات وقود متاحة</p>
                ${isSearching ? `<p style="font-size: 0.9rem; color: #999; margin-top: 10px;">لم يتم العثور على محطات في ${currentSearchGovernorate}</p>` : ''}
            </li>
        `;
        return;
    }
    
    stationsArray.forEach(station => {
        const stationItem = document.createElement('li');
        stationItem.className = 'station-item';
        stationItem.dataset.id = station.id;
        
        stationItem.innerHTML = `
            <div class="station-actions">
                <button class="gmap-btn" onclick="window.open('${station.googleMapsLink}', '_blank')" title="فتح في Google Maps">
                    <i class="fas fa-external-link-alt"></i>
                </button>
            </div>
            <div class="station-name">${station.name} ${station.verified ? '<i class="fas fa-check-circle" style="color: #2c7a5e; margin-right: 5px;"></i>' : ''}</div>
            <div class="station-location"><i class="fas fa-map-marker-alt"></i> ${station.address}</div>
            <div class="station-location"><i class="fas fa-city"></i> ${station.governorate}</div>
        `;
        
        stationItem.addEventListener('click', (e) => {
            if (!e.target.closest('.gmap-btn')) {
                if (station.lat && station.lng) {
                    shouldFitBounds = false;
                    map.setView([station.lat, station.lng], 15);
                    
                    markers.forEach(marker => {
                        const markerLatLng = marker.getLatLng();
                        if (markerLatLng.lat === station.lat && markerLatLng.lng === station.lng) {
                            marker.openPopup();
                        }
                    });
                    
                    highlightStationInList(station.id);
                    
                    setTimeout(() => {
                        shouldFitBounds = true;
                    }, 2000);
                }
            }
        });
        
        stationsList.appendChild(stationItem);
    });
}

// تسليط الضوء على المحطة في القائمة
function highlightStationInList(stationId) {
    document.querySelectorAll('.station-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.id === stationId) {
            item.classList.add('active');
        }
    });
}

// البحث عن المحطات حسب المحافظة
function searchStationsByGovernorate(governorate) {
    if (!governorate) {
        isSearching = false;
        currentSearchGovernorate = '';
        document.getElementById('governorateSearch').value = '';
        
        displayStationsInList(stations);
        shouldFitBounds = true;
        displayStationsOnMap(stations);
        updateSectionTitle('قائمة المحطات');
        return;
    }
    
    isSearching = true;
    currentSearchGovernorate = governorate;
    
    const filteredStations = stations.filter(station => 
        station.governorate === governorate
    );
    
    displayStationsInList(filteredStations);
    shouldFitBounds = true;
    displayStationsOnMap(filteredStations);
    updateSectionTitle(`محطات ${governorate}`);
    
    if (filteredStations.length === 0) {
        showAlert(`لا توجد محطات في محافظة ${governorate}`, 'danger');
    } else {
        showAlert(`تم العثور على ${filteredStations.length} محطة في ${governorate}`, 'success');
    }
}

// تحديث عنوان القسم
function updateSectionTitle(title) {
    const sectionTitle = document.querySelector('.stations-section .section-title');
    if (sectionTitle) {
        const badge = sectionTitle.querySelector('.badge');
        const badgeHtml = badge ? badge.outerHTML : '<span id="stationCount" class="badge">0</span>';
        sectionTitle.innerHTML = `${title} ${badgeHtml}`;
    }
}

// عرض التنبيهات
function showAlert(message, type = 'success') {
    const alert = document.getElementById('alert');
    if (!alert) return;
    
    alert.textContent = message;
    alert.className = `alert alert-${type}`;
    alert.style.display = 'block';
    
    setTimeout(() => {
        alert.style.display = 'none';
    }, 5000);
}

// إلغاء البحث
function clearSearch() {
    isSearching = false;
    currentSearchGovernorate = '';
    document.getElementById('governorateSearch').value = '';
    updateSectionTitle('قائمة المحطات');
    shouldFitBounds = true;
    displayStationsInList(stations);
    displayStationsOnMap(stations);
    showAlert('تم إلغاء البحث وعرض جميع المحطات', 'info');
}

// عرض جميع المحطات
function showAllStationsOnMap() {
    clearSearch();
}

// إعداد الاستماع لتحديثات Firebase في الوقت الحقيقي
function setupFirebaseRealtimeListener() {
    try {
        db.collection('stations').onSnapshot((snapshot) => {
            console.log('🔄 تم تحديث البيانات من Firebase في الوقت الحقيقي');
            
            stations = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // تحديث العرض حسب حالة البحث
            if (isSearching && currentSearchGovernorate) {
                const filteredStations = stations.filter(station => 
                    station.governorate === currentSearchGovernorate
                );
                displayStationsInList(filteredStations);
                shouldFitBounds = true;
                displayStationsOnMap(filteredStations);
                document.getElementById('stationCount').textContent = filteredStations.length;
            } else {
                displayStationsInList(stations);
                shouldFitBounds = false;
                displayStationsOnMap(stations);
                document.getElementById('stationCount').textContent = stations.length;
            }
            
            updateStats();
            console.log('✅ تم تحديث العرض مع', stations.length, 'محطة');
            
        }, (error) => {
            console.error('❌ خطأ في الاستماع لتحديثات Firebase:', error);
        });
        
        console.log('✅ تم تفعيل الاستماع لتحديثات Firebase في الوقت الحقيقي');
        
    } catch (error) {
        console.error('❌ فشل إعداد الاستماع لتحديثات Firebase:', error);
    }
}

// تهيئة الصفحة
document.addEventListener('DOMContentLoaded', async function() {
    console.log('بدء تحميل الصفحة الرئيسية...');
    
    // 1. تهيئة Firebase
    if (!initializeFirebase()) {
        showAlert('تعذر الاتصال بقاعدة البيانات', 'danger');
        return;
    }
    
    // 2. تهيئة الخريطة
    try {
        map = L.map('map').setView([30.0444, 31.2357], 7);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        console.log('✅ تم تهيئة الخريطة');
    } catch (error) {
        console.error('❌ خطأ في تهيئة الخريطة:', error);
        showAlert('تعذر تحميل الخريطة', 'danger');
    }
    
    // 3. تحميل البيانات من Firebase
    await loadStationsFromFirebase();
    
    // 4. تفعيل الاستماع للتحديثات الفورية
    setupFirebaseRealtimeListener();
    
    // 5. إعداد أحداث البحث
    document.getElementById('searchBtn')?.addEventListener('click', function() {
        const governorate = document.getElementById('governorateSearch').value;
        searchStationsByGovernorate(governorate);
    });
    
    document.getElementById('governorateSearch')?.addEventListener('change', function() {
        const governorate = this.value;
        searchStationsByGovernorate(governorate);
    });
    
    document.getElementById('governorateSearch')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('searchBtn')?.click();
        }
    });
    
    // 6. إعداد أحداث الخريطة
    map.on('movestart', function() {
        shouldFitBounds = false;
    });
    
    let interactionTimer;
    map.on('moveend', function() {
        clearTimeout(interactionTimer);
        interactionTimer = setTimeout(() => {
            shouldFitBounds = true;
        }, 5000);
    });
    
    // 7. إضافة زر عرض جميع المحطات
    const backToAllButton = document.createElement('button');
    backToAllButton.innerHTML = '<i class="fas fa-globe-africa"></i> عرض جميع المحطات';
    backToAllButton.className = 'map-custom-control';
    backToAllButton.title = 'عرض جميع المحطات على الخريطة';
    
    backToAllButton.onclick = function(e) {
        e.stopPropagation();
        e.preventDefault();
        showAllStationsOnMap();
    };
    
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        mapContainer.appendChild(backToAllButton);
        
        backToAllButton.style.position = 'absolute';
        backToAllButton.style.zIndex = '1000';
        backToAllButton.style.bottom = '20px';
        backToAllButton.style.right = '20px';
        backToAllButton.style.backgroundColor = 'white';
        backToAllButton.style.color = '#2c7a5e';
        backToAllButton.style.border = '2px solid #2c7a5e';
        backToAllButton.style.padding = '8px 15px';
        backToAllButton.style.borderRadius = '5px';
        backToAllButton.style.cursor = 'pointer';
        backToAllButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        backToAllButton.style.display = 'flex';
        backToAllButton.style.alignItems = 'center';
        backToAllButton.style.gap = '8px';
        backToAllButton.style.fontSize = '14px';
    }
    
    // 8. رسالة ترحيب
    setTimeout(() => {
        if (stations.length > 0) {
            showAlert(`تم تحميل ${stations.length} محطة وقود`, 'success');
        } else {
            showAlert('جاري تحميل المحطات...', 'info');
        }
    }, 1000);
    
    console.log('✅ اكتمل تحميل الصفحة الرئيسية');
});