const fs = require("fs");
const { readJSONFileSync } = require('./file-reader');
const { log } = require("console");
const { type } = require("os");
const { isMap } = require("util/types");
const { json } = require("stream/consumers");

// Hằng số cho các file dữ liệu
const DATA_FILES = {
  PROVINCES: './data/tinh_tp.json',
  DISTRICTS: './data/quan_huyen.json',
  COMMUNES: './data/xa_phuong.json',
  WARD_MAPPINGS: './data/ward_mappings.json',
  WARDS_NEW: './data/ward.json',
  PROVINCES_NEW: './data/province.json'
};

// Tải dữ liệu địa lý và ward mappings (chỉ tải một lần)
const provinces = readJSONFileSync(DATA_FILES.PROVINCES);
const districts = readJSONFileSync(DATA_FILES.DISTRICTS);
const communes = readJSONFileSync(DATA_FILES.COMMUNES);
const wards = readJSONFileSync(DATA_FILES.WARDS_NEW);
const provincesNew = readJSONFileSync(DATA_FILES.PROVINCES_NEW);
const wardMappings = readJSONFileSync(DATA_FILES.WARD_MAPPINGS);

const ADMINISTRATIVE_LEVELS = {
  "tinh": "Province",
  "thanh-pho": "City",
  "huyen": "District",
  "quan": "Urban District",
  "xa": "Commune",
  "thi-tran": "Township",
  "phuong": "Ward",
  "thi-xa": "Town",
  "huyen-van-hoa": "Cultural District",
  "country": "Country",
};

// Danh sách keywords cần loại bỏ
const ADDRESS_KEYWORDS = [
  'province vietnam', 'province', 'district', 'commune', 'ward', 'city',
  'thanh pho', 'tinh', 'huyen', 'xa', 'TP', 'phuong',
  'cit', 'thi xa', 'thi tran', 'quan',
];

// Hằng số cho quốc gia
const COUNTRY_KEYWORDS = ['vietnam', 'viet nam', 'vn'];
const COUNTRY_NAME = 'Việt Nam';

// ===============================================================================================

function removeVietnameseTones(str) {
  str = str.toLowerCase();
  str = str
    .normalize("NFD") // tách dấu khỏi ký tự
    .replace(/[\u0300-\u036f]/g, ""); // xóa dấu

  // thay đ/Đ thành d
  str = str.replace(/đ/g, "d").replace(/Đ/g, "d");

  // loại bỏ các ký tự đặc biệt, khoảng trắng thừa
  str = str.replace(/[^a-z0-9\s]/g, "");
  str = str.replace(/\s+/g, " ").trim();

  return str;
}

function cleanAddress(input) {
  if (!input || typeof input !== "string") return input;

  let original = input.trim();
  let str = removeVietnameseTones(original)
    .toLowerCase()
    .replace(/\s+/g, " "); // bỏ khoảng trắng thừa

  // Tạo regex loại bỏ ở đầu hoặc giữa câu (dùng word boundary)
  for (let key of ADDRESS_KEYWORDS) {
    let regex = new RegExp("\\b" + key + "\\b", "gi");
    str = str.replace(regex, "");
  }

  // Bỏ khoảng trắng thừa sau khi xóa
  str = str.replace(/\s+/g, " ") // Loại bỏ khoảng trắng thừa
    .replace(/,\s*,/g, ',') // Loại bỏ dấu phẩy thừa
    .replace(/\./g, '') // Loại bỏ dấu chấm thừa
    .trim();

  // Nếu sau khi xử lý rỗng thì trả về ban đầu
  if (!str) return original;

  return str;
}

