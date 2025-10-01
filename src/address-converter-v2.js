const fs = require("fs");
const { readJSONFileSync } = require('./file-reader');

// Hằng số cho các file dữ liệu
const DATA_FILES = {
  PROVINCES: './data/tinh_tp.json',
  DISTRICTS: './data/quan_huyen.json',
  COMMUNES: './data/xa_phuong.json',
  WARD_MAPPINGS: './data/ward_mappings.json',
  WARDS_NEW: './data/ward.json',
  PROVINCES_NEW: './data/province.json'
};

// Hằng số cho các từ khóa địa chỉ
const ADDRESS_KEYWORDS = [
  'province', 'district', 'commune', 'ward', 'city',
  'thành phố', 'tỉnh', 'huyện', 'xã', 'TP', 'phường',
  'cit', 'thị xã'
];

// Hằng số cho quốc gia
const COUNTRY_KEYWORDS = ['vietnam', 'viet nam', 'vn'];
const COUNTRY_NAME = 'Việt Nam';

const ADMINISTRATIVE_LEVELS = {
  "tinh": "Province",
  "thanh-pho": "City",
  "huyen": "District",
  "quan": "Urban District",
  "xa": "Commune",
  "thi-tran": "Township",
  "phuong": "Ward",
  "thi-xa": "Town",
  "huyen-van-hoa": "Cultural District"
};

// Tải dữ liệu địa lý và ward mappings (chỉ tải một lần)
const provinces = readJSONFileSync(DATA_FILES.PROVINCES);
const districts = readJSONFileSync(DATA_FILES.DISTRICTS);
const communes = readJSONFileSync(DATA_FILES.COMMUNES);
const wards = readJSONFileSync(DATA_FILES.WARDS_NEW);
const provincesNew = readJSONFileSync(DATA_FILES.PROVINCES_NEW);

const wardMappings = readJSONFileSync(DATA_FILES.WARD_MAPPINGS);


/**
 * Chuyển chuỗi tiếng Việt về dạng không dấu và viết thường
 * @param {string} str - Chuỗi cần chuyển đổi
 * @returns {string} Chuỗi đã được chuẩn hóa
 */
function normalizeVietnameseString(str) {
  if (!str) return '';

  let normalized = str.toLowerCase();
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Loại bỏ dấu
  normalized = normalized.replace(/đ/g, 'd'); // Thay thế đ thành d
  return normalized;
}

/**
 * Làm sạch phần địa chỉ - loại bỏ từ khóa và khoảng trắng thừa
 * @param {string} part - Phần địa chỉ cần làm sạch
 * @returns {string} Phần địa chỉ đã được làm sạch
 */
function cleanAddressPart(part) {
  if (!part) return '';

  // Tạo regex pattern từ các từ khóa địa chỉ
  const keywordPattern = new RegExp(`(${ADDRESS_KEYWORDS.join('|')})`, 'gi');

  return part
    .replace(keywordPattern, '') // Loại bỏ từ khóa địa chỉ
    .replace(/\s+/g, ' ') // Chuẩn hóa khoảng trắng
    .replace(/,\s*,/g, ',') // Loại bỏ dấu phẩy thừa
    .replace(/\./g, '') // Loại bỏ dấu chấm thừa
    .trim();
}

/**
 * Tìm kiếm đối tượng địa lý trong dữ liệu
 * @param {string} searchString - Chuỗi cần tìm kiếm
 * @param {Object} data - Dữ liệu địa lý
 * @returns {Object|null} Đối tượng tìm thấy hoặc null
 */
function findGeographicEntity(searchString, data) {
  if (!searchString || !data) return null;

  const normalizedSearch = normalizeVietnameseString(searchString);

  return Object.values(data).find(entity =>
    normalizeVietnameseString(entity.name) === normalizedSearch ||
    normalizeVietnameseString(entity.name_with_type) === normalizedSearch
  );
}

/**
 * Tìm kiếm mapping mới từ ward_mappings.json với điều kiện kèm theo
 * @param {Object} entity - Đối tượng địa lý đã tìm thấy
 * @param {Array} wardMappings - Danh sách mapping từ ward_mappings.json
 * @param {Object} previousEntity - Đối tượng địa lý đã xác định trước đó
 * @returns {Object|null} Thông tin mapping mới hoặc null
 */
