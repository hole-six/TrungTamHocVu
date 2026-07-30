import json
import sys
import zipfile
from datetime import datetime
from pathlib import Path
from xml.etree import ElementTree as ET

NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
ET.register_namespace("", NS_MAIN)
ET.register_namespace("r", NS_REL)


def col_name(index: int) -> str:
    result = ""
    while index > 0:
        index, rem = divmod(index - 1, 26)
        result = chr(65 + rem) + result
    return result


def inline_cell(ref: str, value):
    cell = ET.Element(f"{{{NS_MAIN}}}c", {"r": ref})
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        value_el = ET.SubElement(cell, f"{{{NS_MAIN}}}v")
        value_el.text = str(value)
    else:
        cell.set("t", "inlineStr")
        is_el = ET.SubElement(cell, f"{{{NS_MAIN}}}is")
        t_el = ET.SubElement(is_el, f"{{{NS_MAIN}}}t")
        t_el.text = "" if value is None else str(value)
    return cell


def build_sheet(rows, merges=None):
    worksheet = ET.Element(f"{{{NS_MAIN}}}worksheet")
    ET.SubElement(worksheet, f"{{{NS_MAIN}}}sheetPr")
    sheet_views = ET.SubElement(worksheet, f"{{{NS_MAIN}}}sheetViews")
    ET.SubElement(sheet_views, f"{{{NS_MAIN}}}sheetView", {"workbookViewId": "0", "showGridLines": "0"})
    max_col = max((len(row) for row in rows), default=1)
    max_row = len(rows)
    ET.SubElement(worksheet, f"{{{NS_MAIN}}}dimension", {"ref": f"A1:{col_name(max_col)}{max_row}"})
    ET.SubElement(worksheet, f"{{{NS_MAIN}}}sheetFormatPr", {"defaultRowHeight": "15"})
    sheet_data = ET.SubElement(worksheet, f"{{{NS_MAIN}}}sheetData")

    for row_idx, row_values in enumerate(rows, start=1):
        row_el = ET.SubElement(sheet_data, f"{{{NS_MAIN}}}row", {"r": str(row_idx)})
        for col_idx, value in enumerate(row_values, start=1):
            if value is None:
                continue
            row_el.append(inline_cell(f"{col_name(col_idx)}{row_idx}", value))

    if merges:
        merge_cells = ET.SubElement(worksheet, f"{{{NS_MAIN}}}mergeCells", {"count": str(len(merges))})
        for ref in merges:
            ET.SubElement(merge_cells, f"{{{NS_MAIN}}}mergeCell", {"ref": ref})

    ET.SubElement(
        worksheet,
        f"{{{NS_MAIN}}}pageMargins",
        {"left": "0.7", "right": "0.7", "top": "0.75", "bottom": "0.75", "header": "0.3", "footer": "0.3"},
    )
    return ET.tostring(worksheet, encoding="utf-8", xml_declaration=True)


def build_sheet_from_template(template_bytes: bytes, rows):
    worksheet = ET.fromstring(template_bytes)
    max_col = max((len(row) for row in rows), default=1)
    max_row = len(rows)

    dimension = worksheet.find(f"{{{NS_MAIN}}}dimension")
    if dimension is None:
        dimension = ET.Element(f"{{{NS_MAIN}}}dimension")
        worksheet.insert(1, dimension)
    dimension.set("ref", f"A1:{col_name(max_col)}{max_row}")

    new_sheet_data = ET.Element(f"{{{NS_MAIN}}}sheetData")
    for row_idx, row_values in enumerate(rows, start=1):
        row_el = ET.SubElement(new_sheet_data, f"{{{NS_MAIN}}}row", {"r": str(row_idx)})
        for col_idx, value in enumerate(row_values, start=1):
            if value is None:
                continue
            row_el.append(inline_cell(f"{col_name(col_idx)}{row_idx}", value))

    old_sheet_data = worksheet.find(f"{{{NS_MAIN}}}sheetData")
    if old_sheet_data is not None:
        insert_at = list(worksheet).index(old_sheet_data)
        worksheet.remove(old_sheet_data)
        worksheet.insert(insert_at, new_sheet_data)
    else:
        worksheet.append(new_sheet_data)

    return ET.tostring(worksheet, encoding="utf-8", xml_declaration=True)


def workbook_sheet_targets(xlsx_path: Path):
    with zipfile.ZipFile(xlsx_path, "r") as archive:
        workbook_xml = ET.fromstring(archive.read("xl/workbook.xml"))
        rels_xml = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))

    rel_map = {}
    for rel in rels_xml:
        target = rel.attrib["Target"]
        if not target.startswith("xl/"):
            target = f"xl/{target}"
        rel_map[rel.attrib["Id"]] = target.replace("\\", "/")

    targets = {}
    sheets = workbook_xml.find(f"{{{NS_MAIN}}}sheets")
    for sheet in sheets:
        targets[sheet.attrib["name"]] = rel_map[sheet.attrib[f"{{{NS_REL}}}id"]]
    return targets


def read_sheet_xml(xlsx_path: Path, sheet_name: str):
    targets = workbook_sheet_targets(xlsx_path)
    with zipfile.ZipFile(xlsx_path, "r") as archive:
        return archive.read(targets[sheet_name])


def update_defined_names(
    workbook_xml_bytes: bytes,
    print_areas: dict[str, str],
    filter_databases: dict[str, str] | None = None,
    print_titles: dict[str, str] | None = None,
):
    workbook = ET.fromstring(workbook_xml_bytes)
    sheets = workbook.find(f"{{{NS_MAIN}}}sheets")
    sheet_id_to_name = {str(index): sheet.attrib["name"] for index, sheet in enumerate(sheets)}
    defined_names = workbook.find(f"{{{NS_MAIN}}}definedNames")
    if defined_names is None:
        defined_names = ET.SubElement(workbook, f"{{{NS_MAIN}}}definedNames")

    filter_databases = filter_databases or {}
    print_titles = print_titles or {}
    updated_print_areas = set()
    updated_filters = set()
    updated_titles = set()
    for defined_name in defined_names.findall(f"{{{NS_MAIN}}}definedName"):
        defined_name_name = defined_name.attrib.get("name")
        local_sheet_id = defined_name.attrib.get("localSheetId")
        sheet_name = sheet_id_to_name.get(local_sheet_id)
        if defined_name_name == "_xlnm.Print_Area" and sheet_name in print_areas:
            defined_name.text = print_areas[sheet_name]
            updated_print_areas.add(sheet_name)
        elif defined_name_name == "_xlnm._FilterDatabase" and sheet_name in filter_databases:
            defined_name.text = filter_databases[sheet_name]
            updated_filters.add(sheet_name)
        elif defined_name_name == "_xlnm.Print_Titles" and sheet_name in print_titles:
            defined_name.text = print_titles[sheet_name]
            updated_titles.add(sheet_name)

    for local_sheet_id, sheet_name in sheet_id_to_name.items():
        if sheet_name in print_areas and sheet_name not in updated_print_areas:
            element = ET.SubElement(
                defined_names,
                f"{{{NS_MAIN}}}definedName",
                {"name": "_xlnm.Print_Area", "localSheetId": local_sheet_id},
            )
            element.text = print_areas[sheet_name]
        if sheet_name in filter_databases and sheet_name not in updated_filters:
            element = ET.SubElement(
                defined_names,
                f"{{{NS_MAIN}}}definedName",
                {"name": "_xlnm._FilterDatabase", "localSheetId": local_sheet_id, "hidden": "1"},
            )
            element.text = filter_databases[sheet_name]
        if sheet_name in print_titles and sheet_name not in updated_titles:
            element = ET.SubElement(
                defined_names,
                f"{{{NS_MAIN}}}definedName",
                {"name": "_xlnm.Print_Titles", "localSheetId": local_sheet_id},
            )
            element.text = print_titles[sheet_name]

    return ET.tostring(workbook, encoding="utf-8", xml_declaration=True)


