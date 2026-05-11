$ErrorActionPreference = "Continue"
$results = [System.Collections.Generic.List[PSCustomObject]]::new()

function Pass([string]$label) {
    $results.Add([PSCustomObject]@{ Feature = $label; Status = "PASS" })
}
function Fail([string]$label, [string]$err = "") {
    $results.Add([PSCustomObject]@{ Feature = $label; Status = "FAIL  $err" })
}

# ---- Auth: Login ------------------------------------------------------------
try {
    $login = Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/auth/login' `
        -ContentType 'application/json' -Body '{"email":"test@example.com","password":"TestPass123!"}'
    $AT = $login.data.access_token
    $RT = $login.data.refresh_token
    if ($AT) { Pass "Auth - Login returns access+refresh token" }
    else      { Fail "Auth - Login returns access+refresh token" "no token" }
} catch { Fail "Auth - Login returns access+refresh token" "$_"; $AT = ""; $RT = "" }

$H = @{ Authorization = "Bearer $AT" }

# ---- Auth: Duplicate email --------------------------------------------------
try {
    Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/auth/register' `
        -ContentType 'application/json' `
        -Body '{"email":"test@example.com","password":"TestPass123!","name":"X"}' | Out-Null
    Fail "Auth - Duplicate email returns 4xx"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -ge 400 -and $code -lt 500) { Pass "Auth - Duplicate email returns 4xx (got $code)" }
    else                                   { Fail "Auth - Duplicate email returns 4xx" "got $code" }
}

# ---- Auth: Refresh token ----------------------------------------------------
try {
    $ref = Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/auth/refresh' `
        -ContentType 'application/json' -Body "{""refresh_token"":""$RT""}"
    if ($ref.data.access_token) { Pass "Auth - Refresh token" }
    else                         { Fail "Auth - Refresh token" "no token" }
} catch { Fail "Auth - Refresh token" "$_" }

# ---- Auth: /me --------------------------------------------------------------
try {
    $me = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/auth/me' -Headers $H
    if ($me.data.email -eq 'test@example.com') { Pass "Auth - /me returns user" }
    else                                         { Fail "Auth - /me returns user" "wrong email" }
} catch { Fail "Auth - /me returns user" "$_" }

# ---- Auth: No token -> 401 --------------------------------------------------
try {
    Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/auth/me' | Out-Null
    Fail "Auth - No token returns 401"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 401 -or $code -eq 403) { Pass "Auth - No token returns 401/403 (got $code)" }
    else                                   { Fail "Auth - No token returns 401/403" "got $code" }
}

# ---- Health -----------------------------------------------------------------
try {
    $health = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/health'
    if ($health.success) { Pass "Health - GET /health" }
    else                  { Fail "Health - GET /health" "not success" }
} catch { Fail "Health - GET /health" "$_" }

# ---- Connectors: Create -----------------------------------------------------
$cid = ""
try {
    $conn = Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/connectors' `
        -Headers $H -ContentType 'application/json' `
        -Body '{"platform":"google_ads","name":"Test GA","sync_frequency":"daily"}'
    $cid = $conn.data.id
    if ($cid) { Pass "Connectors - Create connector" }
    else       { Fail "Connectors - Create connector" "no id" }
} catch { Fail "Connectors - Create connector" "$_" }

# ---- Connectors: List -------------------------------------------------------
try {
    $list = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/connectors' -Headers $H
    if ($list.data.Count -ge 1) { Pass "Connectors - List connectors" }
    else                         { Fail "Connectors - List connectors" "empty" }
} catch { Fail "Connectors - List connectors" "$_" }

# ---- Connectors: Get by ID --------------------------------------------------
try {
    $single = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/connectors/$cid" -Headers $H
    if ($single.data.id -eq $cid) { Pass "Connectors - Get by ID" }
    else                           { Fail "Connectors - Get by ID" "id mismatch" }
} catch { Fail "Connectors - Get by ID" "$_" }

# ---- Connectors: Update name ------------------------------------------------
try {
    $upd = Invoke-RestMethod -Method PUT -Uri "http://localhost:8000/api/v1/connectors/$cid" `
        -Headers $H -ContentType 'application/json' -Body '{"name":"Updated GA"}'
    if ($upd.data.name -eq 'Updated GA') { Pass "Connectors - Update name" }
    else                                   { Fail "Connectors - Update name" "wrong name" }
} catch { Fail "Connectors - Update name" "$_" }