function findWardMapping(entity, wardMappings, previousEntity = null) {
  if (!entity || !wardMappings || !Array.isArray(wardMappings)) return null;

  // Tìm kiếm với điều kiện kèm theo từ đối tượng đã xác định trước
  if (previousEntity) {
    // Nếu đã có tỉnh, tìm mapping với điều kiện old_province_name phải khớp với tỉnh đã xác định
    if (previousEntity.parent_code === undefined) {
      const mappingWithProvinceCondition = wardMappings.find(mapping => {

        // Kiểm tra khớp tên entity với các trường mapping
        const nameMatches = entity.name_with_type === mapping.old_province_name ||
          entity.name_with_type === mapping.old_district_name ||
          entity.name_with_type === mapping.old_ward_name;

        // Kiểm tra old_province_name có khớp với tỉnh đã xác định
        const provinceMatches = mapping.old_province_name === previousEntity.name_with_type;

        return nameMatches && provinceMatches;
      });

      if (mappingWithProvinceCondition) return mappingWithProvinceCondition;
    }

    // Nếu đã có huyện, tìm mapping với điều kiện old_district_name phải khớp với huyện đã xác định
    if (previousEntity.parent_code && previousEntity.path_with_type.split(",").length == 2) {
      const mappingWithDistrictCondition = wardMappings.find(mapping => {

        // Kiểm tra khớp tên entity với các trường mapping
        const nameMatches = entity.name_with_type === mapping.old_district_name ||
          entity.name_with_type === mapping.old_ward_name;

        // Kiểm tra old_district_name có khớp với huyện đã xác định
        const districtMatches = mapping.old_district_name === previousEntity.name_with_type;

        return nameMatches && districtMatches;
      });

      if (mappingWithDistrictCondition) return mappingWithDistrictCondition;
    }
  }

  // Nếu không có previousEntity hoặc không tìm thấy với điều kiện, tìm kiếm bình thường
  const foundMapping = wardMappings.find(mapping => {

    // Xác định loại entity và so sánh với trường tương ứng
    if (entity.parent_code && entity.path_with_type.split(",").length == 3) {

      // Đối với phường/xã: chỉ so sánh với old_ward_name
      const isWardMatch = entity.name_with_type == mapping.old_ward_name;

      return isWardMatch;
    } else if (entity.parent_code === undefined) {

      // Đối với tỉnh/thành phố: chỉ so sánh với old_province_name
      const isProvinceMatch = entity.name_with_type === mapping.old_province_name;

      return isProvinceMatch;
    }

    // Không phải loại entity được hỗ trợ
    return false;
  });

  return foundMapping || null;
}

/**
 * Cập nhật đối tượng địa lý với thông tin mapping mới
 * @param {Object} entity - Đối tượng địa lý gốc
 * @param {Object} mapping - Thông tin mapping từ ward_mappings.json
 * @returns {Object} Đối tượng đã được cập nhật
 */
function enhanceEntityWithMapping(entity, mapping) {
  if (!entity || !mapping) return entity;

  // Xác định mapped_name dựa trên loại entity
  let mapped_name;
  if (entity.parent_code && entity.path_with_type.split(",").length == 2) {
    // Nếu là phường/xã: trả về tên phường mới
    mapped_name = mapping.new_ward_name;
  } else if (entity.parent_code === undefined) {
    // Nếu là tỉnh/thành phố: trả về tên tỉnh mới
    mapped_name = mapping.new_province_name;
  } else {
    // Mặc định trả về tên phường mới (giữ nguyên logic cũ)
    mapped_name = mapping.new_ward_name;
  }

  return {
    ...entity,
    mapped_name: mapped_name,
    original_name: entity.name,
    is_mapped: true,
    mapping_info: {
      old_ward_name: mapping.old_ward_name,
      old_district_name: mapping.old_district_name,
      old_province_name: mapping.old_province_name,
      new_ward_name: mapping.new_ward_name,
      new_province_name: mapping.new_province_name
    }
  };
}

/**
 * Kiểm tra và trả về thông tin quốc gia nếu phù hợp
 * @param {string} searchString - Chuỗi cần kiểm tra
 * @returns {Object|null} Thông tin quốc gia hoặc null
 */
function checkForCountry(searchString) {
  const normalizedSearch = normalizeVietnameseString(searchString);

  if (COUNTRY_KEYWORDS.includes(normalizedSearch)) {
    return {
      type: 'Quốc gia',
      name: COUNTRY_NAME,
      path_with_type: COUNTRY_NAME
    };
  }
  return null;
}

/**
 * Xác định loại địa chỉ từ một phần địa chỉ với điều kiện kèm theo
 * @param {string} addressPart - Phần địa chỉ cần xác định
 * @param {Object} previousEntity - Đối tượng địa lý đã xác định trước đó
 * @returns {Object} Thông tin địa chỉ đã được xác định
 */
