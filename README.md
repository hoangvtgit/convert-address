# Trình Chuyển Đổi Địa Chỉ Việt Nam

Công cụ chuyển đổi địa chỉ từ hệ thống hành chính cũ (có huyện) sang hệ thống mới (không có huyện) theo quy định mới của Việt Nam.

## Tổng Quan

Việt Nam đã thay đổi địa giới hành chính, loại bỏ cấp huyện trong một số địa phương. Công cụ này giúp chuyển đổi dữ liệu địa chỉ từ định dạng cũ sang định dạng mới một cách tự động.

### Ví Dụ Chuyển Đổi

**Trước (có huyện):**
```
"Loc An Industrial Park - Binh Son, Long An Commune, Long Thanh District, Dong Nai Province, Vietnam"
```

**Sau (không có huyện):**
```
"Loc An Industrial Park - Binh Son, Long Thanh Commune, Dong Nai Province, Viet Nam"
```

## Cấu Trúc Dữ Liệu

### Dữ Liệu Đầu Vào

- `data/projects.json` - Danh sách dự án cần chuyển đổi
- `data/ward_mappings.json` - Mapping từ xã/phường cũ sang mới
- `data/ward.json` - Dữ liệu xã/phường mới
- `data/province.json` - Dữ liệu tỉnh/thành phố mới
- `data/xa_phuong.json` - Dữ liệu xã/phường cũ (tham khảo)
- `data/quan_huyen.json` - Dữ liệu huyện/quận cũ (tham khảo)
- `data/tinh_tp.json` - Dữ liệu tỉnh/thành phố cũ (tham khảo)

### Dữ Liệu Đầu Ra

Sau khi chuyển đổi, kết quả được lưu trong thư mục `convert-data/`:

- `conversion_success.json` - Danh sách dự án chuyển đổi thành công
- `missing_info.json` - Danh sách dự án thiếu thông tin
- `invalid_input.json` - Danh sách dự án có dữ liệu không hợp lệ
- `processing_summary.json` - Báo cáo thống kê tổng hợp

## Cài Đặt

```bash
# Clone repository hoặc copy thư mục convert-address
cd convert-address

# Cài đặt dependencies (nếu có package.json)
npm install
```

## Sử Dụng

### 1. Chạy Toàn Bộ Quá Trình Chuyển Đổi

```bash
node src/address-converter.js
```

Lệnh này sẽ:
- Load tất cả dữ liệu từ các file JSON
- Chuyển đổi tất cả dự án
- Xuất kết quả ra các file tương ứng
- Hiển thị báo cáo thống kê

### 2. Chạy Test Với Một Số Dự Án Mẫu

```bash
node test-converter.js
```

### 3. Sử Dụng Trong Code Khác

```javascript
const AddressConverter = require('./src/address-converter');

async function main() {
    const converter = new AddressConverter();
    
    // Khởi tạo dữ liệu
    await converter.initialize();
    
    // Chuyển đổi một dự án cụ thể
    const project = {
        id: "123",
        address: "123 Main Street, Long An Commune, Long Thanh District, Dong Nai Province, Vietnam",
        city: "Tỉnh Đồng Nai",
        district: "Huyện Long Thành"
    };
    
    const result = converter.convertProject(project);
    
    if (result.type === 'success') {
        console.log('Chuyển đổi thành công:');
        console.log('Địa chỉ cũ:', result.data.address);
        console.log('Địa chỉ mới:', result.data.new_address);
    }
    
    // Hoặc chuyển đổi tất cả
    await converter.run();
}

main();
```

## Thuật Toán Chuyển Đổi

### 1. Phân Tích Địa Chỉ

Thuật toán phân tích chuỗi địa chỉ để trích xuất:
- Phần địa chỉ chi tiết (số nhà, tên đường, etc.)
- Tên xã/phường
- Tên huyện/quận
- Tên tỉnh/thành phố

### 2. Tìm Mapping

Sử dụng hai phương pháp:

