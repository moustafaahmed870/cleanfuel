// تهيئة Firebase
let db;
let stations = [];

// متغيرات الخريطة
let map;
let markers = [];
let shouldFitBounds = true;
let isSearching = false;
let currentSearchGovernorate = '';
let userLocationMarker = null;
let isWatchingLocation = false;
let watchId = null;
let accuracyCircle = null;

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
    
    // تحديث عداد قائمة المحطات
    const stationCountElement = document.getElementById('stationCount');
    if (stationCountElement && !isSearching) {
        stationCountElement.textContent = stations.length;
    }
    
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
    
    // تحديث العداد
    const stationCountElement = document.getElementById('stationCount');
    if (stationCountElement) {
        stationCountElement.textContent = stationsArray.length;
    }
    
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
    
    // تحديث العداد مباشرة
    const stationCountElement = document.getElementById('stationCount');
    if (stationCountElement) {
        stationCountElement.textContent = filteredStations.length;
    }
    
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
        // حساب عدد المحطات المعروضة حالياً
        const currentCount = isSearching && currentSearchGovernorate 
            ? stations.filter(s => s.governorate === currentSearchGovernorate).length
            : stations.length;
        
        sectionTitle.innerHTML = `${title} <span id="stationCount" class="badge">${currentCount}</span>`;
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
    
    // تحديث العداد
    const stationCountElement = document.getElementById('stationCount');
    if (stationCountElement) {
        stationCountElement.textContent = stations.length;
    }
    
    displayStationsInList(stations);
    displayStationsOnMap(stations);
    showAlert('تم إلغاء البحث وعرض جميع المحطات', 'info');
}

// عرض جميع المحطات
function showAllStationsOnMap() {
    isSearching = false;
    currentSearchGovernorate = '';
    document.getElementById('governorateSearch').value = '';
    
    // تحديث العداد
    const stationCountElement = document.getElementById('stationCount');
    if (stationCountElement) {
        stationCountElement.textContent = stations.length;
    }
    
    displayStationsInList(stations);
    shouldFitBounds = true;
    displayStationsOnMap(stations);
    updateSectionTitle('قائمة المحطات');
    showAlert('عرض جميع المحطات', 'info');
}

// دالة رئيسية للحصول على الموقع والزوم إليه مباشرة
function locateAndZoomToUser() {
    console.log('📍 زر موقعي الحالي تم النقر عليه');
    
    if (!navigator.geolocation) {
        showAlert('المتصفح لا يدعم خدمة الموقع الجغرافي', 'danger');
        return;
    }
    
    showAlert('جاري تحديد موقعك... قد يستغرق بضع ثوانٍ', 'info');
    
    // إظهار مؤشر تحميل على الزر
    const locationButton = document.querySelector('.location-btn');
    if (locationButton) {
        locationButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري البحث...';
        locationButton.disabled = true;
    }
    
    // تنظيف أي تتبع سابق
    if (isWatchingLocation) {
        stopTrackingLocation();
    }
    
    // مهلة أقصر للتجربة الأولى، ثم مهلة أطول إذا فشلت
    let timeoutAttempts = 0;
    const maxAttempts = 2;
    
    function attemptGetLocation(timeoutDuration) {
        timeoutAttempts++;
        console.log(`📍 محاولة ${timeoutAttempts}/${maxAttempts} - المهلة: ${timeoutDuration/1000} ثانية`);
        
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = position.coords.accuracy;
                
                console.log(`✅ الموقع الدقيق: ${lat}, ${lng} | الدقة: ${accuracy} متر`);
                
                // استعادة حالة الزر
                if (locationButton) {
                    locationButton.innerHTML = '<i class="fas fa-location-dot"></i> موقعي الحالي';
                    locationButton.disabled = false;
                }
                
                // إضافة علامة موقع المستخدم بدبوس أحمر
                addUserLocationMarker(lat, lng, accuracy);
                
                // الزوم مباشرة إلى الموقع مع مستوى تكبير مناسب
                zoomToLocation(lat, lng, accuracy);
                
                // عرض رسالة نجاح مع معلومات الدقة
                showAlert(`تم تحديد موقعك بدقة ${Math.round(accuracy)} متر`, 'success');
            },
            function(error) {
                handleLocationError(error, timeoutAttempts, maxAttempts, attemptGetLocation);
            },
            {
                enableHighAccuracy: timeoutAttempts === 1, // المحاولة الأولى بدقة عالية
                timeout: timeoutDuration,
                maximumAge: timeoutAttempts === 1 ? 0 : 30000 // المحاولة الثانية تسمح ببيانات أقدم
            }
        );
    }
    
    // البدء بالمحاولة الأولى (مهلة أقصر)
    attemptGetLocation(10000); // 10 ثوانٍ للمحاولة الأولى
}

