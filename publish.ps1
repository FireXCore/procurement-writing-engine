[CmdletBinding()]
param(
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9-]{0,38}$')][string]$Owner = 'FireXCore',
    [switch]$PublicAlpha
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (-not $PublicAlpha) { throw 'Use -PublicAlpha to authorize public GitHub source and alpha release publication.' }
Set-Location -LiteralPath $PSScriptRoot
$repo = "$Owner/procurement-writing-engine"
$expectedOrigin = "https://github.com/$repo.git"
function Run-Native {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed (exit $LASTEXITCODE). No subsequent publication step ran." }
}
function Get-Native {
    param([string]$Program, [string[]]$Arguments)
    $output = & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program query failed (exit $LASTEXITCODE)." }
    return ($output -join "`n")
}
foreach ($tool in @('git','gh','node','npm.cmd')) { if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Missing prerequisite: $tool. Install from the official provider." } }
Run-Native 'node' @('-e','if(+process.versions.node.split(".")[0]<22 || (process.versions.node.startsWith("22.")&&+process.versions.node.split(".")[1]<12))process.exit(1)')
Run-Native 'gh' @('auth','status','--hostname','github.com')
$pkg = Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json
if ($pkg.name -ne 'procurement-writing-engine' -or $pkg.private -ne $true -or $pkg.version -notmatch '^\d+\.\d+\.\d+-alpha\.\d+$') { throw 'Unexpected package identity or release stage.' }
$tag = 'v' + $pkg.version
# Reject running inside another repository; never push unrelated source or existing history.
$top = & git rev-parse --show-toplevel 2>$null
if ($LASTEXITCODE -eq 0) {
    if ((Resolve-Path -LiteralPath $top).Path -ne (Resolve-Path -LiteralPath '.').Path) { throw 'Extract this project outside any other Git worktree.' }
    $branch = Get-Native 'git' @('branch','--show-current')
    if ($branch -ne 'main') { throw 'Only the dedicated main branch may be published.' }
    $remotes = @(git remote)
    if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect Git remotes.' }
    if ($remotes.Count -gt 0) {
        if ($remotes.Count -ne 1 -or $remotes[0] -ne 'origin') { throw 'Unexpected Git remotes.' }
        $origin = Get-Native 'git' @('remote','get-url','origin')
        if ($origin -notin @($expectedOrigin,"https://github.com/$repo","git@github.com:$repo.git")) { throw 'Origin is not the dedicated target repository.' }
    }
} else { $remotes = @() }
# Generate the first real lockfile only if absent. A subsequent run must use the same lock.
if (-not (Test-Path -LiteralPath 'package-lock.json')) {
    Run-Native 'npm.cmd' @('install','--package-lock-only','--ignore-scripts','--no-audit','--no-fund','--registry=https://registry.npmjs.org/')
}
Run-Native 'npm.cmd' @('ci','--ignore-scripts','--no-fund','--registry=https://registry.npmjs.org/')
Run-Native 'npm.cmd' @('run','verify')
Run-Native 'npm.cmd' @('audit','--audit-level=high','--registry=https://registry.npmjs.org/')
Run-Native 'npm.cmd' @('run','release:check')
New-Item -ItemType Directory -Force -Path 'release-artifacts' | Out-Null
$sbom = Get-Native 'npm.cmd' @('sbom','--sbom-format','cyclonedx')
[IO.File]::WriteAllText((Join-Path $PWD.Path 'release-artifacts/dependencies.cdx.json'),$sbom,(New-Object Text.UTF8Encoding($false)))
# Only distribution-approved repository files are staged. No downloaded dependencies or local logs.
$allowed = @('.github','.gitignore','.gitattributes','.vale.ini','LICENSE','README.md','SECURITY.md','THIRD_PARTY.md','CONTRIBUTING.md','CODE_OF_CONDUCT.md','CHANGELOG.md','package.json','package-lock.json','publish.ps1','assets','demo','docs','examples','scripts','site','src','styles','test')
if (-not (Test-Path -LiteralPath '.git')) { Run-Native 'git' @('init','-b','main') }
Run-Native 'git' (@('add','--') + $allowed)
# Refuse any tracked content outside this exact source boundary.
$tracked = @(git ls-files)
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect tracked paths.' }
foreach ($path in $tracked) {
    $first = ($path -split '/')[0]
    if ($first -notin $allowed -or $path -match '(^|/)(\.env($|\.)|node_modules|\.git|dist|release-artifacts)(/|$)|\.(pem|key|pfx|onnx|gguf|wasm|zip|tgz)$') { throw "Unexpected tracked path: $path" }
}
& git diff --cached --quiet
$diffStatus = $LASTEXITCODE
if ($diffStatus -eq 1) { Run-Native 'git' @('commit','-m',"Release candidate $tag") }
elseif ($diffStatus -ne 0) { throw 'Cannot inspect staged changes.' }
$sha = Get-Native 'git' @('rev-parse','HEAD')
if ($remotes.Count -eq 0) {
    # Creation is private first. If the name is occupied, gh fails; never adopt an unrelated repo.
    Run-Native 'gh' @('repo','create',$repo,'--private','--source=.','--remote=origin','--push','--description','English and Persian procurement writing review. Local engines, protected technical ranges, no LLM required.')
} else {
    # Resume only the same dedicated repo. A non-fast-forward is rejected by Git.
    Run-Native 'git' @('push','origin','main')
}
Run-Native 'gh' @('repo','edit',$repo,'--add-topic','procurement,grammar-checker,persian,technical-writing,webassembly,erp,writing-assistant,offline-first','--enable-issues','--enable-discussions')
$run = $null
for ($i=0; $i -lt 60; $i++) {
    $json = Get-Native 'gh' @('run','list','--repo',$repo,'--workflow','ci.yml','--branch','main','--commit',$sha,'--limit','5','--json','databaseId,headSha,status,conclusion')
    $runs = @($json | ConvertFrom-Json | Where-Object { $_.headSha -eq $sha })
    if ($runs.Count -gt 0) { $run = $runs[0]; break }
    Start-Sleep -Seconds 5
}
if ($null -eq $run) { throw "CI not found for $sha. Repo remains in its current visibility state." }
Run-Native 'gh' @('run','watch',([string]$run.databaseId),'--repo',$repo,'--exit-status','--compact')
$checked = (Get-Native 'gh' @('run','view',([string]$run.databaseId),'--repo',$repo,'--json','headSha,conclusion,status')) | ConvertFrom-Json
if ($checked.headSha -ne $sha -or $checked.conclusion -ne 'success' -or $checked.status -ne 'completed') { throw 'The exact commit has not passed CI.' }
$remoteSha = Get-Native 'gh' @('api',"repos/$repo/git/ref/heads/main",'--jq','.object.sha')
if ($remoteSha -ne $sha) { throw 'Remote main changed; aborting release.' }
# Pack only after CI is green. No npm registry publication or deployment.
Run-Native 'npm.cmd' @('pack','--ignore-scripts','--pack-destination','release-artifacts')
$tarball = Join-Path 'release-artifacts' "$($pkg.name)-$($pkg.version).tgz"
if (-not (Test-Path -LiteralPath $tarball)) { throw 'Package artifact not found.' }
$hash = (Get-FileHash -LiteralPath $tarball -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $PWD.Path 'release-artifacts/SHA256SUMS.txt'),"$hash  $([IO.Path]::GetFileName($tarball))`n",(New-Object Text.UTF8Encoding($false)))
# A release with this tag may already exist; never replace its assets or tag.
$remoteTags = Get-Native 'git' @('ls-remote','--tags','origin',"refs/tags/$tag")
if ($remoteTags.Trim()) { throw "Tag $tag already exists. No overwrite; inspect it manually." }
Run-Native 'git' @('tag','-a',$tag,$sha,'-m',"Procurement Writing Engine $tag")
Run-Native 'git' @('push','origin',"refs/tags/$tag")
Run-Native 'gh' @('release','create',$tag,$tarball,'release-artifacts/SHA256SUMS.txt','release-artifacts/dependencies.cdx.json','--repo',$repo,'--verify-tag','--prerelease','--title',"Procurement Writing Engine $tag",'--notes-file','docs/RELEASE_NOTES.md')
$visibility = Get-Native 'gh' @('repo','view',$repo,'--json','visibility','--jq','.visibility')
if ($visibility -ne 'PUBLIC') { Run-Native 'gh' @('repo','edit',$repo,'--visibility','public','--accept-visibility-change-consequences') }
Write-Host "Published GitHub alpha: https://github.com/$repo/releases/tag/$tag" -ForegroundColor Green
Write-Host 'Social preview: upload assets/social-preview.png in repository Settings > General > Social preview. No supported gh repo-edit image flag.'
