const fs = require('fs');
const path = require('path');

// Đọc dữ liệu từ các file JSON
const projects = JSON.parse(fs.readFileSync('./data/projects.json', 'utf8'));
const provinces = JSON.parse(fs.readFileSync('./data/tinh_tp.json', 'utf8'));
const districts = JSON.parse(fs.readFileSync('./data/quan_huyen.json', 'utf8'));
const wards = JSON.parse(fs.readFileSync('./data/xa_phuong.json', 'utf8'));
const wardMappings = JSON.parse(fs.readFileSync('./data/ward_mappings.json', 'utf8'));
const newProvinces = JSON.parse(fs.readFileSync('./data/province.json', 'utf8'));
const newWards = JSON.parse(fs.readFileSync('./data/ward.json', 'utf8'));

// Các từ cần loại bỏ khi làm sạch địa chỉ
const REMOVE_TERMS = [
    'Commune', 'Town', 'Ward', 'District', 'Province', 'City',
    'xã', 'huyện', 'tỉnh', 'thành phố', 'quận', 'phường', 'thị xã', 'thị trấn',
    'Xã', 'Huyện', 'Tỉnh', 'Thành phố', 'Quận', 'Phường', 'Thị xã', 'Thị trấn'
];

/**
 * Loại bỏ dấu tiếng Việt và chuyển thành slug
 */
function removeVietnameseTones(str) {
    if (!str) return '';
    
    const vietnameseMap = {
        'à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ': 'a',
        'è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ': 'e',
        'ì|í|ị|ỉ|ĩ': 'i',
        'ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ': 'o',
        'ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ': 'u',
        'ỳ|ý|ỵ|ỷ|ỹ': 'y',
        'đ': 'd',
        'À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ': 'A',
        'È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ': 'E',
        'Ì|Í|Ị|Ỉ|Ĩ': 'I',
        'Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ': 'O',
        'Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ': 'U',
        'Ỳ|Ý|Ỵ|Ỷ|Ỹ': 'Y',
        'Đ': 'D'
    };

    let result = str;
    for (const [pattern, replacement] of Object.entries(vietnameseMap)) {
        result = result.replace(new RegExp(pattern, 'g'), replacement);
    }
    
    return result.toLowerCase()
                 .replace(/[^a-z0-9\s-]/g, '')
                 .replace(/\s+/g, '-')
                 .replace(/-+/g, '-')
                 .trim();
}

/**
 * Làm sạch tên địa chỉ bằng cách loại bỏ các từ không cần thiết
 */
function cleanAddressPart(addressPart) {
    if (!addressPart) return '';
    
    let cleaned = addressPart.trim();
    
    // Loại bỏ các từ không cần thiết
    for (const term of REMOVE_TERMS) {
        const regex = new RegExp(`\\b${term}\\b`, 'gi');
        cleaned = cleaned.replace(regex, '').trim();
    }
    
    // Loại bỏ các dấu phẩy thừa và khoảng trắng thừa
    cleaned = cleaned.replace(/,+/g, ',').replace(/^,|,$/g, '').trim();
    
    return cleaned;
}

/**
 * Kiểm tra xem một phần địa chỉ có phải là thông tin hành chính không
 */
function isAdministrativeInfo(addressPart) {
    if (!addressPart) return false;
    
    const adminTerms = [
        'commune', 'ward', 'district', 'province', 'city', 'town',
        'xã', 'phường', 'huyện', 'quận', 'tỉnh', 'thành phố', 'thị xã', 'thị trấn'
    ];
    
    const lowerPart = addressPart.toLowerCase();
    return adminTerms.some(term => lowerPart.includes(term));
}

/**
 * Làm sạch các phần địa chỉ chi tiết, loại bỏ thông tin hành chính
 */