// الزوم إلى الموقع المحدد
function zoomToLocation(lat, lng, accuracy) {
    // تحديد مستوى الزوم بناءً على الدقة
    let zoomLevel;
    
    if (accuracy < 10) {
        zoomLevel = 18;  // دقة عالية جداً
    } else if (accuracy < 30) {
        zoomLevel = 17;  // دقة عالية
    } else if (accuracy < 100) {
        zoomLevel = 16;  // دقة جيدة
    } else if (accuracy < 500) {
        zoomLevel = 15;  // دقة متوسطة
    } else if (accuracy < 1000) {
        zoomLevel = 14;  // دقة منخفضة
    } else if (accuracy < 5000) {
        zoomLevel = 13;  // دقة تقريبية
    } else if (accuracy < 20000) {
        zoomLevel = 10;  // دقة IP-based
    } else {
        zoomLevel = 8;   // دقة عامة
    }
    
    console.log(`🗺️ الزوم إلى المستوى: ${zoomLevel} بناءً على دقة ${accuracy} متر`);
    
    // الزوم السلس إلى الموقع
    map.flyTo([lat, lng], zoomLevel, {
        duration: 1.5,
        easeLinearity: 0.25
    });
}

// معالجة أخطاء الموقع
function handleLocationError(error, attemptNumber, maxAttempts, retryFunction) {
    console.error(`❌ خطأ في الموقع (المحاولة ${attemptNumber}/${maxAttempts}):`, error);
    
    let errorMessage = 'تعذر تحديد موقعك';
    let shouldRetry = false;
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            errorMessage = 'تم رفض إذن الموقع. يرجى:<br>1. السماح باستخدام الموقع في إعدادات المتصفح<br>2. تحديث الصفحة والمحاولة مرة أخرى';
            break;
            
        case error.POSITION_UNAVAILABLE:
            errorMessage = 'معلومات الموقع غير متاحة.<br>تأكد من:<br>1. تشغيل GPS في هاتفك<br>2. أنك في مكان مفتوح<br>3. اتصال جيد بالإنترنت';
            shouldRetry = attemptNumber < maxAttempts;
            break;
            
        case error.TIMEOUT:
            errorMessage = 'انتهت مهلة البحث عن الموقع.<br>حاول مرة أخرى في مكان مفتوح';
            shouldRetry = attemptNumber < maxAttempts;
            break;
    }
    
    // استعادة حالة الزر
    const locationButton = document.querySelector('.location-btn');
    if (locationButton) {
        locationButton.innerHTML = '<i class="fas fa-location-dot"></i> موقعي الحالي';
        locationButton.disabled = false;
    }
    
    showAlert(errorMessage, 'danger');
    
    // إعادة المحاولة إذا كان ذلك مناسباً
    if (shouldRetry && retryFunction) {
        setTimeout(() => {
            console.log(`🔄 إعادة المحاولة ${attemptNumber + 1}/${maxAttempts}`);
            showAlert(`إعادة المحاولة ${attemptNumber + 1}/${maxAttempts}...`, 'info');
            
            if (locationButton) {
                locationButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري البحث...';
                locationButton.disabled = true;
            }
            
            // المحاولة الثانية بمهلة أطول ودقة أقل
            retryFunction(15000); // 15 ثانية للمحاولة الثانية
        }, 2000);
    } else if (attemptNumber >= maxAttempts) {
        // بعد فشل جميع المحاولات، عرض خيارات بديلة
        setTimeout(() => {
            showAlternativeLocationOptions();
        }, 3000);
    }
}

