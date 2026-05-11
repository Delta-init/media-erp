$ErrorActionPreference = "Continue"

# Login
$login = Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/auth/login' `
    -ContentType 'application/json' `
    -Body '{"email":"test@example.com","password":"TestPass123!"}'
$AT = $login.data.access_token
$headers = @{ Authorization = "Bearer $AT" }
Write-Host "Logged in OK" -ForegroundColor Cyan

$pass = 0; $fail = 0
function Check($label, $cond) {
    if ($cond) { Write-Host "PASS  $label" -ForegroundColor Green; $script:pass++ }
    else        { Write-Host "FAIL  $label" -ForegroundColor Red;   $script:fail++ }
}

# 4.1 Overview
Write-Host "`n=== 4.1 Overview ===" -ForegroundColor Cyan
$ov = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/reports/overview?date_from=2024-01-01&date_to=2024-01-31' -Headers $headers
Check "success=true"      ($ov.success -eq $true)
Check "has kpis"          ($ov.data.kpis -ne $null)
Check "kpis.spend.value"  ($null -ne $ov.data.kpis.spend.PSObject.Properties['value'])
Check "kpis.ctr"          ($null -ne $ov.data.kpis.PSObject.Properties['ctr'])
Check "kpis.roas"         ($null -ne $ov.data.kpis.PSObject.Properties['roas'])
Check "date_from present" ($ov.data.date_from -eq '2024-01-01')

$ovP = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/reports/overview?platform=google_ads' -Headers $headers
Check "platform filter ok" ($ovP.success -eq $true)

# 4.2 Campaigns
Write-Host "`n=== 4.2 Campaigns ===" -ForegroundColor Cyan
$camp = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/reports/campaigns?page=1&limit=5' -Headers $headers
Check "success=true"        ($camp.success -eq $true)
# campaigns key exists (may be empty array)
Check "has campaigns key"   ($camp.data.PSObject.Properties.Name -contains 'campaigns')
Check "has total"           ($camp.data.PSObject.Properties.Name -contains 'total')
Check "has pages"           ($camp.data.PSObject.Properties.Name -contains 'pages')
Check "page=1"              ($camp.data.page -eq 1)
Check "limit=5"             ($camp.data.limit -eq 5)

$cs = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/reports/campaigns?search=zzz_no_match_xyz' -Headers $headers
Check "search→0 results"    ($cs.data.total -eq 0)

$csort = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/reports/campaigns?sort_by=spend&sort_dir=desc&limit=3' -Headers $headers
Check "sort desc ok"        ($csort.success -eq $true)

# 4.3 Trend
Write-Host "`n=== 4.3 Trend ===" -ForegroundColor Cyan
$tr = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/reports/trend?metric=spend&period=daily&date_from=2024-01-01&date_to=2024-01-31' -Headers $headers
Check "success=true"    ($tr.success -eq $true)
Check "metric=spend"    ($tr.data.metric -eq 'spend')
Check "period=daily"    ($tr.data.period -eq 'daily')
Check "data is array"   ($tr.data.data -is [array] -or $tr.data.data -eq $null)  # empty set = $null in PS

$trW = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/reports/trend?metric=clicks&period=weekly' -Headers $headers
Check "weekly period ok" ($trW.data.period -eq 'weekly')

$trI = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/reports/trend?metric=invalid_metric' -Headers $headers
Check "invalid metric→spend" ($trI.data.metric -eq 'spend')

# 4.4 Custom report
Write-Host "`n=== 4.4 Custom Report ===" -ForegroundColor Cyan
$customBody = @{
    metrics    = @('spend','clicks','ctr','roas')
    dimensions = @('platform','date')
    filters    = @{ date_from = '2024-01-01'; date_to = '2024-01-31' }
    chart_type = 'line'
} | ConvertTo-Json -Depth 5
$cr = Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/reports/custom' `
    -Headers $headers -ContentType 'application/json' -Body $customBody