function cleanDetailParts(detailParts) {
    if (!detailParts || detailParts.length === 0) return [];
    
    return detailParts
        .map(part => {
            // Nếu phần này chứa thông tin hành chính, cố gắng tách ra phần không phải hành chính
            if (isAdministrativeInfo(part)) {
                // Tách bằng dấu phẩy để tìm phần không phải hành chính
                const subParts = part.split(',').map(p => p.trim());
                const nonAdminParts = subParts.filter(subPart => !isAdministrativeInfo(subPart));
                return nonAdminParts.join(', ');
            }
            return part;
        })
        .map(part => cleanAddressPart(part))
        .filter(part => part && part.length > 0);
}

/**
 * Tách địa chỉ bằng dấu phẩy hoặc gạch ngang
 */
function parseAddress(address) {
    if (!address) return [];
    
    let parts = [];
    
    // Kiểm tra xem có dấu phẩy không
    if (address.includes(',')) {
        parts = address.split(',');
    } 
    // Nếu không có dấu phẩy, kiểm tra dấu gạch ngang
    else if (address.includes('-')) {
        // Xử lý trường hợp đặc biệt "Ba Ria-Vung Tau"
        if (address.toLowerCase().includes('ba ria-vung tau')) {
            // Thay thế tạm thời để tránh tách nhầm
            const temp = address.replace(/ba ria-vung tau/gi, 'BARAVUNGTAU_TEMP');
            parts = temp.split('-').map(part => 
                part.replace('BARAVUNGTAU_TEMP', 'Ba Ria-Vung Tau')
            );
        } else {
            parts = address.split('-');
        }
    } else {
        parts = [address];
    }
    
    return parts.map(part => part.trim()).filter(part => part.length > 0);
}

/**
 * Tìm tỉnh từ tên city
 */
function findProvince(cityName) {
    if (!cityName || typeof cityName !== 'string') return null;
    
    // Kiểm tra nếu city là số (code) -> invalid
    if (/^\d+$/.test(cityName.trim())) {
        return null;
    }
    
    // Tìm tỉnh theo name_with_type
    for (const [key, province] of Object.entries(provinces)) {
        if (province.name_with_type && 
            province.name_with_type.toLowerCase() === cityName.toLowerCase()) {
            return province;
        }
    }
    
    // Tìm theo name (không có type)
    for (const [key, province] of Object.entries(provinces)) {
        if (province.name && 
            province.name.toLowerCase() === cityName.toLowerCase()) {
            return province;
        }
    }
    
    return null;
}

/**
 * Tìm huyện từ tên district và mã tỉnh
 */
function findDistrict(districtName, provinceCode) {
    if (!districtName || !provinceCode) return null;
    
    // Tìm huyện theo parent_code và name_with_type
    for (const [key, district] of Object.entries(districts)) {
        if (district.parent_code === provinceCode &&
            district.name_with_type &&
            district.name_with_type.toLowerCase() === districtName.toLowerCase()) {
            return district;
        }
    }
    
    // Tìm theo name (không có type)
    for (const [key, district] of Object.entries(districts)) {
        if (district.parent_code === provinceCode &&
            district.name &&
            district.name.toLowerCase() === districtName.toLowerCase()) {
            return district;
        }
    }
    
    return null;
}

/**
 * Tìm xã/phường từ địa chỉ và mã huyện
 */
function findWard(address, districtCode) {
    if (!address || !districtCode) return null;
    
    const addressParts = parseAddress(address);
    
    // Duyệt từ cuối lên để tìm xã/phường
    for (let i = addressParts.length - 1; i >= 0; i--) {
        const part = addressParts[i];
        const cleanedPart = cleanAddressPart(part);
        
        if (!cleanedPart) continue;
        
        const slug = removeVietnameseTones(cleanedPart);
        
        // Tìm trong xa_phuong.json
        for (const [code, ward] of Object.entries(wards)) {
            if (ward.parent_code === districtCode && ward.slug === slug) {
                return { 
                    ...ward, 
                    code, 
                    position: i,
                    originalPart: part 
                };
            }
        }
    }
    
    return null;
}