function identifyAddressType(addressPart, previousEntity = null) {
  if (!addressPart) {
    return { type: 'null', name: addressPart, path_with_type: null };
  }

  // Làm sạch phần địa chỉ
  const cleanedPart = cleanAddressPart(addressPart);

  // Kiểm tra xem có phải là quốc gia không
  const countryInfo = checkForCountry(cleanedPart);
  if (countryInfo) return countryInfo;

  // Tìm kiếm với điều kiện kèm theo từ đối tượng đã xác định trước
  if (previousEntity) {
    // Nếu đã có tỉnh, tìm huyện với điều kiện parent_code phải khớp với mã tỉnh
    if (previousEntity.parent_code === undefined) {
      const district = Object.values(districts).find(entity => {
        const normalizedSearch = normalizeVietnameseString(cleanedPart);
        const normalizedName = normalizeVietnameseString(entity.name);
        const normalizedNameWithType = normalizeVietnameseString(entity.name_with_type || '');

        // Kiểm tra khớp tên
        const nameMatches = normalizedName === normalizedSearch ||
          normalizedNameWithType === normalizedSearch;

        // Kiểm tra parent_code có khớp với mã tỉnh đã xác định
        const parentCodeMatches = entity.parent_code &&
          entity.parent_code === previousEntity.code;

        return nameMatches && parentCodeMatches;
      });

      if (district) return district;
    }

    // Nếu đã có huyện, tìm xã với điều kiện parent_code phải khớp với mã huyện
    if (previousEntity.parent_code && previousEntity.path_with_type.split(",").length == 2) {
      const commune = Object.values(communes).find(entity => {
        const normalizedSearch = normalizeVietnameseString(cleanedPart);
        const normalizedName = normalizeVietnameseString(entity.name);
        const normalizedNameWithType = normalizeVietnameseString(entity.name_with_type || '');

        // Kiểm tra khớp tên
        const nameMatches = normalizedName === normalizedSearch ||
          normalizedNameWithType === normalizedSearch;

        // Kiểm tra parent_code có khớp với mã huyện đã xác định
        const parentCodeMatches = entity.parent_code &&
          entity.parent_code === previousEntity.code;

        return nameMatches && parentCodeMatches;
      });

      if (commune) {
        // Kiểm tra và cập nhật thông tin xã/phường nếu có mapping
        const communeMapping = findWardMapping(commune, wardMappings, previousEntity);
        if (communeMapping) {
          return enhanceEntityWithMapping(commune, communeMapping);
        }
        return commune;
      }
    }
  }

  // Nếu không có previousEntity hoặc không tìm thấy với điều kiện, tìm kiếm bình thường
  // Tìm kiếm theo thứ tự: tỉnh/thành phố -> quận/huyện -> xã/phường
  const province = findGeographicEntity(cleanedPart, provinces);
  if (province) {
    // Kiểm tra và cập nhật thông tin tỉnh nếu có mapping
    const provinceMapping = findWardMapping(province, wardMappings, previousEntity);
    if (provinceMapping) {
      return enhanceEntityWithMapping(province, provinceMapping);
    }
    return province;
  }

  const district = findGeographicEntity(cleanedPart, districts);
  if (district) return district;

  const commune = findGeographicEntity(cleanedPart, communes);
  if (commune) {
    // Kiểm tra và cập nhật thông tin xã/phường nếu có mapping
    const communeMapping = findWardMapping(commune, wardMappings, previousEntity);
    if (communeMapping) {
      return enhanceEntityWithMapping(commune, communeMapping);
    }
    return commune;
  }

  // Không tìm thấy kết quả phù hợp
  return { type: 'null', name: addressPart, path_with_type: null };
}

/**
 * Chuẩn hóa địa chỉ của một bản ghi dự án
 * @param {Object} project - Bản ghi dự án cần chuẩn hóa
 * @returns {Object} Bản ghi đã được chuẩn hóa
 */