function capitalizeWords(str) {
  if (!str || typeof str !== "string") return str;

  return str
    .toLowerCase()
    .replace(/\s+/g, " ") // bỏ khoảng trắng thừa
    .trim()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function checkForCountry(searchString) {
  const normalizedSearch = removeVietnameseTones(searchString);

  if (COUNTRY_KEYWORDS.includes(normalizedSearch)) {
    return {
      type: 'country',
      slug: 'viet-nam',
      name: COUNTRY_NAME,
      path_with_type: COUNTRY_NAME,
      code: "000"
    };
  }
  return null;
}

function removeVietnameseTones(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d");
}

function removeOfficialPrefix(input) {
  if (!input || typeof input !== "string") return input;

  let original = input.trim();

  // Các từ khóa hành chính chính thức
  const prefixes = [
    "tinh",
    "thanh pho",
    "huyen",
    "quan",
    "thi xa",
    "xa",
    "phuong",
    "thi tran"
  ];

  // Chuỗi bỏ dấu để so sánh
  let clean = removeVietnameseTones(original).toLowerCase().trim();

  for (let prefix of prefixes) {
    if (clean.startsWith(prefix)) {
      // tạo regex dựa trên prefix bỏ dấu nhưng cho phép có dấu + hoa/thường
      let regex = new RegExp("^" + prefix.replace(" ", "\\s+") + "\\s+", "i");
      return clean.replace(regex, "").trim();
    }
  }

  return clean;
}


const appendLevelSlug = (type, slug) => {
  if (!slug || typeof slug !== "string") return slug;

  const slugNormalized = slug.toLowerCase().replace(/-/g, " ");

  const eng = ADMINISTRATIVE_LEVELS[type];
  if (!eng) return slug; // nếu không tìm thấy level thì giữ nguyên

  const result = `${slugNormalized} ${eng}`;

  return result;
}

const normalizeAddressInfo = (level, addressInfo, part, previousPart) => {

  let isMapAddress = false;
  let matched = null;
  let addressMap = null;

  if (level != "unknown") {

    // Giá trị map theo tỉnh
    if (level == "province") {
      matched = wardMappings.find(p =>
        removeOfficialPrefix(p.old_province_name) === addressInfo.slug.toLowerCase().replace(/-/g, " ")
      );
      if (matched) {
        isMapAddress = true;
        addressMap = appendLevelSlug(addressInfo.type, removeOfficialPrefix(matched.new_province_name));
      }
    } else if (level == "district") {
      // Tìm trong ward mappings
      matched = wardMappings.find(wm =>
        removeOfficialPrefix(wm.old_district_name?.toLowerCase()) === addressInfo.slug.toLowerCase().replace(/-/g, " ")
        && (
          !previousPart
          || (
            previousPart.level == "province"
            && removeOfficialPrefix(wm.old_province_name?.toLowerCase()) === previousPart.addressInfo.slug.toLowerCase().replace(/-/g, " ")
          )
        )
      );
      if (matched) {
        isMapAddress = true;
        addressMap = appendLevelSlug(addressInfo.type, removeOfficialPrefix(matched.new_province_name));
      }

    } else if (level == "commune") {
      // Tìm trong ward mappings
      matched = wardMappings.find(wm =>
        removeOfficialPrefix(wm.old_ward_name?.toLowerCase()) === addressInfo.slug.toLowerCase().replace(/-/g, " ")
        && (
          !previousPart
          || (
            previousPart.level == "district"
            && removeOfficialPrefix(wm.old_district_name?.toLowerCase()) === previousPart.addressInfo.slug.toLowerCase().replace(/-/g, " ")
          )
          || (
            previousPart.level == "province"
            && removeOfficialPrefix(wm.old_province_name?.toLowerCase()) === previousPart.addressInfo.slug.toLowerCase().replace(/-/g, " ")
          )
        )
      );
      if (matched) {
        isMapAddress = true;
        addressMap = appendLevelSlug(addressInfo.type, removeOfficialPrefix(matched.new_ward_name));
      }
    }
  }
  return {
    level: level,
    part: part,
    address_map: addressMap,
    addressInfoMap: matched,
    addressInfo: addressInfo
  };
}

const findAddressPart = (part, previousPart) => {
  let cleanedPart = cleanAddress(part);
  let found = null;
  // Kiểm tra có phải quốc gia không
  found = checkForCountry(cleanedPart);
  if (found) return normalizeAddressInfo("country", found, part, previousPart);

  // Tìm trong danh sách tỉnh
  found = Object.values(provinces).find(p => p.slug.replace(/-/g, " ") === cleanedPart);
  if (found && !previousPart) return normalizeAddressInfo("province", found, part, previousPart);

  // Tìm trong danh sách huyện
  found = Object.values(districts).find(d =>
    d.slug.replace(/-/g, " ") === cleanedPart
    && (
      !previousPart
      || (previousPart.level == "province" && d.parent_code == previousPart?.addressInfo?.code)
    )
  );
  if (found && (!previousPart || previousPart.level != "district" || previousPart.level != "commune")) return normalizeAddressInfo("district", found, part, previousPart);

  // Tìm trong danh sách xã
  found = Object.values(communes).find(c =>
    c.slug.replace(/-/g, " ") === cleanedPart
    && (
      !previousPart
      || (previousPart.level == "district" && c.parent_code == previousPart?.addressInfo?.code)
      || (previousPart.level == "province" && Object.values(districts).find(p => p.code === c.parent_code)?.parent_code == previousPart?.addressInfo?.code)
    )
  );
  if (found) return normalizeAddressInfo("commune", found, part, previousPart);

  return normalizeAddressInfo("unknown", {
    name: part,
    code: null,
    slug: cleanedPart.replace(" ", "-"),
    type: "unknown",
    name_with_type: part
  }, part, previousPart);
};

const saveResultsToFile = (filename, data) => {
  try {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`Results saved to ${filename}`);
  } catch (error) {
    console.error(`Error saving results to ${filename}:`, error);
  }
};