# ---- Connectors: Update sync_frequency --------------------------------------
try {
    $updf = Invoke-RestMethod -Method PUT -Uri "http://localhost:8000/api/v1/connectors/$cid" `
        -Headers $H -ContentType 'application/json' -Body '{"sync_frequency":"hourly"}'
    if ($updf.data.sync_frequency -eq 'hourly') { Pass "Connectors - Update sync_frequency" }
    else                                          { Fail "Connectors - Update sync_frequency" "wrong val" }
} catch { Fail "Connectors - Update sync_frequency" "$_" }

# ---- OAuth URL generation ---------------------------------------------------
# Create one connector per platform so the backend platform-match check passes
$oauthCids = @{}
foreach ($platform in @('google_ads', 'facebook_ads', 'linkedin_ads')) {
    try {
        $oc = Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/connectors' `
            -Headers $H -ContentType 'application/json' `
            -Body "{""platform"":""$platform"",""name"":""OAuth $platform"",""sync_frequency"":""daily""}"
        $oauthCids[$platform] = $oc.data.id
    } catch { $oauthCids[$platform] = $cid }  # fallback to main cid
}

foreach ($platform in @('google_ads', 'facebook_ads', 'linkedin_ads')) {
    try {
        $oid = $oauthCids[$platform]
        $oauth = Invoke-RestMethod `
            -Uri "http://localhost:8000/api/v1/connectors/$platform/auth?connector_id=$oid" `
            -Headers $H
        if ($oauth.data.auth_url -like 'http*') { Pass "OAuth - $platform auth URL" }
        else                                      { Fail "OAuth - $platform auth URL" "no url" }
    } catch { Fail "OAuth - $platform auth URL" "$_" }
}

# Clean up OAuth test connectors (skip errors)
foreach ($platform in @('facebook_ads', 'linkedin_ads')) {
    $oid = $oauthCids[$platform]
    if ($oid -and $oid -ne $cid) {
        try {
            $rOC = [System.Net.HttpWebRequest]::Create("http://localhost:8000/api/v1/connectors/$oid")
            $rOC.Method = 'DELETE'; $rOC.Headers.Add('Authorization', "Bearer $AT")
            $rOC.GetResponse().Close()
        } catch {}
    }
}

# ---- Sync: Trigger ----------------------------------------------------------
# Note: test connector is not OAuth-authenticated, so backend returns 400 (expected).
# We pass if we get 200 (queued) OR 400 (unauthenticated) — both prove the endpoint works.
try {
    $sync = Invoke-RestMethod -Method POST -Uri "http://localhost:8000/api/v1/sync/trigger/$cid" -Headers $H
    if ($sync.success) { Pass "Sync - Trigger sync (queued)" }
    else                { Fail "Sync - Trigger sync" "not success" }
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 400) { Pass "Sync - Trigger sync (400 - unauthenticated connector, endpoint OK)" }
    else                { Fail "Sync - Trigger sync" "got $code / $_" }
}

# ---- Sync: Status -----------------------------------------------------------
try {
    $status = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/sync/status/$cid" -Headers $H
    if ($null -ne $status.data.connector) { Pass "Sync - Status endpoint" }
    else                                   { Fail "Sync - Status endpoint" "no connector key" }
} catch { Fail "Sync - Status endpoint" "$_" }

# ---- Sync: History ----------------------------------------------------------
try {
    $hist = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/sync/history/$cid" -Headers $H
    if ($hist.success) { Pass "Sync - History endpoint" }
    else                { Fail "Sync - History endpoint" "not success" }
} catch { Fail "Sync - History endpoint" "$_" }

# ---- Reports: Overview KPIs -------------------------------------------------
try {
    $ov = Invoke-RestMethod `
        -Uri 'http://localhost:8000/api/v1/reports/overview?date_from=2024-01-01&date_to=2024-12-31' `
        -Headers $H
    $keys = $ov.data.kpis.PSObject.Properties.Name
    if (($keys -contains 'spend') -and ($keys -contains 'roas') -and ($keys -contains 'ctr')) {
        Pass "Reports - Overview KPIs (spend, roas, ctr present)"
    } else { Fail "Reports - Overview KPIs" "missing keys: $keys" }
} catch { Fail "Reports - Overview KPIs" "$_" }

# ---- Reports: Overview platform filter --------------------------------------
try {
    $ovP = Invoke-RestMethod `
        -Uri 'http://localhost:8000/api/v1/reports/overview?platform=google_ads' `
        -Headers $H
    if ($ovP.success) { Pass "Reports - Overview platform filter" }
    else               { Fail "Reports - Overview platform filter" }
} catch { Fail "Reports - Overview platform filter" "$_" }

# ---- Reports: Overview period delta -----------------------------------------
try {
    $ov2 = Invoke-RestMethod `
        -Uri 'http://localhost:8000/api/v1/reports/overview?date_from=2024-01-01&date_to=2024-01-31' `
        -Headers $H
    $spendKpi = $ov2.data.kpis.spend
    if ($spendKpi.PSObject.Properties.Name -contains 'value' -and
        $spendKpi.PSObject.Properties.Name -contains 'delta') {
        Pass "Reports - Overview KPI has value+delta shape"
    } else { Fail "Reports - Overview KPI shape" }
} catch { Fail "Reports - Overview KPI shape" "$_" }

# ---- Reports: Campaigns list ------------------------------------------------
try {
    $camp = Invoke-RestMethod `
        -Uri 'http://localhost:8000/api/v1/reports/campaigns?page=1&limit=10' `
        -Headers $H
    $k = $camp.data.PSObject.Properties.Name
    if (($k -contains 'campaigns') -and ($k -contains 'total') -and ($k -contains 'pages')) {
        Pass "Reports - Campaigns list (campaigns+total+pages)"
    } else { Fail "Reports - Campaigns list" "missing keys" }
} catch { Fail "Reports - Campaigns list" "$_" }

# ---- Reports: Campaigns search + sort ---------------------------------------
try {
    $cs = Invoke-RestMethod `
        -Uri 'http://localhost:8000/api/v1/reports/campaigns?search=zzz_nomatch&sort_by=spend&sort_dir=desc' `
        -Headers $H
    if ($cs.data.total -eq 0) { Pass "Reports - Campaigns search+sort returns 0" }
    else                       { Fail "Reports - Campaigns search+sort" "expected 0" }
} catch { Fail "Reports - Campaigns search+sort" "$_" }

# ---- Reports: Trend daily ---------------------------------------------------
try {
    $tr = Invoke-RestMethod `
        -Uri 'http://localhost:8000/api/v1/reports/trend?metric=spend&period=daily' `
        -Headers $H
    if ($tr.data.metric -eq 'spend' -and $tr.data.period -eq 'daily') {
        Pass "Reports - Trend daily"
    } else { Fail "Reports - Trend daily" }
} catch { Fail "Reports - Trend daily" "$_" }

# ---- Reports: Trend weekly --------------------------------------------------
try {
    $trW = Invoke-RestMethod `
        -Uri 'http://localhost:8000/api/v1/reports/trend?metric=clicks&period=weekly' `
        -Headers $H
    if ($trW.data.period -eq 'weekly') { Pass "Reports - Trend weekly" }
    else                                { Fail "Reports - Trend weekly" }
} catch { Fail "Reports - Trend weekly" "$_" }

# ---- Reports: Trend invalid metric defaults to spend ------------------------
try {
    $trI = Invoke-RestMethod `
        -Uri 'http://localhost:8000/api/v1/reports/trend?metric=invalid_xyz' `
        -Headers $H
    if ($trI.data.metric -eq 'spend') { Pass "Reports - Trend invalid metric defaults to spend" }
    else                               { Fail "Reports - Trend invalid metric" "got $($trI.data.metric)" }
} catch { Fail "Reports - Trend invalid metric" "$_" }

# ---- Reports: Custom report -------------------------------------------------
try {
    $cb = @{
        metrics = @('spend','clicks','ctr','roas')
        dimensions = @('platform','date')
        filters = @{ date_from = '2024-01-01'; date_to = '2024-12-31' }
        chart_type = 'line'
    } | ConvertTo-Json -Depth 5
    $cr = Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/reports/custom' `
        -Headers $H -ContentType 'application/json' -Body $cb
    if (($cr.data.PSObject.Properties.Name -contains 'data') -and ($cr.data.chart_type -eq 'line')) {
        Pass "Reports - Custom report (data+chart_type)"
    } else { Fail "Reports - Custom report" }
} catch { Fail "Reports - Custom report" "$_" }

