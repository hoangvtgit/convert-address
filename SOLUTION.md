# Giải Pháp Xử Lý Convert Địa Chỉ và Đáp Ứng Yêu Cầu Business

## 1. Giải Pháp Đáp Ứng Yêu Cầu Business

### 1.1. Cập Nhật Bộ Lọc Tìm Kiếm (Dropdown Filter)

#### 1.1.1. Database Schema Update
```sql
-- Thêm cột mới cho địa chỉ mới
ALTER TABLE projects ADD COLUMN new_city VARCHAR(255);
ALTER TABLE projects ADD COLUMN is_converted BOOLEAN DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN original_city VARCHAR(255);

-- Cập nhật dữ liệu hiện có
UPDATE projects SET 
  new_city = [result từ convert],
  is_converted = TRUE,
  original_city = city;
```

#### 1.1.2. API Endpoints
```javascript
// GET /api/projects/filter-options
// Trả về cả options cũ và mới
{
  "newCities": ["Hà Nội", "TP Hồ Chí Minh", "Đồng Nai", ...],
  "originalCities": ["Tỉnh Bắc Ninh", "Tỉnh Bình Dương", "Tỉnh Đồng Nai", ...]
}

// GET /api/projects?cityType=new&city=Hà Nội
// GET /api/projects?cityType=original&city=Tỉnh Bắc Ninh
```

#### 1.1.3. Frontend Implementation
```javascript
// Component Filter
const CityFilter = () => {
  const [filterType, setFilterType] = useState('new'); // 'new' hoặc 'original'
  const [selectedCity, setSelectedCity] = useState('');
  
  const cities = filterType === 'new' ? newCities : originalCities;
  
  return (
    <div>
      <select onChange={(e) => setFilterType(e.target.value)}>
        <option value="new">Tỉnh thành mới</option>
        <option value="original">Tỉnh thành cũ</option>
      </select>
      
      <select onChange={(e) => setSelectedCity(e.target.value)}>
        {cities.map(city => (
          <option key={city} value={city}>{city}</option>
        ))}
      </select>
    </div>
  );
};
```

### 1.2. Search bằng Địa Chỉ Cũ

#### 1.2.1. Database Query Optimization
```sql
-- Tạo index để tối ưu search
CREATE INDEX idx_projects_original_city ON projects(original_city);
CREATE INDEX idx_projects_new_city ON projects(new_city);

-- Query search
SELECT * FROM projects 
WHERE (new_city = ? OR original_city = ?)
AND [other conditions];
```

#### 1.2.2. Search Logic
```javascript
// Search service
class ProjectSearchService {
  searchProjects(query, filters = {}) {
    const searchConditions = [];
    
    // Search by address text
    if (query) {
      searchConditions.push({
        $or: [
          { address: { $regex: query, $options: 'i' } },
          { district: { $regex: query, $options: 'i' } }
        ]
      });
    }
    
    // Filter by city type
    if (filters.cityType === 'new' && filters.city) {
      searchConditions.push({ new_city: filters.city });
    } else if (filters.cityType === 'original' && filters.city) {
      searchConditions.push({ original_city: filters.city });
    }
    
    return Project.find({ $and: searchConditions });
  }
}
```

### 1.3. Migration Strategy

#### 1.3.1. Phase 1: Data Migration
```javascript
// Migration script
const migrateProjects = async () => {
  const projects = await Project.find({ is_converted: { $ne: true } });
  
  for (const project of projects) {
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
  }
};
```

#### 1.3.2. Phase 2: API Update
- Cập nhật API hiện tại để hỗ trợ cả filter cũ và mới
- Đảm bảo backward compatibility

#### 1.3.3. Phase 3: Frontend Update
- Thêm toggle switch giữa filter cũ và mới
- Cập nhật UI/UX cho trải nghiệm người dùng tốt nhất

### 1.4. Monitoring và Maintenance

#### 1.4.1. Logging và Monitoring
```javascript
// Log conversion statistics
const conversionStats = {
  totalConverted: 0,
  failedConversions: 0,
  conversionRate: 0
};

// Monitor search patterns
const searchAnalytics = {
  newCitySearches: 0,
  originalCitySearches: 0,
  mostSearchedCities: []
};
```

## 2. Giải Pháp Convert Cột Address (Mở Rộng)

### Thông tin cần làm rõ
- **Mức độ đa dạng của dữ liệu address**
- **Yêu cầu độ chính xác của trường address là bao nhiêu sau khi convert**
- **Quy mô dữ liệu khoảng bao nhiêu bản ghỉ** 
- **Address sau khi convert có cần chuẩn hóa địa chỉ theo format mới không**

### 2.1. Sử dụng regex

```javascript
// Address Converter với hỗ trợ convert cả address string
class AdvancedAddressConverter {
  constructor() {
    this.provincePatterns = this.buildProvincePatterns();
    this.addressComponents = this.buildAddressComponents();
  }

  // Phát hiện và thay thế tỉnh thành trong address string
  convertAddressString(address, originalCity, newCity) {
    const patterns = this.getReplacementPatterns(originalCity, newCity);
    
    let convertedAddress = address;
    for (const pattern of patterns) {
      convertedAddress = convertedAddress.replace(pattern.search, pattern.replace);
    }
    
    return convertedAddress;
  }

  // Xây dựng patterns để tìm kiếm và thay thế
  getReplacementPatterns(originalCity, newCity) {
    const normalizedOriginal = originalCity.replace(/^(Tỉnh|Thành phố)\s*/i, '');
    const normalizedNew = newCity.replace(/^(Tỉnh|Thành phố)\s*/i, '');
    
    return [
      // Pattern 1: Thay thế trực tiếp tên tỉnh
      { search: new RegExp(`\\b${normalizedOriginal}\\b`, 'gi'), replace: normalizedNew },
      
      // Pattern 2: Thay thế với prefix "Tỉnh"
      { search: new RegExp(`\\bTỉnh\\s*${normalizedOriginal}\\b`, 'gi'), replace: `Tỉnh ${normalizedNew}` },
      
      // Pattern 3: Thay thế với prefix "Thành phố"
      { search: new RegExp(`\\bThành phố\\s*${normalizedOriginal}\\b`, 'gi'), replace: `Thành phố ${normalizedNew}` },
      
      // Pattern 4: Xử lý các biến thể viết tắt/thông dụng
      { search: new RegExp(`\\b${this.getCommonVariants(normalizedOriginal)}\\b`, 'gi'), replace: normalizedNew }
    ];
  }
}
```

## 3. Timeline và Phân Bổ Công Việc (14 Tiếng)
- **2 tiếng**: Phân tích dữ liệu address, xác định patterns phổ biến
- **2 tiếng**: Xây dựng mapping rules và test cases
- **6 tiếng**: Triển khai code
- **4 tiếng**: Test lại chức năng với data thực tế và chỉnh sửa code