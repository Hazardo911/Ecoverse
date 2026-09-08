param([string[]]$Assets = @('fern_02','rock_moss_set_01','moss_01','forest_leaves_02'))
$ErrorActionPreference='Stop'
$sourceRoot=Join-Path (Split-Path $PSScriptRoot) '.local/forest-assets'
foreach($asset in $Assets) {
    if($asset -notmatch '^[a-z0-9_]+$'){throw 'Invalid asset id'}
    $folder=Join-Path $sourceRoot $asset
    New-Item -ItemType Directory -Force $folder | Out-Null
    $manifest=(Invoke-RestMethod "https://api.polyhaven.com/files/$asset").gltf.'1k'.gltf
    Invoke-WebRequest $manifest.url -OutFile (Join-Path $folder 'source.gltf')
    foreach($file in $manifest.include.PSObject.Properties) {
        $target=[IO.Path]::GetFullPath((Join-Path $folder $file.Name))
        if(!$target.StartsWith([IO.Path]::GetFullPath($folder)+[IO.Path]::DirectorySeparatorChar)){throw 'Invalid asset path'}
        New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
        Invoke-WebRequest $file.Value.url -OutFile $target
    }
    Write-Output "Downloaded $asset"
}
