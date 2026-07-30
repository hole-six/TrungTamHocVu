# Workbook Data Quality Report

## Tổng quan

- Tổng số bảng kiểm tra: 15
- Bảng sẵn sàng import: 5
- Bảng có khóa một phần: 1
- Bảng chủ yếu placeholder/công thức: 9

## Chi tiết từng bảng

### ChiTietLopHoc.T_ChiTietLop
- `qualityStatus`: PLACEHOLDER_ONLY
- `rowCount`: 4851
- `businessKeyFields`: Ngay thang, MaLop, TenLop, Giáo viên
- `rowsWithAnyKey`: 0
- `rowsWithAllKeys`: 0
- `placeholderOnlyRows`: 0
- `meaningfulRows`: 4851
- `missingKeyCounts`:
  - Ngay thang: 4851
  - MaLop: 4851
  - TenLop: 4851
  - Giáo viên: 4851

### DSHV.T_HV
- `qualityStatus`: PLACEHOLDER_ONLY
- `rowCount`: 423
- `businessKeyFields`: MaSo, TenHV, MaHV
- `rowsWithAnyKey`: 0
- `rowsWithAllKeys`: 0
- `placeholderOnlyRows`: 0
- `meaningfulRows`: 423
- `missingKeyCounts`:
  - MaSo: 423
  - TenHV: 423
  - MaHV: 423

### DSLop.T_DSLop
- `qualityStatus`: PLACEHOLDER_ONLY
- `rowCount`: 34
- `businessKeyFields`: MaLop, Ten lop, TenLop
- `rowsWithAnyKey`: 0
- `rowsWithAllKeys`: 0
- `placeholderOnlyRows`: 33
- `meaningfulRows`: 1
- `missingKeyCounts`:
  - MaLop: 34
  - Ten lop: 34
  - TenLop: 34

### DSTest.T_DSTest
- `qualityStatus`: READY_FOR_IMPORT
- `rowCount`: 502
- `businessKeyFields`: MaSo, HoTenHV, Sdt
- `rowsWithAnyKey`: 1
- `rowsWithAllKeys`: 1
- `placeholderOnlyRows`: 498
- `meaningfulRows`: 4
- `missingKeyCounts`:
  - MaSo: 501
  - HoTenHV: 501
  - Sdt: 501
- `sampleRowsWithKeys`:
  - row 7: {'MaSo': 'TEST-001', 'HoTenHV': 'Nguyen Van A', 'Sdt': '0909000001'}

### MucLuc.Table1
- `qualityStatus`: PARTIAL_KEYS
- `rowCount`: 6
- `businessKeyFields`: KhungTG, ThoiGian
- `rowsWithAnyKey`: 6
- `rowsWithAllKeys`: 0
- `placeholderOnlyRows`: 0
- `meaningfulRows`: 6
- `missingKeyCounts`:
  - KhungTG: 6
- `sampleRowsWithKeys`:
  - row 2: {'KhungTG': None, 'ThoiGian': '9:30 - 11:00'}
  - row 3: {'KhungTG': None, 'ThoiGian': '16:00 - 17:30'}
  - row 4: {'KhungTG': None, 'ThoiGian': '17:30 - 19:00'}
  - row 5: {'KhungTG': None, 'ThoiGian': '19:00 - 20:30'}
  - row 6: {'KhungTG': None, 'ThoiGian': '16:30 - 17:45'}

### MucLuc.Table2
- `qualityStatus`: READY_FOR_IMPORT
- `rowCount`: 12
- `businessKeyFields`: MaLop, TenLop
- `rowsWithAnyKey`: 12
- `rowsWithAllKeys`: 12
- `placeholderOnlyRows`: 0
- `meaningfulRows`: 12
- `sampleRowsWithKeys`:
  - row 2: {'MaLop': 'BT', 'TenLop': 'Bổ trợ'}
  - row 3: {'MaLop': 'FF', 'TenLop': 'First friend'}
  - row 4: {'MaLop': 'LTĐH', 'TenLop': 'Luyện thi đại học'}
  - row 5: {'MaLop': 'LOOK', 'TenLop': 'Mầm non'}
  - row 6: {'MaLop': 'NP', 'TenLop': 'Ngữ pháp'}

### MucLuc.Table3
- `qualityStatus`: READY_FOR_IMPORT
- `rowCount`: 7
- `businessKeyFields`: MaThu, TenThu
- `rowsWithAnyKey`: 7
- `rowsWithAllKeys`: 7
- `placeholderOnlyRows`: 0
- `meaningfulRows`: 7
- `sampleRowsWithKeys`:
  - row 2: {'MaThu': 'M', 'TenThu': 'Monday'}
  - row 3: {'MaThu': 'T', 'TenThu': 'Tuesday'}
  - row 4: {'MaThu': 'W', 'TenThu': 'Wenesday'}
  - row 5: {'MaThu': 'Th', 'TenThu': 'Thursday'}
  - row 6: {'MaThu': 'F', 'TenThu': 'Friday'}

