<#
.SYNOPSIS
  Copia gha_delsuc.pub para o Ubuntu, executa remote-authorize-gha-key.sh e testa SSH apenas com chave.

  Execute na raiz do repo ou em qualquer pasta (usa caminhos absolutos do projeto se existir).

.EXAMPLE
  cd C:\Users\iago_\Desktop\Projects\WhatsAppConnect
  .\scripts\deploy\sync-gha-ssh-key.ps1
#>
[CmdletBinding()]
param(
  [string] $SshHost = "192.168.1.17",
  [string] $SshUser = "delsuc",
  [string] $PubKeyPath = (Join-Path $env:USERPROFILE ".ssh\gha_delsuc.pub"),
  [string] $PrivKeyPath = (Join-Path $env:USERPROFILE ".ssh\gha_delsuc")
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$remoteSh = Join-Path $repoRoot "scripts\deploy\remote-authorize-gha-key.sh"
if (-not (Test-Path -LiteralPath $remoteSh)) {
  Write-Error "Nao encontrado: $remoteSh"
}

if (-not (Test-Path -LiteralPath $PubKeyPath)) {
  Write-Error "Nao encontrado: $PubKeyPath`nGere com:`n  ssh-keygen -t ed25519 -f `$env:USERPROFILE\.ssh\gha_delsuc -N '\"\"' -C gha-deploy"
}

Write-Host "Fingerprint (local .pub):" -ForegroundColor Cyan
ssh-keygen -lf $PubKeyPath

$remotePub = "/tmp/gha_delsuc_$(Get-Random -Maximum 999999).pub"
$remoteShPath = "/tmp/remote-authorize-gha-key.sh"

Write-Host "`nEnviando chave publica e script..." -ForegroundColor Cyan
Write-Host "(se pedir password, e normal neste passo.)`n" -ForegroundColor Yellow

& scp -q $PubKeyPath "${SshUser}@${SshHost}:$remotePub"
if ($LASTEXITCODE -ne 0) {
  Write-Error "scp da chave falhou (exit $LASTEXITCODE). Instale OpenSSH Client nas Funcionalidades Opcionais do Windows."
}

& scp -q $remoteSh "${SshUser}@${SshHost}:$remoteShPath"
if ($LASTEXITCODE -ne 0) {
  Write-Error "scp do script falhou (exit $LASTEXITCODE)"
}

# Normaliza CRLF se o .sh foi gravado no Windows.
$bashLine = "sed -i 's/\r$//' $remoteShPath 2>/dev/null; chmod +x $remoteShPath && bash $remoteShPath $remotePub"
Write-Host "A executar no servidor (authorized_keys)...`n" -ForegroundColor Cyan
ssh "${SshUser}@${SshHost}" $bashLine
if ($LASTEXITCODE -ne 0) {
  Write-Error "ssh remoto falhou (exit $LASTEXITCODE)"
}

ssh "${SshUser}@${SshHost}" "rm -f $remoteShPath"

Write-Host "`nTeste: apenas chave publica (nao deve pedir password)...`n" -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath $PrivKeyPath)) {
  Write-Warning "Nao encontrado $PrivKeyPath — nao e possivel testar."
  exit 0
}

& ssh -i $PrivKeyPath -o IdentitiesOnly=yes -o PreferredAuthentications=publickey -o PubkeyAuthentication=yes `
  "${SshUser}@${SshHost}" "echo OK_SSH_KEY"
if ($LASTEXITCODE -eq 0) {
  Write-Host "`nSucesso: autenticacao por chave funciona." -ForegroundColor Green
  Write-Host "GitHub: secret SSH_KEY = conteudo completo da PRIVADA:" -ForegroundColor Yellow
  Write-Host "  Get-Content `$env:USERPROFILE\.ssh\gha_delsuc -Raw" -ForegroundColor Gray
} else {
  Write-Host "`nFalhou. No servidor: sudo tail -40 /var/log/auth.log" -ForegroundColor Red
  exit $LASTEXITCODE
}
