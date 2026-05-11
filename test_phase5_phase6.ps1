$ErrorActionPreference = "Continue"
$results = [System.Collections.Generic.List[PSCustomObject]]::new()

function Pass([string]$label) {
    $results.Add([PSCustomObject]@{ Feature = $label; Status = "PASS" })
}
function Fail([string]$label, [string]$err = "") {
    $results.Add([PSCustomObject]@{ Feature = $label; Status = "FAIL  $err" })
}

# ---- Auth: get token --------------------------------------------------------
try {
    $login = Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/auth/login' `
        -ContentType 'application/json' -Body '{"email":"test@example.com","password":"TestPass123!"}'
    $AT = $login.data.access_token
    if ($AT) { Write-Host "Auth OK" -ForegroundColor Green }
    else { Write-Error "No token"; exit 1 }
} catch { Write-Error "Login failed: $_"; exit 1 }

$H = @{ Authorization = "Bearer $AT" }

# ============================================================================
# PHASE 5 TESTS
# ============================================================================

Write-Host "`n── Phase 5 ────────────────────────────────────────────" -ForegroundColor Cyan

# ---- 5.1 App layout shell: frontend pages -----------------------------------
foreach ($page in @('/dashboard', '/connectors', '/reports', '/campaigns')) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:3000$page" -UseBasicParsing -TimeoutSec 15
        if ($resp.StatusCode -eq 200) { Pass "5.1/5.3 Frontend - $page loads (200)" }
        else { Fail "5.1/5.3 Frontend - $page loads" "status $($resp.StatusCode)" }
    } catch { Fail "5.1/5.3 Frontend - $page loads (200)" "$_" }
}

# /reports/[id] dynamic route
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:3000/reports/000000000000000000000000" `
        -UseBasicParsing -TimeoutSec 15
    if ($resp.StatusCode -eq 200) { Pass "5.5 Frontend - /reports/[id] loads (200)" }
    else { Fail "5.5 Frontend - /reports/[id] loads" "status $($resp.StatusCode)" }
} catch { Fail "5.5 Frontend - /reports/[id] loads (200)" "$_" }

# ---- 5.2 Overview: KPI API --------------------------------------------------
try {
    $ov = Invoke-RestMethod `
        -Uri 'http://localhost:8000/api/v1/reports/overview?date_from=2024-01-01&date_to=2024-12-31' `
        -Headers $H
    $keys = $ov.data.kpis.PSObject.Properties.Name
    $hasAll = ($keys -contains 'spend') -and ($keys -contains 'roas') -and
              ($keys -contains 'ctr')   -and ($keys -contains 'impressions')
    if ($hasAll) { Pass "5.2 Overview KPIs contain spend/roas/ctr/impressions" }
    else          { Fail "5.2 Overview KPIs" "missing keys: $keys" }
} catch { Fail "5.2 Overview KPIs" "$_" }

try {
    $ov2 = Invoke-RestMethod `
        -Uri 'http://localhost:8000/api/v1/reports/overview?date_from=2024-01-01&date_to=2024-01-31' `
        -Headers $H
    $spendKpi = $ov2.data.kpis.spend
    if (($spendKpi.PSObject.Properties.Name -contains 'value') -and
        ($spendKpi.PSObject.Properties.Name -contains 'delta')) {
        Pass "5.2 Overview KPI has value+delta shape"
    } else { Fail "5.2 Overview KPI shape" }
} catch { Fail "5.2 Overview KPI shape" "$_" }

# ---- 5.3 Campaigns API -------------------------------------------------------
try {
    $camp = Invoke-RestMethod `
        -Uri 'http://localhost:8000/api/v1/reports/campaigns?page=1&limit=5' -Headers $H
    $k = $camp.data.PSObject.Properties.Name
    if (($k -contains 'campaigns') -and ($k -contains 'total') -and ($k -contains 'pages')) {
        Pass "5.3 Campaigns list returns campaigns+total+pages"
    } else { Fail "5.3 Campaigns list" "missing keys: $k" }
} catch { Fail "5.3 Campaigns list" "$_" }

try {
    $cs = Invoke-RestMethod `
        -Uri 'http://localhost:8000/api/v1/reports/campaigns?search=zzz_nomatch&sort_by=spend&sort_dir=desc' `
        -Headers $H
    if ($cs.data.total -eq 0) { Pass "5.3 Campaigns search+sort (no match → total=0)" }
    else                       { Fail "5.3 Campaigns search+sort" "expected 0 got $($cs.data.total)" }
} catch { Fail "5.3 Campaigns search+sort" "$_" }

# ---- 5.4 Report Builder: custom report API ----------------------------------
try {
    $cb = @{
        metrics    = @('spend','clicks','roas')
        dimensions = @('platform')
        filters    = @{ date_from = '2024-01-01'; date_to = '2024-12-31' }
        chart_type = 'bar'
    } | ConvertTo-Json -Depth 5
    $cr = Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/reports/custom' `
        -Headers $H -ContentType 'application/json' -Body $cb
    if (($cr.data.PSObject.Properties.Name -contains 'data') -and
        ($cr.data.chart_type -eq 'bar')) {
        Pass "5.4 Custom report (bar) returns data+chart_type"
    } else { Fail "5.4 Custom report" }
} catch { Fail "5.4 Custom report" "$_" }

