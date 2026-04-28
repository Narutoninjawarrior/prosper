# Hearth Process Observatory — filters to dev/Hearth-relevant Windows processes.
# Called by Vite dev server only (local).

$ErrorActionPreference = 'SilentlyContinue'

$rows = @( Get-CimInstance Win32_Process | Where-Object {
        $n = $_.Name
        $cl = $_.CommandLine
        if ($null -eq $cl) { $cl = '' }
        ($n -match 'node\.exe|python\.exe|cmd\.exe|powershell\.exe|Code\.exe|Cursor\.exe|chrome\.exe|msedge\.exe|brave\.exe') -or
        ($cl -like '*\Hearth\*') -or
        ($cl -like '*prosper2*') -or
        ($cl -like '*lmstudio*') -or
        ($cl -like '*openclaw*') -or
        ($cl -like '*LM Studio*')
    } | ForEach-Object {
        $cl = $_.CommandLine
        if ($null -eq $cl) { $cl = '' }
        if ($cl.Length -gt 600) {
            $cl = $cl.Substring(0, 600) + '...'
        }
        [PSCustomObject]@{
            pid         = [int]$_.ProcessId
            name        = [string]$_.Name
            commandLine = [string]$cl
        }
    } | Sort-Object name, pid )

if ($rows.Count -eq 0) {
    '[]'
} else {
    $rows | ConvertTo-Json -Compress -Depth 4
}
