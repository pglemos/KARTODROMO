. C:\repos\KARTODROMO\scripts\apps\credencial.ps1
$cred = Obter-CredencialKartodromo
Invoke-Command -ComputerName 192.168.20.254 -Credential $cred -ScriptBlock {
  (Get-Item "C:\Program Files\Kartodromo\Cronometragem\Kartodromo.Cronometragem.exe").VersionInfo |
    Select-Object ProductVersion, FileVersion, FileName
}