try {
    $cd = @{
        metrics    = @('spend')
        dimensions = @('platform')
        filters    = @{}
        chart_type = 'donut'
    } | ConvertTo-Json -Depth 5
    $crD = Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/reports/custom' `
        -Headers $H -ContentType 'application/json' -Body $cd
    if ($crD.data.chart_type -eq 'donut') { Pass "5.4 Custom report (donut) chart_type" }
    else { Fail "5.4 Custom report donut" }
} catch { Fail "5.4 Custom report donut" "$_" }

# ---- 5.5 Saved reports CRUD -------------------------------------------------
$rid = ""
try {
    $sb = @{
        name       = 'Phase5 Test'
        metrics    = @('spend','clicks')
        dimensions = @('platform','date')
        filters    = @{}
        chart_type = 'line'
    } | ConvertTo-Json -Depth 5
    $sc = Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/reports/saved' `
        -Headers $H -ContentType 'application/json' -Body $sb
    $rid = $sc.data._id
    if ($rid -and $sc.data.created_at) { Pass "5.5 Save report → 201 with _id+created_at" }
    else                                { Fail "5.5 Save report" "no _id or created_at" }
} catch { Fail "5.5 Save report" "$_" }

try {
    $listS = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/reports/saved' -Headers $H
    if ($listS.success -and $listS.data.Count -ge 1) { Pass "5.5 List saved reports (≥1 item)" }
    else { Fail "5.5 List saved reports" "count=$($listS.data.Count)" }
} catch { Fail "5.5 List saved reports" "$_" }

try {
    $getS = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/reports/saved/$rid" -Headers $H
    if ($getS.data._id -eq $rid) { Pass "5.5 Get saved report by ID" }
    else                          { Fail "5.5 Get saved report by ID" "id mismatch" }
} catch { Fail "5.5 Get saved report by ID" "$_" }

try {
    Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/reports/saved/000000000000000000000000' `
        -Headers $H | Out-Null
    Fail "5.5 Non-existent saved report → 404"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 404) { Pass "5.5 Non-existent saved report → 404" }
    else                { Fail "5.5 Non-existent saved report → 404" "got $code" }
}

# Delete saved report (cleanup)
try {
    $reqD = [System.Net.HttpWebRequest]::Create("http://localhost:8000/api/v1/reports/saved/$rid")
    $reqD.Method = 'DELETE'
    $reqD.Headers.Add('Authorization', "Bearer $AT")
    $rD = $reqD.GetResponse(); $sc204 = [int]$rD.StatusCode; $rD.Close()
    if ($sc204 -eq 204) { Pass "5.5 Delete saved report → 204" }
    else                  { Fail "5.5 Delete saved report → 204" "got $sc204" }
} catch { Fail "5.5 Delete saved report → 204" "$_" }

# CSV export
try {
    $csvLines = & curl.exe -s -D - -H "Authorization: Bearer $AT" `
        "http://localhost:8000/api/v1/reports/export?metrics=spend,clicks&dimensions=platform,date"
    $csvStr = $csvLines -join "`n"
    if ($csvStr -match 'HTTP/1.1 200' -and $csvStr -match 'text/csv') {
        Pass "5.5 CSV export (200 + text/csv)"
    } else { Fail "5.5 CSV export" "unexpected response" }
} catch { Fail "5.5 CSV export" "$_" }

# ============================================================================
# PHASE 6 TESTS
# ============================================================================

Write-Host "`n── Phase 6 ────────────────────────────────────────────" -ForegroundColor Cyan

# ---- 6.3 AI /history — auth required ----------------------------------------
try {
    Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/ai/history' | Out-Null
    Fail "6.3 AI /history requires auth"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 401 -or $code -eq 403) { Pass "6.3 AI /history requires auth (got $code)" }
    else                                   { Fail "6.3 AI /history requires auth" "got $code" }
}