**Exact Matching:** So khớp chính xác tên xã/phường, huyện, tỉnh
```javascript
// Độ tin cậy: 1.0
const exactMatch = wardMappings.find(mapping => 
    compareNames(mapping.old_ward_name, wardName) &&
    compareNames(mapping.old_district_name, districtName) &&
    compareNames(mapping.old_province_name, provinceName)
);
```

**Fuzzy Matching:** So khớp gần đúng sử dụng thuật toán Levenshtein
```javascript
// Độ tin cậy: 0.7 - 0.99
const similarity = calculateSimilarity(oldName, newName);
if (similarity > 0.7) {
    // Có thể là match
}
```

### 3. Xây Dựng Địa Chỉ Mới

Định dạng địa chỉ mới loại bỏ huyện:
```
[Địa chỉ chi tiết], [Tên xã/phường] [Loại], [Tỉnh/Thành phố] Province, Viet Nam
```

## Các Trường Hợp Xử Lý

### ✅ Chuyển Đổi Thành Công

```json
{
  "id": "100112501793",
  "address": "Original address...",
  "city": "Tỉnh Đồng Nai",
  "district": "Huyện Long Thành",
  "new_city": "Tỉnh Đồng Nai",
  "new_address": "New address without district...",
  "conversion_method": "exact",
  "confidence_score": 1.0,
  "processed_at": "2024-01-01T00:00:00.000Z"
}
```

### ⚠️ Thiếu Thông Tin

```json
{
  "id": "123",
  "missing_reason": "Ward not found in mapping database",
  "extracted_ward": "Unknown Ward",
  "notes": "Manual review required"
}
```

### ❌ Dữ Liệu Không Hợp Lệ

```json
{
  "id": "456",
  "error_type": "invalid_input_format",
  "validation_errors": ["Address parsing failed"]
}
```

## Thống Kê và Báo Cáo

Sau khi chạy, hệ thống sẽ tạo báo cáo chi tiết:

```
📊 Kết quả tổng hợp:
   🎯 Thành công: 850 dự án
   ⚠️  Thiếu thông tin: 120 dự án  
   ❌ Dữ liệu không hợp lệ: 30 dự án
   📈 Tỷ lệ thành công: 85%
```

## Xử Lý Lỗi

### Lỗi Thường Gặp

1. **File không tồn tại:** Kiểm tra đường dẫn file dữ liệu
2. **Dữ liệu JSON không hợp lệ:** Validate format file
3. **Thiếu mapping:** Bổ sung dữ liệu mapping
4. **Lỗi phân tích địa chỉ:** Kiểm tra format địa chỉ đầu vào

### Debug

Bật log chi tiết:
```javascript
const converter = new AddressConverter();
converter.debug = true; // Hiển thị log chi tiết
```

## Tùy Chỉnh

### Thay Đổi Ngưỡng Fuzzy Matching

```javascript
// Trong findWardMapping()
const fuzzyMatches = this.wardMappings.filter(mapping => {
    const wardSimilarity = this.calculateSimilarity(mapping.old_ward_name, wardName);
    const districtSimilarity = this.calculateSimilarity(mapping.old_district_name, districtName);
    const provinceSimilarity = this.calculateSimilarity(mapping.old_province_name, provinceName);
    
    // Thay đổi ngưỡng tại đây
    return wardSimilarity > 0.8 && districtSimilarity > 0.8 && provinceSimilarity > 0.9;
});
```

### Thêm Loại Đơn Vị Hành Chính

```javascript
// Trong parseAddress()
const wardKeywords = ['commune', 'ward', 'xã', 'phường', 'thị trấn', 'thị xã'];
```

## Performance

- **Thời gian xử lý:** ~0.1-5ms per record
- **Memory usage:** Phụ thuộc vào kích thước dữ liệu
- **Scalability:** Có thể xử lý hàng nghìn records

## Đóng Góp

1. Fork repository
2. Tạo feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## License

MIT License - Xem file LICENSE để biết thêm chi tiết.

## Liên Hệ

Nếu có vấn đề hoặc câu hỏi, vui lòng tạo issue trên repository.