/**
 * Áp dụng ward mapping để tìm địa chỉ mới
 */
function applyWardMapping(oldWard, oldDistrict, oldProvince) {
    if (!oldWard || !oldDistrict || !oldProvince) return null;
    
    // Tìm mapping phù hợp
    const mapping = wardMappings.find(m => 
        m.old_ward_name === oldWard.name_with_type &&
        m.old_district_name === oldDistrict.name_with_type &&
        m.old_province_name === oldProvince.name_with_type
    );
    
    if (!mapping) return null;
    
    return {
        new_ward_name: mapping.new_ward_name,
        new_province_name: mapping.new_province_name
    };
}

/**
 * Xây dựng địa chỉ mới bằng tiếng Anh
 */
function buildNewAddress(originalAddress, wardPosition, newWardName, newProvinceName) {
    if (!originalAddress || wardPosition === undefined) return '';
    
    const addressParts = parseAddress(originalAddress);
    
    // Lấy phần địa chỉ chi tiết (từ đầu đến vị trí ward)
    const rawDetailParts = addressParts.slice(0, wardPosition);
    
    // Làm sạch các phần địa chỉ chi tiết, loại bỏ thông tin hành chính
    const cleanedDetailParts = cleanDetailParts(rawDetailParts);
    // Bỏ dấu tiếng Việt cho các phần địa chỉ chi tiết
    const englishDetailParts = cleanedDetailParts.map(part => {
        // Bỏ dấu và chuyển thành dạng title case
        const withoutTones = removeVietnameseTones(part);
        return withoutTones.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    });
    const detailAddress = englishDetailParts.join(', ');
    
    // Tìm thông tin ward và province mới từ file dữ liệu
    let wardInfo = null;
    let provinceInfo = null;
    
    // Tìm ward mới trong newWards
    for (const [code, ward] of Object.entries(newWards)) {
        if (ward.name === newWardName.replace(/^(Phường|Xã)\s+/, '')) {
            wardInfo = ward;
            break;
        }
    }
    
    // Tìm province mới trong newProvinces
    for (const [code, province] of Object.entries(newProvinces)) {
        if (province.name === newProvinceName.replace(/^(Tỉnh|Thành phố)\s+/, '')) {
            provinceInfo = province;
            break;
        }
    }
    
    // Xây dựng địa chỉ mới
    let newAddress = detailAddress;
    
    if (wardInfo) {
        const wardType = wardInfo.type === 'phuong' ? 'Ward' : 'Commune';
        // Bỏ dấu tiếng Việt cho tên ward
        const wardNameEnglish = removeVietnameseTones(wardInfo.name)
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        newAddress += (newAddress ? ', ' : '') + `${wardNameEnglish} ${wardType}`;
    }
    
    if (provinceInfo) {
        const provinceType = provinceInfo.type === 'thanh-pho' ? 'City' : 'Province';
        // Bỏ dấu tiếng Việt cho tên province
        const provinceNameEnglish = removeVietnameseTones(provinceInfo.name)
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        newAddress += (newAddress ? ', ' : '') + `${provinceNameEnglish} ${provinceType}`;
    }
    
    // Thêm "Vietnam" vào cuối địa chỉ
    newAddress += ', Vietnam';
    
    return newAddress;
}

/**
 * Chuyển đổi một project
 */