function normalizeProjectAddress(project) {
  if (!project || !project.address) {
    return { ...project, raw: [], new_address: '' };
  }

  // Tách địa chỉ thành các phần
  const addressParts = project.address.split(',');

  // Xác định loại cho từng phần địa chỉ từ CUỐI CHUỖI LÊN
  const normalizedParts = [];
  let previousEntity = null;

  // Duyệt từ cuối mảng lên đầu (từ cuối chuỗi lên)
  for (let i = addressParts.length - 1; i >= 0; i--) {
    const part = addressParts[i];

    // Xác định loại địa chỉ với điều kiện kèm theo từ đối tượng đã xác định trước
    const identifiedEntity = identifyAddressType(part, previousEntity);
    normalizedParts.unshift(identifiedEntity); // Thêm vào đầu để giữ thứ tự ban đầu

    // Cập nhật previousEntity nếu tìm thấy đối tượng hợp lệ (không phải null)
    if (identifiedEntity.type !== 'null' && identifiedEntity.type !== 'Quốc gia') {
      previousEntity = identifiedEntity;
    }
  }

  // Tạo new_address từ list raw
  const addressComponents = normalizedParts
    .filter(part => {
      // Loại bỏ các phần có type là "huyen" (huyện)
      return !(part.parent_code && part.path_with_type.split(",").length == 2);
    })
    .map(part => {
      let mapped_name_new = '';
      let map_type = part.type;

      if (part.parent_code && part.path_with_type.split(",").length == 3 && part.mapped_name) {
        const findWard = Object.values(wards).find(w => w.name_with_type.includes(part.mapped_name));
        if (findWard) {
          mapped_name_new = findWard.name;
          map_type = findWard.type;
        }
      }

      if (part.parent_code == undefined && part.mapped_name) {
        const findProvincesNew = Object.values(provinces).find(w => w.name_with_type.includes(part.mapped_name));
        if (findProvincesNew) {
          mapped_name_new = findProvincesNew.name;
          map_type = findProvincesNew.type;
        }
      }

      if (!mapped_name_new && part.original_name) {
        mapped_name_new = part.original_name;
      }

      if (mapped_name_new && ADMINISTRATIVE_LEVELS[map_type]) {
        return mapped_name_new.normalize('NFD').replace(/[\u0300-\u036f]/g, '') + ' ' + ADMINISTRATIVE_LEVELS[map_type];
      }

      return mapped_name_new || part.name_with_type || part.name;
    })
    .filter(name => name && name.trim() !== ''); // Loại bỏ các giá trị rỗng

  const new_address = addressComponents.join(', ');

  // Cập nhật city dựa trên giá trị mới từ raw
  let new_city = project.city;

  // Tìm phần tử tỉnh/thành phố trong raw (có type là 'tinh' hoặc 'thanh-pho')
  const provincePart = normalizedParts.find(part => part.parent_code === undefined && part.mapped_name);

  // Nếu tìm thấy tỉnh/thành phố và có mapped_name, cập nhật city
  if (provincePart && provincePart.mapped_name) {
    new_city = provincePart.mapped_name;
  }

  return {
    ...project,
    id: project.id,
    city: project.city,
    new_city: new_city,
    address: project.address,
    new_address: new_address,
    district: project.district,
    raw: normalizedParts,
  };
}

/**
 * Chuẩn hóa toàn bộ danh sách dự án
 * @param {Array} projects - Danh sách dự án cần chuẩn hóa
 * @param {number} limit - Số lượng bản ghi tối đa cần xử lý (tùy chọn)
 * @returns {Array} Danh sách dự án đã được chuẩn hóa
 */
function normalizeAllProjects(projects, limit = null) {
  if (!Array.isArray(projects)) {
    console.error('❌ Dữ liệu đầu vào không phải là mảng');
    return [];
  }
  // const startIdx = 71;
  // limit = 1
  const projectsToProcess = limit ? projects.slice(startIdx, startIdx + limit) : projects;

  console.log(`🔄 Đang chuẩn hóa ${projectsToProcess.length} bản ghi...`);

  return projectsToProcess.map(project => normalizeProjectAddress(project));
}

/**
 * Lưu kết quả chuẩn hóa vào file JSON
 * @param {Array} normalizedData - Dữ liệu đã chuẩn hóa
 * @param {string} outputPath - Đường dẫn file đầu ra
 */
function saveNormalizedData(normalizedData, outputPath = 'normalized_projects.json') {
  try {
    fs.writeFileSync(outputPath, JSON.stringify(normalizedData, null, 2), 'utf8');
    console.log(`✅ Đã lưu ${normalizedData.length} bản ghi vào ${outputPath}`);
  } catch (error) {
    console.error('❌ Lỗi khi lưu file:', error.message);
  }
}

// Hàm chính để chạy quá trình chuẩn hóa
function main() {
  try {
    // Đọc dữ liệu dự án từ file
    const rawData = fs.readFileSync('./data/projects.json', 'utf8');
    const projects = JSON.parse(rawData);

    // Chuẩn hóa dữ liệu (giới hạn 10 bản ghi để demo)
    const normalizedProjects = normalizeAllProjects(projects);

    // Lưu kết quả
    saveNormalizedData(normalizedProjects);

  } catch (error) {
    console.error('❌ Lỗi trong quá trình xử lý:', error.message);
  }
}

// Chạy chương trình
if (require.main === module) {
  main();
}

module.exports = {
  normalizeVietnameseString,
  cleanAddressPart,
  findGeographicEntity,
  findWardMapping,
  enhanceEntityWithMapping,
  identifyAddressType,
  normalizeProjectAddress,
  normalizeAllProjects,
  saveNormalizedData
};