Check "success=true"        ($cr.success -eq $true)
Check "has data key"        ($cr.data.PSObject.Properties.Name -contains 'data')
Check "metrics returned"    ($cr.data.metrics -contains 'spend')
Check "chart_type=line"     ($cr.data.chart_type -eq 'line')

$cb2 = @{
    metrics    = @('spend','revenue','roas')
    dimensions = @('campaign')
    filters    = @{}
    chart_type = 'bar'
} | ConvertTo-Json -Depth 5
$cr2 = Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/reports/custom' `
    -Headers $headers -ContentType 'application/json' -Body $cb2
Check "campaign dim ok" ($cr2.success -eq $true)

# 4.5 Saved Reports
Write-Host "`n=== 4.5 Saved Reports ===" -ForegroundColor Cyan
$sb = @{
    name='Smoke Test'; metrics=@('spend','clicks'); dimensions=@('platform')
    filters=@{ date_from='2024-01-01'; date_to='2024-01-31' }; chart_type='table'
} | ConvertTo-Json -Depth 5
$sc2 = Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/reports/saved' `
    -Headers $headers -ContentType 'application/json' -Body $sb
Check "create 201"      ($sc2.success -eq $true)
Check "has _id"         ($sc2.data._id -ne $null -and $sc2.data._id -ne '')
Check "has created_at"  ($sc2.data.created_at -ne $null -and $sc2.data.created_at -ne '')
$rid2 = $sc2.data._id

$listR = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/reports/saved' -Headers $headers
Check "list ok"         ($listR.success -eq $true)

$singleR = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/reports/saved/$rid2" -Headers $headers
Check "get by id ok"    ($singleR.data._id -eq $rid2)

try {
    Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/reports/saved/000000000000000000000000' -Headers $headers
    Check "non-existent → 404" $false
} catch {
    Check "non-existent → 404" ($_.Exception.Response.StatusCode.value__ -eq 404)
}

$reqDel = [System.Net.HttpWebRequest]::Create("http://localhost:8000/api/v1/reports/saved/$rid2")
$reqDel.Method = 'DELETE'; $reqDel.Headers.Add('Authorization', "Bearer $AT")
try {
    $rDel = $reqDel.GetResponse()
    $delSc = [int]$rDel.StatusCode; $rDel.Close()
    Check "delete → 204" ($delSc -eq 204)
} catch { Check "delete → 204" $false }

try {
    Invoke-RestMethod -Uri "http://localhost:8000/api/v1/reports/saved/$rid2" -Headers $headers
    Check "deleted → 404" $false
} catch {
    Check "deleted → 404" ($_.Exception.Response.StatusCode.value__ -eq 404)
}

# 4.6 CSV Export (via curl)
Write-Host "`n=== 4.6 CSV Export ===" -ForegroundColor Cyan
$csvUrl = "http://localhost:8000/api/v1/reports/export?metrics=spend,clicks,ctr&dimensions=platform,date&date_from=2024-01-01&date_to=2024-01-31"
$curlOut = & curl.exe -s -D - -H "Authorization: Bearer $AT" $csvUrl
$curlStr = $curlOut -join "`n"
Check "200 OK"              ($curlStr -match 'HTTP/1.1 200')
Check "content-type csv"    ($curlStr -match 'content-type: text/csv')
Check "content-disposition" ($curlStr -match 'report\.csv')
Check "header row present"  ($curlStr -match 'platform')
Check "spend in header"     ($curlStr -match 'spend')
Check "ctr in header"       ($curlStr -match 'ctr')
Write-Host "      CSV body line:" (($curlOut | Select-Object -Last 3) -join ' | ')

# Summary
Write-Host "`n============================" -ForegroundColor Cyan
Write-Host "PASSED: $pass   FAILED: $fail" -ForegroundColor $(if($fail -eq 0){'Green'}else{'Yellow'})
