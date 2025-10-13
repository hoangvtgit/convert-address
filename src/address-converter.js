const fs = require('fs');
const path = require('path');

/**
 * Trình chuyển đổi địa chỉ từ hệ thống cũ sang hệ thống mới theo quy định của Việt Nam
 * Hỗ trợ chuyển đổi địa chỉ dự án từ cấu trúc có huyện sang cấu trúc mới không có huyện
 */
class AddressConverter {
    constructor() {
        // Đường dẫn tới các file dữ liệu
        this.dataPath = path.join(__dirname, '../data');
        
        // Dữ liệu sẽ được load từ các file JSON
        this.projects = [];           // Danh sách dự án cần chuyển đổi
        this.wardMappings = [];       // Mapping từ xã/phường cũ sang mới
        this.newWards = {};           // Dữ liệu xã/phường mới
        this.newProvinces = {};       // Dữ liệu tỉnh/thành phố mới
        this.oldWards = {};           // Dữ liệu xã/phường cũ
        this.oldDistricts = {};       // Dữ liệu huyện/quận cũ
        this.oldProvinces = {};       // Dữ liệu tỉnh/thành phố cũ
        
        // Kết quả chuyển đổi
        this.results = {
            success: [],        // Chuyển đổi thành công
            missingInfo: [],    // Thiếu thông tin
            invalidInput: []    // Dữ liệu đầu vào không hợp lệ
        };
        
        // Thống kê
        this.statistics = {
            totalRecords: 0,
            successCount: 0,
            missingInfoCount: 0,
            invalidInputCount: 0,
            exactMatches: 0,
            fuzzyMatches: 0,
            highConfidence: 0,
            mediumConfidence: 0
        };
    }

    /**
     * Khởi tạo và load tất cả dữ liệu cần thiết từ các file JSON
     */
    async initialize() {
        try {
            console.log('🔄 Đang khởi tạo dữ liệu...');
            
            // Load dữ liệu dự án
            this.projects = await this.loadJsonFile('projects.json');
            console.log(`✅ Đã load ${this.projects.length} dự án`);
            
            // Load dữ liệu mapping
            this.wardMappings = await this.loadJsonFile('ward_mappings.json');
            console.log(`✅ Đã load ${this.wardMappings.length} mapping xã/phường`);
            
            // Load dữ liệu mới
            this.newWards = await this.loadJsonFile('ward.json');
            this.newProvinces = await this.loadJsonFile('province.json');
            console.log(`✅ Đã load ${Object.keys(this.newWards).length} xã/phường mới`);
            console.log(`✅ Đã load ${Object.keys(this.newProvinces).length} tỉnh/thành phố mới`);
            
            // Load dữ liệu cũ
            this.oldWards = await this.loadJsonFile('xa_phuong.json');
            this.oldDistricts = await this.loadJsonFile('quan_huyen.json');
            this.oldProvinces = await this.loadJsonFile('tinh_tp.json');
            console.log(`✅ Đã load ${Object.keys(this.oldWards).length} xã/phường cũ`);
            console.log(`✅ Đã load ${Object.keys(this.oldDistricts).length} huyện/quận cũ`);
            console.log(`✅ Đã load ${Object.keys(this.oldProvinces).length} tỉnh/thành phố cũ`);
            
            this.statistics.totalRecords = this.projects.length;
            console.log('✅ Khởi tạo dữ liệu hoàn tất');
            
        } catch (error) {
            console.error('❌ Lỗi khi khởi tạo dữ liệu:', error.message);
            throw error;
        }
    }

