<?php
/**
 * Export Excel (.xlsx) minimaliste, sans dépendance (extension PHP « zip »).
 * Si l'extension zip est absente, repli automatique sur un CSV lisible par Excel.
 */
declare(strict_types=1);

/**
 * @param string[]         $entetes
 * @param array<int,array> $lignes  valeurs scalaires ; les int/float deviennent des nombres Excel
 */
function envoyer_excel(string $nomSansExtension, string $nomFeuille, array $entetes, array $lignes): never
{
    if (!class_exists('ZipArchive')) {
        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="' . $nomSansExtension . '.csv"');
        $out = fopen('php://output', 'w');
        fwrite($out, "\xEF\xBB\xBF");                       // BOM : accents corrects dans Excel
        fputcsv($out, $entetes, ';', '"', '\\');
        foreach ($lignes as $l) {
            fputcsv($out, array_values($l), ';', '"', '\\');
        }
        exit;
    }

    $x = static fn(mixed $v): string => htmlspecialchars(
        preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', (string) $v), ENT_XML1 | ENT_QUOTES, 'UTF-8'
    );
    $colonne = static function (int $i): string {
        $s = '';
        for ($i++; $i > 0; $i = intdiv($i - 1, 26)) {
            $s = chr(65 + ($i - 1) % 26) . $s;
        }
        return $s;
    };

    $feuille = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        . '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>';
    foreach ($entetes as $i => $h) {
        $max = mb_strlen((string) $h);
        foreach ($lignes as $l) {
            $max = max($max, mb_strlen((string) (array_values($l)[$i] ?? '')));
        }
        $feuille .= '<col min="' . ($i + 1) . '" max="' . ($i + 1) . '" width="' . min(50, $max + 3) . '" customWidth="1"/>';
    }
    $feuille .= '</cols><sheetData><row r="1">';
    foreach ($entetes as $i => $h) {
        $feuille .= '<c r="' . $colonne($i) . '1" t="inlineStr" s="1"><is><t>' . $x($h) . '</t></is></c>';
    }
    $feuille .= '</row>';
    $r = 2;
    foreach ($lignes as $l) {
        $feuille .= '<row r="' . $r . '">';
        foreach (array_values($l) as $i => $v) {
            $ref = $colonne($i) . $r;
            $feuille .= (is_int($v) || is_float($v))
                ? '<c r="' . $ref . '"><v>' . $v . '</v></c>'
                : '<c r="' . $ref . '" t="inlineStr"><is><t xml:space="preserve">' . $x($v) . '</t></is></c>';
        }
        $feuille .= '</row>';
        $r++;
    }
    $feuille .= '</sheetData></worksheet>';

    $fichiers = [
        '[Content_Types].xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml" ContentType="application/xml"/>'
            . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            . '</Types>',
        '_rels/.rels' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            . '</Relationships>',
        'xl/workbook.xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            . '<sheets><sheet name="' . $x(mb_substr($nomFeuille, 0, 31)) . '" sheetId="1" r:id="rId1"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            . '</Relationships>',
        'xl/styles.xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
            . '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
            . '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
            . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            . '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
            . '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
            . '</styleSheet>',
        'xl/worksheets/sheet1.xml' => $feuille,
    ];

    $tmp = tempnam(sys_get_temp_dir(), 'xlsx');
    $zip = new ZipArchive();
    $zip->open($tmp, ZipArchive::OVERWRITE);
    foreach ($fichiers as $nom => $contenu) {
        $zip->addFromString($nom, $contenu);
    }
    $zip->close();

    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $nomSansExtension . '.xlsx"');
    header('Content-Length: ' . filesize($tmp));
    header('Cache-Control: private, no-store');
    readfile($tmp);
    unlink($tmp);
    exit;
}
