import * as XLSX from 'xlsx';

export interface StockImportRow {
  name: string;
  stockQuantity: number;
}

export const parseExcelStockImport = async (file: File): Promise<StockImportRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Find header row: Look for 'Наименование'
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        let headerRowIndex = -1;
        for (let i = 0; i < jsonData.length; i++) {
          if (jsonData[i].includes('Наименование')) {
            headerRowIndex = i;
            break;
          }
        }
        
        if (headerRowIndex === -1) {
          throw new Error('Не удалось найти заголовок "Наименование" в файле.');
        }
        
        const headers = jsonData[headerRowIndex];
        const nameIdx = headers.indexOf('Наименование');
        const stockIdx = headers.indexOf('Остаток');
        
        if (nameIdx === -1 || stockIdx === -1) {
          throw new Error('Файл должен содержать колонки "Наименование" и "Остаток".');
        }
        
        const results: StockImportRow[] = [];
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row[nameIdx]) continue;
          
          results.push({
            name: String(row[nameIdx]).trim(),
            stockQuantity: Number(row[stockIdx]) || 0,
          });
        }
        
        resolve(results);
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsArrayBuffer(file);
  });
};