// عرض خيارات بديلة لتحديد الموقع
function showAlternativeLocationOptions() {
    const helpDiv = document.createElement('div');
    helpDiv.className = 'location-help-alert';
    helpDiv.innerHTML = `
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin-top: 10px; text-align: center;">
            <h4 style="margin-top: 0; color: #856404;">
                <i class="fas fa-lightbulb"></i> نصائح لتحسين دقة الموقع:
            </h4>
            <ul style="text-align: right; padding-right: 20px; margin: 10px 0;">
                <li>افتح النوافذ أو اذهب إلى مكان مفتوح</li>
                <li>تأكد من تشغيل GPS في هاتفك</li>
                <li>انتظر 10-15 ثانية ثم حاول مرة أخرى</li>
                <li>تحقق من إعدادات الخصوصية في المتصفح</li>
            </ul>
            <div style="margin-top: 15px;">
                <button id="tryAgainBtn" style="background: #28a745; color: white; border: none; padding: 8px 15px; border-radius: 5px; margin: 5px; cursor: pointer;">
                    <i class="fas fa-redo"></i> حاول مرة أخرى
                </button>
                <button id="useApproxBtn" style="background: #6c757d; color: white; border: none; padding: 8px 15px; border-radius: 5px; margin: 5px; cursor: pointer;">
                    <i class="fas fa-map-marker-alt"></i> استخدام موقع تقريبي
                </button>
            </div>
        </div>
    `;
    
    const alertBox = document.getElementById('alert');
    if (alertBox) {
        alertBox.parentNode.insertBefore(helpDiv, alertBox.nextSibling);
        
        // حدث زر المحاولة مرة أخرى
        document.getElementById('tryAgainBtn').addEventListener('click', function() {
            helpDiv.remove();
            setTimeout(() => {
                locateAndZoomToUser();
            }, 500);
        });
        
        // حدث زر الموقع التقريبي
        document.getElementById('useApproxBtn').addEventListener('click', function() {
            helpDiv.remove();
            useApproximateLocation();
        });
        
        // إزالة التلميحات بعد 30 ثانية
        setTimeout(() => {
            if (helpDiv.parentNode) {
                helpDiv.parentNode.removeChild(helpDiv);
            }
        }, 30000);
    }
}

// استخدام موقع تقريبي (IP-based)
function useApproximateLocation() {
    showAlert('جاري تحديد موقعك التقريبي...', 'info');
    
    // استخدام خدمة تحديد موقع تقريبي مجانية
    fetch('https://ipapi.co/json/')
        .then(response => response.json())
        .then(data => {
            if (data.latitude && data.longitude) {
                const lat = parseFloat(data.latitude);
                const lng = parseFloat(data.longitude);
                const accuracy = 10000; // دقة تقريبية 10 كم للموقع التقريبي
                
                console.log(`📍 الموقع التقريبي: ${lat}, ${lng} (عنوان IP)`);
                
                addUserLocationMarker(lat, lng, accuracy);
                zoomToLocation(lat, lng, accuracy);
                
                showAlert('تم تحديد موقعك التقريبي بناءً على عنوان IP. الدقة تقريبية 10 كم', 'warning');
            } else {
                throw new Error('لا يمكن الحصول على الموقع التقريبي');
            }
        })
        .catch(error => {
            console.error('❌ خطأ في الموقع التقريبي:', error);
            
            // استخدام موقع افتراضي (مصر)
            const defaultLat = 30.0444;
            const defaultLng = 31.2357;
            const defaultAccuracy = 50000; // 50 كم
            
            addUserLocationMarker(defaultLat, defaultLng, defaultAccuracy);
            zoomToLocation(defaultLat, defaultLng, 8); // تكبير أقل
            
            showAlert('تم استخدام موقع تقريبي (القاهرة). الدقة محدودة', 'warning');
        });
}

