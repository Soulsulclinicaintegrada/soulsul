Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\jusgo\Documents\sistema_clinica\_tmp_modelo_docx\word\media\image1.jpeg"
$outPath = "C:\Users\jusgo\Documents\sistema_clinica\_tmp_modelo_docx_live\word\media\image1.jpeg"

$base = [System.Drawing.Image]::FromFile($srcPath)
$bmp = New-Object System.Drawing.Bitmap($base.Width, $base.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::White)
$g.DrawImage($base, 0, 0, $base.Width, $base.Height)

$panelBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 198, 198, 198), 1.2)
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 90, 90, 90))
$numBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 120, 120, 120))
$titleFont = New-Object System.Drawing.Font("Segoe UI", 8.8, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$font = New-Object System.Drawing.Font("Segoe UI", 8.2, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$small = New-Object System.Drawing.Font("Segoe UI", 7.8, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)

$panelX = 258
$panelY = 8
$panelW = 84
$panelH = 130
$g.FillRectangle($panelBrush, $panelX, $panelY, $panelW, $panelH)
$g.DrawRectangle($borderPen, $panelX, $panelY, $panelW, $panelH)
$g.DrawString("OK", $titleFont, $textBrush, 292, 12)
$g.DrawString("MARCAÇÃO POR DENTE", $small, $textBrush, 266, 24)

$teeth = @(18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38)
$cols = 4
$rows = 8
$cellW = 20
$cellH = 13

for ($i = 0; $i -lt $teeth.Count; $i++) {
    $col = $i % $cols
    $row = [math]::Floor($i / $cols)
    $x = 264 + ($col * $cellW)
    $y = 40 + ($row * $cellH)
    $g.DrawString([string]$teeth[$i], $small, $numBrush, [float]$x, [float]$y)
    $g.DrawRectangle($borderPen, [int]($x + 10), [int]($y + 1), 8, 8)
}

$base.Dispose()

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$encoder = [System.Drawing.Imaging.Encoder]::Quality
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter($encoder, 95L)
$bmp.Save($outPath, $jpegCodec, $encoderParams)

$small.Dispose()
$font.Dispose()
$titleFont.Dispose()
$numBrush.Dispose()
$textBrush.Dispose()
$borderPen.Dispose()
$panelBrush.Dispose()
$g.Dispose()
$bmp.Dispose()