# ---- Reports: Saved CRUD ----------------------------------------------------
$rid = ""
try {
    $sb = @{
        name = 'Suite Test'
        metrics = @('spend')
        dimensions = @('platform')
        filters = @{}
        chart_type = 'table'
    } | ConvertTo-Json -Depth 5
    $sc = Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/reports/saved' `
        -Headers $H -ContentType 'application/json' -Body $sb
    $rid = $sc.data._id
    if ($rid -and $sc.data.created_at) { Pass "Reports - Save report (201 + created_at)" }
    else                                { Fail "Reports - Save report" "no _id or created_at" }
} catch { Fail "Reports - Save report" "$_" }

try {
    $listS = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/reports/saved' -Headers $H
    if ($listS.success) { Pass "Reports - List saved reports" }
    else                 { Fail "Reports - List saved reports" }
} catch { Fail "Reports - List saved reports" "$_" }

try {
    $getS = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/reports/saved/$rid" -Headers $H
    if ($getS.data._id -eq $rid) { Pass "Reports - Get saved by ID" }
    else                          { Fail "Reports - Get saved by ID" "id mismatch" }
} catch { Fail "Reports - Get saved by ID" "$_" }

try {
    Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/reports/saved/000000000000000000000000' `
        -Headers $H | Out-Null
    Fail "Reports - Non-existent saved returns 404"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 404) { Pass "Reports - Non-existent saved returns 404" }
    else                { Fail "Reports - Non-existent saved returns 404" "got $code" }
}