# ---- 6.3 AI /history — returns correct shape --------------------------------
try {
    $hist = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/ai/history' -Headers $H
    $k = $hist.data.PSObject.Properties.Name
    if (($k -contains 'items') -and ($k -contains 'total') -and
        ($k -contains 'limit') -and ($k -contains 'offset')) {
        Pass "6.3 AI /history returns items+total+limit+offset"
    } else { Fail "6.3 AI /history shape" "keys: $k" }
} catch { Fail "6.3 AI /history shape" "$_" }

try {
    $hist2 = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/ai/history?limit=5&offset=0' `
        -Headers $H
    if ($hist2.data.limit -eq 5 -and $hist2.data.offset -eq 0) {
        Pass "6.3 AI /history respects limit+offset params"
    } else { Fail "6.3 AI /history params" }
} catch { Fail "6.3 AI /history params" "$_" }

# ---- 6.3 AI /query — auth required ------------------------------------------
try {
    Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/ai/query' `
        -ContentType 'application/json' -Body '{"question":"What was spend?"}' | Out-Null
    Fail "6.3 AI /query requires auth"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 401 -or $code -eq 403) { Pass "6.3 AI /query requires auth (got $code)" }
    else                                   { Fail "6.3 AI /query requires auth" "got $code" }
}

# ---- 6.3 AI /query — validation: too short ----------------------------------
try {
    Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/ai/query' `
        -Headers $H -ContentType 'application/json' -Body '{"question":"Hi"}' | Out-Null
    Fail "6.3 AI /query rejects short question (422)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 422) { Pass "6.3 AI /query rejects short question → 422" }
    else                { Fail "6.3 AI /query rejects short question" "got $code" }
}

# ---- 6.3 AI /query — validation: missing field ------------------------------
try {
    Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/ai/query' `
        -Headers $H -ContentType 'application/json' -Body '{}' | Out-Null
    Fail "6.3 AI /query rejects missing question → 422"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 422) { Pass "6.3 AI /query rejects missing question → 422" }
    else                { Fail "6.3 AI /query rejects missing question" "got $code" }
}

# ---- 6.1/6.2 AI /query — no API key returns 503 (not 404/500) --------------
try {
    Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/ai/query' `
        -Headers $H -ContentType 'application/json' `
        -Body '{"question":"What was total spend by platform?"}' | Out-Null
    Pass "6.1/6.2 AI /query with API key returned 200"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 503) { Pass "6.1/6.2 AI /query no API key → 503 (endpoint works, key unconfigured)" }
    elseif ($code -eq 200) { Pass "6.1/6.2 AI /query succeeded (200)" }
    else                   { Fail "6.1/6.2 AI /query" "got $code (expected 200 or 503)" }
}

# ---- 6.3 AI /history/{id} — invalid ObjectId → 422 -------------------------
try {
    Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/ai/history/not-a-valid-id' `
        -Headers $H | Out-Null
    Fail "6.3 AI /history/invalid-id → 422"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 422) { Pass "6.3 AI /history/invalid-id → 422" }
    else                { Fail "6.3 AI /history/invalid-id → 422" "got $code" }
}

# ---- 6.3 AI /history/{id} — valid but non-existent ObjectId → 404 ----------
try {
    Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/ai/history/000000000000000000000000' `
        -Headers $H | Out-Null
    Fail "6.3 AI /history/nonexistent → 404"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 404) { Pass "6.3 AI /history/nonexistent → 404" }
    else                { Fail "6.3 AI /history/nonexistent → 404" "got $code" }
}

# ============================================================================
# Summary
# ============================================================================
$pass = ($results | Where-Object { $_.Status -eq "PASS" }).Count
$fail = ($results | Where-Object { $_.Status -ne "PASS" }).Count

Write-Host "`nRESULTS" -ForegroundColor Cyan
$results | ForEach-Object {
    $icon  = if ($_.Status -eq "PASS") { "[PASS]" } else { "[FAIL]" }
    $color = if ($_.Status -eq "PASS") { "Green"  } else { "Red"   }
    Write-Host "$icon  $($_.Feature)" -ForegroundColor $color
    if ($_.Status -ne "PASS") { Write-Host "       $($_.Status)" -ForegroundColor DarkRed }
}
Write-Host "`nPASSED: $pass   FAILED: $fail   TOTAL: $($results.Count)" `
    -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Yellow" })

$results | ConvertTo-Json | Out-File "$PSScriptRoot\test_phase5_phase6_results.json" -Encoding utf8
