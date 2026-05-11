$ErrorActionPreference = "Continue"
$results = [System.Collections.Generic.List[PSCustomObject]]::new()

function Pass([string]$label) { $results.Add([PSCustomObject]@{ Feature = $label; Status = "PASS" }) }
function Fail([string]$label, [string]$err = "") { $results.Add([PSCustomObject]@{ Feature = $label; Status = "FAIL  $err" }) }

# Login
try {
    $login = Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/auth/login' `
        -ContentType 'application/json' -Body '{"email":"test@example.com","password":"TestPass123!"}'
    $AT = $login.data.access_token
    if ($AT) { Write-Host "Auth OK" -ForegroundColor Green }
    else { Write-Error "No token"; exit 1 }
} catch { Write-Error "Login failed: $_"; exit 1 }

$H = @{ Authorization = "Bearer $AT" }

Write-Host "" ; Write-Host "Phase 6.4 AI Hook (API contract)" -ForegroundColor Cyan

# History shape
try {
    $aiHist = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/ai/history' -Headers $H
    $k = $aiHist.data.PSObject.Properties.Name
    if (($k -contains 'items') -and ($k -contains 'total') -and ($k -contains 'limit')) {
        Pass "6.4 useAiHistory - /ai/history returns correct shape"
    } else { Fail "6.4 useAiHistory - shape" "keys: $k" }
} catch { Fail "6.4 useAiHistory - GET /ai/history" "$_" }

# Limit param
try {
    $aiHistLim = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/ai/history?limit=5&offset=0' -Headers $H
    if ($aiHistLim.data.limit -eq 5) { Pass "6.4 useAiHistory - respects limit param" }
    else { Fail "6.4 useAiHistory - limit param" "got $($aiHistLim.data.limit)" }
} catch { Fail "6.4 useAiHistory - limit param" "$_" }

# Short question rejected 422
try {
    Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/ai/query' `
        -Headers $H -ContentType 'application/json' -Body '{"question":"Hi"}' | Out-Null
    Fail "6.4 useAiQuery - rejects short question (422)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 422) { Pass "6.4 useAiQuery - rejects short question (422)" }
    else { Fail "6.4 useAiQuery - short question" "got $code" }
}

# Missing question 422
try {
    Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/ai/query' `
        -Headers $H -ContentType 'application/json' -Body '{}' | Out-Null
    Fail "6.4 useAiQuery - rejects missing question (422)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 422) { Pass "6.4 useAiQuery - rejects missing question (422)" }
    else { Fail "6.4 useAiQuery - missing question" "got $code" }
}

# Valid question: 200 if API key set, 503 if not
try {
    $qb = '{"question":"What is total spend by platform?"}'
    Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/ai/query' `
        -Headers $H -ContentType 'application/json' -Body $qb | Out-Null
    Pass "6.4 useAiQuery - POST returned 200 (API key configured)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 503) { Pass "6.4 useAiQuery - 503 when API key absent (endpoint wired)" }
    else { Fail "6.4 useAiQuery - POST /ai/query" "got $code" }
}

# History detail - invalid id 422
try {
    Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/ai/history/bad-id' -Headers $H | Out-Null
    Fail "6.4 useAiHistoryDetail - invalid id should be 422"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 422) { Pass "6.4 useAiHistoryDetail - invalid id (422)" }
    else { Fail "6.4 useAiHistoryDetail - invalid id" "got $code" }
}

# History detail - nonexistent 404
try {
    Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/ai/history/000000000000000000000000' `
        -Headers $H | Out-Null
    Fail "6.4 useAiHistoryDetail - nonexistent should be 404"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 404) { Pass "6.4 useAiHistoryDetail - nonexistent (404)" }
    else { Fail "6.4 useAiHistoryDetail - nonexistent" "got $code" }
}

Write-Host "" ; Write-Host "Phase 6.5 AI Components" -ForegroundColor Cyan

# /ai page renders
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:3000/ai" -UseBasicParsing -TimeoutSec 15
    if ($resp.StatusCode -eq 200) { Pass "6.5 AiQueryPanel + AiResultCard - /ai renders (200)" }
    else { Fail "6.5 /ai page" "status $($resp.StatusCode)" }
} catch { Fail "6.5 /ai page renders" "$_" }

# Check React/Next content
try {
    $resp2 = Invoke-WebRequest -Uri "http://localhost:3000/ai" -UseBasicParsing -TimeoutSec 15
    if ($resp2.Content -match '__NEXT_DATA__|_next') {
        Pass "6.5 /ai page contains Next.js app shell"
    } else { Fail "6.5 /ai page Next.js content" }
} catch { Fail "6.5 /ai page Next.js check" "$_" }

Write-Host "" ; Write-Host "Phase 6.6 AI Page" -ForegroundColor Cyan

# All five pages load
foreach ($path in @('/ai', '/dashboard', '/reports', '/campaigns', '/connectors')) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:3000$path" -UseBasicParsing -TimeoutSec 15
        if ($r.StatusCode -eq 200) { Pass "6.6 Frontend $path (200)" }
        else { Fail "6.6 Frontend $path" "status $($r.StatusCode)" }
    } catch { Fail "6.6 Frontend $path" "$_" }
}

# Sidebar: AI Queries not marked soon
try {
    $sb = Get-Content "C:\Users\MSI-PC\Delta\mediaERP\frontend\components\layout\Sidebar.tsx" -Raw
    if ($sb -match 'AI Queries.*soon' -or $sb -match 'soon.*AI Queries') {
        Fail "6.6 Sidebar - AI Queries should NOT have soon:true"
    } else { Pass "6.6 Sidebar - AI Queries link enabled (no soon)" }
} catch { Fail "6.6 Sidebar check" "$_" }

Write-Host "" ; Write-Host "Auth guards" -ForegroundColor Cyan

# /ai/history no token
try {
    Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/ai/history' | Out-Null
    Fail "AI /history - unauthenticated should fail"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 401 -or $code -eq 403) { Pass "AI /history - unauthenticated (got $code)" }
    else { Fail "AI /history auth guard" "got $code" }
}

# /ai/query no token
try {
    $qb2 = '{"question":"test question here for auth"}'
    Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/ai/query' `
        -ContentType 'application/json' -Body $qb2 | Out-Null
    Fail "AI /query - unauthenticated should fail"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 401 -or $code -eq 403) { Pass "AI /query - unauthenticated (got $code)" }
    else { Fail "AI /query auth guard" "got $code" }
}

# Summary
$pass = ($results | Where-Object { $_.Status -eq "PASS" }).Count
$fail = ($results | Where-Object { $_.Status -ne "PASS" }).Count

Write-Host "" ; Write-Host "RESULTS" -ForegroundColor Cyan
$results | ForEach-Object {
    $icon  = if ($_.Status -eq "PASS") { "[PASS]" } else { "[FAIL]" }
    $color = if ($_.Status -eq "PASS") { "Green"  } else { "Red"   }
    Write-Host "$icon  $($_.Feature)" -ForegroundColor $color
    if ($_.Status -ne "PASS") { Write-Host "       $($_.Status)" -ForegroundColor DarkRed }
}
$sumColor = if ($fail -eq 0) { "Green" } else { "Yellow" }
Write-Host ""
Write-Host "PASSED: $pass   FAILED: $fail   TOTAL: $($results.Count)" -ForegroundColor $sumColor
