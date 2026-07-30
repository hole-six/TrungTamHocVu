import json
import sys
import zipfile
from datetime import datetime
from pathlib import Path

from patch_workbook_reports_xml import (
    build_chi_tiet_rows,
    build_positioned_sheet,
    build_sheet_from_template,
    read_sheet_xml,
    update_defined_names,
    update_table_xml,
    workbook_sheet_targets,
)


def payment_status_vi(value):
    mapping = {
        "UNPAID": "Chưa đóng",
        "PARTIAL": "Đóng thiếu",
        "PAID": "Đóng đủ",
        "OVERPAID": "Đóng dư",
    }
    return mapping.get(value, value or "")


def cash_status_vi(value):
    mapping = {
        "CONFIRMED": "Đã xác nhận",
        "DRAFT": "Nháp",
        "VOID": "Đã hủy",
    }
    return mapping.get(value, value or "")


def week_number(date_text):
    try:
        return datetime.strptime(date_text, "%Y-%m-%d").isocalendar().week
    except Exception:
        return ""


def build_theo_doi_hp_sheet(payload):
    rows = [
        [
            index,
            item["classCode"],
            item["className"],
            f'{item["studentName"]} - {item["studentCode"]}',
            item["periodName"],
            item["deductedCount"],
            item["openingBalance"],
            0,
            item["sessionCount"],
            item["unitPrice"],
            item["tuitionAmount"],
            item["materialsAmount"],
            item["totalAmount"],
            item["paidAmount"],
            item["remainingAmount"],
            payment_status_vi(item["paymentStatus"]),
        ]
        for index, item in enumerate(payload["theoDoiHp"], start=1)
    ] or [["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]]

    return build_positioned_sheet(
        55,
        1,
        5,
        [
            ["STT", "Mã lớp", "Tên lớp", "Tên HV", "Tháng", "Số buổi nghỉ trừ ngoại lệ", "HP đầu kỳ", "HB điều chỉnh", "Số buổi", "Đơn giá", "HP tháng hiện tại", "Tiền giáo trình", "Tổng HP", "Tiền nộp", "Còn lại", "Tình trạng"],
            ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
            ["STT", "MaLop", "TenLop", "Ten HV", "HP Tháng", "Buoi tru", "HP dau ky", "HB dieu chinh", "So buoi", "ĐG", "HP thang hien tai", "TienGiaoTrinh", "TongHP", "TienNop", "Con lai", "Tinh trang dong hoc phi"],
        ],
        rows,
    )


def build_thu_chi_sheet(payload):
    chi_rows = [item for item in payload["thuChi"] if item["type"] == "CHI"]
    thu_rows = [item for item in payload["thuChi"] if item["type"] == "THU"]
    category_names = sorted({item["categoryName"] for item in payload["thuChi"] if item["categoryName"]})
    total_chi = sum(item["amount"] for item in chi_rows)
    total_thu = sum(item["amount"] for item in thu_rows)

    rows = [[None] * 44 for _ in range(max(len(payload["thuChi"]) + 8, 26))]
    rows[0][2] = "BAO CAO TIEN MAT"
    rows[2][2] = "Tong chi"
    rows[2][3] = total_chi
    rows[2][4] = "Tong thu"
    rows[2][5] = total_thu
    rows[2][6] = "Ton"
    rows[2][7] = total_thu - total_chi
    rows[5][2] = "Muc chi:"
    rows[5][8] = "Muc thu:"

    chi_headers = ["Ngay thang", "Loai chi", "Chi tiet cac loai", "Dien giai", "Column2", "So tien", "Nguoi thu/chi", "Ghi chu", "Thang chi", "Tuan chi"]
    thu_headers = ["Ngay thang", "Loai thu", "Chi tiet cac loai", "Dien giai", "Column1", "Column2", "So tien", "Nguoi thu/chi", "Ghi chu", "Thang thu", "Tuan thu"]
    category_headers = ["LoaiHinh", "TenThuChi", "ChiTietLoai", "GhiChu", "nguoi chi", "nguoi Thu"]

    for idx, value in enumerate(chi_headers, start=15):
        rows[4][idx - 1] = value
    for idx, value in enumerate(thu_headers, start=26):
        rows[4][idx - 1] = value
    for idx, value in enumerate(category_headers, start=38):
        rows[3][idx - 1] = value

    max_cash_rows = max(len(chi_rows), len(thu_rows), 1)
    for offset in range(max_cash_rows):
        excel_row = 5 + offset
        if offset < len(chi_rows):
            item = chi_rows[offset]
            values = [
                item["txnDate"],
                item["categoryName"],
                item["detail"],
                item["description"],
                "",
                item["amount"],
                item["handledBy"],
                cash_status_vi(item["status"]),
                item["txnDate"][:7],
                week_number(item["txnDate"]),
            ]
            for idx, value in enumerate(values, start=15):
                rows[excel_row][idx - 1] = value
        if offset < len(thu_rows):
            item = thu_rows[offset]
            values = [
                item["txnDate"],
                item["categoryName"],
                item["detail"],
                item["description"],
                "",
                "",
                item["amount"],
                item["handledBy"],
                cash_status_vi(item["status"]),
                item["txnDate"][:7],
                week_number(item["txnDate"]),
            ]
            for idx, value in enumerate(values, start=26):
                rows[excel_row][idx - 1] = value

    for offset, name in enumerate(category_names):
        excel_row = 4 + offset
        category_type = "Chi" if any(item["type"] == "CHI" and item["categoryName"] == name for item in payload["thuChi"]) else "Thu"
        values = [category_type, name, name, "", "", ""]
        for idx, value in enumerate(values, start=38):
            rows[excel_row][idx - 1] = value

    return rows


def build_report_cong_luong_sheet(payload):
    teacher_rows = payload["reportCongLuong"]["teachers"]
    assistant_rows = payload["reportCongLuong"]["assistants"]
    payroll_rows = payload["reportCongLuong"]["payrollByPeriod"]
    detail_rows = []
    max_rows = max(len(teacher_rows), len(assistant_rows), len(payroll_rows), 1)

    for idx in range(max_rows):
        teacher = teacher_rows[idx] if idx < len(teacher_rows) else None
        assistant = assistant_rows[idx] if idx < len(assistant_rows) else None
        payroll = payroll_rows[idx] if idx < len(payroll_rows) else None
        detail_rows.append([
            None,
            None,
            None,
            teacher["name"] if teacher else "",
            teacher["hours"] if teacher else 0,
            teacher["hours"] if teacher else 0,
            teacher["amount"] if teacher else 0,
            0,
            teacher["hours"] if teacher else 0,
            None,
            assistant["name"] if assistant else "",
            assistant["hours"] if assistant else 0,
            assistant["hours"] if assistant else 0,
            assistant["amount"] if assistant else 0,
            0,
            0,
            None,
            payroll["period"] if payroll else "",
            payroll["total"] if payroll else 0,
            (teacher["hours"] if teacher else 0) + (assistant["hours"] if assistant else 0),
        ])

    detail_rows.append([
        None,
        None,
        None,
        "Grand Total",
        sum(item["hours"] for item in teacher_rows),
        sum(item["hours"] for item in teacher_rows),
        sum(item["amount"] for item in teacher_rows),
        0,
        sum(item["hours"] for item in teacher_rows),
        None,
        "Grand Total",
        sum(item["hours"] for item in assistant_rows),
        sum(item["hours"] for item in assistant_rows),
        sum(item["amount"] for item in assistant_rows),
        0,
        0,
        None,
        "Grand Total",
        sum(item["total"] for item in payroll_rows),
        sum(item["hours"] for item in teacher_rows) + sum(item["hours"] for item in assistant_rows),
    ])

    return build_positioned_sheet(
        33,
        1,
        1,
        [
            ["HOME", None, None, "Ten_GV", "Ca", "So gio/ca", "Tien GV", "Tru gio GV", "Cong gio GV", None, "Ten_TG", "So ca", "So gio", "Tien TG", "Tru gio TG", "Them gio TG", None, "Row Labels", "Cong", "So gio"],
            [f"Ky luong: {payload['reportCongLuong']['periodName'] or 'Chua co ky'}", None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None],
        ],
        detail_rows,
    )


def build_dshv_sheet(payload):
    items = sorted(payload["dshv"], key=lambda item: (item.get("classCode", ""), item.get("fullName", "")))
    rows = [[None] * 88 for _ in range(max(len(items) + 5, 8))]
    human = ["Mã lớp", "Tên lớp", "Tên HV", "Ngày nhập học", "Ngày nghỉ", "Lí do nghỉ", "Đánh giá", "Tình trạng"]
    machine = ["MaLop", "TenLop", "TenHV", "Ngay nhap", "Ngay nghi", "Lí do nghỉ", "DanhGia", "HP tồn", "Column4", "Column5", "Column3", "MaSo", "Tình trạng học", "SĐT", "Column2", "TenHV&MaSo", "Ho ten", "MaHV", "TenHV&MaHV", "Tháng sinh nhật", "HocPhi/Buoi"]
    for idx, value in enumerate(human, start=5):
        rows[0][idx - 1] = value
    rows[2][6] = "=SUBTOTAL(3,T_HV[TenHV])"
    rows[2][11] = "=SUBTOTAL(9,T_HV[HP tồn])"
    for idx, value in enumerate(machine, start=5):
        rows[3][idx - 1] = value
    for offset, item in enumerate(items, start=4):
        values = [
            item["classCode"],
            item["className"],
            item["fullName"],
            item["enrollDate"],
            item["leaveDate"],
            "",
            item["evaluation"],
            "",
            "",
            "",
            "",
            item["studentCode"],
            item["status"],
            "",
            "",
            f'{item["fullName"]}{item["studentCode"]}',
            item["fullName"],
            item["displayId"],
            f'{item["fullName"]}.{item["displayId"]}',
            item["enrollDate"][5:7] if item["enrollDate"] else "",
            "",
        ]
        for idx, value in enumerate(values, start=5):
            rows[offset][idx - 1] = value
    return rows, items


def build_dslop_sheet(payload):
    items = sorted(payload["dslop"], key=lambda item: (item.get("courseCode", ""), item.get("classCode", "")))
    rows = [
        [
            item["classCode"],
            item["courseCode"],
            item["className"],
            item["totalSessions"],
            item["startDate"],
            item["expectedEndDate"],
            "",
            0,
            0,
            item["studentCount"],
            max((item["totalSessions"] or 0), 0),
            item["status"],
        ]
        for item in items
    ] or [["", "", "", "", "", "", "", "", "", "", "", ""]]
    return build_positioned_sheet(
        26,
        3,
        1,
        [
            ["Mã lớp", "Lớp", "Tên lớp", "SL buổi học", "Ngày khai giảng", "Ngày KT dự kiến", "Ngày KT thực tế", "Buổi số bắt đầu", "Số buổi đã nghỉ", "SL buổi học tới hiện tại", "SL buổi còn lại", "Ghi chú"],
            ["", "", "", "", "", "", "", "", "", "", "", ""],
            ["MaLop", "Lop", "Ten lop", "SLBuoiHoc", "NgayBD", "NgayKTDuKien", "Column5", "Buoi so", "So buoi nghi", "Column4", "Con lai", "GhiChu"],
        ],
        rows,
    ), items


def build_dstest_sheet(payload):
    items = sorted(payload["dstest"], key=lambda item: (item.get("status", ""), item.get("meetDate", ""), item.get("fullName", "")))
    rows = [
        [
            item["meetDate"],
            item["fullName"],
            "",
            item["dob"],
            "",
            "",
            item["guardianName"],
            item["phone"],
            item["testDate"],
            item["testStatus"],
            item["interestedClass"],
            item["expectedStartDate"],
            item["actualEnrollDate"],
            item["status"],
            item["address"],
        ]
        for item in items
    ] or [["", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]]
    return build_positioned_sheet(
        37,
        4,
        5,
        [
            ["Ngày gặp", "Họ tên HV", "Giới tính", "Ngày sinh", "Tuổi", "Lớp Đang học ở trường", "Họ tên PH", "Sdt", "Ngày test", "Tình trạng test", "Lớp quan tâm", "Ngày dự kiến học", "Ngày nhập học", "Trạng thái", "Địa chỉ"],
            ["", "", "", "", "", "", "Họ tên mẹ", "Sdt", "", "", "", "", "", "", ""],
            ["NgayGap", "HoTenHV", "GioiTinh", "DoB", "tuoi", "LopHoc", "HoTenPH", "Sdt", "NgayTest", "Tình trạng test", "Lớp quan tâm", "Ngày dự kiến đi học", "Ngày nhập học", "Trạng thái", "Địa chỉ"],
        ],
        rows,
    ), items


def build_xuat_nhap_sach_sheet(payload):
    xuat_kho = sorted(payload["xuatNhapSach"]["xuatKho"], key=lambda item: (item.get("issueDate", ""), item.get("className", ""), item.get("studentName", "")))
    nhap_kho = sorted(payload["xuatNhapSach"]["nhapKho"], key=lambda item: (item.get("txnDate", ""), item.get("bookName", "")))
    ton_kho = sorted(payload["xuatNhapSach"]["tonKho"], key=lambda item: item.get("bookCode", ""))
    rows = [[None] * 46 for _ in range(max(len(xuat_kho) + 7, len(nhap_kho) + 7, len(ton_kho) + 7, 20))]
    rows[0][0] = "HOME"
    rows[0][4] = "THEO DOI PHAT SACH 2025"
    xuat_headers = ["STT", "MaLop", "TenLop", "TenHV&MaHV", "TenSach", "NgayThang", "Column3", "SL", "DonGia", "TienGiaoTrinh", "TTTien", "GhiChu", "Column1", "Thang xuat", "Column2"]
    nhap_headers = ["Ngay thang", "Malop", "TenSach", "SL nhap", "Nguoi nhap", "Nguoi giao", "Tong tien", "Ghi chu", "Don gia", "Tinh trang su dung", "Column1", "Thang nhap", "Column2"]
    ton_headers = ["STT", "MaLop", "TenSach", "Column4", "DonGia", "Column3", "Column1", "Column2", "So Luong", "GhiChu"]
    for idx, value in enumerate(xuat_headers, start=5):
        rows[5][idx - 1] = value
    for idx, value in enumerate(nhap_headers, start=21):
        rows[5][idx - 1] = value
    for idx, value in enumerate(ton_headers, start=35):
        rows[5][idx - 1] = value
    for offset, item in enumerate(xuat_kho, start=6):
        values = [offset - 5, "", item["className"], f'{item["studentName"]} - {item["studentCode"]}', item["bookName"], item["issueDate"], item["paymentStatus"], item["quantity"], item["unitPrice"], item["amount"], item["paymentStatus"], "", "", item["issueDate"][:7], ""]
        for idx, value in enumerate(values, start=5):
            rows[offset][idx - 1] = value
    for offset, item in enumerate(nhap_kho, start=6):
        values = [item["txnDate"], item["bookCode"], item["bookName"], item["quantity"], "", "", item["totalAmount"], "", item["unitPrice"], "", "", item["txnDate"][:7], ""]
        for idx, value in enumerate(values, start=21):
            rows[offset][idx - 1] = value
    for offset, item in enumerate(ton_kho, start=6):
        values = [offset - 5, item["bookCode"], item["name"], "", item["unitPrice"], item["stockValue"], "", "", item["quantityOnHand"], ""]
        for idx, value in enumerate(values, start=35):
            rows[offset][idx - 1] = value
    return rows, xuat_kho, nhap_kho, ton_kho


def main():
    payload_path = Path(sys.argv[1])
    payload = json.loads(payload_path.read_text(encoding="utf-8"))
    xlsx_path = Path(payload["workbookPath"])
    backup_path = Path(payload.get("backupWorkbookPath") or xlsx_path)
    targets = workbook_sheet_targets(xlsx_path)

    sorted_chi_tiet = sorted(payload["chiTietLopHoc"], key=lambda item: (item.get("ngayThang", ""), item.get("maLop", ""), item.get("thoiGian", "")))
    dshv_sheet, dshv_items = build_dshv_sheet(payload)
    dslop_sheet, dslop_items = build_dslop_sheet(payload)
    dstest_sheet, dstest_items = build_dstest_sheet(payload)
    xuat_nhap_sach_sheet, xuat_kho_items, nhap_kho_items, ton_kho_items = build_xuat_nhap_sach_sheet(payload)
    workbook_xml_bytes = None
    replacements = {
        targets["TheoDoiHP"]: build_sheet_from_template(read_sheet_xml(backup_path, "TheoDoiHP"), build_theo_doi_hp_sheet(payload)),
        targets["Thu-Chi"]: build_sheet_from_template(read_sheet_xml(backup_path, "Thu-Chi"), build_thu_chi_sheet(payload)),
        targets["Report_Cong_Luong"]: build_sheet_from_template(read_sheet_xml(backup_path, "Report_Cong_Luong"), build_report_cong_luong_sheet(payload)),
        targets["ChiTietLopHoc"]: build_sheet_from_template(read_sheet_xml(backup_path, "ChiTietLopHoc"), build_chi_tiet_rows(sorted_chi_tiet)),
        targets["DSHV"]: build_sheet_from_template(read_sheet_xml(backup_path, "DSHV"), dshv_sheet),
        targets["DSLop"]: build_sheet_from_template(read_sheet_xml(backup_path, "DSLop"), dslop_sheet),
        targets["DSTest"]: build_sheet_from_template(read_sheet_xml(backup_path, "DSTest"), dstest_sheet),
        targets["XuatNhapSach"]: build_sheet_from_template(read_sheet_xml(backup_path, "XuatNhapSach"), xuat_nhap_sach_sheet),
    }

    with zipfile.ZipFile(xlsx_path, "r") as current_archive:
        workbook_xml_bytes = current_archive.read("xl/workbook.xml")
        replacements["xl/tables/table5.xml"] = update_table_xml(current_archive.read("xl/tables/table5.xml"), f"E3:AV{3 + max(len(payload['theoDoiHp']), 1)}")
        replacements["xl/tables/table2.xml"] = update_table_xml(current_archive.read("xl/tables/table2.xml"), f"E5:BD{5 + len(sorted_chi_tiet)}")
        replacements["xl/tables/table9.xml"] = update_table_xml(current_archive.read("xl/tables/table9.xml"), f"O5:X{5 + max(len([item for item in payload['thuChi'] if item['type'] == 'CHI']), 1)}")
        replacements["xl/tables/table11.xml"] = update_table_xml(current_archive.read("xl/tables/table11.xml"), f"Z5:AJ{5 + max(len([item for item in payload['thuChi'] if item['type'] == 'THU']), 1)}")
        category_count = len(sorted({item["categoryName"] for item in payload["thuChi"] if item["categoryName"]}))
        replacements["xl/tables/table10.xml"] = update_table_xml(current_archive.read("xl/tables/table10.xml"), f"AL4:AQ{max(4 + category_count, 5)}")
        replacements["xl/tables/table4.xml"] = update_table_xml(current_archive.read("xl/tables/table4.xml"), f"E4:BU{4 + len(dshv_items)}")
        replacements["xl/tables/table12.xml"] = update_table_xml(current_archive.read("xl/tables/table12.xml"), f"A5:Z{5 + len(dslop_items)}")
        replacements["xl/tables/table3.xml"] = update_table_xml(current_archive.read("xl/tables/table3.xml"), f"E6:AH{6 + len(dstest_items)}")
        replacements["xl/tables/table6.xml"] = update_table_xml(current_archive.read("xl/tables/table6.xml"), f"AI6:AR{6 + len(ton_kho_items)}")

    replacements["xl/workbook.xml"] = update_defined_names(
        workbook_xml_bytes,
        {
            "TheoDoiHP": f"TheoDoiHP!$E$1:$T${3 + max(len(payload['theoDoiHp']), 1)}",
            "Thu-Chi": f"Thu-Chi!$C$1:$AQ${6 + max(len(payload['thuChi']), 1)}",
            "Report_Cong_Luong": f"Report_Cong_Luong!$A$1:$T${3 + max(len(payload['reportCongLuong']['teachers']), len(payload['reportCongLuong']['assistants']), len(payload['reportCongLuong']['payrollByPeriod']), 1)}",
            "ChiTietLopHoc": f"ChiTietLopHoc!$E$1:$BD${5 + len(sorted_chi_tiet)}",
            "DSHV": f"DSHV!$E$1:$BU${4 + len(dshv_items)}",
            "DSLop": f"DSLop!$A$3:$L${5 + len(dslop_items)}",
            "DSTest": f"DSTest!$E$4:$S${6 + len(dstest_items)}",
            "XuatNhapSach": f"XuatNhapSach!$E$1:$AR${6 + max(len(xuat_kho_items), len(nhap_kho_items), len(ton_kho_items), 1)}",
        },
        {
            "TheoDoiHP": f"TheoDoiHP!$E$3:$AV${3 + max(len(payload['theoDoiHp']), 1)}",
            "ChiTietLopHoc": f"ChiTietLopHoc!$E$5:$BD${5 + len(sorted_chi_tiet)}",
            "DSHV": f"DSHV!$E$4:$BU${4 + len(dshv_items)}",
            "DSLop": f"DSLop!$A$5:$Z${5 + len(dslop_items)}",
            "DSTest": f"DSTest!$E$6:$AH${6 + len(dstest_items)}",
        },
        {
            "TheoDoiHP": "TheoDoiHP!$1:$3",
            "ChiTietLopHoc": "ChiTietLopHoc!$3:$5",
            "DSHV": "DSHV!$4:$4",
            "DSLop": "DSLop!$5:$5",
            "DSTest": "DSTest!$4:$6",
        },
    )

    temp_path = xlsx_path.with_suffix(".operational-v2.xlsx")
    with zipfile.ZipFile(xlsx_path, "r") as src, zipfile.ZipFile(temp_path, "w", compression=zipfile.ZIP_DEFLATED) as dst:
        for item in src.infolist():
            data = src.read(item.filename)
            if item.filename in replacements:
                data = replacements[item.filename]
            dst.writestr(item, data)

    xlsx_path.write_bytes(temp_path.read_bytes())
    print(json.dumps({"ok": True, "patched": str(xlsx_path), "sheets": ["TheoDoiHP", "Thu-Chi", "Report_Cong_Luong", "ChiTietLopHoc", "DSHV", "DSLop", "DSTest", "XuatNhapSach"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
