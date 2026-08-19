// ── Minimal XLSX writer ──
// Bir .xlsx dosyası, içinde XML'ler olan bir ZIP'ten ibaret. CSV'nin taşıyamadığı
// her şey (dondurulmuş başlık, kolon genişliği, sayı biçimi, kalın toplam satırı,
// tek dosyada iki sayfa) ancak burada anlatılabiliyor. Harici kütüphane yok:
// sıkıştırmasız (STORE) ZIP + elle yazılmış SpreadsheetML yetiyor, Excel açıyor.
//
// Kullanım:
//   buildXlsxBlob([{ name, columns:[{header,width,type,wrap}], rows:[[...]],
//                    freeze:{rows,cols}, autoFilter:true, totalRow:true }])

(function (global) {
    'use strict';

    // ── ZIP (store-only) ──
    const CRC_TABLE = (() => {
        const t = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            t[i] = c >>> 0;
        }
        return t;
    })();

    function crc32(bytes) {
        let c = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    function zipStore(files) {
        const enc = new TextEncoder();
        const parts = [];
        const central = [];
        let offset = 0;

        // DOS zaman damgası — sabit bir tarih, dosya her indirişte aynı olsun.
        const dosTime = 0, dosDate = ((2020 - 1980) << 9) | (1 << 5) | 1;

        files.forEach(f => {
            const name = enc.encode(f.name);
            const data = enc.encode(f.data);
            const crc = crc32(data);

            const local = new DataView(new ArrayBuffer(30));
            local.setUint32(0, 0x04034b50, true);
            local.setUint16(4, 20, true);
            local.setUint16(6, 0x0800, true);   // UTF-8 isim
            local.setUint16(8, 0, true);        // yöntem: store
            local.setUint16(10, dosTime, true);
            local.setUint16(12, dosDate, true);
            local.setUint32(14, crc, true);
            local.setUint32(18, data.length, true);
            local.setUint32(22, data.length, true);
            local.setUint16(26, name.length, true);
            local.setUint16(28, 0, true);
            parts.push(new Uint8Array(local.buffer), name, data);

            const cd = new DataView(new ArrayBuffer(46));
            cd.setUint32(0, 0x02014b50, true);
            cd.setUint16(4, 20, true);
            cd.setUint16(6, 20, true);
            cd.setUint16(8, 0x0800, true);
            cd.setUint16(10, 0, true);
            cd.setUint16(12, dosTime, true);
            cd.setUint16(14, dosDate, true);
            cd.setUint32(16, crc, true);
            cd.setUint32(20, data.length, true);
            cd.setUint32(24, data.length, true);
            cd.setUint16(28, name.length, true);
            cd.setUint32(42, offset, true);
            central.push(new Uint8Array(cd.buffer), name);

            offset += 30 + name.length + data.length;
        });

        const cdSize = central.reduce((a, b) => a + b.length, 0);
        const eocd = new DataView(new ArrayBuffer(22));
        eocd.setUint32(0, 0x06054b50, true);
        eocd.setUint16(8, files.length, true);
        eocd.setUint16(10, files.length, true);
        eocd.setUint32(12, cdSize, true);
        eocd.setUint32(16, offset, true);

        return new Blob([...parts, ...central, new Uint8Array(eocd.buffer)],
                        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    // ── SpreadsheetML ──
    const esc = v => String(v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        // XML 1.0'ın kabul etmediği kontrol karakterleri dosyayı bozar
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

    function colName(n) {
        let s = '';
        n += 1;
        while (n > 0) {
            const r = (n - 1) % 26;
            s = String.fromCharCode(65 + r) + s;
            n = Math.floor((n - 1) / 26);
        }
        return s;
    }

    // Stil indeksleri (styles.xml'deki cellXfs sırası)
    const S = { DEFAULT: 0, HEADER: 1, NUMBER: 2, TOTAL_NUM: 3, TOTAL_TEXT: 4, WRAP: 5 };

    const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts>
<fonts count="3">
<font><sz val="11"/><color theme="1"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1F2430"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top style="medium"><color rgb="FF808080"/></top><bottom/><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

    function cellXml(ref, value, style, isNumber) {
        if (value === null || value === undefined || value === '') return '';
        const s = style ? ` s="${style}"` : '';
        if (isNumber) return `<c r="${ref}"${s}><v>${value}</v></c>`;
        return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
    }

    function sheetXml(sheet) {
        const cols = sheet.columns;
        const lastCol = colName(cols.length - 1);
        const lastRow = sheet.rows.length + 1;

        const freeze = sheet.freeze || {};
        const fx = freeze.cols || 0, fy = freeze.rows || 0;
        const pane = (fx || fy)
            ? `<pane${fx ? ` xSplit="${fx}"` : ''}${fy ? ` ySplit="${fy}"` : ''}` +
              ` topLeftCell="${colName(fx)}${fy + 1}" activePane="bottomRight" state="frozen"/>` +
              `<selection pane="bottomRight"/>`
            : '';

        const colDefs = cols.map((c, i) =>
            `<col min="${i + 1}" max="${i + 1}" width="${c.width || 14}" customWidth="1"/>`).join('');

        let body = '<row r="1" ht="30" customHeight="1">' +
            cols.map((c, i) => cellXml(colName(i) + '1', c.header, S.HEADER, false)).join('') +
            '</row>';

        sheet.rows.forEach((row, ri) => {
            const r = ri + 2;
            const isTotal = sheet.totalRow && ri === sheet.rows.length - 1;
            body += `<row r="${r}">` + row.map((v, i) => {
                const col = cols[i] || {};
                const num = col.type === 'number' && typeof v === 'number';
                let style = num ? S.NUMBER : (col.wrap ? S.WRAP : S.DEFAULT);
                if (isTotal) style = num ? S.TOTAL_NUM : S.TOTAL_TEXT;
                return cellXml(colName(i) + r, v, style, num);
            }).join('') + '</row>';
        });

        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${lastCol}${lastRow}"/>
<sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${colDefs}</cols>
<sheetData>${body}</sheetData>
${sheet.autoFilter ? `<autoFilter ref="A1:${lastCol}${lastRow}"/>` : ''}
</worksheet>`;
    }

    function buildXlsxBlob(sheets) {
        const files = [
            { name: '[Content_Types].xml', data:
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>` },
            { name: '_rels/.rels', data:
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>` },
            { name: 'xl/workbook.xml', data:
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets.map((s, i) =>
    `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>` },
            { name: 'xl/_rels/workbook.xml.rels', data:
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>` },
            { name: 'xl/styles.xml', data: STYLES }
        ];

        sheets.forEach((s, i) => files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) }));
        return zipStore(files);
    }

    global.buildXlsxBlob = buildXlsxBlob;
})(typeof window !== 'undefined' ? window : globalThis);