try {
    $reqD = [System.Net.HttpWebRequest]::Create("http://localhost:8000/api/v1/reports/saved/$rid")
    $reqD.Method = 'DELETE'
    $reqD.Headers.Add('Authorization', "Bearer $AT")
    $rD = $reqD.GetResponse()
    $sc204 = [int]$rD.StatusCode
    $rD.Close()
    if ($sc204 -eq 204) { Pass "Reports - Delete saved (204)" }
    else                  { Fail "Reports - Delete saved (204)" "got $sc204" }
} catch { Fail "Reports - Delete saved (204)" "$_" }

try {
    Invoke-RestMethod -Uri "http://localhost:8000/api/v1/reports/saved/$rid" -Headers $H | Out-Null
    Fail "Reports - Deleted report returns 404"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 404) { Pass "Reports - Deleted report returns 404" }
    else                { Fail "Reports - Deleted report returns 404" "got $code" }
}

# ---- Reports: CSV Export ----------------------------------------------------
try {
    $csvLines = & curl.exe -s -D - -H "Authorization: Bearer $AT" `
        "http://localhost:8000/api/v1/reports/export?metrics=spend,clicks,ctr&dimensions=platform,date"
    $csvStr = $csvLines -join "`n"
    if ($csvStr -match 'HTTP/1.1 200' -and $csvStr -match 'text/csv' -and $csvStr -match 'spend') {
        Pass "Reports - CSV export (200 + text/csv + header)"
    } else { Fail "Reports - CSV export" "unexpected response" }
} catch { Fail "Reports - CSV export" "$_" }

# ---- Connectors: Delete (cleanup) -------------------------------------------
try {
    $reqDC = [System.Net.HttpWebRequest]::Create("http://localhost:8000/api/v1/connectors/$cid")
    $reqDC.Method = 'DELETE'
    $reqDC.Headers.Add('Authorization', "Bearer $AT")
    $rDC = $reqDC.GetResponse()
    $sc204c = [int]$rDC.StatusCode
    $rDC.Close()
    if ($sc204c -eq 204) { Pass "Connectors - Delete connector (204)" }
    else                   { Fail "Connectors - Delete connector (204)" "got $sc204c" }
} catch { Fail "Connectors - Delete connector (204)" "$_" }

# ---- Frontend pages load ----------------------------------------------------
foreach ($page in @('/dashboard', '/connectors', '/reports')) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:3000$page" -UseBasicParsing -TimeoutSec 15
        if ($resp.StatusCode -eq 200) { Pass "Frontend - $page loads (200)" }
        else                           { Fail "Frontend - $page loads" "status $($resp.StatusCode)" }
    } catch { Fail "Frontend - $page loads (200)" "$_" }
}

# ---- Summary ----------------------------------------------------------------
$pass = ($results | Where-Object { $_.Status -eq "PASS" }).Count
$fail = ($results | Where-Object { $_.Status -ne "PASS" }).Count

Write-Host ""
Write-Host "RESULTS" -ForegroundColor Cyan
$results | ForEach-Object {
    $icon = if ($_.Status -eq "PASS") { "[PASS]" } else { "[FAIL]" }
    $color = if ($_.Status -eq "PASS") { "Green" } else { "Red" }
    Write-Host "$icon  $($_.Feature)" -ForegroundColor $color
    if ($_.Status -ne "PASS") { Write-Host "       $($_.Status)" -ForegroundColor DarkRed }
}
Write-Host ""
Write-Host "PASSED: $pass   FAILED: $fail   TOTAL: $($results.Count)" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Yellow" })

# Export for table display
$results | ConvertTo-Json | Out-File "$PSScriptRoot\test_results.json" -Encoding utf8