def update_table_xml(table_xml_bytes: bytes, table_ref: str):
    table = ET.fromstring(table_xml_bytes)
    table.set("ref", table_ref)
    auto_filter = table.find(f"{{{NS_MAIN}}}autoFilter")
    if auto_filter is None:
        auto_filter = ET.SubElement(table, f"{{{NS_MAIN}}}autoFilter")
    auto_filter.set("ref", table_ref)
    return ET.tostring(table, encoding="utf-8", xml_declaration=True)


def build_lookup_rows(payload):
    rows = []
    max_rows = max(len(payload["table1"]), len(payload["table2"]), len(payload["table3"]), 10)
    for _ in range(max_rows + 1):
        rows.append([None] * 10)

    rows[0][0] = "KhungTG"
    rows[0][1] = "ThoiGian"
    rows[0][3] = "MaLop"
    rows[0][4] = "TenLop"
    rows[0][5] = "HocPhi/Buoi"
    rows[0][6] = "BuoiHoc/Tuan"
    rows[0][8] = "MaThu"
    rows[0][9] = "TenThu"

    for index, item in enumerate(payload["table1"], start=1):
        rows[index][0] = item["khungTg"]
        rows[index][1] = item["thoiGian"]

    for index, item in enumerate(payload["table2"], start=1):
        rows[index][3] = item["maLop"]
        rows[index][4] = item["tenLop"]
        rows[index][5] = item["hocPhiBuoi"]
        rows[index][6] = item["buoiHocTuan"]

    for index, item in enumerate(payload["table3"], start=1):
        rows[index][8] = item["maThu"]
        rows[index][9] = item["tenThu"]

    return rows


def build_chi_tiet_rows(items):
    top_title = [None] * 59
    top_title[0] = "HOME"
    top_title[4] = "THÔNG TIN LỚP HỌC"
    blank = [None] * 59
    human_headers = [None] * 59
    machine_headers = [None] * 59

    header_values = [
        "Ngay thang",
        "TenThu",
        "Ten NV",
        "Đến S",
        "Về S",
        "Đến C",
        "Về C",
        "Column4",
        "ThoiGian",
        "MaLop",
        "TenLop",
        "Giáo viên",
        "Trợ giảng",
        "Trợ giảng 2",
        "Buoi so",
        "TTHoc",
        "Column42",
        "Them (h)",
        "Đi muộn TG",
        "Cộng giờ TG",
        "DG TG",
        "Column6",
        "GhiChu",
        "Column5",
        "Nhac viec 1",
        "Nhac viec 2",
        "Phat sinh",
        "Ngay HT",
        "Ket qua",
        "Column2",
        "So_Gio",
        "So_gio_GV",
        "Luongh_GV",
        "Ca_Gio",
        "Tien_GV",
        "So_gio_TG",
        "Luongh_TG",
        "Tien_TG",
        "Gio NV",
        "Cong NV",
        "TenLop2",
        "TenLop3",
        "am/pm",
        "Column1",
        "Thu&Buoi&Lop",
        "Tháng",
        "Time và buoi",
        "So buoi hoc",
        "So buoi nghi",
        "Tuần",
        "HomNay",
        "Column3",
    ]
    human_values = [
        "Ngày tháng",
        "Thứ",
        "Tên NV",
        "Time đến \nS",
        "Time về \nS",
        "Time đến \nC",
        "Time về \nC",
        None,
        "Thời gian",
        "Mã lớp",
        "Tên lớp",
        "Giáo viên",
        "Trợ \ngiảng 1",
        "Trợ Giảng Nghỉ",
        "  Buổi số",
        "TT Học",
        None,
        "Thêm\n(h)",
        "Đi muộn \nTG",
        "Cộng giờ\nTG",
        "ĐG TG",
        None,
        "Ghi chú",
        None,
        "Nhắc việc 1",
        "Nhắc việc 2",
        "Phát sinh",
        "Ngày HT",
        "Kết quả",
        None,
        "Số\nGiờ",
        "Số\ngiờ GV",
        "Lươngh\nGV",
        "Ca/Giờ",
        "Tiền GV",
        "Số giờ\nTG",
        "Lươngh\nTG",
        "Tiền TG",
        "Giờ NV",
        "Công NV",
        "TênLop2",
        "TênLop3",
        "am/pm",
        "Column1",
        "Thứ&Buổi&Lớp",
        "Tháng",
        "Time và buoi",
        "Số buổi học",
        "Số buổi nghỉ",
        "Tuần",
        "HômNay",
        "Column3",
    ]
    for offset, value in enumerate(human_values, start=5):
        human_headers[offset - 1] = value
    for offset, value in enumerate(header_values, start=5):
        machine_headers[offset - 1] = value

    rows = [top_title, blank.copy(), human_headers, blank.copy(), machine_headers]
    data_fields = [
        "LoaiDong",
        "Ngay thang",
        "TenThu",
        "Ten NV",
        "Đến S",
        "Về S",
        "Đến C",
        "Về C",
        "Column4",
        "ThoiGian",
        "MaLop",
        "TenLop",
        "Giáo viên",
        "Trợ giảng",
        "Trợ giảng 2",
        "Buoi so",
        "TTHoc",
        "Column42",
        "Them (h)",
        "Đi muộn TG",
        "Cộng giờ TG",
        "DG TG",
        "Column6",
        "GhiChu",
        "Column5",
        "Nhac viec 1",
        "Nhac viec 2",
        "Phat sinh",
        "Ngay HT",
        "Ket qua",
        "Column2",
        "So_Gio",
        "So_gio_GV",
        "Luongh_GV",
        "Ca_Gio",
        "Tien_GV",
        "So_gio_TG",
        "Luongh_TG",
        "Tien_TG",
        "Gio NV",
        "Cong NV",
        "TenLop2",
        "TenLop3",
        "am/pm",
        "Column1",
        "Thu&Buoi&Lop",
        "Tháng",
        "Time và buoi",
        "So buoi hoc",
        "So buoi nghi",
        "Tuần",
        "HomNay",
        "Column3",
    ]
    for item in items:
        row = [None] * 59
        row[4] = item["ngayThang"]
        row[5] = item["tenThu"]
        row[6] = item["tenNv"]
        row[7] = item["denS"]
        row[8] = item["veS"]
        row[9] = item["denC"]
        row[10] = item["veC"]
        row[11] = item["column4"]
        row[12] = item["thoiGian"]
        row[13] = item["maLop"]
        row[14] = item["tenLop"]
        row[15] = item["giaoVien"]
        row[16] = item["troGiang"]
        row[17] = item["troGiang2"]
        row[18] = item["buoiSo"]
        row[19] = item["ttHoc"]
        row[20] = item["column42"]
        row[21] = item["themH"]
        row[22] = item["diMuonTg"]
        row[23] = item["congGioTg"]
        row[24] = item["dgTg"]
        row[25] = item["column6"]
        row[26] = item["ghiChu"]
        row[27] = item["column5"]
        row[28] = item["nhacViec1"]
        row[29] = item["nhacViec2"]
        row[30] = item["phatSinh"]
        row[31] = item["ngayHt"]
        row[32] = item["ketQua"]
        row[33] = item["column2"]
        row[34] = item["soGio"]
        row[35] = item["soGioGv"]
        row[36] = item["luonghGv"]
        row[37] = item["caGio"]
        row[38] = item["tienGv"]
        row[39] = item["soGioTg"]
        row[40] = item["luonghTg"]
        row[41] = item["tienTg"]
        row[42] = item["gioNv"]
        row[43] = item["congNv"]
        row[44] = item["tenLop2"]
        row[45] = item["tenLop3"]
        row[46] = item["amPm"]
        row[47] = item["column1"]
        row[48] = item["thuBuoiLop"]
        row[49] = item["thang"]
        row[50] = item["timeVaBuoi"]
        row[51] = item["soBuoiHoc"]
        row[52] = item["soBuoiNghi"]
        row[53] = item["tuan"]
        row[54] = item["homNay"]
        row[55] = item["column3"]
        rows.append(row)
    return rows


