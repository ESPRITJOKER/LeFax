# extracts plain text from every .docx / .odt in the given folder tree.
# Uses .NET System.IO.Compression (no external deps). Paragraphs are preserved
# as newlines; table cells joined with " | ". Output lands under scripts/tmp/extract.
param(
  [string]$Source = "C:\Users\AvenirTech\Desktop\lefax artifacts",
  [string]$OutDir = "$PSScriptRoot\tmp\extract"
)

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-DocxText([string]$path) {
  $zip = $null
  try {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($path)
    $entry = $zip.Entries | Where-Object { $_.FullName -eq "word/document.xml" }
    if (-not $entry) { return "[[no document.xml]]" }
    $reader = New-Object System.IO.StreamReader($entry.Open())
    $xml = [xml]$reader.ReadToEnd()
    $reader.Close()
    $sb = New-Object System.Text.StringBuilder
    foreach ($p in $xml.document.body.p) {
      if ($p.'w:pPr' -and $p.'w:pPr'.'w:pStyle') {
        $style = $p.'w:pPr'.'w:pStyle'.'w:val'
        if ($style -match 'Heading1|Title') { [void]$sb.AppendLine("## ") }
        elseif ($style -match 'Heading2') { [void]$sb.AppendLine("### ") }
      }
      foreach ($r in $p.r) {
        if ($r.t) { [void]$sb.Append($r.t.'#text') }
        if ($r.'w:t') { [void]$sb.Append($r.'w:t'.'#text') }
        if ($r.'w:tab') { [void]$sb.Append("`t") }
        if ($r.'w:br') { [void]$sb.Append("`n") }
      }
      [void]$sb.AppendLine()
    }
    return $sb.ToString()
  } catch { return "[[extract failed: $($_.Exception.Message)]]" }
  finally { if ($zip) { $zip.Dispose() } }
}

function Get-OdtText([string]$path) {
  $zip = $null
  try {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($path)
    $entry = $zip.Entries | Where-Object { $_.FullName -eq "content.xml" }
    if (-not $entry) { return "[[no content.xml]]" }
    $reader = New-Object System.IO.StreamReader($entry.Open())
    $xml = [xml]$reader.ReadToEnd()
    $reader.Close()
    $sb = New-Object System.Text.StringBuilder
    $ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
    $ns.AddNamespace("text", "urn:oasis:names:tc:opendocument:xmlns:text:1.0")
    $ps = $xml.SelectNodes("//text:p", $ns)
    foreach ($p in $ps) {
      $line = $p.InnerText -replace "\s+", " "
      [void]$sb.AppendLine($line.Trim())
    }
    return $sb.ToString()
  } catch { return "[[extract failed: $($_.Exception.Message)]]" }
  finally { if ($zip) { $zip.Dispose() } }
}

$files = Get-ChildItem -LiteralPath $Source -Recurse -File |
  Where-Object { $_.Extension -in @('.docx', '.odt') }
if (-not $files) { Write-Output "no documents found under $Source"; exit 1 }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
foreach ($f in $files) {
  $name = [System.IO.Path]::GetFileNameWithoutExtension($f.Name) -replace "[^\p{L}\p{N}_-]", "_"
  $out = Join-Path $OutDir "$name.txt"
  $text = if ($f.Extension -eq ".odt") { Get-OdtText $f.FullName } else { Get-DocxText $f.FullName }
  Set-Content -LiteralPath $out -Value $text -Encoding UTF8
  Write-Output ("{0,-8} {1,8} chars  <-  {2}" -f $f.Extension, $text.Length, $f.Name)
}

Write-Output "`nTotal: $($files.Count) documents -> $OutDir"