// إنشاء أيقونة الدبوس الأحمر
function createRedPinIcon() {
    return L.divIcon({
        className: 'red-pin-marker',
        html: `
            <div style="position: relative;">
                <div style="
                    position: absolute;
                    top: -24px;
                    left: -12px;
                    width: 24px;
                    height: 24px;
                    background-color: #dc3545;
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                    z-index: 1000;
                ">
                    <div style="
                        position: absolute;
                        top: 6px;
                        left: 6px;
                        width: 6px;
                        height: 6px;
                        background-color: white;
                        border-radius: 50%;
                        box-shadow: 0 0 2px rgba(0,0,0,0.3);
                    "></div>
                </div>
            </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        popupAnchor: [0, -24]
    });
}

// إضافة علامة موقع المستخدم بدبوس أحمر
function addUserLocationMarker(lat, lng, accuracy = null) {
    console.log(`📍 إضافة دبوس أحمر في: ${lat}, ${lng}`);
    
    // إزالة العلامة القديمة إذا كانت موجودة
    if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
        userLocationMarker = null;
    }
    
    // إزالة دائرة الدقة القديمة
    if (accuracyCircle) {
        map.removeLayer(accuracyCircle);
        accuracyCircle = null;
    }
    
    // إنشاء أيقونة الدبوس الأحمر
    const redPinIcon = createRedPinIcon();
    
    // إضافة العلامة الجديدة
    userLocationMarker = L.marker([lat, lng], { 
        icon: redPinIcon,
        zIndexOffset: 1000
    }).addTo(map);
    
    // نص البوب أب مع معلومات الدقة
    let popupContent = '<div style="text-align: center; font-weight: bold; color: #dc3545; padding: 5px;">📍 موقعك الحالي</div>';
    if (accuracy) {
        popupContent += `<div style="text-align: center; font-size: 12px; color: #666;">الدقة: ${Math.round(accuracy)} متر</div>`;
    }
    
    userLocationMarker.bindPopup(popupContent).openPopup();
    
    // إضافة دائرة الدقة إذا كانت معقولة
    if (accuracy && accuracy < 500) {
        accuracyCircle = L.circle([lat, lng], {
            color: '#dc3545',
            fillColor: '#dc3545',
            fillOpacity: 0.15,
            weight: 1,
            radius: accuracy
        }).addTo(map);
    }
}

// بدء تتبع موقع المستخدم
function startTrackingLocation() {
    if (!navigator.geolocation) {
        showAlert('المتصفح لا يدعم خدمة الموقع الجغرافي', 'danger');
        return;
    }
    
    if (isWatchingLocation) {
        stopTrackingLocation();
        return;
    }
    
    showAlert('جاري تتبع موقعك...', 'info');
    
    watchId = navigator.geolocation.watchPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;
            
            if (!isWatchingLocation) {
                isWatchingLocation = true;
                updateLocationButton();
            }
            
            addUserLocationMarker(lat, lng, accuracy);
            
            // الزوم إلى الموقع في أول مرة فقط
            if (!userLocationMarker) {
                zoomToLocation(lat, lng, accuracy);
            }
        },
        function(error) {
            handleLocationError(error, 1, 1, null); // لا إعادة محاولة للتتبع
            stopTrackingLocation();
        },
        {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 15000
        }
    );
}

// إيقاف تتبع موقع المستخدم
function stopTrackingLocation() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    
    isWatchingLocation = false;
    updateLocationButton();
    
    // إزالة دائرة الدقة
    if (accuracyCircle) {
        map.removeLayer(accuracyCircle);
        accuracyCircle = null;
    }
    
    if (userLocationMarker) {
        userLocationMarker.bindPopup('<div style="text-align: center; color: #999;">موقعك (غير نشط)</div>');
    }
    
    showAlert('تم إيقاف تتبع موقعك', 'info');
}

// تحديث حالة زر الموقع
function updateLocationButton() {
    const locationButton = document.querySelector('.location-btn');
    if (locationButton) {
        if (isWatchingLocation) {
            locationButton.innerHTML = '<i class="fas fa-stop-circle"></i> إيقاف التتبع';
            locationButton.style.backgroundColor = '#dc3545';
            locationButton.style.borderColor = '#dc3545';
            locationButton.title = 'إيقاف تتبع موقعك';
        } else {
            locationButton.innerHTML = '<i class="fas fa-location-dot"></i> موقعي الحالي';
            locationButton.style.backgroundColor = '#4285F4';
            locationButton.style.borderColor = '#4285F4';
            locationButton.title = 'عرض موقعك والزوم إليه';
        }
    }
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
    
    // 8. إضافة زر موقع المستخدم الحالي
    const locationButton = document.createElement('button');
    locationButton.innerHTML = '<i class="fas fa-location-dot"></i> موقعي الحالي';
    locationButton.className = 'map-custom-control location-btn';
    locationButton.title = 'عرض موقعك والزوم إليه مباشرة';
    
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        // زر عرض الكل
        mapContainer.appendChild(backToAllButton);
        
        backToAllButton.style.position = 'absolute';
        backToAllButton.style.zIndex = '1000';
        backToAllButton.style.bottom = '70px';
        backToAllButton.style.right = '20px';
        backToAllButton.style.backgroundColor = 'white';
        backToAllButton.style.color = '#2c7a5e';
        backToAllButton.style.border = '2px solid #2c7a5e';
        backToAllButton.style.padding = '10px 15px';
        backToAllButton.style.borderRadius = '5px';
        backToAllButton.style.cursor = 'pointer';
        backToAllButton.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        backToAllButton.style.display = 'flex';
        backToAllButton.style.alignItems = 'center';
        backToAllButton.style.gap = '8px';
        backToAllButton.style.fontSize = '14px';
        backToAllButton.style.fontWeight = 'bold';
        
        // زر الموقع
        mapContainer.appendChild(locationButton);
        
        locationButton.style.position = 'absolute';
        locationButton.style.zIndex = '1000';
        locationButton.style.bottom = '20px';
        locationButton.style.right = '20px';
        locationButton.style.backgroundColor = '#4285F4';
        locationButton.style.color = 'white';
        locationButton.style.border = '2px solid #4285F4';
        locationButton.style.padding = '10px 15px';
        locationButton.style.borderRadius = '5px';
        locationButton.style.cursor = 'pointer';
        locationButton.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        locationButton.style.display = 'flex';
        locationButton.style.alignItems = 'center';
        locationButton.style.gap = '8px';
        locationButton.style.fontSize = '14px';
        locationButton.style.fontWeight = 'bold';
        locationButton.style.transition = 'all 0.3s ease';
    }
    
    // 9. إضافة أنماط CSS
    const style = document.createElement('style');
    style.textContent = `
        .red-pin-marker {
            background: transparent;
            border: none;
        }
        .leaflet-marker-icon.red-pin-marker {
            background: transparent;
            border: none;
        }
        .location-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .location-btn:active {
            transform: scale(0.95);
        }
        .location-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }
        .fa-spinner {
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    
    // 10. إعداد حدث زر الموقع
    locationButton.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        console.log('📍 زر موقعي الحالي تم النقر عليه مباشرة');
        locateAndZoomToUser();
    });
    
    // 11. طلب الإذن عند تحميل الصفحة
    if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' }).then(function(result) {
            if (result.state === 'granted') {
                console.log('✅ الإذن ممنوح مسبقاً لخدمة الموقع');
            } else if (result.state === 'prompt') {
                console.log('⚠️ يحتاج إلى إذن لخدمة الموقع');
            } else if (result.state === 'denied') {
                console.log('❌ تم رفض إذن خدمة الموقع');
            }
        });
    }
    
    // 12. إضافة دالة للمساعدة في التصحيح
    window.showLocationDebug = function() {
        console.log('🔍 معلومات تصحيح الموقع:');
        console.log('- navigator.geolocation موجود:', !!navigator.geolocation);
        console.log('- زر الموقع موجود:', !!document.querySelector('.location-btn'));
        console.log('- دالة locateAndZoomToUser موجودة:', typeof locateAndZoomToUser);
        console.log('- userLocationMarker:', userLocationMarker);
        console.log('- isWatchingLocation:', isWatchingLocation);
        console.log('- زر الموقع disabled:', document.querySelector('.location-btn')?.disabled);
    };
    
    // 13. رسالة ترحيب
    setTimeout(() => {
        if (stations.length > 0) {
            showAlert(`تم تحميل ${stations.length} محطة وقود. انقر على "موقعي الحالي" للزوم إلى موقعك`, 'success');
        } else {
            showAlert('جاري تحميل المحطات...', 'info');
        }
    }, 1000);
    
    console.log('✅ اكتمل تحميل الصفحة الرئيسية');
});

// جعل الدالة متاحة عالمياً لاستخدامها في الزر مباشرة
window.locateAndZoomToUser = locateAndZoomToUser;