function convertProject(project) {
    const result = {
        ...project,
        conversion_status: 'unknown',
        error_message: '',
        new_city: null,
        new_address: null
    };
    
    try {
        // Bước 1: Tìm tỉnh
        if (!project.city) {
            result.conversion_status = 'missing_info';
            result.error_message = 'Thiếu thông tin city';
            return result;
        }
        
        // Kiểm tra nếu city là code số
        if (/^\d+$/.test(project.city.toString().trim())) {
            result.conversion_status = 'invalid_input';
            result.error_message = 'City là mã số, không xử lý được';
            return result;
        }
        
        const province = findProvince(project.city);
        if (!province) {
            result.conversion_status = 'missing_info';
            result.error_message = `Không tìm thấy tỉnh: ${project.city}`;
            return result;
        }
        
        // Bước 2: Tìm huyện
        if (!project.district) {
            result.conversion_status = 'missing_info';
            result.error_message = 'Thiếu thông tin district';
            return result;
        }
        
        const district = findDistrict(project.district, province.code);
        if (!district) {
            result.conversion_status = 'missing_info';
            result.error_message = `Không tìm thấy huyện: ${project.district} trong tỉnh ${province.name_with_type}`;
            return result;
        }
        
        // Bước 3: Tìm xã/phường
        if (!project.address) {
            result.conversion_status = 'invalid_input';
            result.error_message = 'Thiếu thông tin address';
            return result;
        }
        
        const ward = findWard(project.address, district.code);
        if (!ward) {
            result.conversion_status = 'missing_info';
            result.error_message = `Không tìm thấy xã/phường trong địa chỉ: ${project.address}`;
            return result;
        }
        
        // Bước 4: Áp dụng ward mapping
        const mapping = applyWardMapping(ward, district, province);
        if (!mapping) {
            result.conversion_status = 'missing_info';
            result.error_message = `Không tìm thấy mapping cho: ${ward.name_with_type}, ${district.name_with_type}, ${province.name_with_type}`;
            return result;
        }
        
        // Bước 5: Xây dựng địa chỉ mới
        const newAddress = buildNewAddress(
            project.address,
            ward.position,
            mapping.new_ward_name,
            mapping.new_province_name
        );
        
        result.new_city = mapping.new_province_name;
        result.new_address = newAddress;
        result.conversion_status = 'success';
        result.error_message = 'Chuyển đổi thành công';
        
    } catch (error) {
        result.conversion_status = 'invalid_input';
        result.error_message = `Lỗi xử lý: ${error.message}`;
    }
    
    return result;
}

/**
 * Hàm main để chuyển đổi tất cả projects
 */
function convertAllProjects() {
    console.log('Bắt đầu chuyển đổi dữ liệu...');
    console.log(`Tổng số projects: ${projects.length}`);
    
    const conversionSuccess = [];
    const missingInfo = [];
    const invalidInput = [];
    
    projects.forEach((project, index) => {
        console.log(`Đang xử lý project ${index + 1}/${projects.length}: ${project.id}`);
        
        const result = convertProject(project);
        
        switch (result.conversion_status) {
            case 'success':
                conversionSuccess.push(result);
                break;
            case 'missing_info':
                missingInfo.push(result);
                break;
            case 'invalid_input':
                invalidInput.push(result);
                break;
        }
    });
    
    // Ghi kết quả ra file
    fs.writeFileSync('conversion_success.json', JSON.stringify(conversionSuccess, null, 2), 'utf8');
    fs.writeFileSync('missing_info.json', JSON.stringify(missingInfo, null, 2), 'utf8');
    fs.writeFileSync('invalid_input.json', JSON.stringify(invalidInput, null, 2), 'utf8');
    
    console.log('\n=== KẾT QUẢ CHUYỂN ĐỔI ===');
    console.log(`Thành công: ${conversionSuccess.length}`);
    console.log(`Thiếu thông tin: ${missingInfo.length}`);
    console.log(`Dữ liệu không hợp lệ: ${invalidInput.length}`);
    console.log('\nĐã ghi kết quả vào các file:');
    console.log('- conversion_success.json');
    console.log('- missing_info.json');
    console.log('- invalid_input.json');
}

// Chạy chương trình
if (require.main === module) {
    convertAllProjects();
}

module.exports = {
    convertProject,
    convertAllProjects,
    removeVietnameseTones,
    cleanAddressPart,
    parseAddress,
    findProvince,
    findDistrict,
    findWard,
    applyWardMapping,
    buildNewAddress,
    isAdministrativeInfo,
    cleanDetailParts
};
