# Workbook Export v?n hành

- L?nh export workbook m?u t? d? li?u DB hi?n t?i: `npm run export:workbook`
- File xu?t ra du?c ghi vào thu m?c `docs/generated/workbook_exports/`.
- Lu?ng export hi?n t?i bom d? li?u nghi?p v? vào các sheet chính c?a workbook m?u: `Report_HS`, `Report_HP`, `Report_Cong_Luong`, `SinhNhatHV`, `TheoDoiHP`, `Thu-Chi`, `XuatNhapSach`, `NhanSu`, `DSHV`, `DSLop`, `DSTest`, `MucLuc`, `ChiTietLopHoc`.
- File g?c không b? ghi dè. Script luôn t?o b?n sao m?i t? template `docs/File Quan ly tong 2026.backup-2026-07-30.xlsx` r?i m?i patch d? li?u vào.
- N?u thi?u file backup, script t? fallback sang `docs/File Quan ly tong 2026.xlsx`.
