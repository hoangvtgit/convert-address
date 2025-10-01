# Address Converter - Chuyển Đổi Địa Chỉ Tỉnh Thành Việt Nam

## Mô Tả Dự Án

Dự án này cung cấp giải pháp chuyển đổi địa chỉ tỉnh thành Việt Nam từ định dạng cũ (trước khi gộp tỉnh) sang định dạng mới (sau khi gộp tỉnh). Hỗ trợ cả việc tìm kiếm và lọc dữ liệu bằng cả địa chỉ cũ và mới.

## Cấu Trúc Dự Án

```
.
├── src/
│   └── address-converter.js      # Module chính chuyển đổi địa chỉ
├── tests/
│   └── address-converter.test.js # Test cases với Jest
├── SOLUTION.md                   # Giải pháp business chi tiết
└── README.md                    # Hướng dẫn sử dụng
```

## Cài Đặt

### Yêu Cầu Hệ Thống
- Node.js (version 14 trở lên)
- npm hoặc yarn

### Cài Đặt Dependencies

```bash
# Khởi tạo project (nếu chưa có package.json)
npm init -y

# Cài đặt Jest cho testing
npm install --save-dev jest

# Hoặc sử dụng yarn
yarn add --dev jest
```

## Cách Sử Dụng

### 1. Import Module

```javascript
const {
  convertAddress,
  convertAddresses,
  getNewCityOptions,
  getOriginalCityOptions
} = require('./src/address-converter');
```

### 2. Chuyển Đổi Địa Chỉ Đơn Lẻ

```javascript
const address = {
  address: "Lot CN6-2, Que Vo III Industrial Park",
  city: "Tỉnh Bắc Ninh",
  district: "Huyện Quế Võ"
};

const converted = convertAddress(address);
console.log(converted);
// Kết quả:
// {
//   address: "Lot CN6-2, Que Vo III Industrial Park",
//   city: "Tỉnh Bắc Ninh",
//   district: "Huyện Quế Võ",
//   newCity: "Bắc Ninh",
//   isConverted: true,
//   originalCity: "Tỉnh Bắc Ninh"
// }
```

### 3. Chuyển Đổi Nhiều Địa Chỉ

```javascript
const addresses = [
  { city: "Tỉnh Bắc Giang", address: "..." },
  { city: "Tỉnh Bình Dương", address: "..." },
  { city: "Tỉnh Hà Nam", address: "..." }
];

const convertedAddresses = convertAddresses(addresses);
console.log(convertedAddresses);
```

### 4. Lấy Danh Sách Filter Options

```javascript
// Lấy danh sách tỉnh thành mới cho filter
const newCityOptions = getNewCityOptions(convertedAddresses);
// ["Bắc Ninh", "Ninh Bình", "TP Hồ Chí Minh"]

// Lấy danh sách tỉnh thành cũ cho filter
const originalCityOptions = getOriginalCityOptions(addresses);
// ["Tỉnh Bắc Giang", "Tỉnh Bình Dương", "Tỉnh Hà Nam"]
```

## Chạy Test

### Chạy Toàn Bộ Test

```bash
npm test
```

### Chạy Test Với Coverage Report

```bash
npm test -- --coverage
```

### Chạy Test Cụ Thể

```bash
# Chạy test cho function convertAddress
npm test -- -t "convertAddress function"

# Chạy test cho edge cases
npm test -- -t "Edge cases"
```

### Cấu Hình Test trong package.json

Thêm script vào file `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## Test Cases Đã Được Triển Khai

### 1. Chuyển Đổi Cơ Bản
- Chuyển đổi các tỉnh thành cơ bản (Bắc Giang → Bắc Ninh, Bình Dương → TP Hồ Chí Minh, v.v.)
- Xử lý prefix "Tỉnh" và "Thành phố"
- Địa chỉ đã ở định dạng mới

### 2. Edge Cases
- Địa chỉ không có trong mapping
- Input không hợp lệ (null, undefined, không phải object)
- Thiếu property city

### 3. Batch Processing
- Chuyển đổi nhiều địa chỉ cùng lúc
- Xử lý empty array
- Validation input array

### 4. Filter Options
- Lấy danh sách tỉnh thành mới duy nhất
- Lấy danh sách tỉnh thành cũ duy nhất
- Xử lý duplicate values

## Customize Test Data

Để thêm test cases mới, chỉ cần sửa file `tests/address-converter.test.js`:

```javascript
// Thêm test data mới
const newTestAddresses = [
  {
    address: "Your test address",
    city: "Tỉnh Your Province"
  }
];

// Thêm test case mới
test('should handle your specific case', () => {
  const result = convertAddress(newTestAddresses[0]);
  expect(result.newCity).toBe("Expected Result");
});
```

## Integration với Database

### Migration Script Example

```javascript
const { convertAddress } = require('./src/address-converter');
const mongoose = require('mongoose');

async function migrateProjects() {
  const projects = await Project.find({ is_converted: { $ne: true } });
  
  for (const project of projects) {
    try {
      const converted = convertAddress({
        city: project.city,
        address: project.address,
        district: project.district
      });
      
      await Project.updateOne(
        { _id: project._id },
        {
          new_city: converted.newCity,
          is_converted: converted.isConverted,
          original_city: converted.originalCity
        }
      );
      
      console.log(`Converted project ${project._id}`);
    } catch (error) {
      console.error(`Error converting project ${project._id}:`, error);
    }
  }
}
```

## API Integration

### Express.js Example

```javascript
const express = require('express');
const { convertAddresses, getNewCityOptions, getOriginalCityOptions } = require('./src/address-converter');

const app = express();
app.use(express.json());

// API để convert địa chỉ
app.post('/api/convert-addresses', (req, res) => {
  try {
    const { addresses } = req.body;
    const converted = convertAddresses(addresses);
    res.json({ success: true, data: converted });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// API để lấy filter options
app.get('/api/filter-options', async (req, res) => {
  try {
    const projects = await Project.find();
    const converted = convertAddresses(projects);
    
    const options = {
      newCities: getNewCityOptions(converted),
      originalCities: getOriginalCityOptions(projects)
    };
    
    res.json({ success: true, data: options });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## Troubleshooting

### Lỗi Thường Gặp

1. **"City property is required and must be a string"**
   - Kiểm tra xem object address có property `city` không
   - Đảm bảo `city` là string

2. **"Invalid address object"**
   - Đảm bảo truyền đúng object, không phải null/undefined

3. **Test không chạy**
   - Kiểm tra đã cài đặt Jest chưa
   - Kiểm tra cấu hình trong package.json

### Debug

Thêm console.log để debug:

```javascript
const result = convertAddress(address);
console.log('Input:', address);
console.log('Output:', result);
```

## Contributing

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## License

This project is licensed under the MIT License.

## Liên Hệ

Nếu có câu hỏi hoặc cần hỗ trợ, vui lòng tạo issue trên repository hoặc liên hệ trực tiếp.

## Changelog

### Version 1.0.0
- Initial release
- Basic address conversion functionality
- Comprehensive test coverage
- Business solution documentation