const convertAddressV3 = (input) => {
  if (!input || typeof input !== "string") return null;

  // Tách chuỗi theo dấu phẩy, đảo ngược thứ tự các phần
  const reversedParts = input.split(',').reverse();

  // Duyệt từng phần, làm sạch và tìm kiếm trong dữ liệu địa lý
  let previousPart = null;
  let findedParts = [];
  for (let part of reversedParts) {
    let found = findAddressPart(part, previousPart);
    if (found && found.level != "unknown" && found.level != "country") previousPart = found;

    findedParts.push(found);
  }

  // Đảo ngược lại để đúng thứ tự ban đầu
  findedParts = findedParts.reverse();
  return findedParts;
}

const convertAddByCommune = (partsConvert, project) => {
  if (!partsConvert || !project) return null;
  const province = Object.values(provinces).find(f => project.city && f.name_with_type == project.city);
  if (!province) return null;

  const district = Object.values(districts).find(f => project.district && f.name_with_type == project.district && f.parent_code == province.code);
  if (!district) return null;

  const indexCommune = partsConvert.findIndex(f => f.level == 'commune' && f.addressInfo);
  if (indexCommune == -1) return null;

  const communeInParts = partsConvert[indexCommune];
  const commune = Object.values(communes).find(f => f.parent_code == district.code && f.slug == communeInParts.addressInfo.slug)
  if (!commune) return null;

  const addressInfoMap = wardMappings.find(f => f.old_ward_name == commune.name_with_type && f.old_district_name == district.name_with_type && f.old_province_name == province.name_with_type)

  let partsConvertNew = partsConvert?.slice(0, indexCommune);
  partsConvertNew.push({
    level: "commune",
    part: null,
    address_map: null,
    addressInfoMap: addressInfoMap,
    addressInfo: commune
  })
  return partsConvertNew;
}

main();
function main() {
  try {
    const rawData = fs.readFileSync('./data/projects.json', 'utf8');
    const projects = JSON.parse(rawData); 

    let doneResults = [];
    let verifyResults = [];
    let errorResults = [];

    for (let index = 0; index < projects.length; index++) {
      const project = projects[index];
      let partsConvert = convertAddressV3(project.address);

      const partsConvertNew = convertAddByCommune(partsConvert, project);
      if (partsConvertNew) partsConvert = partsConvertNew;

      // Tìm index bản ghi đầu tiền có level khác unknown và có address_map
      let firstMatchedIndex = partsConvert?.findIndex(p => p.level !== "unknown" && p.addressInfoMap);
      let firstMatched = firstMatchedIndex >= 0 ? partsConvert[firstMatchedIndex] : null;
      let addressPrefix = partsConvert?.slice(0, firstMatchedIndex).map(m => m.part).join(", ");

      if (firstMatched?.level === "commune") {

        let wardNew = Object.values(wards).find(w =>
          w.slug.replace(/-/g, " ") === removeOfficialPrefix(firstMatched.addressInfoMap.new_ward_name)
        );

        let provinceNew = Object.values(provincesNew).find(p =>
          p.slug.replace(/-/g, " ") === removeOfficialPrefix(firstMatched.addressInfoMap.new_province_name)
        );

        // Build address detail with proper comma handling
        let addressParts = [];
        if (wardNew) {
          addressParts.push(appendLevelSlug(wardNew.type, wardNew.slug.replace(/-/g, " ")));
        }
        if (provinceNew) {
          addressParts.push(appendLevelSlug(provinceNew.type, provinceNew.slug.replace(/-/g, " ")));
        }
        addressParts.push("Viet Nam");

        let addressDetail = addressParts.join(", ");
        let new_address = addressPrefix ? addressPrefix + ", " + capitalizeWords(addressDetail) : capitalizeWords(addressDetail);

        let new_project = {
          ...project,
          new_city: provinceNew?.name_with_type || "",
          new_address: new_address, 
        }
        doneResults.push(new_project);
      } else if (firstMatched?.level === "district" || firstMatched?.level === "province") {
        let provinceNew = Object.values(provincesNew).find(p =>
          p.slug.replace(/-/g, " ") === removeOfficialPrefix(firstMatched.addressInfoMap.new_province_name)
        );

        // Build address with proper comma handling
        let addressParts = [];
        if (addressPrefix) {
          addressParts.push(addressPrefix);
        }
        if (provinceNew) {
          addressParts.push(capitalizeWords(appendLevelSlug(provinceNew.type, provinceNew.slug.replace(/-/g, " "))));
        }
        addressParts.push("Viet Nam");

        let new_address = addressParts.join(", ");

        let new_project = {
          ...project,
          new_city: provinceNew?.name_with_type || "",
          new_address: new_address,
        }
        verifyResults.push(new_project);
      } else {
        errorResults.push({
          ...project,
          data_map: JSON.stringify(partsConvert)
        })
      }
    }

    saveResultsToFile('./convert-data/done.json', doneResults);
    saveResultsToFile('./convert-data/verify.json', verifyResults);
    saveResultsToFile('./convert-data/error.json', errorResults);

  } catch (error) {
    console.error("Error reading or parsing projects.json:", error);
    return;
  }
};