### NhanSu.T_NS
- `qualityStatus`: PLACEHOLDER_ONLY
- `rowCount`: 53
- `businessKeyFields`: Mã NV, Họ và tên, Tên ngắn
- `rowsWithAnyKey`: 0
- `rowsWithAllKeys`: 0
- `placeholderOnlyRows`: 53
- `meaningfulRows`: 0
- `missingKeyCounts`:
  - Mã NV: 53
  - Họ và tên: 53
  - Tên ngắn: 53

### TheoDoiHP.T_HP
- `qualityStatus`: PLACEHOLDER_ONLY
- `rowCount`: 5967
- `businessKeyFields`: MaSo, Ten HV, HP Tháng
- `rowsWithAnyKey`: 0
- `rowsWithAllKeys`: 0
- `placeholderOnlyRows`: 0
- `meaningfulRows`: 5967
- `missingKeyCounts`:
  - MaSo: 5967
  - Ten HV: 5967
  - HP Tháng: 5967

### Thu-Chi.T_Chi
- `qualityStatus`: PLACEHOLDER_ONLY
- `rowCount`: 317
- `businessKeyFields`: Ngày tháng, Loại chi, Số tiền
- `rowsWithAnyKey`: 0
- `rowsWithAllKeys`: 0
- `placeholderOnlyRows`: 317
- `meaningfulRows`: 0
- `missingKeyCounts`:
  - Ngày tháng: 317
  - Loại chi: 317
  - Số tiền: 317

### Thu-Chi.T_PhanLoai
- `qualityStatus`: READY_FOR_IMPORT
- `rowCount`: 22
- `businessKeyFields`: LoaiHinh, TenThuChi
- `rowsWithAnyKey`: 22
- `rowsWithAllKeys`: 22
- `placeholderOnlyRows`: 0
- `meaningfulRows`: 22
- `sampleRowsWithKeys`:
  - row 5: {'LoaiHinh': 'Chi', 'TenThuChi': 'Văn phòng'}
  - row 6: {'LoaiHinh': 'Chi', 'TenThuChi': 'Giáo trình'}
  - row 7: {'LoaiHinh': 'Chi', 'TenThuChi': 'Điện, nước, internet'}
  - row 8: {'LoaiHinh': 'Chi', 'TenThuChi': 'Văn phòng'}
  - row 9: {'LoaiHinh': 'Chi', 'TenThuChi': 'Văn phòng'}

### Thu-Chi.T_Thu
- `qualityStatus`: PLACEHOLDER_ONLY
- `rowCount`: 148
- `businessKeyFields`: Ngày tháng, Loại thu, Số tiền
- `rowsWithAnyKey`: 0
- `rowsWithAllKeys`: 0
- `placeholderOnlyRows`: 148
- `meaningfulRows`: 0
- `missingKeyCounts`:
  - Ngày tháng: 148
  - Loại thu: 148
  - Số tiền: 148

### XuatNhapSach.T_SachNhap
- `qualityStatus`: PLACEHOLDER_ONLY
- `rowCount`: 163
- `businessKeyFields`: TenSach, Ngày tháng
- `rowsWithAnyKey`: 0
- `rowsWithAllKeys`: 0
- `placeholderOnlyRows`: 0
- `meaningfulRows`: 163
- `missingKeyCounts`:
  - TenSach: 163
  - Ngày tháng: 163

### XuatNhapSach.T_SachTon
- `qualityStatus`: READY_FOR_IMPORT
- `rowCount`: 170
- `businessKeyFields`: TenSach
- `rowsWithAnyKey`: 104
- `rowsWithAllKeys`: 104
- `placeholderOnlyRows`: 66
- `meaningfulRows`: 104
- `missingKeyCounts`:
  - TenSach: 66
- `sampleRowsWithKeys`:
  - row 7: {'TenSach': 'First Friends 2 - Activity'}
  - row 8: {'TenSach': 'First Friends 2 - Classbook'}
  - row 9: {'TenSach': 'Bài tập tô màu FF2'}
  - row 10: {'TenSach': 'Bài tập tô màu FF1'}
  - row 11: {'TenSach': 'First Friends 1 - Classbook'}

### XuatNhapSach.T_SachXuat
- `qualityStatus`: PLACEHOLDER_ONLY
- `rowCount`: 2477
- `businessKeyFields`: TenSach, TenHV&MaHV, NgayThang
- `rowsWithAnyKey`: 0
- `rowsWithAllKeys`: 0
- `placeholderOnlyRows`: 0
- `meaningfulRows`: 2477
- `missingKeyCounts`:
  - TenSach: 2477
  - TenHV&MaHV: 2477
  - NgayThang: 2477
