#!/usr/bin/env python3
"""
XLSM to XLSX Macro Stripper
===========================

Strips VBA macros from .xlsm files while preserving everything else:
- Formulas, formatting, styles
- Cell values, column widths
- Charts, pivot tables, etc.

Usage: python3 xlsm_to_xlsx_strip.py input.xlsm output.xlsx
"""

import zipfile
import io
import xml.etree.ElementTree as ET
from pathlib import Path
import sys

NS_CT = {"ct": "http://schemas.openxmlformats.org/package/2006/content-types"}
NS_REL = {"rel": "http://schemas.openxmlformats.org/package/2006/relationships"}

CT_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"
CT_XLSM = "application/vnd.ms-excel.sheet.macroEnabled.main+xml"
REL_VBA = "http://schemas.microsoft.com/office/2006/relationships/vbaProject"

def _write_xml(tree):
    """Write XML tree to bytes with proper encoding"""
    buf = io.BytesIO()
    ET.ElementTree(tree).write(buf, encoding="utf-8", xml_declaration=True)
    return buf.getvalue()

def strip_macros(xlsm_path: str, out_xlsx_path: str):
    """
    Strip VBA macros from XLSM file, creating clean XLSX
    
    Args:
        xlsm_path: Path to input .xlsm file
        out_xlsx_path: Path to output .xlsx file
    """
    try:
        with zipfile.ZipFile(xlsm_path, "r") as zin, zipfile.ZipFile(out_xlsx_path, "w", zipfile.ZIP_DEFLATED) as zout:
            for info in zin.infolist():
                # Skip VBA project binary
                if info.filename == "xl/vbaProject.bin":
                    continue  # drop macros
                
                data = zin.read(info.filename)

                # Update content types - change XLSM to XLSX
                if info.filename == "[Content_Types].xml":
                    root = ET.fromstring(data)
                    for el in list(root.findall("ct:Override", NS_CT)):
                        part = el.attrib.get("PartName")
                        ctype = el.attrib.get("ContentType")
                        if part == "/xl/workbook.xml" and ctype == CT_XLSM:
                            el.set("ContentType", CT_XLSX)  # flip to normal workbook
                        if part == "/xl/vbaProject.bin":
                            root.remove(el)                 # remove VBA override
                    data = _write_xml(root)

                # Remove VBA relationships
                if info.filename == "xl/_rels/workbook.xml.rels":
                    root = ET.fromstring(data)
                    changed = False
                    for rel in list(root.findall("rel:Relationship", NS_REL)):
                        if rel.attrib.get("Type") == REL_VBA:
                            root.remove(rel)
                            changed = True
                    if changed:
                        data = _write_xml(root)

                # Write the (potentially modified) file to output
                zout.writestr(info, data)
                
        print(f"SUCCESS: Stripped macros from {xlsm_path} -> {out_xlsx_path}")
        
    except Exception as e:
        print(f"ERROR: Failed to strip macros: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 xlsm_to_xlsx_strip.py input.xlsm output.xlsx", file=sys.stderr)
        sys.exit(1)
    
    xlsm_path = sys.argv[1]
    xlsx_path = sys.argv[2]
    
    # Validate input file exists
    if not Path(xlsm_path).exists():
        print(f"ERROR: Input file not found: {xlsm_path}", file=sys.stderr)
        sys.exit(1)
    
    strip_macros(xlsm_path, xlsx_path)
