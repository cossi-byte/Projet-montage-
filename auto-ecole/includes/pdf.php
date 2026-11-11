<?php
/**
 * Générateur PDF minimaliste, sans dépendance (reçus, listes).
 * Unités en millimètres, origine en haut à gauche. Polices : Helvetica / Helvetica-Bold.
 */
declare(strict_types=1);

final class PdfSimple
{
    private const K = 72 / 25.4;                 // points par millimètre
    private const LARGEURS = [                   // chasses Helvetica (codes 32 à 126), en millièmes
        278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,
        278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,
        611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,
        556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,
    ];

    private array $pages = [];
    private string $courant = '';
    private float $largeur;
    private float $hauteur;

    public function __construct(bool $paysage = false)
    {
        [$this->largeur, $this->hauteur] = $paysage ? [297.0, 210.0] : [210.0, 297.0];
        $this->nouvellePage();
    }

    public function largeur(): float { return $this->largeur; }
    public function hauteur(): float { return $this->hauteur; }

    public function nouvellePage(): void
    {
        if ($this->courant !== '') {
            $this->pages[] = $this->courant;
        }
        $this->courant = ' ';
    }

    private static function encoder(string $texte): string
    {
        $t = @iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $texte);
        if ($t === false) {
            $t = mb_convert_encoding($texte, 'Windows-1252', 'UTF-8');
        }
        return $t;
    }

    public function largeurTexte(string $texte, float $taille, bool $gras = false): float
    {
        $w = 0;
        foreach (unpack('C*', self::encoder($texte)) ?: [] as $c) {
            $w += ($c >= 32 && $c <= 126) ? self::LARGEURS[$c - 32] : 556;
        }
        return $w * $taille / 1000 / self::K * ($gras ? 1.06 : 1.0);
    }

    /** Raccourcit le texte avec « … » pour tenir dans la largeur donnée. */
    public function tronquer(string $texte, float $largeurMax, float $taille, bool $gras = false): string
    {
        if ($this->largeurTexte($texte, $taille, $gras) <= $largeurMax) {
            return $texte;
        }
        while (mb_strlen($texte) > 1 && $this->largeurTexte($texte . '...', $taille, $gras) > $largeurMax) {
            $texte = mb_substr($texte, 0, -1);
        }
        return $texte . '...';
    }

    /** $align : G (gauche), C (centré), D (droite) par rapport à x. $gris : 0 (noir) à 1 (blanc). */
    public function texte(float $x, float $y, string $texte, float $taille = 10, bool $gras = false, string $align = 'G', float $gris = 0): void
    {
        $w = $this->largeurTexte($texte, $taille, $gras);
        if ($align === 'D') {
            $x -= $w;
        } elseif ($align === 'C') {
            $x -= $w / 2;
        }
        $t = strtr(self::encoder($texte), ['\\' => '\\\\', '(' => '\\(', ')' => '\\)']);
        $this->courant .= sprintf(
            "BT %.3F g /F%d %.2F Tf %.2F %.2F Td (%s) Tj ET\n",
            $gris, $gras ? 2 : 1, $taille, $x * self::K, ($this->hauteur - $y) * self::K, $t
        );
    }

    public function ligne(float $x1, float $y1, float $x2, float $y2, float $epaisseur = 0.2, float $gris = 0): void
    {
        $this->courant .= sprintf(
            "%.3F G %.2F w %.2F %.2F m %.2F %.2F l S\n",
            $gris, $epaisseur * self::K, $x1 * self::K, ($this->hauteur - $y1) * self::K, $x2 * self::K, ($this->hauteur - $y2) * self::K
        );
    }

    /** Rectangle plein ; couleur RVB (0-255). */
    public function rectangle(float $x, float $y, float $l, float $h, int $r, int $v, int $b): void
    {
        $this->courant .= sprintf(
            "%.3F %.3F %.3F rg %.2F %.2F %.2F %.2F re f\n",
            $r / 255, $v / 255, $b / 255, $x * self::K, ($this->hauteur - $y - $h) * self::K, $l * self::K, $h * self::K
        );
    }

    public function contenu(): string
    {
        $pages = [...$this->pages, $this->courant];
        $objets = [];
        $objets[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        $objets[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
        $objets[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
        $refs = [];
        $n = 5;
        foreach ($pages as $flux) {
            $refs[] = "$n 0 R";
            $objets[$n] = sprintf(
                '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2F %.2F] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents %d 0 R >>',
                $this->largeur * self::K, $this->hauteur * self::K, $n + 1
            );
            $objets[$n + 1] = '<< /Length ' . strlen($flux) . " >>\nstream\n" . $flux . "\nendstream";
            $n += 2;
        }
        $objets[2] = '<< /Type /Pages /Kids [' . implode(' ', $refs) . '] /Count ' . count($pages) . ' >>';
        ksort($objets);

        $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $positions = [];
        foreach ($objets as $num => $corps) {
            $positions[$num] = strlen($pdf);
            $pdf .= "$num 0 obj\n$corps\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= "xref\n0 " . (count($objets) + 1) . "\n0000000000 65535 f \n";
        foreach ($positions as $pos) {
            $pdf .= sprintf("%010d 00000 n \n", $pos);
        }
        return $pdf . 'trailer << /Size ' . (count($objets) + 1) . " /Root 1 0 R >>\nstartxref\n$xref\n%%EOF";
    }

    /** Envoie le PDF au navigateur. */
    public function envoyer(string $nomFichier, bool $telecharger = true): never
    {
        $pdf = $this->contenu();
        header('Content-Type: application/pdf');
        header('Content-Disposition: ' . ($telecharger ? 'attachment' : 'inline') . '; filename="' . $nomFichier . '"');
        header('Content-Length: ' . strlen($pdf));
        header('Cache-Control: private, no-store');
        echo $pdf;
        exit;
    }
}

/** Convertit « #rrggbb » en [r, v, b]. */
function couleur_rvb(string $hex): array
{
    $hex = ltrim($hex, '#');
    return [hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2))];
}