def build_positioned_sheet(total_cols, start_row, start_col, header_rows, data_rows):
    total_rows = start_row - 1 + len(header_rows) + len(data_rows)
    rows = [[None] * total_cols for _ in range(total_rows)]
    for row_offset, row_values in enumerate(header_rows, start=start_row):
        for col_offset, value in enumerate(row_values, start=start_col):
            if col_offset - 1 < total_cols:
                rows[row_offset - 1][col_offset - 1] = value
    data_start_row = start_row + len(header_rows)
    for row_index, row_values in enumerate(data_rows, start=data_start_row):
        for col_offset, value in enumerate(row_values, start=start_col):
            if col_offset - 1 < total_cols:
                rows[row_index - 1][col_offset - 1] = value
    return rows


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


def get_week_number_from_iso(date_text):
    try:
        return datetime.strptime(date_text, "%Y-%m-%d").isocalendar().week
    except Exception:
        return ""


def main():
    payload_arg = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\lehoa\AppData\Local\Temp\erp-report-patch\report_patch_payload.json"
    payload_path = Path(payload_arg)
    payload = json.loads(payload_path.read_text(encoding="utf-8"))
    xlsx_path = Path(payload["workbookPath"])
    backup_path = Path(payload.get("backupWorkbookPath") or xlsx_path.with_name("File Quan ly tong 2026.backup-2026-07-30.xlsx"))
    temp_path = xlsx_path.with_suffix(".sync.xlsx")
    targets = workbook_sheet_targets(xlsx_path)
    with zipfile.ZipFile(xlsx_path, "r") as current_archive:
        workbook_xml_bytes = current_archive.read("xl/workbook.xml")

    hs_rows = [
        ["REPORT_HS - ERP", None, None, None, None, None],
        ["Đối soát học viên theo dữ liệu thật từ ERP", None, None, None, None, None],
        [None] * 6,
        ["Tóm tắt", None],
        ["Chỉ số", "Giá trị"],
        ["Tổng số HS", payload["reportHs"]["totalStudents"]],
        ["Số HS đang học", payload["reportHs"]["activeStudents"]],
        ["Số HS nghỉ", payload["reportHs"]["leftStudents"]],
        ["Số HS nhập học", payload["reportHs"]["newEnrollments"]],
        [None] * 6,
        [None] * 6,
        ["Theo lớp", None, None, None, None],
        ["Mã lớp", "Tên lớp", "Đang học", "Đã nghỉ", "Tổng"],
    ]
    for item in payload["reportHs"]["classes"]:
        hs_rows.append([item["classCode"], item["className"], item["activeCount"], item["leftCount"], item["totalCount"]])

    hp_rows = [
        ["REPORT_HP - ERP", None, None, None, None, None, None, None, None, None],
        ["Đối soát học phí theo dữ liệu thật từ ERP", None, None, None, None, None, None, None, None, None],
        [f"Kỳ học phí: {payload['reportHp']['periodName'] or 'Chưa có kỳ'}", None, None, None, None, None, None, None, None, None],
        [None] * 10,
        ["Tổng hợp", None, None, None, None, None, None, None, None, None],
        ["Số buổi", "Giáo trình", "HP tồn tháng trước", "Tổng học phí", "Phải thu", "Đã thu", "Còn lại", None, None, None],
        [
            payload["reportHp"]["totals"]["sessionCount"],
            payload["reportHp"]["totals"]["materialsAmount"],
            payload["reportHp"]["totals"]["openingBalance"],
            payload["reportHp"]["totals"]["tuitionAmount"],
            payload["reportHp"]["totals"]["billedAmount"],
            payload["reportHp"]["totals"]["collectedAmount"],
            payload["reportHp"]["totals"]["remainingAmount"],
            None,
            None,
            None,
        ],
        [None] * 10,
        [None] * 10,
        ["Theo lớp", None, None, None, None, None, None, None, None, None],
        ["Mã lớp", "Tên lớp", "Số HV", "Số buổi", "Giáo trình", "HP tồn tháng trước", "Tổng học phí", "Phải thu", "Đã thu", "Còn lại"],
    ]
    for item in payload["reportHp"]["classes"]:
        hp_rows.append(
            [
                item["classCode"],
                item["className"],
                item["studentCount"],
                item["sessionCount"],
                item["materialsAmount"],
                item["openingBalance"],
                item["tuitionAmount"],
                item["billedAmount"],
                item["collectedAmount"],
                item["remainingAmount"],
            ]
        )

    cong_luong_rows = [
        ["REPORT_CONG_LUONG - ERP", None, None, None, None],
        ["Đối soát công lương theo dữ liệu thật từ ERP", None, None, None, None],
        [f"Kỳ gần nhất: {payload['reportCongLuong']['periodName'] or 'Chưa có kỳ'}", None, None, None, None],
        [None] * 5,
        ["Tổng lương theo kỳ", None, None, None, None],
        ["Kỳ", "Tổng lương", None, None, None],
    ]
    for item in payload["reportCongLuong"]["payrollByPeriod"]:
        cong_luong_rows.append([item["period"], item["total"], None, None, None])
    cong_luong_rows.extend([[None] * 5, ["Giáo viên", None, None, None, None], ["Tên", "Giờ", "Thành tiền", None, None]])
    for item in payload["reportCongLuong"]["teachers"]:
        cong_luong_rows.append([item["name"], item["hours"], item["amount"], None, None])
    cong_luong_rows.extend([[None] * 5, ["Trợ giảng", None, None, None, None], ["Tên", "Giờ", "Thành tiền", None, None]])
    if payload["reportCongLuong"]["assistants"]:
        for item in payload["reportCongLuong"]["assistants"]:
            cong_luong_rows.append([item["name"], item["hours"], item["amount"], None, None])
    else:
        cong_luong_rows.append(["Chưa có dữ liệu trợ giảng", None, None, None, None])

    sinh_nhat_rows = [
        ["SINH_NHAT_HV - ERP", None, None, None],
        ["Danh sách sinh nhật học viên theo dữ liệu thật từ ERP", None, None, None],
        [f"Tháng báo cáo: {payload['sinhNhatHv']['month']}", None, None, None],
        [None] * 4,
        ["Mã HV", "Họ tên", "Ngày sinh", None],
    ]
    if payload["sinhNhatHv"]["students"]:
        for item in payload["sinhNhatHv"]["students"]:
            sinh_nhat_rows.append([item["studentCode"], item["fullName"], item["dob"], None])
    else:
        sinh_nhat_rows.append(["Không có học viên sinh nhật trong tháng", None, None, None])

    theo_doi_hp_rows = [
        ["THEO_DOI_HP - ERP", None, None, None, None, None, None, None, None, None, None, None, None, None, None, None],
        ["Công nợ học phí đồng bộ từ ERP", None, None, None, None, None, None, None, None, None, None, None, None, None, None, None],
        ["Kỳ", "Mã HV", "Tên học viên", "Mã lớp", "Tên lớp", "Số buổi", "Buổi nghỉ", "Buổi trừ", "Đơn giá", "Học phí", "Giáo trình", "Đầu kỳ", "Phải thu", "Đã thu", "Còn lại", "Trạng thái"],
    ]
    if payload["theoDoiHp"]:
        for item in payload["theoDoiHp"]:
            theo_doi_hp_rows.append(
                [
                    item["periodName"],
                    item["studentCode"],
                    item["studentName"],
                    item["classCode"],
                    item["className"],
                    item["sessionCount"],
                    item["absentCount"],
                    item["deductedCount"],
                    item["unitPrice"],
                    item["tuitionAmount"],
                    item["materialsAmount"],
                    item["openingBalance"],
                    item["totalAmount"],
                    item["paidAmount"],
                    item["remainingAmount"],
                    item["paymentStatus"],
                ]
            )
    else:
        theo_doi_hp_rows.append(["Chưa có công nợ học phí", None, None, None, None, None, None, None, None, None, None, None, None, None, None, None])

    thu_chi_rows = [
        ["THU_CHI - ERP", None, None, None, None, None, None, None],
        ["Sổ quỹ đồng bộ từ ERP", None, None, None, None, None, None, None],
        ["Ngày", "Loại", "Danh mục", "Chi tiết", "Diễn giải", "Số tiền", "Người xử lý", "Trạng thái"],
    ]
    if payload["thuChi"]:
        for item in payload["thuChi"]:
            thu_chi_rows.append(
                [
                    item["txnDate"],
                    item["type"],
                    item["categoryName"],
                    item["detail"],
                    item["description"],
                    item["amount"],
                    item["handledBy"],
                    item["status"],
                ]
            )
    else:
        thu_chi_rows.append(["Chưa có giao dịch thu chi", None, None, None, None, None, None, None])

    xuat_nhap_sach_rows = [
        ["XUAT_NHAP_SACH - ERP", None, None, None, None, None, None, None, None],
        ["Kho giáo trình đồng bộ từ ERP", None, None, None, None, None, None, None, None],
        ["Tồn kho", None, None, None, None, None, None, None, None],
        ["Mã sách", "Tên sách", "Đơn giá", "Tồn kho", "Giá trị tồn", None, None, None, None],
    ]
    for item in payload["xuatNhapSach"]["tonKho"]:
        xuat_nhap_sach_rows.append([item["bookCode"], item["name"], item["unitPrice"], item["quantityOnHand"], item["stockValue"], None, None, None, None])
    xuat_nhap_sach_rows.extend([[None] * 9, ["Nhập kho", None, None, None, None, None, None, None, None], ["Ngày", "Mã sách", "Tên sách", "SL nhập", "Đơn giá", "Thành tiền", None, None, None]])
    if payload["xuatNhapSach"]["nhapKho"]:
        for item in payload["xuatNhapSach"]["nhapKho"]:
            xuat_nhap_sach_rows.append([item["txnDate"], item["bookCode"], item["bookName"], item["quantity"], item["unitPrice"], item["totalAmount"], None, None, None])
    else:
        xuat_nhap_sach_rows.append(["Chưa có nhập kho", None, None, None, None, None, None, None, None])
    xuat_nhap_sach_rows.extend([[None] * 9, ["Xuất sách", None, None, None, None, None, None, None, None], ["Ngày", "Mã sách", "Tên sách", "Mã HV", "Tên HV", "Lớp", "SL", "Đơn giá", "Thành tiền"]])
    if payload["xuatNhapSach"]["xuatKho"]:
        for item in payload["xuatNhapSach"]["xuatKho"]:
            xuat_nhap_sach_rows.append([item["issueDate"], item["bookCode"], item["bookName"], item["studentCode"], item["studentName"], item["className"], item["quantity"], item["unitPrice"], item["amount"]])
    else:
        xuat_nhap_sach_rows.append(["Chưa có xuất sách", None, None, None, None, None, None, None, None])

    nhan_su_rows = [
        ["NHAN_SU - ERP", None, None, None, None, None, None, None, None, None, None, None],
        ["Nhân sự đồng bộ từ ERP", None, None, None, None, None, None, None, None, None, None, None],
        ["Mã NV", "Họ và tên", "Tên ngắn", "Vị trí", "SĐT", "Email", "Trạng thái", "Số HĐ", "Ngày ký", "Hạn HĐ", "Loại lương", "Đơn giá"],
    ]
    if payload["nhanSu"]:
        for item in payload["nhanSu"]:
            nhan_su_rows.append(
                [
                    item["employeeCode"],
                    item["fullName"],
                    item["shortName"],
                    item["position"],
                    item["phone"],
                    item["email"],
                    item["workStatus"],
                    item["contractNo"],
                    item["signDate"],
                    item["expiryDate"],
                    item["payType"] or item["payRole"],
                    item["payRate"],
                ]
            )
    else:
        nhan_su_rows.append(["Chưa có dữ liệu nhân sự", None, None, None, None, None, None, None, None, None, None, None])

    dshv_rows = [
        ["DSHV - ERP", None, None, None, None, None, None, None, None, None],
        ["Danh sách học viên đồng bộ từ ERP", None, None, None, None, None, None, None, None, None],
        ["Mã HV", "Mã hiển thị", "Họ tên", "Mã lớp", "Tên lớp", "Ngày nhập", "Ngày nghỉ", "Trạng thái", "Đánh giá", "Địa chỉ"],
    ]
    if payload["dshv"]:
        for item in payload["dshv"]:
            dshv_rows.append(
                [
                    item["studentCode"],
                    item["displayId"],
                    item["fullName"],
                    item["classCode"],
                    item["className"],
                    item["enrollDate"],
                    item["leaveDate"],
                    item["status"],
                    item["evaluation"],
                    item["address"],
                ]
            )
    else:
        dshv_rows.append(["Chưa có dữ liệu học viên", None, None, None, None, None, None, None, None, None])

    dslop_rows = [
        ["DSLOP - ERP", None, None, None, None, None, None, None, None, None, None],
        ["Danh sách lớp đồng bộ từ ERP", None, None, None, None, None, None, None, None, None, None],
        ["Mã lớp", "Tên lớp", "Mã khóa", "Tên khóa", "Tổng buổi", "Ngày bắt đầu", "Ngày kết thúc dự kiến", "Buổi/tuần", "HP/buổi", "Số HV", "Trạng thái"],
    ]
    if payload["dslop"]:
        for item in payload["dslop"]:
            dslop_rows.append(
                [
                    item["classCode"],
                    item["className"],
                    item["courseCode"],
                    item["courseName"],
                    item["totalSessions"],
                    item["startDate"],
                    item["expectedEndDate"],
                    item["sessionsPerWeek"],
                    item["tuitionPerSession"],
                    item["studentCount"],
                    item["status"],
                ]
            )
    else:
        dslop_rows.append(["Chưa có dữ liệu lớp", None, None, None, None, None, None, None, None, None, None])

    dstest_rows = [
        ["DSTEST - ERP", None, None, None, None, None, None, None, None, None, None, None, None],
        ["Danh sách lead và test đầu vào đồng bộ từ ERP", None, None, None, None, None, None, None, None, None, None, None, None],
        ["Mã lead", "Họ tên HV", "Ngày sinh", "PH", "SĐT", "Ngày gặp", "Ngày test", "TT test", "Lớp quan tâm", "Ngày dự kiến học", "Ngày nhập học", "Trạng thái", "Địa chỉ"],
    ]
    if payload["dstest"]:
        for item in payload["dstest"]:
            dstest_rows.append(
                [
                    item["leadCode"],
                    item["fullName"],
                    item["dob"],
                    item["guardianName"],
                    item["phone"],
                    item["meetDate"],
                    item["testDate"],
                    item["testStatus"],
                    item["interestedClass"],
                    item["expectedStartDate"],
                    item["actualEnrollDate"],
                    item["status"],
                    item["address"],
                ]
            )
    else:
        dstest_rows.append(["Chưa có dữ liệu tuyển sinh", None, None, None, None, None, None, None, None, None, None, None, None])

    theo_doi_hp_positioned = build_positioned_sheet(
        55,
        1,
        5,
        [
            ["STT", "Mã lớp", "Tên lớp", "Tên HV", "Tháng", "Số buổi nghỉ trừ ngoại lệ", "HP đầu kỳ", "BH điều chỉnh", "Số buổi", "Đơn giá", "HP tháng hiện tại", "Tiền giáo trình", "Tổng HP", "Tiền nộp", "Còn lại", "Tình trạng"],
            ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
            ["STT", "MaLop", "TenLop", "Ten HV", "HP Tháng", "Buoi tru", "HP dau ky", "HB dieu chinh", "So buoi", "ĐG", "HP thang hien tai", "TienGiaoTrinh", "TongHP", "TienNop", "Con lai", "Tình trạng đóng học phí"],
        ],
        [
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
        ]
        or [["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]],
    )

    thu_chi_positioned = [[None] * 44 for _ in range(max(len(payload["thuChi"]) + 6, 26))]
    total_chi = sum(item["amount"] for item in payload["thuChi"] if item["type"] == "CHI")
    total_thu = sum(item["amount"] for item in payload["thuChi"] if item["type"] == "THU")
    thu_chi_positioned[0][2] = "BÁO CÁO TIỀN MẶT"
    thu_chi_positioned[5][2] = "Mục chi:"
    thu_chi_positioned[5][8] = "Mục thu:"
    chi_headers = ["Ngày tháng", "Loại chi", "Chi tiết các loại", "Diễn giải", "Column2", "Số tiền", "Người thu/chi", "Ghi chú", "Tháng chi", "Tuan chi"]
    thu_headers = ["Ngày tháng", "Loại thu", "Chi tiết các loại", "Diễn giải", "Column1", "Column2", "Số tiền", "Người thu/chi", "Ghi chú", "Tháng thu", "Tuan thu"]
    phan_loai_headers = ["LoaiHinh", "TenThuChi", "ChiTietLoai", "GhiChu", "nguoi chi", "nguoi Thu"]
    for idx, value in enumerate(chi_headers, start=15):
        thu_chi_positioned[4][idx - 1] = value
    for idx, value in enumerate(thu_headers, start=26):
        thu_chi_positioned[4][idx - 1] = value
    for idx, value in enumerate(phan_loai_headers, start=38):
        thu_chi_positioned[3][idx - 1] = value
    chi_rows = [item for item in payload["thuChi"] if item["type"] == "CHI"]
    thu_rows = [item for item in payload["thuChi"] if item["type"] == "THU"]
    max_cash_rows = max(len(chi_rows), len(thu_rows), 1)
    for offset in range(max_cash_rows):
        excel_row = 5 + offset
        if offset < len(chi_rows):
            item = chi_rows[offset]
            values = [item["txnDate"], item["categoryName"], item["detail"], item["description"], "", item["amount"], item["handledBy"], item["status"], item["txnDate"][:7], ""]
            for idx, value in enumerate(values, start=15):
                thu_chi_positioned[excel_row][idx - 1] = value
        if offset < len(thu_rows):
            item = thu_rows[offset]
            values = [item["txnDate"], item["categoryName"], item["detail"], item["description"], "", "", item["amount"], item["handledBy"], item["status"], item["txnDate"][:7], ""]
            for idx, value in enumerate(values, start=26):
                thu_chi_positioned[excel_row][idx - 1] = value
    category_names = sorted({item["categoryName"] for item in payload["thuChi"] if item["categoryName"]})
    for offset, name in enumerate(category_names):
        excel_row = 4 + offset
        values = ["Chi" if any(item["type"] == "CHI" and item["categoryName"] == name for item in payload["thuChi"]) else "Thu", name, name, "", "", ""]
        for idx, value in enumerate(values, start=38):
            thu_chi_positioned[excel_row][idx - 1] = value

    xuat_nhap_sach_positioned = [[None] * 46 for _ in range(max(len(payload["xuatNhapSach"]["xuatKho"]) + 7, len(payload["xuatNhapSach"]["nhapKho"]) + 7, len(payload["xuatNhapSach"]["tonKho"]) + 7, 20))]
    xuat_nhap_sach_positioned[0][0] = "HOME"
    xuat_nhap_sach_positioned[0][4] = "THEO DÕI PHÁT SÁCH 2025"
    xuat_headers = ["STT", "MaLop", "TenLop", "TenHV&MaHV", "TenSach", "NgayThang", "Column3", "SL", "DonGia", "TienGiaoTrinh", "TTTien", "GhiChu", "Column1", "Tháng xuất", "Column2"]
    nhap_headers = ["Ngày tháng", "Malop", "TenSach", "SL nhập", "Người nhập", "Người giao", "Tổng tiền", "Ghi chú", "Đơn giá", "Tình trạng sử dụng", "Column1", "Tháng nhập", "Column2"]
    ton_headers = ["STT", "MaLop", "TenSach", "Column4", "DonGia", "Column3", "Column1", "Column2", "Số Lượng", "GhiChu"]
    for idx, value in enumerate(xuat_headers, start=5):
        xuat_nhap_sach_positioned[5][idx - 1] = value
    for idx, value in enumerate(nhap_headers, start=21):
        xuat_nhap_sach_positioned[5][idx - 1] = value
    for idx, value in enumerate(ton_headers, start=35):
        xuat_nhap_sach_positioned[5][idx - 1] = value
    for offset, item in enumerate(payload["xuatNhapSach"]["xuatKho"], start=6):
        values = [offset - 5, "", item["className"], f'{item["studentName"]} - {item["studentCode"]}', item["bookName"], item["issueDate"], item["paymentStatus"], item["quantity"], item["unitPrice"], item["amount"], item["paymentStatus"], "", "", item["issueDate"][:7], ""]
        for idx, value in enumerate(values, start=5):
            xuat_nhap_sach_positioned[offset][idx - 1] = value
    for offset, item in enumerate(payload["xuatNhapSach"]["nhapKho"], start=6):
        values = [item["txnDate"], item["bookCode"], item["bookName"], item["quantity"], "", "", item["totalAmount"], "", item["unitPrice"], "", "", item["txnDate"][:7], ""]
        for idx, value in enumerate(values, start=21):
            xuat_nhap_sach_positioned[offset][idx - 1] = value
    for offset, item in enumerate(payload["xuatNhapSach"]["tonKho"], start=6):
        values = [offset - 5, item["bookCode"], item["name"], "", item["unitPrice"], item["stockValue"], "", "", item["quantityOnHand"], ""]
        for idx, value in enumerate(values, start=35):
            xuat_nhap_sach_positioned[offset][idx - 1] = value

    nhan_su_positioned = build_positioned_sheet(
        27,
        3,
        4,
        [
            ["STT", "Mã NV", "Họ và tên", "Tên ngắn", "Ngày sinh", "Vị trí", "Lương giờ", "Lương theo", "SĐT", "Email", "Trạng thái", "Số HĐ", "Ngày ký", "Hạn HĐ"],
            ["", "", "Họ và tên", "", "", "Vị trí", "", "", "", "", "", "", "", ""],
            ["STT", "Mã NV", "Họ và tên", "Tên ngắn", "Ngày sinh", "Vị trí", "Column3", "Column4", "SĐT", "Email", "Trạng thái", "Số HĐ", "Ngày ký", "Hạn HĐ"],
        ],
        [
            [index, item["employeeCode"], item["fullName"], item["shortName"], "", item["position"], item["payRate"], item["payType"] or item["payRole"], item["phone"], item["email"], item["workStatus"], item["contractNo"], item["signDate"], item["expiryDate"]]
            for index, item in enumerate(payload["nhanSu"], start=1)
        ]
        or [["", "", "", "", "", "", "", "", "", "", "", "", "", ""]],
    )

    dshv_positioned = [[None] * 88 for _ in range(max(len(payload["dshv"]) + 5, 8))]
    human = ["Mã lớp", "Tên lớp", "Tên HV", "Ngày nhập học", "Ngày nghỉ", "Lí do nghỉ", "Người giới thiệu", "HP tồn đến hiện tại"]
    machine = ["MaLop", "TenLop", "TenHV", "Ngay nhap", "Ngay nghi", "Lí do nghỉ", "DanhGia", "HP tồn", "Column4", "Column5", "Column3", "MaSo", "Tình trạng học", "Sđt", "Column2", "TenHV&MaSo", "Ho ten", "MaHV", "TenHV&MaHV", "Tháng sinh nhật", "HocPhi/Buoi"]
    for idx, value in enumerate(human, start=5):
        dshv_positioned[0][idx - 1] = value
    dshv_positioned[2][6] = "=SUBTOTAL(3,T_HV[TenHV])"
    dshv_positioned[2][11] = "=SUBTOTAL(9,T_HV[HP tồn])"
    for idx, value in enumerate(machine, start=5):
        dshv_positioned[3][idx - 1] = value
    for offset, item in enumerate(payload["dshv"], start=4):
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
            "",
            "",
        ]
        for idx, value in enumerate(values, start=5):
            dshv_positioned[offset][idx - 1] = value

    dslop_positioned = build_positioned_sheet(
        26,
        3,
        1,
        [
            ["Mã lớp", "Lớp", "Tên lớp", "SL buổi học", "Ngày khai giảng", "Ngày KT dự kiến", "Ngày KT thực tế", "Buổi số bắt đầu", "Số buổi đã nghỉ", "SL buổi học tới hiện tại", "SL buổi còn lại", "Ghi chú"],
            ["", "", "", "", "", "", "", "", "", "", "", ""],
            ["MaLop", "Lop", "Ten lop", "SLBuoiHoc", "NgayBD", "NgayKTDuKien", "Column5", "Buoi so", "So buoi nghi", "Column4", "Con lai", "GhiChu"],
        ],
        [
            [item["classCode"], item["courseCode"], item["className"], item["totalSessions"], item["startDate"], item["expectedEndDate"], "", 0, 0, item["studentCount"], max((item["totalSessions"] or 0) - item["studentCount"], 0), item["status"]]
            for item in payload["dslop"]
        ]
        or [["", "", "", "", "", "", "", "", "", "", "", ""]],
    )

    dstest_positioned = build_positioned_sheet(
        37,
        4,
        5,
        [
            ["Ngày gặp", "Họ tên HV", "Giới tính", "Ngày sinh", "Tuổi", "Lớp Đang học ở trường", "Họ tên PH", "Sdt", "Ngày test", "Tình trạng test", "Lớp quan tâm", "Ngày dự kiến học", "Ngày nhập học", "Trạng thái", "Địa chỉ"],
            ["", "", "", "", "", "", "Họ tên mẹ", "Sdt", "", "", "", "", "", "", ""],
            ["NgayGap", "HoTenHV", "GioiTinh", "DoB", "tuoi", "LopHoc", "HoTenPH", "Sdt", "NgayTest", "Tình trạng test", "Lớp quan tâm", "Ngày dự kiến đi học", "Ngày nhập học", "Trạng thái", "Địa chỉ"],
        ],
        [
            [item["meetDate"], item["fullName"], "", item["dob"], "", "", item["guardianName"], item["phone"], item["testDate"], item["testStatus"], item["interestedClass"], item["expectedStartDate"], item["actualEnrollDate"], item["status"], item["address"]]
            for item in payload["dstest"]
        ]
        or [["", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]],
    )

    report_hs_positioned = build_positioned_sheet(
        59,
        1,
        1,
        [
            [None, None, None, "UPDATE HS CÁC LỚP"],
            [None, None, None, None, None, None, None, None, None, None, None, "SỐ LƯỢNG HV ĐANG HỌC"],
            [],
            [None, None, None, None, None, None, None, None, None, None, None, None, "Column Labels"],
            [None, None, None, "Row Labels", "Tổng số HS", "Số HS nghỉ", None, None, None, None, None, None, "(blank)", "Tổng cộng"],
            [None, None, None, "(blank)", payload["reportHs"]["totalStudents"], payload["reportHs"]["leftStudents"], None, None, None, None, None, "SL HV đang theo học", payload["reportHs"]["activeStudents"], payload["reportHs"]["activeStudents"]],
            [None, None, None, "Grand Total", payload["reportHs"]["totalStudents"], payload["reportHs"]["leftStudents"], None, None, None, None, None, None, payload["reportHs"]["activeStudents"], payload["reportHs"]["activeStudents"]],
            [],
            [],
            [],
            [],
            [None, None, None, None, None, None, None, None, None, None, None, "SỐ LƯỢNG HV NGHỈ HỌC"],
            [],
            [None, None, None, None, None, None, None, None, None, None, None, None, "Column Labels"],
            [None, None, None, "Row Labels", "Số HS nghỉ", "(blank)", "Tổng cộng"],
            [None, None, None, "(blank)", payload["reportHs"]["leftStudents"], payload["reportHs"]["leftStudents"], payload["reportHs"]["leftStudents"]],
            [None, None, None, "Grand Total", payload["reportHs"]["leftStudents"], payload["reportHs"]["leftStudents"], payload["reportHs"]["leftStudents"]],
        ],
        [],
    )

    report_hp_positioned = build_positioned_sheet(
        30,
        1,
        1,
        [
            [None, "BẢNG TÍNH THUÊ PHÒNG", None, None, None, None, None, None, None, None, None, None, None, None, "TỔNG HỢP HỌC PHÍ"],
            [],
            [None, "Count of TTHoc", None, "TTHoc"],
            [None, "Tên Lớp", "Ghi Chú", "(blank)", "Tổng cộng"],
            [None, "(blank)", "(blank)", None, None, None, None, None, None, None, None, None, None, None, "Tên lớp", "Số buổi trong tháng", "Giáo trình", "HP tồn tháng trước", "Tổng học phí", "Tiền đã nộp", "Còn lại"],
            [None, "Tổng ca (blank)", None, None, None, None, None, None, None, None, None, None, None, None, payload["reportHp"]["classes"][0]["className"] if payload["reportHp"]["classes"] else "", payload["reportHp"]["totals"]["sessionCount"], payload["reportHp"]["totals"]["materialsAmount"], payload["reportHp"]["totals"]["openingBalance"], payload["reportHp"]["totals"]["tuitionAmount"], payload["reportHp"]["totals"]["collectedAmount"], payload["reportHp"]["totals"]["remainingAmount"]],
            [None, "Tổng cộng", None, None, None, None, None, None, None, None, None, None, None, None, "Tổng cộng", payload["reportHp"]["totals"]["sessionCount"], payload["reportHp"]["totals"]["materialsAmount"], payload["reportHp"]["totals"]["openingBalance"], payload["reportHp"]["totals"]["tuitionAmount"], payload["reportHp"]["totals"]["collectedAmount"], payload["reportHp"]["totals"]["remainingAmount"]],
        ],
        [],
    )

    report_cong_luong_positioned = build_positioned_sheet(
        33,
        1,
        1,
        [
            ["HOME", None, None, "Ten_GV", "Ca", "Số giờ/ca", "Tiền GV", "Trừ giờ GV", "Cộng giờ GV", None, "Ten_TG", "Số ca", "Số giờ", "Tiền TG", "Trừ giờ TG", "thêm giờ TG", None, "Row Labels", "Công", "Số giờ"],
            [
                None,
                None,
                None,
                payload["reportCongLuong"]["teachers"][0]["name"] if payload["reportCongLuong"]["teachers"] else "(blank)",
                payload["reportCongLuong"]["teachers"][0]["hours"] if payload["reportCongLuong"]["teachers"] else 0,
                payload["reportCongLuong"]["teachers"][0]["hours"] if payload["reportCongLuong"]["teachers"] else 0,
                payload["reportCongLuong"]["teachers"][0]["amount"] if payload["reportCongLuong"]["teachers"] else 0,
                None,
                None,
                None,
                payload["reportCongLuong"]["assistants"][0]["name"] if payload["reportCongLuong"]["assistants"] else "(blank)",
                payload["reportCongLuong"]["assistants"][0]["hours"] if payload["reportCongLuong"]["assistants"] else 0,
                payload["reportCongLuong"]["assistants"][0]["hours"] if payload["reportCongLuong"]["assistants"] else 0,
                payload["reportCongLuong"]["assistants"][0]["amount"] if payload["reportCongLuong"]["assistants"] else 0,
                None,
                None,
                None,
                payload["reportCongLuong"]["periodName"] or "Grand Total",
                (payload["reportCongLuong"]["payrollByPeriod"][0]["total"] if payload["reportCongLuong"]["payrollByPeriod"] else 0),
                payload["reportCongLuong"]["teachers"][0]["hours"] if payload["reportCongLuong"]["teachers"] else 0,
            ],
            [
                None,
                None,
                None,
                "Grand Total",
                payload["reportCongLuong"]["teachers"][0]["hours"] if payload["reportCongLuong"]["teachers"] else 0,
                payload["reportCongLuong"]["teachers"][0]["hours"] if payload["reportCongLuong"]["teachers"] else 0,
                payload["reportCongLuong"]["teachers"][0]["amount"] if payload["reportCongLuong"]["teachers"] else 0,
                None,
                None,
                None,
                "Grand Total",
                payload["reportCongLuong"]["assistants"][0]["hours"] if payload["reportCongLuong"]["assistants"] else 0,
                payload["reportCongLuong"]["assistants"][0]["hours"] if payload["reportCongLuong"]["assistants"] else 0,
                payload["reportCongLuong"]["assistants"][0]["amount"] if payload["reportCongLuong"]["assistants"] else 0,
                None,
                None,
                None,
                "Grand Total",
                (payload["reportCongLuong"]["payrollByPeriod"][0]["total"] if payload["reportCongLuong"]["payrollByPeriod"] else 0),
                payload["reportCongLuong"]["teachers"][0]["hours"] if payload["reportCongLuong"]["teachers"] else 0,
            ],
        ],
        [],
    )

    sinh_nhat_positioned = build_positioned_sheet(
        8,
        3,
        4,
        [
            ["Tháng sinh nhật", "TenLop", "TenHV", "Count of TenHV"],
            [payload["sinhNhatHv"]["month"].split("-")[1] if payload["sinhNhatHv"]["month"] else "", payload["sinhNhatHv"]["students"][0]["studentCode"] if payload["sinhNhatHv"]["students"] else "(blank)", payload["sinhNhatHv"]["students"][0]["fullName"] if payload["sinhNhatHv"]["students"] else "(blank)", len(payload["sinhNhatHv"]["students"])],
            ["Grand Total", None, None, len(payload["sinhNhatHv"]["students"])],
        ],
        [],
    )

    replacements = {
        targets["Report_HS"]: build_sheet(hs_rows, merges=["A1:F1", "A2:F2"]),
        targets["Report_HP"]: build_sheet(hp_rows, merges=["A1:J1", "A2:J2", "A3:J3"]),
        targets["Report_Cong_Luong"]: build_sheet(cong_luong_rows, merges=["A1:E1", "A2:E2", "A3:E3"]),
        targets["SinhNhatHV"]: build_sheet(sinh_nhat_rows, merges=["A1:D1", "A2:D2", "A3:D3"]),
        targets["TheoDoiHP"]: build_sheet(theo_doi_hp_rows, merges=["A1:P1", "A2:P2"]),
        targets["Thu-Chi"]: build_sheet(thu_chi_rows, merges=["A1:H1", "A2:H2"]),
        targets["XuatNhapSach"]: build_sheet(xuat_nhap_sach_rows, merges=["A1:I1", "A2:I2"]),
        targets["NhanSu"]: build_sheet(nhan_su_rows, merges=["A1:L1", "A2:L2"]),
        targets["DSHV"]: build_sheet(dshv_rows, merges=["A1:J1", "A2:J2"]),
        targets["DSLop"]: build_sheet(dslop_rows, merges=["A1:K1", "A2:K2"]),
        targets["DSTest"]: build_sheet(dstest_rows, merges=["A1:M1", "A2:M2"]),
        targets["MucLuc"]: build_sheet_from_template(read_sheet_xml(backup_path, "MucLuc"), build_lookup_rows(payload["mucLuc"])),
        targets["ChiTietLopHoc"]: build_sheet_from_template(read_sheet_xml(backup_path, "ChiTietLopHoc"), build_chi_tiet_rows(payload["chiTietLopHoc"])),
    }
    replacements[targets["TheoDoiHP"]] = build_sheet_from_template(read_sheet_xml(backup_path, "TheoDoiHP"), theo_doi_hp_positioned)
    replacements[targets["Thu-Chi"]] = build_sheet_from_template(read_sheet_xml(backup_path, "Thu-Chi"), thu_chi_positioned)
    replacements[targets["XuatNhapSach"]] = build_sheet_from_template(read_sheet_xml(backup_path, "XuatNhapSach"), xuat_nhap_sach_positioned)
    replacements[targets["NhanSu"]] = build_sheet_from_template(read_sheet_xml(backup_path, "NhanSu"), nhan_su_positioned)
    replacements[targets["DSHV"]] = build_sheet_from_template(read_sheet_xml(backup_path, "DSHV"), dshv_positioned)
    replacements[targets["DSLop"]] = build_sheet_from_template(read_sheet_xml(backup_path, "DSLop"), dslop_positioned)
    replacements[targets["DSTest"]] = build_sheet_from_template(read_sheet_xml(backup_path, "DSTest"), dstest_positioned)
    replacements[targets["Report_HS"]] = build_sheet_from_template(read_sheet_xml(backup_path, "Report_HS"), report_hs_positioned)
    replacements[targets["Report_HP"]] = build_sheet_from_template(read_sheet_xml(backup_path, "Report_HP"), report_hp_positioned)
    replacements[targets["Report_Cong_Luong"]] = build_sheet_from_template(read_sheet_xml(backup_path, "Report_Cong_Luong"), report_cong_luong_positioned)
    replacements[targets["SinhNhatHV"]] = build_sheet_from_template(read_sheet_xml(backup_path, "SinhNhatHV"), sinh_nhat_positioned)
    replacements["xl/workbook.xml"] = update_defined_names(
        workbook_xml_bytes,
        {
            "Report_HS": "Report_HS!$A$1:$N$17",
            "Report_HP": "Report_HP!$A$1:$U$7",
            "Report_Cong_Luong": "Report_Cong_Luong!$A$1:$T$3",
            "SinhNhatHV": "SinhNhatHV!$D$3:$G$5",
            "TheoDoiHP": "TheoDoiHP!$E$1:$T$3",
            "Thu-Chi": "Thu-Chi!$C$6:$J$9",
            "XuatNhapSach": "XuatNhapSach!$E$4:$N$6",
            "NhanSu": "NhanSu!$D$3:$Q$7",
            "DSHV": "DSHV!$E$1:$P$3",
            "DSLop": "DSLop!$A$3:$L$5",
            "DSTest": "DSTest!$E$4:$S$6",
            "MucLuc": "MucLuc!$A$1:$J$13",
            "ChiTietLopHoc": "ChiTietLopHoc!$E$1:$BD$7",
        },
        {
            "DSTest": "DSTest!$E$6:$AH$7",
            "NhanSu": "NhanSu!$D$5:$AA$8",
            "TheoDoiHP": "TheoDoiHP!$E$3:$AV$4",
            "DSHV": "DSHV!$E$4:$BU$5",
            "DSLop": "DSLop!$A$5:$Z$6",
            "ChiTietLopHoc": "ChiTietLopHoc!$E$5:$BD$7",
            "MucLuc": "MucLuc!$A$1:$J$13",
        },
        {
            "DSTest": "DSTest!$4:$6",
            "TheoDoiHP": "TheoDoiHP!$1:$3",
            "Report_HS": "Report_HS!$5:$5",
            "DSHV": "DSHV!$4:$4",
            "DSLop": "DSLop!$5:$5",
            "NhanSu": "NhanSu!$5:$5",
            "ChiTietLopHoc": "ChiTietLopHoc!$3:$5",
        },
    )
    with zipfile.ZipFile(xlsx_path, "r") as current_archive:
        replacements["xl/tables/table5.xml"] = update_table_xml(current_archive.read("xl/tables/table5.xml"), "E3:AV4")
        replacements["xl/tables/table8.xml"] = update_table_xml(current_archive.read("xl/tables/table8.xml"), "E6:S7")
        replacements["xl/tables/table7.xml"] = update_table_xml(current_archive.read("xl/tables/table7.xml"), "U6:AG7")
        replacements["xl/tables/table6.xml"] = update_table_xml(
            current_archive.read("xl/tables/table6.xml"),
            f"AI6:AR{6 + len(payload['xuatNhapSach']['tonKho'])}",
        )
        replacements["xl/tables/table13.xml"] = update_table_xml(current_archive.read("xl/tables/table13.xml"), f"D5:AA{5 + len(payload['nhanSu'])}")
        replacements["xl/tables/table4.xml"] = update_table_xml(current_archive.read("xl/tables/table4.xml"), f"E4:BU{4 + len(payload['dshv'])}")
        replacements["xl/tables/table3.xml"] = update_table_xml(current_archive.read("xl/tables/table3.xml"), f"E6:AH{6 + len(payload['dstest'])}")
        replacements["xl/tables/table12.xml"] = update_table_xml(current_archive.read("xl/tables/table12.xml"), f"A5:Z{5 + len(payload['dslop'])}")
        replacements["xl/tables/table2.xml"] = update_table_xml(current_archive.read("xl/tables/table2.xml"), f"E5:BD{5 + len(payload['chiTietLopHoc'])}")
        replacements["xl/tables/table14.xml"] = update_table_xml(current_archive.read("xl/tables/table14.xml"), f"A1:B{1 + len(payload['mucLuc']['table1'])}")
        replacements["xl/tables/table15.xml"] = update_table_xml(current_archive.read("xl/tables/table15.xml"), f"D1:G{1 + len(payload['mucLuc']['table2'])}")
        replacements["xl/tables/table16.xml"] = update_table_xml(current_archive.read("xl/tables/table16.xml"), f"I1:J{1 + len(payload['mucLuc']['table3'])}")
        replacements["xl/tables/table9.xml"] = update_table_xml(current_archive.read("xl/tables/table9.xml"), f"O5:X{5 + len([item for item in payload['thuChi'] if item['type'] == 'CHI'])}")
        replacements["xl/tables/table11.xml"] = update_table_xml(current_archive.read("xl/tables/table11.xml"), f"Z5:AJ{5 + len([item for item in payload['thuChi'] if item['type'] == 'THU'])}")
        category_count = len(sorted({item["categoryName"] for item in payload["thuChi"] if item["categoryName"]}))
        replacements["xl/tables/table10.xml"] = update_table_xml(current_archive.read("xl/tables/table10.xml"), f"AL4:AQ{max(4 + category_count, 5)}")

    with zipfile.ZipFile(xlsx_path, "r") as src, zipfile.ZipFile(temp_path, "w", compression=zipfile.ZIP_DEFLATED) as dst:
        for item in src.infolist():
            data = src.read(item.filename)
            if item.filename in replacements:
                data = replacements[item.filename]
            dst.writestr(item, data)

    xlsx_path.write_bytes(temp_path.read_bytes())
    print(json.dumps({"ok": True, "patched": str(xlsx_path), "targets": list(replacements.keys())}, ensure_ascii=False))


if __name__ == "__main__":
    main()
