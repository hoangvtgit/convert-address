/**
 * Hàm đọc file JSON và parse thành object JavaScript
 * @param {string} filePath - Đường dẫn đến file JSON cần đọc
 * @returns {Promise<Object>} Promise trả về object JavaScript đã được parse
 * @throws {Error} Nếu có lỗi khi đọc file hoặc parse JSON
 */
async function readJSONFile(filePath) {
    try {
        // Import module fs/promises để sử dụng các hàm async
        const fs = require('fs').promises;
        
        // Đọc file với encoding UTF-8
        const fileContent = await fs.readFile(filePath, 'utf8');
        
        // Parse JSON thành object JavaScript
        const jsonData = JSON.parse(fileContent);
        
        return jsonData;
    } catch (error) {
        // Xử lý các loại lỗi khác nhau
        if (error.code === 'ENOENT') {
            throw new Error(`File không tồn tại: ${filePath}`);
        } else if (error instanceof SyntaxError) {
            throw new Error(`File JSON không hợp lệ: ${filePath}`);
        } else {
            throw new Error(`Lỗi khi đọc file: ${error.message}`);
        }
    }
}

/**
 * Hàm đọc file JSON đồng bộ (không sử dụng Promise)
 * @param {string} filePath - Đường dẫn đến file JSON cần đọc
 * @returns {Object} Object JavaScript đã được parse
 * @throws {Error} Nếu có lỗi khi đọc file hoặc parse JSON
 */
function readJSONFileSync(filePath) {
    try {
        // Import module fs để sử dụng các hàm đồng bộ
        const fs = require('fs');
        
        // Đọc file với encoding UTF-8
        const fileContent = fs.readFileSync(filePath, 'utf8');
        
        // Parse JSON thành object JavaScript
        const jsonData = JSON.parse(fileContent);
        
        return jsonData;
    } catch (error) {
        // Xử lý các loại lỗi khác nhau
        if (error.code === 'ENOENT') {
            throw new Error(`File không tồn tại: ${filePath}`);
        } else if (error instanceof SyntaxError) {
            throw new Error(`File JSON không hợp lệ: ${filePath}`);
        } else {
            throw new Error(`Lỗi khi đọc file: ${error.message}`);
        }
    }
}

/**
 * Hàm đọc file JSON với callback (kiểu cũ)
 * @param {string} filePath - Đường dẫn đến file JSON cần đọc
 * @param {Function} callback - Callback function (error, data)
 */
function readJSONFileCallback(filePath, callback) {
    const fs = require('fs');
    
    fs.readFile(filePath, 'utf8', (error, fileContent) => {
        if (error) {
            if (error.code === 'ENOENT') {
                return callback(new Error(`File không tồn tại: ${filePath}`), null);
            }
            return callback(error, null);
        }
        
        try {
            const jsonData = JSON.parse(fileContent);
            callback(null, jsonData);
        } catch (parseError) {
            callback(new Error(`File JSON không hợp lệ: ${filePath}`), null);
        }
    });
}

// Export các hàm để sử dụng trong các module khác
module.exports = {
    readJSONFile,
    readJSONFileSync,
    readJSONFileCallback
};