    /**
     * Helper function để load file JSON
     * @param {string} filename - Tên file cần load
     * @returns {Object|Array} Dữ liệu từ file JSON
     */
    async loadJsonFile(filename) {
        try {
            const filePath = path.join(this.dataPath, filename);
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`❌ Lỗi khi đọc file ${filename}:`, error.message);
            throw error;
        }
    }

    /**
     * Phân tích và trích xuất thông tin địa chỉ từ chuỗi địa chỉ
     * @param {string} address - Chuỗi địa chỉ cần phân tích
     * @param {string} city - Tỉnh/thành phố từ dữ liệu
     * @param {string} district - Huyện/quận từ dữ liệu
     * @returns {Object} Thông tin địa chỉ đã được phân tích
     */
    parseAddress(address, city, district) {
        const result = {
            originalAddress: address,
            city: city,
            district: district,
            ward: '',
            wardInfo: null, // Thêm thông tin xã/phường tìm được
            addressPrefix: '',
            isValid: true,
            errors: [],
            matchMethod: '' // Phương pháp tìm được xã/phường
        };

        try {
            // Làm sạch địa chỉ
            let cleanAddress = address ? address.trim() : '';
            
            // Tách địa chỉ theo dấu phấy
            const addressParts = cleanAddress.split(',').map(part => part.trim());
            
            let wardFound = false;
            let wardName = '';
            let wardInfo = null;
            let prefixParts = [];
            
            // Duyệt qua từng phần của địa chỉ
            for (let i = 0; i < addressParts.length; i++) {
                const part = addressParts[i];
                
                if (!wardFound) {
                    // Làm sạch phần này và tìm trong database
                    const cleanedPart = this.cleanWardName(part);
                    
                    if (cleanedPart) { // Chỉ tìm kiếm nếu có dữ liệu sau khi làm sạch
                        const foundWard = this.findWardInDatabase(cleanedPart);
                        
                        if (foundWard) {
                            // Tìm thấy xã/phường!
                            wardName = foundWard.name; // Sử dụng tên gốc từ database
                            wardInfo = foundWard;
                            wardFound = true;
                            result.matchMethod = foundWard.matchType;
                            
                            // Tất cả phần trước đó là địa chỉ chi tiết
                            result.addressPrefix = prefixParts.join(', ');
                            break;
                        }
                    }
                }
                
                // Nếu chưa tìm thấy ward, thêm vào prefix
                if (!wardFound) {
                    prefixParts.push(part);
                }
            }
            
            result.ward = wardName;
            result.wardInfo = wardInfo;
            
            // Nếu không tìm thấy ward và có phần tử, lấy phần cuối làm ward fallback
            if (!wardFound && addressParts.length > 0) {
                // Thử phương pháp cũ với từ khóa cho trường hợp fallback
                const wardKeywords = ['commune', 'ward', 'xã', 'phường', 'thị trấn'];
                
                for (let i = 0; i < addressParts.length; i++) {
                    const part = addressParts[i];
                    const partLower = part.toLowerCase();
                    
                    const hasWardKeyword = wardKeywords.some(keyword => 
                        partLower.includes(keyword)
                    );
                    
                    if (hasWardKeyword) {
                        // Làm sạch hoàn toàn với hàm mới
                        wardName = this.cleanWardName(part);
                        // Nếu sau khi làm sạch vẫn có tên, thử tìm trong database
                        if (wardName) {
                            const foundWard = this.findWardInDatabase(wardName);
                            if (foundWard) {
                                result.ward = foundWard.name;
                                result.wardInfo = foundWard;
                                result.matchMethod = 'fallback_database_found';
                            } else {
                                result.ward = this.extractWardName(part); // Dùng phương pháp cũ
                                result.matchMethod = 'fallback_keyword_extraction';
                            }
                        } else {
                            result.ward = this.extractWardName(part);
                            result.matchMethod = 'fallback_keyword_extraction';
                        }
                        result.addressPrefix = addressParts.slice(0, i).join(', ');
                        break;
                    }
                }
                
                // Nếu vẫn không tìm thấy, lấy phần đầu làm prefix
                if (!result.addressPrefix && addressParts.length > 0) {
                    result.addressPrefix = addressParts[0];
                }
            }
            
        } catch (error) {
            result.isValid = false;
            result.errors.push(`Lỗi phân tích địa chỉ: ${error.message}`);
        }

        return result;
    }

    /**
     * Trích xuất tên xã/phường từ chuỗi có chứa loại đơn vị hành chính
     * @param {string} wardPart - Phần chứa tên xã/phường
     * @returns {string} Tên xã/phường đã được làm sạch
     */
    extractWardName(wardPart) {
        // Loại bỏ các từ khóa loại đơn vị hành chính
        const cleanWard = wardPart
            .replace(/\b(commune|ward|xã|phường|thị trấn)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        return cleanWard;
    }

    /**
     * Làm sạch tên xã/phường để so sánh với database
     * @param {string} wardPart - Phần cần làm sạch
     * @returns {string} Tên đã được chuẩn hóa và bỏ dấu
     */
    cleanWardName(wardPart) {
        if (!wardPart) return '';
        
        // Bước 1: Loại bỏ các từ khóa đơn vị hành chính
        let cleaned = wardPart
            .replace(/\b(commune|ward|xã|phường|thị trấn|thị xã|town|district|huyện|quận|tỉnh|province|city|thành phố)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        // Bước 2: Bỏ dấu tiếng Việt
        cleaned = this.removeVietnameseTones(cleaned);
        
        // Bước 3: Chuẩn hóa thành slug format
        cleaned = cleaned
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '-')
            .replace(/^-+|-+$/g, '') // Loại bỏ dấu gạch đầu và cuối
            .trim();
        
        return cleaned;
    }

    /**
     * Bỏ dấu tiếng Việt từ chuỗi
     * @param {string} str - Chuỗi cần bỏ dấu
     * @returns {string} Chuỗi đã bỏ dấu
     */
    removeVietnameseTones(str) {
        if (!str) return '';
        
        return str
            .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
            .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
            .replace(/[ìíịỉĩ]/g, 'i')
            .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
            .replace(/[ùúụủũưừứựửữ]/g, 'u')
            .replace(/[ỳýỵỷỹ]/g, 'y')
            .replace(/đ/g, 'd')
            .replace(/[ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴ]/g, 'A')
            .replace(/[ÈÉẸẺẼÊỀẾỆỂỄ]/g, 'E')
            .replace(/[ÌÍỊỈĨ]/g, 'I')
            .replace(/[ÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠ]/g, 'O')
            .replace(/[ÙÚỤỦŨƯỪỨỰỬỮ]/g, 'U')
            .replace(/[ỲÝỴỶỸ]/g, 'Y')
            .replace(/Đ/g, 'D');
    }

    /**
     * Tìm kiếm xã/phường trong database xa_phuong.json
     * @param {string} cleanedName - Tên đã được làm sạch
     * @returns {Object|null} Thông tin xã/phường tìm được hoặc null
     */
    findWardInDatabase(cleanedName) {
        if (!cleanedName) return null;
        
        // Tìm trong xa_phuong.json
        for (const [code, ward] of Object.entries(this.oldWards)) {
            // So sánh với slug có sẵn
            if (ward.slug === cleanedName) {
                return { ...ward, code: code, matchType: 'slug_exact' };
            }
            
            // So sánh với name đã bỏ dấu
            const wardNameCleaned = this.removeVietnameseTones(ward.name)
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .replace(/\s+/g, '-')
                .replace(/^-+|-+$/g, '');
                
            if (wardNameCleaned === cleanedName) {
                return { ...ward, code: code, matchType: 'name_normalized' };
            }

            // So sánh gần đúng với độ tương đồng cao
            const similarity = this.calculateSimilarity(wardNameCleaned, cleanedName);
            if (similarity > 0.9) {
                return { 
                    ...ward, 
                    code: code, 
                    matchType: 'name_fuzzy',
                    similarity: similarity
                };
            }
        }
        
        return null;
    }

    /**
     * Tìm mapping xã/phường từ dữ liệu cũ sang mới
     * @param {string} wardName - Tên xã/phường
     * @param {string} districtName - Tên huyện/quận
     * @param {string} provinceName - Tên tỉnh/thành phố
     * @returns {Object|null} Mapping tìm được hoặc null
     */
    findWardMapping(wardName, districtName, provinceName) {
        if (!wardName || !districtName || !provinceName) {
            return null;
        }

        // Tìm mapping chính xác
        const exactMatch = this.wardMappings.find(mapping => {
            const wardMatch = this.compareNames(mapping.old_ward_name, wardName);
            const districtMatch = this.compareNames(mapping.old_district_name, districtName);
            const provinceMatch = this.compareNames(mapping.old_province_name, provinceName);
            
            return wardMatch && districtMatch && provinceMatch;
        });

        if (exactMatch) {
            return {
                ...exactMatch,
                matchType: 'exact',
                confidence: 1.0
            };
        }

        // Tìm mapping gần đúng (fuzzy matching)
        const fuzzyMatches = this.wardMappings.filter(mapping => {
            const wardSimilarity = this.calculateSimilarity(mapping.old_ward_name, wardName);
            const districtSimilarity = this.calculateSimilarity(mapping.old_district_name, districtName);
            const provinceSimilarity = this.calculateSimilarity(mapping.old_province_name, provinceName);
            
            return wardSimilarity > 0.7 && districtSimilarity > 0.7 && provinceSimilarity > 0.8;
        });

        if (fuzzyMatches.length > 0) {
            // Sắp xếp theo độ tương đồng và lấy kết quả tốt nhất
            const bestMatch = fuzzyMatches.sort((a, b) => {
                const scoreA = this.calculateSimilarity(a.old_ward_name, wardName) +
                              this.calculateSimilarity(a.old_district_name, districtName) +
                              this.calculateSimilarity(a.old_province_name, provinceName);
                const scoreB = this.calculateSimilarity(b.old_ward_name, wardName) +
                              this.calculateSimilarity(b.old_district_name, districtName) +
                              this.calculateSimilarity(b.old_province_name, provinceName);
                return scoreB - scoreA;
            })[0];

            const confidence = (
                this.calculateSimilarity(bestMatch.old_ward_name, wardName) +
                this.calculateSimilarity(bestMatch.old_district_name, districtName) +
                this.calculateSimilarity(bestMatch.old_province_name, provinceName)
            ) / 3;

            return {
                ...bestMatch,
                matchType: 'fuzzy',
                confidence: Math.round(confidence * 100) / 100
            };
        }

        return null;
    }

    /**
     * So sánh hai tên có giống nhau không (bỏ qua case và khoảng trắng)
     * @param {string} name1 - Tên thứ nhất
     * @param {string} name2 - Tên thứ hai
     * @returns {boolean} True nếu giống nhau
     */
    compareNames(name1, name2) {
        if (!name1 || !name2) return false;
        
        const normalize = (str) => str
            .toLowerCase()
            .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
            .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
            .replace(/[ìíịỉĩ]/g, 'i')
            .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
            .replace(/[ùúụủũưừứựửữ]/g, 'u')
            .replace(/[ỳýỵỷỹ]/g, 'y')
            .replace(/đ/g, 'd')
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        return normalize(name1) === normalize(name2);
    }

    /**
     * Tính độ tương đồng giữa hai chuỗi (0-1)
     * @param {string} str1 - Chuỗi thứ nhất
     * @param {string} str2 - Chuỗi thứ hai
     * @returns {number} Độ tương đồng từ 0 đến 1
     */
    calculateSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;
        if (str1 === str2) return 1;

        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        const editDistance = this.getEditDistance(longer, shorter);
        
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * Tính khoảng cách Levenshtein giữa hai chuỗi
     * @param {string} str1 - Chuỗi thứ nhất
     * @param {string} str2 - Chuỗi thứ hai
     * @returns {number} Khoảng cách chỉnh sửa
     */
    getEditDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    /**
     * Xây dựng địa chỉ mới theo định dạng không có huyện
     * @param {string} addressPrefix - Phần địa chỉ chi tiết
     * @param {string} newWardName - Tên xã/phường mới
     * @param {string} wardType - Loại xã/phường (xa, phuong)
     * @param {string} newProvinceName - Tên tỉnh/thành phố mới
     * @returns {string} Địa chỉ mới đã được định dạng
     */
    buildNewAddress(addressPrefix, newWardName, wardType, newProvinceName) {
        const parts = [];
        
        // Thêm phần địa chỉ chi tiết
        if (addressPrefix) {
            parts.push(addressPrefix);
        }
        
        // Thêm xã/phường với loại đơn vị hành chính bằng tiếng Anh
        const wardTypeEnglish = wardType === 'xa' ? 'Commune' : 
                               wardType === 'phuong' ? 'Ward' : 
                               'Town';
        parts.push(`${newWardName} ${wardTypeEnglish}`);
        
        // Thêm tỉnh/thành phố
        parts.push(`${newProvinceName} Province`);
        
        // Thêm "Viet Nam" ở cuối
        parts.push('Viet Nam');
        
        return parts.join(', ');
    }

    /**
     * Chuyển đổi một dự án từ định dạng cũ sang định dạng mới
     * @param {Object} project - Dự án cần chuyển đổi
     * @returns {Object} Kết quả chuyển đổi
     */
    convertProject(project) {
        const startTime = Date.now();
        
        // Giữ nguyên toàn bộ dữ liệu gốc
        const result = { ...project };
        
        try {
            // Phân tích địa chỉ
            const addressInfo = this.parseAddress(project.address, project.city, project.district);
            
            // Kiểm tra tính hợp lệ của dữ liệu đầu vào
            if (!addressInfo.isValid) {
                result.conversion_method = 'validation_failed';
                result.error_type = 'invalid_input_format';
                result.validation_errors = addressInfo.errors;
                result.processed_at = new Date().toISOString();
                result.processing_time_ms = Date.now() - startTime;
                return { type: 'invalid', data: result };
            }

            // Tìm mapping xã/phường
            let wardMapping = this.findWardMapping(
                addressInfo.ward,
                addressInfo.district,
                addressInfo.city
            );

            // Nếu không tìm thấy mapping nhưng có wardInfo từ database, thử tìm bằng thông tin database
            if (!wardMapping && addressInfo.wardInfo) {
                console.log(`🔍 Thử tìm mapping bằng thông tin từ database: ${addressInfo.wardInfo.name}`);
                wardMapping = this.findWardMapping(
                    addressInfo.wardInfo.name,
                    addressInfo.district,
                    addressInfo.city
                );
                
                // Hoặc thử với path_with_type để tìm district và province từ database
                if (!wardMapping && addressInfo.wardInfo.path_with_type) {
                    const pathParts = addressInfo.wardInfo.path_with_type.split(', ');
                    if (pathParts.length >= 3) {
                        const dbDistrict = pathParts[1].replace(/^(Huyện|Quận|Thành phố|Thị xã)\s/, '');
                        const dbProvince = pathParts[2].replace(/^(Tỉnh|Thành phố)\s/, '');
                        
                        wardMapping = this.findWardMapping(
                            addressInfo.wardInfo.name,
                            dbDistrict,
                            dbProvince
                        );
                        
                        if (wardMapping) {
                            console.log(`✅ Tìm thấy mapping sử dụng thông tin từ database path: ${addressInfo.wardInfo.path_with_type}`);
                        }
                    }
                }
            }

            if (!wardMapping) {
                // Không tìm thấy mapping
                result.conversion_method = 'không_tìm_thấy_mapping';
                result.missing_reason = 'Không tìm thấy xã/phường trong cơ sở dữ liệu mapping';
                result.missing_components = 'thiếu_mapping_xã_phường';
                result.available_province = addressInfo.city;
                result.available_district = addressInfo.district;
                result.extracted_ward = addressInfo.ward;
                result.ward_found_in_database = addressInfo.wardInfo ? true : false;
                result.database_ward_info = addressInfo.wardInfo;
                result.address_prefix = addressInfo.addressPrefix;
                result.match_method = addressInfo.matchMethod;
                result.processed_at = new Date().toISOString();
                result.processing_time_ms = Date.now() - startTime;
                result.notes = `Cần xem xét thủ công - không tìm thấy mapping${addressInfo.wardInfo ? ' (nhưng tìm thấy trong database xa_phuong.json)' : ''}`;
                return { type: 'missing', data: result };
            }

            // Chuyển đổi thành công
            const newWardInfo = this.newWards[wardMapping.new_ward_name];
            if (!newWardInfo) {
                // Mapping tìm thấy nhưng không có dữ liệu xã/phường mới
                result.conversion_method = 'mapping_found_but_no_new_ward_data';
                result.missing_reason = 'Không tìm thấy dữ liệu xã/phường mới';
                result.found_mapping = wardMapping;
                result.processed_at = new Date().toISOString();
                result.processing_time_ms = Date.now() - startTime;
                return { type: 'missing', data: result };
            }

            // Xây dựng địa chỉ mới
            const newAddress = this.buildNewAddress(
                addressInfo.addressPrefix,
                wardMapping.new_ward_name,
                newWardInfo.type,
                wardMapping.new_province_name
            );

            // Thêm thông tin chuyển đổi
            result.new_city = wardMapping.new_province_name;
            result.new_address = newAddress;
            result.conversion_method = wardMapping.matchType;
            result.old_ward_name = wardMapping.old_ward_name;
            result.old_district_name = wardMapping.old_district_name;
            result.old_province_name = wardMapping.old_province_name;
            result.new_ward_name = wardMapping.new_ward_name;
            result.new_ward_type = newWardInfo.type;
            result.new_ward_type_english = newWardInfo.type === 'xa' ? 'Commune' : 'Ward';
            result.new_province_name = wardMapping.new_province_name;
            result.address_prefix = addressInfo.addressPrefix;
            result.confidence_score = wardMapping.confidence;
            result.mapping_source = 'ward_mappings.json';
            result.processed_at = new Date().toISOString();
            result.processing_time_ms = Date.now() - startTime;
            result.validation_passed = 'Yes';
            result.notes = `Chuyển đổi thành công sử dụng ${wardMapping.matchType === 'exact' ? 'mapping chính xác' : 'mapping gần đúng'}`;

            return { type: 'success', data: result };

        } catch (error) {
            // Lỗi trong quá trình xử lý
            result.conversion_method = 'processing_error';
            result.error_type = 'processing_exception';
            result.error_message = error.message;
            result.processed_at = new Date().toISOString();
            result.processing_time_ms = Date.now() - startTime;
            return { type: 'invalid', data: result };
        }
    }

    /**
     * Chuyển đổi tất cả dự án và phân loại kết quả
     */
    async convertAllProjects() {
        console.log('\n🔄 Bắt đầu chuyển đổi dữ liệu...');
        
        let processedCount = 0;
        const totalCount = this.projects.length;
        
        for (const project of this.projects.splice(0, 10)) {
            try {
                const conversionResult = this.convertProject(project);
                
                // Phân loại kết quả
                switch (conversionResult.type) {
                    case 'success':
                        this.results.success.push(conversionResult.data);
                        this.statistics.successCount++;
                        
                        // Cập nhật thống kê chi tiết
                        if (conversionResult.data.conversion_method === 'exact') {
                            this.statistics.exactMatches++;
                        } else if (conversionResult.data.conversion_method === 'fuzzy') {
                            this.statistics.fuzzyMatches++;
                        }
                        
                        if (conversionResult.data.confidence_score === 1.0) {
                            this.statistics.highConfidence++;
                        } else if (conversionResult.data.confidence_score >= 0.7) {
                            this.statistics.mediumConfidence++;
                        }
                        break;
                        
                    case 'missing':
                        this.results.missingInfo.push(conversionResult.data);
                        this.statistics.missingInfoCount++;
                        break;
                        
                    case 'invalid':
                        this.results.invalidInput.push(conversionResult.data);
                        this.statistics.invalidInputCount++;
                        break;
                }
                
                processedCount++;
                
                // Log tiến trình mỗi 100 bản ghi
                if (processedCount % 100 === 0) {
                    const percent = Math.round((processedCount / totalCount) * 100);
                    console.log(`⏳ Đã xử lý ${processedCount}/${totalCount} dự án (${percent}%)`);
                }
                
            } catch (error) {
                console.error(`❌ Lỗi khi xử lý dự án ${project.id}:`, error.message);
                
                // Thêm vào danh sách lỗi
                const errorResult = { 
                    ...project,
                    error_type: 'unexpected_error',
                    error_message: error.message,
                    processed_at: new Date().toISOString()
                };
                this.results.invalidInput.push(errorResult);
                this.statistics.invalidInputCount++;
            }
        }
        
        console.log(`✅ Hoàn thành xử lý ${processedCount} dự án`);
    }

    /**
     * Tạo báo cáo thống kê
     */
    generateSummaryReport() {
        const summary = [
            {
                metric: 'Total Records',
                value: this.statistics.totalRecords,
                percentage: '100%',
                description: 'Tổng số dự án được xử lý'
            },
            {
                metric: 'Successful Conversions',
                value: this.statistics.successCount,
                percentage: `${Math.round((this.statistics.successCount / this.statistics.totalRecords) * 100)}%`,
                description: 'Dự án chuyển đổi thành công'
            },
            {
                metric: 'Missing Info Cases',
                value: this.statistics.missingInfoCount,
                percentage: `${Math.round((this.statistics.missingInfoCount / this.statistics.totalRecords) * 100)}%`,
                description: 'Dự án thiếu thông tin để chuyển đổi'
            },
            {
                metric: 'Invalid Input Cases',
                value: this.statistics.invalidInputCount,
                percentage: `${Math.round((this.statistics.invalidInputCount / this.statistics.totalRecords) * 100)}%`,
                description: 'Dự án có dữ liệu đầu vào không hợp lệ'
            },
            {
                metric: 'Exact Ward Mapping',
                value: this.statistics.exactMatches,
                percentage: `${Math.round((this.statistics.exactMatches / this.statistics.totalRecords) * 100)}%`,
                description: 'Sử dụng mapping chính xác từ cơ sở dữ liệu'
            },
            {
                metric: 'Fuzzy Match Method',
                value: this.statistics.fuzzyMatches,
                percentage: `${Math.round((this.statistics.fuzzyMatches / this.statistics.totalRecords) * 100)}%`,
                description: 'Sử dụng thuật toán so khớp gần đúng'
            },
            {
                metric: 'High Confidence (1.0)',
                value: this.statistics.highConfidence,
                percentage: `${Math.round((this.statistics.highConfidence / this.statistics.totalRecords) * 100)}%`,
                description: 'Chuyển đổi với độ tin cậy cao'
            },
            {
                metric: 'Medium Confidence (0.7-0.99)',
                value: this.statistics.mediumConfidence,
                percentage: `${Math.round((this.statistics.mediumConfidence / this.statistics.totalRecords) * 100)}%`,
                description: 'Chuyển đổi với độ tin cậy trung bình'
            }
        ];

        return summary;
    }

    /**
     * Xuất kết quả ra các file JSON
     */
    async exportResults() {
        try {
            console.log('\n📝 Đang xuất kết quả...');
            
            // Tạo thư mục kết quả nếu chưa có
            const outputDir = path.join(__dirname, '../convert-data');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // Xuất file chuyển đổi thành công
            const successFile = path.join(outputDir, 'conversion_success.json');
            fs.writeFileSync(successFile, JSON.stringify(this.results.success, null, 2), 'utf8');
            console.log(`✅ Đã xuất ${this.results.success.length} dự án thành công vào: conversion_success.json`);

            // Xuất file thiếu thông tin
            const missingFile = path.join(outputDir, 'missing_info.json');
            fs.writeFileSync(missingFile, JSON.stringify(this.results.missingInfo, null, 2), 'utf8');
            console.log(`✅ Đã xuất ${this.results.missingInfo.length} dự án thiếu thông tin vào: missing_info.json`);

            // Xuất file dữ liệu không hợp lệ
            const invalidFile = path.join(outputDir, 'invalid_input.json');
            fs.writeFileSync(invalidFile, JSON.stringify(this.results.invalidInput, null, 2), 'utf8');
            console.log(`✅ Đã xuất ${this.results.invalidInput.length} dự án không hợp lệ vào: invalid_input.json`);

            // Xuất báo cáo thống kê
            const summaryFile = path.join(outputDir, 'processing_summary.json');
            const summaryReport = this.generateSummaryReport();
            fs.writeFileSync(summaryFile, JSON.stringify(summaryReport, null, 2), 'utf8');
            console.log(`✅ Đã xuất báo cáo thống kê vào: processing_summary.json`);

            console.log(`\n📊 Kết quả tổng hợp:`);
            console.log(`   🎯 Thành công: ${this.statistics.successCount} dự án`);
            console.log(`   ⚠️  Thiếu thông tin: ${this.statistics.missingInfoCount} dự án`);
            console.log(`   ❌ Dữ liệu không hợp lệ: ${this.statistics.invalidInputCount} dự án`);
            console.log(`   📈 Tỷ lệ thành công: ${Math.round((this.statistics.successCount / this.statistics.totalRecords) * 100)}%`);

        } catch (error) {
            console.error('❌ Lỗi khi xuất kết quả:', error.message);
            throw error;
        }
    }

    /**
     * Chạy toàn bộ quá trình chuyển đổi
     */
    async run() {
        try {
            console.log('🚀 Bắt đầu quá trình chuyển đổi địa chỉ...\n');
            
            // Khởi tạo dữ liệu
            await this.initialize();
            
            // Chuyển đổi tất cả dự án
            await this.convertAllProjects();
            
            // Xuất kết quả
            await this.exportResults();
            
            console.log('\n🎉 Hoàn thành quá trình chuyển đổi địa chỉ!');
            
        } catch (error) {
            console.error('💥 Lỗi nghiêm trọng:', error.message);
            throw error;
        }
    }
}

// Export class để sử dụng ở nơi khác
module.exports = AddressConverter;

// Chạy trực tiếp nếu file được gọi trực tiếp
if (require.main === module) {
    const converter = new AddressConverter();
    converter.run().catch(error => {
        console.error('💥 Quá trình chuyển đổi thất bại:', error);
        process.exit(1);
    });
}
