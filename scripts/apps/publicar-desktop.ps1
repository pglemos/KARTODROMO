<#
  Gera os pacotes dos aplicativos desktop e publica os manifestos no SRVKART.
  A publicação do manifesto é a ativação da atualização automática nos clientes.

    .\scripts\apps\publicar-desktop.ps1
    .\scripts\apps\publicar-desktop.ps1 -App Recepcao,Cronometragem
    .\scripts\apps\publicar-desktop.ps1 -NaoPublicarNoServidor
#>
param(
  [ValidateSet('Recepcao', 'Autoatendimento', 'Cronometragem')]
  [string[]]$App = @('Recepcao', 'Autoatendimento', 'Cronometragem'),
  [string]$Servidor = '192.168.20.13',
  [switch]$NaoPublicarNoServidor
)
$ErrorActionPreference = 'Stop'

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$desktop = Join-Path $repo 'desktop'
$props = Join-Path $desktop 'Directory.Build.props'
$versao = ([regex]::Match((Get-Content -Raw $props), '<Version>([^<]+)</Version>')).Groups[1].Value
if (-not $versao) { throw 'Não encontrei a versão em desktop\Directory.Build.props.' }

$releaseRoot = Join-Path $desktop "publish\_autoupdate\$versao"
New-Item -ItemType Directory -Force $releaseRoot | Out-Null
$pacotes = @()

foreach ($nome in $App) {
  $projeto = "src\Kartodromo.$nome"
  $saida = Join-Path $releaseRoot $nome
  if (Test-Path $saida) { Remove-Item -LiteralPath $saida -Recurse -Force }
  New-Item -ItemType Directory -Force $saida | Out-Null
  Push-Location $desktop
  try {
    & dotnet publish $projeto -c Release -r win-x64 --self-contained true `
      -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true `
      -p:EnableCompressionInSingleFile=true -p:DebugType=None -o $saida
    if ($LASTEXITCODE -ne 0) { throw "Falha ao publicar $nome." }
  }
  finally { Pop-Location }

  $exe = Join-Path $saida "Kartodromo.$nome.exe"
  if (-not (Test-Path $exe)) { throw "Pacote $nome sem executável." }
  $deploy = Join-Path $desktop "publish\$nome"
  New-Item -ItemType Directory -Force $deploy | Out-Null
  Copy-Item (Join-Path $saida '*') $deploy -Recurse -Force
  $arquivo = "Kartodromo.$nome.$versao.zip"
  $zip = Join-Path $releaseRoot $arquivo
  if (Test-Path $zip) { Remove-Item -LiteralPath $zip -Force }
  Compress-Archive -Path (Join-Path $saida '*') -DestinationPath $zip -CompressionLevel Optimal
  $hash = (Get-FileHash $zip -Algorithm SHA256).Hash
  $manifesto = [ordered]@{
    app = $nome
    version = $versao
    package = $arquivo
    sha256 = $hash
    publishedAt = (Get-Date).ToUniversalTime().ToString('o')
  }
  $manifestoPath = Join-Path $releaseRoot "$nome.manifest.json"
  [IO.File]::WriteAllText($manifestoPath, ($manifesto | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
  $pacotes += [pscustomobject]@{ App = $nome; Saida = $saida; Zip = $zip; Manifesto = $manifestoPath; Nome = $arquivo }
  Write-Output "gerado: $nome $versao | $arquivo | $hash"
}

# Item 4: Expurgo automático de versões antigas em _autoupdate (mantém apenas as 3 mais recentes)
$autoUpdateRoot = Join-Path $desktop 'publish\_autoupdate'
if (Test-Path $autoUpdateRoot) {
  $versoesAntigas = Get-ChildItem -LiteralPath $autoUpdateRoot -Directory |
    Sort-Object {
      $v = [version]::new(0, 0, 0)
      if ([version]::TryParse($_.Name, [ref]$v)) { $v } else { [version]::new(0, 0, 0) }
    } -Descending |
    Select-Object -Skip 3
  foreach ($dirAntigo in $versoesAntigas) {
    Remove-Item -LiteralPath $dirAntigo.FullName -Recurse -Force -ErrorAction SilentlyContinue
    Write-Output "expurgado _autoupdate antigo: $($dirAntigo.Name)"
  }
}

if ($NaoPublicarNoServidor) { return }

. (Join-Path $repo 'scripts\apps\credencial.ps1')
$cred = Obter-CredencialKartodromo
$sessao = New-PSSession -ComputerName $Servidor -Credential $cred
try {
  foreach ($p in $pacotes) {
    $remoto = "C:\kartodromo-servidor\updates\$($p.App)"
    Invoke-Command -Session $sessao -ArgumentList $remoto, $p.Nome {
      param($pasta, $zipAtual)
      New-Item -ItemType Directory -Force $pasta | Out-Null
      $identidade = "$env:COMPUTERNAME\KARTODROMO"
      $icacls = Join-Path $env:SystemRoot 'System32\icacls.exe'
      & $icacls $pasta /grant "$identidade`:(OI)(CI)M" | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "Não foi possível preparar a pasta de atualizações: $pasta" }
      # Limpa pacotes zip antigos na pasta remota (mantém os 3 mais recentes)
      Get-ChildItem -LiteralPath $pasta -Filter '*.zip' -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ne $zipAtual } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -Skip 2 |
        ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue }
    }
    Copy-Item $p.Zip "$remoto\$($p.Nome)" -ToSession $sessao -Force
    # O manifesto é copiado por último: o cliente só passa a enxergar a versão
    # depois que o ZIP completo já está no servidor.
    Copy-Item $p.Manifesto "$remoto\manifest.json" -ToSession $sessao -Force
    Write-Output "publicado: $($p.App) em $Servidor"

    # Item 23: Verificação HTTP pós-publicação da rota de autoupdate (:4060)
    $urlManifesto = "http://$($Servidor):4060/updates/$($p.App)/manifest.json"
    try {
      $resp = Invoke-RestMethod -Uri $urlManifesto -Method Get -TimeoutSec 8
      if ($resp.version -ne $versao) {
        Write-Warning "Aviso: manifesto HTTP em $urlManifesto retornou versão '$($resp.version)' (esperado '$versao')."
      } else {
        Write-Output "verificado HTTP: $urlManifesto -> v$($resp.version) OK"
      }
    } catch {
      Write-Warning "Não foi possível validar $urlManifesto via HTTP (:4060): $($_.Exception.Message)"
    }
  }
}
finally { Remove-PSSession $sessao }
